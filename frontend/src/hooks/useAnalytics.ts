import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { MAP_BILLBOARDS } from "../lib/mapBillboards";
import { billboardTrafficRadius } from "../lib/billboard";
import type { RemotePlayer } from "../types/player";

export function useAnalytics(
  api: string,
  players: RemotePlayer[],
  localPosition: [number, number, number],
  setFootfallTotals: Dispatch<SetStateAction<Record<string, number>>>,
) {
  const [siteTotalVisitors, setSiteTotalVisitors] = useState(0);

  useEffect(() => {
    const makeId = () => crypto.randomUUID().replace(/-/g, "");
    let visitorId = localStorage.getItem("urbancity_visitor_id");
    if (!visitorId) { visitorId = makeId(); localStorage.setItem("urbancity_visitor_id", visitorId); }
    let sessionId = sessionStorage.getItem("urbancity_visit_session");
    if (!sessionId) { sessionId = makeId(); sessionStorage.setItem("urbancity_visit_session", sessionId); }
    fetch(api + "/api/analytics/site-visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitorId, sessionId }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setSiteTotalVisitors(Number(d.totalVisits || 0)); }).catch(() => {});
    const refresh = () => fetch(api + "/api/analytics/site").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) setSiteTotalVisitors(Number(d.totalVisits || 0)); }).catch(() => {});
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, [api]);

  useEffect(() => {
    fetch(api + "/api/live/billboards")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => { const n: Record<string, number> = {}; for (const row of rows) n[row.id] = Number(row.footfall || 0); setFootfallTotals(n); })
      .catch(() => {});
  }, [api, setFootfallTotals]);

  const visitorStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const b of MAP_BILLBOARDS) stats[b.id] = 0;
    const all = [localPosition, ...players.map((p) => p.position)];
    for (const pos of all) for (const b of MAP_BILLBOARDS)
      if (Math.hypot(pos[0] - b.position[0], pos[2] - b.position[2]) <= billboardTrafficRadius(b)) stats[b.id]++;
    return stats;
  }, [players, localPosition]);

  return { siteTotalVisitors, visitorStats };
}
