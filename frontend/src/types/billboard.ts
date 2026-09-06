export type AdSlotKind = 'billboard' | 'wall-ad' | 'vertical-ad';

export type BidderInfo = {
  name: string;
  amount: number;
  siteUrl?: string;
  imageUrl?: string;
  description?: string;
};

export type Billboard = {
  id: string;
  type: 'Premium Road' | 'Street' | 'Building Wall' | 'Vertical';
  position: [number, number, number];
  traffic: 'High' | 'Medium';
  bid: number;
  occupied: boolean;
  ad: string;
  rotationY?: number;
  kind?: AdSlotKind;
  size?: [number, number];
};