import { ReactNode, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

/** Visual-only growth wrapper. Feet stay planted while the avatar grows upward. */
export function GrowingPlayerAvatar({ height, label, children }: { height: number; label?: string; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const current = useRef(1);

  useFrame((state, dt) => {
    const safeHeight = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT);
    const targetScale = safeHeight / PLAYER_BASE_HEIGHT;
    current.current = THREE.MathUtils.damp(current.current, targetScale, 7, dt);
    const s = current.current;
    if (!ref.current) return;

    // The wrapper origin is at the avatar's original foot anchor. Scale around
    // that anchor and compensate the measured local foot offset so the soles
    // remain on the same world-space ground plane.
    ref.current.scale.setScalar(s);
    ref.current.position.y = (s - 1) * 1.208;
  });

  return <group ref={ref}>{children}</group>;
}

export function GrowthNameTag({ name, height, local = false }: { name: string; height: number; local?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const targetScale = useRef(1);

  useFrame((state, dt) => {
    if (!ref.current) return;
    const s = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT) / PLAYER_BASE_HEIGHT;
    // Keep the tag comfortably above the head and grow readability without
    // allowing a giant 44m player to create an enormous tag.
    const tagScale = THREE.MathUtils.clamp(1 + Math.log2(Math.max(1, s)) * 0.34, 1, 2.8);
    targetScale.current = THREE.MathUtils.damp(targetScale.current, tagScale, 8, dt);
    ref.current.scale.setScalar(targetScale.current);
    ref.current.position.y = 1.92 * s + 0.18 * Math.min(s, 8);

    // Billboard: face the camera while retaining the tag's world-space height.
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
  const s = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT) / PLAYER_BASE_HEIGHT;
  return 1.92 * s + 0.18 * Math.min(s, 8);
}
