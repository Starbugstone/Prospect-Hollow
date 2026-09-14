import { CHAPTERS, LEVEL_COUNT } from './campaign';

// Coin prices share one multiplier so buildings and supplies stay in step.
export const purchasePrice = (basePrice) => Math.ceil(basePrice * 1.5);

const miningChapter = (levelId) =>
  Number.isInteger(levelId) && levelId >= 1 && levelId <= LEVEL_COUNT
    ? 1 + Math.floor((levelId - 1) / (LEVEL_COUNT / CHAPTERS.length))
    : 1;
// Each chapter adds another full mining subtotal: 1x, 2x, 3x, ... 12x.
export const depthBonusPercent = (levelId) => (miningChapter(levelId) - 1) * 100;
export const miningDepthBonus = (baseCoins, levelId) =>
  Math.min(
    Number.MAX_SAFE_INTEGER - baseCoins,
    Math.floor((baseCoins * depthBonusPercent(levelId)) / 100),
  );

// Preserve the first three chapters, then taper windfalls instead of letting a
// single late chest buy several improvements. Old pending receipts keep version 1.
export const CHEST_ECONOMY_VERSION = 2;
export const chestCoinReward = (levelId = 1, version = CHEST_ECONOMY_VERSION) => {
  const chapter = miningChapter(levelId);
  return version === 1
    ? 500 * chapter
    : Math.min(4000, 500 * Math.min(3, chapter) + 250 * Math.max(0, chapter - 3));
};

// Agreed per-era level prices. Mining windfalls never increase a quoted price.
export const RIVER_RAIL_LEVEL_PRICES = [800, 1200, 1400];
