type Props = {
  open: boolean;
  onClose: () => void;
  onHunt?: () => void;
};

export function GameMenu({ open, onClose, onHunt }: Props) {
  if (!open) return null;
  return (
    <div className="game-menu-overlay" onClick={onClose}>
      <aside className="game-menu" onClick={(e) => e.stopPropagation()}>
        <div className="game-menu-head">
          <div><b>URBANCITY</b><small>INFORMATION & SUPPORT</small></div>
          <button onClick={onClose}>×</button>
        </div>
        {onHunt && (
          <button onClick={() => { onClose(); onHunt(); }} style={{ width: "100%", marginBottom: 14, padding: "13px 14px", border: 0, borderRadius: 10, background: "linear-gradient(135deg,#4b6bff,#705cff)", color: "white", fontWeight: 900, cursor: "pointer", textAlign: "left" }}>
            🔫 BATTLE — MULTIPLAYER CITY FIGHT
          </button>
        )}
        <div className="game-menu-links">
          <a href="/about">About UrbanCity</a>
          <a href="/how-it-works">How It Works</a>
          <a href="/faq">FAQ</a>
          <a href="/rules">Rules</a>
          <a href="/pricing">Pricing</a>
        </div>
        <div className="game-menu-separator">LEGAL & SUPPORT</div>
        <div className="game-menu-links">
          <a href="/terms">Terms & Conditions</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/refund-policy">Refund & Cancellation</a>
          <a href="/contact">Contact Us</a>
        </div>
      </aside>
    </div>
  );
}
