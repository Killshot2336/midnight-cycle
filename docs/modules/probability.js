import { buildForecastModel, dayOutlook, tomorrowNudge } from "./cycleModel.js";

export function phaseProbabilities(vault, iso) {
  const model = buildForecastModel(vault, iso);
  const nudge = tomorrowNudge(vault, iso);
  return { ...dayOutlook(model, iso, nudge), model };
}
