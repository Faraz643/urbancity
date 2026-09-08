import { useCallback, useRef, useState } from "react";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  websiteUrl?: string | null;
  companyDescription?: string | null;
  wallet?: { balance: number } | null;
};

export type PaymentNotice = { message: string; ok: boolean };

type ReadApi = (r: Response) => Promise<any>;

export function useAuth(api: string) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [balance, setBalance] = useState(750000);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authWebsite, setAuthWebsite] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const authInputRef = useRef<HTMLInputElement | null>(null);

  const readApi = useCallback<ReadApi>(async (r) => {
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: text || `Request failed (${r.status})` };
    }
  }, []);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("urbancity_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadMe = useCallback(async () => {
    const r = await fetch(api + "/api/auth/me", { headers: authHeaders() });
    if (!r.ok) throw new Error("Session expired");
    const me = await r.json();
    setUser(me);
    if (me.wallet?.balance != null) setBalance(Number(me.wallet.balance));
    return me as AuthUser;
  }, [api, authHeaders]);

  const submitAuth = useCallback(async () => {
    setAuthError("");
    const email = authEmail.trim();
    const username = authUsername.trim();
    const website = authWebsite.trim();
    if (!email) return setAuthError("Please enter your email address.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setAuthError("Please enter a valid email address.");
    if (!authPassword) return setAuthError("Please enter your password.");
    if (authMode === "register") {
      if (!username) return setAuthError("Please enter your company name.");
      if (website) {
        try {
          const parsed = new URL(website);
          if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        } catch {
          return setAuthError(
            "Please enter a valid website URL, including https:// (for example: https://yourcompany.com).",
          );
        }
      }
    }
    setAuthBusy(true);
    try {
      const body = authMode === "login"
        ? { email, password: authPassword }
        : { email, password: authPassword, username, displayName: username, websiteUrl: website || undefined };
      const r = await fetch(api + "/api/auth/" + (authMode === "login" ? "login" : "register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readApi(r);
      if (!r.ok) throw new Error(data.error || "We could not complete your request. Please try again.");
      localStorage.setItem("urbancity_token", data.token);
      await loadMe();
      setAuthOpen(false);
      setAuthPassword("");
      setAuthWebsite("");
    } catch (e: any) {
      setAuthError(e.message || "We could not complete your request. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }, [api, authEmail, authMode, authPassword, authUsername, authWebsite, loadMe, readApi]);

  const logout = useCallback(() => {
    localStorage.removeItem("urbancity_token");
    setUser(null);
    setBalance(1000);
  }, []);

  return {
    user, setUser, balance, setBalance,
    authOpen, setAuthOpen, authMode, setAuthMode,
    authEmail, setAuthEmail, authPassword, setAuthPassword,
    authUsername, setAuthUsername, authWebsite, setAuthWebsite,
    authError, setAuthError, authBusy, authInputRef,
    readApi, authHeaders, loadMe, submitAuth, logout,
  };
}
