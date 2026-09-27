import { CONFIG, initFirebase, ensureUserDoc } from "./firebase.js";
import { todayISO, addDaysISO } from "./modules/guard.js";
import { loadMeta, saveMeta, loadVaultRaw, saveVaultRaw } from "./modules/storage.js";
import { applyTheme, setInputsFromTheme, themeFromInputs, presetForStyle, currentTheme, charmSvg, CHARMS } from "./modules/theme.js";
import { downloadJSON } from "./modules/backup.js";
import { ensureVault, updateDay, restoreDay, addPeriodStart, markPeriodRange } from "./modules/cycleEngine.js";
import { buildForecast } from "./modules/forecastEngine.js";
import {
  formatWeekday,
  headlineFor,
  daySentence,
  trackSentence,
  lateSentence,
  wideSentence,
  fertileSentence,
  topSymptom
} from "./modules/cycleModel.js";
import { renderCalendar, monthLabel, shiftMonth } from "./modules/calendar.js";
import { renderTimeline } from "./modules/timeline.js";
import { dataGates } from "./modules/skilltree.js";
import { SYMPTOM_CHIPS, insightSentence, clinicianSummary } from "./modules/insights.js";
import { hasPasscode, isLocked, setPasscode, unlock as unlockVault, lockNow, setLocked, getSalt, validPasscode, clearPasscode } from "./modules/lock.js";
import { encryptJSON } from "./modules/crypto.js";
import { ensureSexDefaults, seedSexDateInput, setSexEntry, getSexEntry, deleteSexEntry, listSexEntries } from "./modules/sexLog.js";
import { shouldShowBanner, markBannerShown } from "./modules/notifyFallback.js";
import {
  periodPages,
  heavyDayPattern,
  heavyDaySentence,
  mentionSentence,
  windowSentence,
  searchNotes,
  shareSentence,
  visitText,
  parseStartDates,
  visibleSymptoms,
  reminderRelevant,
  supplyLines,
  symptomLevelLabel,
  CONTEXTS,
  PRODUCTS,
  MUCUS,
  START_FLOW
} from "./modules/cycleBook.js";

const FLOWS = [
  ["none", "None"],
  ["spotting", "Spotting"],
  ["light", "Light"],
  ["medium", "Medium"],
  ["heavy", "Heavy"]
];

const el = {
  appTitle: document.getElementById("appTitle"),
  appSub: document.getElementById("appSub"),
  statusPill: document.getElementById("statusPill"),
  logDayLabel: document.getElementById("logDayLabel"),
  headline: document.getElementById("headline"),
  daySentence: document.getElementById("daySentence"),
  trackLine: document.getElementById("trackLine"),
  lateNote: document.getElementById("lateNote"),
  wideNote: document.getElementById("wideNote"),
  insightLine: document.getElementById("insightLine"),
  fertileLine: document.getElementById("fertileLine"),
  flowRow: document.getElementById("flowRow"),
  undoBtn: document.getElementById("undoBtn"),
  backTodayBtn: document.getElementById("backTodayBtn"),
  symptomChips: document.getElementById("symptomChips"),
  moreToggle: document.getElementById("moreToggle"),
  moreBox: document.getElementById("moreBox"),
  lhInput: document.getElementById("lhInput"),
  bbtInput: document.getElementById("bbtInput"),
  mucusInput: document.getElementById("mucusInput"),
  notesInput: document.getElementById("notesInput"),
  timeline: document.getElementById("timeline"),
  calendar: document.getElementById("calendar"),
  calPrev: document.getElementById("calPrev"),
  calNext: document.getElementById("calNext"),
  calLabel: document.getElementById("calLabel"),
  rangeStart: document.getElementById("rangeStart"),
  rangeEnd: document.getElementById("rangeEnd"),
  rangeApply: document.getElementById("rangeApply"),
  rangeNote: document.getElementById("rangeNote"),
  summaryText: document.getElementById("summaryText"),
  copySummary: document.getElementById("copySummary"),
  copyNote: document.getElementById("copyNote"),
  gates: document.getElementById("gates"),
  situation: document.getElementById("situation"),
  goal: document.getElementById("goal"),
  themeStyle: document.getElementById("themeStyle"),
  themeBase: document.getElementById("themeBase"),
  accent: document.getElementById("accent"),
  bg: document.getElementById("bg"),
  card: document.getElementById("card"),
  text: document.getElementById("text"),
  mark: document.getElementById("mark"),
  flowNone: document.getElementById("flowNone"),
  flowSpot: document.getElementById("flowSpot"),
  flowLight: document.getElementById("flowLight"),
  flowMedium: document.getElementById("flowMedium"),
  flowHeavy: document.getElementById("flowHeavy"),
  mood: document.getElementById("mood"),
  pattern: document.getElementById("pattern"),
  typeface: document.getElementById("typeface"),
  shape: document.getElementById("shape"),
  room: document.getElementById("room"),
  marks: document.getElementById("marks"),
  chips: document.getElementById("chips"),
  charm: document.getElementById("charm"),
  charm2: document.getElementById("charm2"),
  charmCorner: document.getElementById("charmCorner"),
  phrase: document.getElementById("phrase"),
  shimmer: document.getElementById("shimmer"),
  calCharm: document.getElementById("calCharm"),
  appearanceNote: document.getElementById("appearanceNote"),
  personalLine: document.getElementById("personalLine"),
  charmLayer: document.getElementById("charmLayer"),
  resetFlowBtn: document.getElementById("resetFlowBtn"),
  notifyTime: document.getElementById("notifyTime"),
  tz: document.getElementById("tz"),
  saveThemeBtn: document.getElementById("saveThemeBtn"),
  enablePushBtn: document.getElementById("enablePushBtn"),
  customNote: document.getElementById("customNote"),
  sexLogBtn: document.getElementById("sexLogBtn"),
  vaultExportBtn: document.getElementById("vaultExportBtn"),
  vaultImportBtn: document.getElementById("vaultImportBtn"),
  vaultFile: document.getElementById("vaultFile"),
  setPasscodeBtn: document.getElementById("setPasscodeBtn"),
  lockBtn: document.getElementById("lockBtn"),
  panicBtn: document.getElementById("panicBtn"),
  lockOverlay: document.getElementById("lockOverlay"),
  passInput: document.getElementById("passInput"),
  unlockBtn: document.getElementById("unlockBtn"),
  usePanicBtn: document.getElementById("usePanicBtn"),
  lockMsg: document.getElementById("lockMsg"),
  notifyBanner: document.getElementById("notifyBanner"),
  bannerText: document.getElementById("bannerText"),
  bannerClose: document.getElementById("bannerClose"),
  sexOverlay: document.getElementById("sexOverlay"),
  sexClose: document.getElementById("sexClose"),
  sexDate: document.getElementById("sexDate"),
  sexProtection: document.getElementById("sexProtection"),
  sexNotes: document.getElementById("sexNotes"),
  sexSave: document.getElementById("sexSave"),
  sexDeleteDay: document.getElementById("sexDeleteDay"),
  sexList: document.getElementById("sexList"),
  onboardOverlay: document.getElementById("onboardOverlay"),
  obLast: document.getElementById("obLast"),
  obExtra: document.getElementById("obExtra"),
  obAdd: document.getElementById("obAdd"),
  obSituation: document.getElementById("obSituation"),
  obGoal: document.getElementById("obGoal"),
  obSave: document.getElementById("obSave"),
  obSkip: document.getElementById("obSkip"),
  coverBtn: document.getElementById("coverBtn"),
  openTodayBtn: document.getElementById("openTodayBtn"),
  pillInput: document.getElementById("pillInput"),
  pillRow: document.getElementById("pillRow"),
  suppliesLine: document.getElementById("suppliesLine"),
  heavyLine: document.getElementById("heavyLine"),
  noteSearch: document.getElementById("noteSearch"),
  noteHits: document.getElementById("noteHits"),
  periodList: document.getElementById("periodList"),
  visitFrom: document.getElementById("visitFrom"),
  visitTo: document.getElementById("visitTo"),
  copyVisit: document.getElementById("copyVisit"),
  copyShare: document.getElementById("copyShare"),
  remindWhen: document.getElementById("remindWhen"),
  tempUnit: document.getElementById("tempUnit"),
  supplyText: document.getElementById("supplyText"),
  pastStarts: document.getElementById("pastStarts"),
  saveStartsBtn: document.getElementById("saveStartsBtn"),
  changePasscodeBtn: document.getElementById("changePasscodeBtn"),
  removePasscodeBtn: document.getElementById("removePasscodeBtn"),
  symptomHide: document.getElementById("symptomHide"),
  customSymptom: document.getElementById("customSymptom"),
  addSymptomBtn: document.getElementById("addSymptomBtn"),
  dayOverlay: document.getElementById("dayOverlay"),
  dayTitle: document.getElementById("dayTitle"),
  dayBody: document.getElementById("dayBody"),
  dayClose: document.getElementById("dayClose"),
  periodOverlay: document.getElementById("periodOverlay"),
  periodTitle: document.getElementById("periodTitle"),
  periodBody: document.getElementById("periodBody"),
  periodClose: document.getElementById("periodClose"),
  sexPain: document.getElementById("sexPain")
};

