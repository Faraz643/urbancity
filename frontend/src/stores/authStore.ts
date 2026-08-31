import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateBalance: (balance: number) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      login: (token, user) => set({ token, user, isAuthenticated: true, isLoading: false }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
      updateBalance: (balance) =>
        set((state) => ({
          user: state.user ? { ...state.user, wallet: { ...state.user.wallet!, balance } } : null,
        })),
    }),
    { name: 'auth-storage' }
  )
);
