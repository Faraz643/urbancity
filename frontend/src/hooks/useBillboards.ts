import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { MAP_BILLBOARDS } from "../lib/mapBillboards";
import type { BidderInfo } from "../types/billboard";
import type { PricingConfig } from "../pricing";

// V2 keeps billboard data access isolated from the application shell.
type ReadApi = (r: Response) => Promise<any>;

export function useBillboards(
  api: string,
  readApi: ReadApi,
  setActiveBookings: Dispatch<SetStateAction<Record<string, any>>>,
  setBidders: Dispatch<SetStateAction<Record<string, BidderInfo>>>,
  setPricing: Dispatch<SetStateAction<PricingConfig>>,
  setPricingReady: Dispatch<SetStateAction<boolean>>,
  setLeaderboard: Dispatch<SetStateAction<any[]>>,
) {
  const toAssetUrl = useCallback((v?: string) => v ? (v.startsWith("http") ? v : api + v) : undefined, [api]);

  const loadPricing = useCallback(async () => {
    try {
      const r = await fetch(api + "/api/admin/pricing");
      const p = await readApi(r);
      if (!r.ok) throw new Error(p.error || "Pricing unavailable");
      setPricing(p);
      setPricingReady(true);
    } catch {
      setPricingReady(false);
    }
  }, [api, readApi, setPricing, setPricingReady]);

  const loadAllActiveBillboards = useCallback(async () => {
    try {
      const r = await fetch(api + "/api/bookings/active");
      const rows = await readApi(r);
      if (!r.ok || !rows || typeof rows !== "object") return;
      setActiveBookings(rows);
      const next: Record<string, BidderInfo> = {};
      for (const [id, a] of Object.entries(rows as Record<string, any>)) {
        const x: any = a;
        next[id] = {
          name: x.companyName || x.user?.displayName || x.user?.username || "Advertiser",
          amount: Number(x.amount || 0),
          siteUrl: x.targetUrl || x.siteUrl || x.user?.websiteUrl || undefined,
          imageUrl: toAssetUrl(x.imageUrl),
          description: x.description || x.advertisement?.description || x.user?.companyDescription || undefined,
        };
        const local = MAP_BILLBOARDS.find((b) => b.id === id);
        if (local) local.occupied = true;
      }
      for (const local of MAP_BILLBOARDS) if (!rows[local.id]) local.occupied = false;
      setBidders(next);
    } catch {}
  }, [api, readApi, setActiveBookings, setBidders, toAssetUrl]);

  const loadLeaderboard = useCallback(async () => {
    try {
      const r = await fetch(api + "/api/bookings/leaderboard");
      const d = await readApi(r);
      if (r.ok) setLeaderboard(Array.isArray(d) ? d : []);
    } catch {}
  }, [api, readApi, setLeaderboard]);

  return { loadPricing, loadAllActiveBillboards, loadLeaderboard, toAssetUrl };
}
