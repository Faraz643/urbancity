import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(repoRoot, "frontend", "src", "AppShellLegacy.tsx");
let s = fs.readFileSync(file, "utf8");

const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const replaceOnce = (pattern, replacement, message) => {
  const next = s.replace(pattern, replacement);
  ensure(next !== s, message);
  s = next;
};

if (!s.includes('"./components/AppShell/GameMenu"')) {
  s = s.replace('import { MiniMap } from "./components/Game/MiniMap";\n', 'import { MiniMap } from "./components/Game/MiniMap";\nimport { GameMenu } from "./components/AppShell/GameMenu";\nimport { GameHud } from "./components/AppShell/GameHud";\nimport { Leaderboard } from "./components/AppShell/Leaderboard";\nimport { AuthModal } from "./components/AppShell/AuthModal";\nimport { BillboardPanel } from "./components/AppShell/BillboardPanel";\n');
  const gameStart = s.indexOf('      <div className="game-topbar">');
  const nearbyStart = s.indexOf('      {nearby && !selected && (', gameStart);
  ensure(gameStart >= 0 && nearbyStart >= 0, "Could not locate AppShell HUD block");
  const hud = `      <GameMenu open={gameMenuOpen} onClose={() => setGameMenuOpen(false)} />\n      <GameHud totalVisitors={totalVisitors} siteTotalVisitors={siteTotalVisitors} billboardCount={MAP_BILLBOARDS.length} user={user} timeMode={timeMode} onMenuOpen={() => setGameMenuOpen(true)} onLogin={() => setAuthOpen(true)} onLogout={logout} onTimeMode={setTimeMode} onLeaderboard={() => { setHistoryOpen(true); loadLeaderboard(); }} />\n`;
  s = s.slice(0, gameStart) + hud + s.slice(nearbyStart);
  const selectedStart = s.indexOf('      {selected && (');
  const historyStart = s.indexOf('      {historyOpen && (');
  ensure(selectedStart >= 0 && historyStart >= 0, "Could not locate billboard modal block");
  s = s.slice(0, selectedStart) + `      {selected && (\n        <BillboardPanel selected={selected} active={active} isOwner={isOwner} companyName={companyName} siteUrl={siteUrl} description={description} footfall={footfallTotals[selected.id] || 0} pricing={pricing} pricingReady={pricingReady} bookingMinutes={bookingMinutes} bookingError={bookingError} bookingBusy={bookingBusy} uploadBusy={uploadBusy} editMode={editMode} editBusy={editBusy} removePhoto={removePhoto} bookingCompanyName={bookingCompanyName} adTitle={adTitle} adUrl={adUrl} adFile={adFile} user={user} onClose={() => setSelected(null)} onEdit={() => setEditMode(true)} onCancelEdit={() => setEditMode(false)} onSave={saveCreative} onBook={book} onMinutes={setBookingMinutes} onStepMinutes={(delta) => setBookingMinutes((m) => Math.min(2880, Math.max(30, m + delta)))} setBookingCompanyName={setBookingCompanyName} setAdTitle={setAdTitle} setAdUrl={setAdUrl} setAdFile={setAdFile} setRemovePhoto={setRemovePhoto} formatUsd={formatUsd} formatDuration={formatDuration} shortDate={shortDate} remaining={remaining} />\n      )}\n` + s.slice(historyStart);
  const historyBlock = s.indexOf('      {historyOpen && (');
  const authBlock = s.indexOf('      {authOpen && (', historyBlock);
  ensure(historyBlock >= 0 && authBlock >= 0, "Could not locate leaderboard/auth blocks");
  s = s.slice(0, historyBlock) + `      <Leaderboard open={historyOpen} leaderboard={leaderboard} onClose={() => setHistoryOpen(false)} formatUsd={formatUsd} durationLabel={durationLabel} />\n` + s.slice(authBlock);
  const authStart = s.indexOf('      {authOpen && (');
  const appEnd = s.indexOf('    </div>\n  );', authStart);
  ensure(authStart >= 0 && appEnd >= 0, "Could not locate auth UI block");
  s = s.slice(0, authStart) + `      <AuthModal open={authOpen} mode={authMode} email={authEmail} password={authPassword} username={authUsername} website={authWebsite} error={authError} busy={authBusy} emailRef={authInputRef} registerRef={authInputRef} onClose={() => setAuthOpen(false)} onModeChange={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }} onSubmit={submitAuth} setEmail={setAuthEmail} setPassword={setAuthPassword} setUsername={setAuthUsername} setWebsite={setAuthWebsite} />\n` + s.slice(appEnd);
}

