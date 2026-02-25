import { must, safeAsync, clamp, addDaysISO } from "./modules/guard.js";
import {
  loadLocal, saveLocal, defaultState,
  addEvent, removeLastEvent, upsertDayLog, getDayLog,
  setLastError, compactNotes, normalizeBasics
} from "./modules/storage.js";
import { applyThemeVars } from "./modules/theme.js";
import { currentCycle, inferStats, extractPeriodStarts } from "./modules/cycleEngine.js";
import { forecast } from "./modules/forecastEngine.js";
import { calendarModel, renderCalendar } from "./modules/calendar.js";
import { initFirebase, ensureUserDoc } from "./firebase.js";
import { enablePushFlow, disablePushFlow } from "./notifications.js";
import { snapshotNow, integrityStatus, countBackups, latestBackupRaw } from "./modules/backup.js";
import { encryptJSON, decryptJSON } from "./modules/crypto.js";
import { probabilityMap, drawProbability } from "./modules/probability.js";
import { buildTimeline, renderTimeline } from "./modules/timeline.js";
import { buildInsights, renderInsights } from "./modules/insights.js";
import { applySkillToState, skillBadge } from "./modules/skilltree.js";

let fb = null;
let state = loadLocal();

const el = {
  appTitle: must("appTitle"),
  appSub: must("appSub"),

  // nav
  navDashboardBtn: must("navDashboardBtn"),
  navTimelineBtn: must("navTimelineBtn"),
  navInsightsBtn: must("navInsightsBtn"),
  navVaultBtn: must("navVaultBtn"),

  viewDashboard: must("viewDashboard"),
  viewTimeline: must("viewTimeline"),
  viewInsights: must("viewInsights"),
  viewVault: must("viewVault"),

  cycleBadge: must("cycleBadge"),
  confidenceBadge: must("confidenceBadge"),
  cycleStatus: must("cycleStatus"),
  cycleMeta: must("cycleMeta"),

  tierBadge: must("tierBadge"),
  scoreBadge: must("scoreBadge"),
  tierName: must("tierName"),
  tierSub: must("tierSub"),
  tierBarFill: must("tierBarFill"),
  tierProgressText: must("tierProgressText"),
  tierPercent: must("tierPercent"),
  branchAName: must("branchAName"),
  branchADesc: must("branchADesc"),
  branchAStatus: must("branchAStatus"),
  branchBName: must("branchBName"),
  branchBDesc: must("branchBDesc"),
  branchBStatus: must("branchBStatus"),
  explainText: must("explainText"),
  nextHint: must("nextHint"),

  forecastBadge: must("forecastBadge"),
  phaseText: must("phaseText"),
  expectedText: must("expectedText"),
  energyText: must("energyText"),
  moodText: must("moodText"),
  bodyText: must("bodyText"),
  insightText: must("insightText"),

  probCanvas: must("probCanvas"),
  probLegend: must("probLegend"),

  modelBadge: must("modelBadge"),
  logStartBtn: must("logStartBtn"),
  logDayBtn: must("logDayBtn"),
  undoBtn: must("undoBtn"),
  meanCycleInput: must("meanCycleInput"),
  periodLenInput: must("periodLenInput"),
  saveBasicsBtn: must("saveBasicsBtn"),

  calendarMount: must("calendarMount"),
  monthLabel: must("monthLabel"),
  prevMonthBtn: must("prevMonthBtn"),
  nextMonthBtn: must("nextMonthBtn"),

  pushStatus: must("pushStatus"),
  pushHelp: must("pushHelp"),
  notifyTime: must("notifyTime"),
  tzInput: must("tzInput"),
  enablePushBtn: must("enablePushBtn"),
  disablePushBtn: must("disablePushBtn"),

  customizeBtn: must("customizeBtn"),
  themeDialog: must("themeDialog"),
  accentPicker: must("accentPicker"),
  bgPicker: must("bgPicker"),
  cardPicker: must("cardPicker"),
  textPicker: must("textPicker"),
  glowRange: must("glowRange"),
  applyThemeBtn: must("applyThemeBtn"),
  resetThemeBtn: must("resetThemeBtn"),

  logDialog: must("logDialog"),
  logDate: must("logDate"),
  logFlow: must("logFlow"),
  logEnergy: must("logEnergy"),
  logMood: must("logMood"),
  logNotes: must("logNotes"),
  saveLogBtn: must("saveLogBtn"),

  // timeline
  timelineBadge: must("timelineBadge"),
  timelineExplain: must("timelineExplain"),
  timelineMount: must("timelineMount"),

  // insights
  insightsBadge: must("insightsBadge"),
  insightsExplain: must("insightsExplain"),
  insightsMount: must("insightsMount"),

  // vault
  vaultBadge: must("vaultBadge"),
  vaultPass: must("vaultPass"),
  exportBtn: must("exportBtn"),
  importFile: must("importFile"),
  restoreBackupBtn: must("restoreBackupBtn"),
  vaultBackups: must("vaultBackups"),
  vaultIntegrity: must("vaultIntegrity"),
  vaultLast: must("vaultLast"),

  // diagnostics
  diagHealth: must("diagHealth"),
  diagMode: must("diagMode"),
  diagStorage: must("diagStorage"),
  diagBackups: must("diagBackups"),
  diagPush: must("diagPush"),
  diagError: must("diagError"),
  diagHint: must("diagHint")
};

