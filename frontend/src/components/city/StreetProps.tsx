import { RigidBody } from '@react-three/rapier';

interface StreetPropsProps {
  position: [number, number, number];
  type: 'lamp' | 'bench';
}

export function StreetProps({ position, type }: StreetPropsProps) {
  if (type === 'lamp') {
    return (
      <RigidBody type="fixed" colliders="cuboid">
        <group position={position}>
          <mesh position={[0, 2.5, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.15, 5, 6]} />
            <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 5, 0.3]}>
            <boxGeometry args={[0.8, 0.4, 0.6]} />
            <meshStandardMaterial color="#f0f0f0" emissive="#fff8e1" emissiveIntensity={0.5} />
          </mesh>
        </group>
      </RigidBody>
    );
  }
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <group position={position}>
        <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[2, 0.1, 0.6]} /><meshStandardMaterial color="#8B4513" roughness={0.9} /></mesh>
        <mesh position={[-0.8, 0.2, 0]} castShadow><boxGeometry args={[0.1, 0.4, 0.5]} /><meshStandardMaterial color="#666666" /></mesh>
        <mesh position={[0.8, 0.2, 0]} castShadow><boxGeometry args={[0.1, 0.4, 0.5]} /><meshStandardMaterial color="#666666" /></mesh>
      </group>
    </RigidBody>
  );
}
