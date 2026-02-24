// Drift-aware smoothing. Learns slowly (stable) but adapts over time.
export function smoothMean(oldMean, newInterval) {
  const mu = clamp(oldMean, 15, 60, 28);
  const x = clamp(newInterval, 15, 60, mu);

  // Adaptive alpha: larger changes update slightly faster but still stable
  const delta = Math.abs(x - mu);
  const alpha = clamp(0.08 + (delta / 30) * 0.06, 0.08, 0.16, 0.10);
  return mu + alpha * (x - mu);
}

export function smoothSD(oldSD, intervals, mean) {
  const sd0 = clamp(oldSD, 1, 12, 4.5);
  if (!intervals || intervals.length < 2) return sd0;

  const m = clamp(mean, 15, 60, 28);
  const s = std(intervals, m);
  // Slow smoothing for variability
  const alpha = 0.12;
  return clamp(sd0 + alpha * (s - sd0), 1, 12, 4.5);
}

function std(arr, mean){
  const v = arr.reduce((s,x)=>s+(x-mean)*(x-mean),0)/(arr.length-1);
  return Math.sqrt(v);
}
function clamp(v, lo, hi, fb){
  const n = Number(v);
  if (!Number.isFinite(n)) return fb;
  return Math.max(lo, Math.min(hi, n));
}