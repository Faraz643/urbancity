import { ReactNode, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

// Visual-only growth. Rapier continues to use the normal player collider.
// The wrapper scales around the avatar's existing origin and compensates its
// Y position so the measured foot anchor stays on the same floor plane.
export function GrowingPlayerAvatar({ height, children }:{height:number;children:ReactNode}) {
  const ref = useRef<THREE.Group>(null);
  const current = useRef(1);

  useFrame((_, dt) => {
    const safeHeight = THREE.MathUtils.clamp(
      Number(height) || PLAYER_BASE_HEIGHT,
      PLAYER_BASE_HEIGHT,
      PLAYER_MAX_HEIGHT,
    );
    const targetScale = safeHeight / PLAYER_BASE_HEIGHT;
    current.current = THREE.MathUtils.damp(current.current, targetScale, 8, dt);

    const s = current.current;
    if (!ref.current) return;

    ref.current.scale.setScalar(s);
    ref.current.position.y = (s - 1) * 1.208;
  });

  return <group ref={ref}>{children}</group>;
}

export function growthLabelY(height:number) {
  const s = THREE.MathUtils.clamp(
    Number(height) || PLAYER_BASE_HEIGHT,
    PLAYER_BASE_HEIGHT,
    PLAYER_MAX_HEIGHT,
  ) / PLAYER_BASE_HEIGHT;
  return (s - 1) * 1.208 + 1.85 * s;
}
