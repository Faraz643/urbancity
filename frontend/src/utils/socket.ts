import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const API_URL = import.meta.env.VITE_API_URL || '';
    socket = io(API_URL, { transports: ['websocket'], autoConnect: true });

    socket.on('connect', () => {
      console.log('Connected to multiplayer server');
      const user = useAuthStore.getState().user;
      if (user) {
        socket?.emit('authenticate', { userId: user.id, displayName: user.displayName || user.username });
      }
    });

    socket.on('playerCount', (count: number) => useGameStore.getState().setOnlineCount(count));

    socket.on('initPlayers', (players) => {
      const map = new Map();
      players.forEach((p: any) => map.set(p.id, p));
      useGameStore.getState().setPlayers(map);
    });

    socket.on('playerJoined', (player) => useGameStore.getState().updatePlayer(player.id, player));
    socket.on('playerMoved', (player) => useGameStore.getState().updatePlayer(player.id, player));
    socket.on('playerLeft', ({ id }) => useGameStore.getState().removePlayer(id));

    socket.on('billboardVisitorUpdate', ({ billboardId, nearbyVisitors }) => {
      const current = useGameStore.getState().nearbyBillboards;
      const updated = new Map(current);
      updated.set(billboardId, nearbyVisitors);
      useGameStore.getState().setNearbyBillboards(updated);
    });

    socket.on('bidUpdate', (data) => console.log('Bid update:', data));
  }
  return socket;
}

export function disconnectSocket() { if (socket) { socket.disconnect(); socket = null; } }

export function emitPlayerMove(pos: { x: number; y: number; z: number }, rot: { x: number; y: number; z: number }, state: 'idle' | 'walking') {
  getSocket().emit('playerMove', { position: pos, rotation: rot, movementState: state });
}

export function emitPlayerSpawn(pos: { x: number; y: number; z: number }, name: string) {
  getSocket().emit('playerSpawn', { position: pos, displayName: name, isAnonymous: !useAuthStore.getState().isAuthenticated });
}

export function emitBillboardInteract(id: string) { getSocket().emit('billboardInteract', { billboardId: id }); }
