import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../db';
import { authenticate, requireActiveUser, AuthRequest } from '../middleware/auth';

const router=Router();
const MAX_MINUTES=48*60;
const API_VERSION=process.env.CASHFREE_API_VERSION||'2025-01-01';
const CHECKOUT_LOCK_MINUTES=10;
const CHECKOUT_LOCK_MESSAGE='Someone else is booking this space right now. Please check another board or try again after 10 minutes.';
const SYSTEM_CURRENCY='USD';
const DEFAULT_MAIN_30=0.21;
const DEFAULT_SIDE_30=1.05;

function cashfreeBaseUrl(){
 return (process.env.CASHFREE_ENV||'sandbox').toLowerCase()==='production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';
}

function cashfreeHeaders(idempotencyKey?:string){
 const clientId=process.env.CASHFREE_CLIENT_ID;
 const clientSecret=process.env.CASHFREE_CLIENT_SECRET;
 if(!clientId||!clientSecret)throw Object.assign(new Error('Cashfree Payments is not configured. Add CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET to backend/.env.'),{status:503});
 return {
  'Content-Type':'application/json',
  'Accept':'application/json',
  'x-api-version':API_VERSION,
  'x-client-id':clientId,
  'x-client-secret':clientSecret,
  ...(idempotencyKey?{'x-idempotency-key':idempotencyKey}:{}),
 };
}

function priceFor(billboard:{type:string;minBid:any},minutes:number){
 if(minutes<=0||minutes%30!==0||minutes>MAX_MINUTES) throw new Error('Duration must be in 30-minute steps, maximum 2 days');
 const configured=Number(billboard.minBid);
 const per30=Number.isFinite(configured)&&configured>0
  ? configured
  : (billboard.type==='Wall'||billboard.type==='WALL'||billboard.type==='Street'||billboard.type==='STREET'?DEFAULT_SIDE_30:DEFAULT_MAIN_30);

 // The admin-controlled minBid is the USD price for one 30-minute slot.
 // At exactly 24h the discounted 1-day package is used. After the first day,
 // the rate is 9.52% lower than the base rate, matching the launch pricing model.
 if(minutes<1440)return (minutes/30)*per30;
 const firstDay=per30*40;
 const after24Per30=per30*(0.19/0.21);
 const extraDay=after24Per30*48;
 const fullDays=Math.floor(minutes/1440);
 const remainder=minutes%1440;
 return firstDay+Math.max(0,fullDays-1)*extraDay+(remainder/30)*after24Per30;
}

function normalizeCashfreeError(status:number, body:any){
 const message=body?.message||body?.error||body?.type||'Cashfree request failed';
 return Object.assign(new Error(String(message)),{status:status>=400&&status<600?status:502});
}

async function activatePayment(paymentId:string, providerPaymentId?:string, providerEventId?:string){
 await prisma.$transaction(async tx=>{
  const payment=await tx.payment.findUnique({where:{id:paymentId},include:{booking:true}});
  if(!payment||payment.status==='SUCCEEDED')return;
  const now=new Date();
  const alreadyActive=await tx.booking.findFirst({where:{billboardId:payment.booking.billboardId,status:'ACTIVE',endDate:{gt:now},id:{not:payment.bookingId}}});
  if(alreadyActive)throw Object.assign(new Error('This advertising space was booked by another completed payment.'),{status:409});
  const endDate=new Date(now.getTime()+payment.booking.durationMinutes*60*1000);
  await tx.payment.update({where:{id:payment.id},data:{status:'SUCCEEDED',providerPaymentId:providerPaymentId||payment.providerPaymentId,providerEventId:providerEventId||payment.providerEventId,currency:SYSTEM_CURRENCY}});
  await tx.booking.update({where:{id:payment.bookingId},data:{status:'ACTIVE',startDate:now,endDate}});
  await tx.billboard.update({where:{id:payment.booking.billboardId},data:{isAvailable:false,currentBid:payment.booking.amount,currentBidderId:payment.userId}});
  await tx.checkoutLock.deleteMany({where:{billboardId:payment.booking.billboardId}});
 });
}