const PRESETS = {
  noir: { accent:"#7c4dff", bg:"#07070c", card:"#121225", text:"#e9e9ff", glow:72 },
  neon: { accent:"#00e5ff", bg:"#05070b", card:"#0e1a22", text:"#eaffff", glow:82 },
  ember:{ accent:"#ff3d6e", bg:"#09060a", card:"#1a0f17", text:"#fff1f4", glow:78 },
  rose: { accent:"#ff4da6", bg:"#07060a", card:"#1a0f19", text:"#ffe9f3", glow:80 },
  ice:  { accent:"#7aa7ff", bg:"#06070a", card:"#101629", text:"#edf2ff", glow:70 }
};

let viewYear = new Date().getFullYear();
let viewMonth0 = new Date().getMonth();

function todayISO(){ return new Date().toISOString().slice(0,10); }
function setPushStatus(t){ el.pushStatus.textContent = t; }
function setVaultLast(t){ el.vaultLast.textContent = t; }

function capabilities(){
  return {
    sw: "serviceWorker" in navigator,
    notif: "Notification" in window,
    push: "PushManager" in window
  };
}

function showView(which){
  el.viewDashboard.classList.toggle("hidden", which !== "dashboard");
  el.viewTimeline.classList.toggle("hidden", which !== "timeline");
  el.viewInsights.classList.toggle("hidden", which !== "insights");
  el.viewVault.classList.toggle("hidden", which !== "vault");
}

function loadThemeUI(){
  const t = state.theme;
  el.accentPicker.value = t.accent;
  el.bgPicker.value = t.bg;
  el.cardPicker.value = t.card;
  el.textPicker.value = t.text;
  el.glowRange.value = String(t.glow ?? 70);
}

function themeSnapshot(){
  return {
    accent: el.accentPicker.value,
    bg: el.bgPicker.value,
    card: el.cardPicker.value,
    text: el.textPicker.value,
    glow: Number(el.glowRange.value || 70)
  };
}

function applyThemePreview(theme){
  applyThemeVars(theme);
}

function snapshotSignals(){
  const days = state.history?.days || {};
  const today = new Date(todayISO()+"T00:00:00");
  let covered30=0, covered7=0;
  const vals=[];

  for (let i=0;i<30;i++){
    const d = new Date(today); d.setDate(d.getDate()-i);
    const iso = d.toISOString().slice(0,10);
    const L = days[iso];
    if (L) covered30++;
    if (L && i<=6) covered7++;
    if (L && i<=13){
      const v = (Number(L.energy ?? 55) + Number(L.mood ?? 55))/2;
      if (Number.isFinite(v)) vals.push(v);
    }
  }

  let cons = 0;
  if (vals.length >= 5){
    const m = vals.reduce((a,b)=>a+b,0)/vals.length;
    const v = vals.reduce((a,b)=>a+(b-m)*(b-m),0)/vals.length;
    cons = clamp(1 - (Math.sqrt(v)/35), 0, 1);
  }

  return { coverage30: covered30/30, coverage7: covered7/7, signalConsistency: cons };
}

