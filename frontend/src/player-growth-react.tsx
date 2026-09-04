import { ReactNode, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { clampPlayerHeight, playerScaleFromHeight, PLAYER_BASE_HEIGHT } from './player-growth';

export { PLAYER_BASE_HEIGHT };

/**
 * Visual-only growth wrapper. The Rapier body/collider must remain outside this
 * group and at its normal size; only the rendered avatar is scaled.
 */
export function GrowingPlayerAvatar({ height, children }: { height: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const scale = useRef(1);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const target = playerScaleFromHeight(height);
    scale.current = THREE.MathUtils.damp(scale.current, target, 7, dt);
    ref.current.scale.setScalar(scale.current);
    // PlayerAvatar's origin is at the feet. Move the visual group upward by
    // half of the added height so the feet remain planted on the floor.
    ref.current.position.y = (scale.current - 1) * 1.208;
  });

  return <group ref={ref}>{children}</group>;
}

/** Name tag that is part of the same visual player presentation. */
export function GrowthNameTag({ name, height }: { name: string; height: number }) {
  const ref = useRef<THREE.Group>(null);
  const scale = useRef(1);
  const { camera } = useThree();

  useFrame((_, dt) => {
    if (!ref.current) return;
    const safeHeight = clampPlayerHeight(height);
    const playerScale = safeHeight / PLAYER_BASE_HEIGHT;
    const targetScale = THREE.MathUtils.clamp(
      1 + Math.log2(Math.max(1, playerScale)) * 0.34,
      1,
      2.8
    );
    scale.current = THREE.MathUtils.damp(scale.current, targetScale, 8, dt);
    ref.current.scale.setScalar(scale.current);
    ref.current.position.y = 2.02 * playerScale + 0.28 * Math.min(playerScale, 8);
    ref.current.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={ref} renderOrder={1000}>
      <Text
        fontSize={0.28}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.018}
        outlineColor="#07111e"
        depthOffset={-10}
        renderOrder={1000}
      >
        {name}
      </Text>
    </group>
  );
}

export function growthLabelY(height: number) {
  const scale = playerScaleFromHeight(height);
  return 2.02 * scale + 0.28 * Math.min(scale, 8);
}
