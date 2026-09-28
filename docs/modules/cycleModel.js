import { addDaysISO, daysBetweenISO, clamp } from "./guard.js";

const START_FLOW = new Set(["light", "medium", "heavy"]);
const ANY_FLOW = new Set(["spotting", "light", "medium", "heavy"]);
const Z80 = 1.2815515655446004;

const PRIOR = {
  follicular: { mu: 15, n: 1, sd: 3.2, min: 8, max: 40 },
  luteal: { mu: 13.5, n: 8, sd: 1.2, min: 9, max: 18 },
  bleed: { mu: 5, n: 2, sd: 1.4, min: 2, max: 10 }
};

const SYMPTOM_IDS = [
  "cramps", "headache", "bloating", "breast",
  "moodLow", "moodHigh", "energyLow", "energyHigh",
  "sleepPoor", "stress"
];

const SYMPTOM_FROM = -16;
const SYMPTOM_TO = 3;

const SYMPTOM_BACKOFF = {
  cramps: { at: -1, n: 2 },
  headache: { at: -1, n: 1 },
  bloating: { at: -2, n: 1 },
  breast: { at: -3, n: 1.5 },
  moodLow: { at: -2, n: 1 },
  moodHigh: { at: -14, n: 0.4 },
  energyLow: { at: -1, n: 1 },
  energyHigh: { at: -14, n: 0.8 },
  sleepPoor: { at: -2, n: 0.5 },
  stress: { at: -3, n: 0.5 }
};

