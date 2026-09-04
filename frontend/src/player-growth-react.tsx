import { ReactNode, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

/** Visual growth is deliberately separate from Rapier physics. */
export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

export function clampPlayerHeight(height: number) {
  const value = Number.isFinite(height) ? height : PLAYER_BASE_HEIGHT;
  return THREE.MathUtils.clamp(value, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT);
}

export function playerScaleFromHeight(height: number) {
  return clampPlayerHeight(height) / PLAYER_BASE_HEIGHT;
}

/**
 * Smoothly scales the avatar. The avatar mesh is centered around its body,
 * so the group is lifted by half of the added visual height. This keeps the
 * feet planted instead of letting them sink through the floor.
 */
export function GrowingPlayerAvatar({ height, children }: { height: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const scale = useRef(1);

  useFrame((_, dt) => {
    if (!group.current) return;
    const targetScale = playerScaleFromHeight(height);
    scale.current = THREE.MathUtils.damp(scale.current, targetScale, 3.5, dt);
    group.current.scale.setScalar(scale.current);

    // PlayerAvatar's visual center is approximately 1.2m above its feet.
    // Compensate for scaling around that center so the bottom stays on the floor.
    const visualHalfHeight = 1.208;
    group.current.position.y = (scale.current - 1) * visualHalfHeight;
  });

  return <group ref={group}>{children}</group>;
}

/** Name tag rises with the head and grows gradually, with a readability cap. */
export function GrowthNameTag({ name, height }: { name: string; height: number }) {
  const group = useRef<THREE.Group>(null);
  const scale = useRef(1);

  useFrame(({ camera }, dt) => {
    if (!group.current) return;
    const playerScale = playerScaleFromHeight(height);
    const targetScale = THREE.MathUtils.clamp(
      1 + Math.log2(Math.max(1, playerScale)) * 0.28,
      1,
      2.5,
    );
    scale.current = THREE.MathUtils.damp(scale.current, targetScale, 5, dt);
    group.current.scale.setScalar(scale.current);

    // Keep the label above the head without letting it drift excessively far away.
    group.current.position.y = 2.05 * playerScale + 0.22 * Math.min(playerScale, 8);
    group.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={group} renderOrder={1000}>
      <Text
        fontSize={0.28}
        color="white"
        anchorX="center"
        anchorY="middle"
        depthOffset={-10}
        renderOrder={1000}
      >
        {name}
      </Text>
    </group>
  );
}

/**
 * Slow continuous progression: 0.1 height units every 10 seconds
 * (0.01 units/second), rather than jumping by a full unit.
 */
export function playerHeightFromSession(startedAtMs: number, nowMs = Date.now(), intervalSeconds = 10) {
  const elapsedSeconds = Math.max(0, (nowMs - startedAtMs) / 1000);
  return clampPlayerHeight(PLAYER_BASE_HEIGHT + (elapsedSeconds / intervalSeconds) * 0.1);
}
