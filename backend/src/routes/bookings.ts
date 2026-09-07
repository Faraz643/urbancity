import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireActiveUser, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router=Router();

// Personal booking history is private. Public leaderboard data is exposed separately below.
router.get('/history',authenticate,async(req:AuthRequest,res,next)=>{
 try{
  const rows=await prisma.booking.findMany({
   where:{userId:req.user!.id},
   orderBy:{createdAt:'desc'},
   take:100,
   include:{billboard:{select:{id:true,name:true,type:true}},advertisement:true}
  });
  res.json(rows);
 }catch(e){next(e)}
});

router.get('/leaderboard', async (_req,res,next)=>{
 try{
  const rows=await prisma.booking.findMany({
   select:{companyName:true,amount:true,durationMinutes:true,user:{select:{username:true,displayName:true,avatar:true,websiteUrl:true,companyDescription:true}},advertisement:{select:{targetUrl:true,description:true}}}
  });
  const grouped=new Map<string,{name:string;username:string;logo:string|null;siteUrl:string|null;description:string|null;totalPayment:number;totalMinutes:number}>();
  for(const row of rows){
   const key=row.companyName+'::'+row.user.username;
   const current=grouped.get(key)||{name:row.companyName,username:row.user.username,logo:row.user.avatar,siteUrl:row.advertisement?.targetUrl||row.user.websiteUrl||null,description:row.advertisement?.description||row.user.companyDescription||null,totalPayment:0,totalMinutes:0};
   current.totalPayment+=Number(row.amount);
   current.totalMinutes+=row.durationMinutes;
   if(row.advertisement?.targetUrl) current.siteUrl=row.advertisement.targetUrl;
   else if(!current.siteUrl&&row.user.websiteUrl) current.siteUrl=row.user.websiteUrl;
   if(row.advertisement?.description) current.description=row.advertisement.description;
   else if(!current.description&&row.user.companyDescription) current.description=row.user.companyDescription;
   grouped.set(key,current);
  }
  const leaderboard=[...grouped.values()]
   .sort((a,b)=>b.totalPayment-a.totalPayment||b.totalMinutes-a.totalMinutes)
   .map((entry,index)=>({...entry,rank:index+1,siteUrl:entry.siteUrl}));
  res.json(leaderboard);
 }catch(e){next(e)}
});

async function clickCountMap(bookingIds:string[]) {
 const map=new Map<string,number>();
 if(!bookingIds.length)return map;
 const rows:Array<{booking_id:string;count:number}>=await prisma.$queryRawUnsafe(
  `SELECT "booking_id", COUNT(*)::int AS count FROM "ad_clicks" WHERE "booking_id" = ANY($1::text[]) GROUP BY "booking_id"`,bookingIds
 );
 for(const row of rows)map.set(row.booking_id,Number(row.count||0));
 return map;
}

router.get('/active',async(_req,res,next)=>{
 try{
  const now=new Date();
  const rows=await prisma.booking.findMany({where:{status:'ACTIVE',endDate:{gt:now}},orderBy:{endDate:'desc'},include:{user:{select:{username:true,displayName:true,websiteUrl:true}},advertisement:true}});
  const active:Record<string,any>={};
  const selectedRows=rows.filter(row=>!active[row.billboardId]);
  const counts=await clickCountMap(selectedRows.map(row=>row.id));
  for(const row of selectedRows){
   const targetUrl=row.advertisement?.status==='DISABLED'?row.user.websiteUrl:row.advertisement?.targetUrl||row.user.websiteUrl;
   active[row.billboardId]={...row,siteUrl:row.user.websiteUrl,imageUrl:row.advertisement?.status==='DISABLED'?null:row.advertisement?.imageUrl||null,description:row.advertisement?.status==='DISABLED'?row.description||null:row.advertisement?.description||row.description||null,targetUrl,clickUrl:`/api/advertisements/click/${encodeURIComponent(row.id)}`,totalClicks:counts.get(row.id)||0};
  }
  res.json(active);
 }catch(e){next(e)}
});

router.get('/billboard/:billboardId',async(req,res,next)=>{
 try{
  const now=new Date();
  const active=await prisma.booking.findFirst({where:{billboardId:req.params.billboardId,status:'ACTIVE',endDate:{gt:now}},orderBy:{endDate:'desc'},include:{user:{select:{username:true,displayName:true,websiteUrl:true}},advertisement:true}});
  if(!active)return res.json({active:null});
  const counts=await clickCountMap([active.id]);
  const targetUrl=active.advertisement?.status==='DISABLED'?active.user.websiteUrl:active.advertisement?.targetUrl||active.user.websiteUrl;
  res.json({active:{...active,user:active.user,siteUrl:active.user.websiteUrl,imageUrl:active.advertisement?.status==='DISABLED'?null:active.advertisement?.imageUrl||null,description:active.advertisement?.status==='DISABLED'?active.description||null:active.advertisement?.description||active.description||null,targetUrl,clickUrl:`/api/advertisements/click/${encodeURIComponent(active.id)}`,totalClicks:counts.get(active.id)||0}});
 }catch(e){next(e)}
});

// Update an active booking creative. Ownership is checked server-side from the authenticated user.
router.patch('/:billboardId/creative',authenticate,requireActiveUser,async(req:AuthRequest,res,next)=>{
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
   advertisementId=null;
  }else if(booking.advertisementId){
   await prisma.advertisement.update({
    where:{id:booking.advertisementId},
    data:{
     title:data.companyName||booking.companyName,
     description:cleanDescription===undefined?booking.advertisement?.description||'':cleanDescription,
     targetUrl:cleanUrl===undefined?booking.advertisement?.targetUrl||undefined:cleanUrl||undefined,
     ...(data.imageUrl?{imageUrl:data.imageUrl}:{}),
    }
   });
  }else if(data.imageUrl){
   const ad=await prisma.advertisement.create({data:{userId:req.user!.id,title:data.companyName||booking.companyName,description:cleanDescription||'',imageUrl:data.imageUrl,targetUrl:cleanUrl||undefined,status:'APPROVED'}});
   advertisementId=ad.id;
  }

  const updated=await prisma.booking.update({
   where:{id:booking.id},
   data:{companyName:data.companyName||booking.companyName,description:cleanDescription===undefined?booking.description:cleanDescription,advertisementId},
   include:{advertisement:true,user:{select:{username:true,displayName:true,websiteUrl:true}}}
  });
  const counts=await clickCountMap([updated.id]);
  res.json({...updated,siteUrl:updated.advertisement?.targetUrl||cleanUrl||updated.user.websiteUrl,imageUrl:updated.advertisement?.imageUrl||null,description:updated.advertisement?.description||updated.description||null,targetUrl:updated.advertisement?.targetUrl||cleanUrl||updated.user.websiteUrl,clickUrl:`/api/advertisements/click/${encodeURIComponent(updated.id)}`,totalClicks:counts.get(updated.id)||0});
 }catch(e){next(e)}
});

export {router as bookingRouter};