let fb = null;
let meta = loadMeta();
let vault = null;
let panic = false;
let sessionPasscode = "";
let selectedISO = null;
let monthAnchor = null;
const UNDO_LIMIT = 20;
let undoStack = [];
let arrived = false;
let lastHeadline = "";
let monthMotion = "";
let decorKey = "";
let fillingMore = false;
let sheetISO = null;
let openPeriodStart = null;
let removeArmed = false;
let clearArmed = "";

main().catch((e) => {
  console.error("Fatal init error:", e);
  if (el.appTitle) el.appTitle.textContent = "Midnight";
  if (el.appSub) el.appSub.textContent = "Recovered from an error. Reload if needed.";
  if (el.statusPill) el.statusPill.textContent = "Recovered";
});

async function main() {
  el.statusPill.textContent = "Initializing…";

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  try {
    fb = await withTimeout(initFirebase(), 4000);
    await withTimeout(ensureUserDoc(fb), 3000);
  } catch (e) {
    console.warn("Firebase init failed (local-only continues):", e);
    fb = null;
  }

  vault = await loadVaultWithOptionalUnlock();

  const tz = vault?.profile?.tz || meta?.profile?.tz || CONFIG.defaults.tz;
  vault = ensureVault(vault, tz);
  ensureSexDefaults(vault);

  const theme = vault.profile.theme || meta.profile?.theme || null;
  const applied = applyTheme(theme);
  meta.profile = meta.profile || {};
  meta.profile.theme = applied;
  commitMeta();

  setInputsFromTheme(applied, el);
  el.tz.value = vault.profile.tz || CONFIG.defaults.tz;
  el.notifyTime.value = vault.profile.notifyTime || CONFIG.defaults.notifyTime;
  el.situation.value = vault.profile.situation || "cycling";
  el.goal.value = vault.profile.goal || "bleed";
  el.appearanceNote.textContent = "Appearance applies as you change it. Save to keep it.";

  wireUI();
  renderAll();

  el.statusPill.textContent = fb ? "Online sync ready" : "Local-only mode";
}

async function loadVaultWithOptionalUnlock() {
  meta = loadMeta();
  const raw = loadVaultRaw();

  if (!raw) {
    const tz = meta.profile?.tz || CONFIG.defaults.tz;
    const v = ensureVault({}, tz);
    v.profile.notifyTime = meta.profile?.notifyTime || CONFIG.defaults.notifyTime;
    v.profile.theme = meta.profile?.theme || null;
    saveVaultRaw(JSON.stringify(v));
    return v;
  }

  if (hasPasscode()) {
    showLockOverlay(true);
    const unlocked = await waitForUnlock();
    return unlocked;
  }

  try { return JSON.parse(raw); } catch { return ensureVault({}, CONFIG.defaults.tz); }
}

