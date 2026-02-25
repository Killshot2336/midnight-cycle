import { CONFIG, initFirebase, ensureUserDoc } from "./firebase.js";
import { todayISO } from "./modules/guard.js";
import { loadMeta, saveMeta, loadVaultRaw, saveVaultRaw } from "./modules/storage.js";
import { applyTheme, setInputsFromTheme, themeFromInputs, presetForStyle } from "./modules/theme.js";
import { downloadJSON } from "./modules/backup.js";
import { ensureVault, addPeriodStart, setDaily } from "./modules/cycleEngine.js";
import { phaseProbabilities } from "./modules/probability.js";
import { buildForecast } from "./modules/forecastEngine.js";
import { renderCalendar } from "./modules/calendar.js";
import { renderTimeline } from "./modules/timeline.js";
import { ensureSkill, awardXP, skillCards, rankFromXP } from "./modules/skilltree.js";
import { hasPasscode, isLocked, setPasscode, unlock as unlockVault, lockNow, setLocked, getSalt } from "./modules/lock.js";
import { encryptJSON } from "./modules/crypto.js";
import { ensureSexDefaults, seedSexDateInput, setSexEntry, getSexEntry, deleteSexEntry, listSexEntries } from "./modules/sexLog.js";
import { shouldShowBanner, markBannerShown } from "./modules/notifyFallback.js";

const el = {
  appTitle: document.getElementById("appTitle"),
  appSub: document.getElementById("appSub"),
  statusPill: document.getElementById("statusPill"),

  todayBadge: document.getElementById("todayBadge"),
  phaseText: document.getElementById("phaseText"),
  confidenceText: document.getElementById("confidenceText"),
  pPeriod: document.getElementById("pPeriod"),
  pPms: document.getElementById("pPms"),
  pOvu: document.getElementById("pOvu"),
  barPeriod: document.getElementById("barPeriod"),
  barPms: document.getElementById("barPms"),
  barOvu: document.getElementById("barOvu"),
  whyBox: document.getElementById("whyBox"),

  timeline: document.getElementById("timeline"),
  calendar: document.getElementById("calendar"),

  themeStyle: document.getElementById("themeStyle"),
  accent: document.getElementById("accent"),
  bg: document.getElementById("bg"),
  card: document.getElementById("card"),
  text: document.getElementById("text"),
  notifyTime: document.getElementById("notifyTime"),
  tz: document.getElementById("tz"),
  saveThemeBtn: document.getElementById("saveThemeBtn"),
  customNote: document.getElementById("customNote"),

  startTodayBtn: document.getElementById("startTodayBtn"),
  logTodayBtn: document.getElementById("logTodayBtn"),
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
  bannerClose: document.getElementById("bannerClose"),

  sexOverlay: document.getElementById("sexOverlay"),
  sexClose: document.getElementById("sexClose"),
  sexDate: document.getElementById("sexDate"),
  sexProtection: document.getElementById("sexProtection"),
  sexNotes: document.getElementById("sexNotes"),
  sexSave: document.getElementById("sexSave"),
  sexDeleteDay: document.getElementById("sexDeleteDay"),
  sexList: document.getElementById("sexList"),

  skillTree: document.getElementById("skillTree"),
  skillRank: document.getElementById("skillRank")
};

let fb = null;
let meta = loadMeta();
let vault = null;
let panic = false;

// IMPORTANT: session-only passcode so encrypted vault can persist changes.
// It is NOT stored anywhere permanent.
let sessionPasscode = "";

main().catch((e) => {
  console.error("Fatal init error:", e);
  if (el.appTitle) el.appTitle.textContent = "Midnight";
  if (el.appSub) el.appSub.textContent = "Recovered from an error. Reload if needed.";
  if (el.statusPill) el.statusPill.textContent = "Recovered";
});

