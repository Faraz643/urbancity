export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

/** Server-authoritative growth: height in metres from session age. */
export function clampPlayerHeight(height: number): number {
  const n = Number(height);
  return Number.isFinite(n)
    ? Math.max(PLAYER_BASE_HEIGHT, Math.min(PLAYER_MAX_HEIGHT, n))
    : PLAYER_BASE_HEIGHT;
}

export function playerScaleFromHeight(height: number): number {
  return clampPlayerHeight(height) / PLAYER_BASE_HEIGHT;
}
