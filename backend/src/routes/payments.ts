import { Router } from 'express';
import { z } from 'zod';
import DodoPayments from 'dodopayments';
import { prisma } from '../db';
import { authenticate, requireActiveUser, AuthRequest } from '../middleware/auth';

const router=Router();
const MAX_MINUTES=48*60;

function priceFor(type:string, minutes:number){
 const main=type==='Premium Road';
 if(minutes<=0||minutes%30!==0||minutes>MAX_MINUTES) throw new Error('Duration must be in 30-minute steps, maximum 2 days');
 if(!main)return (minutes/30)*1.05;
 if(minutes===1440)return 8.40;
 if(minutes>1440)return 8.40+((minutes-1440)/30)*0.19;
 return (minutes/30)*0.21;
}

function dodo(){
 const key=process.env.DODO_PAYMENTS_API_KEY;
 if(!key)throw Object.assign(new Error('Dodo Payments is not configured'),{status:503});
 return new (DodoPayments as any)({
  bearerToken:key,
  environment:process.env.DODO_PAYMENTS_ENVIRONMENT||'test_mode',
  webhookKey:process.env.DODO_PAYMENTS_WEBHOOK_KEY,
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
   let billboard=await tx.billboard.findUnique({where:{id:data.billboardId}});
   if(!billboard){const wall=data.billboardId.startsWith('W');billboard=await tx.billboard.create({data:{id:data.billboardId,name:(wall?'Wallboard ':'Billboard ')+data.billboardId,type:wall?'Wall':'Premium Road',positionX:0,positionY:0,positionZ:0,location:'UrbanCity',isAvailable:true,isActive:true,minBid:0}});}
   if(!billboard)throw Object.assign(new Error('Billboard not found'),{status:404});
   const taken=await tx.booking.findFirst({where:{billboardId:data.billboardId,status:{in:['ACTIVE','PAYMENT_PENDING']},endDate:{gt:now}}});
   if(taken)throw Object.assign(new Error('This advertising space is currently reserved or booked'),{status:409});
   const amount=priceFor(billboard.type,data.durationMinutes);
   const endDate=new Date(now.getTime()+data.durationMinutes*60*1000);
   const booking=await tx.booking.create({data:{userId:req.user!.id,billboardId:data.billboardId,startDate:now,endDate,durationMinutes:data.durationMinutes,amount,companyName:data.companyName||req.user!.displayName||req.user!.username,description:data.description||null,advertisementId:data.advertisementId,status:'PAYMENT_PENDING'}});
   const payment=await tx.payment.create({data:{bookingId:booking.id,userId:req.user!.id,amount,currency:'USD',status:'PENDING'}});
   return {booking,payment,amount};
  });
  try{
   const client=dodo();
   // Dodo checkout uses products. The product is generated server-side from the
   // authoritative UrbanCity price, so the browser can never alter the amount.
   const cents=Math.round(prepared.amount*100);
   const product=await (client as any).products.create({
    name:'UrbanCity '+prepared.booking.billboardId+' · '+data.durationMinutes+' minutes',
    description:'Advertising space booking '+prepared.booking.id,
    price:{currency:'USD',price:cents,discount:0,type:'one_time_price'},
    tax_category:'digital_products',
    metadata:{bookingId:prepared.booking.id},
   });
   const frontend=process.env.FRONTEND_URL||'http://localhost:5173';
   const session=await (client as any).checkoutSessions.create({
    product_cart:[{product_id:product.product_id,quantity:1}],
    customer:{email:req.user!.email,name:req.user!.displayName||req.user!.username},
    return_url:frontend+'/?payment=return&booking='+encodeURIComponent(prepared.booking.id),
    metadata:{bookingId:prepared.booking.id,paymentId:prepared.payment.id,userId:req.user!.id},
   });
   await prisma.payment.update({where:{id:prepared.payment.id},data:{checkoutSessionId:session.session_id,status:'CHECKOUT_CREATED'}});
   res.status(201).json({bookingId:prepared.booking.id,paymentId:prepared.payment.id,amount:prepared.amount,currency:'USD',checkoutUrl:session.checkout_url});
  }catch(error){
   await prisma.$transaction([
    prisma.payment.update({where:{id:prepared.payment.id},data:{status:'FAILED'}}),
    prisma.booking.update({where:{id:prepared.booking.id},data:{status:'PAYMENT_FAILED'}}),
   ]);
   throw error;
  }
 }catch(e){next(e)}
});

router.get('/:bookingId/status',authenticate,async(req:AuthRequest,res,next)=>{
 try{
  const payment=await prisma.payment.findFirst({where:{bookingId:req.params.bookingId,userId:req.user!.id},include:{booking:true}});
  if(!payment)return res.status(404).json({error:'Payment not found'});
  res.json({payment:{id:payment.id,status:payment.status,amount:Number(payment.amount),currency:payment.currency},booking:{id:payment.booking.id,status:payment.booking.status}});
 }catch(e){next(e)}
});

router.post('/webhook/dodo',async(req,res)=>{
 const client=dodo();
 try{
  const raw=(req as any).rawBody||JSON.stringify(req.body);
  const payload=(client as any).webhooks.unwrap(raw,{headers:{
   'webhook-id':String(req.headers['webhook-id']||''),
   'webhook-signature':String(req.headers['webhook-signature']||''),
   'webhook-timestamp':String(req.headers['webhook-timestamp']||''),
  }});
  const event:any=payload;
  const data=event.data||{};
  const bookingId=data?.metadata?.bookingId||data?.metadata?.booking_id;
  const providerPaymentId=data?.payment_id||data?.id;
  const eventId=String(req.headers['webhook-id']||'')||undefined;
  if(!bookingId)return res.status(200).json({received:true});
  const payment=await prisma.payment.findUnique({where:{bookingId}});
  if(!payment)return res.status(200).json({received:true});
  if(event.type==='payment.succeeded'){
   await prisma.$transaction(async tx=>{
    const fresh=await tx.payment.findUnique({where:{id:payment.id}});
    if(!fresh||fresh.status==='SUCCEEDED')return;
    await tx.payment.update({where:{id:payment.id},data:{status:'SUCCEEDED',providerPaymentId,providerEventId:eventId}});
    await tx.booking.update({where:{id:bookingId},data:{status:'ACTIVE'}});
    const booking=await tx.booking.findUnique({where:{id:bookingId}});
    if(booking)await tx.billboard.update({where:{id:booking.billboardId},data:{isAvailable:false,currentBid:booking.amount,currentBidderId:booking.userId}});
   });
  }else if(['payment.failed','payment.cancelled'].includes(event.type)){
   await prisma.payment.update({where:{id:payment.id},data:{status:event.type==='payment.cancelled'?'CANCELLED':'FAILED',providerPaymentId,providerEventId:eventId}});
   await prisma.booking.update({where:{id:bookingId},data:{status:event.type==='payment.cancelled'?'PAYMENT_CANCELLED':'PAYMENT_FAILED'}});
  }
  res.status(200).json({received:true});
 }catch(error){
  console.error('Dodo webhook verification failed',error);
  res.status(401).json({error:'Invalid webhook signature'});
 }
});

export {router as paymentRouter};
