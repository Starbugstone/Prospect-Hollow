import { advanceStoredPuzzleProduction } from './puzzleProduction';
import { moonstoneKeepsakes } from './moonSettlement';
import { wholeNumberOrZero as count } from './saveFormat';
// town.js creates each town's moonstones; this module only reads its building list
// inside functions, after both modules have loaded.
import { MOONSTONE_BUILDINGS } from './town';

export const MOONSTONE_VERSION = 2;
export const MOONSTONE_ECONOMY = Object.freeze({
  version: MOONSTONE_VERSION,
  runs: 3,
  storageBatches: 10,
  continuousGemsPerPuzzle: 300,
  continuousPuzzlesPerLevel: 3,
  saleCoins: 250,
});
const validMoonstoneAmount = (amount) => Number.isSafeInteger(amount) && amount > 0;
export const createMoonstones = () => ({
  moonstoneVersion: MOONSTONE_VERSION,
  moonstones: 0,
  moonstonesEarned: 0,
  moonstoneProduction: { progress: 0, stored: 0 },
});
// A deterministic state migration, never an additive reward command. Both devices
// derive the same starting balance; sync chooses a complete checkpoint, never sums it.
export const moonstoneCapacity = (town) =>
  (town.buildings.moonstoneWorkshop ?? 0) * MOONSTONE_ECONOMY.storageBatches;
export function normalizeMoonstones(saved, town) {
  const migrated = [1, MOONSTONE_VERSION].includes(saved?.moonstoneVersion);
  const earned = migrated ? count(saved.moonstonesEarned) : moonstoneKeepsakes(town);
  const production = saved?.moonstoneProduction;
  return {
    moonstoneVersion: MOONSTONE_VERSION,
    moonstones: migrated ? Math.min(earned, count(saved.moonstones)) : earned,
    moonstonesEarned: earned,
    moonstoneProduction: {
      progress: migrated ? Math.min(MOONSTONE_ECONOMY.runs - 1, count(production?.progress)) : 0,
      stored: migrated
        ? Math.min(
            saved.moonstoneVersion === 1
              ? (town.buildings.moonstoneWorkshop ?? 0)
              : moonstoneCapacity(town),
            count(saved.moonstoneVersion === 1 ? production?.charge : production?.stored),
          )
        : 0,
    },
  };
}
export function earnMoonstones(town, amount) {
  const credited = Math.min(amount, Number.MAX_SAFE_INTEGER - town.moonstonesEarned);
  return {
    ...town,
    moonstones: town.moonstones + credited,
    moonstonesEarned: town.moonstonesEarned + credited,
  };
}
export function rewardMoonBuilding(before, after, id) {
  const amount = MOONSTONE_BUILDINGS.includes(id)
    ? Math.max(0, (after.buildings[id] ?? 0) - (before.buildings[id] ?? 0))
    : 0;
  return amount ? earnMoonstones(after, amount) : after;
}
// One completed normal puzzle (or equivalent continuous gem credit) advances stock.
// Upgrading keeps stock and progress.
export function advanceMoonstoneProduction(town) {
  const level = town.buildings.moonstoneWorkshop ?? 0;
  return level
    ? {
        ...town,
        moonstoneProduction: advanceStoredPuzzleProduction(
          town.moonstoneProduction,
          MOONSTONE_ECONOMY.runs,
          level,
          moonstoneCapacity(town),
        ),
      }
    : town;
}
function spendMoonstoneBalance(town, amount) {
  return validMoonstoneAmount(amount) && town.moonstones >= amount
    ? { ...town, moonstones: town.moonstones - amount }
    : null;
}
export function sellMoonstoneBalance(town, amount) {
  const next = spendMoonstoneBalance(town, amount);
  if (!next) return null;
  const coins = amount * MOONSTONE_ECONOMY.saleCoins;
  return Number.isSafeInteger(coins) && town.coins <= Number.MAX_SAFE_INTEGER - coins
    ? { ...next, coins: town.coins + coins }
    : null;
}

// Only eligible gems consume the level's lifetime allowance. Once full, discard
// the rest of this settlement, preserving already earned partial credit.
export function advanceContinuousMoonstones(town, previousGems, jewels) {
  const perPuzzle = MOONSTONE_ECONOMY.continuousGemsPerPuzzle;
  const limit = perPuzzle * MOONSTONE_ECONOMY.continuousPuzzlesPerLevel;
  let gems = previousGems;
  let remaining = Math.min(jewels, limit - gems);
  while (
    remaining > 0 &&
    town.buildings.moonstoneWorkshop &&
    town.moonstoneProduction.stored < moonstoneCapacity(town)
  ) {
    const used = Math.min(remaining, perPuzzle - (gems % perPuzzle));
    gems += used;
    remaining -= used;
    if (gems % perPuzzle === 0) town = advanceMoonstoneProduction(town);
  }
  return { town, gems };
}
