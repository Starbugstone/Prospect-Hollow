import { afterEach, expect, it, vi } from 'vitest';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { simulateCampaignLevel } from './helpers/campaignSimulation';

const levels = generateLevelConfigs();
const reviewedLayouts = new Set([
  34,
  38,
  52,
  60,
  111,
  120,
  ...Array.from({ length: 24 }, (_, i) => i + 121),
]);
afterEach(() => vi.restoreAllMocks());

// Cache results so the aggregate pacing regression also works when run alone.
const measuredTurns = new Map();
const playLevel = (id, level) => {
  if (measuredTurns.has(id)) return measuredTurns.get(id);
  const turnCounts = [];
  const seeds =
    id <= 12 || reviewedLayouts.has(id) ? Array.from({ length: 30 }, (_, i) => i + 1) : [1, 19, 73];
  for (const seed of seeds) {
    const result = simulateCampaignLevel(level, seed);
    const { turns, shuffles } = result;
    // A solvable board can still be a slog. Guard the paced campaign against
    // returning to the previous 90–250 move outliers on these fixed seeds.
    // The appended late campaign permits occasional harder layouts; its
    // aggregate median/p90 are guarded below. This is diagnostic only.
    expect(turns).toBeLessThanOrEqual(
      id > 240 ? 80 : id <= 12 ? 30 : reviewedLayouts.has(id) ? 70 : 60,
    );
    turnCounts.push(turns);
    expect(shuffles).toBeLessThanOrEqual(id <= 12 ? 0 : 3);
    expect({
      seed,
      remaining: result.remaining,
      layers: result.layers,
      relics: result.relics,
      ore: result.ore,
    }).toEqual({ seed, remaining: false, layers: 0, relics: 0, ore: 0 });
  }
  if (id <= 12) {
    turnCounts.sort((a, b) => a - b);
    const median = (turnCounts[14] + turnCounts[15]) / 2;
    // Guard both ends: approachable should not mean a two-move level.
    // Match-before-blast swaps can finish the early puzzles a move sooner.
    expect(median).toBeGreaterThanOrEqual(id <= 6 ? 7 : 8);
    expect(median).toBeLessThanOrEqual(id <= 6 ? 10 : 13);
  }
  measuredTurns.set(id, turnCounts);
  return turnCounts;
};

// Exercise full games using legal hints, earned board bonuses and free
// dead-board shuffles. Inventory powers are never required for completion.
it.each(levels.map((level) => [level.id, level]))(
  'can finish level %i without inventory powers',
  (id, level) => {
    playLevel(id, level);
  },
  15000,
);

it('keeps the appended campaign median and upper-decile workload below a slog', () => {
  const turns = levels
    .slice(240)
    .flatMap((level) => playLevel(level.id, level))
    .sort((a, b) => a - b);
  expect(turns).toHaveLength(84 * 3);
  // Ten independent seeds per new level measured median20/p90 31 before the
  // final edge-ice refinements. Leave room for variation without accepting a
  // campaign that is consistently slow. These are never gameplay move caps.
  expect(turns[Math.floor(turns.length / 2)]).toBeLessThanOrEqual(28);
  expect(turns[Math.ceil(turns.length * 0.9) - 1]).toBeLessThanOrEqual(42);
}, 20000);
