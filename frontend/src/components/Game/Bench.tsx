import { CuboidCollider, RigidBody } from '@react-three/rapier';

export function Bench({ position }: { position: [number, number, number] }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[1.2, 0.7, 0.45]} position={[0, 0.7, 0]} />
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[2.4, 0.25, 0.7]} />
        <meshStandardMaterial color="#805b3b" />
      </mesh>
      <mesh position={[0, 1.25, 0.25]}>
        <boxGeometry args={[2.4, 0.7, 0.15]} />
        <meshStandardMaterial color="#805b3b" />
      </mesh>
    </RigidBody>
  );
}
