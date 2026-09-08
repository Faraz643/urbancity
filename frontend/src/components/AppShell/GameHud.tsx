import type { TimeMode } from "../../lib/timeTheme";

type Props = {
  gameMenuOpen?: boolean;
  user: any;
  timeMode: TimeMode;
  totalVisitors: number;
  siteTotalVisitors: number;
  billboardCount: number;
  onMenuOpen: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onTimeMode: (mode: TimeMode) => void;
  onLeaderboard: () => void;
  onHunt?: () => void;
};

export function GameHud({ totalVisitors, siteTotalVisitors, billboardCount, user, timeMode, onMenuOpen, onLogin, onLogout, onTimeMode, onLeaderboard, onHunt }: Props) {
  return <>
    <div className="game-topbar">
      <div className="hud top"><div><b>• ONLINE</b><span>{totalVisitors}</span></div></div>
      <button className="game-menu-button" onClick={onMenuOpen} aria-label="Open UrbanCity menu">•<span>MENU</span></button>
      <button className="account-button" onClick={user ? onLogout : onLogin}>
        {user ? <><span className="account-name">{user.displayName || user.username}</span><span className="account-action">Logout</span></> : "Login"}
      </button>
    </div>
    <div className="time-switcher">
      {(["morning", "evening", "night"] as TimeMode[]).map((m) => <button key={m} className={timeMode === m ? "active" : ""} onClick={() => onTimeMode(m)}>{m}</button>)}
    </div>
    <div className="hud controls"><b>Controls</b><small><kbd>W A S D</kbd> move</small><small><kbd>E</kbd> interact</small></div>
    <button className="leaderboard-button" onClick={onLeaderboard}>Leaderboard</button>
    {onHunt && <button className="leaderboard-button" style={{ top: 334, background: "linear-gradient(135deg,#4b6bff,#705cff)", color: "#fff", fontWeight: 900 }} onClick={onHunt}>🔫 BATTLE</button>}
    <div className="billcount"><div>• Total Visitors <b>{siteTotalVisitors}</b></div><div>• Billboards <b>{billboardCount} total</b></div></div>
  </>;
}
