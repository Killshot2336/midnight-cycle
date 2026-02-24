import { installGlobalCrashGuard } from "./modules/guard.js";
installGlobalCrashGuard();

import { initFirebase, ensureUserDoc, userRef, CONFIG } from "./firebase.js";
import { todayISO, daysBetween, computeStatsFromStarts, nextStartRange } from "./modules/cycleEngine.js";
import { smoothMean, smoothSD } from "./modules/driftModel.js";
import { forecastForDay } from "./modules/forecastEngine.js";
import { monthGrid, buildCalendarMarkers } from "./modules/calendar.js";
import { lsGet, lsSet, downloadJSON } from "./modules/storage.js";
import { ACCENTS, PRESETS, loadTheme, saveTheme, applyTheme, exportTheme, importThemeFileText, notificationPreview, defaultDashboard } from "./modules/theme.js";
import { isWebPushSupported, requestNotificationPermission, getOrCreateToken, removeToken } from "./notifications.js";
import { hasPin, isLockEnabled, setLockEnabled, setPin, verifyPin, removePin } from "./modules/pin.js";

const $ = (id) => document.getElementById(id);

const el = {
  app: $("app"),
  lock: $("lock"),

  // lock
  lockTitle: $("lockTitle"),
  lockSub: $("lockSub"),
  lockState: $("lockState"),
  pinInput: $("pinInput"),
  unlockBtn: $("unlockBtn"),
  lockHelpBtn: $("lockHelpBtn"),
  pinSetup: $("pinSetup"),
  newPin: $("newPin"),
  confirmPin: $("confirmPin"),
  setPinBtn: $("setPinBtn"),
  skipPinBtn: $("skipPinBtn"),

  // header
  appTitle: $("appTitle"),
  appSub: $("appSub"),
  modePill: $("modePill"),
  quickAccentBtn: $("quickAccentBtn"),
  customizeBtn: $("customizeBtn"),

  // cycle
  cycleStatus: $("cycleStatus"),
  phaseBadge: $("phaseBadge"),
  dayText: $("dayText"),
  nextRange: $("nextRange"),
  cycleMean: $("cycleMean"),
  cycleVar: $("cycleVar"),
  todayISO: $("todayISO"),
  logStartBtn: $("logStartBtn"),
  undoBtn: $("undoBtn"),

  // forecast
  phaseText: $("phaseText"),
  phaseWhy: $("phaseWhy"),
  energyText: $("energyText"),
  energyWhy: $("energyWhy"),
  moodText: $("moodText"),
  moodWhy: $("moodWhy"),
  confidenceBar: $("confidenceBar"),
  confidenceText: $("confidenceText"),

  // checkin
  checkinStatus: $("checkinStatus"),
  moodChips: $("moodChips"),
  energyChips: $("energyChips"),
  painChips: $("painChips"),
  sleepChips: $("sleepChips"),
  stressChips: $("stressChips"),
  saveCheckinBtn: $("saveCheckinBtn"),
  clearCheckinBtn: $("clearCheckinBtn"),
  checkinSaved: $("checkinSaved"),

  // calendar
  prevMonthBtn: $("prevMonthBtn"),
  nextMonthBtn: $("nextMonthBtn"),
  monthLabel: $("monthLabel"),
  calendarGrid: $("calendarGrid"),

  // log
  logSexBtn: $("logSexBtn"),
  sexCount: $("sexCount"),
  sexModeNote: $("sexModeNote"),
  symptomSelect: $("symptomSelect"),
  addSymptomBtn: $("addSymptomBtn"),
  todayLog: $("todayLog"),
  exportBtn: $("exportBtn"),
  importBtn: $("importBtn"),
  importFile: $("importFile"),
  panicWipeBtn: $("panicWipeBtn"),
  backupNote: $("backupNote"),

  // notifications
  pushStatus: $("pushStatus"),
  notifyTimeLabel: $("notifyTimeLabel"),
  notifPreview: $("notifPreview"),
  enablePushBtn: $("enablePushBtn"),
  disablePushBtn: $("disablePushBtn"),

  // modal
  modal: $("modal"),
  modalBackdrop: $("modalBackdrop"),
  closeSettingsBtn: $("closeSettingsBtn"),
  closeSettingsBtn2: $("closeSettingsBtn2"),
  resetAllBtn: $("resetAllBtn"),

  // customize controls
  accentRow: $("accentRow"),
  glowRange: $("glowRange"),
  glowLabel: $("glowLabel"),
  blurRange: $("blurRange"),
  blurLabel: $("blurLabel"),
  grainRange: $("grainRange"),
  grainLabel: $("grainLabel"),
  densityRange: $("densityRange"),
  densityLabel: $("densityLabel"),
  radiusRange: $("radiusRange"),
  radiusLabel: $("radiusLabel"),
  fontRange: $("fontRange"),
  fontLabel: $("fontLabel"),
  stealthToggle: $("stealthToggle"),
  localSensitiveToggle: $("localSensitiveToggle"),
  dashList: $("dashList"),
  savePresetBtn: $("savePresetBtn"),
  exportThemeBtn: $("exportThemeBtn"),
  importThemeBtn: $("importThemeBtn"),
  importThemeFile: $("importThemeFile"),
  themeMsg: $("themeMsg"),

  // lock settings
  lockToggle: $("lockToggle"),
  changePinBtn: $("changePinBtn"),
  removePinBtn: $("removePinBtn")
};

