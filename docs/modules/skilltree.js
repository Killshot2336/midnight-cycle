import { clamp } from "./guard.js";
import { extractPeriodStarts } from "./cycleEngine.js";

export function computeSkill(state){
  const days = Object.keys(state.history?.days||{}).length;
  const starts = extractPeriodStarts(state.history?.events||[]).length;

  // XP design: logs + starts matter; starts are huge leverage
  const xp = Math.round(days * 4 + Math.max(0, starts-1) * 120);

  // level curve
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 60)) + 1);

  // unlocks (functional)
  const unlocks = {
    probMap: level >= 2,          // probability map
    anomaly: level >= 3,          // anomaly detection weighting
    timeline: level >= 3,         // timeline view
    insights: level >= 2,         // insight cards
    vault: level >= 2,            // encrypted export/import
    tightBands: level >= 4,       // tighter band confidence scaling
    advancedExplain: level >= 5   // deeper explainability hints
  };

  return { xp, level, unlocks };
}

export function applySkillToState(state){
  const s = computeSkill(state);
  state.skill = s;
  return s;
}

export function skillBadge(skill){
  const l = skill.level;
  if (l >= 8) return "MYTHIC";
  if (l >= 6) return "ELITE";
  if (l >= 4) return "ADVANCED";
  if (l >= 2) return "ACTIVE";
  return "SEEDING";
}
