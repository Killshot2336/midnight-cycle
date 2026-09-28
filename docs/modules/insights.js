import { addDaysISO } from "./guard.js";
import { START_FLOW, bleedFinished, deriveEpisodes, topSymptom } from "./cycleModel.js";

export const SYMPTOM_CHIPS = [
  { id: "cramps", label: "Cramps" },
  { id: "headache", label: "Headache" },
  { id: "bloating", label: "Bloating" },
  { id: "breast", label: "Breast tenderness" },
  { id: "moodLow", label: "Low mood" },
  { id: "moodHigh", label: "High mood" },
  { id: "energyLow", label: "Low energy" },
  { id: "energyHigh", label: "High energy" },
  { id: "sleepPoor", label: "Poor sleep" },
  { id: "stress", label: "Stress" }
];

const LEAD = {
  cramps: "Cramps show up",
  headache: "Headaches show up",
  bloating: "Bloating shows up",
  breast: "Breast tenderness shows up",
  moodLow: "Low mood shows up",
  moodHigh: "High mood shows up",
  energyLow: "Low energy shows up",
  energyHigh: "High energy shows up",
  sleepPoor: "Poor sleep shows up",
  stress: "Stress shows up"
};

export function offsetPhrase(offset) {
  if (offset === 0) return "on the first day of bleeding";
  if (offset > 0) return `${offset} day${offset === 1 ? "" : "s"} after bleeding starts`;
  const n = Math.abs(offset);
  return `${n} day${n === 1 ? "" : "s"} before bleeding`;
}

export function symptomLabel(vault, id) {
  const custom = (vault?.profile?.customSymptoms || []).find((s) => s?.id === id);
  if (custom?.label) return custom.label;
  return SYMPTOM_CHIPS.find((c) => c.id === id)?.label || "A symptom";
}

export function insightSentence(vault) {
  const top = topSymptom(vault);
  if (!top) return "";
  const lead = LEAD[top.id] || `${symptomLabel(vault, top.id)} shows up`;
  return `${lead} about ${offsetPhrase(top.offset)}, in ${top.cyclesNear} of your last ${top.cyclesSeen} cycles.`;
}

export function symptomDayNote(top) {
  if (!top) return "";
  const lead = LEAD[top.id] || "A symptom shows up";
  return `${lead} about ${offsetPhrase(top.offset)}.`;
}

function startFlowCount(daily, episode) {
  let count = 0;
  for (let iso = episode?.start, guard = 0; iso && episode?.end && iso <= episode.end && guard < 90; iso = addDaysISO(iso, 1), guard += 1) {
    if (START_FLOW.has(daily?.[iso]?.flow)) count += 1;
  }
  return count;
}

export function clinicianSummary(vault, model) {
  const lines = ["Cycle summary"];
  const lens = model?.cycleLengths || [];
  if (!lens.length) lines.push("No completed cycles yet.");
  else lines.push(`Recent cycle lengths (days): ${lens.slice(-6).join(", ")}.`);

  const episodes = deriveEpisodes(vault?.daily || {}, model?.today || null);
  const today = model?.today || null;
  const closed = episodes.filter((e, i, arr) => {
    if (!today || i < arr.length - 1) return true;
    return bleedFinished(vault?.daily || {}, e, today);
  });
  const bleeds = closed.slice(-6).map((e) => startFlowCount(vault?.daily || {}, e));
  if (bleeds.length) lines.push(`Recent bleeding lengths (days): ${bleeds.join(", ")}.`);

  const sentence = insightSentence(vault);
  if (sentence) lines.push(sentence);

  const outsideCycles = lens.filter((n) => n < 21 || n > 38).length;
  const longBleeds = closed.filter((e) => startFlowCount(vault?.daily || {}, e) > 7).length;
  if (outsideCycles >= 2 || longBleeds >= 2) {
    lines.push("Some cycles fall outside the usual range (about 21–38 days, bleeding usually 7 days or less).");
  }
  lines.push("This is a pattern summary, not a diagnosis.");
  return lines.join("\n");
}
