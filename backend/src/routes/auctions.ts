import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all auctions
router.get('/', async (req, res, next) => {
  try {
    const { status, billboardId } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (billboardId) where.billboardId = billboardId;

    const auctions = await prisma.auction.findMany({
      where,
      include: {
        billboard: true,
        bids: {
          orderBy: { amount: 'desc' },
          take: 5,
          include: { bidder: { select: { username: true, displayName: true } } },
        },
        _count: { select: { bids: true } },
      },
      orderBy: { endsAt: 'asc' },
    });

    res.json(auctions);
  } catch (error) {
    next(error);
  }
});

// Get single auction
router.get('/:id', async (req, res, next) => {
  try {
    const auction = await prisma.auction.findUnique({
      where: { id: req.params.id },
      include: {
        billboard: true,
        bids: {
          orderBy: { amount: 'desc' },
          include: { bidder: { select: { username: true, displayName: true } } },
        },
      },
    });

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    res.json(auction);
  } catch (error) {
    next(error);
  }
});

// Create auction (admin)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      billboardId: z.string(),
      startPrice: z.number().min(0),
      endsAt: z.string().datetime(),
    });

    const data = schema.parse(req.body);

    const billboard = await prisma.billboard.findUnique({
      where: { id: data.billboardId },
    });

    if (!billboard) {
      return res.status(404).json({ error: 'Billboard not found' });
    }

    const endsAt = new Date(data.endsAt);
    if (endsAt <= new Date()) {
      return res.status(400).json({ error: 'Auction end time must be in the future' });
    }

    const auction = await prisma.auction.create({
      data: {
        billboardId: data.billboardId,
        startPrice: data.startPrice,
        endsAt,
      },
      include: { billboard: true },
    });

    // Update billboard availability
    await prisma.billboard.update({
      where: { id: data.billboardId },
      data: { isAvailable: false },
    });

    res.status(201).json(auction);
  } catch (error) {
    next(error);
  }
});

// End auction manually (admin)
router.post('/:id/end', authenticate, requireAdmin, async (req: AuthRequest, res, next) => {
  try {
    const auction = await prisma.auction.findUnique({
      where: { id: req.params.id },
      include: { bids: { orderBy: { amount: 'desc' }, take: 1 } },
    });

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Auction is not active' });
    }

    const winningBid = auction.bids[0];

    await prisma.$transaction(async (tx) => {
      await tx.auction.update({
        where: { id: req.params.id },
        data: {
          status: 'ENDED',
          winnerId: winningBid?.bidderId || null,
          currentPrice: winningBid?.amount || null,
        },
      });

      if (winningBid) {
        // Mark winning bid
        await tx.bid.update({
          where: { id: winningBid.id },
          data: { isWinning: true },
        });

        // Deduct from wallet
        await tx.wallet.update({
          where: { userId: winningBid.bidderId },
          data: { balance: { decrement: winningBid.amount } },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            walletId: (await tx.wallet.findUnique({ where: { userId: winningBid.bidderId } }))!.id,
            userId: winningBid.bidderId,
            type: 'WINNING_PAYMENT',
            amount: winningBid.amount,
            description: `Winning bid payment for auction #${auction.id}`,
            referenceId: auction.id,
          },
        });

        // Create notification
        await tx.notification.create({
          data: {
            userId: winningBid.bidderId,
            type: 'AUCTION_WON',
            title: 'Auction Won!',
            message: `You won the auction for ${auction.billboardId}`,
            data: JSON.stringify({ auctionId: auction.id, amount: winningBid.amount }),
          },
        });
      }

      // Refund losing bids
      const losingBids = await tx.bid.findMany({
        where: { auctionId: req.params.id, isWinning: false },
        distinct: ['bidderId'],
      });

      for (const bid of losingBids) {
        // Find the highest losing bid per user to refund
        const userBids = await tx.bid.findMany({
          where: { auctionId: req.params.id, bidderId: bid.bidderId },
          orderBy: { amount: 'desc' },
        });

        if (userBids.length > 0) {
          const highestLosing = userBids[0];
          await tx.wallet.update({
            where: { userId: bid.bidderId },
            data: { balance: { increment: highestLosing.amount } },
          });

          await tx.transaction.create({
            data: {
              walletId: (await tx.wallet.findUnique({ where: { userId: bid.bidderId } }))!.id,
              userId: bid.bidderId,
              type: 'BID_REFUND',
              amount: highestLosing.amount,
              description: `Bid refund for auction #${auction.id}`,
              referenceId: auction.id,
            },
          });
        }
      }

      // Update billboard
      await tx.billboard.update({
        where: { id: auction.billboardId },
        data: { isAvailable: true },
      });
    });

    res.json({ success: true, winnerId: winningBid?.bidderId || null });
  } catch (error) {
    next(error);
  }
});

export { router as auctionRouter };
