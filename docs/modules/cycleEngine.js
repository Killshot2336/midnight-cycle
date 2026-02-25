import { clamp } from "./guard.js";
import { learnDrift } from "./driftModel.js";

export function extractPeriodStarts(events){
  return (events || [])
    .filter(e => e && e.kind === "period_start" && typeof e.dateISO === "string")
    .map(e => e.dateISO)
    .sort();
}

export function computeIntervals(starts){
  const out = [];
  for (let i=1;i<starts.length;i++){
    const a = new Date(starts[i-1] + "T00:00:00");
    const b = new Date(starts[i]   + "T00:00:00");
    const days = Math.round((b - a) / (1000*60*60*24));
    if (Number.isFinite(days)) out.push(days);
  }
  return out;
}

export function inferStats(state){
  const starts = extractPeriodStarts(state.history?.events || []);
  const intervals = computeIntervals(starts);
  const drift = learnDrift(intervals);

  const userMean = Number(state.basics?.meanCycle || 0);
  const mean = (userMean >= 18 && userMean <= 60)
    ? (0.55 * drift.mean + 0.45 * userMean)
    : drift.mean;

  return {
    samples: drift.samples,
    mean,
    sd: drift.sd,
    meanTrend: drift.meanTrend,
    volatility: drift.volatility
  };
}

export function currentCycle(state, dateISO){
  const starts = extractPeriodStarts(state.history?.events || []);
  if (starts.length === 0) return { known:false };

  const d = new Date(dateISO + "T00:00:00");

  let lastStart = null;
  for (let i=starts.length-1;i>=0;i--){
    const s = new Date(starts[i] + "T00:00:00");
    if (s <= d) { lastStart = starts[i]; break; }
  }
  if (!lastStart) return { known:false };

  const ls = new Date(lastStart + "T00:00:00");
  const dayIndex = Math.max(1, Math.round((d - ls) / (1000*60*60*24)) + 1);

  return { known:true, lastStart, dayIndex };
}

export function phaseForDay(dayIndex, periodLen){
  const pLen = clamp(Number(periodLen || 5), 2, 12);
  if (dayIndex <= pLen) return "Menstrual";
  if (dayIndex <= pLen + 5) return "Recovery";
  if (dayIndex <= 20) return "Baseline";
  return "Premenstrual";
}

export function buildSignalProfile(state){
  const starts = extractPeriodStarts(state.history?.events || []);
  const days = state.history?.days || {};
  if (starts.length === 0) return null;

  const buckets = new Map();
  const startDates = starts.map(s => new Date(s + "T00:00:00"));
  const sortedLogDays = Object.keys(days).sort();

  for (const iso of sortedLogDays){
    const dt = new Date(iso + "T00:00:00");
    let ls = null;
    for (let i=startDates.length-1;i>=0;i--){
      if (startDates[i] <= dt){ ls = startDates[i]; break; }
    }
    if (!ls) continue;

    const idx = Math.max(1, Math.round((dt - ls)/(1000*60*60*24)) + 1);
    if (idx > 60) continue;

    const L = days[iso];
    const energy = Number(L.energy);
    const mood = Number(L.mood);
    const flow = Number(L.flow);

    const cur = buckets.get(idx) || { n:0, energySum:0, moodSum:0, flowMax:0 };
    cur.n += 1;
    if (Number.isFinite(energy)) cur.energySum += energy;
    if (Number.isFinite(mood)) cur.moodSum += mood;
    if (Number.isFinite(flow)) cur.flowMax = Math.max(cur.flowMax, flow);
    buckets.set(idx, cur);
  }

  if (buckets.size === 0) return null;

  const profile = [];
  for (let i=1;i<=60;i++){
    const b = buckets.get(i);
    profile[i] = (!b || b.n===0) ? null : {
      n: b.n,
      energy: Math.round(b.energySum / b.n),
      mood: Math.round(b.moodSum / b.n),
      flow: b.flowMax
    };
  }
  return profile;
}
