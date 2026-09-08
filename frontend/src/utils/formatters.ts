export function formatDuration(m: number) {
  return m < 60 ? "30 min" : Number.isInteger(m / 60) ? `${m / 60} hour${m === 60 ? "" : "s"}` : `${m / 60} hours`;
}

export function formatUsd(v: number) {
  return "$" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function shortDate(v: string) {
  const d = new Date(v), now = new Date(), same = d.toDateString() === now.toDateString();
  return (same ? "Today" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" })) + " •· " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function durationLabel(m: number) {
  return m >= 1440 ? `${Math.round(m / 1440)} day${Math.round(m / 1440) === 1 ? "" : "s"}` : m >= 60 ? `${Math.round(m / 60)} hour${Math.round(m / 60) === 1 ? "" : "s"}` : `${m} min`;
}

export function remainingTime(end: string | undefined, nowMs: number) {
  if (!end) return "";
  let s = Math.max(0, Math.ceil((new Date(end).getTime() - nowMs) / 1000));
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  return (d ? d + "d " : "") + String(h).padStart(2, "0") + "h " + String(m).padStart(2, "0") + "m " + String(s).padStart(2, "0") + "s";
}
