import { clamp, addDaysISO } from "./guard.js";
import { predictionBand } from "./driftModel.js";

// Gaussian-ish bump function (no heavy math deps)
function bump(x, mu, sigma){
  const s = Math.max(1.2, sigma);
  const z = (x - mu) / s;
  return Math.exp(-0.5 * z * z);
}

// Builds probability of next start across horizon days
export function probabilityMap(stats, cycle, horizon=21, anomalyLevel=0){
  // widen sigma if anomaly / volatility
  const tight = 1 + (stats.volatility * 0.9) + (anomalyLevel * 0.8);
  const band = predictionBand(stats.mean, stats.sd, tight);

  const mu = band.expected;
  const sigma = Math.max(2.0, stats.sd * tight);

  const out = [];
  for (let i=0;i<horizon;i++){
    const dayOffset = cycle.dayIndex + i; // how far into cycle if nothing starts before then
    // convert to offset-from-last-start window
    const x = dayOffset;
    const p = bump(x, mu, sigma);
    out.push({
      i,
      dateISO: addDaysISO(new Date().toISOString().slice(0,10), i),
      pRaw: p
    });
  }

  // normalize to 0..1 and also provide % (not sum-to-1 because “start can happen later than horizon”)
  const max = Math.max(...out.map(o=>o.pRaw), 1e-9);
  for (const o of out) o.p = clamp(o.pRaw / max, 0, 1);

  // derive window + peak
  let peak = out[0];
  for (const o of out) if (o.p > peak.p) peak = o;

  return {
    band,
    peakInDays: peak.i,
    peakProb: peak.p,
    series: out.map(o=>({ dateISO:o.dateISO, p:o.p }))
  };
}

export function drawProbability(canvas, series, accent="#7c4dff"){
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  // background grid
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,.02)";
  ctx.fillRect(0,0,W,H);

  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 1;
  for (let i=0;i<=4;i++){
    const y = Math.round((H-18) * (i/4)) + 8;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }

  const n = series.length;
  const padX = 14, padY = 12;
  const x0 = padX, x1 = W - padX;
  const y0 = H - padY, y1 = padY;

  // bars
  const barW = (x1-x0)/n;

  for (let i=0;i<n;i++){
    const p = series[i].p;
    const x = x0 + i*barW;
    const h = (y0 - y1) * p;
    const y = y0 - h;

    // base bar
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(x+2, y1, Math.max(1, barW-4), (y0-y1));

    // accent bar
    ctx.fillStyle = `color-mix(in srgb, ${accent} 80%, rgba(0,229,255,.25))`;
    ctx.fillRect(x+2, y, Math.max(1, barW-4), h);
  }
}
