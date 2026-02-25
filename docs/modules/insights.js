import { inferStats, extractPeriodStarts, buildSignalProfile } from "./cycleEngine.js";
import { clamp } from "./guard.js";

function avg(arr){
  if (!arr.length) return 0;
  return arr.reduce((a,b)=>a+b,0)/arr.length;
}

export function buildInsights(state){
  const stats = inferStats(state);
  const starts = extractPeriodStarts(state.history?.events||[]);
  const days = state.history?.days || {};
  const profile = buildSignalProfile(state);

  const cards = [];

  // 1) Stability card
  const stability = clamp((10 - stats.sd)/8, 0, 1);
  cards.push({
    title: "Stability Index",
    text: `σ ≈ ${stats.sd.toFixed(1)} days • stability ${Math.round(stability*100)}%. Lower σ = tighter predictions.`
  });

  // 2) Drift card
  const drift =
    stats.meanTrend > 0.25 ? "Trending longer recently." :
    stats.meanTrend < -0.25 ? "Trending shorter recently." :
    "Stable across recent cycles.";
  cards.push({ title:"Drift Signal", text:`μ ≈ ${stats.mean.toFixed(1)} days. ${drift}` });

  // 3) Coverage card
  const keys = Object.keys(days);
  const coverage = keys.length;
  cards.push({
    title:"Signal Coverage",
    text:`${coverage} daily logs stored. More logs = better mood/energy prediction and anomaly detection.`
  });

  // 4) Pattern cards from profile
  if (profile){
    const moodDrops = [];
    const energyDrops = [];
    for (let i=1;i<profile.length;i++){
      const p = profile[i];
      if (!p || p.n < 2) continue;
      if (p.mood <= 45) moodDrops.push(i);
      if (p.energy <= 45) energyDrops.push(i);
    }

    if (moodDrops.length){
      const m = moodDrops.slice(0,5).map(d=>`D${d}`).join(", ");
      cards.push({ title:"Mood Low Pattern", text:`Low mood tends to cluster around: ${m}. This is learned from your own history.` });
    }
    if (energyDrops.length){
      const m = energyDrops.slice(0,5).map(d=>`D${d}`).join(", ");
      cards.push({ title:"Energy Low Pattern", text:`Low energy tends to cluster around: ${m}. Learned from your logs.` });
    }
  }

  // 5) Cycle history
  cards.push({
    title:"Cycle Memory",
    text:`Period starts logged: ${starts.length}. More cycles = higher model confidence.`
  });

  return {
    ok:true,
    badge: starts.length >= 4 ? "ACTIVE" : "FORMING",
    explain: "Insights are computed from your local history only. No location, no contacts, no invasive permissions.",
    cards
  };
}

export function renderInsights(mount, model){
  mount.innerHTML = "";
  for (const c of model.cards){
    const el = document.createElement("div");
    el.className = "icard";
    el.innerHTML = `<div class="t">${c.title}</div><div class="s">${c.text}</div>`;
    mount.appendChild(el);
  }
}
