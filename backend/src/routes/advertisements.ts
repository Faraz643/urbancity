import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
const uploadDir=path.resolve(process.cwd(),'uploads','advertisements');
fs.mkdirSync(uploadDir,{recursive:true});
const storage=multer.diskStorage({destination:uploadDir,filename:(_req,file,cb)=>cb(null,Date.now()+'-'+Math.random().toString(36).slice(2)+path.extname(file.originalname).toLowerCase())});
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(_req,file,cb)=>cb(null,/^image\/(jpeg|png|webp)$/.test(file.mimetype))});

// Get all advertisements (public)
router.get('/', async (req, res, next) => {
  try {
    const { status, userId } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const ads = await prisma.advertisement.findMany({
      where,
      include: {
        user: { select: { username: true, displayName: true } },
        campaigns: { where: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(ads);
  } catch (error) {
    next(error);
  }
});

// Get my advertisements
router.get('/my-ads', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const ads = await prisma.advertisement.findMany({
      where: { userId: req.user!.id },
      include: {
        campaigns: {
          include: { billboard: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(ads);
  } catch (error) {
    next(error);
  }
});

// Upload advertisement creative
router.post('/upload', authenticate, upload.single('file'), async (req:AuthRequest,res,next)=>{try{if(!req.file)return res.status(400).json({error:'Upload a PNG, JPG or WEBP image (max 5 MB).'});const base=(process.env.PUBLIC_API_URL||req.protocol+'://'+req.get('host'));res.status(201).json({imageUrl:base+'/uploads/advertisements/'+req.file.filename});}catch(error){next(error);}});

// Create advertisement
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1).max(100),
      description: z.string().optional(),
      imageUrl: z.string().url(),
      targetUrl: z.string().url().optional(),
    });

    const data = schema.parse(req.body);

    const ad = await prisma.advertisement.create({
      data: {
        ...data,
        userId: req.user!.id,
        status: 'PENDING', // Requires admin approval
      },
    });

    res.status(201).json(ad);
  } catch (error) {
    next(error);
  }
});

// Update advertisement
router.patch('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      imageUrl: z.string().url().optional(),
      targetUrl: z.string().url().optional(),
    });

    const data = schema.parse(req.body);

    const existing = await prisma.advertisement.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!existing && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const ad = await prisma.advertisement.update({
      where: { id: req.params.id },
      data,
    });

    res.json(ad);
  } catch (error) {
    next(error);
  }
});

// Approve/reject advertisement (admin)
router.patch('/:id/status', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
    });

    const data = schema.parse(req.body);

    const ad = await prisma.advertisement.update({
      where: { id: req.params.id },
      data: { status: data.status },
    });

    res.json(ad);
  } catch (error) {
    next(error);
  }
});

// Create advertising campaign
router.post('/campaigns', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      billboardId: z.string(),
      advertisementId: z.string(),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    });

    const data = schema.parse(req.body);

    // Verify ownership
    const ad = await prisma.advertisement.findFirst({
      where: { id: data.advertisementId, userId: req.user!.id },
    });

    if (!ad) {
      return res.status(403).json({ error: 'Advertisement not found or not owned by you' });
    }

    if (ad.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Advertisement must be approved first' });
    }

    const campaign = await prisma.advertisingCampaign.create({
      data: {
        ...data,
        userId: req.user!.id,
        isActive: true,
      },
      include: {
        billboard: true,
        advertisement: true,
      },
    });

    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
});

export { router as advertisementRouter };