function symptomAt(back) {
  const at = Number.isFinite(back?.at) ? back.at : -1;
  return Math.min(SYMPTOM_TO, Math.max(SYMPTOM_FROM, at));
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function validDay(iso) {
  if (!ISO_DAY.test(iso || "")) return false;
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}` === iso;
}

function nextDay(iso) {
  if (!validDay(iso)) return null;
  const next = addDaysISO(iso, 1);
  return validDay(next) && next > iso ? next : null;
}

export function deriveEpisodes(daily, throughISO) {
  const map = daily || {};
  const marked = Object.keys(map).filter((iso) => validDay(iso) && ANY_FLOW.has(map[iso]?.flow)).sort();
  if (!marked.length) return [];

  let end = marked[marked.length - 1];
  if (validDay(throughISO) && throughISO > end) end = throughISO;

  const episodes = [];
  let cur = null;
  let gap = 0;

  for (let iso = marked[0]; iso && iso <= end; iso = nextDay(iso)) {
    const flow = map[iso]?.flow;
    const any = ANY_FLOW.has(flow);
    if (!cur) {
      if (START_FLOW.has(flow)) {
        cur = { start: iso, end: iso, bleedDays: 1 };
        gap = 0;
      }
    } else if (any) {
      cur.end = iso;
      cur.bleedDays += 1;
      gap = 0;
    } else {
      gap += 1;
      if (gap >= 2) {
        episodes.push(cur);
        cur = null;
        gap = 0;
      }
    }
  }
  if (cur) episodes.push(cur);
  return episodes;
}

function recencyWeight(index, count) {
  const age = count - 1 - index;
  return Math.pow(0.5, age / 3);
}

function fitSeries(values, prior, wide) {
  const n0 = wide ? prior.n * 0.5 : prior.n;
  const sd0 = wide ? prior.sd * 1.7 : prior.sd;
  const mu = prior.mu;
  const count = values.length;
  let sumW = 0;
  let sumWX = 0;
  values.forEach((x, i) => {
    const w = recencyWeight(i, count);
    sumW += w;
    sumWX += w * x;
  });
  const mean = sumW > 0 ? (n0 * mu + sumWX) / (n0 + sumW) : mu;

  let sampleVar = sd0 * sd0;
  if (count >= 2 && sumW > 0) {
    let acc = 0;
    values.forEach((x, i) => {
      const w = recencyWeight(i, count);
      acc += w * (x - mean) * (x - mean);
    });
    sampleVar = acc / sumW;
  }

  const priorVar = sd0 * sd0;
  const varBlend = (n0 * priorVar + sumW * sampleVar) / (n0 + Math.max(sumW, 0.0001));
  const meanVar = priorVar / (n0 + Math.max(sumW, 0.0001));
  let predSd = Math.sqrt(Math.max(0, varBlend + meanVar));
  predSd = Math.max(1.15, predSd);
  if (wide) predSd *= 1.25;
  return { mean, predSd, sumW };
}

function tempC(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value > 50) return (value - 32) * 5 / 9;
  return value;
}

function detectOvulation(daily, cycleStart, nextStart) {
  const days = [];
  for (let iso = cycleStart; iso < nextStart; iso = addDaysISO(iso, 1)) {
    days.push({ iso, ...(daily?.[iso] || {}) });
  }

  for (let i = 0; i < days.length; i++) {
    if (days[i].lh === "pos") {
      return { ovulation: days[i + 1]?.iso || days[i].iso, source: "lh" };
    }
  }

  const temps = days.map((d) => tempC(d.bbt));
  for (let i = 3; i < days.length - 1; i++) {
    const prev = temps.slice(i - 3, i);
    if (prev.some((t) => t == null)) continue;
    const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
    if (temps[i] != null && temps[i + 1] != null && temps[i] >= avg + 0.2 && temps[i + 1] >= avg + 0.15) {
      let ovulation = addDaysISO(days[i].iso, -1);
      for (let j = i; j >= Math.max(0, i - 5); j--) {
        if (days[j].mucus === "eggwhite") {
          ovulation = days[j].iso;
          break;
        }
      }
      return { ovulation, source: "bbt" };
    }
  }
  return null;
}

function cycleRows(episodes, daily) {
  const rows = [];
  for (let i = 1; i < episodes.length; i++) {
    const from = episodes[i - 1].start;
    const to = episodes[i].start;
    const L = daysBetweenISO(from, to);
    if (L < 15 || L > 90) continue;
    const row = { L, from, to, follicular: null, luteal: null, marker: null };
    const mark = detectOvulation(daily, from, to);
    if (mark) {
      const fol = daysBetweenISO(from, mark.ovulation);
      const lut = daysBetweenISO(mark.ovulation, to);
      if (fol >= PRIOR.follicular.min && fol <= PRIOR.follicular.max) row.follicular = fol;
      if (lut >= PRIOR.luteal.min && lut <= PRIOR.luteal.max) row.luteal = lut;
      if (row.follicular != null || row.luteal != null) row.marker = mark.source;
    }
    rows.push(row);
  }
  return rows;
}

export function fitEpisodes(episodes, daily, situation, today = null) {
  const wide = situation === "postpartum" || situation === "irregular";
  const rows = cycleRows(episodes || [], daily || {});
  const lutealValues = rows.filter((r) => r.luteal != null).map((r) => r.luteal);
  const luteal = fitSeries(lutealValues, PRIOR.luteal, wide);
  const follicularValues = rows.map((r) => (r.follicular != null ? r.follicular : r.L - luteal.mean))
    .filter((x) => x >= PRIOR.follicular.min && x <= PRIOR.follicular.max);
  const follicular = fitSeries(follicularValues, PRIOR.follicular, wide);

  const bleedValues = (episodes || []).filter((e, i, arr) => {
    if (!today || i < arr.length - 1) return true;
    return bleedFinished(daily, e, today);
  }).map((e) => e.bleedDays);
  const bleed = fitSeries(bleedValues, PRIOR.bleed, wide);

  let sdF = follicular.predSd;
  let sdL = luteal.predSd;
  if (situation === "hormonal") {
    sdF *= 1.4;
    sdL *= 1.4;
  }

  return {
    muF: follicular.mean,
    sdF,
    muL: luteal.mean,
    sdL,
    muB: clamp(bleed.mean, 2, 10),
    sdB: bleed.predSd,
    cycleLengths: rows.map((r) => r.L),
    markerCount: rows.filter((r) => r.marker).length,
    wide
  };
}

export function predictIntervalDays(cycleLengths, situation = "cycling") {
  const episodes = lengthsToEpisodes(cycleLengths);
  const fit = fitEpisodes(episodes, {}, situation);
  return Math.round(fit.muF + fit.muL);
}

function lengthsToEpisodes(cycleLengths) {
  let iso = "2020-01-01";
  const episodes = [{ start: iso, end: iso, bleedDays: 5 }];
  for (const L of cycleLengths) {
    iso = addDaysISO(iso, L);
    episodes.push({ start: iso, end: iso, bleedDays: 5 });
  }
  return episodes;
}

export function walkForward(episodes, daily, situation = "cycling") {
  const out = [];
  const list = episodes || [];
  for (let i = 2; i < list.length; i++) {
    const prior = list.slice(0, i);
    const fit = fitEpisodes(prior, daily || {}, situation);
    const prev = prior[prior.length - 1].start;
    const mean = fit.muF + fit.muL;
    const sd = Math.hypot(fit.sdF, fit.sdL);
    const median = addDaysISO(prev, Math.round(mean));
    const low = addDaysISO(prev, Math.round(mean - Z80 * sd));
    const high = addDaysISO(prev, Math.round(mean + Z80 * sd));
    const actual = list[i].start;
    const error = daysBetweenISO(median, actual);
    const covered = actual >= low && actual <= high;
    out.push({ actual, median, low, high, error, covered });
  }
  return out;
}

function hashSeed(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function makeDraws(fit, lastStart, today, seed) {
  const rng = mulberry32(seed);
  const draws = [];
  for (let i = 0; i < 2000; i++) {
    const f = clamp(fit.muF + gauss(rng) * fit.sdF, PRIOR.follicular.min, PRIOR.follicular.max);
    const l = clamp(fit.muL + gauss(rng) * fit.sdL, PRIOR.luteal.min, PRIOR.luteal.max);
    const b = clamp(Math.round(fit.muB + gauss(rng) * fit.sdB), PRIOR.bleed.min, PRIOR.bleed.max);
    const next = addDaysISO(lastStart, Math.round(f + l));
    if (today && next < today) continue;
    const ovu = addDaysISO(next, -Math.round(l));
    draws.push({
      next,
      ovu,
      bleedDays: b,
      fertileStart: addDaysISO(ovu, -5)
    });
  }
  return draws;
}

function percentileDate(dates, p) {
  if (!dates.length) return null;
  const sorted = [...dates].sort();
  const idx = clamp(Math.round((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[idx];
}

export function formatWeekday(iso) {
  return formatParts(iso, { weekday: "short", month: "short", day: "numeric" });
}

export function formatMonthDay(iso) {
  return formatParts(iso, { month: "short", day: "numeric" });
}

function formatParts(iso, options) {
  if (!validDay(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(dt).replace(",", "");
}

export function buildForecastModel(vault, today) {
  const daily = vault?.daily || {};
  const situation = vault?.profile?.situation || "cycling";
  const goal = vault?.profile?.goal || "bleed";
  const episodes = deriveEpisodes(daily, today);
  const fit = fitEpisodes(episodes, daily, situation, today);
  const last = episodes.length ? episodes[episodes.length - 1] : null;
  const track = walkForward(episodes, daily, situation);
  const showFertile = goal === "fertility" && situation !== "hormonal" && situation !== "pregnancy";
  const paused = situation === "pregnancy" || vault?.profile?.forecastHold === true;

  const model = {
    today,
    situation,
    goal,
    paused,
    showFertile,
    episodes,
    lastStart: last?.start || null,
    muF: fit.muF,
    sdF: fit.sdF,
    muL: fit.muL,
    sdL: fit.sdL,
    muB: fit.muB,
    sdB: fit.sdB,
    cycleLengths: fit.cycleLengths,
    markerCount: fit.markerCount,
    wide: fit.wide,
    track,
    daily,
    inBleed: false,
    bleedDay: null,
    late: false,
    median: null,
    low: null,
    high: null,
    draws: [],
    ovulationOffset: fit.muF
  };

  if (paused || !last) return model;

  const flowToday = daily[today]?.flow;
  if (START_FLOW.has(flowToday)) {
    model.inBleed = true;
    model.bleedDay = daysBetweenISO(last.start, today) + 1;
  }

  const mean = fit.muF + fit.muL;
  const sd = Math.hypot(fit.sdF, fit.sdL);
  const analyticMedian = addDaysISO(last.start, Math.round(mean));
  const seed = hashSeed(`${last.start}|${situation}|${fit.cycleLengths.join(",")}|${today}`);
  let draws = makeDraws(fit, last.start, today, seed);

  if (analyticMedian < today && draws.length < 40) {
    model.late = true;
    model.median = today;
    model.low = today;
    model.high = addDaysISO(today, Math.max(1, Math.round(sd)));
    const bleedDays = clamp(Math.round(fit.muB), 2, 10);
    draws = [0, 1, 2].map((n) => {
      const next = addDaysISO(today, n === 2 ? 1 : 0);
      const ovu = addDaysISO(next, -Math.round(fit.muL));
      return { next, ovu, bleedDays, fertileStart: addDaysISO(ovu, -5) };
    });
  } else if (analyticMedian < today) {
    model.late = true;
    const nexts = draws.map((d) => d.next);
    model.median = percentileDate(nexts, 0.5);
    model.low = percentileDate(nexts, 0.1);
    model.high = percentileDate(nexts, 0.9);
  } else {
    model.median = analyticMedian;
    model.low = addDaysISO(last.start, Math.round(mean - Z80 * sd));
    model.high = addDaysISO(last.start, Math.round(mean + Z80 * sd));
    if (model.low < today && !model.inBleed) model.low = today;
  }

  model.draws = draws;
  if (model.median && model.median < today) model.median = today;
  if (model.low && model.low < today && !model.inBleed) model.low = today;
  if (model.high && model.median && model.high < model.median) model.high = model.median;
  return model;
}

export function dayOutlook(model, iso, nudge = 0) {
  if (!model || model.paused) return { bleed: 0, fertile: 0, label: "Quiet" };
  const draws = model.draws || [];
  let bleedHits = 0;
  let fertileHits = 0;
  for (const d of draws) {
    const bleedEnd = addDaysISO(d.next, d.bleedDays);
    if (iso >= d.next && iso < bleedEnd) bleedHits += 1;
    if (iso >= d.fertileStart && iso <= d.ovu) fertileHits += 1;
  }
  const denom = Math.max(draws.length, 1);
  let bleed = draws.length ? bleedHits / denom : 0;
  let fertile = model.showFertile && draws.length ? fertileHits / denom : 0;

  const last = model.episodes?.length ? model.episodes[model.episodes.length - 1] : null;
  if (last && model.today && iso >= model.today && iso >= last.start && !bleedStopped(model.daily, last.end, iso)) {
    const idx = daysBetweenISO(last.start, iso);
    const expectedLen = Math.max(last.bleedDays, Math.round(model.muB || 5));
    if (idx >= 0 && idx < expectedLen) {
      const z = (idx + 0.5 - model.muB) / Math.max(model.sdB, 0.8);
      const pStay = 1 - normalCdf(z);
      bleed = 1 - (1 - bleed) * (1 - clamp(pStay, 0, 0.95));
    }
  }

  if (nudge && model.today && iso === addDaysISO(model.today, 1)) {
    bleed = clamp(bleed + nudge, 0, 0.92);
  }

  const logged = model.daily?.[iso]?.flow;
  if (logged === "none") bleed = 0;
  else if (START_FLOW.has(logged)) bleed = Math.max(bleed, 0.95);

  bleed = clamp(bleed, 0, 0.97);
  fertile = model.showFertile ? clamp(fertile, 0, 0.97) : 0;

  let label = "Quiet";
  if (bleed >= 0.34 && bleed >= fertile) label = model.situation === "hormonal" ? "Expected bleed" : "Bleeding likely";
  else if (model.showFertile && fertile >= 0.34) label = "Fertile";
  return { bleed, fertile, label };
}

function bleedStopped(daily, end, iso) {
  if (!validDay(iso)) return false;
  for (let day = nextDay(end); day && day <= iso; day = nextDay(day)) {
    if (daily?.[day]?.flow === "none") return true;
  }
  return false;
}

export function bleedFinished(daily, episode, today) {
  if (!episode?.end) return false;
  if (!today) return true;
  if (daysBetweenISO(episode.end, today) >= 2) return true;
  return bleedStopped(daily, episode.end, today);
}

function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? 1 - p : p;
}

function symptomIdsFor(vault) {
  const custom = Array.isArray(vault?.profile?.customSymptoms) ? vault.profile.customSymptoms : [];
  const extra = custom.map((s) => s?.id).filter((id) => id && !SYMPTOM_IDS.includes(id));
  return [...SYMPTOM_IDS, ...extra];
}

export function symptomTiming(vault) {
  const daily = vault?.daily || {};
  const episodes = deriveEpisodes(daily, null);
  const recent = episodes.slice(-7);
  const profiles = {};

  for (const id of symptomIdsFor(vault)) {
    const back = SYMPTOM_BACKOFF[id] || { at: -1, n: 0.2 };
    const at = symptomAt(back);
    const bins = {};
    const raw = {};
    for (let o = SYMPTOM_FROM; o <= SYMPTOM_TO; o++) {
      bins[o] = o === at ? back.n : back.n * 0.12;
      raw[o] = 0;
    }
    let cyclesSeen = 0;
    let cyclesWith = 0;

    for (let i = 0; i < recent.length - 1; i++) {
      const next = recent[i + 1].start;
      const from = addDaysISO(next, SYMPTOM_FROM);
      const to = addDaysISO(next, SYMPTOM_TO);
      cyclesSeen += 1;
      let hit = false;
      for (let iso = from; iso <= to; iso = addDaysISO(iso, 1)) {
        const list = daily[iso]?.symptoms || [];
        if (!list.includes(id)) continue;
        const off = daysBetweenISO(next, iso);
        if (raw[off] == null) continue;
        raw[off] += 1;
        bins[off] += 1;
        hit = true;
      }
      if (hit) cyclesWith += 1;
    }

    let offset = at;
    let best = -1;
    for (let o = SYMPTOM_FROM; o <= SYMPTOM_TO; o++) {
      if (bins[o] > best) {
        best = bins[o];
        offset = o;
      }
    }

    let support = 0;
    let cyclesNear = 0;
    for (let i = 0; i < recent.length - 1; i++) {
      const next = recent[i + 1].start;
      const from = addDaysISO(next, SYMPTOM_FROM);
      const to = addDaysISO(next, SYMPTOM_TO);
      let near = false;
      for (let iso = from; iso <= to; iso = addDaysISO(iso, 1)) {
        const list = daily[iso]?.symptoms || [];
        if (!list.includes(id)) continue;
        const off = daysBetweenISO(next, iso);
        if (Math.abs(off - offset) <= 1) {
          support += 1;
          near = true;
        }
      }
      if (near) cyclesNear += 1;
    }

    profiles[id] = {
      offset,
      cyclesSeen,
      cyclesWith,
      cyclesNear,
      support,
      ready: support >= 3 && cyclesNear >= 3
    };
  }
  return profiles;
}

export function topSymptom(vault) {
  const profiles = symptomTiming(vault);
  let best = null;
  for (const id of Object.keys(profiles)) {
    const p = profiles[id];
    if (!p?.ready) continue;
    if (!best || p.support > best.support) best = { id, ...p };
  }
  return best;
}

export function tomorrowNudge(vault, today) {
  const daily = vault?.daily || {};
  const logged = new Set(daily[today]?.symptoms || []);
  if (!logged.size) return 0;
  const profiles = symptomTiming(vault);
  let nudge = 0;
  for (const id of logged) {
    const p = profiles[id];
    if (!p?.ready || p.offset !== -1) continue;
    nudge += Math.min(0.12, 0.03 * p.support);
  }
  return clamp(nudge, 0, 0.12);
}

export function trackSentence(track) {
  const rows = track || [];
  if (rows.length < 3) return "Early guess. It gets personal after a few confirmed cycles.";
  const last = rows.slice(-6);
  const miss = Math.abs(last[last.length - 1].error);
  const covered = last.filter((r) => r.covered).length;
  const missText = miss === 0
    ? "Right on the day last time."
    : `Off by ${miss} day${miss === 1 ? "" : "s"} last time.`;
  return `${missText} ${covered} of ${last.length} starts fell in the window.`;
}

export function daySentence(model) {
  if (model?.paused && model.situation !== "pregnancy") return "Forecasts stay paused until you set the situation to cycling.";
  if (model?.paused) return "Forecasts stay paused while pregnancy mode is on.";
  if (!model?.lastStart || !model.today) return "Log a period start to see your window.";
  const cd = daysBetweenISO(model.lastStart, model.today) + 1;
  const lens = (model.cycleLengths || []).slice(-5);
  let range = "";
  if (lens.length === 1) range = ` Your last cycle was ${lens[0]} days.`;
  else if (lens.length > 1) {
    const lo = Math.min(...lens);
    const hi = Math.max(...lens);
    const span = lo === hi ? `${lo} days` : `${lo}–${hi} days`;
    range = ` Your last ${lens.length} cycles were ${span}.`;
  }
  return `Today is day ${cd}.${range}`;
}

export function headlineFor(model) {
  if (!model) return "Log a period start to see your window.";
  if (model.paused && model.situation !== "pregnancy") return "Forecasts are paused until you choose cycling.";
  if (model.paused) return "Pregnancy mode is on. Period forecasts are paused.";
  if (!model.lastStart || !model.median) return "Log a period start to see your window.";
  const when = `${formatWeekday(model.median)}. Likely ${formatMonthDay(model.low)}–${formatMonthDay(model.high)}.`;
  if (model.inBleed) {
    const next = model.situation === "hormonal"
      ? `Next expected bleed most likely ${when}`
      : `Next period most likely ${when}`;
    return `Bleeding now, day ${model.bleedDay}. ${next}`;
  }
  const lead = model.situation === "hormonal" ? "Expected bleed most likely" : "Most likely";
  return `${lead} ${when}`;
}

export function lateSentence(model) {
  if (!model?.late || model.inBleed || model.paused) return "";
  return "This is later than usual for you. The most likely start is still this week.";
}

export function wideSentence(model) {
  if (!model?.wide || model.paused || !model.lastStart) return "";
  return "This window is wide on purpose while your cycles vary.";
}

export function ringReadout(model, today) {
  if (!model?.lastStart || model.paused) {
    if (model?.paused) {
      return { kicker: "", day: "Paused", hint: "Forecasts are off", frac: 0, word: true, aria: "Paused. Forecasts are off" };
    }
    return { kicker: "Day", day: "—", hint: "Log a period to begin", frac: 0, word: false, aria: "Log a period to begin" };
  }
  const length = Math.max(15, Math.round((model.muF || 15) + (model.muL || 13.5)));
  const day = daysBetweenISO(model.lastStart, today || model.today) + 1;
  if (model.inBleed) {
    const bleed = model.bleedDay || 1;
    return {
      kicker: "Day",
      day: String(bleed),
      hint: "Bleeding",
      frac: Math.max(0, Math.min(1, day / length)),
      word: false,
      aria: `Bleeding, day ${bleed}. Log today`
    };
  }
  if (model.late) {
    return {
      kicker: "",
      day: "Late",
      hint: "Past the usual length",
      frac: 1,
      word: true,
      aria: "Late. Past the usual length. Log today"
    };
  }
  const shown = Math.max(day, 1);
  return {
    kicker: "Day",
    day: String(shown),
    hint: `of about ${length}`,
    frac: Math.max(0, Math.min(1, shown / length)),
    word: false,
    aria: `Day ${shown}. Log today`
  };
}

export function quietLine(model, suppliesText) {
  const parts = [];
  if (model?.wide && !model.paused && model.lastStart) parts.push("This window is wide on purpose.");
  parts.push(trackSentence(model?.track));
  const supplies = String(suppliesText || "").trim();
  if (supplies) parts.push(supplies);
  return parts.join(" ");
}

export function fertileSentence(model) {
  if (!model?.showFertile || model.paused || !model.draws?.length) return "";
  const days = [];
  const start = model.today;
  for (let i = 0; i < 21; i++) {
    const iso = addDaysISO(start, i);
    const outlook = dayOutlook(model, iso, 0);
    if (outlook.fertile >= 0.34) days.push(iso);
  }
  if (!days.length) return "Fertile days stay a range. An LH test or waking temperature makes that range tighter. This is not contraception.";
  const note = model.markerCount > 0
    ? "This is a range, not contraception."
    : "This range uses cycle length alone. An LH test or waking temperature makes it tighter. This is not contraception.";
  return `Fertile days are most likely ${formatMonthDay(days[0])}–${formatMonthDay(days[days.length - 1])}. ${note}`;
}

export function flowOn(vault, iso) {
  const flow = vault?.daily?.[iso]?.flow;
  return ANY_FLOW.has(flow) ? flow : null;
}

export { SYMPTOM_IDS, START_FLOW, ANY_FLOW };
