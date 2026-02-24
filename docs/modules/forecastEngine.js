// Forecast is pattern-based (not medical). It uses cycle day + recent check-ins to predict mood/energy/pain.

export function forecastForDay(cycleDay, dailyLog) {
  const d = Math.max(1, Number(cycleDay || 1));

  const phase = phaseFromDay(d);
  const base = baseSignals(phase.key);

  // Recent self-report nudges the forecast
  const checkin = dailyLog?.checkin || null;
  const nudge = checkin ? nudgeFromCheckin(checkin) : { mood: 0, energy: 0, pain: 0 };

  const moodScore = clamp(base.mood + nudge.mood, 1, 5, 3);
  const energyScore = clamp(base.energy + nudge.energy, 1, 5, 3);
  const painScore = clamp(base.pain + nudge.pain, 1, 5, 2);

  const mood = label5("Mood", moodScore);
  const energy = label5("Energy", energyScore);
  const pain = label5("Pain", painScore);

  return {
    badge: phase.badge,
    phase: phase.name,
    phaseKey: phase.key,
    energy,
    mood,
    pain,
    why: {
      phase: phase.why,
      energy: base.energyWhy,
      mood: base.moodWhy
    }
  };
}

function phaseFromDay(d) {
  // Typical mapping; drift model adjusts range separately. This is “best-effort”.
  if (d <= 5) return { key: "menses", name: "Menstrual", badge: "MENSTRUAL", why: "Early cycle days (often lower energy / higher discomfort)." };
  if (d <= 13) return { key: "follicular", name: "Follicular", badge: "FOLLICULAR", why: "Build phase (often steadier mood / rising energy)." };
  if (d <= 16) return { key: "ovulation", name: "Mid-cycle", badge: "MID-CYCLE", why: "Mid-cycle window (often higher energy / social)." };
  return { key: "luteal", name: "Late cycle", badge: "LATE-CYCLE", why: "Late cycle (some people see irritability / fatigue)." };
}

function baseSignals(phaseKey) {
  switch (phaseKey) {
    case "menses":
      return { mood: 2.7, energy: 2.3, pain: 3.6, moodWhy: "Early cycle tends to dip mood for many people.", energyWhy: "Energy commonly lower during early cycle." };
    case "follicular":
      return { mood: 3.6, energy: 3.7, pain: 1.8, moodWhy: "Build phase often steadier emotionally.", energyWhy: "Energy often rises through this phase." };
    case "ovulation":
      return { mood: 4.0, energy: 4.0, pain: 1.7, moodWhy: "Mid-cycle often correlates with higher mood.", energyWhy: "Energy often peaks near mid-cycle." };
    case "luteal":
    default:
      return { mood: 3.0, energy: 2.9, pain: 2.4, moodWhy: "Late cycle can bring irritability or sensitivity.", energyWhy: "Late cycle can bring fatigue for some people." };
  }
}

function nudgeFromCheckin(c) {
  // c has values 1..5 where 3 is normal. Convert to small deltas.
  const mood = (Number(c.mood || 3) - 3) * 0.25;
  const energy = (Number(c.energy || 3) - 3) * 0.25;
  const pain = (Number(c.pain || 3) - 3) * 0.25;
  return { mood, energy, pain };
}

function label5(kind, score) {
  const s = Math.round(score);
  if (kind === "Energy") {
    return s <= 2 ? "Low" : s === 3 ? "Medium" : "High";
  }
  if (kind === "Mood") {
    return s <= 2 ? "Fragile" : s === 3 ? "Steady" : "Up";
  }
  if (kind === "Pain") {
    return s <= 2 ? "Low" : s === 3 ? "Medium" : "High";
  }
  return "—";
}

function clamp(v, lo, hi, fb) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fb;
  return Math.max(lo, Math.min(hi, n));
}