import { create } from 'zustand';
import { Billboard, PlayerData } from '@/types';

interface GameState {
  onlineCount: number;
  players: Map<string, PlayerData>;
  nearbyBillboards: Map<string, number>;
  selectedBillboard: Billboard | null;
  isBillboardPanelOpen: boolean;
  isMapOpen: boolean;
  isMenuOpen: boolean;
  playerPosition: { x: number; y: number; z: number };
  setOnlineCount: (count: number) => void;
  setPlayers: (players: Map<string, PlayerData>) => void;
  updatePlayer: (id: string, data: PlayerData) => void;
  removePlayer: (id: string) => void;
  setNearbyBillboards: (billboards: Map<string, number>) => void;
  setSelectedBillboard: (billboard: Billboard | null) => void;
  setBillboardPanelOpen: (open: boolean) => void;
  setMapOpen: (open: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  setPlayerPosition: (pos: { x: number; y: number; z: number }) => void;
}

export const useGameStore = create<GameState>((set) => ({
  onlineCount: 0,
  players: new Map(),
  nearbyBillboards: new Map(),
  selectedBillboard: null,
  isBillboardPanelOpen: false,
  isMapOpen: false,
  isMenuOpen: false,
  playerPosition: { x: 0, y: 0, z: 0 },
  setOnlineCount: (count) => set({ onlineCount: count }),
  setPlayers: (players) => set({ players: new Map(players) }),
  updatePlayer: (id, data) =>
    set((state) => {
      const newPlayers = new Map(state.players);
      newPlayers.set(id, data);
      return { players: newPlayers };
    }),
  removePlayer: (id) =>
    set((state) => {
      const newPlayers = new Map(state.players);
      newPlayers.delete(id);
      return { players: newPlayers };
    }),
  setNearbyBillboards: (billboards) => set({ nearbyBillboards: new Map(billboards) }),
  setSelectedBillboard: (billboard) => set({ selectedBillboard: billboard }),
  setBillboardPanelOpen: (open) => set({ isBillboardPanelOpen: open }),
  setMapOpen: (open) => set({ isMapOpen: open }),
  setMenuOpen: (open) => set({ isMenuOpen: open }),
  setPlayerPosition: (pos) => set({ playerPosition: pos }),
}));