function wireUI() {
  fillCharmPicker(document.getElementById("charmPicker"), "charm");
  fillCharmPicker(document.getElementById("charmPicker2"), "charm2");
  document.querySelectorAll("[data-look]").forEach((btn) => {
    btn.addEventListener("click", () => applyLook(btn.dataset.look));
  });
  document.querySelectorAll("[data-choice]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = el[btn.dataset.choice];
      if (!input) return;
      input.value = btn.dataset.value;
      paintPickers();
      applyFromInputs();
    });
  });
  ["accent", "bg", "card", "text", "mark", "flowNone", "flowSpot", "flowLight", "flowMedium", "flowHeavy"].forEach((id) => {
    el[id].addEventListener("input", () => {
      el.themeStyle.value = "custom";
      paintPickers();
      applyFromInputs();
    });
  });
  el.phrase.addEventListener("input", applyFromInputs);
  el.shimmer.addEventListener("change", applyFromInputs);
  el.calCharm.addEventListener("change", applyFromInputs);
  el.resetFlowBtn.addEventListener("click", () => {
    const style = el.themeStyle.value === "custom" ? (el.themeBase.value || "velvet") : el.themeStyle.value;
    const p = presetForStyle(style);
    el.flowNone.value = p.flow.none;
    el.flowSpot.value = p.flow.spotting;
    el.flowLight.value = p.flow.light;
    el.flowMedium.value = p.flow.medium;
    el.flowHeavy.value = p.flow.heavy;
    paintPickers();
    applyFromInputs();
  });
  paintPickers();

  el.saveThemeBtn.addEventListener("click", async () => {
    const t = themeFromInputs(el);
    vault.profile.theme = t;
    meta.profile = meta.profile || {};
    meta.profile.theme = t;
    commitMeta();
    await persistVault();
    el.appearanceNote.textContent = "Saved.";
    renderAll();
  });

  el.tz.addEventListener("change", async () => {
    vault.profile.tz = el.tz.value;
    await persistVault();
    syncReminderPrefs();
    renderAll();
  });

  el.notifyTime.addEventListener("change", async () => {
    vault.profile.notifyTime = el.notifyTime.value;
    await persistVault();
    syncReminderPrefs();
    renderAll();
  });

  el.situation.addEventListener("change", async () => {
    const prev = vault.profile.situation;
    const next = el.situation.value;
    vault.profile.situation = next;
    if (prev === "pregnancy" && next !== "cycling" && next !== "pregnancy") vault.profile.forecastHold = true;
    if (next === "cycling" || next === "pregnancy") vault.profile.forecastHold = false;
    await persistVault();
    renderAll();
  });

  el.goal.addEventListener("change", async () => {
    vault.profile.goal = el.goal.value;
    await persistVault();
    renderAll();
  });

  el.enablePushBtn.addEventListener("click", () => ensurePushTokenSoft());

  el.undoBtn.addEventListener("click", async () => {
    const undo = undoStack.pop();
    if (!undo) return;
    const isos = undo.multi ? undo.multi.map((step) => step.iso) : [undo.iso];
    if (undo.multi) {
      for (const step of undo.multi) restoreDay(vault, step.iso, step.prev);
    } else {
      restoreDay(vault, undo.iso, undo.prev);
    }
    await persistVault();
    renderAll();
    if (!panic) {
      for (const iso of isos) {
        el.calendar.querySelector(`[data-iso="${iso}"]`)?.classList.add("rewind");
      }
    }
  });

  el.backTodayBtn.addEventListener("click", () => {
    selectedISO = null;
    renderAll();
  });

  el.moreToggle.addEventListener("click", () => {
    el.moreBox.classList.toggle("hidden");
    el.moreToggle.textContent = el.moreBox.classList.contains("hidden") ? "More" : "Hide extra";
  });

  el.lhInput.addEventListener("change", () => saveMore({ lh: el.lhInput.value || "" }));
  el.mucusInput.addEventListener("change", () => saveMore({ mucus: el.mucusInput.value || "" }));
  el.bbtInput.addEventListener("change", () => {
    const raw = el.bbtInput.value.trim();
    const bbt = raw === "" ? null : Number(raw);
    saveMore({ bbt: Number.isFinite(bbt) ? bbt : null });
  });
  el.notesInput.addEventListener("blur", () => {
    const { iso, future } = loggingISO();
    if (future) return;
    if ((vault.daily?.[iso]?.notes || "") === el.notesInput.value) return;
    saveMore({ notes: el.notesInput.value });
  });

  el.calPrev.addEventListener("click", () => {
    const tz = vault.profile.tz || CONFIG.defaults.tz;
    monthAnchor = shiftMonth(monthAnchor || `${todayISO(tz).slice(0, 7)}-01`, -1);
    monthMotion = "prev";
    renderAll();
  });
  el.calNext.addEventListener("click", () => {
    const tz = vault.profile.tz || CONFIG.defaults.tz;
    monthAnchor = shiftMonth(monthAnchor || `${todayISO(tz).slice(0, 7)}-01`, 1);
    monthMotion = "next";
    renderAll();
  });

  el.rangeApply.addEventListener("click", async () => {
    const start = el.rangeStart.value;
    const end = el.rangeEnd.value;
    if (!start || !end) {
      el.rangeNote.textContent = "Choose a start and an end.";
      return;
    }
    const tz = vault.profile.tz || CONFIG.defaults.tz;
    const today = todayISO(tz);
    let a = start;
    let b = end;
    if (b < a) { const swap = a; a = b; b = swap; }
    if (b > today) b = today;
    const multi = [];
    let iso = a;
    let n = 0;
    while (iso <= b && n < 14) {
      multi.push({ iso, prev: snapshotDay(vault, iso) });
      iso = addDaysISO(iso, 1);
      n += 1;
    }
    const marked = markPeriodRange(vault, a, b, today);
    if (marked) pushUndo({ multi });
    const stoppedEarly = n === 14 && addDaysISO(a, 13) < b;
    const futureCut = end > today || start > today;
    const kept = marked > 0 && marked < n ? " Days that were already light, medium, or heavy were left alone." : "";
    if (!n) el.rangeNote.textContent = "Nothing to mark. Future days stay blank.";
    else if (!marked) el.rangeNote.textContent = "Those days already have bleeding logged, so they were left as they are.";
    else if (stoppedEarly) el.rangeNote.textContent = `Marked ${marked} days. Only 14 days can be marked at a time.${kept}`;
    else if (futureCut) el.rangeNote.textContent = `Marked ${marked} day${marked === 1 ? "" : "s"} through today.${kept}`;
    else el.rangeNote.textContent = `Marked ${marked} day${marked === 1 ? "" : "s"}.${kept}`;
    await persistVault();
    renderAll();
  });

  el.copySummary.addEventListener("click", async () => {
    const text = el.summaryText.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      el.copyNote.textContent = "Copied.";
    } catch {
      el.copyNote.textContent = "Select the summary and copy it from there.";
    }
  });

  el.vaultExportBtn.addEventListener("click", () => {
    downloadJSON("midnight-vault.json", { ...vault, exportedAt: new Date().toISOString() });
  });

  el.vaultImportBtn.addEventListener("click", () => el.vaultFile.click());
  el.vaultFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text().catch(() => null);
    if (!text) return;
    try {
      const obj = JSON.parse(text);
      vault = ensureVault(obj, vault.profile.tz);
      ensureSexDefaults(vault);
      if (vault.profile.theme) {
        applyTheme(vault.profile.theme);
        setInputsFromTheme(vault.profile.theme, el);
        paintPickers();
      }
      undoStack = [];
      await persistVault();
      renderAll();
      el.customNote.textContent = "Vault imported.";
    } catch {
      el.customNote.textContent = "Import failed (invalid JSON).";
    } finally {
      el.vaultFile.value = "";
    }
  });

  el.setPasscodeBtn.addEventListener("click", async () => {
    const code = prompt("Set a passcode (4–8 digits). Don’t forget it.");
    if (code == null) return;
    if (!validPasscode(code)) {
      el.customNote.textContent = "Use 4–8 digits.";
      return;
    }
    sessionPasscode = code;
    await setPasscode(code, vault);
    setLocked(false);
    el.customNote.textContent = "Passcode set. Vault is now encrypted.";
    renderAll();
  });

  el.lockBtn.addEventListener("click", async () => {
    if (!hasPasscode()) {
      alert("Set a passcode first (Settings → Set passcode).");
      return;
    }
    sessionPasscode = "";
    await lockNow();
    showLockOverlay(true);
  });

  el.panicBtn.addEventListener("click", () => setPanic(!panic));
  el.usePanicBtn.addEventListener("click", () => setPanic(true));

  el.unlockBtn.addEventListener("click", async () => {
    const code = el.passInput.value.trim();
    if (!code) return;
    el.lockMsg.textContent = "Checking…";
    const res = await unlockVault(code);
    if (!res.ok) {
      el.lockMsg.textContent = "Wrong passcode.";
      return;
    }
    sessionPasscode = code;
    vault = ensureVault(res.vault || {}, CONFIG.defaults.tz);
    ensureSexDefaults(vault);
    el.passInput.value = "";
    showLockOverlay(false);
    el.lockMsg.textContent = "";
    await persistVault();
    renderAll();
  });

  el.bannerClose.addEventListener("click", () => {
    el.notifyBanner.classList.add("hidden");
    markBannerShown(vault.profile.tz);
  });

  el.sexLogBtn.addEventListener("click", () => openSexLog());
  el.sexClose.addEventListener("click", () => closeSexLog());
  el.sexDate.addEventListener("change", () => loadSexEntryIntoForm());

  el.sexSave.addEventListener("click", async () => {
    if (hasPasscode() && !sessionPasscode) return showLockOverlay(true);
    const iso = el.sexDate.value;
    if (!iso) return;
    setSexEntry(vault, iso, {
      protection: el.sexProtection.value,
      pain: el.sexPain.value,
      notes: el.sexNotes.value
    });
    await persistVault();
    refreshSexList();
  });

  el.sexDeleteDay.addEventListener("click", async () => {
    if (hasPasscode() && !sessionPasscode) return showLockOverlay(true);
    const iso = el.sexDate.value;
    if (!iso) return;
    deleteSexEntry(vault, iso);
    await persistVault();
    refreshSexList();
    loadSexEntryIntoForm();
  });

  el.obAdd.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "date";
    input.className = "input obExtra";
    el.obExtra.appendChild(input);
  });

  el.obSave.addEventListener("click", async () => {
    vault.profile.situation = el.obSituation.value || "cycling";
    vault.profile.goal = el.obGoal.value || "bleed";
    vault.profile.onboarded = true;
    el.situation.value = vault.profile.situation;
    el.goal.value = vault.profile.goal;
    const today = todayISO(vault.profile.tz || CONFIG.defaults.tz);
    const dates = [el.obLast.value, ...[...el.obExtra.querySelectorAll("input")].map((n) => n.value)];
    for (const iso of dates) {
      if (iso && iso <= today) addPeriodStart(vault, iso);
    }
    await persistVault();
    renderAll();
  });

  el.obSkip.addEventListener("click", async () => {
    vault.profile.onboarded = true;
    await persistVault();
    renderAll();
  });

  el.coverBtn.addEventListener("click", async () => {
    vault.profile.discreet = !vault.profile.discreet;
    if (vault.profile.discreet) {
      closeDay();
      closePeriod();
    }
    await persistVault();
    renderAll();
  });
  el.openTodayBtn.addEventListener("click", () => openDay(todayISO(vault.profile.tz || CONFIG.defaults.tz)));
  el.dayClose.addEventListener("click", () => closeDay());
  el.periodClose.addEventListener("click", () => closePeriod());
  el.dayBody.addEventListener("click", onDayClick);
  el.dayBody.addEventListener("change", onDayChange);
  el.periodBody.addEventListener("click", onPeriodClick);

  el.pillInput.addEventListener("change", () => saveMore({ pillTaken: el.pillInput.checked }));
  el.noteSearch.addEventListener("input", () => renderNoteHits());
  el.periodList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-period]");
    if (!btn) return;
    openPeriod(btn.dataset.period);
  });
  el.noteHits.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-note-day]");
    if (!btn) return;
    openDay(btn.dataset.noteDay);
  });

  el.copyVisit.addEventListener("click", async () => {
    const from = el.visitFrom.value;
    const to = el.visitTo.value;
    if (!from || !to) {
      el.copyNote.textContent = "Choose a start and an end.";
      return;
    }
    const text = visitText(vault, from <= to ? from : to, from <= to ? to : from, todayISO(vault.profile.tz));
    await copyText(text, el.copyNote);
  });
  el.copyShare.addEventListener("click", async () => {
    const tz = vault.profile.tz || CONFIG.defaults.tz;
    const model = buildForecast(vault, tz, 1, todayISO(tz)).model;
    const text = shareSentence(model);
    await copyText(text || "No period window to share yet.", el.copyNote);
  });

  el.remindWhen.addEventListener("change", async () => {
    vault.profile.remindWhen = el.remindWhen.value;
    await persistVault();
    renderAll();
  });
  el.tempUnit.addEventListener("change", async () => {
    vault.profile.tempUnit = el.tempUnit.value;
    await persistVault();
    renderAll();
  });
  el.supplyText.addEventListener("change", async () => {
    vault.profile.supplyText = el.supplyText.value;
    await persistVault();
    renderAll();
  });
  el.saveStartsBtn.addEventListener("click", async () => savePastStarts());
  el.changePasscodeBtn.addEventListener("click", () => changePasscode());
  el.removePasscodeBtn.addEventListener("click", () => removePasscode());
  el.addSymptomBtn.addEventListener("click", () => addCustomSymptom());
  el.symptomHide.addEventListener("change", onHideSymptom);
}