function statusOf(p){
  if (p >= 1) return "Complete";
  if (p >= 0.66) return "Stabilizing";
  if (p >= 0.33) return "Forming";
  return "Initializing";
}

function computeIntel(stats){
  const starts = extractPeriodStarts(state.history?.events || []);
  const cyclesLogged = starts.length;
  const snap = snapshotSignals();

  const cyclesScore = clamp((cyclesLogged-1)/9, 0, 1);
  const stability = clamp((10 - stats.sd)/8, 0, 1);
  const cover30 = clamp(snap.coverage30/0.85, 0, 1);
  const cover7  = clamp(snap.coverage7/0.85, 0, 1);
  const sig     = clamp(snap.signalConsistency/0.9, 0, 1);

  const score01 = cyclesScore*0.34 + stability*0.26 + cover30*0.20 + cover7*0.12 + sig*0.08;
  const score = Math.round(score01*100);

  let tier = 1;
  if (cyclesLogged >= 4 && snap.coverage30 >= 0.55 && score >= 28) tier = 2;
  if (cyclesLogged >= 6 && snap.coverage30 >= 0.65 && stability >= 0.30 && score >= 45) tier = 3;
  if (cyclesLogged >= 8 && snap.coverage30 >= 0.78 && stability >= 0.42 && score >= 62) tier = 4;
  if (cyclesLogged >= 10 && snap.coverage30 >= 0.85 && stability >= 0.55 && score >= 78) tier = 5;

  const defs = {
    1:{ label:"LEARNING", name:"TIER I — Signal Foundation", sub:"Baseline anchoring + early signal weighting.",
        a:{ name:"Temporal Anchoring", desc:"Cycle starts establish baseline. Drift awareness activates.", prog: clamp((cyclesLogged-1)/3,0,1) },
        b:{ name:"Signal Weighting", desc:"Daily logs influence forecast. Noise filtering begins.", prog: clamp(Object.keys(state.history?.days||{}).length/14,0,1) },
        hint:"Unlock Tier II: ~4 starts + ~55–60% 30-day coverage." },
    2:{ label:"ADAPTIVE", name:"TIER II — Drift & Adaptation", sub:"Variability becomes measurable; bands adapt.",
        a:{ name:"Variability Index", desc:"Volatility and stability band become meaningful.", prog: clamp((cyclesLogged-3)/3,0,1) },
        b:{ name:"Recalibration Logic", desc:"Bands widen/tighten based on coverage + drift.", prog: clamp(snap.coverage30/0.70,0,1) },
        hint:"Unlock Tier III: ~6 starts + ~65–70% coverage + better stability." },
    3:{ label:"SIMULATION", name:"TIER III — Probabilistic Simulation", sub:"Probability bands + anomaly detection refine predictions.",
        a:{ name:"Probability Simulation", desc:"Start-likelihood becomes a probability map, not a single day.", prog: clamp((cyclesLogged-5)/3,0,1) },
        b:{ name:"Anomaly Intelligence", desc:"Detects disruption and explains confidence shifts.", prog: clamp(cover7,0,1) },
        hint:"Unlock Tier IV: ~8 starts + ~78–80% coverage + stable variance." },
    4:{ label:"ADVANCED", name:"TIER IV — Pattern Intelligence", sub:"Correlations and rhythm strength emerge.",
        a:{ name:"Correlation Engine", desc:"Find recurring energy/mood patterns tied to phase.", prog: clamp(cover30,0,1) },
        b:{ name:"Entropy Analysis", desc:"Measures predictability + evolution strength over time.", prog: clamp((cyclesLogged-7)/4,0,1) },
        hint:"Unlock Tier V: ~10 starts + ~85% coverage + tight variance." },
    5:{ label:"MASTERY", name:"TIER V — Mastery Evolution", sub:"Long-term consolidation + evolution detection.",
        a:{ name:"Rhythm Consolidation", desc:"Stability hardened state; bands tighten.", prog: clamp(stability,0,1) },
        b:{ name:"Maturity Index", desc:"Tracks long-term pattern shifts.", prog: clamp((cyclesLogged-10)/6,0,1) },
        hint:"Mastery active. Maintain coverage for maximum precision." }
  };

  const def = defs[tier];
  const tierProgress = clamp((def.a.prog + def.b.prog)/2, 0, 1);

  const drivers = [
    ["Cycle history", Math.round(cyclesScore*100)],
    ["Stability", Math.round(stability*100)],
    ["30-day coverage", Math.round(cover30*100)],
    ["7-day recency", Math.round(cover7*100)],
    ["Signal consistency", Math.round(sig*100)]
  ].sort((a,b)=>b[1]-a[1]);

  const next = [];
  if (cyclesLogged < 6) next.push("Log period starts consistently.");
  if (snap.coverage30 < 0.75) next.push("Increase daily coverage (even minimal logs count).");
  if (snap.coverage7 < 0.7) next.push("Log 5 of the next 7 days for tighter confidence.");
  if (stability < 0.45) next.push("Consistency across 2+ cycles tightens σ.");

  const explain =
    `Score ${score}/100 • Top drivers: ${drivers.slice(0,3).map(d=>`${d[0]} ${d[1]}%`).join(" • ")}. ` +
    (next.length ? `Next: ${next.slice(0,2).join(" ")}` : "Next: Maintain coverage to keep bands tight.");

  return { score, tier, tierProgress, def, explain };
}

