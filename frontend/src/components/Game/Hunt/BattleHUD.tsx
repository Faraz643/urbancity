import type { BattlePlayer, BattleStats } from "../../../types/battle";

type Props = {
  phase: "ready" | "playing" | "dead" | "finished";
  stats: BattleStats;
  players: BattlePlayer[];
  timeLeft: number;
  status: string;
  killFeed: string[];
  onStart: () => void;
  onExit: () => void;
  onReload: () => void;
};

export default function BattleHUD({ phase, stats, players, timeLeft, status, killFeed, onStart, onExit, onReload }: Props) {
  const ordered = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const seconds = Math.floor(timeLeft % 60).toString().padStart(2, "0");

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999, color: "#fff", fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ padding: "9px 16px", borderRadius: 12, background: "rgba(5,10,18,.88)", border: "1px solid rgba(255,255,255,.15)", fontWeight: 900, letterSpacing: 1 }}>{minutes}:{seconds}</div>
        <div style={{ padding: "9px 13px", borderRadius: 12, background: "rgba(20,25,35,.88)", border: "1px solid rgba(255,255,255,.12)", fontSize: 12 }}>{status}</div>
      </div>

      <div style={{ position: "absolute", top: 16, right: 16, width: 205, padding: 12, borderRadius: 14, background: "rgba(5,10,18,.86)", border: "1px solid rgba(255,255,255,.12)" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>BATTLE LEADERBOARD</div>
        {ordered.slice(0, 6).map((p, i) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", opacity: p.alive ? 1 : .5, fontSize: 12 }}>
            <span>{i + 1}. {p.name}</span><b>{p.kills}</b>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", top: 82, left: 18, display: "flex", gap: 8 }}>
        <Stat label="KILLS" value={stats.kills} />
        <Stat label="DEATHS" value={stats.deaths} />
        <Stat label="STREAK" value={stats.streak} />
      </div>

      {killFeed.length > 0 && <div style={{ position: "absolute", right: 18, top: 205, display: "grid", gap: 5, width: 250 }}>{killFeed.map((item, i) => <div key={`${item}-${i}`} style={{ padding: "7px 9px", borderRadius: 8, background: "rgba(0,0,0,.58)", fontSize: 11, textAlign: "right" }}>{item}</div>)}</div>}

      <div style={{ position: "absolute", left: 18, bottom: 18, width: 230 }}>
        <div style={{ fontSize: 11, opacity: .75, marginBottom: 5 }}>HEALTH {stats.health}</div>
        <div style={{ height: 9, borderRadius: 99, background: "rgba(255,255,255,.16)", overflow: "hidden" }}><div style={{ width: `${Math.max(0, stats.health)}%`, height: "100%", background: stats.health > 35 ? "#30e58a" : "#ff4d4d" }} /></div>
      </div>

      <div style={{ position: "absolute", right: 18, bottom: 16, textAlign: "right" }}>
        <div style={{ fontSize: 36, fontWeight: 1000, lineHeight: 1 }}>{stats.ammo}<span style={{ fontSize: 14, opacity: .55 }}> / 30</span></div>
        <div style={{ fontSize: 10, opacity: .65 }}>CLICK TO SHOOT · R TO RELOAD</div>
      </div>

      {phase === "playing" && <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 24, height: 24 }}>
        <span style={{ position: "absolute", left: 11, top: 0, width: 2, height: 24, background: "rgba(255,255,255,.95)" }} />
        <span style={{ position: "absolute", left: 0, top: 11, width: 24, height: 2, background: "rgba(255,255,255,.95)" }} />
      </div>}

      {phase === "dead" && <div style={{ position: "absolute", inset: 0, background: "rgba(120,0,0,.15)", display: "grid", placeItems: "center" }}><div style={{ textAlign: "center", padding: 25, borderRadius: 16, background: "rgba(5,8,14,.92)", border: "1px solid rgba(255,80,80,.35)" }}><div style={{ fontSize: 28, fontWeight: 1000 }}>ELIMINATED</div><div style={{ marginTop: 6, opacity: .7 }}>Respawning...</div></div></div>}

      {(phase === "ready" || phase === "finished") && <div style={{ position: "absolute", inset: 0, pointerEvents: "auto", background: "rgba(3,7,13,.68)", display: "grid", placeItems: "center" }}>
        <div style={{ width: "min(520px,90vw)", padding: 28, borderRadius: 20, background: "linear-gradient(145deg,rgba(16,25,40,.98),rgba(5,9,16,.98))", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 25px 80px rgba(0,0,0,.5)", textAlign: "center" }}>
          <div style={{ fontSize: 12, letterSpacing: 3, opacity: .55 }}>URBANCITY</div>
          <h1 style={{ margin: "7px 0", fontSize: 38 }}>BATTLE MODE</h1>
          <p style={{ opacity: .7, lineHeight: 1.6 }}>Fight real players across the city. Eliminate opponents, build a streak and top the leaderboard.</p>
          {phase === "finished" && <div style={{ margin: "14px 0", fontSize: 15 }}>Final score: <b>{stats.kills} kills</b> · {stats.deaths} deaths</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
            <button onClick={onExit} style={buttonStyle}>EXIT</button>
            <button onClick={onStart} style={{ ...buttonStyle, background: "linear-gradient(135deg,#4b6bff,#705cff)", color: "#fff", border: 0 }}>{phase === "finished" ? "PLAY AGAIN" : "START BATTLE"}</button>
          </div>
        </div>
      </div>}

      <div style={{ position: "absolute", left: "50%", bottom: 66, transform: "translateX(-50%)", fontSize: 11, opacity: .58 }}>WASD MOVE · SHIFT SPRINT · DRAG MOUSE LOOK · CLICK SHOOT · R RELOAD</div>
      {stats.ammo === 0 && phase === "playing" && <button onClick={onReload} style={{ position: "absolute", right: 18, bottom: 70, pointerEvents: "auto", padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(255,255,255,.2)", background: "rgba(0,0,0,.7)", color: "white", fontWeight: 800 }}>RELOAD</button>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div style={{ padding: "7px 11px", borderRadius: 10, background: "rgba(5,10,18,.8)", border: "1px solid rgba(255,255,255,.1)" }}><div style={{ fontSize: 9, opacity: .55 }}>{label}</div><b style={{ fontSize: 17 }}>{value}</b></div>;
}

const buttonStyle = { padding: "11px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.06)", color: "#fff", fontWeight: 900, cursor: "pointer" };
