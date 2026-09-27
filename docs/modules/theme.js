const FLOW = {
  velvet: { none: "#6e6470", spotting: "#e4c58a", light: "#f0c2cf", medium: "#d46a8a", heavy: "#8e2f45" },
  midnight: { none: "#5c6478", spotting: "#d7c4a3", light: "#d7b4e8", medium: "#8b6cff", heavy: "#5b3fd6" },
  noir: { none: "#6a656c", spotting: "#e8d7c3", light: "#e7a0ad", medium: "#c73e5a", heavy: "#6e2436" },
  gold: { none: "#7a6d5e", spotting: "#f0e0c0", light: "#e7c9a4", medium: "#d4a054", heavy: "#8a5a2b" },
  sea: { none: "#5d6e70", spotting: "#e7b3c5", light: "#b7e0dc", medium: "#5eaea8", heavy: "#2f6f6c" },
  blush: { none: "#b7a3ab", spotting: "#e4c58a", light: "#f3c3d0", medium: "#d46a8a", heavy: "#9a3d56" },
  paper: { none: "#b3a89c", spotting: "#d4b483", light: "#e7c1c1", medium: "#b85c6e", heavy: "#7a3a48" }
};

const PRESETS = {
  velvet: pack("velvet", "#e7a0b6", "#140c14", "#24141f", "#f6e9ef", "#cbb4c0", "#e4c58a", "#e4c58a", "glow", "stars", "serif", true),
  midnight: pack("midnight", "#7c4dff", "#0b0f1a", "#121a2c", "#e9ecff", "#a7b0d6", "#9aa7ff", "#c9b7ff", "glow", "none", "sharp", false),
  noir: pack("noir", "#c73e5a", "#07060a", "#141218", "#f4efe9", "#c4b8b2", "#e8d7c3", "#e8d7c3", "plain", "none", "display", false),
  gold: pack("gold", "#e4c58a", "#16110c", "#2a2118", "#f8f1e4", "#d9cbb8", "#d98b7a", "#e4c58a", "silk", "silk", "serif", true),
  sea: pack("sea", "#7ec8c3", "#0c1416", "#142226", "#e7f4f2", "#b7ccc9", "#e7b3c5", "#d7efe8", "glow", "none", "sharp", false),
  blush: pack("blush", "#c45b78", "#f7efe9", "#fff8f4", "#3a2430", "#8a6674", "#c4a574", "#c45b78", "plain", "lace", "serif", true),
  paper: pack("paper", "#9a4d63", "#f4efe6", "#fffdf8", "#2c261f", "#7a6e62", "#6e8b74", "#c4a574", "plain", "none", "serif", false)
};

function pack(name, accent, bg, card, text, muted, mark, gold, mood, pattern, type, cute) {
  const light = name === "blush" || name === "paper";
  return {
    style: name,
    base: name,
    accent, bg, card, text, muted, mark, gold,
    line: light ? "rgba(40,20,30,.12)" : "rgba(255,255,255,.10)",
    shadow: light ? "0 16px 40px rgba(40,20,30,.08)" : "0 18px 45px rgba(0,0,0,.45)",
    flow: { ...FLOW[name] },
    mood,
    pattern,
    type,
    shape: "soft",
    room: "airy",
    marks: "wash",
    chips: "pills",
    charm: cute ? (name === "blush" ? "bow" : name === "gold" ? "ring" : name === "noir" ? "dagger" : "moon") : "none",
    charm2: name === "velvet" ? "star" : name === "blush" ? "heart" : "none",
    charmCorner: "tr",
    phrase: "",
    shimmer: cute,
    calCharm: cute
  };
}

PRESETS.noir.charm = "dagger";
PRESETS.noir.charm2 = "none";
PRESETS.paper.charm = "flower";
PRESETS.paper.charm2 = "none";
PRESETS.paper.shimmer = false;
PRESETS.paper.calCharm = true;

const DEFAULT_THEME = { ...PRESETS.velvet, flow: { ...PRESETS.velvet.flow } };

