export function safe(fn, fallback = null) {
  try { return fn(); } catch { return fallback; }
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function todayISO(tz = "America/Chicago") {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(d);
  const y = parts.find(p=>p.type==="year").value;
  const m = parts.find(p=>p.type==="month").value;
  const day = parts.find(p=>p.type==="day").value;
  return `${y}-${m}-${day}`;
}

export function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}

export function daysBetweenISO(a, b) {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}