const CHECKIN_KEY = "midnight_checkin_draft_v1";
const LOCAL_SENSITIVE_KEY = "midnight_local_sensitive_v1";

let fb = null;
let user = null;

let viewYear = new Date().getUTCFullYear();
let viewMonth = new Date().getUTCMonth();

main().catch((e) => {
  console.error(e);
  alert("App failed to start. Open DevTools Console for details.");
});

async function main() {
  // Service worker
  try {
    if ("serviceWorker" in navigator) await navigator.serviceWorker.register("./service-worker.js");
  } catch {}

  // Theme init
  const theme = loadTheme();
  applyTheme(theme);

  // Lock boot
  await bootLockUI(theme);

  // Firebase
  fb = await initFirebase();
  user = await ensureUserDoc(fb);

  // Mode label
  el.modePill.textContent = fb.mode === "firebase" ? "SYNC" : "LOCAL";
  el.appSub.textContent = fb.mode === "firebase" ? "Anonymous sync • offline-first" : "Local-only • offline-first";

  // Defaults
  el.notifyTimeLabel.textContent = user.notifyTime || CONFIG.defaults.notifyTime;

  // UI
  bindUI();
  buildThemeUI();
  buildCheckinChips();
  applyDashboardVisibility(theme);

  // First render
  await render();
  setInterval(render, 60_000);
  setInterval(checkCheckinTime, 20_000);
  checkCheckinTime();
}

/* ---------------- LOCK ---------------- */

async function bootLockUI(theme) {
  const lockEnabled = isLockEnabled();
  const pinExists = hasPin();

  // If lock is enabled but no pin exists, force setup
  const mustSetup = lockEnabled && !pinExists;

  const showLock = lockEnabled || mustSetup;

  if (!showLock) {
    el.lock.classList.add("hidden");
    el.lock.setAttribute("aria-hidden", "true");
    el.app.classList.remove("hidden");
    el.app.setAttribute("aria-hidden", "false");
    return;
  }

  el.lock.classList.remove("hidden");
  el.lock.setAttribute("aria-hidden", "false");
  el.app.classList.add("hidden");
  el.app.setAttribute("aria-hidden", "true");

  if (!pinExists) {
    el.lockState.textContent = "Set a PIN to continue";
    el.pinSetup.classList.remove("hidden");
  } else {
    el.lockState.textContent = "Enter PIN";
    el.pinSetup.classList.add("hidden");
  }

  el.unlockBtn.onclick = async () => {
    const pin = el.pinInput.value;
    el.pinInput.value = "";
    const ok = await verifyPin(pin);
    if (!ok) {
      el.lockState.textContent = "Wrong PIN";
      return;
    }
    el.lockState.textContent = "Unlocked";
    el.lock.classList.add("hidden");
    el.lock.setAttribute("aria-hidden", "true");
    el.app.classList.remove("hidden");
    el.app.setAttribute("aria-hidden", "false");
  };

  el.setPinBtn.onclick = async () => {
    const a = el.newPin.value;
    const b = el.confirmPin.value;
    if (!a || a.length < 4) { el.lockState.textContent = "PIN too short"; return; }
    if (a !== b) { el.lockState.textContent = "PINs do not match"; return; }
    await setPin(a);
    setLockEnabled(true);
    el.newPin.value = ""; el.confirmPin.value = "";
    el.pinSetup.classList.add("hidden");
    el.lockState.textContent = "PIN set. Enter it to unlock.";
  };

  el.skipPinBtn.onclick = async () => {
    setLockEnabled(false);
    el.lock.classList.add("hidden");
    el.lock.setAttribute("aria-hidden", "true");
    el.app.classList.remove("hidden");
    el.app.setAttribute("aria-hidden", "false");
  };

  el.lockHelpBtn.onclick = () => {
    alert("PIN is stored only on this device. If you forget it, use Panic Wipe (local) and set a new one.");
  };
}

/* ---------------- UI ---------------- */

