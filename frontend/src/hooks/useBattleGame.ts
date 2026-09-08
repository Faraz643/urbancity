import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { BattlePlayer, BattleStats } from "../types/battle";

const EMPTY_STATS: BattleStats = { kills: 0, deaths: 0, streak: 0, bestStreak: 0, ammo: 30, health: 100, alive: true };

export function useBattleGame(api: string) {
  const socket = useRef<Socket | null>(null);
  const [selfId, setSelfId] = useState("");
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [stats, setStats] = useState<BattleStats>(EMPTY_STATS);
  const [timeLeft, setTimeLeft] = useState(300);
  const [status, setStatus] = useState("Waiting for battle...");
  const [hitMarker, setHitMarker] = useState(false);
  const [killFeed, setKillFeed] = useState<string[]>([]);
  const [spawn, setSpawn] = useState<[number, number, number]>([0, 1.4, 8]);
  const [matchEnded, setMatchEnded] = useState(false);
  const hitTimer = useRef<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("urbancity_token");
    const s = io(api, { auth: token ? { token } : {} });
    socket.current = s;
    s.on("connect", () => setSelfId(s.id || ""));
    s.on("battle:state", (data) => {
      setJoined(true);
      setPlayers(data.players || []);
      setStats(data.self || EMPTY_STATS);
      setTimeLeft(Math.max(0, Number(data.timeLeft || 0)));
      setSpawn(data.spawn || [0, 1.4, 8]);
      setStatus("LIVE");
      setMatchEnded(false);
    });
    s.on("battle:players", (data: BattlePlayer[]) => setPlayers(data || []));
    s.on("player:update", (p: BattlePlayer) => setPlayers((items) => items.map((item) => item.id === p.id ? { ...item, position: p.position, rotation: p.rotation, moving: p.moving } : item)));
    s.on("player:left", (id: string) => setPlayers((items) => items.filter((item) => item.id !== id)));
    s.on("battle:self", (data: BattleStats & { spawn?: [number, number, number] }) => {
      setStats(data);
      if (data.spawn) setSpawn(data.spawn);
    });
    s.on("battle:timer", (seconds: number) => setTimeLeft(Math.max(0, seconds)));
    s.on("battle:hit", () => {
      setHitMarker(true);
      if (hitTimer.current) window.clearTimeout(hitTimer.current);
      hitTimer.current = window.setTimeout(() => setHitMarker(false), 120);
    });
    s.on("battle:kill", (data: { killerName: string; victimName: string; victimId: string }) => {
      setKillFeed((items) => [`${data.killerName} eliminated ${data.victimName}`, ...items].slice(0, 4));
    });
    s.on("battle:respawn", (data: { id: string; position: [number, number, number] }) => {
      if (data.id === s.id) setSpawn(data.position);
    });
    s.on("battle:ended", (data) => {
      setTimeLeft(0);
      setMatchEnded(true);
      setStatus("MATCH OVER");
      if (data?.players) setPlayers(data.players);
    });
    s.on("battle:error", (message: string) => setStatus(message));
    return () => {
      if (hitTimer.current) window.clearTimeout(hitTimer.current);
      s.emit("battle:leave");
      s.removeAllListeners();
      s.disconnect();
      if (socket.current === s) socket.current = null;
    };
  }, [api]);

  const join = useCallback(() => socket.current?.emit("battle:join"), []);
  const leave = useCallback(() => { socket.current?.emit("battle:leave"); setJoined(false); }, []);
  const move = useCallback((data: { position: [number, number, number]; rotation: number; moving: boolean }) => socket.current?.emit("player:update", data), []);
  const shoot = useCallback((targetId?: string) => {
    if (!socket.current || !joined || !stats.alive || matchEnded) return;
    socket.current.emit("battle:shoot", { targetId });
  }, [joined, matchEnded, stats.alive]);
  const reload = useCallback(() => socket.current?.emit("battle:reload"), []);

  return { selfId, joined, players, stats, timeLeft, status, hitMarker, killFeed, spawn, matchEnded, join, leave, move, shoot, reload };
}
