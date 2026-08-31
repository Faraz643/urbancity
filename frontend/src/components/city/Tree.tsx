import { RigidBody, CylinderCollider } from '@react-three/rapier';

interface TreeProps {
  position: [number, number, number];
  scale?: number;
}

export function Tree({ position, scale = 1 }: TreeProps) {
  return (
    <group position={position} scale={scale}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.5, 0.3]} position={[0, 1.5, 0]} />
        <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.3, 3, 8]} />
          <meshStandardMaterial color="#8B4513" roughness={0.9} />
        </mesh>
        <mesh position={[0, 3.5, 0]} castShadow>
          <sphereGeometry args={[1.8, 8, 8]} />
          <meshStandardMaterial color="#228B22" roughness={0.8} />
        </mesh>
        <mesh position={[0, 4.5, 0]} castShadow>
          <sphereGeometry args={[1.3, 8, 8]} />
          <meshStandardMaterial color="#32CD32" roughness={0.8} />
        </mesh>
      </RigidBody>
    </group>
  );
}
