import { useMemo } from 'react';

export type TimeMode = 'morning' | 'evening' | 'night';

type ThemedSkyProps = {
  timeMode: TimeMode;
};

export function ThemedSky({ timeMode }: ThemedSkyProps) {
  const clouds = [
    [-34, 31, -38, 7],
    [-8, 37, -28, 9],
    [25, 30, -34, 8],
    [42, 40, 8, 10],
    [-40, 35, 22, 8],
    [8, 33, 34, 11],
    [-18, 42, 15, 7],
  ] as const;

  // Keep the deterministic star positions stable between renders.
  const stars = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => {
        const a = (i * 2.399963229728653) % 6.28318;
        const r = 35 + (i % 13) * 3.4;
        return [
          Math.cos(a) * r,
          24 + (i % 9) * 3.8,
          Math.sin(a) * r,
        ] as [number, number, number];
      }),
    [],
  );

  // These values are retained from the original component so the visual behavior
  // does not change during the refactor. The cloud data is currently reserved for
  // the existing sky design and can be rendered in a later visual pass.
  void clouds;

  return (
    <group>
      {timeMode === 'night' && (
        <>
          {stars.map((p, i) => (
            <mesh key={i} position={p}>
              <sphereGeometry args={[0.08 + (i % 3) * 0.025, 5, 5]} />
              <meshBasicMaterial color={i % 5 === 0 ? '#b8d8ff' : '#ffffff'} />
            </mesh>
          ))}
          <mesh position={[-28, 31, -45]}>
            <sphereGeometry args={[3.2, 20, 16]} />
            <meshBasicMaterial color="#d9e7ff" />
          </mesh>
        </>
      )}
      {timeMode === 'morning' && (
        <mesh position={[-38, 28, -50]}>
          <sphereGeometry args={[4.5, 20, 16]} />
          <meshBasicMaterial color="#fff3b0" />
        </mesh>
      )}
      {timeMode === 'evening' && (
        <mesh position={[38, 16, -50]}>
          <sphereGeometry args={[4.7, 20, 16]} />
          <meshBasicMaterial color="#ffb36b" />
        </mesh>
      )}
    </group>
  );
}
