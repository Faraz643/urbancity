import { ReactNode, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { clampPlayerHeight, playerScaleFromHeight, PLAYER_BASE_HEIGHT } from './player-growth';

export { PLAYER_BASE_HEIGHT };

/**
 * Visual-only growth wrapper. The Rapier body/collider remains at its normal
 * size; only the rendered avatar is scaled.
 */
export function GrowingPlayerAvatar({ height, children }: { height: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const scale = useRef(1);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const target = playerScaleFromHeight(height);
    scale.current = THREE.MathUtils.damp(scale.current, target, 7, dt);
    ref.current.scale.setScalar(scale.current);
    // PlayerAvatar's visual origin is below its head. This offset keeps the
    // bottom of the visual avatar planted while its upper body grows.
    ref.current.position.y = (scale.current - 1) * 1.208;
  });

  return <group ref={ref}>{children}</group>;
}

/** Name tag tracks the actual top of the growing visual avatar. */
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

    // PlayerAvatar is rendered from a -1.12 local Y origin. Its head reaches
    // approximately 2.2 units above that origin, while the growth wrapper
    // adds 1.208 units per scale step. Keep the label just above that point.
    const avatarTopY = 0.272 + 3.408 * playerScale;
    ref.current.position.y = avatarTopY + 0.34 + 0.06 * Math.min(playerScale, 8);
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
  return 0.272 + 3.408 * scale + 0.34 + 0.06 * Math.min(scale, 8);
}