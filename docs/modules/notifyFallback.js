import { loadMeta, saveMeta } from "./storage.js";
import { todayISO } from "./guard.js";

// In-app reminder fallback: if push fails or device doesn’t support it,
// show a banner after notifyTime once per day.

export function shouldShowBanner(tz, notifyTime) {
  const meta = loadMeta();
  meta.fallback = meta.fallback || {};
  const today = todayISO(tz);
  if (meta.fallback.lastShown === today) return false;

  const [hh, mm] = (notifyTime || "18:30").split(":").map(n=>parseInt(n,10));
  const now = new Date();
  // approximate (timezone accurate enough for this use case in-browser):
  const localH = now.getHours();
  const localM = now.getMinutes();
  const after = (localH > hh) || (localH === hh && localM >= mm);
  return after;
}

export function markBannerShown(tz) {
  const meta = loadMeta();
  meta.fallback = meta.fallback || {};
  meta.fallback.lastShown = todayISO(tz);
  saveMeta(meta);
}
