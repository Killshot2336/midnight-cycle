import { addDaysISO } from "./guard.js";
import { currentCycle, phaseForDay, inferStats } from "./cycleEngine.js";
import { forecast } from "./forecastEngine.js";
import { probabilityMap } from "./probability.js";

export function buildTimeline(state, days=14){
  const tISO = new Date().toISOString().slice(0,10);
  const cycle = currentCycle(state, tISO);
  const stats = inferStats(state);

  if (!cycle.known) {
    return {
      ok:false,
      badge:"UNSEEDED",
      explain:"Log at least one period start to activate timeline intelligence.",
      rows:[]
    };
  }

  const f0 = forecast(state, cycle, tISO);
  const prob = probabilityMap(stats, cycle, 21, f0.anomaly.level);

  const rows = [];
  for (let i=0;i<days;i++){
    const iso = addDaysISO(tISO, i);
    const cyc = { ...cycle, dayIndex: cycle.dayIndex + i };
    const phase = phaseForDay(cyc.dayIndex, Number(state.basics?.periodLen||5));
    const p = prob.series[i]?.p ?? 0;
    rows.push({
      dateISO: iso,
      dayIndex: cyc.dayIndex,
      phase,
      probStart: p,
      energy: f0.energyText,
      mood: f0.moodText,
      body: f0.bodyText
    });
  }

  return {
    ok:true,
    badge:`${f0.confidenceLabel} • anomaly ${Math.round(f0.anomaly.level*100)}%`,
    explain:`Timeline uses your drift signature + anomaly detection + probability map. It adapts when life disrupts your cycle.`,
    rows
  };
}

export function renderTimeline(mount, model){
  mount.innerHTML = "";
  for (const r of model.rows){
    const el = document.createElement("div");
    el.className = "tline";

    const left = document.createElement("div");
    left.innerHTML = `<div class="d">${r.dateISO}</div><div class="h">D${r.dayIndex}</div>`;

    const right = document.createElement("div");
    const pct = Math.round(r.probStart*100);
    right.innerHTML =
      `<div class="h">${r.phase} • Start-likelihood ${pct}%</div>` +
      `<div class="m">Energy: ${r.energy} • Mood: ${r.mood} • Body: ${r.body}</div>`;

    el.appendChild(left);
    el.appendChild(right);
    mount.appendChild(el);
  }
}
