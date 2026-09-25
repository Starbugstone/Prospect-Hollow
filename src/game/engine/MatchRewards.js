import { GEM_TYPES } from './GemFactory';

export const COMBO_COIN_STEP = 5;
export const MULTI_MATCH_COIN_STEP = 10;

export const tierCoins = (tier, coinStep) =>
  Number.isSafeInteger(tier) && tier >= 2 ? (tier - 1) * coinStep : 0;

export const matchRewardBreakdown = (counts, coinStep) =>
  Object.entries(counts ?? {})
    .filter(
      ([tier, count]) =>
        tierCoins(Number(tier), coinStep) > 0 && Number.isSafeInteger(count) && count > 0,
    )
    .map(([tier, count]) => ({
      tier: Number(tier),
      count,
      coinsEach: tierCoins(Number(tier), coinStep),
      coins: Math.min(Number.MAX_SAFE_INTEGER, count * tierCoins(Number(tier), coinStep)),
    }))
    .sort((a, b) => a.tier - b.tier);

// Relic collection adds animation steps but does not advance the cascade.
export const cascadeTier = (step, position) => (step.index ?? position) + 1;

// Shared by live play and campaign score simulations.
export const clearScore = (step, position) =>
  (Array.isArray(step?.cleared) ? step.cleared.length : 0) * 100 * cascadeTier(step, position);

// Count actual lines in one clear, not blast footprints or later cascades.
// Crossing lines (T/L shapes) are two alignments, even with a shared gem.
export const simultaneousMatchCount = (step) =>
  (step.matches ?? []).filter(
    (match) =>
      GEM_TYPES.includes(match.type) &&
      ['horizontal', 'vertical'].includes(match.orientation) &&
      match.indices.length >= 3 &&
      match.indices.some((index) => step.cleared?.includes(index)),
  ).length;

export const multiMatchLabel = (count) =>
  count === 2 ? 'DOUBLE MATCH!' : count === 3 ? 'TRIPLE MATCH!' : 'MULTI MATCH!';
