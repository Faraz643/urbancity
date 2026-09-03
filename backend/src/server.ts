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
import { paymentRouter } from './routes/payments';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '2mb', verify: (req:any,_res,buf) => { req.rawBody=buf.toString('utf8'); } }));
app.use('/uploads',express.static('uploads'));

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
// Global gameplay/read endpoints are intentionally not rate-limited here.\n// Auth routes below keep their own limiter.

type Player = {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: number;
  moving: boolean;
};

const billboardFootfall = new Map<string, number>();
const playerBillboardRanges = new Map<string, Set<string>>();
const billboardFootfallPositions = new Map<string, {x:number;z:number}>();

const footfallRadiusFor = (id:string) => id.startsWith('W') ? 10 : (id.includes('-') ? 9 : (id==='102'||id==='207'||id==='501'||id==='502'||id==='503'||id==='504' ? 12 : 9));

// IMPORTANT: player:update fires many times per second. Footfall detection must therefore
// be synchronous and state must be updated immediately, otherwise overlapping async calls
// can all see the player as "outside" and increment repeatedly.
function recordFootfall(playerId:string, position:[number,number,number]) {
  const previous=playerBillboardRanges.get(playerId)||new Set<string>();
  const current=new Set<string>();

  for(const [id,board] of billboardFootfallPositions) {
    if(Math.hypot(position[0]-board.x,position[2]-board.z)<=footfallRadiusFor(id)) {
      current.add(id);
      if(!previous.has(id)) {
        const total=(billboardFootfall.get(id)||0)+1;
        billboardFootfall.set(id,total);
        io.emit('billboard:footfall',{id,total});
      }
    }
  }

  // Set state synchronously on every movement update. Staying in range cannot increment
  // again; only leave -> enter produces another footfall event.
  playerBillboardRanges.set(playerId,current);
}


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
  res.json([...liveBillboards.values()].map(b=>({...b,footfall:billboardFootfall.get(b.id)||0})));
});

// Authentication gets its own limiter; this prevents repeated login attempts while keeping gameplay APIs responsive.
const isDev=process.env.NODE_ENV!=='production';
app.use('/api/auth', isDev?authRouter:jsonRateLimit(Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000), Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 60)), authRouter);
app.use('/api/billboards', billboardRouter);
app.use('/api/auctions', auctionRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/advertisements', advertisementRouter);
app.use('/api/admin', adminRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/payments', paymentRouter);

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
    if(databaseReady) recordFootfall(socket.id,current.position);
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

  socket.on('billboard:book', (data: { id: string; amount: number; bidder: { name: string; amount: number } }) => {
    const billboard = liveBillboards.get(data?.id);
    if (!billboard || !Number.isFinite(data?.amount)) return;
    billboard.bid = data.amount;
    (billboard as any).bidder = data.bidder;
    io.emit('billboard:update', billboard);
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    playerBillboardRanges.delete(socket.id);
    io.emit('player:left', socket.id);
    io.emit('online:count', players.size);
  });
});

// Load persisted footfall totals on startup.
async function loadFootfallTotals(){
 if(!databaseReady)return;
 try{
   const [totals,billboards]=await Promise.all([
     prisma.billboardFootfall.findMany(),
     prisma.billboard.findMany({select:{id:true,positionX:true,positionZ:true}})
   ]);
   for(const row of totals)billboardFootfall.set(row.billboardId,row.total);
   billboardFootfallPositions.clear();
   for(const row of billboards)billboardFootfallPositions.set(row.id,{x:row.positionX,z:row.positionZ});
   console.log('Footfall tracking ready for '+billboardFootfallPositions.size+' billboard(s)');
 }catch(e){console.warn('Could not load footfall totals',e)}
}

// Persist exact cumulative totals without mixing them with live traffic snapshots.
setInterval(async()=>{if(!databaseReady)return;try{for(const [billboardId,total] of billboardFootfall){await prisma.billboardFootfall.upsert({where:{billboardId},update:{total},create:{billboardId,total}})}}catch(e){console.warn('Footfall persistence failed',e)}},30_000);

// Automatically expire completed advertising bookings and release their billboard.
async function expireBookings() {
  if (!databaseReady) return;
  try {
    const now=new Date();
    const expired=await prisma.booking.findMany({
      where:{status:'ACTIVE',endDate:{lte:now}},
      select:{id:true,billboardId:true,companyName:true,endDate:true}
    });
    if(!expired.length)return;
    await prisma.$transaction(async tx=>{
      for(const booking of expired){
        await tx.booking.update({where:{id:booking.id},data:{status:'EXPIRED'}});
        const nextActive=await tx.booking.findFirst({where:{billboardId:booking.billboardId,status:'ACTIVE',endDate:{gt:now}}});
        if(!nextActive){
          await tx.billboard.update({where:{id:booking.billboardId},data:{isAvailable:true,currentBid:null,currentBidderId:null}});
        }
      }
    });
    for(const booking of expired){
      const live=liveBillboards.get(booking.billboardId);
      if(live){(live as any).bidder=undefined;live.bid=0;}
      io.emit('billboard:expired',{id:booking.billboardId,companyName:booking.companyName,endedAt:booking.endDate.toISOString()});
      io.emit('billboard:update',{...(live||{id:booking.billboardId,bid:0,history:[]}),bidder:null,available:true});
    }
    console.log('Expired '+expired.length+' advertising booking(s)');
  }catch(error){console.warn('Booking expiry check failed:',error);}
}

setInterval(()=>void expireBookings(),15_000);

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
  await loadFootfallTotals();
  await expireBookings();
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
