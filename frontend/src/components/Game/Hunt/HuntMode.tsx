import { useHuntGame } from "../../../hooks/useHuntGame";
import HuntHUD from "./HuntHUD";

export default function HuntMode({ onExit }: { onExit: () => void }) {
  const hunt = useHuntGame();
  return <HuntHUD phase={hunt.phase} stats={hunt.stats} accuracy={hunt.accuracy} onStart={hunt.start} onExit={onExit} />;
}
