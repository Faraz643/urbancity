import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, requireActiveUser, AuthRequest } from '../middleware/auth';

const router = Router();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'advertisements';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});

function getStorageClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase Storage is not configured');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

router.get('/', async (req, res, next) => {
  try {
    const { status, userId } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    const ads = await prisma.advertisement.findMany({
      where,
      include: { user: { select: { username: true, displayName: true } }, campaigns: { where: { isActive: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ads);
  } catch (error) { next(error); }
});

router.get('/my-ads', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const ads = await prisma.advertisement.findMany({
      where: { userId: req.user!.id },
      include: { campaigns: { include: { billboard: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ads);
  } catch (error) { next(error); }
});

router.post('/upload', authenticate, requireActiveUser, upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Upload a PNG, JPG or WEBP image (max 5 MB).' });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.img';
    const objectPath = `advertisements/${req.user!.id}/${Date.now()}-${randomUUID()}${ext}`;
    const supabase = getStorageClient();
    const { error: uploadError } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(objectPath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadError) throw new Error(`Advertisement upload failed: ${uploadError.message}`);
    const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath);
    res.status(201).json({ imageUrl: data.publicUrl, path: objectPath });
  } catch (error) { next(error); }
});

router.post('/', authenticate, requireActiveUser, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1).max(100),
      description: z.string().optional(),
      imageUrl: z.union([z.string().url(), z.literal('')]),
      targetUrl: z.string().url().optional(),
    });
    const data = schema.parse(req.body);
    const ad = await prisma.advertisement.create({ data: { ...data, userId: req.user!.id, status: 'PENDING' } });
    res.status(201).json(ad);
  } catch (error) { next(error); }
});

router.patch('/:id', authenticate, requireActiveUser, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      imageUrl: z.union([z.string().url(), z.literal('')]).optional(),
      targetUrl: z.string().url().optional(),
    });
    const data = schema.parse(req.body);
    const existing = await prisma.advertisement.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing && req.user!.role !== 'ADMIN') return res.status(403).json({ error: 'Not authorized' });
    const ad = await prisma.advertisement.update({ where: { id: req.params.id }, data });
    res.json(ad);
  } catch (error) { next(error); }
});

router.post('/campaigns', authenticate, requireActiveUser, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({ billboardId: z.string(), advertisementId: z.string(), startDate: z.string().datetime(), endDate: z.string().datetime() });
    const data = schema.parse(req.body);
    const ad = await prisma.advertisement.findFirst({ where: { id: data.advertisementId, userId: req.user!.id } });
    if (!ad) return res.status(403).json({ error: 'Advertisement not found or not owned by you' });
    if (ad.status !== 'APPROVED') return res.status(400).json({ error: 'Advertisement must be approved first' });
    const campaign = await prisma.advertisingCampaign.create({
      data: { ...data, userId: req.user!.id, isActive: true },
      include: { billboard: true, advertisement: true },
    });
    res.status(201).json(campaign);
  } catch (error) { next(error); }
});

// Record one outbound advertising click per visitor per booking per local calendar day.
// GET is retained for direct link compatibility; POST is used by navigator.sendBeacon.
router.all('/click/:bookingId', async (req, res, next) => {
  try {
    const visitorId = String(req.query.visitorId || '').trim();
    if (!visitorId || visitorId.length > 128) return res.status(400).send('Missing visitor identifier');

    const now = new Date();
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.bookingId, status: 'ACTIVE', endDate: { gt: now }, startDate: { lte: now } },
      include: { advertisement: true, user: { select: { websiteUrl: true } } },
    });
    if (!booking) return res.status(404).send('Advertisement is no longer active');

    const destination = booking.advertisement?.status === 'DISABLED'
      ? booking.user.websiteUrl
      : booking.advertisement?.targetUrl || booking.user.websiteUrl;
    if (!destination) return res.status(204).end();

    const result = await prisma.$executeRawUnsafe(
      `INSERT INTO "ad_clicks" ("id","booking_id","billboard_id","visitor_id","clicked_at","clicked_day") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ("booking_id","visitor_id","clicked_day") DO NOTHING`,
      randomUUID(), booking.id, booking.billboardId, visitorId, now, now.toISOString().slice(0, 10),
    );

    const rows: Array<{ count: number }> = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "ad_clicks" WHERE "booking_id" = $1`, booking.id,
    );
    const totalClicks = Number(rows[0]?.count || 0);

    if (String(req.query.track || '') === '1') {
      return res.status(200).json({ counted: result > 0, totalClicks });
    }

    res.redirect(302, destination);
  } catch (error) { next(error); }
});

router.get('/clicks/:bookingId', async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.bookingId }, select: { id: true } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const rows: Array<{ count: number }> = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count FROM "ad_clicks" WHERE "booking_id" = $1`, req.params.bookingId,
    );
    res.json({ bookingId: req.params.bookingId, totalClicks: Number(rows[0]?.count || 0) });
  } catch (error) { next(error); }
});

export { router as advertisementRouter };