function bindUI() {
  el.logStartBtn.onclick = async () => {
    const iso = todayISO();
    await addPeriodStart(iso);
    await render();
  };

  el.undoBtn.onclick = async () => {
    await undoLastStart();
    await render();
  };

  el.logSexBtn.onclick = async () => {
    const iso = todayISO();
    const localSensitive = lsGet(LOCAL_SENSITIVE_KEY, true);
    if (localSensitive) {
      const local = lsGet("midnight_local_sensitive_log_v1", {});
      local[iso] = local[iso] || {};
      local[iso].sex = true;
      lsSet("midnight_local_sensitive_log_v1", local);
    } else {
      await updateDaily(iso, (d) => ({ ...d, sex: true }));
    }
    await render();
  };

  el.addSymptomBtn.onclick = async () => {
    const iso = todayISO();
    const s = el.symptomSelect.value;
    if (!s) return;
    await updateDaily(iso, (d) => {
      const symptoms = Array.isArray(d.symptoms) ? d.symptoms.slice() : [];
      if (!symptoms.includes(s)) symptoms.push(s);
      return { ...d, symptoms };
    });
    el.symptomSelect.value = "";
    await render();
  };

  el.exportBtn.onclick = () => exportBackup();
  el.importBtn.onclick = () => el.importFile.click();
  el.importFile.onchange = async () => {
    const f = el.importFile.files?.[0];
    el.importFile.value = "";
    if (!f) return;
    const text = await f.text();
    try {
      const parsed = JSON.parse(text);
      await importMergeBackup(parsed);
      alert("Import/merge complete.");
      await render();
    } catch (e) {
      alert("Import failed: " + String(e?.message || e));
    }
  };

  el.panicWipeBtn.onclick = async () => {
    const ok = confirm("Panic wipe deletes local Midnight storage on THIS device. Continue?");
    if (!ok) return;
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith("midnight_")) localStorage.removeItem(k);
    } catch {}
    location.reload();
  };

  // Calendar
  el.prevMonthBtn.onclick = async () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    await renderCalendar();
  };
  el.nextMonthBtn.onclick = async () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    await renderCalendar();
  };

  // Push
  el.enablePushBtn.onclick = async () => {
    try {
      el.pushStatus.textContent = "Requesting…";
      const perm = await requestNotificationPermission();
      if (perm !== "granted") { el.pushStatus.textContent = perm === "denied" ? "Blocked" : "Not allowed"; return; }

      if (fb.mode !== "firebase") {
        el.pushStatus.textContent = "Local mode";
        alert("Push requires Firebase sync mode. Add Firebase config in docs/firebase.js.");
        return;
      }

      el.pushStatus.textContent = "Registering…";
      const theme = loadTheme();
      const token = await getOrCreateToken(fb, { vapidKey: CONFIG.vapidKey });

      const ref = userRef(fb.db, fb.uid);
      await fb.updateDoc(ref, {
        fcmToken: token,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || user.tz || CONFIG.defaults.tz,
        notifyTime: user.notifyTime || CONFIG.defaults.notifyTime,
        forecastPushEnabled: true,
        updatedAt: fb.serverTimestamp()
      });

      user.fcmToken = token;
      user.forecastPushEnabled = true;
      el.pushStatus.textContent = "Enabled";
    } catch (e) {
      console.error(e);
      el.pushStatus.textContent = "Failed";
      alert(String(e?.message || e));
    }
  };

  el.disablePushBtn.onclick = async () => {
    try {
      if (fb.mode !== "firebase") { el.pushStatus.textContent = "Local"; return; }
      const ref = userRef(fb.db, fb.uid);
      await fb.updateDoc(ref, { forecastPushEnabled: false, fcmToken: "", updatedAt: fb.serverTimestamp() });
      await removeToken(fb, user?.fcmToken || "");
      user.fcmToken = "";
      user.forecastPushEnabled = false;
      el.pushStatus.textContent = "Disabled";
    } catch {
      el.pushStatus.textContent = "Failed";
    }
  };

  // Quick accent
  el.quickAccentBtn.onclick = () => {
    const t = loadTheme();
    t.accentIndex = (t.accentIndex + 1) % ACCENTS.length;
    saveTheme(t);
    applyTheme(t);
    refreshThemeUI(t);
  };

  // Modal open/close
  el.customizeBtn.onclick = () => openSettings();
  el.modalBackdrop.onclick = () => closeSettings();
  el.closeSettingsBtn.onclick = () => closeSettings();
  el.closeSettingsBtn2.onclick = () => closeSettings();

  el.resetAllBtn.onclick = () => {
    const ok = confirm("Reset all theme + dashboard settings on this device?");
    if (!ok) return;
    lsSet("midnight_theme_v2", null);
    location.reload();
  };
}

/* ---------------- THEME / DASHBOARD ---------------- */

