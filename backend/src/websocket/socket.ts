import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

interface Player {
  id: string;
  socketId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  movementState: 'idle' | 'walking';
  displayName: string;
  isAnonymous: boolean;
  connectedAt: number;
}

interface BillboardZone {
  id: string;
  position: { x: number; y: number; z: number };
  radius: number;
}

const players = new Map<string, Player>();
const billboardZones = new Map<string, BillboardZone>();

// Interest management - track which players are near which billboards
const playerBillboardProximity = new Map<string, Set<string>>();

export function setupWebSocket(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  console.log('🔌 WebSocket server initialized');

  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Generate anonymous player ID
    const playerId = `anon_${Math.random().toString(36).substring(2, 10)}`;

    const player: Player = {
      id: playerId,
      socketId: socket.id,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      movementState: 'idle',
      displayName: `Visitor ${Math.floor(Math.random() * 9999)}`,
      isAnonymous: true,
      connectedAt: Date.now(),
    };

    players.set(socket.id, player);
    playerBillboardProximity.set(socket.id, new Set());

    // Send current online count to all
    io.emit('playerCount', players.size);

    // Send current players to new player (excluding self)
    const otherPlayers = Array.from(players.values())
      .filter(p => p.socketId !== socket.id)
      .map(p => ({
        id: p.id,
        position: p.position,
        rotation: p.rotation,
        movementState: p.movementState,
        displayName: p.displayName,
      }));

    socket.emit('initPlayers', otherPlayers);
    socket.emit('playerId', playerId);

    // Handle player spawn
    socket.on('playerSpawn', (data) => {
      const p = players.get(socket.id);
      if (p) {
        p.position = data.position || { x: 0, y: 0, z: 0 };
        p.rotation = data.rotation || { x: 0, y: 0, z: 0 };
        p.displayName = data.displayName || p.displayName;
        p.isAnonymous = data.isAnonymous ?? true;

        // Broadcast to nearby players (interest management)
        broadcastToNearby(socket.id, p.position, 'playerJoined', {
          id: p.id,
          position: p.position,
          rotation: p.rotation,
          displayName: p.displayName,
        });
      }
    });

    // Handle player movement
    socket.on('playerMove', (data) => {
      const p = players.get(socket.id);
      if (!p) return;

      p.position = data.position;
      p.rotation = data.rotation;
      p.movementState = data.movementState || 'idle';

      // Interest management: only broadcast to nearby players
      broadcastToNearby(socket.id, p.position, 'playerMoved', {
        id: p.id,
        position: p.position,
        rotation: p.rotation,
        movementState: p.movementState,
      });

      // Update billboard proximity
      updateBillboardProximity(socket.id, p.position, io);
    });

    // Handle billboard interaction
    socket.on('billboardInteract', (data) => {
      const { billboardId } = data;
      // Broadcast to all that someone is interacting with a billboard
      io.emit('billboardInteraction', {
        playerId: players.get(socket.id)?.id,
        billboardId,
        timestamp: Date.now(),
      });
    });

    // Handle bid placed
    socket.on('bidPlaced', (data) => {
      io.emit('bidUpdate', data);
    });

    // Handle authentication
    socket.on('authenticate', (data) => {
      const p = players.get(socket.id);
      if (p && data.userId) {
        p.id = data.userId;
        p.displayName = data.displayName || p.displayName;
        p.isAnonymous = false;

        socket.emit('authenticated', {
          id: p.id,
          displayName: p.displayName,
        });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      const p = players.get(socket.id);
      if (p) {
        broadcastToNearby(socket.id, p.position, 'playerLeft', { id: p.id });
        players.delete(socket.id);
        playerBillboardProximity.delete(socket.id);
        io.emit('playerCount', players.size);
      }
      console.log(`Player disconnected: ${socket.id}`);
    });
  });

  // Helper function for interest-based broadcasting
  function broadcastToNearby(
    senderSocketId: string,
    position: { x: number; y: number; z: number },
    event: string,
    data: any
  ) {
    const INTEREST_RADIUS = 100; // Units

    players.forEach((p, socketId) => {
      if (socketId === senderSocketId) return;

      const distance = Math.sqrt(
        Math.pow(p.position.x - position.x, 2) +
        Math.pow(p.position.y - position.y, 2) +
        Math.pow(p.position.z - position.z, 2)
      );

      if (distance <= INTEREST_RADIUS) {
        io.to(socketId).emit(event, data);
      }
    });
  }

  // Update billboard proximity tracking
  function updateBillboardProximity(
    socketId: string,
    position: { x: number; y: number; z: number },
    io: SocketServer
  ) {
    const nearby = playerBillboardProximity.get(socketId);
    if (!nearby) return;

    billboardZones.forEach((zone, billboardId) => {
      const distance = Math.sqrt(
        Math.pow(zone.position.x - position.x, 2) +
        Math.pow(zone.position.y - position.y, 2) +
        Math.pow(zone.position.z - position.z, 2)
      );

      const wasNearby = nearby.has(billboardId);
      const isNearby = distance <= zone.radius;

      if (isNearby && !wasNearby) {
        nearby.add(billboardId);
        io.emit('billboardVisitorUpdate', {
          billboardId,
          nearbyVisitors: getNearbyVisitorCount(billboardId),
        });
      } else if (!isNearby && wasNearby) {
        nearby.delete(billboardId);
        io.emit('billboardVisitorUpdate', {
          billboardId,
          nearbyVisitors: getNearbyVisitorCount(billboardId),
        });
      }
    });
  }

  function getNearbyVisitorCount(billboardId: string): number {
    let count = 0;
    playerBillboardProximity.forEach((nearby) => {
      if (nearby.has(billboardId)) count++;
    });
    return count;
  }

  // Register billboard zones (called when billboards are created)
  return {
    registerBillboard: (id: string, position: { x: number; y: number; z: number }, radius: number) => {
      billboardZones.set(id, { id, position, radius });
    },
    unregisterBillboard: (id: string) => {
      billboardZones.delete(id);
    },
    getOnlineCount: () => players.size,
    getPlayers: () => Array.from(players.values()),
  };
}
