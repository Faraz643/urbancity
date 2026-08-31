export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatar?: string;
  role: 'USER' | 'ADMIN';
  wallet?: Wallet;
  stats?: { totalBids: number; unreadNotifications: number };
}

export interface Wallet {
  id: string;
  balance: number;
  userId: string;
}

export interface Billboard {
  id: string;
  name: string;
  type: 'PREMIUM' | 'STREET';
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  width: number;
  height: number;
  location: string;
  trafficRadius: number;
  trafficRating: string;
  visibilityRating: string;
  minBid: number;
  currentBid?: number;
  currentBidderId?: string;
  isAvailable: boolean;
  isActive: boolean;
  auctions?: Auction[];
  campaigns?: AdvertisingCampaign[];
  trafficAnalytics?: TrafficAnalytics[];
  _count?: { bids: number };
}

export interface Auction {
  id: string;
  billboardId: string;
  billboard?: Billboard;
  startPrice: number;
  currentPrice?: number;
  winnerId?: string;
  status: 'ACTIVE' | 'ENDED' | 'CANCELLED';
  startedAt: string;
  endsAt: string;
  bids?: Bid[];
  _count?: { bids: number };
}

export interface Bid {
  id: string;
  auctionId: string;
  bidderId: string;
  bidder?: { username: string; displayName?: string };
  billboardId: string;
  amount: number;
  isWinning: boolean;
  createdAt: string;
  auction?: Auction;
}

export interface Advertisement {
  id: string;
  userId: string;
  title: string;
  description?: string;
  imageUrl: string;
  targetUrl?: string;
  status: string;
  createdAt: string;
  user?: { username: string; displayName?: string };
  campaigns?: AdvertisingCampaign[];
}

export interface AdvertisingCampaign {
  id: string;
  userId: string;
  billboardId: string;
  billboard?: Billboard;
  advertisementId: string;
  advertisement?: Advertisement;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface TrafficAnalytics {
  id: string;
  billboardId: string;
  nearbyVisitors: number;
  timestamp: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  data?: string;
  createdAt: string;
}

export interface PlayerData {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  movementState: 'idle' | 'walking';
  displayName: string;
}

export interface BillboardTraffic {
  billboardId: string;
  nearbyVisitors: number;
}