async function main() {
  el.statusPill.textContent = "Initializing…";

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }

  try {
    fb = await initFirebase();
    await ensureUserDoc(fb);
  } catch (e) {
    console.warn("Firebase init failed (local-only continues):", e);
    fb = null;
  }

  vault = await loadVaultWithOptionalUnlock();

  const tz = vault?.profile?.tz || meta?.profile?.tz || CONFIG.defaults.tz;
  vault = ensureVault(vault, tz);
  ensureSkill(vault);
  ensureSexDefaults(vault);

  // Apply theme
  const theme = vault.profile.theme || meta.profile?.theme || null;
  const applied = applyTheme(theme);
  meta.profile = meta.profile || {};
  meta.profile.theme = applied;
  saveMeta(meta);

  setInputsFromTheme(applied, el);
  el.tz.value = vault.profile.tz || CONFIG.defaults.tz;
  el.notifyTime.value = vault.profile.notifyTime || CONFIG.defaults.notifyTime;
  el.customNote.textContent = "Theme applies instantly. Save to persist.";

  wireUI();
  renderAll();
  maybeShowFallbackBanner();

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

  // If passcode enabled, vault is encrypted. We require unlock (sessionPasscode unknown).
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
    el.customNote.textContent = "Applied live. Tap Save to persist.";
  };

  el.themeStyle.addEventListener("change", () => {
    const p = presetForStyle(el.themeStyle.value);
    el.accent.value = p.accent;
    el.bg.value = p.bg;
    el.card.value = p.card;
    el.text.value = p.text;
    applyFromInputs();
  });

  ["accent","bg","card","text"].forEach(id=>{
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
    await ensurePushTokenSoft(); // user gesture path
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

  el.startTodayBtn.addEventListener("click", async () => {
    if (hasPasscode() && isLocked()) return showLockOverlay(true);
    const iso = todayISO(vault.profile.tz);
    addPeriodStart(vault, iso);
    awardXP(vault, 10, "period_start");
    await persistVault();
    await ensurePushTokenSoft(); // user gesture path
    renderAll();
  });

  el.logTodayBtn.addEventListener("click", async () => {
    if (hasPasscode() && isLocked()) return showLockOverlay(true);
    const iso = todayISO(vault.profile.tz);
    setDaily(vault, iso, { checkin:true });
    awardXP(vault, 3, "daily_checkin");
    await persistVault();
    await ensurePushTokenSoft(); // user gesture path
    renderAll();
  });

  el.vaultExportBtn.addEventListener("click", async () => {
    const safeVault = { ...vault, exportedAt: new Date().toISOString() };
    downloadJSON("midnight-vault.json", safeVault);
  });

  el.vaultImportBtn.addEventListener("click", () => el.vaultFile.click());
  el.vaultFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text().catch(()=>null);
    if (!text) return;
    try {
      const obj = JSON.parse(text);
      vault = ensureVault(obj, vault.profile.tz);
      ensureSkill(vault);
      ensureSexDefaults(vault);
      await persistVault();
      renderAll();
    } catch {
      el.customNote.textContent = "Import failed (invalid JSON).";
    } finally {
      el.vaultFile.value = "";
    }
  });

  el.setPasscodeBtn.addEventListener("click", async () => {
    const code = prompt("Set a passcode (4–8 digits). Don’t forget it.");
    if (!code || code.length < 4) return;
    sessionPasscode = code; // session-only
    await setPasscode(code, vault);
    setLocked(false);
    el.customNote.textContent = "Passcode set. Vault is now encrypted.";
    renderAll();
  });

  el.lockBtn.addEventListener("click", async () => {
    if (!hasPasscode()) {
      alert("Set a passcode first (Customization → Set Passcode).");
      return;
    }
    sessionPasscode = ""; // forget it on lock
    await lockNow();
    showLockOverlay(true);
  });

  el.panicBtn.addEventListener("click", () => setPanic(true));
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
    sessionPasscode = code; // session-only
    vault = ensureVault(res.vault || {}, CONFIG.defaults.tz);
    ensureSkill(vault);
    ensureSexDefaults(vault);
    el.passInput.value = "";
    showLockOverlay(false);
    el.lockMsg.textContent = "";
    await persistVault(); // re-save encrypted to guarantee consistency
    renderAll();
  });

  el.bannerClose.addEventListener("click", () => {
    el.notifyBanner.classList.add("hidden");
    markBannerShown(vault.profile.tz);
  });

  el.sexLogBtn.addEventListener("click", () => openSexLog());
  el.sexClose.addEventListener("click", () => closeSexLog());

  // FIX: changing date updates the form
  el.sexDate.addEventListener("change", () => loadSexEntryIntoForm());

  el.sexSave.addEventListener("click", async () => {
    if (hasPasscode() && !sessionPasscode) return showLockOverlay(true);
    const iso = el.sexDate.value;
    if (!iso) return;
    setSexEntry(vault, iso, {
      protection: el.sexProtection.value,
      notes: el.sexNotes.value
    });
    awardXP(vault, 2, "sex_log");
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
}

function setPanic(state) {
  panic = !!state;
  if (panic) {
    document.body.style.filter = "grayscale(1)";
    el.appTitle.textContent = "Calendar";
    el.appSub.textContent = "Schedule overview.";
    closeSexLog();
    showLockOverlay(false);
  } else {
    document.body.style.filter = "";
  }
  renderAll();
}

function showLockOverlay(show) {
  el.lockOverlay.classList.toggle("hidden", !show);
}

function openSexLog() {
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
    div.innerHTML = `
      <div class="listItemTop">
        <div class="listItemTitle">${it.date}</div>
        <div class="pill">${it.protection}</div>
      </div>
      <div class="listItemSub">${escapeHtml(it.notes || "")}</div>
    `;
    div.addEventListener("click", () => {
      el.sexDate.value = it.date;
      loadSexEntryIntoForm();
    });
    el.sexList.appendChild(div);
  }
}

