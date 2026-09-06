import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';
import type { RemotePlayer } from '../../types/player';
import { PlayerAvatar } from './PlayerAvatar';

function RemoteAvatar({ p }: { p: RemotePlayer }) {
  const ref = useRef<THREE.Group>(null!);
  const moving = useRef(false);
  const lastPosition = useRef(new THREE.Vector3(...p.position));
  const animation = useRef(0);

  useFrame((_, dt) => {
    const next = new THREE.Vector3(...p.position);
    const before = ref.current.position.clone();
    ref.current.position.lerp(next, 1 - Math.pow(0.001, dt));
    moving.current = before.distanceTo(next) > 0.02;
    ref.current.rotation.y = THREE.MathUtils.lerp(
      ref.current.rotation.y,
      p.rotation,
      Math.min(1, dt * 10),
    );
    animation.current += dt * (moving.current ? 8 : 2.2);
    lastPosition.current.copy(next);
  });

  return (
    <group ref={ref} position={p.position}>
      <PlayerAvatar moving={moving.current} />
      <Text
        position={[0, 1.85, 0]}
        fontSize={0.25}
        color="white"
        anchorX="center"
        outlineWidth={0.015}
        outlineColor="#07111e"
      >
        {p.name}
      </Text>
    </group>
  );
}

export function RemotePlayers({ players }: { players: RemotePlayer[] }) {
  return <>{players.map((p) => <RemoteAvatar key={p.id} p={p} />)}</>;
}

export { RemoteAvatar };