router.post('/checkout',authenticate,requireActiveUser,async(req:AuthRequest,res,next)=>{
 try{
  const data=z.object({
   billboardId:z.string(),durationMinutes:z.number().int().min(30).max(MAX_MINUTES),
   companyName:z.string().min(2).max(80).optional(),description:z.string().max(500).optional(),
   advertisementId:z.string().optional(),
  }).parse(req.body);
  if(data.durationMinutes%30!==0)return res.status(400).json({error:'Choose time in 30-minute steps'});

  const now=new Date();
  const prepared=await prisma.$transaction(async tx=>{
   await tx.checkoutLock.deleteMany({where:{expiresAt:{lte:now}}});
   const lockExpiresAt=new Date(now.getTime()+CHECKOUT_LOCK_MINUTES*60*1000);

   let billboard=await tx.billboard.findUnique({where:{id:data.billboardId}});
   if(!billboard){
    const wall=data.billboardId.startsWith('W');
    billboard=await tx.billboard.create({data:{id:data.billboardId,name:(wall?'Wallboard ':'Billboard ')+data.billboardId,type:wall?'Wall':'Premium Road',positionX:0,positionY:0,positionZ:0,location:'UrbanCity',isAvailable:true,isActive:true,minBid:wall?DEFAULT_SIDE_30:DEFAULT_MAIN_30}});
   }
   if(!billboard)throw Object.assign(new Error('Billboard not found'),{status:404});
   const taken=await tx.booking.findFirst({where:{billboardId:data.billboardId,status:'ACTIVE',endDate:{gt:now}}});
   if(taken)throw Object.assign(new Error('This advertising space is currently reserved or booked'),{status:409});

   const currentLock=await tx.checkoutLock.findUnique({where:{billboardId:data.billboardId}});
   if(currentLock&&currentLock.userId!==req.user!.id)throw Object.assign(new Error(CHECKOUT_LOCK_MESSAGE),{status:409});

   const amount=priceFor(billboard,data.durationMinutes);
   let booking:any;
   if(currentLock?.bookingId){
    const existing=await tx.booking.findFirst({where:{id:currentLock.bookingId,userId:req.user!.id,status:'PAYMENT_PENDING'},include:{payment:true}});
    if(existing){
     booking=await tx.booking.update({where:{id:existing.id},data:{startDate:now,endDate:lockExpiresAt,durationMinutes:data.durationMinutes,amount,companyName:data.companyName||req.user!.displayName||req.user!.username,description:data.description||null,advertisementId:data.advertisementId}});
     if(existing.payment)await tx.payment.delete({where:{id:existing.payment.id}});
    }
   }
   if(!booking){
    booking=await tx.booking.create({data:{userId:req.user!.id,billboardId:data.billboardId,startDate:now,endDate:lockExpiresAt,durationMinutes:data.durationMinutes,amount,companyName:data.companyName||req.user!.displayName||req.user!.username,description:data.description||null,advertisementId:data.advertisementId,status:'PAYMENT_PENDING'}});
   }

   if(currentLock){
    await tx.checkoutLock.update({where:{id:currentLock.id},data:{userId:req.user!.id,bookingId:booking.id,expiresAt:lockExpiresAt}});
   }else{
    try{
     await tx.checkoutLock.create({data:{billboardId:data.billboardId,userId:req.user!.id,bookingId:booking.id,expiresAt:lockExpiresAt}});
    }catch(error:any){
     if(error?.code==='P2002')throw Object.assign(new Error(CHECKOUT_LOCK_MESSAGE),{status:409});
     throw error;
    }
   }

   const payment=await tx.payment.create({data:{bookingId:booking.id,userId:req.user!.id,provider:'CASHFREE',amount,currency:SYSTEM_CURRENCY,status:'PENDING'}});
   return {booking,payment,amount};
  });

  try{
   const environment=(process.env.CASHFREE_ENV||'sandbox').toLowerCase();
   const phone=environment==='production'
    ? (process.env.CASHFREE_CUSTOMER_PHONE||'')
    : (process.env.CASHFREE_TEST_CUSTOMER_PHONE||'9999999999');
   if(!phone)throw Object.assign(new Error('Set CASHFREE_CUSTOMER_PHONE before using Cashfree production checkout.'),{status:503});

   const orderId='UC_'+prepared.payment.id.replace(/-/g,'').slice(0,40);
   const frontend=process.env.FRONTEND_URL||'http://localhost:5173';
   const response=await fetch(cashfreeBaseUrl()+'/orders',{
    method:'POST',
    headers:cashfreeHeaders(crypto.randomUUID()),
    body:JSON.stringify({
     order_id:orderId,
     order_amount:Number(prepared.amount.toFixed(2)),
     order_currency:SYSTEM_CURRENCY,
     customer_details:{
      customer_id:req.user!.id,
      customer_name:req.user!.displayName||req.user!.username,
      customer_email:req.user!.email,
      customer_phone:phone,
     },
     order_meta:{
      return_url:frontend+'/?payment=return&booking='+encodeURIComponent(prepared.booking.id)+'&order_id={order_id}',
      ...(process.env.CASHFREE_NOTIFY_URL?{notify_url:process.env.CASHFREE_NOTIFY_URL}:{}),
     },
     order_note:'UrbanCity advertising booking '+prepared.booking.id,
     order_tags:{booking_id:prepared.booking.id,payment_id:prepared.payment.id,currency:SYSTEM_CURRENCY},
    }),
   });
   const order:any=await response.json().catch(()=>({}));
   if(!response.ok)throw normalizeCashfreeError(response.status,order);
   if(!order.payment_session_id||!order.order_id)throw Object.assign(new Error('Cashfree did not return a payment session.'),{status:502});

   await prisma.payment.update({where:{id:prepared.payment.id},data:{provider:'CASHFREE',providerPaymentId:order.order_id,checkoutSessionId:order.payment_session_id,status:'CHECKOUT_CREATED',currency:SYSTEM_CURRENCY}});
   res.status(201).json({
    bookingId:prepared.booking.id,
    paymentId:prepared.payment.id,
    orderId:order.order_id,
    paymentSessionId:order.payment_session_id,
    amount:prepared.amount,
    currency:SYSTEM_CURRENCY,
    environment:environment==='production'?'production':'sandbox',
   });
  }catch(error){
   await prisma.$transaction([
    prisma.payment.update({where:{id:prepared.payment.id},data:{status:'FAILED'}}),
    prisma.booking.update({where:{id:prepared.booking.id},data:{status:'PAYMENT_FAILED'}}),
    prisma.checkoutLock.deleteMany({where:{bookingId:prepared.booking.id}}),
   ]);
   throw error;
  }
 }catch(e){next(e)}
});

