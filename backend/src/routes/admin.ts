import { Router } from 'express';
import { prisma } from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const [totalUsers,totalBillboards,activeBookings,paidBookings,totalAuctions,totalBids,totalAds,totalTransactions,activeAuctions,pendingAds,totalSiteVisits,uniqueVisitorRows] = await Promise.all([
      prisma.user.count(),prisma.billboard.count(),prisma.booking.count({where:{status:'ACTIVE',endDate:{gt:new Date()}}}),
      prisma.booking.findMany({where:{payment:{status:'SUCCEEDED'}},select:{amount:true}}),prisma.auction.count(),prisma.bid.count(),prisma.advertisement.count(),prisma.transaction.count(),prisma.auction.count({where:{status:'ACTIVE'}}),prisma.advertisement.count({where:{status:'PENDING'}}),prisma.siteVisit.count(),prisma.$queryRaw<Array<{count:bigint}>>`SELECT COUNT(DISTINCT visitor_id) AS count FROM public.site_visits`,
    ]);
    res.json({totalUsers,totalBillboards,activeBookings,revenue:paidBookings.reduce((sum,b)=>sum+Number(b.amount||0),0),totalAuctions,totalBids,totalAds,totalTransactions,activeAuctions,pendingAds,totalSiteVisits,uniqueVisitors:Number(uniqueVisitorRows[0]?.count||0)});
  } catch (error) { next(error); }
});

router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try { const {search,role}=req.query;const where:any={};if(search)where.OR=[{username:{contains:search as string,mode:'insensitive'}},{email:{contains:search as string,mode:'insensitive'}},{displayName:{contains:search as string,mode:'insensitive'}}];if(role)where.role=role;const users=await prisma.user.findMany({where,include:{wallet:true,_count:{select:{bids:true,advertisements:true,campaigns:true}}},orderBy:{createdAt:'desc'},take:100});res.json(users); } catch(error){next(error)}
});

router.patch('/users/:id/status', authenticate, requireAdmin, async (req:AuthRequest,res,next)=>{try{const isActive=Boolean(req.body?.isActive);if(req.params.id===req.user!.id)return res.status(400).json({error:'You cannot deactivate your own admin account.'});const user=await prisma.user.update({where:{id:req.params.id},data:{isActive}});res.json({id:user.id,isActive:user.isActive})}catch(error){next(error)}});
router.patch('/users/:id/role', authenticate, requireAdmin, async (req:AuthRequest,res,next)=>{try{const {role}=req.body;if(!['USER','ADMIN'].includes(role))return res.status(400).json({error:'Invalid role'});if(req.params.id===req.user!.id&&role!=='ADMIN')return res.status(400).json({error:'You cannot remove your own admin role.'});const user=await prisma.user.update({where:{id:req.params.id},data:{role}});res.json(user)}catch(error){next(error)}});

router.get('/bookings', authenticate, requireAdmin, async (_req,res,next)=>{try{const rows=await prisma.booking.findMany({include:{user:{select:{email:true,username:true,displayName:true}},billboard:{select:{name:true,type:true}},advertisement:true},orderBy:{createdAt:'desc'},take:250});res.json(rows)}catch(error){next(error)}});
router.patch('/bookings/:id/cancel', authenticate, requireAdmin, async (req,res,next)=>{try{const result=await prisma.$transaction(async tx=>{const booking=await tx.booking.findUnique({where:{id:req.params.id}});if(!booking)throw Object.assign(new Error('Booking not found'),{status:404});if(['CANCELLED','EXPIRED'].includes(booking.status))return booking;const cancelled=await tx.booking.update({where:{id:booking.id},data:{status:'CANCELLED'}});if(booking.advertisementId)await tx.advertisingCampaign.updateMany({where:{advertisementId:booking.advertisementId,isActive:true},data:{isActive:false}});const now=new Date();const nextActive=await tx.booking.findFirst({where:{billboardId:booking.billboardId,status:'ACTIVE',endDate:{gt:now},id:{not:booking.id}}});if(!nextActive)await tx.billboard.update({where:{id:booking.billboardId},data:{isAvailable:true,currentBid:null,currentBidderId:null}});return cancelled});res.json(result)}catch(error){next(error)}});

router.get('/transactions', authenticate, requireAdmin, async (_req,res,next)=>{try{const transactions=await prisma.transaction.findMany({include:{user:{select:{username:true,displayName:true}}},orderBy:{createdAt:'desc'},take:200});res.json(transactions)}catch(error){next(error)}});
router.get('/advertisements', authenticate, requireAdmin, async (req,res,next)=>{try{const {status}=req.query;const where:any={};if(status)where.status=status;const ads=await prisma.advertisement.findMany({where,include:{user:{select:{username:true,displayName:true}},campaigns:{include:{billboard:true}}},orderBy:{createdAt:'desc'}});res.json(ads)}catch(error){next(error)}});
router.patch('/advertisements/:id/status', authenticate, requireAdmin, async (req,res,next)=>{try{const status=String(req.body?.status||'');if(!['PENDING','APPROVED','REJECTED','DISABLED'].includes(status))return res.status(400).json({error:'Invalid advertisement status'});const result=await prisma.$transaction(async tx=>{const ad=await tx.advertisement.update({where:{id:req.params.id},data:{status}});if(status!=='APPROVED')await tx.advertisingCampaign.updateMany({where:{advertisementId:ad.id,isActive:true},data:{isActive:false}});return ad});res.json(result)}catch(error){next(error)}});
router.get('/billboards', authenticate, requireAdmin, async (_req,res,next)=>{try{res.json(await prisma.billboard.findMany({include:{bookings:{where:{status:'ACTIVE',endDate:{gt:new Date()}},take:1,include:{user:{select:{displayName:true,username:true}}}},_count:{select:{bookings:true,trafficAnalytics:true}}},orderBy:{createdAt:'desc'},take:300}))}catch(error){next(error)}});
router.get('/active-visitors', authenticate, requireAdmin, async (_req,res,next)=>{try{const recentTraffic=await prisma.trafficAnalytics.findMany({where:{timestamp:{gte:new Date(Date.now()-5*60*1000)}},orderBy:{timestamp:'desc'},take:100});res.json({recentTraffic,totalRecentVisitors:recentTraffic.reduce((sum,t)=>sum+t.nearbyVisitors,0)})}catch(error){next(error)}});

export { router as adminRouter };
