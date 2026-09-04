import { Clone, useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import { useMemo } from 'react';

interface RoadProps {
  start: [number, number, number];
  end: [number, number, number];
  width: number;
}

const ROAD_MODEL = '/models/road/road-straight.glb';

function RoadModel({
  position,
  rotationY,
  length,
  width,
}: {
  position: [number, number, number];
  rotationY: number;
  length: number;
  width: number;
}) {
  const { scene } = useGLTF(ROAD_MODEL);

  const bounds = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    return {
      size,
      center,
      minY: box.min.y,
      // Some GLB road packs are authored along X, others along Z.
      // Normalize either orientation so Road's X axis is always its length.
      longAxis: size.x >= size.z ? 'x' : 'z',
    };
  }, [scene]);

  const scale: [number, number, number] =
    bounds.longAxis === 'x'
      ? [
          length / Math.max(bounds.size.x, 0.001),
          1,
          width / Math.max(bounds.size.z, 0.001),
        ]
      : [
          width / Math.max(bounds.size.x, 0.001),
          1,
          length / Math.max(bounds.size.z, 0.001),
        ];

  // Center the imported model and put its bottom on the ground.
  const offset: [number, number, number] = [
    -bounds.center.x,
    -bounds.minY,
    -bounds.center.z,
  ];

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group rotation={[0, bounds.longAxis === 'z' ? -Math.PI / 2 : 0, 0]}>
        <group scale={scale}>
          <Clone
            object={scene}
            position={offset}
            castShadow
            receiveShadow
          />
        </group>
      </group>
    </group>
  );
}

/**
 * Fits the supplied GLB road precisely between start and end coordinates.
 * This removes assumptions about the model's original size, origin and axis.
 */
export function Road({ start, end, width }: RoadProps) {
  const dx = end[0] - start[0];
  const dz = end[2] - start[2];
  const length = Math.sqrt(dx * dx + dz * dz);
  const rotationY = Math.atan2(dz, dx);

  return (
    <RoadModel
      position={[(start[0] + end[0]) / 2, 0.02, (start[2] + end[2]) / 2]}
      rotationY={rotationY}
      length={length}
      width={width}
    />
  );
}

useGLTF.preload(ROAD_MODEL);
