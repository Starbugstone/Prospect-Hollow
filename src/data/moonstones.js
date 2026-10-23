import { advancePuzzleProduction } from './puzzleProduction';
import { MOON_LOTS, moonstoneKeepsakes } from './moonSettlement';

export const MOONSTONE_VERSION = 1;
export const MOONSTONE_ECONOMY = Object.freeze({
  version: MOONSTONE_VERSION,
  runs: 3,
  saleCoins: 250,
});
const validMoonstoneAmount = (amount) => Number.isSafeInteger(amount) && amount > 0;
const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);
export const createMoonstones = () => ({
  moonstoneVersion: MOONSTONE_VERSION,
  moonstones: 0,
  moonstonesEarned: 0,
  moonstoneProduction: { progress: 0, charge: 0 },
});
// A deterministic state migration, never an additive reward command. Both devices
// derive the same starting balance; sync chooses a complete checkpoint, never sums it.
export function normalizeMoonstones(saved, town) {
  const migrated = saved?.moonstoneVersion === MOONSTONE_VERSION;
  const earned = migrated ? count(saved.moonstonesEarned) : moonstoneKeepsakes(town);
  const production = saved?.moonstoneProduction;
  return {
    moonstoneVersion: MOONSTONE_VERSION,
    moonstones: migrated ? Math.min(earned, count(saved.moonstones)) : earned,
    moonstonesEarned: earned,
    moonstoneProduction: {
      progress:
        migrated && production?.charge === 0 && Number.isInteger(production?.progress)
          ? Math.max(0, Math.min(MOONSTONE_ECONOMY.runs - 1, production.progress))
          : 0,
      charge:
        migrated && Number.isInteger(production?.charge)
          ? Math.max(0, Math.min(town.buildings.moonstoneWorkshop ?? 0, production.charge))
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
  const amount = Object.hasOwn(MOON_LOTS, id)
    ? Math.max(0, (after.buildings[id] ?? 0) - (before.buildings[id] ?? 0))
    : 0;
  return amount ? earnMoonstones(after, amount) : after;
}
// Same one-batch, completed-puzzle lifecycle as the blacksmith. Upgrading keeps
// progress and a ready batch; neither elapsed time nor continuous play produces it.
export function advanceMoonstoneProduction(town) {
  const level = town.buildings.moonstoneWorkshop ?? 0;
  return level
    ? {
        ...town,
        moonstoneProduction: advancePuzzleProduction(
          town.moonstoneProduction,
          MOONSTONE_ECONOMY.runs,
          level,
        ),
      }
    : town;
}
export function spendMoonstoneBalance(town, amount) {
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
