import { Router } from 'express';
import { prisma } from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Dashboard stats
router.get('/stats', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const [
      totalUsers,
      totalBillboards,
      activeBookings,
      totalRevenue,
      totalAuctions,
      totalBids,
      totalAds,
      totalTransactions,
      activeAuctions,
      pendingAds,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.billboard.count(),
      prisma.booking.count({where:{status:'ACTIVE',endDate:{gt:new Date()}}}),
      prisma.booking.aggregate({where:{status:{in:['ACTIVE','EXPIRED']}},_sum:{amount:true}}),
      prisma.auction.count(),
      prisma.bid.count(),
      prisma.advertisement.count(),
      prisma.transaction.count(),
      prisma.auction.count({ where: { status: 'ACTIVE' } }),
      prisma.advertisement.count({ where: { status: 'PENDING' } }),
    ]);

    res.json({
      totalUsers,
      totalBillboards,
      activeBookings,
      revenue:Number(totalRevenue._sum.amount||0),
      totalAuctions,
      totalBids,
      totalAds,
      totalTransactions,
      activeAuctions,
      pendingAds,
    });
  } catch (error) {
    next(error);
  }
});

// Get all users
router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { search, role } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { displayName: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      include: {
        wallet: true,
        _count: {
          select: { bids: true, advertisements: true, campaigns: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Update a user's active status. Admins cannot deactivate themselves.
router.patch('/users/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
 try {
  const isActive=Boolean(req.body?.isActive);
  if(req.params.id===req.user!.id)return res.status(400).json({error:'You cannot deactivate your own admin account.'});
  const user=await prisma.user.update({where:{id:req.params.id},data:{isActive}});
  res.json({id:user.id,isActive:user.isActive});
 }catch(error){next(error)}
});

// Update user role
router.patch('/users/:id/role', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { role } = req.body;
    if(!['USER','ADMIN'].includes(role)) return res.status(400).json({error:'Invalid role'});
    if(req.params.id===req.user!.id && role!=='ADMIN') return res.status(400).json({error:'You cannot remove your own admin role.'});

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// All bookings for operations management
router.get('/bookings', authenticate, requireAdmin, async (_req,res,next)=>{
 try{
  const rows=await prisma.booking.findMany({include:{user:{select:{email:true,username:true,displayName:true}},billboard:{select:{name:true,type:true}},advertisement:true},orderBy:{createdAt:'desc'},take:250});
  res.json(rows);
 }catch(error){next(error)}
});

router.patch('/bookings/:id/cancel', authenticate, requireAdmin, async (_req,res,next)=>{
 try{
  const booking=await prisma.booking.update({where:{id:_req.params.id},data:{status:'CANCELLED'}});
  res.json(booking);
 }catch(error){next(error)}
});

// Get all transactions
router.get('/transactions', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        user: { select: { username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

// Get all advertisements for moderation
router.get('/advertisements', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const ads = await prisma.advertisement.findMany({
      where,
      include: {
        user: { select: { username: true, displayName: true } },
        campaigns: { include: { billboard: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(ads);
  } catch (error) {
    next(error);
  }
});

router.patch('/advertisements/:id/status', authenticate, requireAdmin, async (req,res,next)=>{
 try{
  const status=String(req.body?.status||'');
  if(!['PENDING','APPROVED','REJECTED','DISABLED'].includes(status))return res.status(400).json({error:'Invalid advertisement status'});

  const result=await prisma.$transaction(async tx=>{
   const ad=await tx.advertisement.update({where:{id:req.params.id},data:{status}});
   // A non-approved creative must never remain active in a campaign.
   if(status!=='APPROVED'){
    await tx.advertisingCampaign.updateMany({where:{advertisementId:ad.id,isActive:true},data:{isActive:false}});
   }
   return ad;
  });
  res.json(result);
 }catch(error){next(error)}
});

router.get('/billboards', authenticate, requireAdmin, async (_req,res,next)=>{
 try{res.json(await prisma.billboard.findMany({include:{bookings:{where:{status:'ACTIVE',endDate:{gt:new Date()}},take:1,include:{user:{select:{displayName:true,username:true}}}},_count:{select:{bookings:true,trafficAnalytics:true}}},orderBy:{createdAt:'desc'},take:300}));}catch(error){next(error)}
});

// Get active visitors (from WebSocket connections - simulated via analytics)
router.get('/active-visitors', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    // This would integrate with the WebSocket server in production
    // For now, return recent traffic analytics
    const recentTraffic = await prisma.trafficAnalytics.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    res.json({
      recentTraffic,
      totalRecentVisitors: recentTraffic.reduce((sum, t) => sum + t.nearbyVisitors, 0),
    });
  } catch (error) {
    next(error);
  }
});

export { router as adminRouter };
