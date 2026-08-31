import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { randomUUID } from 'crypto';
import { prisma } from './db';
import { authRouter } from './routes/auth';
import { billboardRouter } from './routes/billboards';
import { auctionRouter } from './routes/auctions';
import { bookingRouter } from './routes/bookings';
import { advertisementRouter } from './routes/advertisements';
import { adminRouter } from './routes/admin';
import { analyticsRouter } from './routes/analytics';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// Development-friendly API limits. Authentication is protected separately so normal
// gameplay, billboard reads and wallet refreshes cannot lock a local player out.
const jsonRateLimit = (windowMs:number, max:number) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req,res) => res.status(429).json({
    error: 'Too many requests. Please wait a moment and try again.',
    code: 'RATE_LIMITED',
    retryAfterSeconds: Math.ceil(windowMs / 1000),
  }),
});
app.use('/api', jsonRateLimit(
  Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  Number(process.env.RATE_LIMIT_MAX_REQUESTS || 1000),
));

type Player = {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: number;
  moving: boolean;
};

type LiveBillboard = {
  id: string;
  bid: number;
  history: { playerId: string; amount: number; at: string }[];
};

const players = new Map<string, Player>();
const liveBillboards = new Map<string, LiveBillboard>([
  ['102', { id: '102', bid: 5000, history: [] }],
  ['207', { id: '207', bid: 8200, history: [] }],
  ['311', { id: '311', bid: 1800, history: [] }],
  ['412', { id: '412', bid: 2200, history: [] }],
  ['501', { id: '501', bid: 2400, history: [] }],
  ['502', { id: '502', bid: 2400, history: [] }],
  ['503', { id: '503', bid: 2400, history: [] }],
  ['504', { id: '504', bid: 2400, history: [] }],
  ['W01', { id: 'W01', bid: 3200, history: [] }],
  ['W02', { id: 'W02', bid: 4500, history: [] }],
  ['W03', { id: 'W03', bid: 3600, history: [] }],
  ['W04', { id: 'W04', bid: 2800, history: [] }],
  ['W05', { id: 'W05', bid: 2600, history: [] }],
]);

let databaseReady = false;

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseReady = true;
    console.log('Database connected');
  } catch (error) {
    databaseReady = false;
    console.warn('Database unavailable. Multiplayer demo mode remains available until migrations are run.');
  }
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    online: players.size,
    database: databaseReady ? 'connected' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/live/billboards', (_req, res) => {
  res.json([...liveBillboards.values()]);
});

// Authentication gets its own limiter; this prevents repeated login attempts while keeping gameplay APIs responsive.
app.use('/api/auth', jsonRateLimit(Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000), Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 30)), authRouter);
app.use('/api/billboards', billboardRouter);
app.use('/api/auctions', auctionRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/advertisements', advertisementRouter);
app.use('/api/admin', adminRouter);
app.use('/api/analytics', analyticsRouter);

const io = new Server(httpServer, {
  cors: { origin: FRONTEND_URL, credentials: true },
});

io.on('connection', (socket) => {
  const player: Player = {
    id: socket.id,
    name: 'Visitor-' + randomUUID().slice(0, 4),
    position: [0, 1, 8],
    rotation: 0,
    moving: false,
  };

  players.set(socket.id, player);
  socket.emit('players:list', [...players.values()]);
  socket.broadcast.emit('player:joined', player);
  io.emit('online:count', players.size);

  socket.on('player:update', (data: Partial<Player>) => {
    const current = players.get(socket.id);
    if (!current) return;

    if (
      Array.isArray(data.position) &&
      data.position.length === 3 &&
      data.position.every((value) => typeof value === 'number' && Number.isFinite(value))
    ) {
      current.position = data.position as [number, number, number];
    }

    if (typeof data.rotation === 'number' && Number.isFinite(data.rotation)) {
      current.rotation = data.rotation;
    }

    if (typeof data.moving === 'boolean') current.moving = data.moving;
    socket.broadcast.emit('player:update', current);
  });

  socket.on('billboard:bid', async (data: { id: string; amount: number; bidder?: { name: string; amount: number } }) => {
    const billboard = liveBillboards.get(data?.id);
    if (!billboard || !Number.isFinite(data?.amount) || data.amount <= billboard.bid) return;

    billboard.bid = data.amount;
    (billboard as any).bidder = data.bidder;
    billboard.history.push({
      playerId: socket.id,
      amount: data.amount,
      at: new Date().toISOString(),
    });

    // Persist the visible current price when the matching billboard exists in Prisma.
    if (databaseReady) {
      try {
        await prisma.billboard.update({
          where: { id: data.id },
          data: { currentBid: data.amount },
        });
      } catch (error) {
        console.warn('Could not persist live bid:', data.id);
      }
    }

    io.emit('billboard:update', billboard);
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    io.emit('player:left', socket.id);
    io.emit('online:count', players.size);
  });
});

// Persist proximity snapshots every 15 seconds without affecting gameplay.
setInterval(async () => {
  if (!databaseReady) return;

  const activePlayers = [...players.values()];
  const records = [...liveBillboards.values()].map(async (billboard) => {
    try {
      const dbBillboard = await prisma.billboard.findUnique({
        where: { id: billboard.id },
        select: { id: true, positionX: true, positionY: true, positionZ: true, trafficRadius: true },
      });
      if (!dbBillboard) return;

      const nearbyVisitors = activePlayers.filter((player) => {
        const dx = player.position[0] - dbBillboard.positionX;
        const dy = player.position[1] - dbBillboard.positionY;
        const dz = player.position[2] - dbBillboard.positionZ;
        return dx * dx + dy * dy + dz * dz <= dbBillboard.trafficRadius * dbBillboard.trafficRadius;
      }).length;

      await prisma.trafficAnalytics.create({
        data: { billboardId: dbBillboard.id, nearbyVisitors },
      });
    } catch {
      // Analytics must never interrupt realtime gameplay.
    }
  });

  await Promise.all(records);
}, 15_000);

app.use(errorHandler);

const PORT = Number(process.env.PORT || 3001);

async function start() {
  await checkDatabase();
  httpServer.listen(PORT, () => {
    console.log('UrbanCity server on ' + PORT);
  });
}

start();

async function shutdown() {
  io.close();
  httpServer.close();
  await prisma.$disconnect();
}

process.on('SIGINT', () => void shutdown().finally(() => process.exit(0)));
process.on('SIGTERM', () => void shutdown().finally(() => process.exit(0)));

export { app, io };