function renderDiagnostics(){
  const cap = capabilities();
  const raw = localStorage.getItem("midnight.state.v3") || "";
  const kb = Math.round((raw.length/1024)*10)/10;

  el.diagStorage.textContent = `${kb} KB • v${state.version}`;
  const b = countBackups();
  el.diagBackups.textContent = `daily ${b.daily} • weekly ${b.weekly}`;
  el.diagPush.textContent = `SW:${cap.sw?"Y":"N"} Notif:${cap.notif?"Y":"N"} Push:${cap.push?"Y":"N"}`;

  const err = state.diagnostics.lastError
    ? `${state.diagnostics.lastErrorAt} ${state.diagnostics.lastError}`
    : "—";
  el.diagError.textContent = err;

  const health = state.diagnostics.lastError ? "DEGRADED" : "OK";
  el.diagHealth.textContent = health;

  el.diagHint.textContent = "If anything fails, Midnight falls back gracefully (no blank screens).";
}

function openLog(dayISO){
  const existing = getDayLog(state, dayISO);
  el.logDate.value = dayISO;
  el.logFlow.value = String(existing?.flow ?? 0);
  el.logEnergy.value = String(existing?.energy ?? 55);
  el.logMood.value = String(existing?.mood ?? 55);
  el.logNotes.value = existing?.notes ?? "";
  el.logDialog.showModal();
}

async function syncToCloud(){
  if (!fb) return;
  await safeAsync(async () => {
    const ref = fb.doc(fb.db, "users", fb.uid);
    const stats = inferStats(state);
    const starts = extractPeriodStarts(state.history?.events||[]);
    const last = starts.length ? starts[starts.length-1] : "";
    await fb.setDoc(ref, {
      tz: state.tz,
      notifyTime: state.notifyTime,
      lastPeriodStart: last,
      meanCycleDays: stats.mean,
      sdCycleDays: stats.sd
    }, { merge:true });
  });
}

async function hydrateFromCloud(){
  if (!fb) return;
  await safeAsync(async () => {
    const ref = fb.doc(fb.db, "users", fb.uid);
    const snap = await fb.getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data?.tz) state.tz = data.tz;
    if (data?.notifyTime) state.notifyTime = data.notifyTime;
    saveLocal(state);
  });
}

async function updateVaultStatus(){
  const b = countBackups();
  el.vaultBackups.textContent = `daily ${b.daily} • weekly ${b.weekly}`;
  const integ = await integrityStatus();
  el.vaultIntegrity.textContent = integ.status;
  el.vaultBadge.textContent = integ.ok ? "FORTIFIED" : "CHECK";
}

