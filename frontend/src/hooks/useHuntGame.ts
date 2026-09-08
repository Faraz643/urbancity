import { useCallback, useEffect, useRef, useState } from "react";
import type { HuntPhase, HuntStats } from "../types/hunt";

const ROUND_SECONDS = 180;

export function useHuntGame() {
  const [phase, setPhase] = useState<HuntPhase>("idle");
  const [stats, setStats] = useState<HuntStats>({
    kills: 0,
    shots: 0,
    hits: 0,
    streak: 0,
    bestStreak: 0,
    timeLeft: ROUND_SECONDS,
  });
  const [targetKey, setTargetKey] = useState(0);
  const startedAt = useRef(0);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    setStats({ kills: 0, shots: 0, hits: 0, streak: 0, bestStreak: 0, timeLeft: ROUND_SECONDS });
    setTargetKey((v) => v + 1);
    setPhase("playing");
  }, []);

  const shoot = useCallback((hit: boolean) => {
    if (phase !== "playing") return;
    setStats((s) => {
      const streak = hit ? s.streak + 1 : 0;
      return {
        ...s,
        shots: s.shots + 1,
        hits: s.hits + (hit ? 1 : 0),
        kills: s.kills + (hit ? 1 : 0),
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
      };
    });
    if (hit) setTargetKey((v) => v + 1);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
      const left = Math.max(0, ROUND_SECONDS - elapsed);
      setStats((s) => ({ ...s, timeLeft: left }));
      if (left <= 0) setPhase("finished");
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  const accuracy = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
  return { phase, stats, accuracy, targetKey, start, shoot };
}
