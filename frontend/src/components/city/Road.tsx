import { Clone, useGLTF } from '@react-three/drei';

interface RoadProps {
  start: [number, number, number];
  end: [number, number, number];
  width: number;
}

const ROAD_MODEL = '/models/road/road-straight.glb';

function RoadTile({ position, scale, rotationY }: {
  position: [number, number, number];
  scale: number;
  rotationY: number;
}) {
  const { scene } = useGLTF(ROAD_MODEL);
  return <Clone object={scene} position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]} castShadow receiveShadow />;
}

export function Road({ start, end, width }: RoadProps) {
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);
  const count = Math.max(1, Math.ceil(length / width));
  const actualTileLength = length / count;

  return (
    <group>
      {Array.from({ length: count }, (_, index) => {
        const distance = -length / 2 + actualTileLength * (index + 0.5);
        const midX = (start[0] + end[0]) / 2;
        const midZ = (start[2] + end[2]) / 2;
        return (
          <RoadTile
            key={index}
            position={[midX + Math.cos(angle) * distance, 0.03, midZ + Math.sin(angle) * distance]}
            scale={width}
            rotationY={Math.abs(dx) >= Math.abs(dz) ? Math.PI / 2 : 0}
          />
        );
      })}
    </group>
  );
}

useGLTF.preload(ROAD_MODEL);
