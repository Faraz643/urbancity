import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { useEffect } from "react";
import { City } from "../City";
import { GameCamera } from "../GameCamera";
import { Player } from "../Player";
import { RemotePlayers } from "../RemotePlayers";
import { useBattleGame } from "../../../hooks/useBattleGame";
import BattleHUD from "./BattleHUD";

export default function HuntMode({ onExit }: { onExit: () => void }) {
  const battle = useBattleGame(import.meta.env.VITE_SERVER_URL || "http://localhost:3001");
  const phase = battle.matchEnded ? "finished" : !battle.joined ? "ready" : !battle.stats.alive ? "dead" : "playing";

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("urbancity:battle-state", { detail: { open: true } }));
    return () => window.dispatchEvent(new CustomEvent("urbancity:battle-state", { detail: { open: false } }));
  }, []);

  useEffect(() => {
    (window as any).__urbanModalOpen = phase !== "playing";
    return () => { (window as any).__urbanModalOpen = false; };
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyR" && phase === "playing") {
        e.preventDefault();
        battle.reload();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [battle.reload, phase]);

  const exitBattle = () => {
    battle.leave();
    window.dispatchEvent(new CustomEvent("urbancity:battle-state", { detail: { open: false } }));
    onExit();
  };

  return (
    <div className="app" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#05070b" }}>
      <Canvas
        shadows
        camera={{ position: [10, 9, 21], fov: 55 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))}
        onPointerMissed={() => { if (phase === "playing") battle.shoot(); }}
      >
        <GameCamera />
        <Physics gravity={[0, -20, 0]}>
          <City timeMode="evening" />
          <RemotePlayers players={battle.players.filter((p) => p.id !== battle.selfId)} battle onShoot={battle.shoot} />
          <Player
            billboards={[]}
            onNearby={() => {}}
            onMove={battle.move}
            onPosition={() => {}}
            onFootfallEnter={() => {}}
            onFootfallLeave={() => {}}
            disabled={phase !== "playing"}
            spawnPosition={battle.spawn}
            armed
          />
        </Physics>
      </Canvas>
      <BattleHUD
        phase={phase}
        stats={battle.stats}
        players={battle.players}
        timeLeft={battle.timeLeft}
        status={battle.status}
        hitMarker={battle.hitMarker}
        killFeed={battle.killFeed}
        onStart={battle.join}
        onExit={exitBattle}
        onReload={battle.reload}
      />
    </div>
  );
}
