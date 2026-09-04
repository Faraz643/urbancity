import { ReactNode, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export const PLAYER_BASE_HEIGHT = 2.8;
export const PLAYER_MAX_HEIGHT = 44;

export function GrowingPlayerAvatar({ height, label, children }:{height:number;label?:string;children:ReactNode}) {
  const ref = useRef<THREE.Group>(null);
  const labelRef = useRef<THREE.Group>(null);
  const current = useRef(1);

  useFrame((_, dt) => {
    const safeHeight = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT);
    const targetScale = safeHeight / PLAYER_BASE_HEIGHT;
    current.current = THREE.MathUtils.damp(current.current, targetScale, 8, dt);
    const s = current.current;
    if (!ref.current) return;

    ref.current.scale.setScalar(s);
    ref.current.position.y = (s - 1) * 1.208;

    if (labelRef.current) {
      const tagScale = THREE.MathUtils.clamp(1 + (s - 1) * 0.16, 1, 2.4);
      labelRef.current.scale.setScalar(tagScale / s);
      labelRef.current.position.set(0, 1.85, 0);
    }
  });

  return <group ref={ref}>
    {children}
    {label && <group ref={labelRef}>
      <Text position={[0,1.85,0]} fontSize={0.28} color="white" anchorX="center" anchorY="middle" outlineWidth={0.018} outlineColor="#07111e">{label}</Text>
    </group>}
  </group>;
}

export function growthLabelY(height:number) {
  const s = THREE.MathUtils.clamp(Number(height) || PLAYER_BASE_HEIGHT, PLAYER_BASE_HEIGHT, PLAYER_MAX_HEIGHT) / PLAYER_BASE_HEIGHT;
  return (s - 1) * 1.208 + 1.85 * s;
}
