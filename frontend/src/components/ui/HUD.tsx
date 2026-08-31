import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';
import { Users, Wallet, Map, Menu } from './Icons';

export default function HUD() {
  const onlineCount = useGameStore((s) => s.onlineCount);
  const user = useAuthStore((s) => s.user);
  const setMapOpen = useGameStore((s) => s.setMapOpen);
  const setMenuOpen = useGameStore((s) => s.setMenuOpen);

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start">
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="glass-panel px-4 py-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium">
              <span className="w-2 h-2 bg-green-400 rounded-full inline-block mr-2 animate-pulse" />
              {onlineCount.toLocaleString()} Visitors Online
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          {user && (
            <div className="glass-panel px-4 py-2 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary-400" />
              <span className="text-sm font-medium">₹{(user.wallet?.balance || 0).toLocaleString()}</span>
            </div>
          )}
          <button onClick={() => setMapOpen(true)} className="glass-panel p-2 hover:bg-white/10 transition-colors">
            <Map className="w-5 h-5" />
          </button>
          <button onClick={() => setMenuOpen(true)} className="glass-panel p-2 hover:bg-white/10 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 text-white/40 text-xs hidden md:block">
        WASD to move • Mouse to look • Click billboards to interact
      </div>
    </div>
  );
}
