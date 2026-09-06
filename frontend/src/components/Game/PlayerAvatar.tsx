import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

export function PlayerAvatar({ moving }: { moving: boolean }) {
  const body = useRef<THREE.Group>(null!);
  const leftArm = useRef<THREE.Group>(null!);
  const rightArm = useRef<THREE.Group>(null!);
  const leftLeg = useRef<THREE.Group>(null!);
  const rightLeg = useRef<THREE.Group>(null!);
  const t = useRef(0);

  useFrame((_, dt) => {
    t.current += dt * (moving ? 8 : 2.2);
    const swing = moving ? Math.sin(t.current) * 0.62 : 0;
    const bob = moving ? Math.abs(Math.sin(t.current)) * 0.035 : Math.sin(t.current) * 0.012;

    if (body.current) body.current.position.y = bob;
    if (leftArm.current) leftArm.current.rotation.x = swing;
    if (rightArm.current) rightArm.current.rotation.x = -swing;
    if (leftLeg.current) leftLeg.current.rotation.x = -swing;
    if (rightLeg.current) rightLeg.current.rotation.x = swing;
  });

  return (
    <group position={[0, -1.12, 0]}>
      <group ref={body}>
        <mesh position={[0, 1.02, 0]} castShadow>
          <capsuleGeometry args={[0.36, 0.62, 6, 12]} />
          <meshStandardMaterial color="#1184ad" roughness={0.62} />
        </mesh>

        <mesh position={[0, 1.82, 0]} scale={[0.78, 1.08, 0.82]} castShadow>
          <sphereGeometry args={[0.38, 20, 16]} />
          <meshStandardMaterial color="#e4b98d" roughness={0.72} />
        </mesh>
        <mesh position={[-0.13, 1.84, 0.29]} scale={[0.045, 0.065, 0.025]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#1a2430" />
        </mesh>
        <mesh position={[0.13, 1.84, 0.29]} scale={[0.045, 0.065, 0.025]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#1a2430" />
        </mesh>

        <group ref={leftArm} position={[-0.43, 1.33, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <capsuleGeometry args={[0.105, 0.45, 6, 10]} />
            <meshStandardMaterial color="#e4b98d" />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.43, 1.33, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <capsuleGeometry args={[0.105, 0.45, 6, 10]} />
            <meshStandardMaterial color="#e4b98d" />
          </mesh>
        </group>

        <group ref={leftLeg} position={[-0.17, 0.72, 0]}>
          <mesh position={[0, -0.38, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.5, 6, 10]} />
            <meshStandardMaterial color="#27364d" />
          </mesh>
          <mesh position={[0, -0.72, 0.07]} scale={[1, 0.55, 1.3]} castShadow>
            <sphereGeometry args={[0.16, 12, 8]} />
            <meshStandardMaterial color="#141b27" />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.17, 0.72, 0]}>
          <mesh position={[0, -0.38, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.5, 6, 10]} />
            <meshStandardMaterial color="#27364d" />
          </mesh>
          <mesh position={[0, -0.72, 0.07]} scale={[1, 0.55, 1.3]} castShadow>
            <sphereGeometry args={[0.16, 12, 8]} />
            <meshStandardMaterial color="#141b27" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
