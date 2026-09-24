import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { getStars, getLevelStarTarget, starGoals } from '../src/data/starRating';
import { STAR_SCORE_TARGETS } from '../src/data/starScoreTargets';
import { LEVEL_COUNT, getChestTier } from '../src/data/campaign';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';
import { simulateCampaignLevel } from './helpers/campaignSimulation';

const levels = generateLevelConfigs();
const measured = new Map();
// Held-out refill seeds, separate from calibration seeds 1–30.
const measure = (level) => {
  if (!measured.has(level.id))
    measured.set(
      level.id,
      Array.from({ length: 20 }, (_, i) => simulateCampaignLevel(level, 101 + i)),
    );
  return measured.get(level.id);
};

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
  game.availableLevels[0].config.starScoreTarget = 2000;
  game.startLevel(1);
  expect(game.starScoreTarget).toBe(2000);
  game.score = 3000;
  game.maxCascade = 1;
  game.remainingLayers = 0;
  game.completeLevel();
  expect(campaign.records[1]).toMatchObject({ score: 3000, stars: 3 });
  expect(getChestTier(game.score, levels[0].chestTarget)).toBeUndefined();
  expect(game.levelRewards.map((reward) => reward.source)).toEqual(['completion']);
  campaign.recordVictory({ id: 1, score: 1, target: 7500, starTarget: 2000, combo: 1 });
  expect(campaign.records[1].stars).toBe(3);
  setActivePinia(createPinia());
  expect(useCampaignStore().records[1].stars).toBe(3);
});

it.each(levels.map((level) => [level.id, level]))(
  'can earn three stars on level %i before completion, without inventory powers',
  (id, level) => {
    const runs = measure(level);
    for (const run of runs)
      expect(run).toMatchObject({ remaining: false, layers: 0, relics: 0, ore: 0 });
    const wins = runs.filter(
      (run) => getStars(run.score, level.starScoreTarget, run.maxCombo) === 3,
    );
    expect(
      wins.length,
      `Level ${id}: no three-star completion in 20 held-out runs`,
    ).toBeGreaterThan(0);
    if (id <= 12) expect(wins.length).toBeGreaterThanOrEqual(14);
  },
  15000,
);

it('makes early three-star scores easy and later ratings progressively more demanding', () => {
  const bands = [
    [1, 12],
    [13, 36],
    [37, 120],
    [121, 240],
    [241, LEVEL_COUNT],
  ];
  const rates = bands.map(([first, last]) => {
    const runs = levels.slice(first - 1, last).flatMap((level) =>
      measure(level).map((run) => ({
        stars: getStars(run.score, level.starScoreTarget, run.maxCombo),
        scoreOnly: run.score >= starGoals(level.starScoreTarget).bonusScore,
      })),
    );
    return {
      first,
      last,
      three: runs.filter((r) => r.stars === 3).length / runs.length,
      scoreOnly: runs.filter((r) => r.scoreOnly).length / runs.length,
    };
  });
  expect(rates[0].three).toBeGreaterThanOrEqual(0.85);
  expect(rates[0].scoreOnly).toBeGreaterThanOrEqual(0.8);
  for (let i = 1; i < rates.length; i++) expect(rates[i].three).toBeLessThan(rates[i - 1].three);
  expect(rates.at(-1).three).toBeGreaterThanOrEqual(0.3);
  expect(rates.at(-1).three).toBeLessThanOrEqual(0.65);
  // Late puzzles retain the ×4 route. The harder 150%-score-only route
  // measured about 10% in calibration; it must remain represented too.
  expect(rates.at(-1).scoreOnly).toBeGreaterThanOrEqual(0.05);
  console.info('Held-out star attainment (hint-led, not human completion rates):', rates);
}, 360000);
