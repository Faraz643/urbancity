import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { Webhook } from 'standardwebhooks';
import { prisma } from '../db';
import { authenticate, requireActiveUser, AuthRequest } from '../middleware/auth';

const router=Router();
const MAX_MINUTES=48*60;
const API_VERSION=process.env.CASHFREE_API_VERSION||'2025-01-01';
const CHECKOUT_LOCK_MINUTES=10;
const CHECKOUT_LOCK_MESSAGE='Someone else is booking this space right now. Please check another board or try again after 10 minutes.';
const BASE_CURRENCY='USD';
const DEFAULT_MAIN_30=0.21;
const DEFAULT_SIDE_30=1.05;

function cashfreeBaseUrl(){
 return (process.env.CASHFREE_ENV||'sandbox').toLowerCase()==='production'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg';
}
function cashfreeHeaders(idempotencyKey?:string){
 const clientId=process.env.CASHFREE_CLIENT_ID;
 const clientSecret=process.env.CASHFREE_CLIENT_SECRET;
 if(!clientId||!clientSecret)throw Object.assign(new Error('Cashfree Payments is not configured.'),{status:503});
 return {'Content-Type':'application/json','Accept':'application/json','x-api-version':API_VERSION,'x-client-id':clientId,'x-client-secret':clientSecret,...(idempotencyKey?{'x-idempotency-key':idempotencyKey}:{})};
}
function dodoBaseUrl(){return (process.env.DODO_PAYMENTS_ENVIRONMENT||'live_mode').toLowerCase()==='test_mode'?'https://test.dodopayments.com':'https://live.dodopayments.com';}
function dodoHeaders(){const key=process.env.DODO_PAYMENTS_API_KEY;if(!key)throw Object.assign(new Error('Dodo Payments is not configured. Add DODO_PAYMENTS_API_KEY.'),{status:503});return {'Content-Type':'application/json','Accept':'application/json','Authorization':'Bearer '+key};}
function priceFor(billboard:{type:string;minBid:any},minutes:number){
 if(minutes<=0||minutes%30!==0||minutes>MAX_MINUTES)throw new Error('Duration must be in 30-minute steps, maximum 2 days');
 const configured=Number(billboard.minBid);
 const per30=Number.isFinite(configured)&&configured>0?configured:(billboard.type==='Wall'||billboard.type==='WALL'||billboard.type==='Street'||billboard.type==='STREET'?DEFAULT_SIDE_30:DEFAULT_MAIN_30);
 if(minutes<1440)return (minutes/30)*per30;
 const firstDay=per30*40;
 const after24Per30=per30*(0.19/0.21);
 const fullDays=Math.floor(minutes/1440);
 const remainder=minutes%1440;
 return firstDay+Math.max(0,fullDays-1)*after24Per30*48+(remainder/30)*after24Per30;
}
function normalizeProviderError(status:number,body:any){return Object.assign(new Error(String(body?.message||body?.error||body?.type||'Payment provider request failed')),{status:status>=400&&status<600?status:502});}
async function detectCountry(req:AuthRequest){
 const header=String(req.headers['x-urban-country']||req.headers['cf-ipcountry']||req.headers['x-vercel-ip-country']||'').trim().toUpperCase();
 if(/^[A-Z]{2}$/.test(header))return header;
 const forced=String(process.env.PAYMENT_DEFAULT_COUNTRY||'').trim().toUpperCase();
 if(/^[A-Z]{2}$/.test(forced))return forced;
 const forwarded=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
 const ip=forwarded||req.socket.remoteAddress||'';
 const cleanIp=ip.replace(/^::ffff:/,'');
 if(!cleanIp||cleanIp==='127.0.0.1'||cleanIp==='::1')return 'IN';
 try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),1800);const r=await fetch('https://ipapi.co/'+encodeURIComponent(cleanIp)+'/country/',{signal:controller.signal,headers:{Accept:'text/plain'}});clearTimeout(timer);if(r.ok){const country=(await r.text()).trim().toUpperCase();if(/^[A-Z]{2}$/.test(country))return country;}}catch{}
 return 'ZZ';
}
async function getUsdInrRate(){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),4000);
 try{const r=await fetch('https://api.frankfurter.app/latest?from=USD&to=INR',{signal:controller.signal,headers:{Accept:'application/json'}});const d:any=await r.json().catch(()=>({}));if(!r.ok||!Number.isFinite(Number(d?.rates?.INR))||Number(d.rates.INR)<=0)throw new Error('FX rate unavailable');return Number(d.rates.INR);}finally{clearTimeout(timer)}
}
async function activatePayment(paymentId:string,providerPaymentId?:string,providerEventId?:string,chargedAmount?:number,chargedCurrency?:string){
 await prisma.$transaction(async tx=>{
  const payment=await tx.payment.findUnique({where:{id:paymentId},include:{booking:true}});if(!payment||payment.status==='SUCCEEDED')return;
  const now=new Date();const alreadyActive=await tx.booking.findFirst({where:{billboardId:payment.booking.billboardId,status:'ACTIVE',endDate:{gt:now},id:{not:payment.bookingId}}});
  if(alreadyActive)throw Object.assign(new Error('This advertising space was booked by another completed payment.'),{status:409});
  const endDate=new Date(now.getTime()+payment.booking.durationMinutes*60*1000);
  await tx.payment.update({where:{id:payment.id},data:{status:'SUCCEEDED',providerPaymentId:providerPaymentId||payment.providerPaymentId,providerEventId:providerEventId||payment.providerEventId,amount:chargedAmount??payment.amount,currency:chargedCurrency||payment.currency}});
  await tx.booking.update({where:{id:payment.bookingId},data:{status:'ACTIVE',startDate:now,endDate}});
  await tx.billboard.update({where:{id:payment.booking.billboardId},data:{isAvailable:false,currentBid:payment.booking.amount,currentBidderId:payment.userId}});
  await tx.checkoutLock.deleteMany({where:{billboardId:payment.booking.billboardId}});
 });
}
async function failPayment(paymentId:string,status:'FAILED'|'CANCELLED'){
 const payment=await prisma.payment.findUnique({where:{id:paymentId}});if(!payment||payment.status==='SUCCEEDED')return;
 await prisma.$transaction([
  prisma.payment.update({where:{id:paymentId},data:{status}}),
  prisma.booking.update({where:{id:payment.bookingId},data:{status:status==='FAILED'?'PAYMENT_FAILED':'PAYMENT_CANCELLED'}}),
  prisma.checkoutLock.deleteMany({where:{bookingId:payment.bookingId}}),
 ]);
}