router.get('/:bookingId/verify',authenticate,async(req:AuthRequest,res,next)=>{
 try{
  const orderId=String(req.query.order_id||'');
  const payment=await prisma.payment.findFirst({where:{bookingId:req.params.bookingId,userId:req.user!.id},include:{booking:true}});
  if(!payment)return res.status(404).json({error:'Payment not found'});
  if(payment.provider!=='CASHFREE')return res.status(400).json({error:'This payment is not a Cashfree payment'});
  if(!orderId||orderId!==payment.providerPaymentId)return res.status(400).json({error:'Payment order does not match this booking'});

  const response=await fetch(cashfreeBaseUrl()+'/orders/'+encodeURIComponent(orderId),{headers:cashfreeHeaders()});
  const order:any=await response.json().catch(()=>({}));
  if(!response.ok)throw normalizeCashfreeError(response.status,order);

  const amountMatches=Math.abs(Number(order.order_amount)-Number(payment.amount))<0.001;
  const currencyMatches=order.order_currency===SYSTEM_CURRENCY;
  if(order.order_status==='PAID'&&amountMatches&&currencyMatches){
   await activatePayment(payment.id,orderId);
   return res.json({paid:true,paymentStatus:'SUCCEEDED',bookingStatus:'ACTIVE',amount:Number(payment.amount),currency:SYSTEM_CURRENCY});
  }
  if(['EXPIRED','TERMINATED'].includes(order.order_status)){
   await prisma.$transaction([
    prisma.payment.update({where:{id:payment.id},data:{status:'CANCELLED'}}),
    prisma.booking.update({where:{id:payment.bookingId},data:{status:'PAYMENT_CANCELLED'}}),
    prisma.checkoutLock.deleteMany({where:{bookingId:payment.bookingId}}),
   ]);
  }
  res.json({paid:false,paymentStatus:payment.status,bookingStatus:payment.booking.status,providerStatus:order.order_status||'UNKNOWN',amount:Number(payment.amount),currency:SYSTEM_CURRENCY});
 }catch(e){next(e)}
});

