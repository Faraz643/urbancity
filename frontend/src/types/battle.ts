export type BattlePlayer = {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: number;
  moving: boolean;
  health: number;
  alive: boolean;
  kills: number;
  deaths: number;
  streak: number;
  bestStreak: number;
  ammo: number;
};

export type BattleStats = {
  kills: number;
  deaths: number;
  streak: number;
  bestStreak: number;
  ammo: number;
  health: number;
  alive: boolean;
};
