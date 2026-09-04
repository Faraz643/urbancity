import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get wallet
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json(wallet);
  } catch (error) {
    next(error);
  }
});

// Deposit (simulated - in production would integrate with payment provider)
router.post('/deposit', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      amount: z.number().min(100),
      paymentMethod: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const wallet = await prisma.wallet.findUnique({
      where: { userId: req.user.id },
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // In production, this would verify payment with a provider
    const updated = await prisma.$transaction(async (tx) => {
      const w = await tx.wallet.update({
        where: { userId: req.user.id },
        data: { balance: { increment: data.amount } },
      });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: req.user.id,
          type: 'DEPOSIT',
          amount: data.amount,
          description: `Deposit of ₹${data.amount}`,
          status: 'COMPLETED',
        },
      });

      return w;
    });

    res.json({
      balance: updated.balance,
      message: `Successfully deposited ₹${data.amount}`,
    });
  } catch (error) {
    next(error);
  }
});

// Get transaction history
router.get('/transactions', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(transactions);
  } catch (error) {
    next(error);
  }
});

export { router as walletRouter };
