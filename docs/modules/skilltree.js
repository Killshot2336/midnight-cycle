// Skyrim-like but not cringe: “systems” that reward consistency.
// XP = daily check-ins + period starts + notes.
// Rank unlocks: deeper insights + “precision mode”.

export function ensureSkill(vault) {
  vault.skill = vault.skill || { xp:0, rank:0, unlocks:{} };
  return vault;
}

export function awardXP(vault, amount, reason="") {
  ensureSkill(vault);
  const s = vault.skill;
  s.xp += amount;
  const { rank, label } = rankFromXP(s.xp);
  s.rank = rank;
  s.label = label;
  return vault;
}

export function rankFromXP(xp) {
  const tiers = [
    { xp:0, label:"Initiate" },
    { xp:50, label:"Observer" },
    { xp:120, label:"Tracker" },
    { xp:220, label:"Analyst" },
    { xp:360, label:"Architect" },
    { xp:540, label:"Oracle" }
  ];
  let r = 0, label = "Initiate";
  for (let i=0;i<tiers.length;i++){
    if (xp >= tiers[i].xp) { r = i; label = tiers[i].label; }
  }
  return { rank:r, label };
}

export function skillCards(vault) {
  ensureSkill(vault);
  const s = vault.skill;
  const unlocked = (name, needRank) => s.rank >= needRank;

  return [
    {
      name:"Consistency Core",
      desc:"Daily check-ins raise accuracy faster than anything else.",
      need:0,
      active:true
    },
    {
      name:"Precision Mode",
      desc:"Tighter probability calibration once enough data exists.",
      need:2,
      active: unlocked("Precision Mode",2)
    },
    {
      name:"Anomaly Sense",
      desc:"Detect shifts that usually break other trackers.",
      need:3,
      active: unlocked("Anomaly Sense",3)
    },
    {
      name:"Insight Engine",
      desc:"Correlation snapshots (mood/pain/flow patterns).",
      need:3,
      active: unlocked("Insight Engine",3)
    },
    {
      name:"Vault Mastery",
      desc:"Full encryption + stealth UI patterns.",
      need:1,
      active: unlocked("Vault Mastery",1)
    },
    {
      name:"Oracle Layer",
      desc:"Deeper day-feel predictions (still realistic).",
      need:4,
      active: unlocked("Oracle Layer",4)
    }
  ];
}
