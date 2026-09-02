import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function StartupGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Starting UrbanCity...');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    const ticker = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setElapsed(seconds);
      if (seconds >= 3) setStatus(seconds < 15 ? 'Connecting to city services...' : 'Waking up UrbanCity services...');
    }, 500);

    const connect = async () => {
      setStatus('Connecting to UrbanCity...');
      while (!cancelled) {
        try {
          const response = await fetch(API_BASE + '/health', { cache: 'no-store' });
          if (response.ok) {
            setStatus('City services ready');
            window.setTimeout(() => { if (!cancelled) setReady(true); }, 400);
            return;
          }
        } catch {}
        await new Promise(resolve => window.setTimeout(resolve, 2000));
      }
    };
    void connect();
    return () => { cancelled = true; window.clearInterval(ticker); };
  }, []);

  if (ready) return <>{children}</>;

  const stage = elapsed < 1 ? 1 : elapsed < 3 ? 2 : 3;
  return <div className="startup-screen">
    <div className="startup-card">
      <div className="startup-logo">URBANCITY</div>
      <div className="startup-subtitle">DIGITAL ADVERTISING CITY</div>
      <div className="startup-spinner" />
      <div className="startup-status">{status}</div>
      <div className="startup-steps">
        <div className={stage >= 1 ? 'done' : ''}>✓ Loading application</div>
        <div className={stage >= 2 ? 'done' : ''}>✓ Preparing city assets</div>
        <div className={stage >= 3 ? 'active' : ''}>◌ Connecting city services</div>
      </div>
      {elapsed >= 5 && <div className="startup-wait">This can take a moment when city services are starting.</div>}
    </div>
  </div>;
}
