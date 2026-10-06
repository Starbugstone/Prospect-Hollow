import { ERA_BY_ID, eraEvolution } from './eras';
import { LEVEL_COUNT } from './campaign';
import { chapterIndexOf } from './chapters';

// Coin prices share one multiplier so buildings and supplies stay in step.
export const purchasePrice = (basePrice) => Math.ceil(basePrice * 1.5);

const miningChapter = (levelId) =>
  Number.isInteger(levelId) && levelId >= 1 && levelId <= LEVEL_COUNT
    ? 1 + chapterIndexOf(levelId)
    : 1;
// Each chapter adds another full mining subtotal: 1× in chapter 1, 2× in chapter 2, and so on.
export const depthBonusPercent = (levelId) => (miningChapter(levelId) - 1) * 100;
export const miningDepthBonus = (baseCoins, levelId) =>
  Math.min(
    Number.MAX_SAFE_INTEGER - baseCoins,
    Math.floor((baseCoins * depthBonusPercent(levelId)) / 100),
  );

// Preserve the first three chapters, then taper windfalls instead of letting a
// single late chest buy several improvements. Old pending receipts keep their version.
export const CHEST_ECONOMY_VERSION = 3;
const CHEST_COIN_CAP = 4000;
// Version 3 lets the cap follow the town era: half the era's middle modernization
// price, never below the original cap. A new era gets its cap from its prices.
export const chestCoinCap = (era) => {
  const price = eraEvolution(era).prices?.[1] ?? 0;
  return Math.max(CHEST_COIN_CAP, Math.round(price / 100) * 50);
};
// The chapter value before any cap; version 3 save rules export it per level.
export const chestLevelCoins = (levelId) => {
  const chapter = miningChapter(levelId);
  return 500 * Math.min(3, chapter) + 250 * Math.max(0, chapter - 3);
};
export const chestCoinReward = (levelId = 1, version = CHEST_ECONOMY_VERSION, era) => {
  if (version === 1) return 500 * miningChapter(levelId);
  return Math.min(version === 2 ? CHEST_COIN_CAP : chestCoinCap(era), chestLevelCoins(levelId));
};
// A saved chest names a published version; from version 3 it also names its town era.
export const knownChestTerms = ({ economyVersion = 1, era }) =>
  Number.isInteger(economyVersion) &&
  economyVersion >= 1 &&
  economyVersion <= CHEST_ECONOMY_VERSION &&
  (economyVersion < 3 || Object.hasOwn(ERA_BY_ID, era));

// Agreed per-era level prices. Mining windfalls never increase a quoted price.
export const RIVER_RAIL_LEVEL_PRICES = eraEvolution('river-rail').prices;
