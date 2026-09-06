export type PricingCategory='MAIN'|'WALL'|'CORNER';
export type PricingConfig=Record<'main'|'wall'|'corner',{per30:number;oneDay:number}>;
export const EMPTY_PRICING:PricingConfig={main:{per30:0,oneDay:0},wall:{per30:0,oneDay:0},corner:{per30:0,oneDay:0}};
export function pricingCategory(type:string):PricingCategory{if(type==='Premium Road'||type==='Vertical')return'MAIN';if(type==='Building Wall'||type==='Wall'||type==='WALL')return'WALL';return'CORNER'}
export function bookingPrice(config:PricingConfig,type:string,minutes:number){if(minutes<=0||minutes%30!==0)throw new Error('Duration must use 30-minute steps');const p=config[pricingCategory(type).toLowerCase() as 'main'|'wall'|'corner'];if(minutes<1440)return Number(((minutes/30)*p.per30).toFixed(2));const days=Math.floor(minutes/1440),remainder=minutes%1440;return Number((days*p.oneDay+(remainder/30)*p.per30).toFixed(2))}
