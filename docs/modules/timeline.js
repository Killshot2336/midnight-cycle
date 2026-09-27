import { formatWeekday } from "./cycleModel.js";

export function renderTimeline(el, forecast) {
  el.innerHTML = "";
  const rows = forecast?.days || [];
  if (!rows.length) {
    el.innerHTML = `<div class="tiny muted">Log a period start and the next two weeks will show up here.</div>`;
    return;
  }
  for (const d of rows) {
    const row = document.createElement("div");
    row.className = "dayRow";

    const left = document.createElement("div");
    left.className = "dayLeft";

    const date = document.createElement("div");
    date.className = "dayDate";
    date.textContent = formatWeekday(d.date);

    const meta = document.createElement("div");
    meta.className = "dayMeta";
    meta.textContent = d.note ? `${d.label} · ${d.note}` : d.label;

    left.appendChild(date);
    left.appendChild(meta);

    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = d.label;

    row.appendChild(left);
    row.appendChild(pill);
    el.appendChild(row);
  }
}
