import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import type { Billboard } from '../../types/billboard';
import { AdCreative } from './AdCreative';

export type BidderInfo = {
  name: string;
  amount: number;
  siteUrl?: string;
  imageUrl?: string;
  description?: string;
};

const BILLBOARD_PLACEHOLDER_HORIZONTAL = '/billboards/place-your-ad-horizontal.png';
const BILLBOARD_PLACEHOLDER_VERTICAL = '/billboards/place-your-ad-vertical.png';

type BillboardMeshProps = {
  b: Billboard;
  onSelect: (b: Billboard) => void;
  nearCount: number;
  totalVisitors: number;
  bidder?: BidderInfo;
};

export function BillboardMesh({ b, onSelect, nearCount, totalVisitors: _totalVisitors, bidder }: BillboardMeshProps) {
  const isWall = b.kind === 'wall-ad';
  const isVertical = b.kind === 'vertical-ad';
  const w = b.size?.[0] ?? (b.type === 'Premium Road' ? 9 : 6);
  const h = b.size?.[1] ?? (isVertical ? 4.6 : (b.type === 'Premium Road' ? 4.6 : 3.4));

  if (isWall || isVertical) {
    return <RigidBody type="fixed" colliders={false} position={b.position} rotation={[0, b.rotationY ?? 0, 0]}>
      <CuboidCollider args={[w / 2, h / 2, 0.08]} />
      <group onClick={(e) => { e.stopPropagation(); onSelect(b); }}>
        <mesh><boxGeometry args={[w + .35, h + .35, .16]} /><meshStandardMaterial color="#111827" metalness={.45} /></mesh>
        {bidder?.imageUrl ? <AdCreative url={bidder.imageUrl} w={w} h={h} /> : !bidder ? <AdCreative url={BILLBOARD_PLACEHOLDER_VERTICAL} w={w} h={h} /> : null}
        {!bidder?.imageUrl && bidder && <>
          <Text position={[0, .28, .12]} fontSize={Math.min(h * .16, .62)} color="white" anchorX="center" maxWidth={w * .82} textAlign="center">{bidder.name}</Text>
          <Text position={[0, -Math.min(h * .18, .7), .12]} fontSize={Math.min(h * .075, .24)} color="#c7d5e8" anchorX="center" maxWidth={w * .78} textAlign="center">{bidder.description || ''}</Text>
        </>}
        <Text position={[0, h / 2 + 1.02, .15]} fontSize={.58} color="white" anchorX="center" anchorY="middle" outlineWidth={.04} outlineColor="#07111e">{String(nearCount)}</Text>
        <Text position={[0, h / 2 + .62, .15]} fontSize={.22} color="#8ff0b3" anchorX="center" anchorY="middle" outlineWidth={.018} outlineColor="#07111e">Nearby</Text>
        <mesh position={[0, h / 2 + .22, 0]}><boxGeometry args={[w + .5, .08, .22]} /><meshStandardMaterial color="#49d17d" emissive="#1b6f43" emissiveIntensity={1.1} /></mesh>
      </group>
      {isVertical && <mesh position={[0, -h / 2 - 2, 0]}><boxGeometry args={[.3, 4, .3]} /><meshStandardMaterial color="#171c25" /></mesh>}
    </RigidBody>;
  }

  return <RigidBody type="fixed" colliders={false} position={b.position} rotation={[0, b.rotationY ?? 0, 0]}>
    <CuboidCollider args={[w / 2, h / 2, .35]} />
    <group onClick={(e) => { e.stopPropagation(); onSelect(b); }}>
      <mesh><boxGeometry args={[w, h, .45]} /><meshStandardMaterial color="#111827" /></mesh>
      {bidder?.imageUrl ? <AdCreative url={bidder.imageUrl} w={w - .35} h={h - .35} z={.231} /> : !bidder ? <AdCreative url={BILLBOARD_PLACEHOLDER_HORIZONTAL} w={w - .35} h={h - .35} z={.231} /> : null}
      {!bidder?.imageUrl && bidder && <>
        <Text position={[0, .28, .48]} fontSize={Math.min(h * .16, .62)} color="white" anchorX="center" maxWidth={w * .82} textAlign="center">{bidder.name}</Text>
        <Text position={[0, -Math.min(h * .18, .7), .48]} fontSize={Math.min(h * .075, .24)} color="#c7d5e8" anchorX="center" maxWidth={w * .78} textAlign="center">{bidder.description || ''}</Text>
      </>}
      <Text position={[0, h / 2 + 1.02, .5]} fontSize={.58} color="white" anchorX="center" anchorY="middle" outlineWidth={.04} outlineColor="#07111e">{String(nearCount)}</Text>
      <Text position={[0, h / 2 + .62, .5]} fontSize={.22} color="#8ff0b3" anchorX="center" anchorY="middle" outlineWidth={.018} outlineColor="#07111e">Nearby</Text>
    </group>
    <mesh position={[-w * .28, -h / 2 - 2, 0]}><boxGeometry args={[.25, 4, .25]} /><meshStandardMaterial color="#171c25" /></mesh>
    <mesh position={[w * .28, -h / 2 - 2, 0]}><boxGeometry args={[.25, 4, .25]} /><meshStandardMaterial color="#171c25" /></mesh>
  </RigidBody>;
}
