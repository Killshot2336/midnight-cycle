import { phaseProbabilities } from "./probability.js";

export function renderCalendar(el, vault, tz, anchorISO) {
  el.innerHTML = "";

  const anchor = new Date(anchorISO + "T00:00:00");
  const year = anchor.getFullYear();
  const month = anchor.getMonth(); // 0-11

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();

  // Monday-first headers
  const headers = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  for (const h of headers) {
    const head = document.createElement("div");
    head.className = "calHead";
    head.textContent = h;
    el.appendChild(head);
  }

  // JS: Sunday=0..Saturday=6 → convert to Monday-first index
  const firstDow = (first.getDay() + 6) % 7; // Mon=0..Sun=6

  // leading blanks
  for (let i=0;i<firstDow;i++){
    const blank = document.createElement("div");
    blank.className = "calCell dim";
    blank.innerHTML = `<div class="calTop"><div class="calDay"> </div><div class="calTag"></div></div>`;
    el.appendChild(blank);
  }

  // actual days
  for (let d=1; d<=daysInMonth; d++){
    const iso = isoOf(year, month, d);
    const p = phaseProbabilities(vault, iso);
    const phase = pick(p);

    const cell = document.createElement("div");
    cell.className = "calCell";
    cell.dataset.iso = iso;

    const top = document.createElement("div");
    top.className = "calTop";

    const day = document.createElement("div");
    day.className = "calDay";
    day.textContent = String(d);

    const tag = document.createElement("div");
    tag.className = "calTag " + cls(phase);
    tag.textContent = phase;

    top.appendChild(day);
    top.appendChild(tag);

    const sub = document.createElement("div");
    sub.className = "tiny muted";
    sub.textContent = `Conf ${Math.round(p.confidence*100)}%`;

    cell.appendChild(top);
    cell.appendChild(sub);
    el.appendChild(cell);
  }

  function pick(p){
    const arr = [["Period",p.period],["PMS",p.pms],["Ovulation",p.ovu],["Neutral",p.neutral]].sort((a,b)=>b[1]-a[1]);
    return arr[0][0];
  }
  function cls(phase){
    if (phase==="Period") return "tagPeriod";
    if (phase==="PMS") return "tagPms";
    if (phase==="Ovulation") return "tagOvu";
    return "";
  }
}

function isoOf(y, m0, d) {
  const m = String(m0+1).padStart(2,"0");
  const day = String(d).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
