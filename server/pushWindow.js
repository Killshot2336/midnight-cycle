export function minuteOfDay(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return ((h % 24) * 60 + m) % 1440;
}

export function withinMinutes(nowHHMM, targetHHMM, minutes = 10) {
  const nowM = minuteOfDay(nowHHMM);
  const tarM = minuteOfDay(targetHHMM);
  if (nowM == null || tarM == null) return false;
  const raw = Math.abs(nowM - tarM);
  return Math.min(raw, 1440 - raw) <= minutes;
}
