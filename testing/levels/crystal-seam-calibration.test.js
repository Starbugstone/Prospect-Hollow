import { expect, it } from 'vitest';
import { CRYSTAL_SEAM_FIRST_LEVEL } from '../../src/data/crystalSeamLevels';
import { LEVEL_COUNT } from '../../src/data/campaign';
import { generateLevelConfigs } from '../../src/game/engine/LevelGenerator';
import { simulateCampaignLevel } from '../helpers/campaignSimulation';

// Chapters 92–101 were calibrated on hint-led seeds 1–30 (node scripts/measure-campaign.mjs
// . 30, which plays the same seeds as this helper): each chest target is 80% of the median
// score, to the nearest 500. Every calibration run must finish; the simulator's turn budget
// is a diagnostic, never a gameplay move limit. See docs/crystal-seam-levels.md.
const levels = generateLevelConfigs().slice(CRYSTAL_SEAM_FIRST_LEVEL - 1);
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

it('covers levels 547–606', () => {
  expect(levels.map(({ id }) => id)).toEqual(
    Array.from({ length: LEVEL_COUNT - CRYSTAL_SEAM_FIRST_LEVEL + 1 }, (_, i) => 547 + i),
  );
});

it.each(levels.map((level) => [level.id, level]))(
  'sets level %i’s chest at 80% of its median calibration score',
  (id, level) => {
    const runs = SEEDS.map((seed) => simulateCampaignLevel(level, seed));
    for (const run of runs) expect(run.remaining, `level ${id}`).toBe(false);
    const scores = runs.map((run) => run.score).toSorted((a, b) => a - b);
    const median = scores[Math.floor((scores.length - 1) / 2)];
    expect(level.chestTarget).toBe(Math.round((median * 0.8) / 500) * 500);
  },
  60000,
);
