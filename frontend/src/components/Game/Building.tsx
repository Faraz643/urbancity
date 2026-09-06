import { CuboidCollider, RigidBody } from '@react-three/rapier';

type BuildingProps = {
  position: [number, number, number];
  size: [number, number];
  height: number;
  color: string;
};

export function Building({ position, size, height, color }: BuildingProps) {
  const cols = Math.max(2, Math.floor(size[0] / 2));
  const rows = Math.max(4, Math.floor(height / 3.2));
  const windows: Array<[number, number, number, number]> = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      windows.push([
        (col - (cols - 1) / 2) * (size[0] / cols),
        1.6 + row * (height / (rows + 1)),
        row,
        col,
      ]);
    }
  }

  return (
    <RigidBody type="fixed" colliders={false} position={[position[0], height / 2, position[2]]}>
      <CuboidCollider args={[size[0] / 2, height / 2, size[1] / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size[0], height, size[1]]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.16} />
      </mesh>

      <mesh position={[0, -height / 2 + 2.1, size[1] / 2 + 0.025]}>
        <boxGeometry args={[size[0] * 0.82, 2.7, 0.08]} />
        <meshStandardMaterial color="#0a1320" metalness={0.35} />
      </mesh>
      <mesh position={[0, -height / 2 + 2.25, size[1] / 2 + 0.08]}>
        <planeGeometry args={[size[0] * 0.62, 1.55]} />
        <meshStandardMaterial color="#203b54" emissive="#1d5272" emissiveIntensity={0.55} />
      </mesh>

      {windows.map(([x, y, row, col], i) => (
        <mesh key={i} position={[x, y - height / 2, size[1] / 2 + 0.035]}>
          <planeGeometry args={[Math.max(0.35, (size[0] / cols) * 0.48), Math.max(0.55, (height / (rows + 1)) * 0.46)]} />
          <meshStandardMaterial
            color={row % 3 === 0 ? '#384a5d' : '#253547'}
            emissive={(row + col) % 4 === 0 ? '#d6c878' : '#37526d'}
            emissiveIntensity={(row + col) % 4 === 0 ? 0.7 : 0.35}
          />
        </mesh>
      ))}

      <mesh position={[0, height * 0.48, 0]}>
        <boxGeometry args={[size[0] * 1.03, 0.35, size[1] * 1.03]} />
        <meshStandardMaterial color="#111c2a" metalness={0.35} />
      </mesh>
      {height > 32 && (
        <mesh position={[0, height * 0.53, 0]}>
          <boxGeometry args={[size[0] * 0.32, 3, size[1] * 0.28]} />
          <meshStandardMaterial color="#202d3e" roughness={0.65} />
        </mesh>
      )}
    </RigidBody>
  );
}
