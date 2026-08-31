import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useAuthStore } from '@/stores/authStore';
import { Link } from 'react-router-dom';
import { X } from './Icons';

export default function MainMenu() {
  const setMenuOpen = useGameStore((s) => s.setMenuOpen);
  const { user, isAuthenticated, logout } = useAuthStore();

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Menu</h2>
            <button onClick={() => setMenuOpen(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-3">
            {isAuthenticated && user ? (
              <>
                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <p className="font-semibold">{user.displayName || user.username}</p>
                  <p className="text-sm text-white/60">{user.email}</p>
                  <p className="text-sm text-primary-400 mt-1">Wallet: ₹{(user.wallet?.balance || 0).toLocaleString()}</p>
                </div>
                <Link to="/admin" onClick={() => setMenuOpen(false)}>
                  <button className="btn-secondary w-full mb-3">Admin Dashboard</button>
                </Link>
                <button onClick={() => { logout(); setMenuOpen(false); }} className="btn-secondary w-full text-red-400 border-red-400/20 hover:bg-red-400/10">
                  Logout
                </button>
              </>
            ) : (
              <button onClick={() => {}} className="btn-primary w-full">Login / Register</button>
            )}
            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-white/40 text-center">AdCity v1.0 · 3D Multiplayer Advertising City</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
