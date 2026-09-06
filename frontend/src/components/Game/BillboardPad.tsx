import { CuboidCollider, RigidBody } from '@react-three/rapier';
import type { Billboard } from '../../types/billboard';

type BillboardPadProps = {
  b: Billboard;
};

/** Physical support/pad beneath a billboard. Rendering of the ad itself stays in BillboardMesh. */
export function BillboardPad({ b }: BillboardPadProps) {
  const isVertical = b.kind === 'vertical-ad';
  const width = b.size?.[0] ?? (b.type === 'Premium Road' ? 9 : 6);
  const height = b.size?.[1] ?? (isVertical ? 4.6 : b.type === 'Premium Road' ? 4.6 : 3.4);

  if (b.kind === 'wall-ad') return null;

  if (isVertical) {
    return (
      <RigidBody type="fixed" colliders={false} position={b.position} rotation={[0, b.rotationY ?? 0, 0]}>
        <CuboidCollider args={[0.16, 2, 0.16]} position={[0, -height / 2 - 2, 0]} />
        <mesh position={[0, -height / 2 - 2, 0]}>
          <boxGeometry args={[0.3, 4, 0.3]} />
          <meshStandardMaterial color="#171c25" />
        </mesh>
      </RigidBody>
    );
  }

  return (
    <RigidBody type="fixed" colliders={false} position={b.position} rotation={[0, b.rotationY ?? 0, 0]}>
      <CuboidCollider args={[0.125, 2, 0.125]} position={[-width * 0.28, -height / 2 - 2, 0]} />
      <CuboidCollider args={[0.125, 2, 0.125]} position={[width * 0.28, -height / 2 - 2, 0]} />
      <mesh position={[-width * 0.28, -height / 2 - 2, 0]}>
        <boxGeometry args={[0.25, 4, 0.25]} />
        <meshStandardMaterial color="#171c25" />
      </mesh>
      <mesh position={[width * 0.28, -height / 2 - 2, 0]}>
        <boxGeometry args={[0.25, 4, 0.25]} />
        <meshStandardMaterial color="#171c25" />
      </mesh>
    </RigidBody>
  );
}
