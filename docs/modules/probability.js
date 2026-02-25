import { clamp } from "./guard.js";
import { inferCycleParams, nominalWindows, dayIndexFromLastStart } from "./cycleEngine.js";

// Returns true probabilities (sum to 1.0) for:
// period, pms, ovulation, neutral
export function phaseProbabilities(vault, iso) {
  const params = inferCycleParams(vault);
  const w = nominalWindows(params.meanCycleDays);
  const idx = dayIndexFromLastStart(vault, iso);

  // If no data, be honest: low confidence, mostly neutral.
  if (idx === null) {
    return finalize({ period:0.12, pms:0.12, ovu:0.12, neutral:0.64 }, 0.25, ["No period history yet."]);
  }

  const sd = Math.max(2, Math.min(10, params.sdCycleDays));
  const cycle = w.cycle;

  // Map idx into [0, cycle) with soft wrap.
  const t = idx % cycle;

  // Gaussian-ish helpers (no heavy math)
  const g = (x, mu, s) => Math.exp(-0.5 * ((x-mu)/s)*((x-mu)/s));

  // Period center at day 0..periodLen
  const periodCenter = 1.5;
  const period = g(t, periodCenter, Math.max(1.4, sd*0.35));

  // Ovulation near ovuDay
  const ovu = g(t, w.ovuDay, Math.max(1.6, sd*0.45));

  // PMS near pmsStart..cycle end
  const pmsCenter = (w.pmsStart + (cycle-1)) / 2;
  const pms = g(t, pmsCenter, Math.max(2.0, sd*0.55));

  // Neutral baseline:
  const neutral = 0.35;

  // Normalize
  let sum = period + ovu + pms + neutral;
  let P = {
    period: period/sum,
    pms: pms/sum,
    ovu: ovu/sum,
    neutral: neutral/sum
  };

  // Confidence: higher when stable + when one phase dominates
  const maxP = Math.max(P.period, P.pms, P.ovu, P.neutral);
  const stability = 1 - clamp(params.chaosScore, 0, 1) * 0.45; // chaotic reduces confidence
  const confidence = clamp(0.25 + (maxP * 0.65) * stability, 0.15, 0.95);

  const reasons = explain(P, params, w, idx);
  return finalize(P, confidence, reasons);
}

function finalize(P, confidence, reasons) {
  // exact normalize to 1.0
  const sum = P.period + P.pms + P.ovu + P.neutral;
  const out = {
    period: P.period/sum,
    pms: P.pms/sum,
    ovu: P.ovu/sum,
    neutral: P.neutral/sum,
    confidence,
    reasons
  };
  return out;
}

function explain(P, params, w, idx) {
  const items = [];
  items.push(`Model: ${params.chaotic ? "Irregular" : "Stable"} (uncertainty ${Math.round(params.sdCycleDays)}d).`);
  if (idx !== null) items.push(`Day index from last start: ${idx}. Predicted cycle length ~${Math.round(params.meanCycleDays)}d.`);
  const best = Object.entries({period:P.period, pms:P.pms, ovulation:P.ovu, neutral:P.neutral})
    .sort((a,b)=>b[1]-a[1])[0][0];
  if (best === "period") items.push(`Highest likelihood: Period window near last start.`);
  if (best === "pms") items.push(`Highest likelihood: Late-cycle symptoms (PMS window).`);
  if (best === "ovulation") items.push(`Highest likelihood: Mid-cycle peak (ovulation window).`);
  if (best === "neutral") items.push(`No strong phase dominance today.`);
  return items;
}
