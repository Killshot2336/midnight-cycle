import { initFirebase, ensureUserDoc } from "./firebase.js";

const $ = (id) => document.getElementById(id);

const el = {
  cycleStatus: $("cycleStatus"),
  phaseText: $("phaseText"),
  energyText: $("energyText"),
  moodText: $("moodText"),
  logStartBtn: $("logStartBtn"),
  enablePushBtn: $("enablePushBtn"),
  pushStatus: $("pushStatus"),
  accentBtn: $("accentBtn")
};

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function daysBetween(aISO, bISO) {
  const a = new Date(aISO + "T00:00:00");
  const b = new Date(bISO + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

function simplePhase(dayInCycle) {
  // very rough default: 28-day cycle
  if (dayInCycle <= 5) return "Period";
  if (dayInCycle <= 12) return "Follicular";
  if (dayInCycle <= 16) return "Ovulation window";
  return "Luteal";
}

function simpleForecast(phase) {
  if (phase === "Period") return { energy: "Low–Medium", mood: "Sensitive / tired" };
  if (phase === "Follicular") return { energy: "Rising", mood: "More stable" };
  if (phase === "Ovulation window") return { energy: "High", mood: "Up / social" };
  return { energy: "Medium", mood: "More reactive" };
}

async function main() {
  // Accent button (just cycles a few accents)
  const accents = ["#7c5cff","#2dd4bf","#fb7185","#fbbf24","#60a5fa"];
  let ai = 0;
  el.accentBtn?.addEventListener("click", () => {
    ai = (ai + 1) % accents.length;
    document.documentElement.style.setProperty("--accent", accents[ai]);
  });

  el.cycleStatus.textContent = "Connecting…";

  const fb = await initFirebase();
  const user = await ensureUserDoc(fb);

  // Basic cycle display
  const lastStart = user.lastPeriodStart;
  if (!lastStart) {
    el.cycleStatus.textContent = "No start logged yet. Tap “Log Period Start”.";
    el.phaseText.textContent = "—";
    el.energyText.textContent = "—";
    el.moodText.textContent = "—";
  } else {
    const day = Math.max(1, daysBetween(lastStart, todayISO()) + 1);
    const phase = simplePhase(day);
    const f = simpleForecast(phase);

    el.cycleStatus.textContent = `Day ${day} (from ${lastStart})`;
    el.phaseText.textContent = phase;
    el.energyText.textContent = f.energy;
    el.moodText.textContent = f.mood;
  }

  // Log period start (writes to Firestore user doc)
  el.logStartBtn.addEventListener("click", async () => {
    const start = prompt("Enter period start date (YYYY-MM-DD):", todayISO());
    if (!start) return;

    const ref = fb.doc(fb.db, "users", fb.uid);
    await fb.setDoc(ref, { lastPeriodStart: start }, { merge: true });

    el.cycleStatus.textContent = `Saved start: ${start}. Refreshing…`;
    location.reload();
  });

  // Push button stub (your notifications.js likely handles real flow)
  el.enablePushBtn.addEventListener("click", () => {
    el.pushStatus.textContent = "If this stays empty, we’ll wire the push flow next.";
  });

  el.cycleStatus.textContent = el.cycleStatus.textContent.replace("Connecting…", el.cycleStatus.textContent);
}

main().catch((e) => {
  console.error(e);
  el.cycleStatus.textContent = "App crashed. Open DevTools Console.";
});
