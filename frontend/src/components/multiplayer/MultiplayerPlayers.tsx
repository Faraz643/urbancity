import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/stores/gameStore';

export function MultiplayerPlayers() {
  const players = useGameStore((s) => s.players);
  const playerRefs = useRef<Map<string, THREE.Group>>(new Map());

  useFrame((_, delta) => {
    players.forEach((player, id) => {
      const group = playerRefs.current.get(id);
      if (group) {
        group.position.lerp(new THREE.Vector3(player.position.x, player.position.y, player.position.z), 10 * delta);
        group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, player.rotation.y, 10 * delta);
      }
    });
  });

  return (
    <>
      {Array.from(players.entries()).map(([id, player]) => (
        <group key={id} ref={(el) => { if (el) playerRefs.current.set(id, el); }}
          position={[player.position.x, player.position.y, player.position.z]} rotation={[0, player.rotation.y, 0]}>
          <mesh castShadow position={[0, 0, 0]}>
            <capsuleGeometry args={[0.5, 1.2, 4, 8]} />
            <meshStandardMaterial color="#10b981" roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.35, 8, 8]} />
            <meshStandardMaterial color="#fca5a5" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </>
  );
}
