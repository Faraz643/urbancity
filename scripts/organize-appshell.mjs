import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(repoRoot, "frontend", "src", "AppShellLegacy.tsx");
let s = fs.readFileSync(file, "utf8");

if (s.includes('./components/AppShell/GameMenu')) {
  console.log("AppShell UI extraction already applied");
  process.exit(0);
}

s = s.replace('import { MiniMap } from "./components/Game/MiniMap";\n', 'import { MiniMap } from "./components/Game/MiniMap";\nimport { GameMenu } from "./components/AppShell/GameMenu";\nimport { GameHud } from "./components/AppShell/GameHud";\nimport { Leaderboard } from "./components/AppShell/Leaderboard";\nimport { AuthModal } from "./components/AppShell/AuthModal";\nimport { BillboardPanel } from "./components/AppShell/BillboardPanel";\n');

const gameStart = s.indexOf('      <div className="game-topbar">');
const nearbyStart = s.indexOf('      {nearby && !selected && (', gameStart);
if (gameStart < 0 || nearbyStart < 0) throw new Error("Could not locate AppShell HUD block");
const hud = `      <GameMenu open={gameMenuOpen} onClose={() => setGameMenuOpen(false)} />\n      <GameHud\n        totalVisitors={totalVisitors}\n        siteTotalVisitors={siteTotalVisitors}\n        billboardCount={MAP_BILLBOARDS.length}\n        user={user}\n        timeMode={timeMode}\n        onMenuOpen={() => setGameMenuOpen(true)}\n        onLogin={() => setAuthOpen(true)}\n        onLogout={logout}\n        onTimeMode={setTimeMode}\n        onLeaderboard={() => { setHistoryOpen(true); loadLeaderboard(); }}\n      />\n`;
s = s.slice(0, gameStart) + hud + s.slice(nearbyStart);

const selectedBlockStart = s.indexOf('      {selected && (');
const historyStart = s.indexOf('      {historyOpen && (');
const authBlockStart = s.indexOf('      {authOpen && (');
if (selectedBlockStart < 0 || historyStart < 0 || authBlockStart < 0) throw new Error("Could not locate AppShell modal blocks");
const selectedEnd = s.indexOf('      {historyOpen && (', selectedBlockStart);
if (selectedEnd < 0) throw new Error("Could not locate end of Billboard panel block");
const panel = `      {selected && (\n        <BillboardPanel\n          selected={selected}\n          active={active}\n          isOwner={isOwner}\n          companyName={companyName}\n          siteUrl={siteUrl}\n          description={description}\n          footfall={footfallTotals[selected.id] || 0}\n          pricing={pricing}\n          pricingReady={pricingReady}\n          bookingMinutes={bookingMinutes}\n          bookingError={bookingError}\n          bookingBusy={bookingBusy}\n          uploadBusy={uploadBusy}\n          editMode={editMode}\n          editBusy={editBusy}\n          removePhoto={removePhoto}\n          bookingCompanyName={bookingCompanyName}\n          adTitle={adTitle}\n          adUrl={adUrl}\n          adFile={adFile}\n          user={user}\n          onClose={() => setSelected(null)}\n          onEdit={() => setEditMode(true)}\n          onCancelEdit={() => setEditMode(false)}\n          onSave={saveCreative}\n          onBook={book}\n          onMinutes={setBookingMinutes}\n          onStepMinutes={(delta) => setBookingMinutes((m) => Math.min(2880, Math.max(30, m + delta)))}\n          setBookingCompanyName={setBookingCompanyName}\n          setAdTitle={setAdTitle}\n          setAdUrl={setAdUrl}\n          setAdFile={setAdFile}\n          setRemovePhoto={setRemovePhoto}\n          formatUsd={formatUsd}\n          formatDuration={formatDuration}\n          shortDate={shortDate}\n          remaining={remaining}\n        />\n      )}\n`;
s = s.slice(0, selectedBlockStart) + panel + s.slice(selectedEnd);

const historyBlockStart = s.indexOf('      {historyOpen && (');
const authAfterHistory = s.indexOf('      {authOpen && (', historyBlockStart);
if (historyBlockStart < 0 || authAfterHistory < 0) throw new Error("Could not locate Leaderboard block");
s = s.slice(0, historyBlockStart) + `      <Leaderboard open={historyOpen} leaderboard={leaderboard} onClose={() => setHistoryOpen(false)} formatUsd={formatUsd} durationLabel={durationLabel} />\n` + s.slice(authAfterHistory);

const authBlock = s.indexOf('      {authOpen && (');
const appEnd = s.indexOf('    </div>\n  );', authBlock);
if (authBlock < 0 || appEnd < 0) throw new Error("Could not locate Auth block");
const auth = `      <AuthModal\n        open={authOpen}\n        mode={authMode}\n        email={authEmail}\n        password={authPassword}\n        username={authUsername}\n        website={authWebsite}\n        error={authError}\n        busy={authBusy}\n        emailRef={authInputRef}\n        registerRef={authInputRef}\n        onClose={() => setAuthOpen(false)}\n        onModeChange={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}\n        onSubmit={submitAuth}\n        setEmail={setAuthEmail}\n        setPassword={setAuthPassword}\n        setUsername={setAuthUsername}\n        setWebsite={setAuthWebsite}\n      />\n`;
s = s.slice(0, authBlock) + auth + s.slice(appEnd);

fs.writeFileSync(file, s);
console.log("AppShell UI extraction complete");
