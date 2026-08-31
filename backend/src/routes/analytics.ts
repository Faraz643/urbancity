import { Router } from 'express';
import { prisma } from '../db';

const router = Router();

// Get billboard traffic analytics
router.get('/billboard/:id', async (req, res, next) => {
  try {
    const { period } = req.query; // 'hour', 'day', 'week'

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'day':
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
    }

    const analytics = await prisma.trafficAnalytics.findMany({
      where: {
        billboardId: req.params.id,
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    const stats = {
      totalReadings: analytics.length,
      averageNearby: analytics.length > 0
        ? Math.round(analytics.reduce((sum, a) => sum + a.nearbyVisitors, 0) / analytics.length)
        : 0,
      peakNearby: analytics.length > 0
        ? Math.max(...analytics.map(a => a.nearbyVisitors))
        : 0,
      currentNearby: analytics.length > 0
        ? analytics[analytics.length - 1].nearbyVisitors
        : 0,
      hourlyData: analytics,
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Record traffic (called by WebSocket server)
router.post('/traffic', async (req, res, next) => {
  try {
    const { billboardId, nearbyVisitors } = req.body;

    const record = await prisma.trafficAnalytics.create({
      data: {
        billboardId,
        nearbyVisitors,
      },
    });

    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

export { router as analyticsRouter };
