export function computeInsights(vault) {
  // Placeholder for deeper correlation analysis.
  // We keep it safe + lightweight: show consistency & data completeness.
  const daysLogged = Object.keys(vault.daily || {}).length;
  const starts = (vault.periods || []).length;
  return {
    daysLogged,
    starts,
    note: daysLogged >= 10 ? "Enough data for stronger predictions." : "Log ~10 days for sharper accuracy."
  };
}
