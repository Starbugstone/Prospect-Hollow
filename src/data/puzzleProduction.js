// One completed normal puzzle advances one batch. Ready goods wait for collection.
export function advancePuzzleProduction(production, runs, amount = 1) {
  if (production.charge) return production;
  const progress = production.progress + 1;
  return progress >= runs ? { progress: 0, charge: amount } : { progress, charge: 0 };
}