router.post('/checkout',authenticate,requireActiveUser,async(req:AuthRequest,res,next)=>{
 try{
  const data=z.object({billboardId:z.string(),durationMinutes:z.number().int().min(30).max(MAX_MINUTES),companyName:z.string().min(2).max(80).optional(),description:z.string().max(500).optional(),advertisementId:z.string().optional()}).parse(req.body);
  if(data.durationMinutes%30!==0)return res.status(400).json({error:'Choose time in 30-minute steps'});
  const country=await detectCountry(req);const provider=country==='IN'?'CASHFREE':'DODO';
  const now=new Date();
  const prepared=await prisma.$transaction(async tx=>{
   await tx.checkoutLock.deleteMany({where:{expiresAt:{lte:now}}});const lockExpiresAt=new Date(now.getTime()+CHECKOUT_LOCK_MINUTES*60*1000);
   let billboard=await tx.billboard.findUnique({where:{id:data.billboardId}});
   if(!billboard){const wall=data.billboardId.startsWith('W');billboard=await tx.billboard.create({data:{id:data.billboardId,name:(wall?'Wallboard ':'Billboard ')+data.billboardId,type:wall?'Wall':'Premium Road',positionX:0,positionY:0,positionZ:0,location:'UrbanCity',isAvailable:true,isActive:true,minBid:wall?DEFAULT_SIDE_30:DEFAULT_MAIN_30}})}
   if(!billboard)throw Object.assign(new Error('Billboard not found'),{status:404});
   const taken=await tx.booking.findFirst({where:{billboardId:data.billboardId,status:'ACTIVE',endDate:{gt:now}}});if(taken)throw Object.assign(new Error('This advertising space is currently reserved or booked'),{status:409});
   const currentLock=await tx.checkoutLock.findUnique({where:{billboardId:data.billboardId}});if(currentLock&&currentLock.userId!==req.user!.id)throw Object.assign(new Error(CHECKOUT_LOCK_MESSAGE),{status:409});
   const amount=priceFor(billboard,data.durationMinutes);let booking:any;
   if(currentLock?.bookingId){const existing=await tx.booking.findFirst({where:{id:currentLock.bookingId,userId:req.user!.id,status:'PAYMENT_PENDING'},include:{payment:true}});if(existing){booking=await tx.booking.update({where:{id:existing.id},data:{startDate:now,endDate:lockExpiresAt,durationMinutes:data.durationMinutes,amount,companyName:data.companyName||req.user!.displayName||req.user!.username,description:data.description||null,advertisementId:data.advertisementId}});if(existing.payment)await tx.payment.delete({where:{id:existing.payment.id}})}}
   if(!booking)booking=await tx.booking.create({data:{userId:req.user!.id,billboardId:data.billboardId,startDate:now,endDate:lockExpiresAt,durationMinutes:data.durationMinutes,amount,companyName:data.companyName||req.user!.displayName||req.user!.username,description:data.description||null,advertisementId:data.advertisementId,status:'PAYMENT_PENDING'}});
   if(currentLock)await tx.checkoutLock.update({where:{id:currentLock.id},data:{userId:req.user!.id,bookingId:booking.id,expiresAt:lockExpiresAt}});else{try{await tx.checkoutLock.create({data:{billboardId:data.billboardId,userId:req.user!.id,bookingId:booking.id,expiresAt:lockExpiresAt}})}catch(error:any){if(error?.code==='P2002')throw Object.assign(new Error(CHECKOUT_LOCK_MESSAGE),{status:409});throw error}}
   const payment=await tx.payment.create({data:{bookingId:booking.id,userId:req.user!.id,provider,amount,currency:BASE_CURRENCY,status:'PENDING'}});return {booking,payment,amount,provider,country};
  });
  try{
   const frontend=process.env.FRONTEND_URL||'http://localhost:5173';
   if(prepared.provider==='CASHFREE'){
    const rate=await getUsdInrRate();const inrAmount=Math.round(prepared.amount*rate*100)/100;
    const environment=(process.env.CASHFREE_ENV||'sandbox').toLowerCase();const phone=environment==='production'?(process.env.CASHFREE_CUSTOMER_PHONE||''):(process.env.CASHFREE_TEST_CUSTOMER_PHONE||'9999999999');if(!phone)throw Object.assign(new Error('Set CASHFREE_CUSTOMER_PHONE before using Cashfree production checkout.'),{status:503});
    const orderId='UC_'+prepared.payment.id.replace(/-/g,'').slice(0,40);
    const response=await fetch(cashfreeBaseUrl()+'/orders',{method:'POST',headers:cashfreeHeaders(crypto.randomUUID()),body:JSON.stringify({order_id:orderId,order_amount:Number(inrAmount.toFixed(2)),order_currency:'INR',customer_details:{customer_id:req.user!.id,customer_name:req.user!.displayName||req.user!.username,customer_email:req.user!.email,customer_phone:phone},order_meta:{return_url:frontend+'/?payment=return&booking='+encodeURIComponent(prepared.booking.id)+'&order_id={order_id}',...(process.env.CASHFREE_NOTIFY_URL?{notify_url:process.env.CASHFREE_NOTIFY_URL}:{})},order_note:'UrbanCity advertising booking '+prepared.booking.id,order_tags:{booking_id:prepared.booking.id,payment_id:prepared.payment.id,base_amount_usd:prepared.amount.toFixed(2),fx_rate_usd_inr:rate.toFixed(8)}})});
    const order:any=await response.json().catch(()=>({}));if(!response.ok)throw normalizeProviderError(response.status,order);if(!order.payment_session_id||!order.order_id)throw Object.assign(new Error('Cashfree did not return a payment session.'),{status:502});
    await prisma.payment.update({where:{id:prepared.payment.id},data:{providerPaymentId:order.order_id,checkoutSessionId:order.payment_session_id,status:'CHECKOUT_CREATED',amount:inrAmount,currency:'INR'}});
    return res.status(201).json({bookingId:prepared.booking.id,paymentId:prepared.payment.id,orderId:order.order_id,paymentSessionId:order.payment_session_id,paymentProvider:'CASHFREE',amount:prepared.amount,currency:BASE_CURRENCY,chargedAmount:inrAmount,chargedCurrency:'INR',fxRate:rate,country:prepared.country,environment:environment==='production'?'production':'sandbox'});
   }
   const dodoProduct=process.env.DODO_PAYMENTS_PRODUCT_ID;if(!dodoProduct)throw Object.assign(new Error('Dodo Payments is not configured. Add DODO_PAYMENTS_PRODUCT_ID for the one-time Pay What You Want product.'),{status:503});
   const sessionResponse=await fetch(dodoBaseUrl()+'/checkouts',{method:'POST',headers:dodoHeaders(),body:JSON.stringify({product_cart:[{product_id:dodoProduct,quantity:1,amount:Math.round(prepared.amount*100)}],customer:{email:req.user!.email,name:req.user!.displayName||req.user!.username},billing_address:{country:prepared.country},return_url:frontend+'/?payment=return&booking='+encodeURIComponent(prepared.booking.id)+'&order_id={session_id}',cancel_url:frontend+'/?payment=return&booking='+encodeURIComponent(prepared.booking.id)+'&order_id={session_id}',metadata:{booking_id:prepared.booking.id,payment_id:prepared.payment.id}})});
   const session:any=await sessionResponse.json().catch(()=>({}));if(!sessionResponse.ok)throw normalizeProviderError(sessionResponse.status,session);if(!session.session_id||!session.checkout_url)throw Object.assign(new Error('Dodo did not return a checkout URL.'),{status:502});
   await prisma.payment.update({where:{id:prepared.payment.id},data:{providerPaymentId:session.session_id,checkoutSessionId:session.session_id,status:'CHECKOUT_CREATED',amount:prepared.amount,currency:BASE_CURRENCY}});
   return res.status(201).json({bookingId:prepared.booking.id,paymentId:prepared.payment.id,orderId:session.session_id,paymentSessionId:'DODO_URL:'+Buffer.from(session.checkout_url).toString('base64url'),checkoutUrl:session.checkout_url,paymentProvider:'DODO',amount:prepared.amount,currency:BASE_CURRENCY,country:prepared.country,environment:process.env.DODO_PAYMENTS_ENVIRONMENT||'live_mode'});
  }catch(error){await failPayment(prepared.payment.id,'FAILED');throw error}
 }catch(e){next(e)}
});