function renderAll(){
  try{
    normalizeBasics(state);
    applySkillToState(state);
    applyThemeVars(state.theme);

    el.notifyTime.value = state.notifyTime || "18:30";
    el.tzInput.value = state.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
    el.meanCycleInput.value = state.basics.meanCycle || "";
    el.periodLenInput.value = state.basics.periodLen || "";

    const stats = inferStats(state);
    const intel = computeIntel(stats);

    state.intelligence.score = intel.score;
    state.intelligence.tier = intel.tier;
    state.intelligence.tierProgress = intel.tierProgress;
    state.intelligence.explain = intel.explain;

    saveLocal(state);

    el.tierBadge.textContent = `${intel.def.label} • ${skillBadge(state.skill)} L${state.skill.level}`;
    el.scoreBadge.textContent = `Score ${intel.score}`;
    el.tierName.textContent = intel.def.name;
    el.tierSub.textContent = intel.def.sub;

    const pct = Math.round(intel.tierProgress*100);
    el.tierBarFill.style.width = `${pct}%`;
    el.tierPercent.textContent = `${pct}%`;
    el.tierProgressText.textContent = `Tier progress ${pct}% • skill XP ${state.skill.xp}`;

    el.branchAName.textContent = `A — ${intel.def.a.name}`;
    el.branchADesc.textContent = intel.def.a.desc;
    el.branchAStatus.textContent = `${Math.round(intel.def.a.prog*100)}% • ${statusOf(intel.def.a.prog)}`;

    el.branchBName.textContent = `B — ${intel.def.b.name}`;
    el.branchBDesc.textContent = intel.def.b.desc;
    el.branchBStatus.textContent = `${Math.round(intel.def.b.prog*100)}% • ${statusOf(intel.def.b.prog)}`;

    el.explainText.textContent = intel.explain;
    el.nextHint.textContent = intel.def.hint;

    const tISO = todayISO();
    const cycle = currentCycle(state, tISO);
    el.modelBadge.textContent = `μ ${stats.mean.toFixed(1)} • ±${stats.sd.toFixed(1)} • n ${stats.samples}`;

    if (!cycle.known){
      el.cycleBadge.textContent = "Unseeded";
      el.cycleStatus.textContent = "Log your period start";
      el.cycleMeta.textContent = "The model learns your irregularity and adapts.";
      el.confidenceBadge.textContent = "Learning";

      el.forecastBadge.textContent = "LEARNING";
      el.phaseText.textContent = "—";
      el.expectedText.textContent = "—";
      el.energyText.textContent = "—";
      el.moodText.textContent = "—";
      el.bodyText.textContent = "—";
      el.insightText.textContent = "Log a period start + some daily logs. Everything powers up.";

      drawProbability(el.probCanvas, Array.from({length:21}, (_,i)=>({p:0})), state.theme.accent);
      el.probLegend.textContent = "Probability map locked until at least one start is logged.";
    } else {
      const f = forecast(state, cycle, tISO);
      state.intelligence.anomaly = f.anomaly;

      el.cycleBadge.textContent = `Day ${cycle.dayIndex}`;
      el.cycleStatus.textContent = `Day ${cycle.dayIndex} (from ${cycle.lastStart})`;
      el.cycleMeta.textContent = `σ ${stats.sd.toFixed(1)} • anomaly ${Math.round(f.anomaly.level*100)}%`;

      el.confidenceBadge.textContent = `${f.confidenceLabel} (${f.confidenceScore})`;
      el.forecastBadge.textContent = f.forecastBadge;

      el.phaseText.textContent = f.phaseText;
      el.expectedText.textContent = f.expectedText;
      el.energyText.textContent = f.energyText;
      el.moodText.textContent = f.moodText;
      el.bodyText.textContent = f.bodyText;
      el.insightText.textContent = f.insightText;

      const pm = probabilityMap(stats, cycle, 21, f.anomaly.level);
      drawProbability(el.probCanvas, pm.series, state.theme.accent);
      el.probLegend.textContent =
        `Peak likelihood in ~${pm.peakInDays} days • peak ${Math.round(pm.peakProb*100)}% • band early ${pm.band.early}d / late ${pm.band.late}d.`;
    }

    // Calendar
    const m = calendarModel(state, viewYear, viewMonth0);
    const d = new Date(viewYear, viewMonth0, 1);
    el.monthLabel.textContent = d.toLocaleString(undefined, { month:"long", year:"numeric" });
    renderCalendar(el.calendarMount, m, (dayISO)=> openLog(dayISO));

    // Timeline
    const tModel = buildTimeline(state, 14);
    el.timelineBadge.textContent = tModel.badge;
    el.timelineExplain.textContent = tModel.explain;
    renderTimeline(el.timelineMount, tModel);

    // Insights
    const iModel = buildInsights(state);
    el.insightsBadge.textContent = iModel.badge;
    el.insightsExplain.textContent = iModel.explain;
    renderInsights(el.insightsMount, iModel);

    // Push help
    const cap = capabilities();
    el.pushHelp.textContent = cap.push
      ? "Push capability detected. Enable if you want."
      : "Push may be limited on this device/browser. App still works perfectly without it.";

  } catch (e){
    setLastError(state, `Render fatal: ${String(e?.message||e)}`);
    saveLocal(state);
    el.appTitle.textContent = "Midnight";
    el.appSub.textContent = "Recovered from an error. Reload if needed.";
  } finally {
    renderDiagnostics();
    updateVaultStatus();
  }
}