function maybeShowFallbackBanner() {
  const tz = vault.profile.tz || CONFIG.defaults.tz;
  const t = vault.profile.notifyTime || CONFIG.defaults.notifyTime;
  if (shouldShowBanner(tz, t)) el.notifyBanner.classList.remove("hidden");
  else el.notifyBanner.classList.add("hidden");
}

function renderAll() {
  if (!vault) return;

  const tz = vault.profile.tz || CONFIG.defaults.tz;
  const iso = todayISO(tz);

  if (panic) {
    el.todayBadge.textContent = iso;
    el.phaseText.textContent = "—";
    el.confidenceText.textContent = "—";
    el.pPeriod.textContent = "—";
    el.pPms.textContent = "—";
    el.pOvu.textContent = "—";
    el.barPeriod.style.width = "0%";
    el.barPms.style.width = "0%";
    el.barOvu.style.width = "0%";
    el.whyBox.textContent = "Panic mode enabled.";
    el.timeline.innerHTML = "";
    el.calendar.innerHTML = "";
    el.skillTree.innerHTML = "";
    el.skillRank.textContent = "—";
    el.statusPill.textContent = "Panic mode";
    return;
  }

  const probs = phaseProbabilities(vault, iso);
  const phase = pickPhaseLabel(probs);

  el.todayBadge.textContent = iso;
  el.phaseText.textContent = phase;
  el.confidenceText.textContent = `${Math.round(probs.confidence*100)}%`;

  setBar(el.barPeriod, el.pPeriod, probs.period);
  setBar(el.barPms, el.pPms, probs.pms);
  setBar(el.barOvu, el.pOvu, probs.ovu);

  el.whyBox.textContent = (probs.reasons || []).join("\n");

  const forecast = buildForecast(vault, tz, 14, iso);
  renderTimeline(el.timeline, forecast);
  renderCalendar(el.calendar, vault, tz, iso);

  const { label } = rankFromXP(vault.skill.xp);
  el.skillRank.textContent = `${label} • XP ${vault.skill.xp}`;
  renderSkillTree();

  maybeShowFallbackBanner();
}

function renderSkillTree() {
  const cards = skillCards(vault);
  el.skillTree.innerHTML = "";
  for (const c of cards) {
    const div = document.createElement("div");
    div.className = "skillCard";
    div.innerHTML = `
      <div class="skillTitle">${c.name}</div>
      <div class="skillDesc">${c.desc}</div>
      <div class="skillFooter">
        <div class="pill">${c.active ? "Unlocked" : `Req Rank ${c.need}`}</div>
      </div>
    `;
    el.skillTree.appendChild(div);
  }
}

/**
 * FIX: encrypted vault now saves correctly.
 * - If passcode enabled: re-encrypt with sessionPasscode (session only) and save.
 * - If passcode enabled but sessionPasscode missing: do not save; require unlock.
 */
async function persistVault() {
  saveMeta(meta);

  if (hasPasscode()) {
    if (!sessionPasscode) {
      // don’t accidentally downgrade to plaintext
      return;
    }
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
      sessionPasscode = code; // session-only
      el.passInput.value = "";
      showLockOverlay(false);
      el.lockMsg.textContent = "";
      resolve(res.vault || {});
    };
    el.unlockBtn.onclick = handler;
  });
}

function setBar(bar, label, p) {
  const pct = Math.round(p*100);
  bar.style.width = `${pct}%`;
  label.textContent = `${pct}%`;
}

function pickPhaseLabel(p) {
  const arr = [["Period",p.period],["PMS",p.pms],["Ovulation",p.ovu],["Neutral",p.neutral]].sort((a,b)=>b[1]-a[1]);
  return arr[0][0];
}

function escapeHtml(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

/**
 * Client push token wiring (best-effort):
 * - Only runs after a user click (Save/Start/Log)
 * - Requests Notification permission
 * - Gets FCM token and stores to Firestore user doc
 */
async function ensurePushTokenSoft() {
  if (!fb?.messaging) return;
  if (!("Notification" in window)) return;

  // already granted?
  if (Notification.permission === "default") {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
    } catch { return; }
  } else if (Notification.permission !== "granted") {
    return;
  }

  try {
    const token = await fb.getToken(fb.messaging, { vapidKey: CONFIG.vapidKey });
    if (!token) return;

    // save to user doc
    const ref = fb.doc(fb.db, "users", fb.uid);
    await fb.setDoc(ref, {
      fcmToken: token,
      forecastPushEnabled: true,
      tz: vault.profile.tz || CONFIG.defaults.tz,
      notifyTime: vault.profile.notifyTime || CONFIG.defaults.notifyTime
    }, { merge: true });

    el.statusPill.textContent = "Push enabled";
  } catch (e) {
    console.warn("Push token setup failed:", e);
  }
}
