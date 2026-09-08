import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';
import type { RemotePlayer } from '../../types/player';
import type { BattlePlayer } from '../../types/battle';
import { PlayerAvatar } from './PlayerAvatar';

function RemoteAvatar({ p, battle = false, onShoot }: { p: RemotePlayer | BattlePlayer; battle?: boolean; onShoot?: (id: string) => void }) {
  const ref = useRef<THREE.Group>(null!);
  const moving = useRef(false);
  const lastPosition = useRef(new THREE.Vector3(...p.position));

  useFrame((_, dt) => {
    const next = new THREE.Vector3(...p.position);
    const before = ref.current.position.clone();
    ref.current.position.lerp(next, 1 - Math.pow(0.001, dt));
    moving.current = before.distanceTo(next) > 0.02;
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, p.rotation, Math.min(1, dt * 10));
    lastPosition.current.copy(next);
  });

  const alive = battle ? (p as BattlePlayer).alive : true;
  if (battle && !alive) return null;

  return (
    <group
      ref={ref}
      position={p.position}
      userData={{ battlePlayerId: battle ? p.id : undefined }}
      onPointerDown={battle && onShoot ? (e) => { e.stopPropagation(); onShoot(p.id); } : undefined}
    >
      <PlayerAvatar moving={moving.current} />
      {battle && <group position={[0, 1.15, 0]}>
        <mesh position={[0, 0.18, 0]}><planeGeometry args={[0.9, 0.09]} /><meshBasicMaterial color="#111" /></mesh>
        <mesh position={[-0.45 + Math.max(0, Math.min(1, (p as BattlePlayer).health / 100)) * 0.45, 0.18, 0.001]} scale={[Math.max(0.01, Math.min(1, (p as BattlePlayer).health / 100)), 1, 1]}><planeGeometry args={[0.9, 0.07]} /><meshBasicMaterial color={(p as BattlePlayer).health > 35 ? "#32e58a" : "#ff4d4d"} /></mesh>
      </group>}
      <Text position={[0, 2.0, 0]} fontSize={0.22} color="white" anchorX="center" outlineWidth={0.015} outlineColor="#07111e">
        {p.name}
      </Text>
    </group>
  );
}

export function RemotePlayers({ players, battle = false, onShoot }: { players: RemotePlayer[] | BattlePlayer[]; battle?: boolean; onShoot?: (id: string) => void }) {
  return <>{players.map((p) => <RemoteAvatar key={p.id} p={p} battle={battle} onShoot={onShoot} />)}</>;
}

export { RemoteAvatar };
