export function dataGates(model, hasInsight) {
  const cycles = model?.cycleLengths?.length || 0;
  const personal = cycles >= 3;
  const fertileOn = model?.goal === "fertility"
    && model?.situation !== "hormonal"
    && model?.situation !== "pregnancy";
  const fertileReady = fertileOn && (model?.markerCount || 0) > 0;

  return [
    {
      name: "Personal window",
      desc: personal
        ? "Using your own cycle lengths."
        : `Opens after 3 cycle lengths. You have ${cycles}.`,
      active: personal
    },
    {
      name: "Symptom timing",
      desc: hasInsight
        ? "A symptom has a repeated timing."
        : "Log the same symptom across a few cycles.",
      active: !!hasInsight
    },
    {
      name: "Fertile window",
      desc: !fertileOn
        ? "Turn on fertility awareness in Settings to see this."
        : fertileReady
          ? "Using an ovulation sign you logged."
          : "Shown from cycle length until you log an LH test or waking temperature.",
      active: fertileReady
    }
  ];
}
