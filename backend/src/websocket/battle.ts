import type { Server } from 'socket.io';

type Player = {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: number;
  moving: boolean;
};

type BattleState = {
  id: string;
  health: number;
  alive: boolean;
  kills: number;
  deaths: number;
  streak: number;
  bestStreak: number;
  ammo: number;
  lastShotAt: number;
  respawnTimer?: ReturnType<typeof setTimeout>;
};

const ROUND_SECONDS = 300;
const MAX_HEALTH = 100;
const MAGAZINE_SIZE = 30;
const DAMAGE = 100;
const FIRE_COOLDOWN_MS = 180;
const RESPAWN_MS = 2500;
const MAX_SHOT_DISTANCE = 70;

const SPAWNS: [number, number, number][] = [
  [-30, 1.4, -20], [26, 1.4, -24], [-22, 1.4, 22], [30, 1.4, 18],
  [0, 1.4, -34], [0, 1.4, 32], [-40, 1.4, 4], [40, 1.4, -6],
  [-8, 1.4, 0], [14, 1.4, 8],
];

export function setupBattle(io: Server, players: Map<string, Player>) {
  const battle = new Map<string, BattleState>();
  let startedAt = 0;
  let finished = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const randomSpawn = (avoidId?: string): [number, number, number] => {
    const candidates = SPAWNS.filter((point) => {
      if (!avoidId) return true;
      const owner = players.get(avoidId);
      if (!owner) return true;
      return Math.hypot(point[0] - owner.position[0], point[2] - owner.position[2]) > 12;
    });
    return [...(candidates[Math.floor(Math.random() * candidates.length)] || SPAWNS[0])] as [number, number, number];
  };

  const publicPlayer = (id: string) => {
    const p = players.get(id);
    const b = battle.get(id);
    if (!p || !b) return null;
    return { id, name: p.name, position: p.position, rotation: p.rotation, moving: p.moving, health: b.health, alive: b.alive, kills: b.kills, deaths: b.deaths, streak: b.streak, bestStreak: b.bestStreak, ammo: b.ammo };
  };

  const publicPlayers = () => [...battle.keys()].map(publicPlayer).filter(Boolean);
  const timeLeft = () => Math.max(0, ROUND_SECONDS - Math.floor((Date.now() - startedAt) / 1000));

  const sendState = (id: string) => {
    const b = battle.get(id);
    const p = players.get(id);
    if (!b || !p) return;
    io.to(id).emit('battle:state', {
      players: publicPlayers(),
      self: { kills: b.kills, deaths: b.deaths, streak: b.streak, bestStreak: b.bestStreak, ammo: b.ammo, health: b.health, alive: b.alive },
      spawn: p.position,
      timeLeft: timeLeft(),
    });
  };

  const broadcastPlayers = () => io.emit('battle:players', publicPlayers());

  const endRound = () => {
    if (finished) return;
    finished = true;
    if (timer) clearInterval(timer);
    io.emit('battle:ended', { players: publicPlayers() });
  };

  const startRound = () => {
    startedAt = Date.now();
    finished = false;
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const left = timeLeft();
      io.emit('battle:timer', left);
      if (left <= 0) endRound();
    }, 1000);
  };

  const respawn = (id: string) => {
    const b = battle.get(id);
    const p = players.get(id);
    if (!b || !p || finished) return;
    const position = randomSpawn(id);
    p.position = position;
    p.moving = false;
    b.health = MAX_HEALTH;
    b.alive = true;
    b.ammo = MAGAZINE_SIZE;
    io.to(id).emit('battle:respawn', { id, position });
    io.to(id).emit('battle:self', { kills: b.kills, deaths: b.deaths, streak: b.streak, bestStreak: b.bestStreak, ammo: b.ammo, health: b.health, alive: b.alive, spawn: position });
    broadcastPlayers();
  };

  io.on('connection', (socket) => {
    socket.on('battle:join', () => {
      if (finished || startedAt === 0 || timeLeft() <= 0) startRound();
      if (!battle.has(socket.id)) {
        const p = players.get(socket.id);
        if (!p) return;
        const position = randomSpawn(socket.id);
        p.position = position;
        p.moving = false;
        battle.set(socket.id, { id: socket.id, health: MAX_HEALTH, alive: true, kills: 0, deaths: 0, streak: 0, bestStreak: 0, ammo: MAGAZINE_SIZE, lastShotAt: 0 });
      }
      sendState(socket.id);
      broadcastPlayers();
    });

    socket.on('battle:leave', () => {
      const b = battle.get(socket.id);
      if (b?.respawnTimer) clearTimeout(b.respawnTimer);
      battle.delete(socket.id);
      socket.emit('battle:players', publicPlayers());
      if (!battle.size && timer) {
        clearInterval(timer);
        timer = undefined;
        startedAt = 0;
        finished = false;
      }
      broadcastPlayers();
    });

    socket.on('battle:reload', () => {
      const b = battle.get(socket.id);
      if (!b || !b.alive || finished) return;
      b.ammo = MAGAZINE_SIZE;
      socket.emit('battle:self', { kills: b.kills, deaths: b.deaths, streak: b.streak, bestStreak: b.bestStreak, ammo: b.ammo, health: b.health, alive: b.alive });
      broadcastPlayers();
    });

    socket.on('battle:shoot', (data: { targetId?: string }) => {
      const shooter = battle.get(socket.id);
      const shooterPlayer = players.get(socket.id);
      if (!shooter || !shooterPlayer || !shooter.alive || finished) return;
      const now = Date.now();
      if (now - shooter.lastShotAt < FIRE_COOLDOWN_MS) return;
      if (shooter.ammo <= 0) {
        socket.emit('battle:error', 'OUT OF AMMO — press R to reload');
        return;
      }
      shooter.lastShotAt = now;
      shooter.ammo -= 1;

      const targetId = String(data?.targetId || '');
      const target = targetId ? battle.get(targetId) : undefined;
      const targetPlayer = targetId ? players.get(targetId) : undefined;
      const distance = targetPlayer ? Math.hypot(targetPlayer.position[0] - shooterPlayer.position[0], targetPlayer.position[2] - shooterPlayer.position[2]) : Infinity;
      const validHit = !!target && !!targetPlayer && targetId !== socket.id && target.alive && distance <= MAX_SHOT_DISTANCE;

      if (!validHit) {
        socket.emit('battle:self', { kills: shooter.kills, deaths: shooter.deaths, streak: shooter.streak, bestStreak: shooter.bestStreak, ammo: shooter.ammo, health: shooter.health, alive: shooter.alive });
        return;
      }

      target!.health = Math.max(0, target!.health - DAMAGE);
      socket.emit('battle:hit');

      if (target!.health <= 0) {
        target!.alive = false;
        target!.deaths += 1;
        target!.streak = 0;
        shooter.kills += 1;
        shooter.streak += 1;
        shooter.bestStreak = Math.max(shooter.bestStreak, shooter.streak);
        const killerName = shooterPlayer.name;
        const victimName = targetPlayer!.name;
        io.emit('battle:kill', { killerName, victimName, victimId: targetId });
        io.emit('battle:self', { kills: shooter.kills, deaths: shooter.deaths, streak: shooter.streak, bestStreak: shooter.bestStreak, ammo: shooter.ammo, health: shooter.health, alive: shooter.alive });
        io.to(targetId).emit('battle:self', { kills: target!.kills, deaths: target!.deaths, streak: target!.streak, bestStreak: target!.bestStreak, ammo: 0, health: 0, alive: false });
        broadcastPlayers();
        target!.respawnTimer = setTimeout(() => respawn(targetId), RESPAWN_MS);
      } else {
        io.to(targetId).emit('battle:self', { kills: target!.kills, deaths: target!.deaths, streak: target!.streak, bestStreak: target!.bestStreak, ammo: target!.ammo, health: target!.health, alive: target!.alive });
        socket.emit('battle:self', { kills: shooter.kills, deaths: shooter.deaths, streak: shooter.streak, bestStreak: shooter.bestStreak, ammo: shooter.ammo, health: shooter.health, alive: shooter.alive });
        broadcastPlayers();
      }
    });

    socket.on('disconnect', () => {
      const b = battle.get(socket.id);
      if (b?.respawnTimer) clearTimeout(b.respawnTimer);
      battle.delete(socket.id);
      broadcastPlayers();
    });
  });
}
