import { expect, it } from 'vitest';
import { getStars, starGoals } from '../../src/data/starRating';
import { LEVEL_COUNT } from '../../src/data/campaign';
import { generateLevelConfigs } from '../../src/game/engine/LevelGenerator';
import { simulateCampaignLevel } from '../helpers/campaignSimulation';

// Plays every level for three stars, so it runs with the level simulations
// (npm run test:levels) rather than on every push. The star rating rules
// themselves are covered by testing/star-ratings.test.js.
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
    // Puzzles that need board bonuses to finish drift when bonus rules change.
    // A 25% level is an intended challenge; below that, recalibrate it.
    if (level.tiles.some((tile) => tile.bonusOnly))
      expect(
        wins.length,
        `Level ${id}: three stars in only ${wins.length} of 20 held-out runs`,
      ).toBeGreaterThanOrEqual(5);
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
