// One completed normal puzzle advances production without stopping for collection.
export function advancePuzzleProduction(production, runs, amount = 1) {
  const progress = production.progress + 1;
  return {
    progress: progress % runs,
    charge: production.charge + Math.floor(progress / runs) * amount,
  };
}

export function advanceStoredPuzzleProduction(production, runs, amount) {
  const batch = advancePuzzleProduction({ progress: production.progress, charge: 0 }, runs, amount);
  return { progress: batch.progress, stored: production.stored + batch.charge };
}
