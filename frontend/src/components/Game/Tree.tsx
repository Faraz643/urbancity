import { CuboidCollider, RigidBody } from '@react-three/rapier';

export function Tree({ position }: { position: [number, number, number] }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.55, 2, 0.55]} position={[0, 2, 0]} />
      <mesh castShadow position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.22, 0.32, 3.2, 8]} />
        <meshStandardMaterial color="#5d4631" />
      </mesh>
      <mesh castShadow position={[0, 4.1, 0]}>
        <sphereGeometry args={[1.7, 10, 10]} />
        <meshStandardMaterial color="#185d46" />
      </mesh>
    </RigidBody>
  );
}
