import { useEffect, useState } from 'react';
import { MAP_BILLBOARDS } from '../../lib/mapBillboards';
import type { RemotePlayer } from '../../types/player';

type MiniMapProps = {
  players: RemotePlayer[];
};

export function MiniMap({ players }: MiniMapProps) {
  const [me, setMe] = useState<[number, number, number]>([0, 0, 8]);
  const [yaw, setYaw] = useState(0);

  useEffect(() => {
    let id = 0;
    const tick = () => {
      const p = (window as any).__urbanPlayerPosition as
        | { x: number; y: number; z: number }
        | undefined;
      if (p) setMe([p.x, p.y, p.z]);
      setYaw((window as any).__urbanCameraYaw ?? 0);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const toPct = (x: number, z: number) => ({
    left: `${Math.max(3, Math.min(97, ((x + 60) / 120) * 100))}%`,
    top: `${Math.max(3, Math.min(97, ((z + 60) / 120) * 100))}%`,
  });

  return (
    <div className="minimap">
      <div className="mapgrid">
        <div className="map-road vertical" />
        <div className="map-road horizontal" />
        {[-44, -28, -12, 12, 28, 44].map((v, i) => (
          <div key={`rv${i}`} className="minor-road v" style={{ left: `${((v + 60) / 120) * 100}%` }} />
        ))}
        {[-44, -28, -12, 12, 28, 44].map((v, i) => (
          <div key={`rh${i}`} className="minor-road h" style={{ top: `${((v + 60) / 120) * 100}%` }} />
        ))}
        {MAP_BILLBOARDS.map((b) => (
          <i key={b.id} className="map-billboard" title={`Billboard #${b.id}`} style={toPct(b.position[0], b.position[2])} />
        ))}
        {players.map((p) => (
          <i key={p.id} className="map-player" style={toPct(p.position[0], p.position[2])} />
        ))}
        <i className="map-me" style={{ ...toPct(me[0], me[2]), transform: `translate(-50%,-50%) rotate(${yaw}rad)` }} />
      </div>
      <small>• billboards</small>
    </div>
  );
}
