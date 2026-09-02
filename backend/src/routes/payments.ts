import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../db';
import { authenticate, requireActiveUser, AuthRequest } from '../middleware/auth';

const router=Router();
const MAX_MINUTES=48*60;
const API_VERSION=process.env.CASHFREE_API_VERSION||'2025-01-01';

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

function priceFor(type:string, minutes:number){
 const main=type==='Premium Road';
 if(minutes<=0||minutes%30!==0||minutes>MAX_MINUTES) throw new Error('Duration must be in 30-minute steps, maximum 2 days');
 // UrbanCity is now collected through an INR gateway. These preserve the previous
 // price scale ($0.21 -> ₹21, $1.05 -> ₹105, one-day package $8.40 -> ₹840).
 if(!main)return (minutes/30)*105;
 if(minutes===1440)return 840;
 if(minutes>1440)return 840+((minutes-1440)/30)*19;
 return (minutes/30)*21;
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
  // Pending checkout attempts never own inventory. Only a successfully paid
  // booking may block a billboard, so abandoned checkout cannot leave it stuck.
  const alreadyActive=await tx.booking.findFirst({where:{billboardId:payment.booking.billboardId,status:'ACTIVE',endDate:{gt:now},id:{not:payment.bookingId}}});
  if(alreadyActive)throw Object.assign(new Error('This advertising space was booked by another completed payment.'),{status:409});
  const endDate=new Date(now.getTime()+payment.booking.durationMinutes*60*1000);
  await tx.payment.update({where:{id:payment.id},data:{status:'SUCCEEDED',providerPaymentId:providerPaymentId||payment.providerPaymentId,providerEventId:providerEventId||payment.providerEventId}});
  await tx.booking.update({where:{id:payment.bookingId},data:{status:'ACTIVE',startDate:now,endDate}});
  await tx.billboard.update({where:{id:payment.booking.billboardId},data:{isAvailable:false,currentBid:payment.booking.amount,currentBidderId:payment.userId}});
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
   // Release abandoned checkout reservations after 30 minutes.
   const staleBefore=new Date(Date.now()-30*60*1000);
   await tx.booking.updateMany({where:{status:'PAYMENT_PENDING',createdAt:{lt:staleBefore}},data:{status:'PAYMENT_CANCELLED'}});

   let billboard=await tx.billboard.findUnique({where:{id:data.billboardId}});
   if(!billboard){
    const wall=data.billboardId.startsWith('W');
    billboard=await tx.billboard.create({data:{id:data.billboardId,name:(wall?'Wallboard ':'Billboard ')+data.billboardId,type:wall?'Wall':'Premium Road',positionX:0,positionY:0,positionZ:0,location:'UrbanCity',isAvailable:true,isActive:true,minBid:0}});
   }
   if(!billboard)throw Object.assign(new Error('Billboard not found'),{status:404});
   const taken=await tx.booking.findFirst({where:{billboardId:data.billboardId,status:'ACTIVE',endDate:{gt:now}}});
   if(taken)throw Object.assign(new Error('This advertising space is currently reserved or booked'),{status:409});

   const amount=priceFor(billboard.type,data.durationMinutes);
   // Reuse the user's current pending booking for this billboard. A retry is a new
   // payment attempt, not a new reservation record.
   const existing=await tx.booking.findFirst({where:{userId:req.user!.id,billboardId:data.billboardId,status:'PAYMENT_PENDING'},include:{payment:true},orderBy:{createdAt:'desc'}});
   const provisionalEnd=new Date(now.getTime()+30*60*1000);
   let booking:any;
   if(existing){
    booking=await tx.booking.update({where:{id:existing.id},data:{startDate:now,endDate:provisionalEnd,durationMinutes:data.durationMinutes,amount,companyName:data.companyName||req.user!.displayName||req.user!.username,description:data.description||null,advertisementId:data.advertisementId}});
    if(existing.payment)await tx.payment.delete({where:{id:existing.payment.id}});
   }else{
    booking=await tx.booking.create({data:{userId:req.user!.id,billboardId:data.billboardId,startDate:now,endDate:provisionalEnd,durationMinutes:data.durationMinutes,amount,companyName:data.companyName||req.user!.displayName||req.user!.username,description:data.description||null,advertisementId:data.advertisementId,status:'PAYMENT_PENDING'}});
   }
   const payment=await tx.payment.create({data:{bookingId:booking.id,userId:req.user!.id,provider:'CASHFREE',amount,currency:'INR',status:'PENDING'}});
   return {booking,payment,amount};
  });

  try{
   const environment=(process.env.CASHFREE_ENV||'sandbox').toLowerCase();
   const phone=environment==='production'
    ? (process.env.CASHFREE_CUSTOMER_PHONE||'')
    : (process.env.CASHFREE_TEST_CUSTOMER_PHONE||'9999999999');
   if(!phone)throw Object.assign(new Error('Set CASHFREE_CUSTOMER_PHONE before using Cashfree production checkout.'),{status:503});

   // Every Cashfree checkout attempt needs its own provider order ID. The booking
   // can be reused on retries, but the payment attempt is new.
   const orderId='UC_'+prepared.payment.id.replace(/-/g,'').slice(0,40);
   const frontend=process.env.FRONTEND_URL||'http://localhost:5173';
   const response=await fetch(cashfreeBaseUrl()+'/orders',{
    method:'POST',
    headers:cashfreeHeaders(crypto.randomUUID()),
    body:JSON.stringify({
     order_id:orderId,
     order_amount:Number(prepared.amount.toFixed(2)),
     order_currency:'INR',
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
     order_tags:{booking_id:prepared.booking.id,payment_id:prepared.payment.id},
    }),
   });
   const order:any=await response.json().catch(()=>({}));
   if(!response.ok)throw normalizeCashfreeError(response.status,order);
   if(!order.payment_session_id||!order.order_id)throw Object.assign(new Error('Cashfree did not return a payment session.'),{status:502});

   await prisma.payment.update({where:{id:prepared.payment.id},data:{provider:'CASHFREE',providerPaymentId:order.order_id,checkoutSessionId:order.payment_session_id,status:'CHECKOUT_CREATED'}});
   res.status(201).json({
    bookingId:prepared.booking.id,
    paymentId:prepared.payment.id,
    orderId:order.order_id,
    paymentSessionId:order.payment_session_id,
    amount:prepared.amount,
    currency:'INR',
    environment:environment==='production'?'production':'sandbox',
   });
  }catch(error){
   await prisma.$transaction([
    prisma.payment.update({where:{id:prepared.payment.id},data:{status:'FAILED'}}),
    prisma.booking.update({where:{id:prepared.booking.id},data:{status:'PAYMENT_FAILED'}}),
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
  const currencyMatches=order.order_currency==='INR';
  if(order.order_status==='PAID'&&amountMatches&&currencyMatches){
   await activatePayment(payment.id,orderId);
   return res.json({paid:true,paymentStatus:'SUCCEEDED',bookingStatus:'ACTIVE'});
  }
  if(['EXPIRED','TERMINATED'].includes(order.order_status)){
   await prisma.$transaction([
    prisma.payment.update({where:{id:payment.id},data:{status:'CANCELLED'}}),
    prisma.booking.update({where:{id:payment.bookingId},data:{status:'PAYMENT_CANCELLED'}}),
   ]);
  }
  res.json({paid:false,paymentStatus:payment.status,bookingStatus:payment.booking.status,providerStatus:order.order_status||'UNKNOWN'});
 }catch(e){next(e)}
});

