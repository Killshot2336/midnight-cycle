export function renderTimeline(el, forecast) {
  el.innerHTML = "";
  for (const d of forecast) {
    const row = document.createElement("div");
    row.className = "dayRow";

    const left = document.createElement("div");
    left.className = "dayLeft";

    const date = document.createElement("div");
    date.className = "dayDate";
    date.textContent = d.date;

    const meta = document.createElement("div");
    meta.className = "dayMeta";
    meta.textContent = `${d.phase} • Mood ${d.feel.mood} • Energy ${d.feel.energy} • Cramps ${d.feel.cramps}`;

    left.appendChild(date);
    left.appendChild(meta);

    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = `Conf ${Math.round(d.probs.confidence*100)}%`;

    row.appendChild(left);
    row.appendChild(pill);
    el.appendChild(row);
  }
}
