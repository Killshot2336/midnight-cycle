import { clamp } from "./guard.js";
import { inferStats, phaseForDay, buildSignalProfile } from "./cycleEngine.js";
import { predictionBand } from "./driftModel.js";

function addDaysISO(iso, days){
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}

function confidenceLabel(score){
  if (score >= 80) return "Very High";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Learning";
}

export function detectAnomaly(state, stats){
  // anomaly = unusual recent logs vs baseline + high volatility trend
  const days = state.history?.days || {};
  const today = new Date(new Date().toISOString().slice(0,10)+"T00:00:00");

  let recent=0, heavyShift=0;
  const vals=[];
  for (let i=0;i<10;i++){
    const d = new Date(today); d.setDate(d.getDate()-i);
    const iso = d.toISOString().slice(0,10);
    const L = days[iso];
    if (!L) continue;
    recent++;
    const e = Number(L.energy ?? 55);
    const m = Number(L.mood ?? 55);
    if (Number.isFinite(e) && Number.isFinite(m)) vals.push((e+m)/2);
  }

  let level = 0;
  let reason = "";

  if (vals.length >= 5){
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
    // "shift" defined as far from neutral 55-ish
    heavyShift = Math.abs(avg - 55);
    if (heavyShift >= 14) { level = 0.7; reason = "Recent signals shifted strongly (possible stress/illness/travel)."; }
    else if (heavyShift >= 9) { level = 0.4; reason = "Recent signals shifted (possible short-term disruption)."; }
  }

  // volatility-driven widening
  if (stats.volatility >= 0.75){
    level = Math.max(level, 0.5);
    if (!reason) reason = "High irregularity detected (wide variance).";
  }

  if (recent <= 2){
    level = Math.max(level, 0.3);
    if (!reason) reason = "Low recent logging; confidence reduced.";
  }

  return { level: clamp(level,0,1), reason: reason || "Normal stability." };
}

export function forecast(state, cycle, todayISO){
  const stats = inferStats(state);
  const periodLen = clamp(Number(state.basics?.periodLen || 5), 2, 12);

  const anomaly = detectAnomaly(state, stats);
  const tightness = 1 + stats.volatility*0.8 + anomaly.level*0.7;
  const band = predictionBand(stats.mean, stats.sd, tightness);

  const earlyISO = addDaysISO(cycle.lastStart, band.early);
  const expectedISO = addDaysISO(cycle.lastStart, band.expected);
  const lateISO = addDaysISO(cycle.lastStart, band.late);

  // confidence score
  const days = state.history?.days || {};
  const today = new Date(todayISO + "T00:00:00");
  let recent=0;
  for (let i=0;i<7;i++){
    const d = new Date(today); d.setDate(d.getDate()-i);
    if (days[d.toISOString().slice(0,10)]) recent++;
  }
  const recency = clamp(recent/7, 0, 1);
  const sampleScore = clamp(stats.samples/10, 0, 1);
  const stability = clamp((10 - stats.sd)/8, 0, 1);

  let confidenceScore = Math.round(100 * (sampleScore*0.45 + stability*0.35 + recency*0.20));
  confidenceScore = Math.round(confidenceScore * (1 - anomaly.level*0.22));
  const conf = confidenceLabel(confidenceScore);

  const phase = phaseForDay(cycle.dayIndex, periodLen);

  const profile = buildSignalProfile(state);
  const p = profile?.[cycle.dayIndex] || null;

  const energy = p?.energy ?? Math.round(55 + (stability*10) - (stats.volatility*10));
  const mood   = p?.mood ?? Math.round(55 + (recency*8) - (stats.volatility*8));

  const energyText = energy >= 70 ? "High / driven" : (energy >= 50 ? "Normal / steady" : "Low / drained");
  const moodText   = mood >= 70 ? "Clear / confident" : (mood >= 50 ? "Stable / normal" : "Sensitive / heavy");

  let bodyText = "Neutral";
  if (phase === "Menstrual") bodyText = "Cramp risk + low endurance";
  else if (phase === "Recovery") bodyText = "Energy returning; lighter body load";
  else if (phase === "Baseline") bodyText = "Most stable window";
  else if (phase === "Premenstrual") bodyText = "Irritability + bloating risk";

  const expectedText = `Next start window: ${earlyISO} → ${lateISO} (expected ~${expectedISO}).`;

  const driftNote =
    stats.meanTrend > 0.25 ? "Trend: longer recently." :
    stats.meanTrend < -0.25 ? "Trend: shorter recently." :
    "Trend: stable.";

  const insightText =
    `${expectedText} Confidence: ${conf} (${confidenceScore}). ${driftNote} ` +
    `Anomaly: ${Math.round(anomaly.level*100)}% • ${anomaly.reason}`;

  const forecastBadge =
    confidenceScore >= 80 ? "LOCKED" :
    confidenceScore >= 60 ? "STABLE" :
    confidenceScore >= 40 ? "FORMING" : "LEARNING";

  const startDeltaDays = (new Date(expectedISO) - new Date(todayISO + "T00:00:00")) / (1000*60*60*24);
  const heat = clamp(1 - Math.abs(startDeltaDays)/12, 0, 1);

  return {
    stats,
    anomaly,
    confidenceLabel: conf,
    confidenceScore,
    forecastBadge,

    phaseText: phase,
    expectedText,
    energyText,
    moodText,
    bodyText,
    insightText,

    heat,
    next: { earlyISO, expectedISO, lateISO }
  };
}