router.get('/:bookingId/status',authenticate,async(req:AuthRequest,res,next)=>{
 try{
  const payment=await prisma.payment.findFirst({where:{bookingId:req.params.bookingId,userId:req.user!.id},include:{booking:true}});
  if(!payment)return res.status(404).json({error:'Payment not found'});
  res.json({payment:{id:payment.id,status:payment.status,amount:Number(payment.amount),currency:payment.currency,provider:payment.provider},booking:{id:payment.booking.id,status:payment.booking.status}});
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
  if(Math.abs(amount-Number(payment.amount))>=0.001||currency!=='INR')return res.status(400).json({error:'Webhook amount mismatch'});

  const eventId=String(req.headers['x-idempotency-key']||cfPaymentId||'');
  if(paymentStatus==='SUCCESS'||event?.type==='PAYMENT_SUCCESS_WEBHOOK'){
   await activatePayment(payment.id,orderId,eventId||undefined);
  }else if(paymentStatus==='FAILED'||event?.type==='PAYMENT_FAILED_WEBHOOK'){
   if(payment.status!=='SUCCEEDED')await prisma.$transaction([
    prisma.payment.update({where:{id:payment.id},data:{status:'FAILED',providerEventId:eventId||undefined}}),
    prisma.booking.update({where:{id:payment.bookingId},data:{status:'PAYMENT_FAILED'}}),
   ]);
  }else if(paymentStatus==='USER_DROPPED'||event?.type==='PAYMENT_USER_DROPPED_WEBHOOK'){
   if(payment.status!=='SUCCEEDED')await prisma.$transaction([
    prisma.payment.update({where:{id:payment.id},data:{status:'CANCELLED',providerEventId:eventId||undefined}}),
    prisma.booking.update({where:{id:payment.bookingId},data:{status:'PAYMENT_CANCELLED'}}),
   ]);
  }
  res.status(200).json({received:true});
 }catch(error){
  console.error('Cashfree webhook processing failed',error);
  res.status(500).json({error:'Webhook processing failed'});
 }
});

export {router as paymentRouter};
