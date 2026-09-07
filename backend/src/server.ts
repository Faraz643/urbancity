import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from './db';
import { authRouter } from './routes/auth';
import { billboardRouter } from './routes/billboards';
import { bookingRouter } from './routes/bookings';
import { advertisementRouter } from './routes/advertisements';
import { adminRouter } from './routes/admin';
import { pricingRouter } from './routes/pricing';
import { analyticsRouter } from './routes/analytics';
import { paymentRouter } from './routes/payments';
import { errorHandler } from './middleware/errorHandler';
import { getJwtSecret } from './middleware/auth';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '2mb', verify: (req:any,_res,buf) => { req.rawBody=buf.toString('utf8'); } }));
app.use('/uploads',express.static('uploads'));

const jsonRateLimit = (windowMs:number, max:number) => rateLimit({ windowMs, max, standardHeaders:true, legacyHeaders:false, handler:(_req,res)=>res.status(429).json({error:'Too many requests. Please wait a moment and try again.',code:'RATE_LIMITED',retryAfterSeconds:Math.ceil(windowMs/1000)}) });
const publicApiRateLimit = jsonRateLimit(Number(process.env.API_RATE_LIMIT_WINDOW_MS||60000),Number(process.env.API_RATE_LIMIT_MAX_REQUESTS||300));
const paymentRateLimit = jsonRateLimit(Number(process.env.PAYMENT_RATE_LIMIT_WINDOW_MS||60000),Number(process.env.PAYMENT_RATE_LIMIT_MAX_REQUESTS||30));
const analyticsRateLimit = jsonRateLimit(Number(process.env.ANALYTICS_RATE_LIMIT_WINDOW_MS||60000),Number(process.env.ANALYTICS_RATE_LIMIT_MAX_REQUESTS||60));

app.get('/health',(_req,res)=>res.json({status:'ok',online:players.size,database:databaseReady?'connected':'unavailable',timestamp:new Date().toISOString()}));

const isDev=process.env.NODE_ENV!=='production';
app.use('/api/auth',isDev?authRouter:jsonRateLimit(Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS||60000),Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS||60)),authRouter);
app.use('/api/billboards',publicApiRateLimit,billboardRouter);
app.use('/api/bookings',publicApiRateLimit,bookingRouter);
app.use('/api/advertisements',publicApiRateLimit,advertisementRouter);
app.use('/api/admin',publicApiRateLimit,adminRouter);
app.use('/api/pricing',publicApiRateLimit,pricingRouter);
app.use('/api/analytics',analyticsRateLimit,analyticsRouter);
app.use('/api/payments',paymentRateLimit,paymentRouter);

// Keep the live billboard endpoint protected independently from the generic routers.
app.get('/api/live/billboards',publicApiRateLimit,async(_req,res)=>{try{const rows=await prisma.billboard.findMany({select:{id:true,currentBid:true}});res.json(rows.map(b=>({id:b.id,bid:Number(b.currentBid||0),footfall:billboardFootfall.get(b.id)||0})))}catch{res.json([...billboardFootfall.entries()].map(([id,footfall])=>({id,bid:0,footfall})))}});

type Player = { id:string; name:string; position:[number,number,number]; rotation:number; moving:boolean };
const players = new Map<string, Player>();
const billboardFootfall = new Map<string, number>();
const billboardFootfallPositions = new Map<string, {x:number;z:number}>();
const playerFootfallInside = new Map<string, Set<string>>();
function recordFootfallEnter(playerId:string,billboardId:string){if(!billboardId)return;const total=(billboardFootfall.get(billboardId)||0)+1;billboardFootfall.set(billboardId,total);io.emit('billboard:footfall',{id:billboardId,total,playerId});}
let databaseReady=false;
async function checkDatabase(){try{await prisma.$queryRaw`SELECT 1`;databaseReady=true;console.log('Database connected')}catch{databaseReady=false;console.warn('Database unavailable. Multiplayer demo mode remains available until migrations are run.')}}

