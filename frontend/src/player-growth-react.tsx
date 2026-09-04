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
 * Smoothly scales an existing avatar while keeping its feet on y=0.
 * The child avatar is assumed to have its visual feet at its local origin.
 * No Rapier body, velocity, collider, or position is modified here.
 */
export function GrowingPlayerAvatar({ height, children }: { height: number; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const scale = useRef(1);

  useFrame((_, dt) => {
    if (!group.current) return;
    const s = playerScaleFromHeight(height);
    scale.current = THREE.MathUtils.damp(scale.current, s, 8, dt);
    group.current.scale.setScalar(scale.current);
    // The child avatar's feet are at local y=0, so no vertical translation is needed.
  });

  return <group ref={group}>{children}</group>;
}

/**
 * Name tag belongs to the same visual player hierarchy, but is intentionally
 * counter-scaled only by a capped amount so tall players remain readable.
 */
export function GrowthNameTag({ name, height }: { name: string; height: number }) {
  const group = useRef<THREE.Group>(null);
  const scale = useRef(1);

  useFrame(({ camera }, dt) => {
    if (!group.current) return;
    const playerScale = playerScaleFromHeight(height);
    const targetScale = THREE.MathUtils.clamp(
      1 + Math.log2(Math.max(1, playerScale)) * 0.34,
      1,
      2.8,
    );
    scale.current = THREE.MathUtils.damp(scale.current, targetScale, 9, dt);
    group.current.scale.setScalar(scale.current);
    // Keep the tag above the actual visual head. The formula grows sub-linearly
    // after the first few scale units so it doesn't disappear far above the player.
    group.current.position.y = 2.05 * playerScale + 0.32 * Math.min(playerScale, 8);
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

/** Height progression: 1 unit is added every interval seconds. */
export function playerHeightFromSession(startedAtMs: number, nowMs = Date.now(), intervalSeconds = 10) {
  const elapsedSeconds = Math.max(0, (nowMs - startedAtMs) / 1000);
  return clampPlayerHeight(PLAYER_BASE_HEIGHT + Math.floor(elapsedSeconds / intervalSeconds));
}
