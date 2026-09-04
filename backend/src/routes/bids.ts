import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Place a bid
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      auctionId: z.string(),
      amount: z.number().min(0),
    });

    const data = schema.parse(req.body);
    const userId = req.user.id;

    const auction = await prisma.auction.findUnique({
      where: { id: data.auctionId },
      include: { billboard: true },
    });

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Auction is not active' });
    }

    if (new Date() > auction.endsAt) {
      return res.status(400).json({ error: 'Auction has ended' });
    }

    // Check minimum bid
    const minNextBid = auction.currentPrice
      ? Number(auction.currentPrice) * 1.05 // 5% increment
      : Number(auction.startPrice);

    if (data.amount < minNextBid) {
      return res.status(400).json({
        error: `Minimum bid must be at least ₹${minNextBid.toFixed(2)}`,
        minNextBid,
      });
    }

    // Check wallet balance
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return res.status(400).json({ error: 'Wallet not found' });
    }

    if (Number(wallet.balance) < data.amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Check if user already has a bid on this auction
    const existingBid = await prisma.bid.findFirst({
      where: { auctionId: data.auctionId, bidderId: userId },
      orderBy: { amount: 'desc' },
    });

    const bid = await prisma.$transaction(async (tx) => {
      // If existing bid, refund the old amount
      if (existingBid) {
        await tx.wallet.update({
          where: { userId },
          data: { balance: { increment: existingBid.amount } },
        });

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            userId,
            type: 'BID_REFUND',
            amount: existingBid.amount,
            description: `Bid refund for outbid on auction #${data.auctionId}`,
            referenceId: data.auctionId,
          },
        });
      }

      // Deduct new bid amount
      await tx.wallet.update({
        where: { userId },
        data: { balance: { decrement: data.amount } },
      });

      // Create bid reservation transaction
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'BID_RESERVATION',
          amount: data.amount,
          description: `Bid reservation for auction #${data.auctionId}`,
          referenceId: data.auctionId,
        },
      });

      // Create the bid
      const newBid = await tx.bid.create({
        data: {
          auctionId: data.auctionId,
          bidderId: userId,
          billboardId: auction.billboardId,
          amount: data.amount,
        },
        include: {
          bidder: { select: { username: true, displayName: true } },
        },
      });

      // Update auction current price
      await tx.auction.update({
        where: { id: data.auctionId },
        data: { currentPrice: data.amount },
      });

      // Update billboard current bid
      await tx.billboard.update({
        where: { id: auction.billboardId },
        data: {
          currentBid: data.amount,
          currentBidderId: userId,
        },
      });

      // Notify previous highest bidder they were outbid
      if (auction.currentPrice) {
        const previousBid = await tx.bid.findFirst({
          where: {
            auctionId: data.auctionId,
            amount: auction.currentPrice,
            bidderId: { not: userId },
          },
        });

        if (previousBid) {
          await tx.notification.create({
            data: {
              userId: previousBid.bidderId,
              type: 'OUTBID',
              title: 'You were outbid!',
              message: `Someone placed a higher bid of ₹${data.amount} on ${auction.billboard.name}`,
              data: JSON.stringify({ auctionId: data.auctionId, newAmount: data.amount }),
            },
          });
        }
      }

      return newBid;
    });

    res.status(201).json(bid);
  } catch (error) {
    next(error);
  }
});

// Get user's bids
router.get('/my-bids', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const bids = await prisma.bid.findMany({
      where: { bidderId: req.user.id },
      include: {
        auction: {
          include: { billboard: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(bids);
  } catch (error) {
    next(error);
  }
});

export { router as bidRouter };
