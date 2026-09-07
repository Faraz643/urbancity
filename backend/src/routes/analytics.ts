import { Router } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../db';

const router = Router();

// Get billboard traffic analytics
router.get('/billboard/:id', async (req, res, next) => {
  try {
    const { period } = req.query;
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'hour': startDate = new Date(now.getTime() - 60 * 60 * 1000); break;
      case 'week': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'day':
      default: startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
    }
    const analytics = await prisma.trafficAnalytics.findMany({
      where: { billboardId: req.params.id, timestamp: { gte: startDate } },
      orderBy: { timestamp: 'asc' },
    });
    res.json({
      totalReadings: analytics.length,
      averageNearby: analytics.length > 0 ? Math.round(analytics.reduce((sum, a) => sum + a.nearbyVisitors, 0) / analytics.length) : 0,
      peakNearby: analytics.length > 0 ? Math.max(...analytics.map(a => a.nearbyVisitors)) : 0,
      currentNearby: analytics.length > 0 ? analytics[analytics.length - 1].nearbyVisitors : 0,
      hourlyData: analytics,
    });
  } catch (error) { next(error); }
});

router.post('/traffic', async (req, res, next) => {
  try {
    const { billboardId, nearbyVisitors } = req.body;
    const record = await prisma.trafficAnalytics.create({ data: { billboardId, nearbyVisitors } });
    res.status(201).json(record);
  } catch (error) { next(error); }
});

// Record one visit per browser session. The live site_visits table requires an explicit
// id, so generate it here rather than relying on a database default.
router.post('/site-visit', async (req,res,next)=>{
  try{
    const visitorId=typeof req.body?.visitorId==='string'?req.body.visitorId.trim():'';
    const sessionId=typeof req.body?.sessionId==='string'?req.body.sessionId.trim():'';
    if(!/^[a-zA-Z0-9_-]{16,128}$/.test(visitorId)||!/^[a-zA-Z0-9_-]{16,128}$/.test(sessionId)){
      return res.status(400).json({error:'Invalid analytics visitor session.'});
    }
    await prisma.$executeRaw`
      INSERT INTO public.site_visits ("id", "visitor_id", "session_id")
      VALUES (${randomUUID()}, ${visitorId}, ${sessionId})
      ON CONFLICT ("session_id") DO NOTHING
    `;
    const [totalVisits,uniqueRows]=await Promise.all([
      prisma.siteVisit.count(),
      prisma.$queryRaw<Array<{count:bigint}>>`SELECT COUNT(DISTINCT visitor_id) AS count FROM public.site_visits`,
    ]);
    res.status(201).json({totalVisits,uniqueVisitors:Number(uniqueRows[0]?.count||0)});
  }catch(error){next(error)}
});

router.get('/site', async (_req,res,next)=>{
  try{
    const [totalVisits,uniqueRows]=await Promise.all([
      prisma.siteVisit.count(),
      prisma.$queryRaw<Array<{count:bigint}>>`SELECT COUNT(DISTINCT visitor_id) AS count FROM public.site_visits`,
    ]);
    res.json({totalVisits,uniqueVisitors:Number(uniqueRows[0]?.count||0)});
  }catch(error){next(error)}
});

export { router as analyticsRouter };