router.get('/:bookingId/verify',authenticate,async(req:AuthRequest,res,next)=>{
 try{
  const orderId=String(req.query.order_id||'');const payment=await prisma.payment.findFirst({where:{bookingId:req.params.bookingId,userId:req.user!.id},include:{booking:true}});if(!payment)return res.status(404).json({error:'Payment not found'});
  if(payment.provider==='CASHFREE'){
   if(!orderId||orderId!==payment.providerPaymentId)return res.status(400).json({error:'Payment order does not match this booking'});
   const response=await fetch(cashfreeBaseUrl()+'/orders/'+encodeURIComponent(orderId),{headers:cashfreeHeaders()});const order:any=await response.json().catch(()=>({}));if(!response.ok)throw normalizeProviderError(response.status,order);
   const amountMatches=Math.abs(Number(order.order_amount)-Number(payment.amount))<0.011;const currencyMatches=order.order_currency==='INR';
   if(order.order_status==='PAID'&&amountMatches&&currencyMatches){await activatePayment(payment.id,orderId,undefined,Number(payment.amount),'INR');return res.json({paid:true,paymentStatus:'SUCCEEDED',bookingStatus:'ACTIVE',amount:Number(payment.booking.amount),currency:BASE_CURRENCY,chargedAmount:Number(payment.amount),chargedCurrency:'INR'});}
   if(['EXPIRED','TERMINATED'].includes(order.order_status))await failPayment(payment.id,'CANCELLED');
   return res.json({paid:false,paymentStatus:payment.status,bookingStatus:payment.booking.status,providerStatus:order.order_status||'UNKNOWN',amount:Number(payment.booking.amount),currency:BASE_CURRENCY,chargedAmount:Number(payment.amount),chargedCurrency:'INR'});
  }
  if(payment.provider==='DODO'){
   if(!orderId||orderId!==payment.checkoutSessionId)return res.status(400).json({error:'Dodo checkout session does not match this booking'});
   const response=await fetch(dodoBaseUrl()+'/checkouts/'+encodeURIComponent(orderId),{headers:dodoHeaders()});const session:any=await response.json().catch(()=>({}));if(!response.ok)throw normalizeProviderError(response.status,session);
   if(session.payment_status==='succeeded'){
    let chargedAmount=Number(payment.amount),chargedCurrency=payment.currency;let providerPaymentId=payment.providerPaymentId;
    if(session.payment_id){providerPaymentId=session.payment_id;const pr=await fetch(dodoBaseUrl()+'/payments/'+encodeURIComponent(session.payment_id),{headers:dodoHeaders()});const pd:any=await pr.json().catch(()=>({}));if(pr.ok){chargedAmount=Number(pd.total_amount||pd.amount||chargedAmount)/100;chargedCurrency=String(pd.currency||chargedCurrency)}}
    await activatePayment(payment.id,providerPaymentId,undefined,chargedAmount,chargedCurrency);return res.json({paid:true,paymentStatus:'SUCCEEDED',bookingStatus:'ACTIVE',amount:Number(payment.booking.amount),currency:BASE_CURRENCY,chargedAmount,chargedCurrency});
   }
   if(['failed','cancelled'].includes(String(session.payment_status||'')))await failPayment(payment.id,session.payment_status==='failed'?'FAILED':'CANCELLED');
   return res.json({paid:false,paymentStatus:payment.status,bookingStatus:payment.booking.status,providerStatus:session.payment_status||'UNKNOWN',amount:Number(payment.booking.amount),currency:BASE_CURRENCY,chargedAmount:Number(payment.amount),chargedCurrency:payment.currency});
  }
  return res.status(400).json({error:'Unknown payment provider'});
 }catch(e){next(e)}
});

