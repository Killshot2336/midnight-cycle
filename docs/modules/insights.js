import { addDaysISO } from "./guard.js";
import { deriveEpisodes, topSymptom } from "./cycleModel.js";

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

export function insightSentence(vault) {
  const top = topSymptom(vault);
  if (!top) return "";
  const lead = LEAD[top.id] || "A symptom shows up";
  return `${lead} about ${offsetPhrase(top.offset)}, in ${top.cyclesNear} of your last ${top.cyclesSeen} cycles.`;
}

export function symptomDayNote(top) {
  if (!top) return "";
  const lead = LEAD[top.id] || "A symptom shows up";
  return `${lead} about ${offsetPhrase(top.offset)}.`;
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
    return e.end < addDaysISO(today, -1);
  });
  const bleeds = closed.slice(-6).map((e) => e.bleedDays);
  if (bleeds.length) lines.push(`Recent bleeding lengths (days): ${bleeds.join(", ")}.`);

  const sentence = insightSentence(vault);
  if (sentence) lines.push(sentence);

  const outsideCycles = lens.filter((n) => n < 21 || n > 38).length;
  const longBleeds = closed.filter((e) => e.bleedDays > 7).length;
  if (outsideCycles >= 2 || longBleeds >= 2) {
    lines.push("Some cycles fall outside the usual range (about 21–38 days, bleeding usually 7 days or less).");
  }
  lines.push("This is a pattern summary, not a diagnosis.");
  return lines.join("\n");
}
