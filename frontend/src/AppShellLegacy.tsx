import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useMultiplayer } from "./hooks/useMultiplayer";
import { useAnalytics } from "./hooks/useAnalytics";
import { useBillboards } from "./hooks/useBillboards";
import { usePaymentReturn } from "./hooks/usePaymentReturn";
import { useBooking } from "./hooks/useBooking";
import { World } from "./components/Game/World";
import { MiniMap } from "./components/Game/MiniMap";
import { HuntMode } from "./components/Game/Hunt/HuntMode";
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
import { formatDuration, formatUsd, shortDate, durationLabel, remainingTime } from "./utils/formatters";

export function AppShell() {
  const api = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
  const [gameMenuOpen, setGameMenuOpen] = useState(false),
    [huntOpen, setHuntOpen] = useState(false),
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
  const billboardData = useBillboards(api, readApi, setActiveBookings, setBidders, setPricing, setPricingReady, setLeaderboard);
  const { loadPricing, loadAllActiveBillboards, loadLeaderboard, toAssetUrl } = billboardData;
  usePaymentReturn(api, authHeaders, readApi, setPaymentNotice, loadAllActiveBillboards);
  const bookingActions = useBooking({ api, selected, user, pricingReady, bookingMinutes, bookingCompanyName, adTitle, adUrl, adFile, removePhoto, setAuthOpen, setAuthError, setBookingError, setBookingBusy, setUploadBusy, setEditBusy, setActiveBookings, setBidders, setAdFile, setRemovePhoto, setEditMode, authHeaders, readApi, loadAllActiveBillboards, toAssetUrl });
  const { book, saveCreative } = bookingActions;
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
  const remaining = (end?: string) => remainingTime(end, clock);
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

  if (huntOpen) {
    return <HuntMode onExit={() => setHuntOpen(false)} />;
  }

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
      <GameMenu open={gameMenuOpen} onClose={() => setGameMenuOpen(false)} onHunt={() => setHuntOpen(true)} />
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
        onHunt={() => setHuntOpen(true)}
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
