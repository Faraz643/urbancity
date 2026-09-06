// Pricing module placeholder during the App.tsx refactor.
// Customer-facing prices remain the current USD values until the admin-controlled
// pricing system is wired to the database. No runtime pricing behavior is changed here.
export const URBANCITY_PRICING = {
  MAIN: { per30: 0.52, oneDay: 10.58 },
  WALL: { per30: 0.31, oneDay: 4.77 },
  CORNER: { per30: 0.20, oneDay: 3.17 },
} as const;

export type PricingCategory = keyof typeof URBANCITY_PRICING;

export function pricingCategory(type: string): PricingCategory {
  if (type === 'Premium Road' || type === 'Vertical') return 'MAIN';
  if (type === 'Building Wall' || type === 'Wall' || type === 'WALL') return 'WALL';
  return 'CORNER';
}

export function bookingPrice(type: string, minutes: number): number {
  const category = pricingCategory(type);
  const price = URBANCITY_PRICING[category];
  if (minutes <= 0 || minutes % 30 !== 0) throw new Error('Duration must use 30-minute steps');
  if (minutes < 1440) return Number(((minutes / 30) * price.per30).toFixed(2));
  const fullDays = Math.floor(minutes / 1440);
  const remainder = minutes % 1440;
  return Number((fullDays * price.oneDay + (remainder / 30) * price.per30).toFixed(2));
}