const MOODS = new Set(["plain", "glow", "silk"]);
const PATTERNS = new Set(["none", "stars", "lace", "silk"]);
const TYPES = new Set(["sharp", "serif", "display"]);
const SHAPES = new Set(["soft", "quiet"]);
const ROOMS = new Set(["airy", "compact"]);
const MARKS = new Set(["wash", "dot", "ring"]);
const CHIPS = new Set(["pills", "squares", "stamps"]);
const CORNERS = new Set(["tl", "tr", "bl", "br"]);
export const CHARMS = ["none", "moon", "star", "bow", "heart", "flower", "cat", "dagger", "ring"];
const CHARM_SET = new Set(CHARMS);
const BODY_CLASSES = [
  "mood-plain", "mood-glow", "mood-silk",
  "pattern-none", "pattern-stars", "pattern-lace", "pattern-silk",
  "type-sharp", "type-serif", "type-display",
  "shape-soft", "shape-quiet",
  "room-airy", "room-compact",
  "chips-pills", "chips-squares", "chips-stamps",
  "marks-wash", "marks-dot", "marks-ring",
  "calcharm-on", "calcharm-off"
];

let current = null;

export function currentTheme() {
  return current || normalizeTheme(null);
}

function pick(set, value, fallback) {
  return set.has(value) ? value : fallback;
}

export function normalizeTheme(t) {
  const src = t || {};
  const known = PRESETS[src.style] ? src.style : null;
  const fresh = !src.style && !src.accent;
  const style = fresh ? "velvet" : (src.style === "custom" || known ? (known || "custom") : "custom");
  const baseName = PRESETS[src.base] ? src.base : (known || "velvet");
  const preset = PRESETS[baseName];
  const legacy = !fresh && style === "custom" && !known;
  const flow = src.flow || {};
  return {
    style,
    base: baseName,
    accent: src.accent || preset.accent,
    bg: src.bg || preset.bg,
    card: src.card || preset.card,
    text: src.text || preset.text,
    muted: src.muted || preset.muted,
    mark: src.mark || preset.mark,
    gold: src.gold || preset.gold,
    line: src.line || (preset.line),
    shadow: src.shadow || preset.shadow,
    flow: {
      none: flow.none || preset.flow.none,
      spotting: flow.spotting || preset.flow.spotting,
      light: flow.light || preset.flow.light,
      medium: flow.medium || preset.flow.medium,
      heavy: flow.heavy || preset.flow.heavy
    },
    mood: pick(MOODS, src.mood, legacy ? "plain" : preset.mood),
    pattern: pick(PATTERNS, src.pattern, legacy ? "none" : preset.pattern),
    type: pick(TYPES, src.type, legacy ? "sharp" : preset.type),
    shape: pick(SHAPES, src.shape, preset.shape),
    room: pick(ROOMS, src.room, preset.room),
    marks: pick(MARKS, src.marks, preset.marks),
    chips: pick(CHIPS, src.chips, preset.chips),
    charm: CHARM_SET.has(src.charm) ? src.charm : (legacy ? "none" : preset.charm),
    charm2: CHARM_SET.has(src.charm2) ? src.charm2 : (legacy ? "none" : preset.charm2),
    charmCorner: pick(CORNERS, src.charmCorner, preset.charmCorner),
    phrase: String(src.phrase || "").slice(0, 42),
    shimmer: typeof src.shimmer === "boolean" ? src.shimmer : (legacy ? false : preset.shimmer),
    calCharm: typeof src.calCharm === "boolean" ? src.calCharm : (legacy ? false : preset.calCharm)
  };
}

export function applyTheme(theme) {
  const t = normalizeTheme(theme);
  current = t;
  const root = document.documentElement;
  root.style.setProperty("--accent", t.accent);
  root.style.setProperty("--bg", t.bg);
  root.style.setProperty("--card", t.card);
  root.style.setProperty("--text", t.text);
  root.style.setProperty("--muted", t.muted);
  root.style.setProperty("--mark", t.mark);
  root.style.setProperty("--gold", t.gold);
  root.style.setProperty("--line", t.line);
  root.style.setProperty("--shadow", t.shadow);
  root.style.setProperty("--flow-none", t.flow.none);
  root.style.setProperty("--flow-spot", t.flow.spotting);
  root.style.setProperty("--flow-light", t.flow.light);
  root.style.setProperty("--flow-medium", t.flow.medium);
  root.style.setProperty("--flow-heavy", t.flow.heavy);
  root.style.setProperty("--radius", t.shape === "quiet" ? "10px" : "22px");
  root.style.setProperty("--radius-sm", t.shape === "quiet" ? "8px" : "999px");

  document.body.classList.remove(...BODY_CLASSES);
  document.body.classList.add(
    `mood-${t.mood}`,
    `pattern-${t.pattern}`,
    `type-${t.type}`,
    `shape-${t.shape}`,
    `room-${t.room}`,
    `chips-${t.chips}`,
    `marks-${t.marks}`,
    t.calCharm ? "calcharm-on" : "calcharm-off"
  );

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.bg);
  return t;
}

