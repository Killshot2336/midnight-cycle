import { addDaysISO } from "./guard.js";
import { phaseProbabilities } from "./probability.js";

export function buildForecast(vault, tz, days=14, startISO) {
  const out = [];
  let iso = startISO;
  for (let i=0;i<days;i++){
    const p = phaseProbabilities(vault, iso);
    out.push({
      date: iso,
      probs: p,
      phase: pickPhase(p),
      feel: predictFeel(p)
    });
    iso = addDaysISO(iso, 1);
  }
  return out;
}

function pickPhase(p) {
  const pairs = [
    ["Period", p.period],
    ["PMS", p.pms],
    ["Ovulation", p.ovu],
    ["Neutral", p.neutral]
  ].sort((a,b)=>b[1]-a[1]);
  return pairs[0][0];
}

function predictFeel(p) {
  // “out of world” but still realistic: weighted signals
  const cramps = p.period*0.9 + p.pms*0.45;
  const energy = p.ovu*0.7 + p.neutral*0.5 - p.period*0.35 - p.pms*0.25;
  const mood = p.ovu*0.55 + p.neutral*0.5 - p.pms*0.35 - p.period*0.2;

  return {
    cramps: scoreWord(cramps),
    energy: scoreWord(energy),
    mood: scoreWord(mood)
  };

  function scoreWord(x){
    if (x >= 0.66) return "High";
    if (x >= 0.52) return "Medium";
    if (x >= 0.40) return "Low";
    return "Very low";
  }
}