router.get('/:bookingId/status',authenticate,async(req:AuthRequest,res,next)=>{try{const payment=await prisma.payment.findFirst({where:{bookingId:req.params.bookingId,userId:req.user!.id},include:{booking:true}});if(!payment)return res.status(404).json({error:'Payment not found'});res.json({payment:{id:payment.id,status:payment.status,amount:Number(payment.booking.amount),currency:BASE_CURRENCY,provider:payment.provider,chargedAmount:Number(payment.amount),chargedCurrency:payment.currency},booking:{id:payment.booking.id,status:payment.booking.status}})}catch(e){next(e)}});

router.post('/webhook/cashfree',async(req,res)=>{
 try{const raw=(req as any).rawBody;const signature=String(req.headers['x-webhook-signature']||'');const timestamp=String(req.headers['x-webhook-timestamp']||'');if(!raw||!signature||!timestamp)return res.status(400).json({error:'Missing webhook signature'});const ts=Number(timestamp);if(!Number.isFinite(ts)||Math.abs(Date.now()-ts)>5*60*1000)return res.status(400).json({error:'Expired webhook timestamp'});const secret=process.env.CASHFREE_CLIENT_SECRET;if(!secret)return res.status(503).json({error:'Cashfree is not configured'});const expected=crypto.createHmac('sha256',secret).update(timestamp+raw).digest('base64');const a=Buffer.from(expected),b=Buffer.from(signature);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Invalid webhook signature'});
  const event:any=JSON.parse(raw);const orderId=event?.data?.order?.order_id;const cfPaymentId=event?.data?.payment?.cf_payment_id?String(event.data.payment.cf_payment_id):undefined;const paymentStatus=event?.data?.payment?.payment_status;const amount=Number(event?.data?.order?.order_amount);const currency=event?.data?.order?.order_currency;if(!orderId)return res.status(200).json({received:true});const payment=await prisma.payment.findFirst({where:{provider:'CASHFREE',providerPaymentId:orderId},include:{booking:true}});if(!payment)return res.status(200).json({received:true});if(Math.abs(amount-Number(payment.amount))>=0.011||currency!=='INR')return res.status(400).json({error:'Webhook amount/currency mismatch'});const eventId=String(req.headers['x-idempotency-key']||cfPaymentId||'');if(paymentStatus==='SUCCESS'||event?.type==='PAYMENT_SUCCESS_WEBHOOK')await activatePayment(payment.id,orderId,eventId||undefined,amount,'INR');else if(paymentStatus==='FAILED'||event?.type==='PAYMENT_FAILED_WEBHOOK')await failPayment(payment.id,'FAILED');else if(paymentStatus==='USER_DROPPED'||event?.type==='PAYMENT_USER_DROPPED_WEBHOOK')await failPayment(payment.id,'CANCELLED');return res.status(200).json({received:true});
 }catch(error){console.error('Cashfree webhook processing failed',error);return res.status(500).json({error:'Webhook processing failed'})}
});