function snapshotDay(vaultObj, iso) {
  const row = vaultObj.daily?.[iso];
  if (!row) return null;
  return {
    ...row,
    symptoms: Array.isArray(row.symptoms) ? [...row.symptoms] : row.symptoms,
    context: Array.isArray(row.context) ? [...row.context] : row.context,
    symptomLevel: row.symptomLevel && typeof row.symptomLevel === "object" ? { ...row.symptomLevel } : row.symptomLevel
  };
}

function loggingISO() {
  const tz = vault.profile.tz || CONFIG.defaults.tz;
  const today = todayISO(tz);
  return { tz, today, iso: today, future: false };
}

async function saveMore(patch) {
  if (fillingMore || !vault) return;
  if (hasPasscode() && isLocked()) return showLockOverlay(true);
  const { iso, future } = loggingISO();
  if (future) return;
  const prev = updateDay(vault, iso, patch);
  pushUndo({ iso, prev });
  await persistVault();
  renderAll();
}

async function logFlow(flow) {
  if (hasPasscode() && isLocked()) return showLockOverlay(true);
  const { iso, future } = loggingISO();
  if (future) return;
  const prev = updateDay(vault, iso, { flow });
  pushUndo({ iso, prev });
  await persistVault();
  renderAll();
  playLogMotion(flow, iso);
}

async function toggleSymptom(id) {
  if (hasPasscode() && isLocked()) return showLockOverlay(true);
  const { iso, future } = loggingISO();
  if (future) return;
  const cur = new Set(vault.daily?.[iso]?.symptoms || []);
  const levels = { ...(vault.daily?.[iso]?.symptomLevel || {}) };
  if (!cur.has(id)) {
    cur.add(id);
    levels[id] = "mild";
  } else if (levels[id] !== "strong") {
    levels[id] = "strong";
  } else {
    cur.delete(id);
    delete levels[id];
  }
  const prev = updateDay(vault, iso, { symptoms: [...cur], symptomLevel: levels });
  pushUndo({ iso, prev });
  await persistVault();
  renderAll();
}

function setPanic(state) {
  panic = !!state;
  document.body.classList.toggle("panicMode", panic);
  if (panic) {
    closeDay();
    closePeriod();
  }
  if (panic) {
    el.appTitle.textContent = "Calendar";
    el.appSub.textContent = "Schedule overview.";
    closeSexLog();
    showLockOverlay(false);
    el.onboardOverlay.classList.add("hidden");
  } else {
    el.appTitle.textContent = "Midnight";
    el.appSub.textContent = "Your cycle, private on this device.";
  }
  renderAll();
}

function showLockOverlay(show) {
  el.lockOverlay.classList.toggle("hidden", !show);
}

function openSexLog() {
  if (vault?.profile?.goal !== "fertility") return;
  if (hasPasscode() && !sessionPasscode) {
    showLockOverlay(true);
    return;
  }
  el.sexOverlay.classList.remove("hidden");
  seedSexDateInput(el.sexDate, vault.profile.tz);
  loadSexEntryIntoForm();
  refreshSexList();
}

function closeSexLog() {
  el.sexOverlay.classList.add("hidden");
}

function loadSexEntryIntoForm() {
  const iso = el.sexDate.value;
  const entry = getSexEntry(vault, iso);
  el.sexProtection.value = entry?.protection || "protected";
  el.sexPain.value = entry?.pain || "";
  el.sexNotes.value = entry?.notes || "";
}

function refreshSexList() {
  el.sexList.innerHTML = "";
  const items = listSexEntries(vault, 25);
  if (!items.length) {
    el.sexList.innerHTML = `<div class="tiny muted">No entries yet.</div>`;
    return;
  }
  for (const it of items) {
    const div = document.createElement("div");
    div.className = "listItem";
    const top = document.createElement("div");
    top.className = "listItemTop";
    const title = document.createElement("div");
    title.className = "listItemTitle";
    title.textContent = it.date;
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = [it.protection, it.pain].filter(Boolean).join(" · ");
    top.appendChild(title);
    top.appendChild(pill);
    const sub = document.createElement("div");
    sub.className = "listItemSub";
    sub.textContent = it.notes || "";
    div.appendChild(top);
    div.appendChild(sub);
    div.addEventListener("click", () => {
      el.sexDate.value = it.date;
      loadSexEntryIntoForm();
    });
    el.sexList.appendChild(div);
  }
}

