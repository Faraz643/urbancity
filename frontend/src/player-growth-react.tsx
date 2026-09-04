import { ReactNode, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

export function clampPlayerHeight(height: number) {
  return THREE.MathUtils.clamp(
    Number(height) || PLAYER_BASE_HEIGHT,
    PLAYER_BASE_HEIGHT,
    PLAYER_MAX_HEIGHT
  );
}

export function playerScaleFromHeight(height: number) {
  return clampPlayerHeight(height) / PLAYER_BASE_HEIGHT;
}

/**
 * Visual growth only. The group's origin remains the foot anchor, so the
 * existing Rapier collider/physics are not changed by visual scaling.
 */
export function GrowingPlayerAvatar({
  height,
  children,
}: {
  height: number;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const currentScale = useRef(1);

  useFrame((_, dt) => {
    if (!ref.current) return;

    const targetScale = playerScaleFromHeight(height);
    currentScale.current = THREE.MathUtils.damp(
      currentScale.current,
      targetScale,
      7,
      dt
    );

    const s = currentScale.current;
    ref.current.scale.setScalar(s);

    // Preserve the established foot-on-floor compensation.
    ref.current.position.y = (s - 1) * 1.208;

    // Keep the existing camera/player bridge available to GameCamera without
    // making this component control camera rotation or call lookAt every frame.
    (window as any).__urbanPlayerHeight = clampPlayerHeight(height);
    (window as any).__urbanPlayerScale = s;
  });

  return <group ref={ref}>{children}</group>;
}

/** Height-aware, camera-facing name tag. */
export function GrowthNameTag({
  name,
  height,
  local = false,
}: {
  name: string;
  height: number;
  local?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const currentScale = useRef(1);

  useFrame((state, dt) => {
    if (!ref.current) return;

    const s = playerScaleFromHeight(height);

    // Grow the text enough to remain readable for taller players, but cap it.
    const tagScale = THREE.MathUtils.clamp(
      1 + Math.log2(Math.max(1, s)) * 0.30,
      1,
      2.6
    );

    currentScale.current = THREE.MathUtils.damp(
      currentScale.current,
      tagScale,
      8,
      dt
    );

    ref.current.scale.setScalar(currentScale.current);

    // This uses the same scale source as the avatar. The tag therefore rises
    // with the head instead of remaining at its original 1.85m position.
    ref.current.position.y = 2.02 * s + 0.28 * Math.min(s, 8);

    // Billboard orientation without modifying the camera's position/rotation.
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
