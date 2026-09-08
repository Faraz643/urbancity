export type HuntPhase = "idle" | "playing" | "finished";

export interface HuntStats {
  kills: number;
  shots: number;
  hits: number;
  streak: number;
  bestStreak: number;
  timeLeft: number;
}

export interface HuntTargetState {
  id: string;
  position: [number, number, number];
}

export interface HuntSpawnPoint {
  position: [number, number, number];
}
