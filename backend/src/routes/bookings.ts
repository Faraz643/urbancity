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

router.get('/active',async(_req,res,next)=>{
 try{
  const now=new Date();
  const rows=await prisma.booking.findMany({where:{status:'ACTIVE',endDate:{gt:now}},orderBy:{endDate:'desc'},include:{user:{select:{username:true,displayName:true,websiteUrl:true}},advertisement:true}});
  const active:Record<string,any>={};
  for(const row of rows){if(!active[row.billboardId]) active[row.billboardId]={...row,siteUrl:row.user.websiteUrl,imageUrl:row.advertisement?.imageUrl||null,description:row.advertisement?.description||row.description||null,targetUrl:row.advertisement?.targetUrl||row.user.websiteUrl};}
  res.json(active);
 }catch(e){next(e)}
});

router.get('/billboard/:billboardId',async(req,res,next)=>{
 try{
  const now=new Date();
  const active=await prisma.booking.findFirst({where:{billboardId:req.params.billboardId,status:'ACTIVE',endDate:{gt:now}},orderBy:{endDate:'desc'},include:{user:{select:{username:true,displayName:true,websiteUrl:true}},advertisement:true}});
  res.json({active:active?{...active,user:active.user,siteUrl:active.user.websiteUrl,imageUrl:active.advertisement?.imageUrl||null,description:active.advertisement?.description||active.description||null,targetUrl:active.advertisement?.targetUrl||active.user.websiteUrl}:null});
 }catch(e){next(e)}
});


// Update an active booking creative. Ownership is checked server-side from the authenticated user.
router.patch('/:billboardId/creative',authenticate,async(req:AuthRequest,res,next)=>{
 try{
  const data=z.object({
   companyName:z.string().min(2).max(80).optional(),
   description:z.string().max(500).optional(),
   targetUrl:z.string().url().or(z.literal('')).optional(),
   imageUrl:z.string().url().nullable().optional(),
  }).parse(req.body);
  const booking=await prisma.booking.findFirst({
   where:{billboardId:req.params.billboardId,userId:req.user!.id,status:'ACTIVE',endDate:{gt:new Date()}},
   orderBy:{endDate:'desc'},include:{advertisement:true,user:{select:{username:true,displayName:true,websiteUrl:true}}}
  });
  if(!booking)return res.status(403).json({error:'You can only edit your own active booking.'});
  const cleanDescription=data.description?.trim();
  const cleanUrl=data.targetUrl===undefined?undefined:(data.targetUrl.trim()||null);
  const removeImage=data.imageUrl===null;
  let advertisementId=booking.advertisementId;
  if(removeImage){
   if(booking.advertisementId) await prisma.advertisement.update({where:{id:booking.advertisementId},data:{imageUrl:null as any}});
   advertisementId=null;
  }else if(data.imageUrl){
   if(booking.advertisementId) await prisma.advertisement.update({where:{id:booking.advertisementId},data:{title:data.companyName||booking.companyName,description:cleanDescription,targetUrl:cleanUrl||undefined,imageUrl:data.imageUrl}});
   else {
    const ad=await prisma.advertisement.create({data:{userId:req.user!.id,title:data.companyName||booking.companyName,description:cleanDescription||'',imageUrl:data.imageUrl,targetUrl:cleanUrl||undefined,status:'APPROVED'}});
    advertisementId=ad.id;
   }
  }
  const updated=await prisma.booking.update({
   where:{id:booking.id},
   data:{companyName:data.companyName||booking.companyName,description:cleanDescription===undefined?booking.description:cleanDescription,advertisementId},
   include:{advertisement:true,user:{select:{username:true,displayName:true,websiteUrl:true}}}
  });
  res.json({...updated,siteUrl:updated.advertisement?.targetUrl||cleanUrl||updated.user.websiteUrl,imageUrl:updated.advertisement?.imageUrl||null,description:updated.advertisement?.description||updated.description||null,targetUrl:updated.advertisement?.targetUrl||cleanUrl||updated.user.websiteUrl});
 }catch(e){next(e)}
});

router.post('/',authenticate,async(req:AuthRequest,res,next)=>{
 try{
  const data=z.object({billboardId:z.string(),durationMinutes:z.number().int().min(30).max(MAX_MINUTES),companyName:z.string().min(2).max(80).optional(),advertisementId:z.string().optional(),description:z.string().max(500).optional()}).parse(req.body);
  if(data.durationMinutes%30!==0)return res.status(400).json({error:'Choose time in 30-minute steps'});
  const result=await prisma.$transaction(async tx=>{
   let billboard=await tx.billboard.findUnique({where:{id:data.billboardId}});
   // World billboard IDs are stable client IDs. Create the database record on first booking after a fresh reset.
   if(!billboard){const wall=data.billboardId.startsWith('W');billboard=await tx.billboard.create({data:{id:data.billboardId,name:(wall?'Wallboard ':'Billboard ')+data.billboardId,type:wall?'Wall':'Premium Road',positionX:0,positionY:0,positionZ:0,location:'UrbanCity',isAvailable:true,isActive:true,minBid:0}});}
   if(!billboard)throw Object.assign(new Error('Billboard not found'),{status:404});
   const now=new Date();
   const active=await tx.booking.findFirst({where:{billboardId:data.billboardId,status:'ACTIVE',endDate:{gt:now}}});
   if(active)throw Object.assign(new Error('This advertising space is currently booked'),{status:409});
   const amount=priceFor(billboard.type,data.durationMinutes);
   const wallet=await tx.wallet.findUnique({where:{userId:req.user!.id}});
   if(!wallet||Number(wallet.balance)<amount)throw Object.assign(new Error('Insufficient wallet balance'),{status:400});
   const endDate=new Date(now.getTime()+data.durationMinutes*60*1000);
   const booking=await tx.booking.create({data:{userId:req.user!.id,billboardId:data.billboardId,startDate:now,endDate,durationMinutes:data.durationMinutes,amount,companyName:data.companyName||req.user!.displayName||req.user!.username,description:data.description||null,advertisementId:data.advertisementId},include:{user:{select:{username:true,displayName:true,websiteUrl:true,avatar:true}},advertisement:true}});
   await tx.wallet.update({where:{id:wallet.id},data:{balance:{decrement:amount}}});
   await tx.transaction.create({data:{walletId:wallet.id,userId:req.user!.id,type:'AD_SPACE_PURCHASE',amount,description:'Fixed-price advertising booking',referenceId:booking.id}});
   await tx.billboard.update({where:{id:data.billboardId},data:{isAvailable:false,currentBid:amount,currentBidderId:req.user!.id}});
   return {booking,balance:Number(wallet.balance)-amount};
  });
  res.status(201).json(result);
 }catch(e){next(e)}
});

export {router as bookingRouter};