const io=new Server(httpServer,{cors:{origin:FRONTEND_URL,credentials:true},connectionStateRecovery:{maxDisconnectionDuration:120000}});
const socketConnectionCounts = new Map<string,number>();
const SOCKET_MAX_CONNECTIONS_PER_IP = Number(process.env.SOCKET_MAX_CONNECTIONS_PER_IP||20);
const SOCKET_UPDATE_MIN_INTERVAL_MS = Number(process.env.SOCKET_UPDATE_MIN_INTERVAL_MS||50);
function socketIp(socket:any){const forwarded=String(socket.handshake.headers?.['x-forwarded-for']||'').split(',')[0].trim();return forwarded||String(socket.handshake.address||'unknown');}
io.use((socket,next)=>{const ip=socketIp(socket);const count=socketConnectionCounts.get(ip)||0;if(count>=SOCKET_MAX_CONNECTIONS_PER_IP)return next(new Error('Too many connections from this network'));const token=typeof socket.handshake.auth?.token==='string'?socket.handshake.auth.token:'';if(!token){socket.data.ip=ip;socketConnectionCounts.set(ip,count+1);return next();}try{const decoded=jwt.verify(token,getJwtSecret()) as {userId?:string};if(!decoded.userId)return next(new Error('Invalid socket token'));socket.data.userId=decoded.userId;socket.data.ip=ip;socketConnectionCounts.set(ip,count+1);next()}catch{next(new Error('Invalid socket token'))}});
io.on('connection',(socket)=>{
 const player:Player={id:socket.id,name:socket.data.userId?'Player-'+String(socket.data.userId).slice(0,4):'Visitor-'+randomUUID().slice(0,4),position:[0,1,8],rotation:0,moving:false};
 let lastPlayerUpdate=0;
 players.set(socket.id,player);socket.emit('players:list',[...players.values()]);socket.broadcast.emit('player:joined',player);io.emit('online:count',players.size);
 socket.on('player:update',(data:Partial<Player>)=>{const now=Date.now();if(now-lastPlayerUpdate<SOCKET_UPDATE_MIN_INTERVAL_MS)return;lastPlayerUpdate=now;const current=players.get(socket.id);if(!current)return;if(Array.isArray(data.position)&&data.position.length===3&&data.position.every(v=>typeof v==='number'&&Number.isFinite(v))){const next=data.position as [number,number,number];const dx=next[0]-current.position[0],dy=next[1]-current.position[1],dz=next[2]-current.position[2];if(Math.hypot(dx,dy,dz)<=8&&Math.abs(next[0])<=80&&next[1]>=-2&&next[1]<=30&&Math.abs(next[2])<=80)current.position=next}if(typeof data.rotation==='number'&&Number.isFinite(data.rotation))current.rotation=data.rotation;if(typeof data.moving==='boolean')current.moving=data.moving;socket.broadcast.emit('player:update',current)});
 socket.on('billboard:footfall-enter',(data:{id?:string})=>{const id=String(data?.id||'');if(!id||!billboardFootfallPositions.has(id))return;const inside=playerFootfallInside.get(socket.id)||new Set<string>();if(inside.has(id))return;inside.add(id);playerFootfallInside.set(socket.id,inside);recordFootfallEnter(socket.id,id)});
 socket.on('billboard:footfall-leave',(data:{id?:string})=>{const id=String(data?.id||'');if(id)playerFootfallInside.get(socket.id)?.delete(id)});
 socket.on('disconnect',()=>{players.delete(socket.id);playerFootfallInside.delete(socket.id);const ip=socket.data.ip||'unknown';const count=socketConnectionCounts.get(ip)||0;if(count<=1)socketConnectionCounts.delete(ip);else socketConnectionCounts.set(ip,count-1);io.emit('player:left',socket.id);io.emit('online:count',players.size)});
});
async function loadFootfallTotals(){if(!databaseReady)return;try{const [totals,billboards]=await Promise.all([prisma.billboardFootfall.findMany(),prisma.billboard.findMany({select:{id:true,positionX:true,positionZ:true}})]);billboardFootfall.clear();for(const row of totals)billboardFootfall.set(row.billboardId,row.total);billboardFootfallPositions.clear();for(const row of billboards)billboardFootfallPositions.set(row.id,{x:row.positionX,z:row.positionZ});console.log('Footfall totals loaded; '+billboardFootfallPositions.size+' active database billboard(s) available for validation')}catch(e){console.warn('Could not load footfall totals',e)}}
setInterval(async()=>{if(!databaseReady)return;try{for(const [billboardId,total] of billboardFootfall)await prisma.billboardFootfall.upsert({where:{billboardId},update:{total},create:{billboardId,total}})}catch(e){console.warn('Footfall persistence failed',e)}},30000);
async function expireBookings(){if(!databaseReady)return;try{const now=new Date();const expired=await prisma.booking.findMany({where:{status:'ACTIVE',endDate:{lte:now}},select:{id:true,billboardId:true,companyName:true,endDate:true}});if(!expired.length)return;await prisma.$transaction(async tx=>{for(const booking of expired){await tx.booking.update({where:{id:booking.id},data:{status:'EXPIRED'}});const nextActive=await tx.booking.findFirst({where:{billboardId:booking.billboardId,status:'ACTIVE',endDate:{gt:now}}});if(!nextActive)await tx.billboard.update({where:{id:booking.billboardId},data:{isAvailable:true,currentBid:null,currentBidderId:null}})}});for(const booking of expired){io.emit('billboard:expired',{id:booking.billboardId,companyName:booking.companyName,endedAt:booking.endDate.toISOString()});io.emit('billboard:update',{id:booking.billboardId,bid:0,bidder:null,available:true})}}catch(error){console.warn('Booking expiry check failed:',error)}}
setInterval(()=>void expireBookings(),15000);
setInterval(async()=>{if(!databaseReady)return;try{const [activePlayers,boards]=await Promise.all([Promise.resolve([...players.values()]),prisma.billboard.findMany({where:{isActive:true},select:{id:true,positionX:true,positionY:true,positionZ:true,trafficRadius:true}})]);await Promise.all(boards.map(async board=>{const nearbyVisitors=activePlayers.filter(player=>{const dx=player.position[0]-board.positionX,dy=player.position[1]-board.positionY,dz=player.position[2]-board.positionZ;return dx*dx+dy*dy+dz*dz<=board.trafficRadius*board.trafficRadius}).length;await prisma.trafficAnalytics.create({data:{billboardId:board.id,nearbyVisitors}})}))}catch{}},15000);
app.use(errorHandler);
const PORT=Number(process.env.PORT||3001);
function validateProductionEnvironment(){if(process.env.NODE_ENV!=='production')return;getJwtSecret();const required=['DATABASE_URL','FRONTEND_URL','CASHFREE_CLIENT_ID','CASHFREE_CLIENT_SECRET','CASHFREE_NOTIFY_URL','DODO_PAYMENTS_API_KEY','DODO_PAYMENTS_PRODUCT_ID','DODO_PAYMENTS_WEBHOOK_KEY'];const missing=required.filter(k=>!process.env[k]);if(missing.length)throw new Error('Missing required production environment variables: '+missing.join(', '));}
async function start(){validateProductionEnvironment();await checkDatabase();await loadFootfallTotals();await expireBookings();httpServer.listen(PORT,()=>console.log('UrbanCity server on '+PORT))}
start();
async function shutdown(){io.close();httpServer.close();await prisma.$disconnect()}
process.on('SIGINT',()=>void shutdown().finally(()=>process.exit(0)));process.on('SIGTERM',()=>void shutdown().finally(()=>process.exit(0)));
export {app,io};