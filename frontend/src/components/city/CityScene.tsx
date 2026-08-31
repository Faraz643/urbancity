import { useMemo, useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Billboard as BillboardMesh } from './Billboard';
import { Building } from './Building';
import { Road } from './Road';
import { Tree } from './Tree';
import { StreetProps } from './StreetProps';
import { api } from '@/utils/api';

export function CityScene() {
  const [billboards, setBillboards] = useState<any[]>([]);
  const { scene } = useThree();

  useEffect(() => {
    api.get('/billboards').then((res) => setBillboards(res.data));
  }, []);

  useEffect(() => { scene.fog = null; }, [scene]);

  const cityElements = useMemo(() => {
    const elements: JSX.Element[] = [];
    elements.push(
      <mesh key="ground" rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>
    );
    elements.push(<Road key="road-h" start={[-100, 0, 0]} end={[100, 0, 0]} width={14} />);
    elements.push(<Road key="road-v" start={[0, 0, -100]} end={[0, 0, 100]} width={14} />);
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      elements.push(<Road key={`street-h-${i}`} start={[-60, 0, i * 30]} end={[60, 0, i * 30]} width={8} />);
      elements.push(<Road key={`street-v-${i}`} start={[i * 30, 0, -60]} end={[i * 30, 0, 60]} width={8} />);
    }
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        if (Math.abs(x) <= 1 && Math.abs(z) <= 1) continue;
        const px = x * 25 + (Math.random() - 0.5) * 8;
        const pz = z * 25 + (Math.random() - 0.5) * 8;
        const height = 8 + Math.random() * 25;
        const width = 6 + Math.random() * 8;
        const depth = 6 + Math.random() * 8;
        elements.push(
          <Building key={`building-${x}-${z}`} position={[px, height / 2, pz]} size={[width, height, depth]}
            color={`hsl(${200 + Math.random() * 40}, ${20 + Math.random() * 30}%, ${60 + Math.random() * 25}%)`} />
        );
      }
    }
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 80;
      elements.push(<Tree key={`tree-${i}`} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]} scale={0.8 + Math.random() * 0.6} />);
    }
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 15 + Math.random() * 70;
      elements.push(<StreetProps key={`prop-${i}`} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]} type={Math.random() > 0.5 ? 'lamp' : 'bench'} />);
    }
    return elements;
  }, []);

  return (
    <group>
      {cityElements}
      {billboards.map((b) => (
        <BillboardMesh key={b.id} id={b.id} position={[b.positionX, b.positionY, b.positionZ]}
          rotation={[0, b.rotationY, 0]} size={[b.width, b.height]} type={b.type} name={b.name}
          location={b.location} currentBid={b.currentBid} trafficRating={b.trafficRating}
          visibilityRating={b.visibilityRating} isAvailable={b.isAvailable} campaigns={b.campaigns} />
      ))}
    </group>
  );
}
