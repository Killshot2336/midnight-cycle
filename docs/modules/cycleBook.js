import { addDaysISO, daysBetweenISO } from "./guard.js";
import {
  deriveEpisodes,
  walkForward,
  bleedFinished,
  START_FLOW,
  formatMonthDay,
  formatWeekday
} from "./cycleModel.js";
import { SYMPTOM_CHIPS, insightSentence, symptomLabel } from "./insights.js";

export const CONTEXTS = [
  ["illness", "Illness"],
  ["travel", "Travel"],
  ["stress", "A hard week"],
  ["late", "Late nights"]
];

export const PRODUCTS = [
  ["", "Not noted"],
  ["pad", "Pad"],
  ["tampon", "Tampon"],
  ["cup", "Cup"],
  ["disc", "Disc"],
  ["underwear", "Period underwear"]
];

export const MUCUS = [
  ["", "Not logged"],
  ["dry", "Dry"],
  ["sticky", "Sticky"],
  ["creamy", "Creamy"],
  ["eggwhite", "Like raw egg white"]
];

function daysOf(daily, start, end) {
  const days = [];
  for (let iso = start, guard = 0; iso && iso <= end && guard < 16; iso = addDaysISO(iso, 1), guard += 1) {
    const row = daily[iso] || {};
    days.push({
      iso,
      flow: row.flow || "",
      symptoms: Array.isArray(row.symptoms) ? row.symptoms : [],
      symptomLevel: row.symptomLevel || {},
      pain: typeof row.pain === "number" ? row.pain : null,
      clots: !!row.clots,
      soaked: !!row.soaked,
      product: row.product || "",
      context: Array.isArray(row.context) ? row.context : []
    });
  }
  return days;
}

export function periodPages(vault, today) {
  const daily = vault?.daily || {};
  const situation = vault?.profile?.situation || "cycling";
  const episodes = deriveEpisodes(daily, today);
  const track = walkForward(episodes, daily, situation);
  const byStart = new Map(track.map((row) => [row.actual, row]));
  return episodes.map((episode, index) => {
    const next = episodes[index + 1];
    const window = byStart.get(episode.start) || null;
    return {
      start: episode.start,
      end: episode.end,
      bleedDays: episode.bleedDays,
      cycleLength: next ? daysBetweenISO(episode.start, next.start) : null,
      finished: bleedFinished(daily, episode, today),
      window,
      days: daysOf(daily, episode.start, episode.end)
    };
  }).reverse();
}

export function heavyDayPattern(vault, today) {
  const daily = vault?.daily || {};
  const episodes = deriveEpisodes(daily, today).filter((episode) => bleedFinished(daily, episode, today));
  const counts = {};
  let noted = 0;
  for (const episode of episodes) {
    let mark = null;
    for (const day of daysOf(daily, episode.start, episode.end)) {
      const index = daysBetweenISO(episode.start, day.iso) + 1;
      if (day.flow === "heavy") {
        mark = index;
        break;
      }
      if (day.flow === "medium" && mark == null) mark = index;
    }
    if (mark == null) continue;
    noted += 1;
    counts[mark] = (counts[mark] || 0) + 1;
  }
  let day = null;
  let support = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (count > support) {
      day = Number(key);
      support = count;
    }
  }
  if (!day || support < 3 || support / noted < 0.6) return null;
  return { day, support, episodes: noted };
}

export function heavyDaySentence(pattern) {
  if (!pattern) return "";
  return `Your heavier days are usually day ${pattern.day}.`;
}

export function mentionSentence(page) {
  if (!page) return "";
  const long = page.bleedDays > 7;
  const hard = (page.days || []).some((day) => day.soaked || (typeof day.pain === "number" && day.pain >= 7));
  if (long || hard) return "This one is worth mentioning at a visit.";
  return "";
}

export function windowSentence(page) {
  if (!page?.window) return "Too early for a window check.";
  const low = formatMonthDay(page.window.low);
  const high = formatMonthDay(page.window.high);
  const where = page.window.covered ? "This start was inside it." : "This start fell outside it.";
  return `The window then was ${low}–${high}. ${where}`;
}

export function searchNotes(vault, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits = [];
  for (const [iso, row] of Object.entries(vault?.daily || {})) {
    const notes = String(row?.notes || "");
    if (!notes.toLowerCase().includes(needle)) continue;
    hits.push({ iso, notes });
  }
  return hits.sort((a, b) => (a.iso < b.iso ? 1 : -1)).slice(0, 30);
}

export function shareSentence(model) {
  if (!model || model.paused || !model.median) return "";
  const when = formatWeekday(model.median);
  const low = formatMonthDay(model.low);
  const high = formatMonthDay(model.high);
  return `Likely bleeding around ${when} (${low}–${high}).`;
}

export function visitText(vault, from, to, today) {
  const pages = periodPages(vault, today).filter((page) => page.start >= from && page.start <= to);
  const lines = ["Cycle summary"];
  if (!pages.length) lines.push("No periods started in that range.");
  else {
    const cycles = pages.map((page) => page.cycleLength).filter((n) => n != null);
    if (cycles.length) lines.push(`Cycle lengths (days): ${cycles.join(", ")}.`);
    lines.push(`Bleeding lengths (days): ${pages.map((page) => page.bleedDays).join(", ")}.`);
    const mentions = pages.filter((page) => mentionSentence(page)).length;
    if (mentions) {
      lines.push(`${mentions} ${mentions === 1 ? "period in this range is" : "periods in this range are"} worth mentioning at a visit.`);
    }
  }
  const heavy = heavyDaySentence(heavyDayPattern(vault, today));
  if (heavy) lines.push(heavy);
  const insight = insightSentence(vault);
  if (insight) lines.push(insight);
  lines.push("This is a pattern summary, not a diagnosis.");
  return lines.join("\n");
}

export function parseStartDates(text) {
  const found = String(text || "").match(/\d{4}-\d{2}-\d{2}/g) || [];
  return [...new Set(found)];
}

export function visibleSymptoms(vault) {
  const hidden = new Set(vault?.profile?.hiddenSymptoms || []);
  const builtins = SYMPTOM_CHIPS.filter((chip) => !hidden.has(chip.id));
  const custom = (vault?.profile?.customSymptoms || [])
    .filter((item) => item?.id && item?.label && !hidden.has(item.id))
    .map((item) => ({ id: item.id, label: item.label }));
  return [...builtins, ...custom];
}

export function reminderRelevant(model, today, mode) {
  if (!model || model.paused || model.inBleed || !model.median || !today) return false;
  const setting = mode || "both";
  if (setting === "off") return false;
  const tomorrow = addDaysISO(today, 1);
  if (setting === "before") return model.median === tomorrow;
  if (setting === "day") return model.median === today;
  return model.median === today || model.median === tomorrow;
}

export function supplyLines(vault) {
  return String(vault?.profile?.supplyText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => line.slice(0, 40));
}

export function symptomLevelLabel(vault, id, level) {
  const name = symptomLabel(vault, id);
  if (level === "strong") return `${name} · strong`;
  return name;
}

export { START_FLOW };