function renderAll() {
  if (!vault) return;

  const tz = vault.profile.tz || CONFIG.defaults.tz;
  const today = todayISO(tz);
  if (!monthAnchor) monthAnchor = `${today.slice(0, 7)}-01`;

  const showOnboard = !panic && !vault.profile.onboarded && !(hasPasscode() && isLocked());
  el.onboardOverlay.classList.toggle("hidden", !showOnboard);
  syncControls();
  paintDecor(currentTheme());

  if (panic) {
    setForecastMood(null);
    el.notifyBanner.classList.add("hidden");
    el.sexLogBtn.classList.add("hidden");
    el.calLabel.textContent = monthLabel(monthAnchor);
    renderCalendar(el.calendar, {
      vault,
      model: null,
      anchorISO: monthAnchor,
      selectedISO: today,
      today,
      plain: true,
      onSelect: () => {}
    });
    el.statusPill.textContent = "Schedule";
    return;
  }

  const forecast = buildForecast(vault, tz, 14, today);
  const model = forecast.model;
  const day = vault.daily?.[today] || {};

  el.logDayLabel.textContent = "Today";
  const nextHeadline = headlineFor(model);
  const headlineChanged = lastHeadline !== "" && nextHeadline !== lastHeadline;
  el.headline.textContent = nextHeadline;
  if (headlineChanged) {
    el.headline.classList.remove("settling");
    void el.headline.offsetWidth;
    el.headline.classList.add("settling");
  }
  lastHeadline = nextHeadline;
  el.daySentence.textContent = daySentence(model);
  el.trackLine.textContent = trackSentence(model.track);
  el.lateNote.textContent = lateSentence(model);
  el.wideNote.textContent = wideSentence(model);
  el.insightLine.textContent = insightSentence(vault);
  el.fertileLine.textContent = fertileSentence(model);

  el.undoBtn.classList.toggle("hidden", undoStack.length === 0);
  el.backTodayBtn.classList.add("hidden");
  el.sexLogBtn.classList.toggle("hidden", vault.profile.goal !== "fertility");
  document.body.classList.toggle("discreet", !!vault.profile.discreet);
  if (el.coverBtn) el.coverBtn.textContent = vault.profile.discreet ? "Show" : "Cover";
  if (el.pillRow) el.pillRow.classList.toggle("hidden", vault.profile.situation !== "hormonal");

  renderFlow(day.flow || "");
  renderChips(day);
  fillMore(day);
  renderTimeline(el.timeline, forecast);
  el.calLabel.textContent = monthLabel(monthAnchor);
  const decor = currentTheme();
  renderCalendar(el.calendar, {
    vault,
    model,
    anchorISO: monthAnchor,
    selectedISO: sheetISO || today,
    today,
    calCharm: decor.calCharm,
    charm: decor.charm,
    onSelect: (iso) => {
      if (vault.profile.discreet) {
        vault.profile.discreet = false;
        persistVault().then(() => renderAll());
        return;
      }
      openDay(iso);
    }
  });

  el.summaryText.textContent = clinicianSummary(vault, model);
  renderGates(model);
  setForecastMood(model);

  paintSupplies(model, today);
  renderCycleBook(today);
  renderSymptomEditor();
  if (sheetISO) renderDaySheet();
  if (openPeriodStart) renderPeriod();

  maybeShowFallbackBanner(model, today, tz);
  cueMotion();
}

function syncControls() {
  const profile = vault?.profile || {};
  setIfIdle(el.situation, profile.situation || "cycling");
  setIfIdle(el.goal, profile.goal || "bleed");
  setIfIdle(el.tz, profile.tz || CONFIG.defaults.tz);
  setIfIdle(el.notifyTime, profile.notifyTime || CONFIG.defaults.notifyTime);
  setIfIdle(el.remindWhen, profile.remindWhen || "both");
  setIfIdle(el.tempUnit, profile.tempUnit || "C");
  setIfIdle(el.supplyText, profile.supplyText || "");
  if (el.bbtInput) el.bbtInput.placeholder = (profile.tempUnit || "C") === "F" ? "°F" : "°C";
}

function setIfIdle(node, value) {
  if (!node || document.activeElement === node) return;
  if (node.tagName === "SELECT") ensureSelectValue(node, value);
  if (node.value !== value) node.value = value;
}

function ensureSelectValue(node, value) {
  if (!value || [...node.options].some((o) => o.value === value)) return;
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = value;
  node.appendChild(opt);
}

function applyFromInputs() {
  const t = themeFromInputs(el);
  applyTheme(t);
  paintDecor(t);
  el.appearanceNote.textContent = "Applied. Save appearance to keep it.";
}

function applyLook(style) {
  if (style === "custom") {
    el.themeStyle.value = "custom";
    paintPickers();
    applyFromInputs();
    return;
  }
  const phrase = el.phrase.value;
  const p = presetForStyle(style);
  setInputsFromTheme({ ...p, style, base: style, phrase }, el);
  paintPickers();
  applyFromInputs();
  playLookSweep();
}

function paintPickers() {
  document.querySelectorAll("[data-look]").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.look === el.themeStyle.value);
  });
  document.querySelectorAll("[data-choice]").forEach((btn) => {
    const input = el[btn.dataset.choice];
    btn.classList.toggle("on", !!input && input.value === btn.dataset.value);
  });
}

function fillCharmPicker(container, choice) {
  if (!container) return;
  container.innerHTML = "";
  for (const id of CHARMS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "charmPick";
    btn.dataset.choice = choice;
    btn.dataset.value = id;
    btn.title = id === "none" ? "None" : id;
    if (id === "none") btn.textContent = "·";
    else btn.innerHTML = charmSvg(id);
    container.appendChild(btn);
  }
}

function paintSupplies(model, today) {
  const lines = supplyLines(vault);
  const show = lines.length && reminderRelevant({ ...model, inBleed: false }, today, "both") && !model.inBleed;
  el.suppliesLine.classList.toggle("hidden", !show);
  el.suppliesLine.textContent = show ? `Have ready: ${lines.join(", ")}` : "";
}

function renderCycleBook(today) {
  const pages = periodPages(vault, today);
  el.heavyLine.textContent = heavyDaySentence(heavyDayPattern(vault, today));
  el.periodList.replaceChildren();
  if (!pages.length) {
    const empty = document.createElement("div");
    empty.className = "tiny muted";
    empty.textContent = "Logged periods will gather here.";
    el.periodList.appendChild(empty);
    return;
  }
  for (const page of pages.slice(0, 24)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "listItem";
    btn.dataset.period = page.start;
    const title = document.createElement("div");
    title.className = "listItemTitle";
    const cycle = page.cycleLength ? ` · ${page.cycleLength}-day cycle` : "";
    title.textContent = `${formatWeekday(page.start)} · ${page.bleedDays} bleeding day${page.bleedDays === 1 ? "" : "s"}${cycle}`;
    const sub = document.createElement("div");
    sub.className = "listItemSub";
    sub.textContent = [windowSentence(page), mentionSentence(page)].filter(Boolean).join(" ");
    btn.appendChild(title);
    btn.appendChild(sub);
    el.periodList.appendChild(btn);
  }
}

function renderNoteHits() {
  const hits = searchNotes(vault, el.noteSearch.value);
  el.noteHits.replaceChildren();
  for (const hit of hits) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "listItem";
    btn.dataset.noteDay = hit.iso;
    const title = document.createElement("div");
    title.className = "listItemTitle";
    title.textContent = formatWeekday(hit.iso);
    const sub = document.createElement("div");
    sub.className = "listItemSub";
    sub.textContent = hit.notes;
    btn.appendChild(title);
    btn.appendChild(sub);
    el.noteHits.appendChild(btn);
  }
}

function renderSymptomEditor() {
  const hidden = new Set(vault.profile.hiddenSymptoms || []);
  const catalog = [
    ...visibleSymptoms({ profile: {} }),
    ...(vault.profile.customSymptoms || []).map((item) => ({ id: item.id, label: item.label }))
  ];
  const seen = new Set();
  el.symptomHide.replaceChildren();
  for (const chip of catalog) {
    if (!chip?.id || seen.has(chip.id)) continue;
    seen.add(chip.id);
    const label = document.createElement("label");
    label.className = "checkInline";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.hideSymptom = chip.id;
    input.checked = !hidden.has(chip.id);
    label.appendChild(input);
    label.appendChild(document.createTextNode(chip.label));
    el.symptomHide.appendChild(label);
  }
}

function openDay(iso) {
  if (!iso || panic) return;
  sheetISO = iso;
  el.dayOverlay.classList.remove("hidden");
  renderDaySheet();
}

function closeDay() {
  sheetISO = null;
  el.dayOverlay.classList.add("hidden");
}

function openPeriod(start) {
  openPeriodStart = start;
  clearArmed = "";
  el.periodOverlay.classList.remove("hidden");
  renderPeriod();
}

function closePeriod() {
  openPeriodStart = null;
  clearArmed = "";
  el.periodOverlay.classList.add("hidden");
}