if (!s.includes('"./hooks/useAuth"')) {
  s = s.replace('import { useEffect, useMemo, useRef, useState } from "react";', 'import { useEffect, useState } from "react";\nimport { useAuth } from "./hooks/useAuth";\nimport { useMultiplayer } from "./hooks/useMultiplayer";\nimport { useAnalytics } from "./hooks/useAnalytics";');
  s = s.replace('import { io, type Socket } from "socket.io-client";\n', '');
  s = s.replace(/type AuthUser = \{[\s\S]*?\};\ntype PaymentNotice = \{ message: string; ok: boolean \};\n/, '');
  const statePattern = /  const \[gameMenuOpen, setGameMenuOpen\] = useState\(false\),[\s\S]*?    \[pricingReady, setPricingReady\] = useState\(false\);/;
  const stateReplacement = `  const [gameMenuOpen, setGameMenuOpen] = useState(false),\n    [nearby, setNearby] = useState<Billboard | null>(null),\n    [selected, setSelected] = useState<Billboard | null>(null),\n    [timeMode, setTimeMode] = useState<TimeMode>("evening"),\n    [localPosition, setLocalPosition] = useState<[number, number, number]>([0, 1.4, 8]),\n    [bidders, setBidders] = useState<Record<string, BidderInfo>>({}),\n    [bookingMinutes, setBookingMinutes] = useState(30),\n    [bookingBusy, setBookingBusy] = useState(false),\n    [bookingError, setBookingError] = useState(""),\n    [paymentNotice, setPaymentNotice] = useState<{ message: string; ok: boolean } | null>(null),\n    [adFile, setAdFile] = useState<File | null>(null),\n    [adTitle, setAdTitle] = useState(""),\n    [adUrl, setAdUrl] = useState(""),\n    [bookingCompanyName, setBookingCompanyName] = useState(""),\n    [customerPhone, setCustomerPhone] = useState(""),\n    [paymentCountry, setPaymentCountry] = useState<string | null>(null),\n    [uploadBusy, setUploadBusy] = useState(false),\n    [editMode, setEditMode] = useState(false),\n    [editBusy, setEditBusy] = useState(false),\n    [removePhoto, setRemovePhoto] = useState(false),\n    [historyOpen, setHistoryOpen] = useState(false),\n    [leaderboard, setLeaderboard] = useState<any[]>([]),\n    [activeBookings, setActiveBookings] = useState<Record<string, any>>({}),\n    [clock, setClock] = useState(Date.now()),\n    [pricing, setPricing] = useState<PricingConfig>(EMPTY_PRICING),\n    [pricingReady, setPricingReady] = useState(false);`;
  replaceOnce(statePattern, stateReplacement, "Could not replace AppShell state block");
  const hookBlock = `  const auth = useAuth(api);\n  const { user, setUser, balance, setBalance, authOpen, setAuthOpen, authMode, setAuthMode, authEmail, setAuthEmail, authPassword, setAuthPassword, authUsername, setAuthUsername, authWebsite, setAuthWebsite, authError, setAuthError, authBusy, authInputRef, readApi, authHeaders, loadMe, submitAuth, logout } = auth;\n  const multiplayer = useMultiplayer(api, setBidders, setSelected, setActiveBookings);\n  const { players, socket, footfallTotals, setFootfallTotals } = multiplayer;\n  const analytics = useAnalytics(api, players, localPosition, setFootfallTotals);\n  const { siteTotalVisitors, visitorStats } = analytics;\n  const totalVisitors = players.length + 1;\n`;
  replaceOnce(/  const authInputRef = useRef<HTMLInputElement \| null>\(null\),\n    socket = useRef<Socket \| null>\(null\),\n    totalVisitors = players.length \+ 1;\n/, hookBlock, "Could not replace AppShell auth/socket refs");
  s = s.replace(/  const readApi = async \(r: Response\) => \{[\s\S]*?  const loadPricing = async \(\) => \{/, '  const toAssetUrl = (v?: string) => v ? (v.startsWith("http") ? v : api + v) : undefined;\n  const loadPricing = async () => {');
  s = s.replace(/  const toAssetUrl = \(v\?: string\) =>[\s\S]*?\n  const toAssetUrl = \(v\?: string\) =>/, '  const toAssetUrl = (v?: string) =>');
  s = s.replace(/  const loadMe = async \(\) => \{[\s\S]*?  \};\n  const loadPaymentCountry/, '  const loadPaymentCountry');
  s = s.replace(/  useEffect\(\(\) => \{\n    const makeId = \(\) => crypto\.randomUUID\(\)\.replace\(\/-\/g, ""\);[\s\S]*?  \}, \[api\]\);\n  useEffect\(\(\) => \{\n    fetch\(api \+ "\/api\/live\/billboards"\)[\s\S]*?  \}, \[api\]\);\n  const visitorStats = useMemo\(\(\) => \{[\s\S]*?  \}, \[players, localPosition\]\);\n/, '');
  s = s.replace(/  useEffect\(\(\) => \{\n    const token = localStorage\.getItem\("urbancity_token"\),\n      s = io\(api, \{ auth: token \? \{ token \} : \{\} \}\);[\s\S]*?  \}, \[api\];\n  useEffect\(\(\) => \{\n    fetch\(api \+ "\/api\/billboards"\)/, '  useEffect(() => {\n    fetch(api + "/api/billboards")');
  s = s.replace(/  const submitAuth = async \(\) => \{[\s\S]*?  const logout = \(\) => \{[\s\S]*?  \};\n  const bookingPrice/, '  const bookingPrice');
}

// Phase 3: extract billboard loading and payment-return verification.
if (!s.includes('"./hooks/useBillboards"')) {
  s = s.replace('import { useAnalytics } from "./hooks/useAnalytics";\n', 'import { useAnalytics } from "./hooks/useAnalytics";\nimport { useBillboards } from "./hooks/useBillboards";\nimport { usePaymentReturn } from "./hooks/usePaymentReturn";\n');
  const dataHook = `  const billboardData = useBillboards(api, readApi, setActiveBookings, setBidders, setPricing, setPricingReady, setLeaderboard);\n  const { loadPricing, loadAllActiveBillboards, loadLeaderboard, toAssetUrl } = billboardData;\n  usePaymentReturn(api, authHeaders, readApi, setPaymentNotice, loadAllActiveBillboards);\n`;
  replaceOnce(/  const totalVisitors = players.length \+ 1;\n/, `  const totalVisitors = players.length + 1;\n${dataHook}` , "Could not insert billboard/payment hooks");
  s = s.replace(/  const toAssetUrl = \(v\?: string\) => v \? \(v\.startsWith\("http"\) \? v : api \+ v\) : undefined;\n  const loadPricing = async \(\) => \{[\s\S]*?  const loadPaymentCountry = async/, '  const loadPaymentCountry = async');
  s = s.replace(/  const loadLeaderboard = async \(\) => \{[\s\S]*?  const uploadImageOnly/, '  const uploadImageOnly');
  s = s.replace(/  useEffect\(\(\) => \{\n  const params = new URLSearchParams\(window\.location\.search\);[\s\S]*?\n\}, \[api\]\);\n  useEffect\(\(\) => \{\n    const t = window\.setInterval\(\(\) => setClock\(Date\.now\(\)\), 1000\);/, '  useEffect(() => {\n    const t = window.setInterval(() => setClock(Date.now()), 1000);');
}

fs.writeFileSync(file, s);
console.log("AppShell organization pass complete");
