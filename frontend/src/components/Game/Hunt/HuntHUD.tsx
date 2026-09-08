import type { HuntPhase, HuntStats } from "../../../types/hunt";

const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

export default function HuntHUD({ phase, stats, accuracy, onStart, onExit }: { phase: HuntPhase; stats: HuntStats; accuracy: number; onStart: () => void; onExit: () => void }) {
  if (phase === "idle") return <div style={panel}><h2 style={{ margin: 0 }}>HUNT</h2><p style={{ opacity: .75 }}>Find the target. One shot. One kill.</p><button style={button} onClick={onStart}>START 3:00</button><button style={ghost} onClick={onExit}>RETURN TO CITY</button></div>;
  if (phase === "finished") return <div style={panel}><div style={{ fontSize: 12, opacity: .65 }}>ROUND COMPLETE</div><h1 style={{ margin: "6px 0" }}>{stats.kills}</h1><div>KILLS</div><p>🔥 Best streak: {stats.bestStreak}<br />Accuracy: {accuracy}%</p><button style={button} onClick={onStart}>PLAY AGAIN</button><button style={ghost} onClick={onExit}>RETURN TO CITY</button></div>;
  return <div style={hud}><b>{fmt(stats.timeLeft)}</b><span>KILLS {stats.kills}</span>{stats.streak > 1 && <span>🔥 {stats.streak}</span>}</div>;
}

const panel: React.CSSProperties = { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 300, padding: 24, borderRadius: 18, background: "rgba(8,12,20,.9)", color: "white", textAlign: "center", zIndex: 1000, border: "1px solid rgba(255,255,255,.15)", backdropFilter: "blur(16px)" };
const hud: React.CSSProperties = { position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 18, padding: "9px 15px", borderRadius: 999, background: "rgba(8,12,20,.75)", color: "white", zIndex: 1000, fontSize: 13, backdropFilter: "blur(10px)" };
const button: React.CSSProperties = { width: "100%", padding: "11px 14px", border: 0, borderRadius: 10, background: "white", color: "#111", fontWeight: 800, cursor: "pointer", marginTop: 8 };
const ghost: React.CSSProperties = { ...button, background: "transparent", color: "white", border: "1px solid rgba(255,255,255,.2)" };
