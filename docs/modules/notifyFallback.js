import { loadMeta, saveMeta } from "./storage.js";
import { todayISO } from "./guard.js";

export function shouldShowBanner(tz, notifyTime, opts = {}) {
  if (!opts.relevant) return false;
  const meta = loadMeta();
  meta.fallback = meta.fallback || {};
  const today = todayISO(tz);
  if (meta.fallback.lastShown === today) return false;

  const [th, tm] = (notifyTime || "18:30").split(":").map((n) => parseInt(n, 10));
  let hour = 0;
  let minute = 0;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "America/Chicago",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date());
    hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  } catch {
    const now = new Date();
    hour = now.getHours();
    minute = now.getMinutes();
  }
  return hour > th || (hour === th && minute >= tm);
}

export function markBannerShown(tz) {
  const meta = loadMeta();
  meta.fallback = meta.fallback || {};
  meta.fallback.lastShown = todayISO(tz);
  saveMeta(meta);
}