function wireUI(){
  // nav
  el.navDashboardBtn.addEventListener("click", ()=> showView("dashboard"));
  el.navTimelineBtn.addEventListener("click", ()=> showView("timeline"));
  el.navInsightsBtn.addEventListener("click", ()=> showView("insights"));
  el.navVaultBtn.addEventListener("click", ()=> showView("vault"));

  // logging
  el.logDayBtn.addEventListener("click", () => openLog(todayISO()));

  el.saveLogBtn.addEventListener("click", async () => {
    const dayISO = el.logDate.value || todayISO();
    upsertDayLog(state, dayISO, {
      flow: Number(el.logFlow.value||0),
      energy: Number(el.logEnergy.value||55),
      mood: Number(el.logMood.value||55),
      notes: compactNotes(el.logNotes.value||"")
    });
    saveLocal(state);
    await snapshotNow(); // silent fortress snapshot
    await syncToCloud();
    renderAll();
    el.logDialog.close();
  });

  el.logStartBtn.addEventListener("click", async () => {
    const d = todayISO();
    addEvent(state, { dateISO:d, kind:"period_start" });
    upsertDayLog(state, d, { flow: Math.max(Number(state.history.days[d]?.flow||0), 2) });
    saveLocal(state);
    await snapshotNow();
    await syncToCloud();
    renderAll();
  });

  el.undoBtn.addEventListener("click", async () => {
    if (removeLastEvent(state, "period_start")){
      saveLocal(state);
      await snapshotNow();
      await syncToCloud();
      renderAll();
    }
  });

  el.saveBasicsBtn.addEventListener("click", async () => {
    state.basics.meanCycle = Number(el.meanCycleInput.value||0);
    state.basics.periodLen = Number(el.periodLenInput.value||0);
    saveLocal(state);
    await snapshotNow();
    await syncToCloud();
    renderAll();
  });

  // calendar navigation
  el.prevMonthBtn.addEventListener("click", () => {
    viewMonth0--;
    if (viewMonth0 < 0){ viewMonth0=11; viewYear--; }
    renderAll();
  });
  el.nextMonthBtn.addEventListener("click", () => {
    viewMonth0++;
    if (viewMonth0 > 11){ viewMonth0=0; viewYear++; }
    renderAll();
  });

  // notifications
  el.notifyTime.addEventListener("change", async () => {
    state.notifyTime = el.notifyTime.value || "18:30";
    saveLocal(state);
    await snapshotNow();
    await syncToCloud();
    renderAll();
  });

  el.tzInput.addEventListener("change", async () => {
    state.tz = el.tzInput.value || state.tz;
    saveLocal(state);
    await snapshotNow();
    await syncToCloud();
    renderAll();
  });

  el.enablePushBtn.addEventListener("click", async () => {
    setPushStatus("Enabling…");
    const res = await enablePushFlow(fb, state, setPushStatus);
    if (!res.ok) setPushStatus("Unavailable");
    renderAll();
  });

  el.disablePushBtn.addEventListener("click", async () => {
    setPushStatus("Disabling…");
    await disablePushFlow(fb, setPushStatus);
    renderAll();
  });

  // theme
  el.customizeBtn.addEventListener("click", () => {
    loadThemeUI();
    applyThemePreview(state.theme);
    el.themeDialog.showModal();
  });

  const live = () => applyThemePreview(themeSnapshot());
  ["input","change"].forEach(evt=>{
    el.accentPicker.addEventListener(evt, live);
    el.bgPicker.addEventListener(evt, live);
    el.cardPicker.addEventListener(evt, live);
    el.textPicker.addEventListener(evt, live);
    el.glowRange.addEventListener(evt, live);
  });

  document.querySelectorAll(".preset").forEach(btn=>{
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-preset");
      const p = PRESETS[key] || PRESETS.noir;
      el.accentPicker.value = p.accent;
      el.bgPicker.value = p.bg;
      el.cardPicker.value = p.card;
      el.textPicker.value = p.text;
      el.glowRange.value = String(p.glow);
      applyThemePreview(p);
    });
  });

  el.applyThemeBtn.addEventListener("click", async () => {
    state.theme = themeSnapshot();
    saveLocal(state);
    await snapshotNow();
    renderAll();
    el.themeDialog.close();
  });

  el.resetThemeBtn.addEventListener("click", async () => {
    state.theme = { ...PRESETS.noir };
    saveLocal(state);
    await snapshotNow();
    loadThemeUI();
    applyThemePreview(state.theme);
    renderAll();
  });

  el.themeDialog.addEventListener("close", () => {
    applyThemePreview(state.theme);
  });

  // vault
  el.exportBtn.addEventListener("click", async () => {
    try{
      const pass = el.vaultPass.value || "";
      const vaultObj = await encryptJSON(pass, state);
      const blob = new Blob([JSON.stringify(vaultObj, null, 2)], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `midnight-export-${new Date().toISOString().slice(0,10)}.midnight.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setVaultLast(`Exported ${new Date().toISOString()}`);
      renderAll();
    } catch(e){
      setVaultLast(`Export failed: ${String(e?.message||e)}`);
      setLastError(state, `Vault export: ${String(e?.message||e)}`);
      saveLocal(state);
      renderAll();
    }
  });

  el.importFile.addEventListener("change", async () => {
    try{
      const file = el.importFile.files?.[0];
      if (!file) return;
      const pass = el.vaultPass.value || "";
      const text = await file.text();
      const vault = JSON.parse(text);
      const restored = await decryptJSON(pass, vault);

      // sanity
      if (!restored || typeof restored !== "object" || !restored.history) throw new Error("Vault contents invalid.");

      state = restored;
      saveLocal(state);
      await snapshotNow();
      setVaultLast(`Imported ${new Date().toISOString()}`);
      renderAll();
    } catch(e){
      setVaultLast(`Import failed: ${String(e?.message||e)}`);
      setLastError(state, `Vault import: ${String(e?.message||e)}`);
      saveLocal(state);
      renderAll();
    } finally {
      el.importFile.value = "";
    }
  });

  el.restoreBackupBtn.addEventListener("click", async () => {
    try{
      const raw = latestBackupRaw();
      if (!raw) throw new Error("No backup found.");
      const restored = JSON.parse(raw);
      state = restored;
      saveLocal(state);
      await snapshotNow();
      setVaultLast(`Restored latest backup ${new Date().toISOString()}`);
      renderAll();
    } catch(e){
      setVaultLast(`Restore failed: ${String(e?.message||e)}`);
      setLastError(state, `Restore: ${String(e?.message||e)}`);
      saveLocal(state);
      renderAll();
    }
  });
}

async function boot(){
  renderAll();
  wireUI();

  // Service worker best effort
  await safeAsync(async () => {
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("./service-worker.js");
    }
  });

  // run fortress snapshot on boot (won't spam due to pruning)
  await safeAsync(async () => { await snapshotNow(); });

  // Firebase optional
  try{
    fb = await initFirebase();
    await ensureUserDoc(fb);
    await hydrateFromCloud();
    setPushStatus("Ready");
  } catch (e){
    fb = null;
    setPushStatus("Local-only");
    setLastError(state, `Firebase unavailable: ${String(e?.message||e)}`);
    saveLocal(state);
  }

  renderAll();
}

boot().catch((e)=>{
  setLastError(state, `Fatal boot: ${String(e?.message||e)}`);
  saveLocal(state);
  el.appTitle.textContent = "Midnight";
  el.appSub.textContent = "Recovered from an error. Reload if needed.";
  setPushStatus("Local-only");
  renderAll();
});
