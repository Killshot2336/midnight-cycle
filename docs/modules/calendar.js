import { clamp } from "./guard.js";
import { currentCycle } from "./cycleEngine.js";
import { forecast } from "./forecastEngine.js";

function daysInMonth(y, m0){ return new Date(y, m0+1, 0).getDate(); }
function dowOf(y,m0,d){ return new Date(y,m0,d).getDay(); }

export function calendarModel(state, y, m0){
  const firstDow = dowOf(y,m0,1);
  const dim = daysInMonth(y,m0);

  const cells = [];
  for (let i=0;i<firstDow;i++) cells.push({ kind:"blank" });

  for (let d=1; d<=dim; d++){
    const iso = new Date(y,m0,d).toISOString().slice(0,10);
    const log = state.history?.days?.[iso] || null;

    const cycle = currentCycle(state, iso);
    let heat = 0;
    let label = "";
    if (cycle.known) {
      const f = forecast(state, cycle, iso);
      heat = clamp(f.heat, 0, 1);
      label = `D${cycle.dayIndex}`;
    }

    const isStart = (state.history?.events || []).some(e => e.kind==="period_start" && e.dateISO===iso);

    cells.push({
      kind:"day",
      day: d,
      iso,
      heat,
      label,
      isStart,
      hasLog: !!log,
      flow: log ? Number(log.flow||0) : 0
    });
  }

  return { y, m0, cells };
}

export function renderCalendar(mountEl, model, onDay){
  mountEl.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "repeat(7, 1fr)";
  wrap.style.gap = "8px";

  const names = ["S","M","T","W","T","F","S"];
  for (const n of names){
    const h = document.createElement("div");
    h.textContent = n;
    h.style.fontFamily = "var(--mono)";
    h.style.color = "rgba(233,233,255,.65)";
    h.style.fontSize = "12px";
    h.style.textAlign = "center";
    wrap.appendChild(h);
  }

  for (const c of model.cells){
    const cell = document.createElement("button");
    cell.type = "button";
    cell.style.borderRadius = "14px";
    cell.style.border = "1px solid rgba(255,255,255,.12)";
    cell.style.background = "rgba(0,0,0,.18)";
    cell.style.color = "var(--text)";
    cell.style.padding = "10px 8px";
    cell.style.textAlign = "left";
    cell.style.cursor = "pointer";
    cell.style.minHeight = "54px";

    if (c.kind === "blank"){
      cell.disabled = true;
      cell.style.opacity = "0";
      wrap.appendChild(cell);
      continue;
    }

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.justifyContent = "space-between";
    top.style.alignItems = "center";

    const day = document.createElement("div");
    day.textContent = String(c.day);
    day.style.fontWeight = "900";

    const tag = document.createElement("div");
    tag.textContent = c.isStart ? "START" : (c.flow >= 2 ? "FLOW" : (c.hasLog ? "LOG" : ""));
    tag.style.fontFamily = "var(--mono)";
    tag.style.fontSize = "10px";
    tag.style.opacity = "0.8";

    top.appendChild(day);
    top.appendChild(tag);

    const sub = document.createElement("div");
    sub.textContent = c.label || "";
    sub.style.fontFamily = "var(--mono)";
    sub.style.fontSize = "11px";
    sub.style.opacity = "0.75";
    sub.style.marginTop = "4px";

    const glow = Math.round(10 + c.heat * 24);
    cell.style.boxShadow = `0 0 ${glow}px color-mix(in srgb, var(--accent) ${Math.round(c.heat*28)}%, transparent)`;

    cell.addEventListener("click", () => onDay(c.iso));

    cell.appendChild(top);
    cell.appendChild(sub);
    wrap.appendChild(cell);
  }

  mountEl.appendChild(wrap);
}
