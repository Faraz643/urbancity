import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense } from 'react';
import type { Billboard } from '../../types/billboard';
import type { RemotePlayer } from '../../types/player';
import { MAP_BILLBOARDS } from '../../lib/mapBillboards';
import { City, type TimeMode } from './City';
import { GameCamera } from './GameCamera';
import { Player } from './Player';
import { BillboardPad } from './BillboardPad';
import { BillboardMesh } from './BillboardMesh';
import { RemotePlayers } from './RemotePlayers';

type BidderInfo = {
  name: string;
  amount: number;
  siteUrl?: string;
  imageUrl?: string;
  description?: string;
};

type PlayerMoveState = {
  position: [number, number, number];
  rotation: number;
  moving: boolean;
};

type WorldProps = {
  setNearby: (b: Billboard | null) => void;
  players: RemotePlayer[];
  setSelected: (b: Billboard) => void;
  onMove: (state: PlayerMoveState) => void;
  onFootfallEnter: (id: string) => void;
  onFootfallLeave: (id: string) => void;
  timeMode: TimeMode;
  visitorStats: Record<string, number>;
  onLocalPosition: (p: [number, number, number]) => void;
  bidders: Record<string, BidderInfo>;
};

export function World({
  setNearby,
  players,
  setSelected,
  onMove,
  onFootfallEnter,
  onFootfallLeave,
  timeMode,
  visitorStats,
  onLocalPosition,
  bidders,
}: WorldProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [10, 9, 21], fov: 55 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))}
    >
      <Suspense fallback={null}>
        <GameCamera />
        <Physics gravity={[0, -20, 0]}>
          <City timeMode={timeMode} billboards={MAP_BILLBOARDS} />
          <Player
            billboards={MAP_BILLBOARDS}
            onNearby={setNearby}
            onMove={onMove}
            onPosition={onLocalPosition}
            onFootfallEnter={onFootfallEnter}
            onFootfallLeave={onFootfallLeave}
          />
          {MAP_BILLBOARDS.map((b) => (
            <group key={b.id}>
              <BillboardPad b={b} />
              <BillboardMesh
                b={b}
                onSelect={setSelected}
                nearCount={visitorStats[b.id] ?? 0}
                totalVisitors={players.length + 1}
                bidder={bidders[b.id]}
              />
            </group>
          ))}
          <RemotePlayers players={players} />
        </Physics>
      </Suspense>
    </Canvas>
  );
}