function renderDaySheet() {
  if (!sheetISO) return;
  const tz = vault.profile.tz || CONFIG.defaults.tz;
  const today = todayISO(tz);
  const iso = sheetISO;
  const future = iso > today;
  const day = vault.daily?.[iso] || {};
  el.dayTitle.textContent = formatWeekday(iso);
  const root = document.createElement("div");
  root.className = "dayBlock";

  const flowRow = document.createElement("div");
  flowRow.className = "flowRow";
  for (const [value, label] of FLOWS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flowBtn" + (day.flow === value ? " on" : "");
    btn.dataset.dayFlow = value;
    btn.textContent = label;
    btn.disabled = future;
    flowRow.appendChild(btn);
  }
  root.appendChild(flowRow);

  const chips = document.createElement("div");
  chips.className = "chips";
  const on = new Set(day.symptoms || []);
  for (const chip of visibleSymptoms(vault)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (on.has(chip.id) ? " on" : "");
    btn.dataset.daySymptom = chip.id;
    btn.textContent = symptomLevelLabel(vault, chip.id, on.has(chip.id) ? day.symptomLevel?.[chip.id] : "");
    btn.disabled = future;
    chips.appendChild(btn);
  }
  root.appendChild(chips);

  root.appendChild(labeledSelect("Pain", "dayPain", [["", "Not logged"], ...Array.from({ length: 11 }, (_, n) => [String(n), String(n)])], day.pain == null ? "" : String(day.pain), future));
  root.appendChild(checkField("dayClots", "Clots", !!day.clots, future));
  root.appendChild(checkField("daySoaked", "Soaked through", !!day.soaked, future));
  root.appendChild(labeledSelect("Product", "dayProduct", PRODUCTS, day.product || "", future));

  const contexts = document.createElement("div");
  contexts.className = "contextRow";
  const have = new Set(day.context || []);
  for (const [value, label] of CONTEXTS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (have.has(value) ? " on" : "");
    btn.dataset.dayContext = value;
    btn.textContent = label;
    btn.disabled = future;
    contexts.appendChild(btn);
  }
  root.appendChild(contexts);

  if (vault.profile.situation === "hormonal") root.appendChild(checkField("dayPill", "Pill taken", !!day.pillTaken, future));
  root.appendChild(labeledSelect("LH test", "dayLh", [["", "Not logged"], ["neg", "Negative"], ["pos", "Positive"]], day.lh || "", future));
  root.appendChild(labeledSelect("Mucus", "dayMucus", MUCUS, day.mucus || "", future));

  const note = document.createElement("textarea");
  note.className = "input";
  note.rows = 2;
  note.dataset.dayNotes = "1";
  note.placeholder = "Note";
  note.value = day.notes || "";
  note.disabled = future;
  root.appendChild(note);

  const temp = document.createElement("input");
  temp.className = "input";
  temp.type = "number";
  temp.step = "0.01";
  temp.dataset.dayBbt = "1";
  temp.placeholder = (vault.profile.tempUnit || "C") === "F" ? "Waking temperature °F" : "Waking temperature °C";
  temp.value = typeof day.bbt === "number" ? String(day.bbt) : "";
  temp.disabled = future;
  root.appendChild(temp);

  el.dayBody.replaceChildren(root);
}

function renderPeriod() {
  const today = todayISO(vault.profile.tz || CONFIG.defaults.tz);
  const page = periodPages(vault, today).find((item) => item.start === openPeriodStart);
  if (!page) {
    closePeriod();
    return;
  }
  el.periodTitle.textContent = formatWeekday(page.start);
  const root = document.createElement("div");
  root.className = "dayBlock";
  for (const text of [windowSentence(page), mentionSentence(page), page.cycleLength ? `The next cycle was ${page.cycleLength} days.` : ""]) {
    if (!text) continue;
    const p = document.createElement("p");
    p.className = "lead";
    p.textContent = text;
    root.appendChild(p);
  }
  for (const day of page.days) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "listItem";
    btn.dataset.periodDay = day.iso;
    const title = document.createElement("div");
    title.className = "listItemTitle";
    title.textContent = `${formatWeekday(day.iso)} · ${day.flow || "no flow"}`;
    const bits = [];
    if (day.product) bits.push(day.product);
    if (day.pain != null) bits.push(`pain ${day.pain}`);
    if (day.clots) bits.push("clots");
    if (day.soaked) bits.push("soaked through");
    const sub = document.createElement("div");
    sub.className = "listItemSub";
    sub.textContent = bits.join(" · ");
    btn.appendChild(title);
    btn.appendChild(sub);
    root.appendChild(btn);
  }
  const jump = document.createElement("button");
  jump.type = "button";
  jump.className = "btn";
  jump.dataset.periodJump = page.start;
  jump.textContent = "Show this month";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "btn ghost";
  clear.dataset.periodClear = page.start;
  clear.textContent = clearArmed === page.start ? "Tap again to clear this period's bleeding" : "This was not a period";
  const row = document.createElement("div");
  row.className = "quick";
  row.appendChild(jump);
  row.appendChild(clear);
  root.appendChild(row);
  el.periodBody.replaceChildren(root);
}

function labeledSelect(labelText, key, options, value, disabled) {
  const wrap = document.createElement("label");
  wrap.className = "formRow";
  const name = document.createElement("span");
  name.className = "label";
  name.textContent = labelText;
  const select = document.createElement("select");
  select.className = "input";
  select.dataset.dayField = key;
  select.disabled = disabled;
  for (const [optionValue, optionLabel] of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    if (optionValue === value) option.selected = true;
    select.appendChild(option);
  }
  wrap.appendChild(name);
  wrap.appendChild(select);
  return wrap;
}

function checkField(key, labelText, checked, disabled) {
  const label = document.createElement("label");
  label.className = "checkInline";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.dayCheck = key;
  input.checked = checked;
  input.disabled = disabled;
  label.appendChild(input);
  label.appendChild(document.createTextNode(labelText));
  return label;
}

async function saveSheet(patch) {
  if (!sheetISO || !vault) return;
  const today = todayISO(vault.profile.tz || CONFIG.defaults.tz);
  if (sheetISO > today) return;
  const prev = updateDay(vault, sheetISO, patch);
  pushUndo({ iso: sheetISO, prev });
  await persistVault();
  renderAll();
}

function onDayClick(event) {
  const flowBtn = event.target.closest("[data-day-flow]");
  if (flowBtn) {
    saveSheet({ flow: flowBtn.dataset.dayFlow });
    return;
  }
  const symptomBtn = event.target.closest("[data-day-symptom]");
  if (symptomBtn) {
    const id = symptomBtn.dataset.daySymptom;
    const day = vault.daily?.[sheetISO] || {};
    const cur = new Set(day.symptoms || []);
    const levels = { ...(day.symptomLevel || {}) };
    if (!cur.has(id)) {
      cur.add(id);
      levels[id] = "mild";
    } else if (levels[id] !== "strong") levels[id] = "strong";
    else {
      cur.delete(id);
      delete levels[id];
    }
    saveSheet({ symptoms: [...cur], symptomLevel: levels });
    return;
  }
  const contextBtn = event.target.closest("[data-day-context]");
  if (contextBtn) {
    const id = contextBtn.dataset.dayContext;
    const have = new Set(vault.daily?.[sheetISO]?.context || []);
    if (have.has(id)) have.delete(id);
    else have.add(id);
    saveSheet({ context: [...have] });
  }
}

