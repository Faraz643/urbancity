import { useEffect, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { HuntSpawnPoint } from "../../../types/hunt";

const DEFAULT_POINTS: HuntSpawnPoint[] = [
  { position: [-28, 0.9, -18] },
  { position: [24, 0.9, -22] },
  { position: [-18, 0.9, 18] },
  { position: [30, 0.9, 16] },
  { position: [0, 0.9, -32] },
  { position: [0, 0.9, 30] },
  { position: [-38, 0.9, 4] },
  { position: [38, 0.9, -4] },
];

function pickPoint(player?: THREE.Vector3) {
  const candidates = DEFAULT_POINTS.filter((p) => {
    if (!player) return true;
    return Math.hypot(p.position[0] - player.x, p.position[2] - player.z) > 12;
  });
  return (candidates[Math.floor(Math.random() * candidates.length)] || DEFAULT_POINTS[0]).position;
}

export default function HuntTarget({
  playerPosition,
  onShoot,
}: {
  playerPosition?: THREE.Vector3;
  onShoot: (hit: boolean) => void;
}) {
  const [position, setPosition] = useState<[number, number, number]>(() => pickPoint(playerPosition));
  const [destination, setDestination] = useState<[number, number, number]>(() => pickPoint(playerPosition));

  useEffect(() => {
    const id = window.setInterval(() => {
      setDestination(pickPoint(playerPosition));
    }, 2200);
    return () => window.clearInterval(id);
  }, [playerPosition?.x, playerPosition?.z]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPosition((p) => [
        p[0] + (destination[0] - p[0]) * 0.08,
        p[1],
        p[2] + (destination[2] - p[2]) * 0.08,
      ]);
    }, 80);
    return () => window.clearInterval(id);
  }, [destination]);

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onShoot(true);
      }}
    >
      <group userData={{ huntTarget: true }}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <capsuleGeometry args={[0.22, 0.65, 6, 10]} />
          <meshStandardMaterial />
        </mesh>
        <mesh position={[0, 1.32, 0]} castShadow>
          <sphereGeometry args={[0.27, 16, 12]} />
          <meshStandardMaterial />
        </mesh>
        <mesh position={[-0.11, 0.28, 0]} castShadow>
          <boxGeometry args={[0.11, 0.5, 0.12]} />
          <meshStandardMaterial />
        </mesh>
        <mesh position={[0.11, 0.28, 0]} castShadow>
          <boxGeometry args={[0.11, 0.5, 0.12]} />
          <meshStandardMaterial />
        </mesh>
        <mesh position={[0.31, 0.88, -0.05]} rotation={[0, 0, -0.7]} castShadow>
          <boxGeometry args={[0.1, 0.48, 0.1]} />
          <meshStandardMaterial />
        </mesh>
      </group>
      <Html position={[0, 1.75, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <div style={{ padding: "4px 7px", borderRadius: 999, background: "rgba(0,0,0,.7)", color: "white", fontSize: 10, whiteSpace: "nowrap" }}>
          TARGET
        </div>
      </Html>
    </group>
  );
}
