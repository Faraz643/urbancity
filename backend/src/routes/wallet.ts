import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const SYSTEM_CURRENCY='USD';

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

    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    res.json({...wallet,currency:SYSTEM_CURRENCY});
  } catch (error) { next(error); }
});

// Deposit (simulated - in production this should be verified with a payment provider)
router.post('/deposit', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({ amount: z.number().min(1), paymentMethod: z.string().optional() });
    const data = schema.parse(req.body);
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const w = await tx.wallet.update({ where: { userId: req.user.id }, data: { balance: { increment: data.amount } } });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId: req.user.id,
          type: 'DEPOSIT',
          amount: data.amount,
          description: `Deposit of $${data.amount.toFixed(2)}`,
          status: 'COMPLETED',
        },
      });
      return w;
    });

    res.json({ balance: Number(updated.balance), currency:SYSTEM_CURRENCY, message: `Successfully deposited $${data.amount.toFixed(2)}` });
  } catch (error) { next(error); }
});

// Get transaction history
router.get('/transactions', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(transactions.map(t=>({...t,currency:SYSTEM_CURRENCY})));
  } catch (error) { next(error); }
});

export { router as walletRouter };
