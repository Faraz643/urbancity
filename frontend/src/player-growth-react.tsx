import { ReactNode, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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

export function GrowingPlayerAvatar({ height, children }: { height: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const currentScale = useRef(1);
  const { camera } = useThree();

  useFrame((state, dt) => {
    if (!ref.current) return;
    const safeHeight = clampPlayerHeight(height);
    const targetScale = safeHeight / PLAYER_BASE_HEIGHT;
    currentScale.current = THREE.MathUtils.damp(currentScale.current, targetScale, 7, dt);
    const s = currentScale.current;

    ref.current.scale.setScalar(s);
    ref.current.position.y = (s - 1) * 1.208;

    // Publish the same authoritative height/visual scale used by this component.
    // This is intentionally a passive bridge for the existing camera/player code;
    // it does not alter Rapier physics or search the Three.js scene.
    (window as any).__urbanPlayerHeight = safeHeight;
    (window as any).__urbanPlayerScale = s;

    // Non-invasive camera safety/framing assist. GameCamera remains responsible
    // for yaw/pitch/zoom; this only prevents a growing avatar from filling the
    // frame or allowing the camera to dip below the city floor.
    const player = (window as any).__urbanPlayerPosition as THREE.Vector3 | undefined;
    if (player) {
      const targetY = THREE.MathUtils.clamp(1.8 + safeHeight * 0.42, 3.1, 18.5);
      const target = new THREE.Vector3(player.x, targetY, player.z);
      const offset = camera.position.clone().sub(target);
      const horizontalDistance = Math.max(0.001, Math.hypot(offset.x, offset.z));
      const minDistance = THREE.MathUtils.clamp(8 + safeHeight * 0.28, 8, 20.5);

      if (horizontalDistance < minDistance) {
        const scale = minDistance / horizontalDistance;
        camera.position.x = target.x + offset.x * scale;
        camera.position.z = target.z + offset.z * scale;
      }

      // Ground safety: never allow the camera eye below the playable floor.
      camera.position.y = Math.max(1.15, camera.position.y);

      // For large players, gently bias the look target upward. This is only
      // applied once the avatar is tall enough that the normal 3.1m target would
      // frame the player badly.
      if (safeHeight > 5) {
        camera.lookAt(target);
      }
    }
  });

  return <group ref={ref}>{children}</group>;
}

/** Name tag intended to be rendered beside the same player presentation group. */
export function GrowthNameTag({ name, height, local = false }: { name: string; height: number; local?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const currentScale = useRef(1);

  useFrame((state, dt) => {
    if (!ref.current) return;
    const s = playerScaleFromHeight(height);
    const tagScale = THREE.MathUtils.clamp(1 + Math.log2(Math.max(1, s)) * 0.30, 1, 2.6);
    currentScale.current = THREE.MathUtils.damp(currentScale.current, tagScale, 8, dt);
    ref.current.scale.setScalar(currentScale.current);

    // Keep the tag above the visible head using the same height input as the avatar.
    ref.current.position.y = 2.02 * s + 0.28 * Math.min(s, 8);
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
