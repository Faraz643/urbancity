import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { RemotePlayer } from "../types/player";
import type { BidderInfo } from "../types/billboard";
import { MAP_BILLBOARDS } from "../lib/mapBillboards";

export function useMultiplayer(
  api: string,
  setFootfallTotals: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  setBidders: React.Dispatch<React.SetStateAction<Record<string, BidderInfo>>>,
  setSelected: React.Dispatch<React.SetStateAction<any>>,
  setActiveBookings: React.Dispatch<React.SetStateAction<Record<string, any>>>,
) {
  const [players, setPlayers] = useState<RemotePlayer[]>([]);
  const socket = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("urbancity_token");
    const s = io(api, { auth: token ? { token } : {} });
    socket.current = s;
    s.on("players:list", (p: RemotePlayer[]) => setPlayers(p.filter((x) => x.id !== s.id)));
    s.on("player:joined", (p: RemotePlayer) => setPlayers((a) => [...a.filter((x) => x.id !== p.id), p]));
    s.on("player:update", (p: RemotePlayer) => setPlayers((a) => [...a.filter((x) => x.id !== p.id), p]));
    s.on("player:left", (id: string) => setPlayers((a) => a.filter((x) => x.id !== id)));
    s.on("billboard:footfall", (d: { id: string; total: number }) => setFootfallTotals((v) => ({ ...v, [d.id]: d.total })));
    s.on("billboard:update", (b: any) => {
      const local = MAP_BILLBOARDS.find((x) => x.id === b.id);
      if (local) {
        local.bid = b.bid;
        if (typeof b.available === "boolean") local.occupied = !b.available;
      }
      if (b.bidder) setBidders((v) => ({ ...v, [b.id]: b.bidder }));
      else if (b.bidder === null) setBidders((v) => { const n = { ...v }; delete n[b.id]; return n; });
      setSelected((v: any) => v && v.id === b.id ? { ...v, bid: b.bid, occupied: typeof b.available === "boolean" ? !b.available : v.occupied } : v);
    });
    s.on("billboard:expired", (b: any) => {
      setActiveBookings((v) => { const n = { ...v }; delete n[b.id]; return n; });
      const local = MAP_BILLBOARDS.find((x) => x.id === b.id);
      if (local) local.occupied = false;
      setBidders((v) => { const n = { ...v }; delete n[b.id]; return n; });
      setSelected((v: any) => v && v.id === b.id ? { ...v, occupied: false } : v);
    });
    return () => { s.removeAllListeners(); s.disconnect(); if (socket.current === s) socket.current = null; };
  }, [api, setActiveBookings, setBidders, setFootfallTotals, setSelected]);

  return { players, socket };
}
