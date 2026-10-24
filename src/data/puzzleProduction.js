// One completed normal puzzle advances one batch. Ready goods wait for collection.
export function advancePuzzleProduction(production, runs, amount = 1) {
  if (production.charge) return production;
  const progress = production.progress + 1;
  return progress >= runs ? { progress: 0, charge: amount } : { progress, charge: 0 };
}

// Completed batches accumulate until storage is full. Partial progress survives
// collection and a full store; the last batch only fills the remaining space.
export function advanceStoredPuzzleProduction(production, runs, amount, capacity) {
  if (production.stored >= capacity) return production;
  const batch = advancePuzzleProduction({ progress: production.progress, charge: 0 }, runs, amount);
  return {
    progress: batch.progress,
    stored: Math.min(capacity, production.stored + batch.charge),
  };
}
