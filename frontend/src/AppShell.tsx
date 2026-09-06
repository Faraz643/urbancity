import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { World } from "./components/Game/World";
import { MiniMap } from "./components/Game/MiniMap";
import { MAP_BILLBOARDS } from "./lib/mapBillboards";
import { billboardTrafficRadius } from "./lib/billboard";
import {
  bookingPrice as calculateBookingPrice,
  EMPTY_PRICING,
  pricingCategory,
  type PricingConfig,
} from "./pricing";
import type { Billboard, BidderInfo } from "./types/billboard";
import type { RemotePlayer } from "./types/player";
import type { TimeMode } from "./lib/timeTheme";

type AuthUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  websiteUrl?: string | null;
  companyDescription?: string | null;
  wallet?: { balance: number } | null;
};
type PaymentNotice = { message: string; ok: boolean };
export function AppShell() {
  const api = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
  const [gameMenuOpen, setGameMenuOpen] = useState(false),
    [nearby, setNearby] = useState<Billboard | null>(null),
    [selected, setSelected] = useState<Billboard | null>(null),
    [balance, setBalance] = useState(750000),
    [players, setPlayers] = useState<RemotePlayer[]>([]),
    [timeMode, setTimeMode] = useState<TimeMode>("evening"),
    [localPosition, setLocalPosition] = useState<[number, number, number]>([
      0, 1.4, 8,
    ]),
    [user, setUser] = useState<AuthUser | null>(null),
    [authOpen, setAuthOpen] = useState(false),
    [authMode, setAuthMode] = useState<"login" | "register">("login"),
    [authEmail, setAuthEmail] = useState(""),
    [authPassword, setAuthPassword] = useState(""),
    [authUsername, setAuthUsername] = useState(""),
    [authWebsite, setAuthWebsite] = useState(""),
    [authError, setAuthError] = useState(""),
    [authBusy, setAuthBusy] = useState(false),
    [bidders, setBidders] = useState<Record<string, BidderInfo>>({}),
    [bookingMinutes, setBookingMinutes] = useState(30),
    [bookingBusy, setBookingBusy] = useState(false),
    [bookingError, setBookingError] = useState(""),
    [paymentNotice, setPaymentNotice] = useState<PaymentNotice | null>(null),
    [adFile, setAdFile] = useState<File | null>(null),
    [adTitle, setAdTitle] = useState(""),
    [adUrl, setAdUrl] = useState(""),
    [bookingCompanyName, setBookingCompanyName] = useState(""),
    [customerPhone, setCustomerPhone] = useState(""),
[paymentCountry, setPaymentCountry] = useState<string | null>(null),
    [uploadBusy, setUploadBusy] = useState(false),
    [editMode, setEditMode] = useState(false),
    [editBusy, setEditBusy] = useState(false),
    [removePhoto, setRemovePhoto] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [leaderboard, setLeaderboard] = useState<any[]>([]),
    [activeBookings, setActiveBookings] = useState<Record<string, any>>({}),
    [clock, setClock] = useState(Date.now()),
    [footfallTotals, setFootfallTotals] = useState<Record<string, number>>({}),
    [siteTotalVisitors, setSiteTotalVisitors] = useState(0),
    [pricing, setPricing] = useState<PricingConfig>(EMPTY_PRICING),
    [pricingReady, setPricingReady] = useState(false);
  const authInputRef = useRef<HTMLInputElement | null>(null),
    socket = useRef<Socket | null>(null),
    totalVisitors = players.length + 1;
  const toAssetUrl = (v?: string) =>
    v ? (v.startsWith("http") ? v : api + v) : undefined;
  const readApi = async (r: Response) => {
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: text || `Request failed (${r.status})` };
    }
  };
  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("urbancity_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };
  const loadPricing = async () => {
    try {
      const r = await fetch(api + "/api/admin/pricing");
      const p = await readApi(r);
      if (!r.ok) throw new Error(p.error || "Pricing unavailable");
      setPricing(p);
      setPricingReady(true);
    } catch {
      setPricingReady(false);
    }
  };
  const loadAllActiveBillboards = async () => {
    try {
      const r = await fetch(api + "/api/bookings/active"),
        rows = await readApi(r);
      if (!r.ok || !rows || typeof rows !== "object") return;
      setActiveBookings(rows);
      const next: Record<string, BidderInfo> = {};
      for (const [id, a] of Object.entries(rows as Record<string, any>)) {
        const x: any = a;
        next[id] = {
          name:
            x.companyName ||
            x.user?.displayName ||
            x.user?.username ||
            "Advertiser",
          amount: Number(x.amount || 0),
          siteUrl: x.targetUrl || x.siteUrl || x.user?.websiteUrl || undefined,
          imageUrl: toAssetUrl(x.imageUrl),
          description:
            x.description ||
            x.advertisement?.description ||
            x.user?.companyDescription ||
            undefined,
        };
        const local = MAP_BILLBOARDS.find((b) => b.id === id);
        if (local) local.occupied = true;
      }
      for (const local of MAP_BILLBOARDS)
        if (!rows[local.id]) local.occupied = false;
      setBidders(next);
    } catch {}
  };
  const loadMe = async () => {
    const r = await fetch(api + "/api/auth/me", { headers: authHeaders() });
    if (!r.ok) throw new Error("Session expired");
    const me = await r.json();
    setUser(me);
    if (me.wallet?.balance != null) setBalance(Number(me.wallet.balance));
  };
  const loadPaymentCountry = async () => {
  try {
    const r = await fetch(api + "/api/payments/country");
    const d = await readApi(r);
    if (r.ok && /^[A-Z]{2}$/.test(String(d.country || ""))) {
      setPaymentCountry(String(d.country).toUpperCase());
    }
  } catch {}
};
useEffect(() => {
  loadPaymentCountry();
}, [api]);
  useEffect(() => {
    loadPricing();
    const timer = window.setInterval(loadPricing, 60000);
    return () => window.clearInterval(timer);
  }, [api]);
  useEffect(() => {
    loadAllActiveBillboards();
    const timer = window.setInterval(loadAllActiveBillboards, 60000);
    return () => window.clearInterval(timer);
  }, [api]);
  useEffect(() => {
    const makeId = () => crypto.randomUUID().replace(/-/g, "");
    let visitorId = localStorage.getItem("urbancity_visitor_id");
    if (!visitorId) {
      visitorId = makeId();
      localStorage.setItem("urbancity_visitor_id", visitorId);
    }
    let sessionId = sessionStorage.getItem("urbancity_visit_session");
    if (!sessionId) {
      sessionId = makeId();
      sessionStorage.setItem("urbancity_visit_session", sessionId);
    }
    fetch(api + "/api/analytics/site-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, sessionId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setSiteTotalVisitors(Number(d.totalVisits || 0));
      })
      .catch(() => {});
    const refresh = () =>
      fetch(api + "/api/analytics/site")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setSiteTotalVisitors(Number(d.totalVisits || 0));
        })
        .catch(() => {});
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, [api]);
  useEffect(() => {
    fetch(api + "/api/live/billboards")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        const n: Record<string, number> = {};
        for (const row of rows) n[row.id] = Number(row.footfall || 0);
        setFootfallTotals(n);
      })
      .catch(() => {});
  }, [api]);
  const visitorStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const b of MAP_BILLBOARDS) stats[b.id] = 0;
    const all = [localPosition, ...players.map((p) => p.position)];
    for (const pos of all)
      for (const b of MAP_BILLBOARDS)
        if (
          Math.hypot(pos[0] - b.position[0], pos[2] - b.position[2]) <=
          billboardTrafficRadius(b)
        )
          stats[b.id]++;
    return stats;
  }, [players, localPosition]);
  useEffect(() => {
    if (localStorage.getItem("urbancity_token"))
      loadMe().catch(() => localStorage.removeItem("urbancity_token"));
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      bookingId = params.get("booking"),
      orderId = params.get("order_id");
    if (
      params.get("payment") !== "return" ||
      !bookingId ||
      !orderId ||
      !localStorage.getItem("urbancity_token")
    )
      return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
            api +
              "/api/payments/" +
              encodeURIComponent(bookingId) +
              "/verify?order_id=" +
              encodeURIComponent(orderId),
            { headers: authHeaders() },
          ),
          data = await readApi(r);
        if (cancelled) return;
        if (!r.ok) throw new Error(data.error || "Could not verify payment");
        if (data.paid) {
          setPaymentNotice({
            message:
              "Payment successful. Your advertising space is now active.",
            ok: true,
          });
          await loadAllActiveBillboards();
        } else
          setPaymentNotice({
            message:
              data.providerStatus === "ACTIVE"
                ? "Payment is still pending confirmation. Please refresh in a moment."
                : "Payment was not completed.",
            ok: false,
          });
        window.history.replaceState({}, "", window.location.pathname);
      } catch (e: any) {
        if (!cancelled)
          setPaymentNotice({
            message: e.message || "Could not verify payment",
            ok: false,
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);
  useEffect(() => {
    const t = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (!authOpen) return;
    const block = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null,
        editing =
          target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.isContentEditable;
      if (
        editing &&
        [
          "w",
          "a",
          "s",
          "d",
          "W",
          "A",
          "S",
          "D",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "e",
          "E",
        ].includes(e.key)
      )
        e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", block, true);
    return () => window.removeEventListener("keydown", block, true);
  }, [authOpen]);
  useEffect(() => {
    if (authOpen) requestAnimationFrame(() => authInputRef.current?.focus());
  }, [authOpen, authMode]);
  const modalOpen = !!selected || authOpen || historyOpen;
  useEffect(() => {
    if (!modalOpen) return;
    const stop = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".panel,[data-urban-modal]")) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    window.addEventListener("wheel", stop, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", stop, true);
  }, [modalOpen]);
  useEffect(() => {
    if (!selected) return;
    setCustomerPhone("");
    const active = activeBookings[selected.id];
    setEditMode(false);
    setRemovePhoto(false);
    if (active?.userId && active.userId === user?.id) {
      setBookingCompanyName(
        active.companyName || user?.displayName || user?.username || "",
      );
      setAdTitle(active.description || active.advertisement?.description || "");
      setAdUrl(
        active.targetUrl ||
          active.advertisement?.targetUrl ||
          user?.websiteUrl ||
          "",
      );
    } else {
      setBookingCompanyName(user?.displayName || user?.username || "");
      setAdTitle("");
      setAdUrl(user?.websiteUrl || "");
    }
    setAdFile(null);
  }, [selected?.id, user?.id, user?.websiteUrl]);
  useEffect(() => {
    (window as any).__urbanModalOpen = modalOpen;
    return () => {
      (window as any).__urbanModalOpen = false;
    };
  }, [modalOpen]);
  useEffect(() => {
    const token = localStorage.getItem("urbancity_token"),
      s = io(api, { auth: token ? { token } : {} });
    socket.current = s;
    s.on("players:list", (p: RemotePlayer[]) =>
      setPlayers(p.filter((x) => x.id !== s.id)),
    );
    s.on("player:joined", (p: RemotePlayer) =>
      setPlayers((a) => [...a.filter((x) => x.id !== p.id), p]),
    );
    s.on("player:update", (p: RemotePlayer) =>
      setPlayers((a) => [...a.filter((x) => x.id !== p.id), p]),
    );
    s.on("player:left", (id: string) =>
      setPlayers((a) => a.filter((x) => x.id !== id)),
    );
    s.on("billboard:footfall", (d: { id: string; total: number }) =>
      setFootfallTotals((v) => ({ ...v, [d.id]: d.total })),
    );
    s.on("billboard:update", (b: any) => {
      const local = MAP_BILLBOARDS.find((x) => x.id === b.id);
      if (local) {
        local.bid = b.bid;
        if (typeof b.available === "boolean") local.occupied = !b.available;
      }
      if (b.bidder) setBidders((v) => ({ ...v, [b.id]: b.bidder }));
      else if (b.bidder === null)
        setBidders((v) => {
          const n = { ...v };
          delete n[b.id];
          return n;
        });
      setSelected((v) =>
        v && v.id === b.id
          ? {
              ...v,
              bid: b.bid,
              occupied:
                typeof b.available === "boolean" ? !b.available : v.occupied,
            }
          : v,
      );
    });
    s.on("billboard:expired", (b: any) => {
      setActiveBookings((v) => {
        const n = { ...v };
        delete n[b.id];
        return n;
      });
      const local = MAP_BILLBOARDS.find((x) => x.id === b.id);
      if (local) local.occupied = false;
      setBidders((v) => {
        const n = { ...v };
        delete n[b.id];
        return n;
      });
      setSelected((v) => (v && v.id === b.id ? { ...v, occupied: false } : v));
    });
    return () => {
      s.removeAllListeners();
      s.disconnect();
      if (socket.current === s) socket.current = null;
    };
  }, [api]);
  useEffect(() => {
    fetch(api + "/api/billboards")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: any[]) => {
        for (const row of rows) {
          const local = MAP_BILLBOARDS.find((b) => b.id === row.id),
            bid = Number(row.currentBid ?? row.minBid);
          if (local && Number.isFinite(bid)) local.bid = bid;
        }
      })
      .catch(() => {});
  }, [api]);
  useEffect(() => {
    (window as any).__urbanInteractBillboard = (b: Billboard) => setSelected(b);
    return () => {
      delete (window as any).__urbanInteractBillboard;
      delete (window as any).__urbanNearbyBillboard;
    };
  }, []);
  const submitAuth = async () => {
    setAuthError("");
    const email = authEmail.trim(),
      username = authUsername.trim(),
      website = authWebsite.trim();
    if (!email) return setAuthError("Please enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setAuthError("Please enter a valid email address.");
    if (!authPassword) return setAuthError("Please enter your password.");
    if (authMode === "register") {
      if (!username) return setAuthError("Please enter your company name.");
      if (website) {
        try {
          const parsed = new URL(website);
          if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        } catch {
          return setAuthError(
            "Please enter a valid website URL, including https:// (for example: https://yourcompany.com).",
          );
        }
      }
    }
    setAuthBusy(true);
    try {
      const body =
        authMode === "login"
          ? { email, password: authPassword }
          : {
              email,
              password: authPassword,
              username,
              displayName: username,
              websiteUrl: website || undefined,
            };
      const r = await fetch(
          api + "/api/auth/" + (authMode === "login" ? "login" : "register"),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        ),
        data = await readApi(r);
      if (!r.ok)
        throw new Error(
          data.error || "We could not complete your request. Please try again.",
        );
      localStorage.setItem("urbancity_token", data.token);
      await loadMe();
      setAuthOpen(false);
      setAuthPassword("");
      setAuthWebsite("");
    } catch (e: any) {
      setAuthError(
        e.message || "We could not complete your request. Please try again.",
      );
    } finally {
      setAuthBusy(false);
    }
  };
  const logout = () => {
    localStorage.removeItem("urbancity_token");
    setUser(null);
    setBalance(1000);
  };
  const bookingPrice = (b: Billboard, minutes: number) =>
    calculateBookingPrice(pricing, b.type, minutes);
  const remaining = (end?: string) => {
    if (!end) return "";
    let s = Math.max(0, Math.ceil((new Date(end).getTime() - clock) / 1000));
    const d = Math.floor(s / 86400);
    s %= 86400;
    const h = Math.floor(s / 3600);
    s %= 3600;
    const m = Math.floor(s / 60);
    s %= 60;
    return (
      (d ? d + "d " : "") +
      String(h).padStart(2, "0") +
      "h " +
      String(m).padStart(2, "0") +
      "m " +
      String(s).padStart(2, "0") +
      "s"
    );
  };
  const formatDuration = (m: number) =>
    m < 60
      ? "30 min"
      : Number.isInteger(m / 60)
        ? `${m / 60} hour${m === 60 ? "" : "s"}`
        : `${m / 60} hours`;
  const formatUsd = (v: number) =>
    "$" +
    Number(v || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const shortDate = (v: string) => {
    const d = new Date(v),
      now = new Date(),
      same = d.toDateString() === now.toDateString();
    return (
      (same
        ? "Today"
        : d.toLocaleDateString(undefined, { day: "numeric", month: "short" })) +
      " •· " +
      d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    );
  };
  const durationLabel = (m: number) =>
    m >= 1440
      ? `${Math.round(m / 1440)} day${Math.round(m / 1440) === 1 ? "" : "s"}`
      : m >= 60
        ? `${Math.round(m / 60)} hour${Math.round(m / 60) === 1 ? "" : "s"}`
        : `${m} min`;
  const loadLeaderboard = async () => {
    try {
      const r = await fetch(api + "/api/bookings/leaderboard"),
        d = await readApi(r);
      if (r.ok) setLeaderboard(Array.isArray(d) ? d : []);
    } catch {}
  };
  const uploadImageOnly = async () => {
    if (!adFile) return undefined;
    const fd = new FormData();
    fd.append("file", adFile);
    const r = await fetch(api + "/api/advertisements/upload", {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      }),
      d = await readApi(r);
    if (!r.ok) throw new Error(d.error || "Upload failed");
    return d.imageUrl;
  };
  const uploadCreative = async () => {
    setUploadBusy(true);
    try {
      const imageUrl = await uploadImageOnly();
      if (!imageUrl && !adUrl.trim() && !adTitle.trim()) return null;
      const cr = await fetch(api + "/api/advertisements", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            title: bookingCompanyName || "Advertisement",
            description: adTitle || undefined,
            imageUrl: imageUrl || "",
            targetUrl: adUrl || user?.websiteUrl || undefined,
          }),
        }),
        ad = await readApi(cr);
      if (!cr.ok) throw new Error(ad.error || "Could not create advertisement");
      return ad.id;
    } finally {
      setUploadBusy(false);
    }
  };
  const book = async () => {
    if (!selected) return;
    if (!user) {
      setAuthOpen(true);
      setAuthError("Login or register to book advertising space.");
      return;
    }
    if (!pricingReady) {
      setBookingError(
        "Pricing is still loading. Please try again in a moment.",
      );
      return;
    }
    setBookingError("");
    if (paymentCountry === "IN") {
  const phone = customerPhone.replace(/\D/g, "");

  if (!/^\d{10}$/.test(phone)) {
    setBookingError(
      "Please enter your valid 10-digit Indian mobile number for Cashfree payment.",
    );
    return;
  }
}
    const link = adUrl.trim();
    if (link) {
      try {
        const u = new URL(link);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      } catch {
        setBookingError(
          "Please enter a valid website URL including https:// (for example: https://yourcompany.com).",
        );
        return;
      }
    }
    if (adFile && adFile.size > 5 * 1024 * 1024) {
      setBookingError(
        "Your image is too large. Please choose a PNG, JPG or WEBP image smaller than 5 MB.",
      );
      return;
    }
    setBookingBusy(true);
    try {
      const advertisementId = await uploadCreative(),
        r = await fetch(api + "/api/payments/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            billboardId: selected.id,
            durationMinutes: bookingMinutes,
            companyName:
              bookingCompanyName || user.displayName || user.username,
            description: adTitle.trim() || undefined,
           advertisementId: advertisementId || undefined,
customerPhone:
  paymentCountry === "IN"
    ? customerPhone.replace(/\D/g, "")
    : undefined,
          }),
        }),
        data = await readApi(r);
      if (!r.ok)
        throw new Error(data.error || "Could not start secure checkout");
      if (data.paymentProvider === "DODO" && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      if (!data.paymentSessionId)
        throw new Error("Cashfree payment session was not returned");
      const Cashfree = (window as any).Cashfree;
      if (typeof Cashfree !== "function")
        throw new Error(
          "Cashfree checkout is still loading. Please wait a moment and try again.",
        );
      Cashfree({
        mode: data.environment === "production" ? "production" : "sandbox",
      }).checkout({
        paymentSessionId: data.paymentSessionId,
        redirectTarget: "_self",
      });
    } catch (e: any) {
      setBookingError(e.message || "Booking failed");
    } finally {
      setBookingBusy(false);
    }
  };
  const saveCreative = async () => {
    if (!selected || !user) return;
    setBookingError("");
    const link = adUrl.trim();
    if (link) {
      try {
        const u = new URL(link);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      } catch {
        setBookingError(
          "Please enter a valid website URL including https:// (for example: https://yourcompany.com).",
        );
        return;
      }
    }
    setEditBusy(true);
    try {
      const imageUrl = removePhoto ? null : await uploadImageOnly(),
        body: any = {
          companyName: bookingCompanyName.trim() || undefined,
          description: adTitle.trim(),
          targetUrl: adUrl.trim(),
        };
      if (removePhoto) body.imageUrl = null;
      else if (imageUrl) body.imageUrl = imageUrl;
      const r = await fetch(
          api +
            "/api/bookings/" +
            encodeURIComponent(selected.id) +
            "/creative",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify(body),
          },
        ),
        data = await readApi(r);
      if (!r.ok) throw new Error(data.error || "Could not update creative");
      setActiveBookings((v) => ({ ...v, [selected.id]: data }));
      setBidders((v) => ({
        ...v,
        [selected.id]: {
          name: data.companyName,
          amount: Number(data.amount || 0),
          siteUrl: data.targetUrl || data.siteUrl || undefined,
          imageUrl: toAssetUrl(data.imageUrl),
          description: data.description || undefined,
        },
      }));
      setAdFile(null);
      setRemovePhoto(false);
      setEditMode(false);
      await loadAllActiveBillboards();
    } catch (e: any) {
      setBookingError(e.message || "Could not update creative");
    } finally {
      setEditBusy(false);
    }
  };
  const active = selected ? activeBookings[selected.id] : undefined,
    bidder = selected ? bidders[selected.id] : undefined,
    isOwner = !!(user?.id && active?.userId && active.userId === user.id),
    companyName = bidder?.name || active?.companyName || "Company name",
    rawSiteUrl =
      bidder?.siteUrl ||
      active?.targetUrl ||
      active?.siteUrl ||
      active?.user?.websiteUrl,
    siteUrl = rawSiteUrl
      ? rawSiteUrl.startsWith("http://") || rawSiteUrl.startsWith("https://")
        ? rawSiteUrl
        : "https://" + rawSiteUrl
      : undefined,
    description =
      bidder?.description ||
      active?.description ||
      active?.advertisement?.description ||
      active?.user?.companyDescription ||
      "Company description here.";
  return (
    <div className="app">
      <World
        setNearby={setNearby}
        players={players}
        setSelected={setSelected}
        onMove={(state) => socket.current?.emit("player:update", state)}
        onFootfallEnter={(id) =>
          socket.current?.emit("billboard:footfall-enter", { id })
        }
        onFootfallLeave={(id) =>
          socket.current?.emit("billboard:footfall-leave", { id })
        }
        timeMode={timeMode}
        visitorStats={visitorStats}
        onLocalPosition={setLocalPosition}
        bidders={bidders}
      />
      {paymentNotice && (
        <div
          role="status"
          style={{
            position: "fixed",
            top: 72,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            maxWidth: "min(560px,90vw)",
            padding: "12px 16px",
            borderRadius: 10,
            background: paymentNotice.ok ? "#123d2b" : "#4a1f27",
            color: "#fff",
            boxShadow: "0 12px 40px rgba(0,0,0,.35)",
            cursor: "pointer",
          }}
          onClick={() => setPaymentNotice(null)}
        >
          {paymentNotice.message}
        </div>
      )}
      <div className="game-topbar">
        <div className="hud top">
          <div>
            <b>• ONLINE</b>
            <span>{totalVisitors}</span>
          </div>
        </div>
        <button
          className="game-menu-button"
          onClick={() => setGameMenuOpen(true)}
          aria-label="Open UrbanCity menu"
        >
          •<span>MENU</span>
        </button>
        {gameMenuOpen && (
          <div
            className="game-menu-overlay"
            onClick={() => setGameMenuOpen(false)}
          >
            <aside className="game-menu" onClick={(e) => e.stopPropagation()}>
              <div className="game-menu-head">
                <div>
                  <b>URBANCITY</b>
                  <small>INFORMATION & SUPPORT</small>
                </div>
                <button onClick={() => setGameMenuOpen(false)}>×</button>
              </div>
              <div className="game-menu-links">
                <a href="/about">About UrbanCity</a>
                <a href="/how-it-works">How It Works</a>
                <a href="/faq">FAQ</a>
                <a href="/rules">Rules</a>
                <a href="/pricing">Pricing</a>
              </div>
              <div className="game-menu-separator">LEGAL & SUPPORT</div>
              <div className="game-menu-links">
                <a href="/terms">Terms & Conditions</a>
                <a href="/privacy">Privacy Policy</a>
                <a href="/refund-policy">Refund & Cancellation</a>
                <a href="/contact">Contact Us</a>
              </div>
            </aside>
          </div>
        )}
        <button
          className="account-button"
          onClick={() => (user ? logout() : setAuthOpen(true))}
        >
          {user ? (
            <>
              <span className="account-name">
                {user.displayName || user.username}
              </span>
              <span className="account-action">Logout</span>
            </>
          ) : (
            "Login"
          )}
        </button>
      </div>
      <div className="time-switcher">
        {(["morning", "evening", "night"] as TimeMode[]).map((m) => (
          <button
            key={m}
            className={timeMode === m ? "active" : ""}
            onClick={() => setTimeMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="hud controls">
        <b>Controls</b>
        <small>
          <kbd>W A S D</kbd> move
        </small>
        <small>
          <kbd>E</kbd> interact
        </small>
      </div>
      <button
        className="leaderboard-button"
        onClick={() => {
          setHistoryOpen(true);
          loadLeaderboard();
        }}
      >
        Leaderboard
      </button>
      <MiniMap players={players} />
      <div className="billcount">
        <div>
          • Total Visitors <b>{siteTotalVisitors}</b>
        </div>
        <div>
          • Billboards <b>{MAP_BILLBOARDS.length} total</b>
        </div>
      </div>
      {nearby && !selected && (
        <button
          className="interact"
          onClick={() => {
            setSelected(nearby);
            loadAllActiveBillboards();
          }}
        >
          <kbd>E</kbd>
          <span>Interact</span>
        </button>
      )}
      {selected && (
        <div className="panel">
          <button className="close" onClick={() => setSelected(null)}>
            ×
          </button>
          <h2>
            {siteUrl ? (
              <a
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
                className="company-link"
              >
                {companyName} <span>↗</span>
              </a>
            ) : (
              companyName
            )}
          </h2>
          <p>{description}</p>
          <div className="tag">{selected.traffic} Traffic</div>
          <div className="stat">
            <span>Footfall Till Date</span>
            <b>{footfallTotals[selected.id] || 0}</b>
          </div>
          {active && (
            <>
              <div className="stat">
                <span>Ends</span>
                <b>{shortDate(active.endDate)}</b>
              </div>
              <div className="stat">
                <span>Time remaining</span>
                <b>{remaining(active.endDate)}</b>
              </div>
            </>
          )}
          {isOwner && (
            <div style={{ margin: "12px 0" }}>
              {!editMode ? (
                <button className="bid" onClick={() => setEditMode(true)}>
                  Edit My Board
                </button>
              ) : (
                <div
                  style={{
                    padding: 10,
                    border: "1px solid rgba(143,240,179,.35)",
                    borderRadius: 10,
                  }}
                >
                  <b>Edit your active advertisement</b>
                  <input
                    value={bookingCompanyName}
                    onChange={(e) => setBookingCompanyName(e.target.value)}
                    placeholder="Company name"
                    style={inputStyle}
                  />
                  <input
                    value={adTitle}
                    onChange={(e) => setAdTitle(e.target.value)}
                    placeholder="Company description"
                    style={inputStyle}
                  />
                  <input
                    value={adUrl}
                    onChange={(e) => setAdUrl(e.target.value)}
                    placeholder="Website https://example.com"
                    type="url"
                    style={inputStyle}
                  />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      setAdFile(e.target.files?.[0] || null);
                      setRemovePhoto(false);
                    }}
                    style={{ width: "100%", marginTop: 8 }}
                  />
                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={removePhoto}
                      onChange={(e) => {
                        setRemovePhoto(e.target.checked);
                        if (e.target.checked) setAdFile(null);
                      }}
                    />{" "}
                    Remove photo and show text only
                  </label>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      className="bid"
                      onClick={saveCreative}
                      disabled={editBusy}
                    >
                      {editBusy ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      className="duration-step"
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ margin: "12px 0" }}>
            <b>Booking duration</b>
            <div className="duration-presets">
              {[60, 300, 540, 1440].map((minutes) => (
                <button
                  key={minutes}
                  className={
                    "duration-preset " +
                    (bookingMinutes === minutes ? "active" : "")
                  }
                  onClick={() => setBookingMinutes(minutes)}
                >
                  <strong>
                    {minutes === 1440
                      ? "1 day"
                      : minutes / 60 + " hour" + (minutes === 60 ? "" : "s")}
                  </strong>
                  <small>
                    {pricingReady
                      ? formatUsd(bookingPrice(selected, minutes))
                      : "Loading price…"}
                  </small>
                </button>
              ))}
            </div>
            <div className="duration-manual">
              <button
                className="duration-step"
                onClick={() => setBookingMinutes((m) => Math.max(30, m - 30))}
              >
                −
              </button>
              <b>{formatDuration(bookingMinutes)}</b>
              <button
                className="duration-step"
                onClick={() => setBookingMinutes((m) => Math.min(2880, m + 30))}
              >
                +
              </button>
            </div>
            <small>
              Prices are controlled by the UrbanCity admin dashboard and refresh
              automatically.
            </small>
          </div>
          <div
            style={{
              margin: "12px 0",
              padding: 10,
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 10,
            }}
          >
            <b>Advertisement creative</b>
            <input
              value={bookingCompanyName}
              onChange={(e) => setBookingCompanyName(e.target.value)}
              placeholder="Company name"
              style={inputStyle}
            />
            <input
              value={adTitle}
              onChange={(e) => setAdTitle(e.target.value)}
              placeholder="Company description"
              style={inputStyle}
            />
            <input
              value={adUrl}
              onChange={(e) => setAdUrl(e.target.value)}
              placeholder="Website https://example.com"
              type="url"
              style={inputStyle}
            />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setAdFile(e.target.files?.[0] || null)}
              style={{ width: "100%", marginTop: 8 }}
            />
          </div>
          <div className="stat">
          {paymentCountry === "IN" && (
  <div
    style={{
      margin: "12px 0",
      padding: 10,
      border: "1px solid rgba(255,255,255,.12)",
      borderRadius: 10,
    }}
  >
    <b>Mobile Number</b>
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          borderRadius: 7,
          border: "1px solid #51627b",
          background: "#0a101a",
          color: "#fff",
          fontWeight: 700,
        }}
      >
        +91
      </div>
      <input
        value={customerPhone}
        onChange={(e) =>
          setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
        }
        placeholder="10-digit mobile number"
        inputMode="numeric"
        maxLength={10}
        style={{ ...inputStyle, marginTop: 0 }}
      />
    </div>
    <small style={{ display: "block", marginTop: 6 }}>
      Required for Indian users paying through Cashfree.
    </small>
  </div>
)}
            <span>Fixed price</span>
            <b>
              {pricingReady
                ? formatUsd(bookingPrice(selected, bookingMinutes))
                : "Loading…"}
            </b>
          </div>
          <small>
            {pricingReady
              ? (() => {
                  const p =
                    pricing[
                      pricingCategory(selected.type).toLowerCase() as
                        | "main"
                        | "wall"
                        | "corner"
                    ];
                  return `${pricingCategory(selected.type) === "MAIN" ? "Main" : pricingCategory(selected.type) === "WALL" ? "Wall" : "Corner"} boards: ${formatUsd(p.per30)} / 30 min · ${formatUsd(p.oneDay)} / day`;
                })()
              : "Loading current pricing…"}
          </small>
          {bookingError && <p style={{ color: "#ff8f8f" }}>{bookingError}</p>}
          <button
            className="bid"
            onClick={book}
            disabled={bookingBusy || uploadBusy || !pricingReady}
          >
            {user
              ? bookingBusy || uploadBusy
                ? uploadBusy
                  ? "Uploading..."
                  : "Opening checkout..."
                : "Book & Pay"
              : "Login to Book"}
          </button>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 9,
              flexWrap: "wrap",
              marginTop: 10,
              fontSize: 11,
            }}
          >
            <a href="/rules" style={linkStyle}>
              Rules
            </a>
            <span style={sepStyle}>•·</span>
            <a href="/faq" style={linkStyle}>
              FAQ
            </a>
            <span style={sepStyle}>•·</span>
            <a href="/terms" style={linkStyle}>
              Terms & Conditions
            </a>
            <span style={sepStyle}>•·</span>
            <a href="/privacy" style={linkStyle}>
              Privacy
            </a>
            <span style={sepStyle}>•·</span>
            <a href="/refund-policy" style={linkStyle}>
              Refunds
            </a>
          </div>
        </div>
      )}
      {historyOpen && (
        <div className="leaderboard-overlay">
          <section className="leaderboard-window">
            <button
              className="leaderboard-close"
              onClick={() => setHistoryOpen(false)}
            >
              ×
            </button>
            <div className="leaderboard-head">
              <span>URBANCITY</span>
              <h1>Leaderboard</h1>
              <p>Top advertisers by total spend</p>
            </div>
            <div className="leaderboard-list">
              {leaderboard.length === 0 ? (
                <div className="empty-state">No advertisers yet.</div>
              ) : (
                leaderboard.map((x: any) => (
                  <article
                    className="leaderboard-row"
                    key={x.username + "-" + x.name}
                  >
                    <div className="rank">#{x.rank}</div>
                    <div className="company-logo">
                      <img
                        src={x.logo || "/company-placeholder.svg"}
                        alt={x.name + " logo"}
                      />
                    </div>
                    <div className="company-main">
                      <b>{x.name}</b>
                      <small
                        style={{ fontSize: 12, opacity: 0.82, marginTop: 3 }}
                      >
                        {x.description || "Company description"}
                      </small>
                    </div>
                    <div className="leaderboard-metric">
                      <small>Total paid</small>
                      <b>{formatUsd(Number(x.totalPayment))}</b>
                    </div>
                    <div className="leaderboard-metric">
                      <small>Total time</small>
                      <b>{durationLabel(x.totalMinutes)}</b>
                    </div>
                    <a className="site-link" href={x.siteUrl}>
                      Site ↗
                    </a>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
      {authOpen && (
        <div
          data-urban-modal
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(3,7,14,.78)",
            display: "grid",
            placeItems: "center",
            backdropFilter: "blur(8px)",
            pointerEvents: "auto",
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              maxWidth: "90vw",
              background: "#111a28",
              border: "1px solid #4c5d74",
              borderRadius: 16,
              padding: 24,
              color: "#fff",
              boxShadow: "0 20px 70px #000",
            }}
          >
            <button onClick={() => setAuthOpen(false)} style={closeButtonStyle}>
              ×
            </button>
            <h2 style={{ marginTop: 0 }}>UrbanCity Account</h2>
            <p style={{ color: "#aeb9c8" }}>
              {authMode === "login"
                ? "Login to book advertising space."
                : "Create an account."}
            </p>
            {authMode === "register" && (
              <>
                <input
                  ref={authInputRef}
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="Company name"
                  style={authInputStyle}
                />
                <input
                  value={authWebsite}
                  onChange={(e) => setAuthWebsite(e.target.value)}
                  placeholder="Company website"
                  type="url"
                  style={authInputStyle}
                />
              </>
            )}
            <input
              ref={authMode === "login" ? authInputRef : undefined}
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Email"
              type="email"
              style={authInputStyle}
            />
            <input
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Password"
              type="password"
              style={authInputStyle}
            />
            {authError && <p style={{ color: "#ff8f8f" }}>{authError}</p>}
            <button
              onClick={submitAuth}
              disabled={authBusy}
              style={authSubmitStyle}
            >
              {authBusy
                ? "Please wait..."
                : authMode === "login"
                  ? "Login"
                  : "Create Account"}
            </button>
            <button
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthError("");
              }}
              style={authSwitchStyle}
            >
              {authMode === "login"
                ? "Need an account? Register"
                : "Already have an account? Login"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  marginTop: 8,
  padding: 9,
  borderRadius: 7,
  border: "1px solid #51627b",
  background: "#0a101a",
  color: "#fff",
};
const linkStyle = { color: "#9fb0c8" };
const sepStyle = { color: "#526074" };
const closeButtonStyle = {
  float: "right" as const,
  background: "transparent",
  border: 0,
  color: "#fff",
  fontSize: 22,
  cursor: "pointer",
};
const authInputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: 12,
  margin: "6px 0",
  borderRadius: 8,
  border: "1px solid #51627b",
  background: "#0a101a",
  color: "#fff",
};
const authSubmitStyle = {
  width: "100%",
  padding: 12,
  marginTop: 10,
  border: 0,
  borderRadius: 8,
  background: "#e5b75b",
  fontWeight: 800,
  cursor: "pointer",
};
const authSwitchStyle = {
  width: "100%",
  padding: 10,
  marginTop: 8,
  border: "1px solid #51627b",
  borderRadius: 8,
  background: "transparent",
  color: "#dbe5f3",
  cursor: "pointer",
};
