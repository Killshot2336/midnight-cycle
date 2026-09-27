import { addDaysISO, daysBetweenISO } from "./guard.js";
import { buildForecastModel, dayOutlook, tomorrowNudge, topSymptom } from "./cycleModel.js";
import { symptomDayNote } from "./insights.js";

export function buildForecast(vault, tz, days = 14, startISO) {
  const model = buildForecastModel(vault, startISO);
  const nudge = tomorrowNudge(vault, startISO);
  const top = topSymptom(vault);
  const note = symptomDayNote(top);
  const out = [];
  let iso = startISO;
  for (let i = 0; i < days; i++) {
    const outlook = dayOutlook(model, iso, nudge);
    let dayNote = "";
    if (top && model.median && daysBetweenISO(model.median, iso) === top.offset) dayNote = note;
    out.push({
      date: iso,
      bleed: outlook.bleed,
      fertile: outlook.fertile,
      label: outlook.label,
      note: dayNote
    });
    iso = addDaysISO(iso, 1);
  }
  return { days: out, model, nudge, tz };
}
