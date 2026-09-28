import { dayOutlook, ANY_FLOW } from "./cycleModel.js";
import { charmSvg } from "./theme.js";

export function renderCalendar(el, opts) {
  const { vault, model, anchorISO, selectedISO, today, onSelect, plain, calCharm, charm } = opts;
  el.innerHTML = "";

  const [year, monthNum] = anchorISO.split("-").map(Number);
  const month = monthNum - 1;
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDow = (first.getUTCDay() + 6) % 7;

  for (const h of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    const head = document.createElement("div");
    head.className = "calHead";
    head.textContent = h;
    el.appendChild(head);
  }

  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement("div");
    blank.className = "calCell dim";
    el.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoOf(year, month, d);
    const flow = plain ? null : vault.daily?.[iso]?.flow;
    const outlook = plain ? { bleed: 0, fertile: 0 } : dayOutlook(model, iso, 0);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calCell";
    cell.dataset.iso = iso;
    if (iso === selectedISO) cell.classList.add("calSelected");
    if (iso === today) cell.classList.add("calToday");

    const tag = document.createElement("span");
    tag.className = "calTag";
    let logged = false;
    let name = "";
    if (flow === "light" || flow === "medium" || flow === "heavy") {
      name = "Logged";
      tag.classList.add("tagLogged");
      cell.classList.add("calLogged");
      logged = true;
    } else if (flow === "spotting") {
      name = "Spotting";
      tag.classList.add("tagSpot");
      cell.classList.add("calSpot");
      logged = true;
    } else if (ANY_FLOW.has(flow)) {
      name = "Logged";
      tag.classList.add("tagLogged");
      cell.classList.add("calLogged");
      logged = true;
    } else if (outlook.bleed >= 0.34) {
      name = "Expected";
      tag.classList.add("tagExpected");
      cell.classList.add("calExpected");
    } else if (outlook.fertile >= 0.34) {
      name = "Fertile";
      tag.classList.add("tagFertile");
      cell.classList.add("calFertile");
    }
    if (name) cell.setAttribute("aria-label", `${d}, ${name}`);

    const day = document.createElement("div");
    day.className = "calDay";
    day.textContent = String(d);
    cell.appendChild(day);
    if (name) cell.appendChild(tag);
    if (!plain && calCharm && logged) {
      const gem = document.createElement("span");
      gem.className = "calGem";
      gem.innerHTML = charmSvg(charm && charm !== "none" ? charm : "star");
      cell.appendChild(gem);
    }
    cell.addEventListener("click", () => onSelect(iso));
    el.appendChild(cell);
  }
}

function isoOf(y, m0, d) {
  const m = String(m0 + 1).padStart(2, "0");
  const day = String(d).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthLabel(anchorISO) {
  const [y, m] = anchorISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(dt);
}

export function shiftMonth(anchorISO, delta) {
  const [y, m] = anchorISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-01`;
}
