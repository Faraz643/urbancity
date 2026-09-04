import { ReactNode, useFrame, useRef } from 'react';
import * as THREE from 'three';

export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

// Growth is visual only. The Rapier body remains the normal player size, so
// increasing advertising-player height cannot change collision or movement.
// The wrapper's local Y offset compensates for the avatar's feet anchor, making
// the soles stay on the same ground plane while the character grows upward.
export function GrowingPlayerAvatar({ height, children }:{height:number;children:ReactNode}) {
  const ref = useRef<THREE.Group>(null!);
  const current = useRef(1);
  useFrame((_, dt) => {
    const safeHeight = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT);
    const targetScale = safeHeight / PLAYER_BASE_HEIGHT;
    current.current = THREE.MathUtils.damp(current.current, targetScale, 10, dt);
    const s = current.current;
    if (ref.current) {
      // PlayerAvatar's existing geometry places the lowest foot about 1.208
      // units below its local origin. Move the scaled wrapper up by the same
      // amount that scaling would otherwise move the feet down.
      ref.current.scale.setScalar(s);
      ref.current.position.y = (s - 1) * 1.208;
    }
  });
  return <group ref={ref}>{children}</group>;
}

export function growthLabelY(height:number) {
  const s = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT) / PLAYER_BASE_HEIGHT;
  return (s - 1) * 1.208 + 1.85 * s;
}