function onDayChange(event) {
  const target = event.target;
  if (target.dataset.dayField === "dayPain") {
    saveSheet({ pain: target.value === "" ? null : Number(target.value) });
  } else if (target.dataset.dayField === "dayProduct") saveSheet({ product: target.value });
  else if (target.dataset.dayField === "dayLh") saveSheet({ lh: target.value });
  else if (target.dataset.dayField === "dayMucus") saveSheet({ mucus: target.value });
  else if (target.dataset.dayCheck === "dayClots") saveSheet({ clots: target.checked });
  else if (target.dataset.dayCheck === "daySoaked") saveSheet({ soaked: target.checked });
  else if (target.dataset.dayCheck === "dayPill") saveSheet({ pillTaken: target.checked });
  else if (target.dataset.dayNotes) saveSheet({ notes: target.value });
  else if (target.dataset.dayBbt) {
    const raw = target.value.trim();
    const bbt = raw === "" ? null : Number(raw);
    saveSheet({ bbt: Number.isFinite(bbt) ? bbt : null });
  }
}

function onPeriodClick(event) {
  const dayBtn = event.target.closest("[data-period-day]");
  if (dayBtn) {
    openDay(dayBtn.dataset.periodDay);
    return;
  }
  const jump = event.target.closest("[data-period-jump]");
  if (jump) {
    monthAnchor = `${jump.dataset.periodJump.slice(0, 7)}-01`;
    closePeriod();
    renderAll();
    el.calendar.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const clear = event.target.closest("[data-period-clear]");
  if (!clear) return;
  const start = clear.dataset.periodClear;
  if (clearArmed !== start) {
    clearArmed = start;
    renderPeriod();
    return;
  }
  clearPeriod(start);
}

async function clearPeriod(start) {
  const today = todayISO(vault.profile.tz || CONFIG.defaults.tz);
  const page = periodPages(vault, today).find((item) => item.start === start);
  clearArmed = "";
  if (!page) return;
  const multi = [];
  for (const day of page.days) {
    if (!START_FLOW.has(day.flow)) continue;
    multi.push({ iso: day.iso, prev: snapshotDay(vault, day.iso) });
    updateDay(vault, day.iso, { flow: "none" });
  }
  if (multi.length) pushUndo({ multi });
  await persistVault();
  closePeriod();
  renderAll();
}

async function savePastStarts() {
  const today = todayISO(vault.profile.tz || CONFIG.defaults.tz);
  const dates = parseStartDates(el.pastStarts.value).filter((iso) => iso <= today);
  if (!dates.length) {
    el.customNote.textContent = "Add dates like 2025-11-02.";
    return;
  }
  const multi = [];
  for (const iso of dates) {
    multi.push({ iso, prev: snapshotDay(vault, iso) });
    addPeriodStart(vault, iso);
  }
  pushUndo({ multi });
  el.pastStarts.value = "";
  await persistVault();
  el.customNote.textContent = `Added ${dates.length} start${dates.length === 1 ? "" : "s"}.`;
  renderAll();
}

async function changePasscode() {
  if (!hasPasscode() || !sessionPasscode) {
    el.customNote.textContent = "Unlock with the current passcode first.";
    return;
  }
  const code = prompt("Choose a new passcode (4–8 digits).");
  if (code == null) return;
  if (!validPasscode(code)) {
    el.customNote.textContent = "Use 4–8 digits.";
    return;
  }
  sessionPasscode = code;
  await setPasscode(code, vault);
  el.customNote.textContent = "Passcode changed.";
}

async function removePasscode() {
  if (!hasPasscode()) {
    el.customNote.textContent = "No passcode is set.";
    return;
  }
  if (!removeArmed) {
    removeArmed = true;
    el.customNote.textContent = "Tap remove passcode again to keep the vault unlocked on this device.";
    return;
  }
  removeArmed = false;
  clearPasscode();
  sessionPasscode = "";
  await persistVault();
  el.customNote.textContent = "Passcode removed. The vault on this device is unlocked.";
}

function addCustomSymptom() {
  const label = el.customSymptom.value.trim().slice(0, 24);
  if (!label) return;
  const list = Array.isArray(vault.profile.customSymptoms) ? vault.profile.customSymptoms : [];
  if (list.length >= 12) {
    el.customNote.textContent = "Twelve added symptoms is the limit.";
    return;
  }
  list.push({ id: `c${Date.now().toString(36)}`, label });
  vault.profile.customSymptoms = list;
  el.customSymptom.value = "";
  persistVault().then(() => renderAll());
}

function onHideSymptom(event) {
  const id = event.target?.dataset?.hideSymptom;
  if (!id) return;
  const hidden = new Set(vault.profile.hiddenSymptoms || []);
  if (event.target.checked) hidden.delete(id);
  else hidden.add(id);
  vault.profile.hiddenSymptoms = [...hidden];
  persistVault().then(() => renderAll());
}

async function copyText(text, note) {
  try {
    await navigator.clipboard.writeText(text);
    note.textContent = "Copied.";
  } catch {
    if (el.summaryText) el.summaryText.textContent = text;
    note.textContent = "Select the summary and copy it from there.";
  }
}

function setForecastMood(model) {
  document.body.classList.toggle("forecast-bleed", !!model?.inBleed);
  document.body.classList.toggle("forecast-late", !!(model?.late && !model?.inBleed));
  document.body.classList.toggle("forecast-paused", !!model?.paused);
}

function playLookSweep() {
  const sweep = document.getElementById("lookSweep");
  if (!sweep || panic) return;
  sweep.classList.remove("on");
  void sweep.offsetWidth;
  sweep.classList.add("on");
}

function playLogMotion(flow, iso) {
  if (panic) return;
  const btn = el.flowRow.querySelector(`[data-flow="${flow}"]`);
  if (flow === "spotting") {
    btn?.classList.add("spark");
    return;
  }
  if (flow === "none") {
    btn?.classList.add("exhale");
    document.body.classList.add("exhale");
    setTimeout(() => document.body.classList.remove("exhale"), 720);
    return;
  }
  if (flow !== "light" && flow !== "medium" && flow !== "heavy") return;
  btn?.classList.add("sheen", `sheen-${flow}`);
  const cell = el.calendar.querySelector(`[data-iso="${iso}"]`);
  if (cell) {
    cell.classList.remove("pulseRing", "pulse-light", "pulse-medium", "pulse-heavy");
    void cell.offsetWidth;
    cell.classList.add("pulseRing", `pulse-${flow}`);
  }
  const quiet = document.body.classList.contains("forecast-paused") || document.body.classList.contains("forecast-late");
  if (!quiet) charmReact(flow);
  if (currentTheme().shimmer) {
    document.body.classList.add("shimmer");
    setTimeout(() => document.body.classList.remove("shimmer"), 700);
  }
}

function charmReact(flow) {
  const weight = flow === "heavy" ? "react-heavy" : (flow === "light" ? "react-light" : "react-medium");
  el.charmLayer?.querySelectorAll(".charm").forEach((span) => {
    span.classList.remove("react", "react-light", "react-medium", "react-heavy", "drop");
    void span.offsetWidth;
    span.classList.add("react", weight);
  });
}

function cueMotion() {
  if (!el.calendar || panic) return;
  if (monthMotion) {
    const cls = monthMotion === "next" ? "shift-next" : "shift-prev";
    monthMotion = "";
    el.calendar.classList.remove("shift-next", "shift-prev");
    void el.calendar.offsetWidth;
    el.calendar.classList.add(cls);
  }
  if (!arrived && vault?.profile?.onboarded) {
    arrived = true;
    document.body.classList.add("arrive");
    el.calendar.classList.add("drawRing");
    setTimeout(() => {
      document.body.classList.remove("arrive");
      el.calendar?.classList.remove("drawRing");
    }, 1900);
  }
}

function paintDecor(theme) {
  const t = theme || currentTheme();
  if (el.personalLine) {
    const prev = el.personalLine.textContent || "";
    const next = t.phrase || "";
    el.personalLine.textContent = next;
    el.personalLine.classList.toggle("hidden", !next);
    if (!prev && next) {
      el.personalLine.classList.remove("lineIn");
      void el.personalLine.offsetWidth;
      el.personalLine.classList.add("lineIn");
    }
  }
  if (!el.charmLayer) return;
  const key = `${t.charm}|${t.charm2}|${t.charmCorner}`;
  const dropIn = decorKey !== "" && key !== decorKey;
  el.charmLayer.classList.toggle("corner-tl", t.charmCorner === "tl");
  el.charmLayer.classList.toggle("corner-tr", t.charmCorner === "tr");
  el.charmLayer.classList.toggle("corner-bl", t.charmCorner === "bl");
  el.charmLayer.classList.toggle("corner-br", t.charmCorner === "br");
  if (key === decorKey) {
    el.charmLayer.classList.toggle("hidden", el.charmLayer.childElementCount === 0);
    return;
  }
  decorKey = key;
  el.charmLayer.className = `charmLayer isCute corner-${t.charmCorner}`;
  el.charmLayer.replaceChildren();
  for (const id of [t.charm, t.charm2]) {
    const svg = charmSvg(id);
    if (!svg) continue;
    const span = document.createElement("span");
    span.className = "charm" + (dropIn ? " drop" : "");
    span.dataset.charm = id;
    span.innerHTML = svg;
    span.addEventListener("animationend", () => {
      span.classList.remove("drop", "react", "react-light", "react-medium", "react-heavy");
    });
    el.charmLayer.appendChild(span);
  }
  el.charmLayer.classList.toggle("hidden", el.charmLayer.childElementCount === 0);
}

function pushUndo(entry) {
  undoStack.push(entry);
  if (undoStack.length > UNDO_LIMIT) undoStack.splice(0, undoStack.length - UNDO_LIMIT);
}

function syncReminderPrefs() {
  if (!fb?.uid) return;
  const ref = fb.doc(fb.db, "users", fb.uid);
  fb.setDoc(ref, {
    tz: vault.profile.tz || CONFIG.defaults.tz,
    notifyTime: vault.profile.notifyTime || CONFIG.defaults.notifyTime
  }, { merge: true }).catch(() => {});
}

function renderFlow(current) {
  el.flowRow.innerHTML = "";
  for (const [value, label] of FLOWS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flowBtn" + (current === value ? " on" : "");
    btn.dataset.flow = value;
    btn.textContent = label;
    const { future } = loggingISO();
    btn.disabled = future;
    btn.addEventListener("click", () => logFlow(value));
    el.flowRow.appendChild(btn);
  }
}

function renderChips(day) {
  const selectedSymptoms = day?.symptoms || [];
  const levels = day?.symptomLevel || {};
  const on = new Set(selectedSymptoms || []);
  const counts = {};
  for (const row of Object.values(vault.daily || {})) {
    for (const id of row?.symptoms || []) counts[id] = (counts[id] || 0) + 1;
  }
  const chips = visibleSymptoms(vault).sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  el.symptomChips.replaceChildren();
  for (const chip of chips) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (on.has(chip.id) ? " on" : "");
    btn.textContent = symptomLevelLabel(vault, chip.id, on.has(chip.id) ? levels[chip.id] : "");
    btn.disabled = loggingISO().future;
    btn.addEventListener("click", () => toggleSymptom(chip.id));
    el.symptomChips.appendChild(btn);
  }
}

