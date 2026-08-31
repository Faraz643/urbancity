import { useGameStore } from '@/stores/gameStore';
import { X } from './Icons';

export default function CityMap() {
  const setMapOpen = useGameStore((s) => s.setMapOpen);
  const playerPosition = useGameStore((s) => s.playerPosition);
  const nearbyBillboards = useGameStore((s) => s.nearbyBillboards);
  const mapScale = 2;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-2xl h-[80vh] flex flex-col">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-bold">City Map</h2>
          <button onClick={() => setMapOpen(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 relative bg-slate-800/50 m-4 rounded-xl overflow-hidden">
          <svg viewBox="-150 -150 300 300" className="w-full h-full">
            <line x1="-100" y1="0" x2="100" y2="0" stroke="#666" strokeWidth="8" />
            <line x1="0" y1="-100" x2="0" y2="100" stroke="#666" strokeWidth="8" />
            <line x1="-60" y1="-60" x2="60" y2="-60" stroke="#888" strokeWidth="4" />
            <line x1="-60" y1="60" x2="60" y2="60" stroke="#888" strokeWidth="4" />
            <line x1="-60" y1="-60" x2="-60" y2="60" stroke="#888" strokeWidth="4" />
            <line x1="60" y1="-60" x2="60" y2="60" stroke="#888" strokeWidth="4" />
            <circle cx={playerPosition.x * mapScale} cy={playerPosition.z * mapScale} r="4" fill="#3b82f6" className="animate-pulse" />
            {Array.from(nearbyBillboards.entries()).map(([id, count]) => (
              <circle key={id} cx={0} cy={0} r="3" fill={count > 0 ? '#f97316' : '#0ea5e9'} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
