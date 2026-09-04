import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { useGameStore } from '@/stores/gameStore';
import { api } from '@/utils/api';
import { emitBillboardInteract } from '@/utils/socket';
import * as THREE from 'three';

interface BillboardProps {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  type: string;
  name: string;
  location: string;
  currentBid?: number;
  trafficRating: string;
  visibilityRating: string;
  isAvailable: boolean;
  campaigns?: any[];
}

export function Billboard({
  id, position, rotation, size, type, name, location,
  currentBid, trafficRating, campaigns,
}: BillboardProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [texture, setTexture] = useState<string | null>(null);
  const nearbyVisitors = useGameStore((s) => s.nearbyBillboards.get(id) || 0);
  const setSelectedBillboard = useGameStore((s) => s.setSelectedBillboard);
  const setBillboardPanelOpen = useGameStore((s) => s.setBillboardPanelOpen);

  useEffect(() => {
    if (campaigns && campaigns.length > 0 && campaigns[0].advertisement) {
      setTexture(campaigns[0].advertisement.imageUrl);
    }
  }, [campaigns]);

  useFrame((state) => {
    if (meshRef.current && hovered) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
material.emissiveIntensity =
  0.1 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
    }
  });

  const handleClick = async () => {
    try {
      const res = await api.get(`/billboards/${id}`);
      setSelectedBillboard(res.data);
      setBillboardPanelOpen(true);
      emitBillboardInteract(id);
    } catch (err) { console.error('Failed to load billboard details', err); }
  };

  const isPremium = type === 'PREMIUM';
  const frameColor = isPremium ? '#f97316' : '#0ea5e9';

  return (
    <group position={position} rotation={rotation}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh ref={meshRef} castShadow receiveShadow
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
          <boxGeometry args={[size[0] + 0.3, size[1] + 0.3, 0.2]} />
          <meshStandardMaterial color={frameColor} emissive={frameColor} emissiveIntensity={hovered ? 0.2 : 0} metalness={0.6} roughness={0.3} />
        </mesh>
      </RigidBody>
      <mesh position={[0, 0, 0.15]}>
        <planeGeometry args={[size[0], size[1]]} />
        {texture ? (
          <meshStandardMaterial map={new THREE.TextureLoader().load(texture)} />
        ) : (
          <meshStandardMaterial color="#1a1a2e" />
        )}
      </mesh>
      <Html position={[0, -size[1] / 2 - 0.8, 0.3]} center transform occlude>
        <div className="bg-black/80 backdrop-blur text-white px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border border-white/10">
          <span className="mr-1">👥</span> {nearbyVisitors} NEARBY
        </div>
      </Html>
      <Html position={[0, size[1] / 2 + 0.6, 0.3]} center transform occlude>
        <div className={`text-white px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${isPremium ? 'bg-orange-500/90' : 'bg-sky-500/90'}`}>
          {name} · {location}
        </div>
      </Html>
    </group>
  );
}