router.post('/webhook/dodo',async(req,res)=>{
 try{
  const secret=process.env.DODO_PAYMENTS_WEBHOOK_KEY;if(!secret)return res.status(503).json({error:'Dodo webhook secret is not configured'});
  const webhook=new Webhook(secret);const raw=(req as any).rawBody||JSON.stringify(req.body);const headers={'webhook-id':String(req.headers['webhook-id']||''),'webhook-signature':String(req.headers['webhook-signature']||''),'webhook-timestamp':String(req.headers['webhook-timestamp']||'')};await webhook.verify(raw,headers);
  const event:any=JSON.parse(raw);const eventId=headers['webhook-id'];const data=event?.data||{};const metadata=data?.metadata||{};const bookingId=String(metadata.booking_id||'');const paymentId=String(metadata.payment_id||'');if(!bookingId&&!paymentId)return res.status(200).json({received:true});
  const payment=paymentId?await prisma.payment.findUnique({where:{id:paymentId},include:{booking:true}}):await prisma.payment.findFirst({where:{provider:'DODO',providerPaymentId:String(data.payment_id||'')},include:{booking:true}});if(!payment)return res.status(200).json({received:true});
  if(payment.providerEventId===eventId)return res.status(200).json({received:true});
  if(event.type==='payment.succeeded'){
   const chargedAmount=Number(data.total_amount||data.amount||payment.amount)/100;const chargedCurrency=String(data.currency||payment.currency||BASE_CURRENCY);await activatePayment(payment.id,String(data.payment_id||payment.providerPaymentId||''),eventId,chargedAmount,chargedCurrency);
  }else if(event.type==='payment.failed')await failPayment(payment.id,'FAILED');else if(event.type==='payment.cancelled')await failPayment(payment.id,'CANCELLED');
  return res.status(200).json({received:true});
 }catch(error){console.error('Dodo webhook processing failed',error);return res.status(400).json({error:'Invalid Dodo webhook'})}
});

export {router as paymentRouter};