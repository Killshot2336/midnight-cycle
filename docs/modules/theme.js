export function applyThemeVars(theme) {
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--card", theme.card);
  root.style.setProperty("--text", theme.text);
  root.style.setProperty("--glow", String(theme.glow ?? 70));
  root.style.setProperty("--muted", "rgba(233,233,255,.68)");
}