export function setInputsFromTheme(theme, el) {
  const t = normalizeTheme(theme);
  el.themeStyle.value = t.style;
  el.themeBase.value = t.base;
  el.accent.value = t.accent;
  el.bg.value = t.bg;
  el.card.value = t.card;
  el.text.value = t.text;
  el.mark.value = t.mark;
  el.flowNone.value = t.flow.none;
  el.flowSpot.value = t.flow.spotting;
  el.flowLight.value = t.flow.light;
  el.flowMedium.value = t.flow.medium;
  el.flowHeavy.value = t.flow.heavy;
  el.mood.value = t.mood;
  el.pattern.value = t.pattern;
  el.typeface.value = t.type;
  el.shape.value = t.shape;
  el.room.value = t.room;
  el.marks.value = t.marks;
  el.chips.value = t.chips;
  el.charm.value = t.charm;
  el.charm2.value = t.charm2;
  el.charmCorner.value = t.charmCorner;
  el.phrase.value = t.phrase;
  el.shimmer.checked = t.shimmer;
  el.calCharm.checked = t.calCharm;
}

export function themeFromInputs(el) {
  return normalizeTheme({
    style: el.themeStyle.value,
    base: el.themeBase.value,
    accent: el.accent.value,
    bg: el.bg.value,
    card: el.card.value,
    text: el.text.value,
    mark: el.mark.value,
    flow: {
      none: el.flowNone.value,
      spotting: el.flowSpot.value,
      light: el.flowLight.value,
      medium: el.flowMedium.value,
      heavy: el.flowHeavy.value
    },
    mood: el.mood.value,
    pattern: el.pattern.value,
    type: el.typeface.value,
    shape: el.shape.value,
    room: el.room.value,
    marks: el.marks.value,
    chips: el.chips.value,
    charm: el.charm.value,
    charm2: el.charm2.value,
    charmCorner: el.charmCorner.value,
    phrase: el.phrase.value,
    shimmer: el.shimmer.checked,
    calCharm: el.calCharm.checked
  });
}

export function presetForStyle(style) {
  const preset = PRESETS[style] || DEFAULT_THEME;
  return { ...preset, flow: { ...preset.flow } };
}

export function charmSvg(id) {
  const paths = {
    moon: "M20 4a12 12 0 1 0 8 20A10 10 0 1 1 20 4z",
    star: "M16 3.2 19.4 11l8.1 1-6 5.4 1.6 8.1L16 21.4 8.9 25.5 10.5 17.4 4.5 12l8.1-1z",
    bow: "M8 12c4 0 6 4 8 4s4-4 8-4c0 6-4 8-8 10-4-2-8-4-8-10zm8 4v10M10 16l-4 3M22 16l4 3",
    heart: "M16 26s-9-6.2-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.8-9 12-9 12z",
    flower: "M16 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0 0a4 4 0 1 1 8 0 4 4 0 0 1-8 0zm0 0a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 16v8",
    cat: "M8 14 6 6l6 5h8l6-5-2 8a8 8 0 0 1-16 0zm5 2h.5M18.5 16H19M13 20c1 .8 5 .8 6 0",
    dagger: "M16 3v16M12 21h8l-4 7zM11 15h10",
    ring: "M16 20a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm0-14 1.2-3h-2.4z"
  };
  const d = paths[id];
  if (!d) return "";
  const fill = id === "bow" || id === "cat" || id === "dagger" || id === "flower" ? "none" : "currentColor";
  const stroke = fill === "none" ? "currentColor" : "none";
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
