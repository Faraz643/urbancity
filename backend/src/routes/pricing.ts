import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
const PRICING_ID = 'default';

const DEFAULTS = {
  mainPer30Usd: 0.50,
  mainOneDayUsd: 10.58,
  wallPer30Usd: 0.30,
  wallOneDayUsd: 3.71,
  cornerPer30Usd: 0.20,
  cornerOneDayUsd: 3.17,
};

function serialize(p: any) {
  return {
    main: { per30: Number(p.mainPer30Usd), oneDay: Number(p.mainOneDayUsd) },
    wall: { per30: Number(p.wallPer30Usd), oneDay: Number(p.wallOneDayUsd) },
    corner: { per30: Number(p.cornerPer30Usd), oneDay: Number(p.cornerOneDayUsd) },
    updatedAt: p.updatedAt,
  };
}

async function ensurePricing() {
  return prisma.pricingSettings.upsert({
    where: { id: PRICING_ID },
    update: {},
    create: { id: PRICING_ID, ...DEFAULTS },
  });
}

router.get('/', async (_req, res, next) => {
  try { res.json(serialize(await ensurePricing())); } catch (e) { next(e); }
});

router.get('/admin', authenticate, requireAdmin, async (_req, res, next) => {
  try { res.json(serialize(await ensurePricing())); } catch (e) { next(e); }
});

router.patch('/admin', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const data = z.object({
      mainPer30: z.number().positive().max(100000), mainOneDay: z.number().positive().max(1000000),
      wallPer30: z.number().positive().max(100000), wallOneDay: z.number().positive().max(1000000),
      cornerPer30: z.number().positive().max(100000), cornerOneDay: z.number().positive().max(1000000),
    }).parse(req.body);
    const updated = await prisma.pricingSettings.upsert({
      where: { id: PRICING_ID },
      update: {
        mainPer30Usd: data.mainPer30, mainOneDayUsd: data.mainOneDay,
        wallPer30Usd: data.wallPer30, wallOneDayUsd: data.wallOneDay,
        cornerPer30Usd: data.cornerPer30, cornerOneDayUsd: data.cornerOneDay,
      },
      create: {
        id: PRICING_ID,
        mainPer30Usd: data.mainPer30, mainOneDayUsd: data.mainOneDay,
        wallPer30Usd: data.wallPer30, wallOneDayUsd: data.wallOneDay,
        cornerPer30Usd: data.cornerPer30, cornerOneDayUsd: data.cornerOneDay,
      },
    });
    res.json(serialize(updated));
  } catch (e) { next(e); }
});

export { router as pricingRouter };
