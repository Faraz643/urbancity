import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useMultiplayer } from "./hooks/useMultiplayer";
import { useAnalytics } from "./hooks/useAnalytics";
import { World } from "./components/Game/World";
import { MiniMap } from "./components/Game/MiniMap";
import { GameMenu } from "./components/AppShell/GameMenu";
import { GameHud } from "./components/AppShell/GameHud";
import { Leaderboard } from "./components/AppShell/Leaderboard";
import { AuthModal } from "./components/AppShell/AuthModal";
import { BillboardPanel } from "./components/AppShell/BillboardPanel";
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

export function AppShell() {
  const api = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
  const [gameMenuOpen, setGameMenuOpen] = useState(false),
    [nearby, setNearby] = useState<Billboard | null>(null),
    [selected, setSelected] = useState<Billboard | null>(null),
    [timeMode, setTimeMode] = useState<TimeMode>("evening"),
    [localPosition, setLocalPosition] = useState<[number, number, number]>([0, 1.4, 8]),
    [bidders, setBidders] = useState<Record<string, BidderInfo>>({}),
    [bookingMinutes, setBookingMinutes] = useState(30),
    [bookingBusy, setBookingBusy] = useState(false),
    [bookingError, setBookingError] = useState(""),
    [paymentNotice, setPaymentNotice] = useState<{ message: string; ok: boolean } | null>(null),
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
    [pricing, setPricing] = useState<PricingConfig>(EMPTY_PRICING),
    [pricingReady, setPricingReady] = useState(false);
  const auth = useAuth(api);
  const { user, setUser, balance, setBalance, authOpen, setAuthOpen, authMode, setAuthMode, authEmail, setAuthEmail, authPassword, setAuthPassword, authUsername, setAuthUsername, authWebsite, setAuthWebsite, authError, setAuthError, authBusy, authInputRef, readApi, authHeaders, loadMe, submitAuth, logout } = auth;
  const multiplayer = useMultiplayer(api, setBidders, setSelected, setActiveBookings);
  const { players, socket, footfallTotals, setFootfallTotals } = multiplayer;
  const analytics = useAnalytics(api, players, localPosition, setFootfallTotals);
  const { siteTotalVisitors, visitorStats } = analytics;
  const totalVisitors = players.length + 1;
  const toAssetUrl = (v?: string) => v ? (v.startsWith("http") ? v : api + v) : undefined;
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
    if (localStorage.getItem("urbancity_token"))
      loadMe().catch(() => localStorage.removeItem("urbancity_token"));
  }, []);
  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("booking");
  const orderId = params.get("order_id");

  if (
    params.get("payment") !== "return" ||
    !bookingId ||
    !localStorage.getItem("urbancity_token")
  )
    return;

  let cancelled = false;

  (async () => {
    try {
      const verifyUrl =
        api +
        "/api/payments/" +
        encodeURIComponent(bookingId) +
        "/verify" +
        (orderId ? "?order_id=" + encodeURIComponent(orderId) : "");

      const r = await fetch(verifyUrl, {
        headers: authHeaders(),
      });

      const data = await readApi(r);

      if (cancelled) return;

      if (!r.ok)
        throw new Error(data.error || "Could not verify payment");

      if (data.paid) {
        setPaymentNotice({
          message:
            "Payment successful. Your advertising space is now active.",
          ok: true,
        });

        await loadAllActiveBillboards();
      } else {
        setPaymentNotice({
          message:
            data.providerStatus === "ACTIVE"
              ? "Payment is still pending confirmation. Please refresh in a moment."
              : data.providerStatus === "PROCESSING"
                ? "Payment is still being confirmed. Please refresh in a moment."
                : "Payment was not completed.",
          ok: false,
        });
      }

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
    // for cashfree integration
//     if (paymentCountry === "IN") {
//   const phone = customerPhone.replace(/\D/g, "");

//   if (!/^\d{10}$/.test(phone)) {
//     setBookingError(
//       "Please enter your valid 10-digit Indian mobile number for Cashfree payment.",
//     );
//     return;
//   }
// }
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
// customerPhone:
//   paymentCountry === "IN"
//     ? customerPhone.replace(/\D/g, "")
//     : undefined,
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
      <GameMenu open={gameMenuOpen} onClose={() => setGameMenuOpen(false)} />
      <GameHud
        totalVisitors={totalVisitors}
        siteTotalVisitors={siteTotalVisitors}
        billboardCount={MAP_BILLBOARDS.length}
        user={user}
        timeMode={timeMode}
        onMenuOpen={() => setGameMenuOpen(true)}
        onLogin={() => setAuthOpen(true)}
        onLogout={logout}
        onTimeMode={setTimeMode}
        onLeaderboard={() => { setHistoryOpen(true); loadLeaderboard(); }}
      />
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
        <BillboardPanel
          selected={selected}
          active={active}
          isOwner={isOwner}
          companyName={companyName}
          siteUrl={siteUrl}
          description={description}
          footfall={footfallTotals[selected.id] || 0}
          pricing={pricing}
          pricingReady={pricingReady}
          bookingMinutes={bookingMinutes}
          bookingError={bookingError}
          bookingBusy={bookingBusy}
          uploadBusy={uploadBusy}
          editMode={editMode}
          editBusy={editBusy}
          removePhoto={removePhoto}
          bookingCompanyName={bookingCompanyName}
          adTitle={adTitle}
          adUrl={adUrl}
          adFile={adFile}
          user={user}
          onClose={() => setSelected(null)}
          onEdit={() => setEditMode(true)}
          onCancelEdit={() => setEditMode(false)}
          onSave={saveCreative}
          onBook={book}
          onMinutes={setBookingMinutes}
          onStepMinutes={(delta) => setBookingMinutes((m) => Math.min(2880, Math.max(30, m + delta)))}
          setBookingCompanyName={setBookingCompanyName}
          setAdTitle={setAdTitle}
          setAdUrl={setAdUrl}
          setAdFile={setAdFile}
          setRemovePhoto={setRemovePhoto}
          formatUsd={formatUsd}
          formatDuration={formatDuration}
          shortDate={shortDate}
          remaining={remaining}
        />
      )}
      <Leaderboard open={historyOpen} leaderboard={leaderboard} onClose={() => setHistoryOpen(false)} formatUsd={formatUsd} durationLabel={durationLabel} />
      <AuthModal
        open={authOpen}
        mode={authMode}
        email={authEmail}
        password={authPassword}
        username={authUsername}
        website={authWebsite}
        error={authError}
        busy={authBusy}
        emailRef={authInputRef}
        registerRef={authInputRef}
        onClose={() => setAuthOpen(false)}
        onModeChange={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}
        onSubmit={submitAuth}
        setEmail={setAuthEmail}
        setPassword={setAuthPassword}
        setUsername={setAuthUsername}
        setWebsite={setAuthWebsite}
      />
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
