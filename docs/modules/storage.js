export function safeJSONParse(s) { try { return JSON.parse(s); } catch { return null; } }
export function safeJSONStringify(v) { try { return JSON.stringify(v); } catch { return "null"; } }

export function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = safeJSONParse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function lsSet(key, value) {
  try { localStorage.setItem(key, safeJSONStringify(value)); } catch {}
}

export function downloadJSON(filename, obj) {
  const blob = new Blob([safeJSONStringify(obj)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2500);
}