function buildThemeUI() {
  const t = loadTheme();
  refreshThemeUI(t);

  // Presets buttons
  document.querySelectorAll(".presetBtn").forEach((b) => {
    b.onclick = () => {
      const key = b.getAttribute("data-preset");
      const p = PRESETS[key];
      if (!p) return;
      const next = { ...loadTheme(), ...p };
      if (!Array.isArray(next.dashboard)) next.dashboard = defaultDashboard();
      saveTheme(next);
      applyTheme(next);
      refreshThemeUI(next);
      applyDashboardVisibility(next);
      el.themeMsg.textContent = `Preset applied: ${key}`;
    };
  });

  // Sliders
  el.glowRange.oninput = () => themePatch({ glow: Number(el.glowRange.value) });
  el.blurRange.oninput = () => themePatch({ blur: Number(el.blurRange.value) });
  el.grainRange.oninput = () => themePatch({ grain: Number(el.grainRange.value) });
  el.densityRange.oninput = () => themePatch({ density: Number(el.densityRange.value) });
  el.radiusRange.oninput = () => themePatch({ radius: Number(el.radiusRange.value) });
  el.fontRange.oninput = () => themePatch({ font: Number(el.fontRange.value) });

  // Toggles
  el.stealthToggle.onchange = () => themePatch({ stealth: !!el.stealthToggle.checked });
  el.localSensitiveToggle.onchange = () => {
    const v = !!el.localSensitiveToggle.checked;
    lsSet(LOCAL_SENSITIVE_KEY, v);
    themePatch({ localSensitive: v });
  };

  // Theme export/import
  el.exportThemeBtn.onclick = () => {
    const t2 = loadTheme();
    downloadJSON("midnight-theme.json", exportTheme(t2));
    el.themeMsg.textContent = "Theme exported.";
  };
  el.importThemeBtn.onclick = () => el.importThemeFile.click();
  el.importThemeFile.onchange = async () => {
    const f = el.importThemeFile.files?.[0];
    el.importThemeFile.value = "";
    if (!f) return;
    const text = await f.text();
    try {
      const imported = importThemeFileText(text);
      saveTheme(imported);
      applyTheme(imported);
      refreshThemeUI(imported);
      applyDashboardVisibility(imported);
      el.themeMsg.textContent = "Theme imported.";
    } catch (e) {
      el.themeMsg.textContent = "Import failed.";
      alert(String(e?.message || e));
    }
  };

  // Save custom preset
  el.savePresetBtn.onclick = () => {
    const cur = loadTheme();
    const name = prompt("Name this preset (e.g., Emma Dark):");
    if (!name) return;
    cur.customPresets = Array.isArray(cur.customPresets) ? cur.customPresets : [];
    cur.customPresets.push({ name: String(name).slice(0, 30), theme: pickPresetFields(cur) });
    saveTheme(cur);
    el.themeMsg.textContent = "Preset saved (local).";
  };

  // Lock settings
  el.lockToggle.checked = isLockEnabled();
  el.lockToggle.onchange = () => {
    const on = !!el.lockToggle.checked;
    if (on && !hasPin()) {
      alert("No PIN exists yet. Open app, you’ll be prompted to set it.");
      el.lockToggle.checked = false;
      return;
    }
    setLockEnabled(on);
  };

  el.changePinBtn.onclick = async () => {
    const a = prompt("Enter new PIN (4–12 digits):");
    if (!a) return;
    const b = prompt("Confirm new PIN:");
    if (a !== b) { alert("PINs do not match."); return; }
    await setPin(a);
    setLockEnabled(true);
    el.lockToggle.checked = true;
    alert("PIN changed.");
  };

  el.removePinBtn.onclick = () => {
    const ok = confirm("Remove PIN from this device?");
    if (!ok) return;
    removePin();
    el.lockToggle.checked = false;
    alert("PIN removed.");
  };

  buildAccentPicker();
  buildDashEditor();
}

function pickPresetFields(t) {
  return {
    accentIndex: t.accentIndex,
    glow: t.glow,
    blur: t.blur,
    grain: t.grain,
    density: t.density,
    radius: t.radius,
    font: t.font,
    stealth: t.stealth,
    localSensitive: t.localSensitive
  };
}

function themePatch(patch) {
  const t = loadTheme();
  Object.assign(t, patch);
  saveTheme(t);
  applyTheme(t);
  refreshThemeUI(t);
  applyDashboardVisibility(t);
}

function refreshThemeUI(t) {
  el.glowRange.value = String(t.glow);
  el.glowLabel.textContent = String(t.glow);
  el.blurRange.value = String(t.blur);
  el.blurLabel.textContent = String(t.blur);
  el.grainRange.value = String(t.grain);
  el.grainLabel.textContent = String(t.grain);
  el.densityRange.value = String(t.density);
  el.densityLabel.textContent = String(t.density);
  el.radiusRange.value = String(t.radius);
  el.radiusLabel.textContent = String(t.radius);
  el.fontRange.value = String(t.font);
  el.fontLabel.textContent = String(t.font);

  el.stealthToggle.checked = !!t.stealth;

  const localSensitive = lsGet(LOCAL_SENSITIVE_KEY, true);
  el.localSensitiveToggle.checked = localSensitive;
  el.notifPreview.textContent = notificationPreview(!!t.stealth);

  // Update text in log panel
  el.sexModeNote.textContent = localSensitive ? "Stored locally (privacy mode)" : "Sync enabled (stored in cloud)";
}

