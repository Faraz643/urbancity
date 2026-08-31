import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { setupWebSocket } from './websocket/socket';
import { authRouter } from './routes/auth';
import { billboardRouter } from './routes/billboards';
import { auctionRouter } from './routes/auctions';
import { bidRouter } from './routes/bids';
import { walletRouter } from './routes/wallet';
import { advertisementRouter } from './routes/advertisements';
import { adminRouter } from './routes/admin';
import { analyticsRouter } from './routes/analytics';
import { notificationRouter } from './routes/notifications';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

export const prisma = new PrismaClient();

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/billboards', billboardRouter);
app.use('/api/auctions', auctionRouter);
app.use('/api/bids', bidRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/advertisements', advertisementRouter);
app.use('/api/admin', adminRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/notifications', notificationRouter);

// Error handling
app.use(errorHandler);

// Setup WebSocket
setupWebSocket(httpServer);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server active`);
});

export { app, httpServer };
