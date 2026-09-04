import { ReactNode, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

export function GrowingPlayerAvatar({ height, label, children }:{height:number;label?:string;children:ReactNode}) {
  const ref = useRef<THREE.Group>(null);
  const current = useRef(1);

  useFrame((state, dt) => {
    const safeHeight = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT);
    const targetScale = safeHeight / PLAYER_BASE_HEIGHT;
    current.current = THREE.MathUtils.damp(current.current, targetScale, 7, dt);
    const s = current.current;
    if (!ref.current) return;

    // Scale around the measured foot anchor so the soles remain on the ground.
    ref.current.scale.setScalar(s);
    ref.current.position.y = (s - 1) * 1.208;

    const parent = ref.current.parent;
    if (parent) {
      // Drei Text is not guaranteed to have Object3D.type === 'Text'. Find the
      // actual sibling carrying a text string instead.
      const sibling = parent.children.find((child:any) =>
        child !== ref.current && typeof child?.text === 'string'
      ) as THREE.Object3D | undefined;

      if (sibling) {
        // Label is a sibling of the growing wrapper, therefore its position is
        // calculated directly in the player's parent coordinate system.
        sibling.position.y = 1.85 * s + 0.12 * Math.min(s, 8);
        const tagScale = THREE.MathUtils.clamp(1 + Math.log2(Math.max(1, s)) * 0.32, 1, 2.6);
        sibling.scale.setScalar(tagScale);
      }
    }

    // Do not call camera.lookAt here. That fights the game's existing orbit
    // controls. Only enforce a minimum camera height and a bounded pull-back.
    const localPlayer = label === 'You' || (!label && parent?.children.some((child:any) => child !== ref.current && child?.text === 'You'));
    if (localPlayer) {
      const camera = state.camera;
      const player = ref.current.getWorldPosition(new THREE.Vector3());
      const dx = camera.position.x - player.x;
      const dz = camera.position.z - player.z;
      const horizontal = Math.hypot(dx, dz);
      const requiredDistance = THREE.MathUtils.clamp(7 + Math.sqrt(safeHeight) * 2.4, 8, 22);
      if (horizontal > 0.001 && horizontal < requiredDistance) {
        const nextHorizontal = THREE.MathUtils.damp(horizontal, requiredDistance, 5, dt);
        const ratio = nextHorizontal / horizontal;
        camera.position.x = player.x + dx * ratio;
        camera.position.z = player.z + dz * ratio;
      }
      if (camera.position.y < 1.35) camera.position.y = 1.35;
    }
  });

  return <group ref={ref}>{children}</group>;
}

export function growthLabelY(height:number) {
  const s = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT) / PLAYER_BASE_HEIGHT;
  return 1.85 * s + 0.12 * Math.min(s, 8);
}
