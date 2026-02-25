import { clamp } from "./guard.js";

export function learnDrift(intervals) {
  const cleaned = intervals
    .map(n => Number(n))
    .filter(n => Number.isFinite(n) && n >= 18 && n <= 60);

  const n = cleaned.length;
  if (n === 0) {
    return { samples:0, mean:28, sd:6, meanTrend:0, volatility:0.5 };
  }

  let mean = cleaned[0];
  const alpha = 0.28;
  for (let i=1;i<n;i++) mean = alpha * cleaned[i] + (1 - alpha) * mean;

  const sorted = [...cleaned].sort((a,b)=>a-b);
  const lo = sorted[Math.floor(n*0.10)];
  const hi = sorted[Math.floor(n*0.90)];
  const wins = cleaned.map(x => clamp(x, lo, hi));

  const avg = wins.reduce((a,b)=>a+b,0)/n;
  const varx = wins.reduce((a,b)=>a + (b-avg)*(b-avg),0)/n;
  const sd = Math.max(1.5, Math.min(10, Math.sqrt(varx)));

  const last3 = wins.slice(-3);
  const prev3 = wins.slice(Math.max(0, n-6), Math.max(0, n-3));
  const mLast = last3.reduce((a,b)=>a+b,0)/Math.max(1,last3.length);
  const mPrev = prev3.reduce((a,b)=>a+b,0)/Math.max(1,prev3.length);
  const meanTrend = clamp((mLast - mPrev)/6, -1, 1);

  const volatility = clamp(sd / 10, 0, 1);
  return { samples:n, mean, sd, meanTrend, volatility };
}

export function predictionBand(mean, sd, tightness = 1.0) {
  const s = Math.max(1.5, Math.min(12, sd)) * tightness;
  const early = Math.max(18, Math.round(mean - s));
  const late  = Math.min(60, Math.round(mean + s));
  const expected = Math.round(mean);
  return { early, expected, late };
}
