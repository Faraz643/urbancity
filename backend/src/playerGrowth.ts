export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

/** Server-authoritative, slow continuous visual growth: +0.1 height per 10 seconds. */
export function playerHeightFromSession(startedAtMs: number, nowMs = Date.now()) {
  const elapsedSeconds = Math.max(0, (nowMs - startedAtMs) / 1000);
  return Math.min(PLAYER_MAX_HEIGHT, PLAYER_BASE_HEIGHT + elapsedSeconds * 0.01);
}
