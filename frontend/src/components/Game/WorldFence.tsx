import { CuboidCollider, RigidBody } from '@react-three/rapier';

export function WorldFence() {
  const limit = 58;
  const fenceMaterial = <meshStandardMaterial color="#243241" metalness={0.65} roughness={0.48} />;

  const horizontal = (z: number) => (
    <group position={[0, 0, z]}>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[116, 0.12, 0.12]} />
        {fenceMaterial}
      </mesh>
      <mesh position={[0, 2.8, 0]}>
        <boxGeometry args={[116, 0.12, 0.12]} />
        {fenceMaterial}
      </mesh>
      {Array.from({ length: 30 }, (_, i) => (
        <mesh key={i} position={[-58 + i * 4, 1.5, 0]}>
          <boxGeometry args={[0.12, 3.2, 0.12]} />
          {fenceMaterial}
        </mesh>
      ))}
    </group>
  );

  const vertical = (x: number) => (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.12, 0.12, 116]} />
        {fenceMaterial}
      </mesh>
      <mesh position={[0, 2.8, 0]}>
        <boxGeometry args={[0.12, 0.12, 116]} />
        {fenceMaterial}
      </mesh>
      {Array.from({ length: 30 }, (_, i) => (
        <mesh key={i} position={[0, 1.5, -58 + i * 4]}>
          <boxGeometry args={[0.12, 3.2, 0.12]} />
          {fenceMaterial}
        </mesh>
      ))}
    </group>
  );

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.35, 3, 60]} position={[-limit, 3, 0]} />
        <CuboidCollider args={[0.35, 3, 60]} position={[limit, 3, 0]} />
        <CuboidCollider args={[60, 3, 0.35]} position={[0, 3, -limit]} />
        <CuboidCollider args={[60, 3, 0.35]} position={[0, 3, limit]} />
      </RigidBody>
      {horizontal(-limit)}
      {horizontal(limit)}
      {vertical(-limit)}
      {vertical(limit)}
    </>
  );
}
