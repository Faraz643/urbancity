import { RigidBody } from '@react-three/rapier';

interface BuildingProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}

export function Building({ position, size, color }: BuildingProps) {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh position={position} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
      </mesh>
      <mesh position={[position[0], position[1] + size[1] / 2 + 0.3, position[2]]} castShadow>
        <boxGeometry args={[size[0] - 1, 0.6, size[2] - 1]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {Array.from({ length: Math.floor(size[1] / 4) }).map((_, i) => (
        <mesh key={i} position={[position[0] + size[0] / 2 + 0.05, position[1] - size[1] / 2 + 2 + i * 3.5, position[2]]}>
          <planeGeometry args={[size[2] * 0.6, 1.5]} />
          <meshStandardMaterial color="#87CEEB" emissive="#87CEEB" emissiveIntensity={0.3} roughness={0.2} />
        </mesh>
      ))}
    </RigidBody>
  );
}