function buildAccentPicker() {
  const t = loadTheme();
  el.accentRow.innerHTML = "";
  ACCENTS.forEach(([a, b], idx) => {
    const s = document.createElement("button");
    s.className = "swatch" + (idx === t.accentIndex ? " active" : "");
    s.style.background = `linear-gradient(135deg, ${a}, ${b})`;
    s.onclick = () => themePatch({ accentIndex: idx });
    el.accentRow.appendChild(s);
  });
}

function buildDashEditor() {
  const t = loadTheme();
  if (!Array.isArray(t.dashboard)) t.dashboard = defaultDashboard();

  const list = el.dashList;
  list.innerHTML = "";

  const items = t.dashboard.map((w) => {
    const row = document.createElement("div");
    row.className = "dashItem";
    row.draggable = true;
    row.dataset.id = w.id;

    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px">
        <div class="dragHandle" title="Drag">≡</div>
        <div class="name">${escapeHTML(w.name)}</div>
      </div>
      <div class="right">
        <label class="toggle" style="gap:8px">
          <input class="vis" type="checkbox" ${w.visible ? "checked" : ""}/>
          <span class="toggleUI"></span>
        </label>
      </div>
    `;

    row.querySelector(".vis").onchange = (ev) => {
      const on = !!ev.target.checked;
      const t2 = loadTheme();
      const idx = t2.dashboard.findIndex((x) => x.id === w.id);
      if (idx >= 0) t2.dashboard[idx].visible = on;
      saveTheme(t2);
      applyDashboardVisibility(t2);
    };

    addDnDHandlers(row, list);
    list.appendChild(row);
    return row;
  });

  // Persist reorder on drop
  list.addEventListener("midnight:reorder", () => {
    const ids = [...list.querySelectorAll(".dashItem")].map((x) => x.dataset.id);
    const t2 = loadTheme();
    const map = new Map(t2.dashboard.map((x) => [x.id, x]));
    t2.dashboard = ids.map((id) => map.get(id)).filter(Boolean);
    saveTheme(t2);
    applyDashboardVisibility(t2);
  }, { once: true });
}

function addDnDHandlers(row, list) {
  row.addEventListener("dragstart", (e) => {
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", row.dataset.id);
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    const dragging = list.querySelector(".dragging");
    if (!dragging) return;

    const after = getDragAfterElement(list, e.clientY);
    if (after == null) list.appendChild(dragging);
    else list.insertBefore(dragging, after);
  });

  list.addEventListener("drop", (e) => {
    e.preventDefault();
    list.dispatchEvent(new Event("midnight:reorder"));
  });
}

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll(".dashItem:not(.dragging)")];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

function applyDashboardVisibility(theme) {
  const dash = Array.isArray(theme.dashboard) ? theme.dashboard : defaultDashboard();
  const order = dash.map((x) => x.id);
  // reorder widgets in DOM
  reorderWidgets(order);
  // visibility
  for (const w of dash) {
    const node = document.querySelector(`.widget[data-widget="${w.id}"]`);
    if (node) node.style.display = w.visible ? "" : "none";
  }
}

function reorderWidgets(order) {
  const widgets = new Map([...document.querySelectorAll(".widget")].map((n) => [n.dataset.widget, n]));
  // left column target order subset
  const left = $("leftCol");
  const right = $("rightCol");
  if (!left || !right) return;

  const leftIds = ["cycle", "forecast", "checkin"];
  const rightIds = ["calendar", "log", "notify"];

  // reorder within each column based on global order
  const leftOrder = order.filter((id) => leftIds.includes(id));
  const rightOrder = order.filter((id) => rightIds.includes(id));

  leftOrder.forEach((id) => { const n = widgets.get(id); if (n) left.appendChild(n); });
  rightOrder.forEach((id) => { const n = widgets.get(id); if (n) right.appendChild(n); });
}

function openSettings() {
  el.modal.classList.remove("hidden");
  el.modal.setAttribute("aria-hidden", "false");
  // rebuild editor (keeps synced)
  buildDashEditor();
  refreshThemeUI(loadTheme());
}

function closeSettings() {
  el.modal.classList.add("hidden");
  el.modal.setAttribute("aria-hidden", "true");
}

/* ---------------- CHECK-IN ---------------- */

function buildCheckinChips() {
  buildChipGroup(el.moodChips, "mood", ["Bad", "Low", "Okay", "Good", "Great"]);
  buildChipGroup(el.energyChips, "energy", ["Empty", "Low", "Okay", "Good", "Wired"]);
  buildChipGroup(el.painChips, "pain", ["None", "Low", "Med", "High", "Brutal"]);
  buildChipGroup(el.sleepChips, "sleep", ["Terrible", "Bad", "Okay", "Good", "Perfect"]);
  buildChipGroup(el.stressChips, "stress", ["Calm", "Low", "Mid", "High", "Max"]);

  el.clearCheckinBtn.onclick = () => {
    lsSet(CHECKIN_KEY, null);
    buildCheckinChips();
    el.checkinSaved.textContent = "Cleared.";
  };

  el.saveCheckinBtn.onclick = async () => {
    const iso = todayISO();
    const draft = lsGet(CHECKIN_KEY, {});
    await updateDaily(iso, (d) => ({ ...d, checkin: draft, checkinSavedAt: new Date().toISOString() }));
    el.checkinSaved.textContent = `Saved ${new Date().toLocaleTimeString()}`;
    await render();
  };

  // restore draft
  const draft = lsGet(CHECKIN_KEY, {});
  for (const key of ["mood","energy","pain","sleep","stress"]) {
    const v = draft?.[key];
    if (Number.isFinite(v)) activateChipGroup(key, v);
  }
}

function buildChipGroup(container, key, labels) {
  container.innerHTML = "";
  const draft = lsGet(CHECKIN_KEY, {});
  const current = Number.isFinite(draft?.[key]) ? draft[key] : null;

  labels.forEach((label, idx) => {
    const val = idx + 1; // 1..5
    const b = document.createElement("button");
    b.className = "smallChip" + (current === val ? " active" : "");
    b.textContent = label;
    b.onclick = () => {
      const next = lsGet(CHECKIN_KEY, {});
      next[key] = val;
      lsSet(CHECKIN_KEY, next);
      activateChipGroup(key, val);
    };
    container.appendChild(b);
  });
}

function activateChipGroup(key, val) {
  const map = {
    mood: el.moodChips,
    energy: el.energyChips,
    pain: el.painChips,
    sleep: el.sleepChips,
    stress: el.stressChips
  };
  const container = map[key];
  if (!container) return;
  [...container.querySelectorAll(".smallChip")].forEach((b, i) => {
    b.classList.toggle("active", (i + 1) === val);
  });
}

function checkCheckinTime() {
  // In-app reminder: if it's around notifyTime and no check-in today, show status
  const iso = todayISO();
  const t = user?.notifyTime || CONFIG.defaults.notifyTime;
  const [hh, mm] = t.split(":").map((x) => Number(x));
  const now = new Date();
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  const diff = now - target;

  const daily = user?.daily?.[iso] || {};
  const done = !!daily.checkin;

  if (done) {
    el.checkinStatus.textContent = "Saved";
    return;
  }

  // within +/- 30 minutes
  if (diff > -30 * 60000 && diff < 30 * 60000) {
    el.checkinStatus.textContent = "Due now";
  } else if (diff >= 30 * 60000) {
    el.checkinStatus.textContent = "Missed today";
  } else {
    el.checkinStatus.textContent = "Waiting";
  }
}

/* ---------------- RENDER ---------------- */

async function render() {
  // refresh user
  if (fb.mode === "firebase") {
    const ref = userRef(fb.db, fb.uid);
    const snap = await fb.getDoc(ref);
    user = snap.data();
  }

  // title/stealth display
  const theme = loadTheme();
  el.appTitle.textContent = "Midnight";
  el.notifPreview.textContent = notificationPreview(!!theme.stealth);

  el.todayISO.textContent = todayISO();

  // cycle day calc
  const starts = (user.periodStarts || []).slice().sort();
  const lastStart = user.lastPeriodStart || (starts.length ? starts[starts.length - 1] : "");

  let cycleDay = 1;
  if (lastStart) cycleDay = Math.max(1, daysBetween(lastStart, todayISO()) + 1);

  // stats
  const stats = computeStatsFromStarts(starts);
  const mean = user.meanCycleDays || stats.mean;
  const sd = user.sdCycleDays || stats.sd;

  // range
  const range = nextStartRange(lastStart, mean, sd);

  el.cycleStatus.textContent = lastStart ? "Tracking" : "Tap “Log Period Start”";
  el.dayText.textContent = lastStart ? `Day ${cycleDay}` : "—";
  el.cycleMean.textContent = `${round1(mean)} days`;
  el.cycleVar.textContent = `±${round1(sd)}`;
  el.nextRange.textContent = lastStart ? `${range.lo} → ${range.hi}` : "—";

  // forecast
  const daily = (user.daily || {})[todayISO()] || {};
  const fc = forecastForDay(cycleDay, daily);

  el.phaseBadge.textContent = fc.badge;
  el.phaseText.textContent = fc.phase;
  el.phaseWhy.textContent = fc.why.phase;
  el.energyText.textContent = fc.energy;
  el.energyWhy.textContent = fc.why.energy;
  el.moodText.textContent = fc.mood;
  el.moodWhy.textContent = fc.why.mood;

  // confidence
  const conf = calcConfidence(stats.intervals.length, sd);
  el.confidenceBar.style.width = `${Math.round(conf * 100)}%`;
  el.confidenceText.textContent = confidenceLabel(conf, stats.intervals.length);

  // push status
  if (!isWebPushSupported()) el.pushStatus.textContent = "Unsupported";
  else if (fb.mode !== "firebase") el.pushStatus.textContent = "Local mode";
  else if (!user.forecastPushEnabled) el.pushStatus.textContent = "Disabled";
  else if (Notification.permission !== "granted") el.pushStatus.textContent = Notification.permission === "denied" ? "Blocked" : "Not allowed";
  else el.pushStatus.textContent = user.fcmToken ? "Enabled" : "Ready";

  // today log summary
  const symptoms = daily.symptoms || [];
  const localSensitive = lsGet(LOCAL_SENSITIVE_KEY, true);
  const localSens = lsGet("midnight_local_sensitive_log_v1", {});
  const sex = localSensitive ? (localSens?.[todayISO()]?.sex ? "sex logged" : "—") : (daily.sex ? "sex logged" : "—");
  el.todayLog.textContent = `${sex}${symptoms.length ? ` • symptoms: ${symptoms.join(", ")}` : ""}`;

  // sex count last 30d
  const dailyAll = user.daily || {};
  const sexCountCloud = countSexLastNDays(dailyAll, 30);
  const sexCountLocal = countSexLastNDays(localSens, 30);
  el.sexCount.textContent = `${localSensitive ? sexCountLocal : sexCountCloud} in last 30d`;

  // calendar
  await renderCalendar();
}

async function renderCalendar() {
  const grid = monthGrid(viewYear, viewMonth);
  const markers = buildCalendarMarkers(user);
  const today = todayISO();

  const label = new Date(Date.UTC(viewYear, viewMonth, 1)).toLocaleString(undefined, { month: "long", year: "numeric" });
  el.monthLabel.textContent = label;

  el.calendarGrid.innerHTML = "";
  const curMonth = String(viewMonth + 1).padStart(2, "0");
  const curYear = String(viewYear);

  for (const iso of grid) {
    const [y, m] = iso.split("-");
    const inMonth = (y === curYear && m === curMonth);

    const cell = document.createElement("div");
    cell.className = "calCell" + (inMonth ? "" : " mutedCell") + (iso === today ? " today" : "");
    cell.innerHTML = `<div class="d">${Number(iso.slice(8,10))}</div><div class="dots"></div>`;

    const dots = cell.querySelector(".dots");
    if (markers.possible.has(iso)) dots.appendChild(dotEl("possible"));
    if (markers.likely.has(iso)) dots.appendChild(dotEl("likely"));
    if (markers.starts.has(iso)) dots.appendChild(dotEl("start"));

    el.calendarGrid.appendChild(cell);
  }
}

function dotEl(kind) {
  const d = document.createElement("span");
  d.className = `dot ${kind}`;
  return d;
}

/* ---------------- DATA MUTATIONS ---------------- */

async function updateDaily(iso, fn) {
  const ref = fb.mode === "firebase" ? userRef(fb.db, fb.uid) : null;
  const daily = structuredClone(user.daily || {});
  const cur = daily[iso] || {};
  daily[iso] = fn(cur);

  if (fb.mode === "firebase") {
    await fb.updateDoc(ref, { daily, updatedAt: fb.serverTimestamp() });
  } else {
    await fb.updateDoc(null, { daily });
  }
  user.daily = daily;
}

async function addPeriodStart(iso) {
  const ref = fb.mode === "firebase" ? userRef(fb.db, fb.uid) : null;
  const starts = (user.periodStarts || []).slice();
  if (!starts.includes(iso)) starts.push(iso);
  starts.sort();

  const stats = computeStatsFromStarts(starts);
  let mean = user.meanCycleDays || stats.mean;
  let sd = user.sdCycleDays || stats.sd;

  if (starts.length >= 2) {
    const last = starts[starts.length - 1];
    const prev = starts[starts.length - 2];
    const interval = daysBetween(prev, last);
    if (interval >= 15 && interval <= 60) {
      mean = smoothMean(mean, interval);
      sd = smoothSD(sd, stats.intervals, mean);
    }
  }

  const patch = {
    periodStarts: starts,
    lastPeriodStart: starts[starts.length - 1],
    meanCycleDays: mean,
    sdCycleDays: sd,
    updatedAt: fb.serverTimestamp()
  };

  if (fb.mode === "firebase") await fb.updateDoc(ref, patch);
  else await fb.updateDoc(null, patch);

  user.periodStarts = starts;
  user.lastPeriodStart = patch.lastPeriodStart;
  user.meanCycleDays = mean;
  user.sdCycleDays = sd;
}

async function undoLastStart() {
  const ref = fb.mode === "firebase" ? userRef(fb.db, fb.uid) : null;
  const starts = (user.periodStarts || []).slice().sort();
  if (!starts.length) return;

  starts.pop();
  const last = starts.length ? starts[starts.length - 1] : "";
  const stats = computeStatsFromStarts(starts);

  const patch = {
    periodStarts: starts,
    lastPeriodStart: last,
    meanCycleDays: stats.mean,
    sdCycleDays: stats.sd,
    updatedAt: fb.serverTimestamp()
  };

  if (fb.mode === "firebase") await fb.updateDoc(ref, patch);
  else await fb.updateDoc(null, patch);

  user.periodStarts = starts;
  user.lastPeriodStart = last;
  user.meanCycleDays = stats.mean;
  user.sdCycleDays = stats.sd;
}

/* ---------------- BACKUP ---------------- */

function exportBackup() {
  const theme = loadTheme();
  const localSensitive = lsGet(LOCAL_SENSITIVE_KEY, true);
  const localSens = lsGet("midnight_local_sensitive_log_v1", {});
  const payload = {
    exportedAt: new Date().toISOString(),
    schema: 1,
    mode: fb.mode,
    user: {
      periodStarts: user.periodStarts || [],
      lastPeriodStart: user.lastPeriodStart || "",
      meanCycleDays: user.meanCycleDays || 28,
      sdCycleDays: user.sdCycleDays || 4.5,
      tz: user.tz || CONFIG.defaults.tz,
      notifyTime: user.notifyTime || CONFIG.defaults.notifyTime,
      daily: user.daily || {}
    },
    localSensitive: localSensitive ? localSens : {},
    theme: exportTheme(theme)
  };
  downloadJSON("midnight-backup.json", payload);
}

async function importMergeBackup(b) {
  if (!b || typeof b !== "object") throw new Error("Invalid backup");
  const u = b.user || {};
  const mergedStarts = uniqueSorted([...(user.periodStarts || []), ...(u.periodStarts || [])]);
  const mergedDaily = mergeDaily(user.daily || {}, u.daily || {});

  // If localSensitive backup exists, merge into local store too
  if (b.localSensitive && typeof b.localSensitive === "object") {
    const cur = lsGet("midnight_local_sensitive_log_v1", {});
    const merged = mergeDaily(cur, b.localSensitive);
    lsSet("midnight_local_sensitive_log_v1", merged);
  }

  // Theme merge
  if (b.theme) {
    saveTheme({ ...loadTheme(), ...b.theme });
    applyTheme(loadTheme());
    refreshThemeUI(loadTheme());
    applyDashboardVisibility(loadTheme());
  }

  const ref = fb.mode === "firebase" ? userRef(fb.db, fb.uid) : null;
  const patch = {
    periodStarts: mergedStarts,
    lastPeriodStart: mergedStarts.length ? mergedStarts[mergedStarts.length - 1] : "",
    meanCycleDays: Number.isFinite(u.meanCycleDays) ? u.meanCycleDays : user.meanCycleDays,
    sdCycleDays: Number.isFinite(u.sdCycleDays) ? u.sdCycleDays : user.sdCycleDays,
    daily: mergedDaily,
    updatedAt: fb.serverTimestamp()
  };

  if (fb.mode === "firebase") await fb.updateDoc(ref, patch);
  else await fb.updateDoc(null, patch);

  user = { ...user, ...patch };
}

function mergeDaily(a, b) {
  const out = structuredClone(a);
  for (const [day, val] of Object.entries(b)) {
    if (!out[day]) out[day] = val;
    else out[day] = { ...out[day], ...val };
  }
  return out;
}
function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter((x) => typeof x === "string"))).sort();
}

/* ---------------- HELPERS ---------------- */

function round1(n){ return Math.round(n * 10) / 10; }

function countSexLastNDays(daily, n) {
  const now = new Date();
  let c = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (daily?.[iso]?.sex) c++;
  }
  return c;
}

function calcConfidence(intervalCount, sd) {
  const dataScore = Math.min(1, intervalCount / 6);
  const sdScore = 1 - Math.min(1, (sd || 6) / 10);
  return Math.max(0.10, Math.min(0.98, (dataScore * 0.62) + (sdScore * 0.38)));
}
function confidenceLabel(c, intervalCount) {
  if (intervalCount < 2) return "Learning mode (log a few cycles)";
  if (c < 0.35) return "Low confidence (needs more data)";
  if (c < 0.65) return "Medium confidence";
  if (c < 0.85) return "High confidence";
  return "Very high confidence";
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}