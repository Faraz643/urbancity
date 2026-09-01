import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router=Router();
const MAX_MINUTES=48*60;

function priceFor(type:string, minutes:number){
  const main=type==='Premium Road';
  if(minutes<=0||minutes%30!==0||minutes>MAX_MINUTES) throw new Error('Duration must be in 30-minute steps, maximum 2 days');
  // Fixed USD pricing. 24h automatically receives the one-day package price.
  if(!main) return (minutes/30)*1.05;
  if(minutes===24*60) return 8.40;
  if(minutes>24*60) return 8.40+((minutes-24*60)/30)*0.19;
  return (minutes/30)*0.21;
}

router.get('/history', async (_req,res,next)=>{
 try{
  const rows=await prisma.booking.findMany({orderBy:{createdAt:'desc'},take:100,include:{user:{select:{username:true,displayName:true}},billboard:{select:{id:true,name:true,type:true}}}});
  res.json(rows);
 }catch(e){next(e)}
});


router.get('/leaderboard', async (_req,res,next)=>{
 try{
  const rows=await prisma.booking.findMany({
   select:{companyName:true,amount:true,durationMinutes:true,user:{select:{username:true,displayName:true,avatar:true,websiteUrl:true}}}
  });
  const grouped=new Map<string,{name:string;username:string;logo:string|null;siteUrl:string|null;totalPayment:number;totalMinutes:number}>();
  for(const row of rows){
   const key=row.companyName+'::'+row.user.username;
   const current=grouped.get(key)||{name:row.companyName,username:row.user.username,logo:row.user.avatar,siteUrl:row.user.websiteUrl,totalPayment:0,totalMinutes:0};
   current.totalPayment+=Number(row.amount);
   current.totalMinutes+=row.durationMinutes;
   grouped.set(key,current);
  }
  const leaderboard=[...grouped.values()]
   .sort((a,b)=>b.totalPayment-a.totalPayment||b.totalMinutes-a.totalMinutes)
   .map((entry,index)=>({...entry,rank:index+1,siteUrl:entry.siteUrl}));
  res.json(leaderboard);
 }catch(e){next(e)}
});

router.get('/billboard/:billboardId',async(req,res,next)=>{
 try{
  const now=new Date();
  const active=await prisma.booking.findFirst({where:{billboardId:req.params.billboardId,status:'ACTIVE',endDate:{gt:now}},orderBy:{endDate:'desc'},include:{user:{select:{username:true,displayName:true,websiteUrl:true}}}});
  res.json({active:active?{...active,user:active.user,siteUrl:active.user.websiteUrl}:null});
 }catch(e){next(e)}
});

router.post('/',authenticate,async(req:AuthRequest,res,next)=>{
 try{
  const data=z.object({billboardId:z.string(),durationMinutes:z.number().int().min(30).max(MAX_MINUTES),companyName:z.string().min(2).max(80).optional()}).parse(req.body);
  if(data.durationMinutes%30!==0)return res.status(400).json({error:'Choose time in 30-minute steps'});
  const result=await prisma.$transaction(async tx=>{
   const billboard=await tx.billboard.findUnique({where:{id:data.billboardId}});
   if(!billboard)throw Object.assign(new Error('Billboard not found'),{status:404});
   const now=new Date();
   const active=await tx.booking.findFirst({where:{billboardId:data.billboardId,status:'ACTIVE',endDate:{gt:now}}});
   if(active)throw Object.assign(new Error('This advertising space is currently booked'),{status:409});
   const amount=priceFor(billboard.type,data.durationMinutes);
   const wallet=await tx.wallet.findUnique({where:{userId:req.user!.id}});
   if(!wallet||Number(wallet.balance)<amount)throw Object.assign(new Error('Insufficient wallet balance'),{status:400});
   const endDate=new Date(now.getTime()+data.durationMinutes*60*1000);
   const booking=await tx.booking.create({data:{userId:req.user!.id,billboardId:data.billboardId,startDate:now,endDate,durationMinutes:data.durationMinutes,amount,companyName:data.companyName||req.user!.displayName||req.user!.username},include:{user:{select:{username:true,displayName:true,websiteUrl:true,avatar:true}}}});
   await tx.wallet.update({where:{id:wallet.id},data:{balance:{decrement:amount}}});
   await tx.transaction.create({data:{walletId:wallet.id,userId:req.user!.id,type:'AD_SPACE_PURCHASE',amount,description:'Fixed-price advertising booking',referenceId:booking.id}});
   await tx.billboard.update({where:{id:data.billboardId},data:{isAvailable:false,currentBid:amount,currentBidderId:req.user!.id}});
   return {booking,balance:Number(wallet.balance)-amount};
  });
  res.status(201).json(result);
 }catch(e){next(e)}
});

export {router as bookingRouter};