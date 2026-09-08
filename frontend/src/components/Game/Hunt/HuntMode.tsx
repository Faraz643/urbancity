import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { useEffect } from "react";
import { City } from "../City";
import { GameCamera } from "../GameCamera";
import { Player } from "../Player";
import { useHuntGame } from "../../../hooks/useHuntGame";
import HuntHUD from "./HuntHUD";
import HuntTarget from "./HuntTarget";

function HuntOverlay() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 999 }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 22, height: 22, transform: "translate(-50%,-50%)" }}>
        <span style={{ position: "absolute", left: 10, top: 0, width: 2, height: 22, background: "rgba(255,255,255,.9)" }} />
        <span style={{ position: "absolute", left: 0, top: 10, width: 22, height: 2, background: "rgba(255,255,255,.9)" }} />
      </div>
      <div style={{ position: "absolute", right: 22, bottom: 18, width: 150, height: 82, transform: "skewX(-8deg)", borderRadius: "12px 20px 8px 8px", background: "linear-gradient(145deg,#273246,#080c13)", border: "2px solid rgba(255,255,255,.25)", boxShadow: "0 12px 30px rgba(0,0,0,.5)" }}>
        <div style={{ position: "absolute", right: -48, top: 28, width: 62, height: 16, borderRadius: 8, background: "#111722", border: "2px solid rgba(255,255,255,.2)" }} />
        <div style={{ position: "absolute", left: 28, bottom: -34, width: 34, height: 46, borderRadius: 8, background: "#111722" }} />
      </div>
    </div>
  );
}

export default function HuntMode({ onExit }: { onExit: () => void }) {
  const hunt = useHuntGame();

  useEffect(() => {
    (window as any).__urbanModalOpen = hunt.phase !== "playing";
    return () => {
      (window as any).__urbanModalOpen = false;
    };
  }, [hunt.phase]);

  return (
    <div className="app" style={{ position: "fixed", inset: 0, zIndex: 50, background: "#05070b" }}>
      <Canvas
        shadows
        camera={{ position: [10, 9, 21], fov: 55 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))}
        onPointerMissed={() => {
          if (hunt.phase === "playing") hunt.shoot(false);
        }}
      >
        <GameCamera />
        <Physics gravity={[0, -20, 0]}>
          <City timeMode="evening" />
          <Player
            billboards={[]}
            onNearby={() => {}}
            onMove={() => {}}
            onPosition={() => {}}
            onFootfallEnter={() => {}}
            onFootfallLeave={() => {}}
          />
          {hunt.phase === "playing" && (
            <HuntTarget key={hunt.targetKey} onShoot={hunt.shoot} />
          )}
        </Physics>
      </Canvas>

      {hunt.phase === "playing" && <HuntOverlay />}
      <HuntHUD
        phase={hunt.phase}
        stats={hunt.stats}
        accuracy={hunt.accuracy}
        onStart={hunt.start}
        onExit={onExit}
      />
    </div>
  );
}
