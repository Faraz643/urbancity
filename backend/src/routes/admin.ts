import { Router } from 'express';
import { prisma } from '../server';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Dashboard stats
router.get('/stats', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const [
      totalUsers,
      totalBillboards,
      totalAuctions,
      totalBids,
      totalAds,
      totalTransactions,
      activeAuctions,
      pendingAds,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.billboard.count(),
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

// Update user role
router.patch('/users/:id/role', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const { role } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
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
