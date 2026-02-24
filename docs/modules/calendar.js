import { addDays, windowBands } from "./cycleEngine.js";

export function monthGrid(year, monthIndex) {
  // monthIndex: 0..11
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startDay = first.getUTCDay(); // 0=Sun
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - startDay);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push(d.toISOString().slice(0, 10));
  }
  return cells;
}

export function buildCalendarMarkers(user) {
  const starts = new Set((user.periodStarts || []).slice());
  const last = user.lastPeriodStart || "";
  const mean = user.meanCycleDays || 28;
  const sd = user.sdCycleDays || 4.5;

  const bands = last ? windowBands(last, mean, sd) : null;
  const likely = bands ? rangeSet(bands.likely.a, bands.likely.b) : new Set();
  const possible = bands ? rangeSet(bands.possible.a, bands.possible.b) : new Set();

  return { starts, likely, possible };
}

function rangeSet(aISO, bISO) {
  const set = new Set();
  if (!aISO || !bISO) return set;
  let cur = aISO;
  for (let i = 0; i < 120; i++) {
    set.add(cur);
    if (cur === bISO) break;
    cur = addDays(cur, 1);
  }
  return set;
}