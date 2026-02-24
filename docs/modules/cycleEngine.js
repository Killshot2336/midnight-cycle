export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(aISO, bISO) {
  const a = new Date(aISO + "T00:00:00Z");
  const b = new Date(bISO + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

export function computeStatsFromStarts(starts) {
  const s = (starts || []).slice().sort();
  const intervals = [];
  for (let i = 1; i < s.length; i++) {
    const d = daysBetween(s[i - 1], s[i]);
    if (d >= 15 && d <= 60) intervals.push(d);
  }
  const mean = intervals.length ? avg(intervals) : 28;
  const sd = intervals.length > 1 ? std(intervals, mean) : 4.5;
  return { mean, sd, intervals };
}

export function nextStartRange(lastStartISO, mean, sd) {
  if (!lastStartISO) return { lo: "—", hi: "—", loISO: "", hiISO: "" };
  const mu = clamp(mean, 15, 60, 28);
  const sigma = clamp(sd, 1, 12, 4.5);

  // Likely = mu ± 1*sd, Possible = mu ± 2*sd
  const loDays = Math.max(15, Math.round(mu - sigma));
  const hiDays = Math.min(60, Math.round(mu + sigma));
  const loISO = addDays(lastStartISO, loDays);
  const hiISO = addDays(lastStartISO, hiDays);
  return { lo: loISO, hi: hiISO, loISO, hiISO };
}

export function windowBands(lastStartISO, mean, sd) {
  if (!lastStartISO) return null;
  const mu = clamp(mean, 15, 60, 28);
  const sigma = clamp(sd, 1, 12, 4.5);

  const likely = {
    a: addDays(lastStartISO, Math.max(15, Math.round(mu - sigma))),
    b: addDays(lastStartISO, Math.min(60, Math.round(mu + sigma)))
  };
  const possible = {
    a: addDays(lastStartISO, Math.max(15, Math.round(mu - 2 * sigma))),
    b: addDays(lastStartISO, Math.min(60, Math.round(mu + 2 * sigma)))
  };
  return { likely, possible };
}

export function addDays(iso, days) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function avg(arr){ return arr.reduce((a,b)=>a+b,0)/arr.length; }
function std(arr, mean){
  const v = arr.reduce((s,x)=>s+(x-mean)*(x-mean),0)/(arr.length-1);
  return Math.sqrt(v);
}
function clamp(v, lo, hi, fb){
  const n = Number(v);
  if (!Number.isFinite(n)) return fb;
  return Math.max(lo, Math.min(hi, n));
}