function fillMore(day) {
  fillingMore = true;
  el.lhInput.value = day.lh || "";
  el.bbtInput.value = typeof day.bbt === "number" ? String(day.bbt) : "";
  el.mucusInput.value = day.mucus || "";
  el.notesInput.value = day.notes || "";
  if (el.pillInput) el.pillInput.checked = !!day.pillTaken;
  const future = loggingISO().future;
  el.lhInput.disabled = future;
  el.bbtInput.disabled = future;
  el.mucusInput.disabled = future;
  el.notesInput.disabled = future;
  fillingMore = false;
}

function renderGates(model) {
  const cards = dataGates(model, !!topSymptom(vault));
  el.gates.innerHTML = "";
  for (const c of cards) {
    const div = document.createElement("div");
    div.className = "skillCard";
    div.innerHTML = `
      <div class="skillTitle">${c.name}</div>
      <div class="skillDesc">${c.desc}</div>
      <div class="skillFooter">
        <div class="pill">${c.active ? "Ready" : "Needs more logs"}</div>
      </div>
    `;
    el.gates.appendChild(div);
  }
}

function maybeShowFallbackBanner(model, today, tz) {
  const relevant = reminderRelevant(model, today, vault.profile.remindWhen || "both");
  const t = vault.profile.notifyTime || CONFIG.defaults.notifyTime;
  if (shouldShowBanner(tz, t, { relevant })) {
    el.bannerText.textContent = model.median === today
      ? "Most likely today."
      : "Most likely tomorrow.";
    el.notifyBanner.classList.remove("hidden");
  } else {
    el.notifyBanner.classList.add("hidden");
  }
}

function commitMeta() {
  const stored = loadMeta();
  meta.profile = { ...(stored.profile || {}), ...(meta.profile || {}) };
  if (stored.lock) meta.lock = stored.lock;
  else delete meta.lock;
  if (stored.fallback) meta.fallback = stored.fallback;
  else delete meta.fallback;
  saveMeta(meta);
}

async function persistVault() {
  commitMeta();

  if (hasPasscode()) {
    if (!sessionPasscode) return;
    const salt = getSalt() || "";
    const enc = await encryptJSON(sessionPasscode, vault, salt);
    saveVaultRaw(JSON.stringify(enc));
    return;
  }

  saveVaultRaw(JSON.stringify(vault));
}

async function waitForUnlock() {
  return new Promise((resolve) => {
    showLockOverlay(true);
    el.lockMsg.textContent = "Enter passcode to unlock your vault.";
    const handler = async () => {
      const code = el.passInput.value.trim();
      if (!code) return;
      el.lockMsg.textContent = "Checking…";
      const res = await unlockVault(code);
      if (!res.ok) {
        el.lockMsg.textContent = "Wrong passcode.";
        return;
      }
      el.unlockBtn.removeEventListener("click", handler);
      sessionPasscode = code;
      el.passInput.value = "";
      showLockOverlay(false);
      el.lockMsg.textContent = "";
      resolve(res.vault || {});
    };
    el.unlockBtn.addEventListener("click", handler);
  });
}

function withTimeout(promise, ms) {
  const pending = Promise.resolve(promise);
  pending.catch(() => {});
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([pending, timeout]).finally(() => clearTimeout(timer));
}

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function ensurePushTokenSoft() {
  if (!fb?.messaging) {
    el.customNote.textContent = "Reminders inside the app are on. Push is not available in this browser.";
    return;
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    el.customNote.textContent = "This browser cannot show push reminders.";
    return;
  }

  if (Notification.permission === "default") {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        el.customNote.textContent = "Permission was not granted. In-app reminders still work.";
        return;
      }
    } catch {
      return;
    }
  } else if (Notification.permission !== "granted") {
    el.customNote.textContent = "Notifications are blocked in the browser.";
    return;
  }

  try {
    const swReg = await withTimeout(navigator.serviceWorker.ready, 5000);
    const token = await fb.getToken(fb.messaging, {
      vapidKey: CONFIG.vapidKey,
      serviceWorkerRegistration: swReg
    });
    if (!token) return;
    const ref = fb.doc(fb.db, "users", fb.uid);
    await fb.setDoc(ref, {
      fcmToken: token,
      forecastPushEnabled: true,
      tz: vault.profile.tz || CONFIG.defaults.tz,
      notifyTime: vault.profile.notifyTime || CONFIG.defaults.notifyTime
    }, { merge: true });
    el.statusPill.textContent = "Push enabled";
    el.customNote.textContent = "Device reminders enabled.";
  } catch (e) {
    console.warn("Push token setup failed:", e);
    el.customNote.textContent = "Could not enable push. In-app reminders still work.";
  }
}
