import { ReactNode, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

/**
 * Visual-only growth. The Rapier collider stays unchanged.
 * The wrapper grows from the existing measured foot anchor, while the existing
 * sibling name tag is synchronized locally so no global scene traversal is needed.
 */
export function GrowingPlayerAvatar({ height, label, children }:{height:number;label?:string;children:ReactNode}) {
  const ref = useRef<THREE.Group>(null);
  const current = useRef(1);
  const { camera } = useThree();
  const playerWorld = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const safeHeight = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT);
    const targetScale = safeHeight / PLAYER_BASE_HEIGHT;
    current.current = THREE.MathUtils.damp(current.current, targetScale, 8, dt);
    const s = current.current;
    if (!ref.current) return;

    ref.current.scale.setScalar(s);
    ref.current.position.y = (s - 1) * 1.208;

    // The legacy App renders the name as a sibling of PlayerAvatar inside the
    // same RigidBody/group. Keep that tag attached to the growing presentation.
    const parent = ref.current.parent;
    if (parent) {
      const sibling = parent.children.find((child:any) => child !== ref.current && child.type === 'Text') as THREE.Object3D | undefined;
      if (sibling) {
        const tagScale = THREE.MathUtils.clamp(1 + (s - 1) * 0.08, 1, 1.8);
        sibling.position.y = (s - 1) * 1.208 + 1.85 * s;
        sibling.scale.setScalar(tagScale);
      }
    }

    // Local-player-only camera assist. The existing orbit controller keeps the
    // player's yaw/pitch; this layer prevents floor clipping and gives taller
    // players enough framing distance.
    const localPlayer = label === 'You' || (!label && parent?.children.some((child:any) => child !== ref.current && child.type === 'Text' && child.text === 'You'));
    if (localPlayer) {
      ref.current.getWorldPosition(playerWorld.current);
      const minDistance = 6 + Math.sqrt(safeHeight) * 2;
      const dx = camera.position.x - playerWorld.current.x;
      const dz = camera.position.z - playerWorld.current.z;
      const horizontalDistance = Math.hypot(dx, dz);
      if (horizontalDistance > 0.001 && horizontalDistance < minDistance) {
        const k = minDistance / horizontalDistance;
        camera.position.x = playerWorld.current.x + dx * k;
        camera.position.z = playerWorld.current.z + dz * k;
      }

      camera.position.y = Math.max(1.25, camera.position.y);

      // Track the upper body as the player grows, but cap the target so a very
      // tall player still keeps a useful view of the surrounding city.
      const targetY = THREE.MathUtils.clamp(1.9 + safeHeight * 0.62, 3.1, 18);
      target.current.set(playerWorld.current.x, targetY, playerWorld.current.z);
      camera.lookAt(target.current);
    }
  });

  return <group ref={ref}>{children}</group>;
}

export function growthLabelY(height:number) {
  const s = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT) / PLAYER_BASE_HEIGHT;
  return (s - 1) * 1.208 + 1.85 * s;
}
