import { ReactNode, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

export function GrowingPlayerAvatar({ height, label, children }:{height:number;label?:string;children:ReactNode}) {
  const ref = useRef<THREE.Group>(null);
  const labelRef = useRef<THREE.Group>(null);
  const current = useRef(1);
  const { camera } = useThree();
  const playerWorld = useRef(new THREE.Vector3());

  useFrame(() => {
    const safeHeight = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT);
    const targetScale = safeHeight / PLAYER_BASE_HEIGHT;
    current.current = THREE.MathUtils.damp(current.current, targetScale, 8, 1 / 60);
    const s = current.current;
    if (!ref.current) return;

    ref.current.scale.setScalar(s);
    ref.current.position.y = (s - 1) * 1.208;

    // The tag is inside the same presentation hierarchy as the avatar, but its
    // inverse parent scale keeps it readable. It grows gradually up to 2.4x.
    if (labelRef.current) {
      const tagScale = THREE.MathUtils.clamp(1 + (s - 1) * 0.16, 1, 2.4);
      labelRef.current.scale.setScalar(tagScale / s);
      labelRef.current.position.set(0, 1.85, 0);
    }

    // Only the local player's presentation is allowed to influence the camera.
    // The existing camera controller still owns orbit/yaw/pitch; this layer only
    // enforces professional framing constraints after it has positioned the camera.
    if (label === 'You') {
      ref.current.getWorldPosition(playerWorld.current);
      const minDistance = 6 + Math.sqrt(safeHeight) * 2;
      const dx = camera.position.x - playerWorld.current.x;
      const dz = camera.position.z - playerWorld.current.z;
      const horizontalDistance = Math.hypot(dx, dz);
      if (horizontalDistance > 0.001 && horizontalDistance < minDistance) {
        const k = minDistance / horizontalDistance;
        camera.position.x = playerWorld.current.x + dx * k;
        camera.position.z = playerWorld.current.z + dz * k;
      }

      // Never allow an orbit to place the camera under the city floor.
      camera.position.y = Math.max(1.25, camera.position.y);
    }
  });

  return <group ref={ref}>
    {children}
    {label && <group ref={labelRef}>
      <Text position={[0,1.85,0]} fontSize={0.28} color="white" anchorX="center" anchorY="middle" outlineWidth={0.018} outlineColor="#07111e">{label}</Text>
    </group>}
  </group>;
}

export function growthLabelY(height:number) {
  const s = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT) / PLAYER_BASE_HEIGHT;
  return (s - 1) * 1.208 + 1.85 * s;
}
