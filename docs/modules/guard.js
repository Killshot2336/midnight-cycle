export function installGlobalCrashGuard() {
  const show = (title, detail) => {
    if (document.getElementById("fatal")) return;
    const wrap = document.createElement("div");
    wrap.id = "fatal";
    wrap.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      display:flex; align-items:center; justify-content:center;
      background: rgba(0,0,0,.72); padding:18px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
      color: rgba(255,255,255,.92);
    `;
    wrap.innerHTML = `
      <div style="max-width:760px;width:100%;
        border:1px solid rgba(255,255,255,.12);
        background: rgba(18,20,28,.92);
        border-radius:20px; padding:16px; box-shadow:0 30px 90px rgba(0,0,0,.7)">
        <div style="font-weight:900;font-size:18px;margin-bottom:6px">${title}</div>
        <div style="opacity:.75;margin-bottom:12px">Recovery mode is active. You can reload without losing local data.</div>
        <pre style="white-space:pre-wrap; word-break:break-word;
          background: rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.10);
          padding:10px;border-radius:14px; font-size:12px; opacity:.92">${detail}</pre>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px">
          <button id="reloadBtn" style="padding:10px 14px;border-radius:14px;font-weight:900;
            border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.08); color:white; cursor:pointer">Reload</button>
          <button id="resetThemeBtn" style="padding:10px 14px;border-radius:14px;font-weight:900;
            border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color:white; cursor:pointer">Reset Theme</button>
          <button id="panicWipeBtn" style="padding:10px 14px;border-radius:14px;font-weight:900;
            border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color:white; cursor:pointer">Panic Wipe Local</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    document.getElementById("reloadBtn").onclick = () => location.reload();
    document.getElementById("resetThemeBtn").onclick = () => {
      try { localStorage.removeItem("midnight_theme_v2"); } catch {}
      location.reload();
    };
    document.getElementById("panicWipeBtn").onclick = () => {
      try {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith("midnight_")) localStorage.removeItem(k);
        }
      } catch {}
      location.reload();
    };
  };

  window.addEventListener("error", (e) => show("Midnight recovered from a crash", String(e?.error?.stack || e?.message || e)));
  window.addEventListener("unhandledrejection", (e) => show("Midnight recovered from a promise crash", String(e?.reason?.stack || e?.reason || e)));
}