import { CONFIG, initFirebase, ensureUserDoc } from "./firebase.js";
import { todayISO, addDaysISO } from "./modules/guard.js";
import { loadMeta, saveMeta, loadVaultRaw, saveVaultRaw } from "./modules/storage.js";
import { applyTheme, setInputsFromTheme, themeFromInputs, presetForStyle } from "./modules/theme.js";
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
import { hasPasscode, isLocked, setPasscode, unlock as unlockVault, lockNow, setLocked, getSalt } from "./modules/lock.js";
import { encryptJSON } from "./modules/crypto.js";
import { ensureSexDefaults, seedSexDateInput, setSexEntry, getSexEntry, deleteSexEntry, listSexEntries } from "./modules/sexLog.js";
import { shouldShowBanner, markBannerShown } from "./modules/notifyFallback.js";

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
  accent: document.getElementById("accent"),
  bg: document.getElementById("bg"),
  card: document.getElementById("card"),
  text: document.getElementById("text"),
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
  obSkip: document.getElementById("obSkip")
};

let fb = null;
let meta = loadMeta();
let vault = null;
let panic = false;
let sessionPasscode = "";
let selectedISO = null;
let monthAnchor = null;
let undo = null;
let fillingMore = false;

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
  saveMeta(meta);

  setInputsFromTheme(applied, el);
  el.tz.value = vault.profile.tz || CONFIG.defaults.tz;
  el.notifyTime.value = vault.profile.notifyTime || CONFIG.defaults.notifyTime;
  el.situation.value = vault.profile.situation || "cycling";
  el.goal.value = vault.profile.goal || "bleed";
  el.customNote.textContent = "Appearance applies as you change it. Save to keep it.";

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
  const applyFromInputs = () => {
    const t = themeFromInputs(el);
    applyTheme(t);
    el.customNote.textContent = "Applied. Save appearance to keep it.";
  };

  el.themeStyle.addEventListener("change", () => {
    const p = presetForStyle(el.themeStyle.value);
    el.accent.value = p.accent;
    el.bg.value = p.bg;
    el.card.value = p.card;
    el.text.value = p.text;
    applyFromInputs();
  });

  ["accent", "bg", "card", "text"].forEach((id) => {
    el[id].addEventListener("input", applyFromInputs);
  });

  el.saveThemeBtn.addEventListener("click", async () => {
    const t = themeFromInputs(el);
    vault.profile.theme = t;
    meta.profile = meta.profile || {};
    meta.profile.theme = t;
    saveMeta(meta);
    await persistVault();
    el.customNote.textContent = "Saved.";
    renderAll();
  });

  el.tz.addEventListener("change", async () => {
    vault.profile.tz = el.tz.value;
    await persistVault();
    renderAll();
  });

  el.notifyTime.addEventListener("change", async () => {
    vault.profile.notifyTime = el.notifyTime.value;
    await persistVault();
    renderAll();
  });

  el.situation.addEventListener("change", async () => {
    vault.profile.situation = el.situation.value;
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
    if (!undo) return;
    if (undo.multi) {
      for (const step of undo.multi) restoreDay(vault, step.iso, step.prev);
    } else {
      restoreDay(vault, undo.iso, undo.prev);
    }
    undo = null;
    await persistVault();
    renderAll();
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
    renderAll();
  });
  el.calNext.addEventListener("click", () => {
    const tz = vault.profile.tz || CONFIG.defaults.tz;
    monthAnchor = shiftMonth(monthAnchor || `${todayISO(tz).slice(0, 7)}-01`, 1);
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
    markPeriodRange(vault, a, b, today);
    undo = n ? { multi } : null;
    const stoppedEarly = n === 14 && addDaysISO(a, 13) < b;
    const futureCut = end > today || start > today;
    if (!n) el.rangeNote.textContent = "Nothing to mark. Future days stay blank.";
    else if (stoppedEarly) el.rangeNote.textContent = `Marked ${n} days. Only 14 days can be marked at a time.`;
    else if (futureCut) el.rangeNote.textContent = `Marked ${n} day${n === 1 ? "" : "s"} through today.`;
    else el.rangeNote.textContent = `Marked ${n} day${n === 1 ? "" : "s"}.`;
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
      }
      undo = null;
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
    if (!code || code.length < 4) return;
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
}

function snapshotDay(vaultObj, iso) {
  const row = vaultObj.daily?.[iso];
  if (!row) return null;
  return { ...row, symptoms: Array.isArray(row.symptoms) ? [...row.symptoms] : row.symptoms };
}

function loggingISO() {
  const tz = vault.profile.tz || CONFIG.defaults.tz;
  const today = todayISO(tz);
  const iso = selectedISO || today;
  return { tz, today, iso, future: iso > today };
}

async function saveMore(patch) {
  if (fillingMore || !vault) return;
  if (hasPasscode() && isLocked()) return showLockOverlay(true);
  const { iso, future } = loggingISO();
  if (future) return;
  const prev = updateDay(vault, iso, patch);
  undo = { iso, prev };
  await persistVault();
  renderAll();
}

