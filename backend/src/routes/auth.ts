import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, requireActiveUser, AuthRequest, getJwtSecret } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(6),
  displayName: z.string().optional(),
  websiteUrl: z.string().url().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
    });

    if (existing) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          username: data.username,
          passwordHash,
          displayName: data.displayName || data.username,
          websiteUrl: data.websiteUrl,
        },
      });
      await tx.wallet.create({ data: { userId: created.id, balance: 1000 } });
      return created;
    });

    const token = jwt.sign(
      { userId: user.id },
      getJwtSecret(),
      { expiresIn: 60 * 60 * 24 * 7 }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        websiteUrl: user.websiteUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      getJwtSecret(),
      { expiresIn: 60 * 60 * 24 * 7 }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        websiteUrl: user.websiteUrl,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        wallet: true,
        _count: {
          select: {
            bids: true,
            notifications: { where: { isRead: false } },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      avatar: user.avatar,
      websiteUrl: user.websiteUrl,
      companyDescription: user.companyDescription,
      wallet: user.wallet,
      stats: {
        totalBids: user._count.bids,
        unreadNotifications: user._count.notifications,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update profile
router.patch('/profile', authenticate, requireActiveUser, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      displayName: z.string().min(1).optional(),
      avatar: z.string().optional(),
      websiteUrl: z.string().url().optional(),
      companyDescription: z.string().max(300).optional(),
    });

    const data = schema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
    });

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      websiteUrl: user.websiteUrl,
      companyDescription: user.companyDescription,
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
