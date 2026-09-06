export function StreetLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.08, 0.11, 4.8, 8]} />
        <meshStandardMaterial color="#263040" />
      </mesh>
      <pointLight position={[0, 4.7, 0]} intensity={9} distance={14} color="#ffeab0" />
      <mesh position={[0, 4.7, 0]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial emissive="#ffeab0" color="#fff5c9" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}
