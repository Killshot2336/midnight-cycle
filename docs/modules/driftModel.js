// Learns irregularity (chaotic vs stable) from recent cycle history.
export function computeDriftStats(periodStartsISO) {
  const starts = [...(periodStartsISO||[])].sort();
  if (starts.length < 3) {
    return { mean: 0, sd: 0, chaotic: true, score: 0.6 };
  }
  const diffs = [];
  for (let i=1;i<starts.length;i++){
    diffs.push(daysBetween(starts[i-1], starts[i]));
  }
  const mean = diffs.reduce((a,b)=>a+b,0)/diffs.length;
  const variance = diffs.reduce((a,x)=>a+(x-mean)*(x-mean),0)/diffs.length;
  const sd = Math.sqrt(variance);

  // chaotic score: sd relative to mean
  const rel = mean > 0 ? sd/mean : 0.5;
  const score = clamp01(0.3 + rel); // 0.3..1.0
  const chaotic = score >= 0.55;

  return { mean, sd, chaotic, score };

  function clamp01(n){ return Math.max(0, Math.min(1, n)); }
  function daysBetween(a,b){
    const da = new Date(a+"T00:00:00");
    const db = new Date(b+"T00:00:00");
    return Math.round((db-da)/86400000);
  }
}
