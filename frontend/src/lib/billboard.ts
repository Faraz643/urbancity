import type { Billboard } from '../types/billboard';

// Keep traffic/footfall reach rules in one place so all billboard consumers use the same radius.
export function billboardTrafficRadius(b: Billboard) {
  return b.kind === 'wall-ad'
    ? 10
    : b.kind === 'vertical-ad'
      ? 9
      : b.type === 'Premium Road'
        ? 12
        : 9;
}

export function pricingCategory(type: string): 'MAIN' | 'WALL' | 'CORNER' {
  if (type === 'Premium Road' || type === 'Vertical') return 'MAIN';
  if (type === 'Building Wall' || type === 'Wall' || type === 'WALL') return 'WALL';
  return 'CORNER';
}
