import { Html } from "@react-three/drei";
import type { HuntSpawnPoint } from "../../../types/hunt";

const DEFAULT_POINTS: HuntSpawnPoint[] = [
  { position: [-28, 0.9, -18] },
  { position: [24, 0.9, -22] },
  { position: [-18, 0.9, 18] },
  { position: [30, 0.9, 16] },
  { position: [0, 0.9, -32] },
  { position: [0, 0.9, 30] },
  { position: [-38, 0.9, 4] },
  { position: [38, 0.9, -4] },
];

function pickPoint() {
  return DEFAULT_POINTS[Math.floor(Math.random() * DEFAULT_POINTS.length)].position;
}

export default function HuntTarget({
  onShoot,
}: {
  onShoot: (hit: boolean) => void;
}) {
  // The target is deliberately stationary. HuntTarget is remounted with a new
  // key after every hit, which gives it a fresh random spawn position.
  const position = pickPoint();

  const handleHit = (event: any) => {
    event.stopPropagation();
    onShoot(true);
  };

  return (
    <group position={position}>
      {/* Generous invisible hit area so the target is easy to shoot. */}
      <mesh
        position={[0, 0.85, 0]}
        onClick={handleHit}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "crosshair";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[0.72, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group userData={{ huntTarget: true }}>
        <mesh position={[0, 0.75, 0]} castShadow onClick={handleHit}>
          <capsuleGeometry args={[0.22, 0.65, 6, 10]} />
          <meshStandardMaterial />
        </mesh>
        <mesh position={[0, 1.32, 0]} castShadow onClick={handleHit}>
          <sphereGeometry args={[0.27, 16, 12]} />
          <meshStandardMaterial />
        </mesh>
        <mesh position={[-0.11, 0.28, 0]} castShadow onClick={handleHit}>
          <boxGeometry args={[0.11, 0.5, 0.12]} />
          <meshStandardMaterial />
        </mesh>
        <mesh position={[0.11, 0.28, 0]} castShadow onClick={handleHit}>
          <boxGeometry args={[0.11, 0.5, 0.12]} />
          <meshStandardMaterial />
        </mesh>
        <mesh position={[0.31, 0.88, -0.05]} rotation={[0, 0, -0.7]} castShadow onClick={handleHit}>
          <boxGeometry args={[0.1, 0.48, 0.1]} />
          <meshStandardMaterial />
        </mesh>
      </group>

      <Html position={[0, 1.75, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <div
          style={{
            padding: "4px 7px",
            borderRadius: 999,
            background: "rgba(0,0,0,.7)",
            color: "white",
            fontSize: 10,
            whiteSpace: "nowrap",
          }}
        >
          TARGET
        </div>
      </Html>
    </group>
  );
}