router.get('/:bookingId/status',authenticate,async(req:AuthRequest,res,next)=>{
 try{
  const payment=await prisma.payment.findFirst({where:{bookingId:req.params.bookingId,userId:req.user!.id},include:{booking:true}});
  if(!payment)return res.status(404).json({error:'Payment not found'});
  res.json({payment:{id:payment.id,status:payment.status,amount:Number(payment.amount),currency:SYSTEM_CURRENCY,provider:payment.provider},booking:{id:payment.booking.id,status:payment.booking.status}});
 }catch(e){next(e)}
});

router.post('/webhook/cashfree',async(req,res)=>{
 try{
  const raw=(req as any).rawBody;
  const signature=String(req.headers['x-webhook-signature']||'');
  const timestamp=String(req.headers['x-webhook-timestamp']||'');
  if(!raw||!signature||!timestamp)return res.status(400).json({error:'Missing webhook signature'});
  const ts=Number(timestamp);
  if(!Number.isFinite(ts)||Math.abs(Date.now()-ts)>5*60*1000)return res.status(400).json({error:'Expired webhook timestamp'});
  const secret=process.env.CASHFREE_CLIENT_SECRET;
  if(!secret)return res.status(503).json({error:'Cashfree is not configured'});
  const expected=crypto.createHmac('sha256',secret).update(timestamp+raw).digest('base64');
  const a=Buffer.from(expected),b=Buffer.from(signature);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Invalid webhook signature'});

  const event:any=JSON.parse(raw);
  const orderId=event?.data?.order?.order_id;
  const cfPaymentId=event?.data?.payment?.cf_payment_id?String(event.data.payment.cf_payment_id):undefined;
  const paymentStatus=event?.data?.payment?.payment_status;
  const amount=Number(event?.data?.order?.order_amount);
  const currency=event?.data?.order?.order_currency;
  if(!orderId)return res.status(200).json({received:true});

  const payment=await prisma.payment.findFirst({where:{provider:'CASHFREE',providerPaymentId:orderId},include:{booking:true}});
  if(!payment)return res.status(200).json({received:true});
  if(Math.abs(amount-Number(payment.amount))>=0.001||currency!==SYSTEM_CURRENCY)return res.status(400).json({error:'Webhook amount/currency mismatch'});

  const eventId=String(req.headers['x-idempotency-key']||cfPaymentId||'');
  if(paymentStatus==='SUCCESS'||event?.type==='PAYMENT_SUCCESS_WEBHOOK'){
   await activatePayment(payment.id,orderId,eventId||undefined);
  }else if(paymentStatus==='FAILED'||event?.type==='PAYMENT_FAILED_WEBHOOK'){
   if(payment.status!=='SUCCEEDED')await prisma.$transaction([
    prisma.payment.update({where:{id:payment.id},data:{status:'FAILED',providerEventId:eventId||undefined,currency:SYSTEM_CURRENCY}}),
    prisma.booking.update({where:{id:payment.bookingId},data:{status:'PAYMENT_FAILED'}}),
    prisma.checkoutLock.deleteMany({where:{bookingId:payment.bookingId}}),
   ]);
  }else if(paymentStatus==='USER_DROPPED'||event?.type==='PAYMENT_USER_DROPPED_WEBHOOK'){
   if(payment.status!=='SUCCEEDED')await prisma.$transaction([
    prisma.payment.update({where:{id:payment.id},data:{status:'CANCELLED',providerEventId:eventId||undefined,currency:SYSTEM_CURRENCY}}),
    prisma.booking.update({where:{id:payment.bookingId},data:{status:'PAYMENT_CANCELLED'}}),
    prisma.checkoutLock.deleteMany({where:{bookingId:payment.bookingId}}),
   ]);
  }
  res.status(200).json({received:true,currency:SYSTEM_CURRENCY});
 }catch(error){
  console.error('Cashfree webhook processing failed',error);
  res.status(500).json({error:'Webhook processing failed'});
 }
});

export {router as paymentRouter};