async function logFlow(flow) {
  if (hasPasscode() && isLocked()) return showLockOverlay(true);
  const { iso, future } = loggingISO();
  if (future) return;
  const prev = updateDay(vault, iso, { flow });
  undo = { iso, prev };
  await persistVault();
  renderAll();
}

async function toggleSymptom(id) {
  if (hasPasscode() && isLocked()) return showLockOverlay(true);
  const { iso, future } = loggingISO();
  if (future) return;
  const cur = new Set(vault.daily?.[iso]?.symptoms || []);
  if (cur.has(id)) cur.delete(id);
  else cur.add(id);
  const prev = updateDay(vault, iso, { symptoms: [...cur] });
  undo = { iso, prev };
  await persistVault();
  renderAll();
}

function setPanic(state) {
  panic = !!state;
  document.body.classList.toggle("panicMode", panic);
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
    pill.textContent = it.protection || "";
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
  const selected = selectedISO || today;
  if (!monthAnchor) monthAnchor = `${today.slice(0, 7)}-01`;

  const showOnboard = !panic && !vault.profile.onboarded && !(hasPasscode() && isLocked());
  el.onboardOverlay.classList.toggle("hidden", !showOnboard);
  syncControls();

  if (panic) {
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
  const day = vault.daily?.[selected] || {};

  const future = selected > today;
  el.logDayLabel.textContent = selected === today
    ? "Today"
    : (future ? `${formatWeekday(selected)} is still a forecast` : `Logging ${formatWeekday(selected)}`);
  el.headline.textContent = headlineFor(model);
  el.daySentence.textContent = daySentence(model);
  el.trackLine.textContent = trackSentence(model.track);
  el.lateNote.textContent = lateSentence(model);
  el.wideNote.textContent = wideSentence(model);
  el.insightLine.textContent = insightSentence(vault);
  el.fertileLine.textContent = fertileSentence(model);

  el.undoBtn.classList.toggle("hidden", !undo);
  el.backTodayBtn.classList.toggle("hidden", selected === today);
  el.sexLogBtn.classList.toggle("hidden", vault.profile.goal !== "fertility");

  renderFlow(day.flow || "");
  renderChips(day.symptoms || []);
  fillMore(day);
  renderTimeline(el.timeline, forecast);
  el.calLabel.textContent = monthLabel(monthAnchor);
  renderCalendar(el.calendar, {
    vault,
    model,
    anchorISO: monthAnchor,
    selectedISO: selected,
    today,
    onSelect: (iso) => {
      selectedISO = iso === today ? null : iso;
      renderAll();
    }
  });

  el.summaryText.textContent = clinicianSummary(vault, model);
  renderGates(model);

  maybeShowFallbackBanner(model, today, tz);
}

function syncControls() {
  const profile = vault?.profile || {};
  setIfIdle(el.situation, profile.situation || "cycling");
  setIfIdle(el.goal, profile.goal || "bleed");
  setIfIdle(el.tz, profile.tz || CONFIG.defaults.tz);
  setIfIdle(el.notifyTime, profile.notifyTime || CONFIG.defaults.notifyTime);
}

function setIfIdle(node, value) {
  if (!node || document.activeElement === node) return;
  if (node.value !== value) node.value = value;
}

function renderFlow(current) {
  el.flowRow.innerHTML = "";
  for (const [value, label] of FLOWS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flowBtn" + (current === value ? " on" : "");
    btn.textContent = label;
    const { future } = loggingISO();
    btn.disabled = future;
    btn.addEventListener("click", () => logFlow(value));
    el.flowRow.appendChild(btn);
  }
}

function renderChips(selectedSymptoms) {
  const on = new Set(selectedSymptoms || []);
  const counts = {};
  for (const row of Object.values(vault.daily || {})) {
    for (const id of row?.symptoms || []) counts[id] = (counts[id] || 0) + 1;
  }
  const chips = [...SYMPTOM_CHIPS].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
  el.symptomChips.innerHTML = "";
  for (const chip of chips) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (on.has(chip.id) ? " on" : "");
    btn.textContent = chip.label;
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
  const tomorrow = addDaysISO(today, 1);
  const soon = model.median === today || model.median === tomorrow;
  const relevant = soon && !model.paused && !model.inBleed;
  const t = vault.profile.notifyTime || CONFIG.defaults.notifyTime;
  if (shouldShowBanner(tz, t, { relevant })) {
    el.bannerText.textContent = model.median === today
      ? "Most likely today."
      : (model.muB >= 4
        ? "Most likely tomorrow. Your heavier days are usually the first two."
        : "Most likely tomorrow.");
    el.notifyBanner.classList.remove("hidden");
  } else {
    el.notifyBanner.classList.add("hidden");
  }
}

async function persistVault() {
  saveMeta(meta);

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
  if (!("Notification" in window)) {
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
    const swReg = await navigator.serviceWorker.ready;
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
