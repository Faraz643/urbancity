import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all billboards with filters
router.get('/', async (req, res, next) => {
  try {
    const { type, status, minPrice, maxPrice, search } = req.query;

    const where: any = { isActive: true };

    if (type) where.type = type;
    if (status === 'available') where.isAvailable = true;
    if (status === 'auction') where.auctions = { some: { status: 'ACTIVE' } };
    if (minPrice || maxPrice) {
      where.currentBid = {};
      if (minPrice) where.currentBid.gte = parseFloat(minPrice as string);
      if (maxPrice) where.currentBid.lte = parseFloat(maxPrice as string);
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { location: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const billboards = await prisma.billboard.findMany({
      where,
      include: {
        auctions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { bids: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(billboards);
  } catch (error) {
    next(error);
  }
});

// Get featured billboard (highest bid)
router.get('/featured', async (req, res, next) => {
  try {
    const featured = await prisma.billboard.findFirst({
      where: {
        isActive: true,
        currentBid: { not: null },
      },
      include: {
        auctions: {
          where: { status: 'ACTIVE' },
          include: {
            bids: {
              orderBy: { amount: 'desc' },
              take: 1,
              include: { bidder: { select: { username: true, displayName: true } } },
            },
          },
        },
        campaigns: {
          where: { isActive: true },
          include: { advertisement: true },
        },
      },
      orderBy: { currentBid: 'desc' },
    });

    if (!featured) {
      // Fallback to most valuable available billboard
      const fallback = await prisma.billboard.findFirst({
        where: { isActive: true },
        orderBy: { minBid: 'desc' },
        include: {
          auctions: { where: { status: 'ACTIVE' } },
          campaigns: { where: { isActive: true }, include: { advertisement: true } },
        },
      });
      return res.json(fallback);
    }

    res.json(featured);
  } catch (error) {
    next(error);
  }
});

// Get single billboard
router.get('/:id', async (req, res, next) => {
  try {
    const billboard = await prisma.billboard.findUnique({
      where: { id: req.params.id },
      include: {
        auctions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            bids: {
              orderBy: { amount: 'desc' },
              take: 10,
              include: { bidder: { select: { username: true, displayName: true } } },
            },
          },
        },
        campaigns: {
          where: { isActive: true },
          include: { advertisement: true },
        },
        trafficAnalytics: {
          orderBy: { timestamp: 'desc' },
          take: 24,
        },
      },
    });

    if (!billboard) {
      return res.status(404).json({ error: 'Billboard not found' });
    }

    res.json(billboard);
  } catch (error) {
    next(error);
  }
});

// Create billboard (admin)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      type: z.enum(['PREMIUM', 'STREET']),
      positionX: z.number(),
      positionY: z.number(),
      positionZ: z.number(),
      rotationY: z.number().default(0),
      width: z.number().default(4),
      height: z.number().default(2.5),
      location: z.string(),
      trafficRadius: z.number().default(50),
      trafficRating: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).default('MEDIUM'),
      visibilityRating: z.enum(['POOR', 'FAIR', 'GOOD', 'EXCELLENT']).default('GOOD'),
      minBid: z.number().default(1000),
    });

    const data = schema.parse(req.body);

    const billboard = await prisma.billboard.create({
      data: {
        ...data,
        minBid: data.minBid,
      },
    });

    res.status(201).json(billboard);
  } catch (error) {
    next(error);
  }
});

// Update billboard (admin)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      type: z.enum(['PREMIUM', 'STREET']).optional(),
      positionX: z.number().optional(),
      positionY: z.number().optional(),
      positionZ: z.number().optional(),
      rotationY: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      location: z.string().optional(),
      trafficRadius: z.number().optional(),
      trafficRating: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).optional(),
      visibilityRating: z.enum(['POOR', 'FAIR', 'GOOD', 'EXCELLENT']).optional(),
      minBid: z.number().optional(),
      isAvailable: z.boolean().optional(),
      isActive: z.boolean().optional(),
    });

    const data = schema.parse(req.body);

    const billboard = await prisma.billboard.update({
      where: { id: req.params.id },
      data,
    });

    res.json(billboard);
  } catch (error) {
    next(error);
  }
});

// Delete billboard (admin)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    await prisma.billboard.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export { router as billboardRouter };
