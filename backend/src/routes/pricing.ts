import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
const PRICING_ID = 'default';
const DEFAULTS = { mainPer30: 0.50, mainOneDay: 10.58, wallPer30: 0.30, wallOneDay: 3.71, cornerPer30: 0.20, cornerOneDay: 3.17 };
type Row = { main_per30_usd:any; main_one_day_usd:any; wall_per30_usd:any; wall_one_day_usd:any; corner_per30_usd:any; corner_one_day_usd:any; updated_at:any };
const serialize=(p:Row)=>({main:{per30:Number(p.main_per30_usd),oneDay:Number(p.main_one_day_usd)},wall:{per30:Number(p.wall_per30_usd),oneDay:Number(p.wall_one_day_usd)},corner:{per30:Number(p.corner_per30_usd),oneDay:Number(p.corner_one_day_usd)},updatedAt:p.updated_at});
async function ensurePricing(){
 await prisma.$executeRaw`INSERT INTO pricing_settings (id,main_per30_usd,main_one_day_usd,wall_per30_usd,wall_one_day_usd,corner_per30_usd,corner_one_day_usd) VALUES (${PRICING_ID},${DEFAULTS.mainPer30},${DEFAULTS.mainOneDay},${DEFAULTS.wallPer30},${DEFAULTS.wallOneDay},${DEFAULTS.cornerPer30},${DEFAULTS.cornerOneDay}) ON CONFLICT (id) DO NOTHING`;
 const rows=await prisma.$queryRaw<Row[]>`SELECT main_per30_usd,main_one_day_usd,wall_per30_usd,wall_one_day_usd,corner_per30_usd,corner_one_day_usd,updated_at FROM pricing_settings WHERE id=${PRICING_ID}`;
 if(!rows[0])throw new Error('Pricing settings are unavailable'); return rows[0];
}
router.get('/',async(_req,res,next)=>{try{res.json(serialize(await ensurePricing()))}catch(e){next(e)}});
router.get('/admin',authenticate,requireAdmin,async(_req,res,next)=>{try{res.json(serialize(await ensurePricing()))}catch(e){next(e)}});
router.patch('/admin',authenticate,requireAdmin,async(req,res,next)=>{try{
 const d=z.object({mainPer30:z.number().positive(),mainOneDay:z.number().positive(),wallPer30:z.number().positive(),wallOneDay:z.number().positive(),cornerPer30:z.number().positive(),cornerOneDay:z.number().positive()}).parse(req.body);
 await prisma.$executeRaw`UPDATE pricing_settings SET main_per30_usd=${d.mainPer30},main_one_day_usd=${d.mainOneDay},wall_per30_usd=${d.wallPer30},wall_one_day_usd=${d.wallOneDay},corner_per30_usd=${d.cornerPer30},corner_one_day_usd=${d.cornerOneDay},updated_at=CURRENT_TIMESTAMP WHERE id=${PRICING_ID}`;
 res.json(serialize(await ensurePricing()));
}catch(e){next(e)}});
export {router as pricingRouter};
