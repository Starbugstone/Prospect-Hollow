import { afterEach, beforeEach, expect, it, onTestFinished, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { getStars, getLevelStarTarget, starGoals } from '../src/data/starRating';
import { STAR_SCORE_TARGETS } from '../src/data/starScoreTargets';
import { LEVEL_COUNT, scoreChestEarned } from '../src/data/campaign';
import { generateLevelConfigs, levelConfig } from '../src/game/engine/LevelGenerator';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';

// Playing every level for three stars is a level simulation: testing/levels/star-attainment.test.js.
const levels = generateLevelConfigs();

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  useGameStore().cancelHint();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each([
  [0, 1, 1],
  [9999, 3, 1],
  [9999, 4, 2],
  [10000, 3, 2],
  [10000, 4, 3],
  [13500, 3, 2],
  [14999, 3, 2],
  [15000, 1, 3],
  [15000, 4, 3],
])('awards score %i and cascade ×%i exactly %i stars', (score, combo, stars) => {
  expect(getStars(score, 10000, combo)).toBe(stars);
});

it('rounds fractional thresholds up and falls back for future or missing level targets', () => {
  expect(starGoals(101)).toEqual({ score: 101, bonusScore: 152, cascade: 4 });
  expect(getStars(151, 101, 1)).toBe(2);
  expect(getStars(152, 101, 1)).toBe(3);
  for (const id of [0, -1, 1.5, NaN, LEVEL_COUNT + 1])
    expect(getLevelStarTarget(id, 9000)).toBe(9000);
  expect(getStars(10000, 0, 1)).toBe(1);
});

it('provides a positive authored star target for every level and keeps introductory targets forgiving', () => {
  expect(STAR_SCORE_TARGETS).toHaveLength(LEVEL_COUNT);
  for (const level of levels) {
    expect(Number.isInteger(level.starScoreTarget)).toBe(true);
    expect(level.starScoreTarget).toBeGreaterThan(0);
    if (level.id <= 12) expect(level.starScoreTarget).toBeLessThanOrEqual(level.chestTarget);
  }
});

it('uses the level star target at victory without changing chest targets or existing best stars', () => {
  const game = useGameStore(),
    campaign = useCampaignStore();
  game.bootstrap();
  // Use distinct thresholds to catch accidental reuse of the chest target.
  const config = levelConfig(1),
    authored = config.starScoreTarget;
  config.starScoreTarget = 2000;
  onTestFinished(() => {
    config.starScoreTarget = authored;
  });
  game.startLevel(1);
  expect(game.starScoreTarget).toBe(2000);
  game.score = 3000;
  game.maxCascade = 1;
  game.remainingLayers = 0;
  game.completeLevel();
  expect(campaign.records[1]).toMatchObject({ score: 3000, stars: 3 });
  expect(scoreChestEarned(game.score, levels[0].chestTarget)).toBe(false);
  expect(game.levelRewards.map((reward) => reward.source)).toEqual(['completion']);
  campaign.recordVictory({ id: 1, score: 1, target: 7500, starTarget: 2000, combo: 1 });
  expect(campaign.records[1].stars).toBe(3);
  setActivePinia(createPinia());
  expect(useCampaignStore().records[1].stars).toBe(3);
});
