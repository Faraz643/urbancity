import { ReactNode, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

export function clampPlayerHeight(height: number) {
  return THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT);
}

export function playerScaleFromHeight(height: number) {
  return clampPlayerHeight(height) / PLAYER_BASE_HEIGHT;
}

/**
 * Visual-only growth wrapper. Its origin is the avatar foot anchor, so scaling
 * changes visual size without changing the Rapier body/collider.
 */
export function GrowingPlayerAvatar({ height, children }: { height: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const currentScale = useRef(1);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const targetScale = playerScaleFromHeight(height);
    currentScale.current = THREE.MathUtils.damp(currentScale.current, targetScale, 7, dt);
    const s = currentScale.current;

    ref.current.scale.setScalar(s);
    // This compensates for PlayerAvatar's existing -1.12 local visual offset.
    // The feet therefore stay on the same world-space floor while the body grows upward.
    ref.current.position.y = (s - 1) * 1.208;

    // Shared debug/runtime state. App's camera can consume this without another
    // growth polling script or a second Three.js scene traversal system.
    (window as any).__urbanPlayerHeight = clampPlayerHeight(height);
    (window as any).__urbanPlayerScale = s;
  });

  return <group ref={ref}>{children}</group>;
}

/** Camera-facing, depth-independent player name tag. */
export function GrowthNameTag({ name, height, local = false }: { name: string; height: number; local?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const currentScale = useRef(1);

  useFrame((state, dt) => {
    if (!ref.current) return;
    const s = playerScaleFromHeight(height);
    const tagScale = THREE.MathUtils.clamp(1 + Math.log2(Math.max(1, s)) * 0.30, 1, 2.6);
    currentScale.current = THREE.MathUtils.damp(currentScale.current, tagScale, 8, dt);
    ref.current.scale.setScalar(currentScale.current);

    // The tag follows the actual visual growth curve and is deliberately kept
    // above the head rather than using a fixed world-space Y position.
    ref.current.position.y = 2.02 * s + 0.28 * Math.min(s, 8);

    // Camera-facing billboard without forcing camera.lookAt or otherwise
    // interfering with the game's existing camera controller.
    ref.current.quaternion.copy(state.camera.quaternion);
  });

  return (
    <group ref={ref} renderOrder={1000}>
      <Text
        fontSize={0.34}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.025}
        outlineColor="black"
        depthTest={false}
        depthWrite={false}
        renderOrder={1000}
      >
        {name || (local ? 'You' : 'Player')}
      </Text>
    </group>
  );
}

export function growthLabelY(height: number) {
  const s = playerScaleFromHeight(height);
  return 2.02 * s + 0.28 * Math.min(s, 8);
}
