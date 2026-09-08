import type { RefObject } from "react";

type Props = {
  open: boolean;
  mode: "login" | "register";
  email: string;
  password: string;
  username: string;
  website: string;
  error: string;
  busy: boolean;
  emailRef: RefObject<HTMLInputElement | null>;
  registerRef?: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onModeChange: () => void;
  onSubmit: () => void;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  setUsername: (v: string) => void;
  setWebsite: (v: string) => void;
};

const authInputStyle = { width: "100%", boxSizing: "border-box" as const, marginTop: 8, padding: 9, borderRadius: 7, border: "1px solid #51627b", background: "#0a101a", color: "#fff" };
const authSubmitStyle = { width: "100%", marginTop: 12, padding: 11, border: 0, borderRadius: 8, background: "#4f70ff", color: "#fff", fontWeight: 700, cursor: "pointer" };
const authSwitchStyle = { width: "100%", marginTop: 8, padding: 9, border: "1px solid #51627b", borderRadius: 8, background: "transparent", color: "#cbd7e7", cursor: "pointer" };
const closeButtonStyle = { float: "right" as const, border: 0, background: "transparent", color: "#fff", fontSize: 22, cursor: "pointer" };

export function AuthModal({ open, mode, email, password, username, website, error, busy, emailRef, registerRef, onClose, onModeChange, onSubmit, setEmail, setPassword, setUsername, setWebsite }: Props) {
  if (!open) return null;
  return <div data-urban-modal onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(3,7,14,.78)", display: "grid", placeItems: "center", backdropFilter: "blur(8px)", pointerEvents: "auto" }}>
    <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} style={{ width: 360, maxWidth: "90vw", background: "#111a28", border: "1px solid #4c5d74", borderRadius: 16, padding: 24, color: "#fff", boxShadow: "0 20px 70px #000" }}>
      <button onClick={onClose} style={closeButtonStyle}>×</button>
      <h2 style={{ marginTop: 0 }}>UrbanCity Account</h2>
      <p style={{ color: "#aeb9c8" }}>{mode === "login" ? "Login to book advertising space." : "Create an account."}</p>
      {mode === "register" && <><input ref={registerRef} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Company name" style={authInputStyle} /><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Company website" type="url" style={authInputStyle} /></>}
      <input ref={mode === "login" ? emailRef : undefined} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" style={authInputStyle} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" style={authInputStyle} />
      {error && <p style={{ color: "#ff8f8f" }}>{error}</p>}
      <button onClick={onSubmit} disabled={busy} style={authSubmitStyle}>{busy ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}</button>
      <button onClick={onModeChange} style={authSwitchStyle}>{mode === "login" ? "Need an account? Register" : "Already have an account? Login"}</button>
    </div>
  </div>;
}
