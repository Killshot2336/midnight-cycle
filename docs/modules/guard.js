export function must(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: #${id}`);
  return el;
}

export function safe(fn, fallback = null) {
  try { return fn(); } catch { return fallback; }
}

export async function safeAsync(fn, fallback = null) {
  try { return await fn(); } catch { return fallback; }
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function isoDay(d) {
  const x = (d instanceof Date) ? d : new Date(d);
  return x.toISOString().slice(0,10);
}

export function addDaysISO(iso, days){
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}
