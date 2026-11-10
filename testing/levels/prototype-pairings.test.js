import { expect, it } from 'vitest';
import { prototypeConfig } from '../../src/data/prototypeBoards';
import { simulateCampaignLevel } from '../helpers/campaignSimulation';

// Hint-led runs of the mechanic-pairing prototypes (src/data/prototypeBoards.js) on 60 seeds.
// Prints one summary line per board; every run must finish. Turn budgets inside the simulator
// are diagnostics, never gameplay move limits.
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const at = (values, share) => {
  const sorted = values.filter((value) => value != null).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) * share)] : null;
};
const median = (values) => at(values, 0.5);

function measure(key) {
  const level = prototypeConfig(key);
  const glass = level.tiles.flatMap((tile, index) => (tile.lensOnly ? [index] : []));
  const knots = level.tiles.flatMap((tile, index) => (tile.rootKnot ? [index] : []));
  const runs = SEEDS.map((seed) => {
    const done = {};
    const delivered = [];
    const flips = [];
    const result = simulateCampaignLevel(level, seed, {
      observe(resolution, { turn }) {
        for (const step of resolution.steps) {
          if (step.gravityFlip) flips.push(turn);
          for (const update of step.tileUpdates ?? [])
            if (update.health === 0) done[update.index] ??= turn;
        }
        for (let count = resolution.relicsCollected ?? 0; count > 0; count--) delivered.push(turn);
      },
    });
    return { result, done, delivered, flips };
  });
  const last = (cells) => (run) =>
    cells.length ? Math.max(...cells.map((cell) => run.done[cell] ?? Infinity)) : null;
  const summary = {
    key,
    completed: runs.filter(({ result }) => !result.remaining).length,
    moves: [0.1, 0.5, 0.9, 1].map((share) =>
      at(
        runs.map(({ result }) => result.turns),
        share,
      ),
    ),
    medianScore: median(runs.map(({ result }) => result.score)),
    shuffles: runs.reduce((sum, { result }) => sum + result.shuffles, 0),
    medianCraftedBonuses: median(runs.map(({ result }) => result.craftedBonuses)),
    medianGlassGone: median(runs.map(last(glass))),
    medianKnotsCut: median(runs.map(last(knots))),
    medianFirstFlip: median(runs.map(({ flips }) => flips[0])),
    medianFlips: median(runs.map(({ flips }) => flips.length)),
    runsWithoutFlip: runs.filter(({ flips }) => !flips.length).length,
    medianFirstDelivery: median(runs.map(({ delivered }) => delivered[0])),
    medianLastDelivery: median(runs.map(({ delivered }) => delivered.at(-1))),
    deliveredBeforeGlassGone: runs.filter(
      (run) => glass.length && run.delivered[0] < last(glass)(run),
    ).length,
  };
  console.log(JSON.stringify(summary));
  return summary;
}

it.each(['echo-gallery-crossing', 'turning-orchard-both-ways'])(
  'finishes the pairing prototype on every seed: %s',
  (key) => {
    const summary = measure(key);
    expect(summary.completed).toBe(SEEDS.length);
    // Starglass in the cargo's way always goes first; a dial board always needs its dial.
    expect(summary.deliveredBeforeGlassGone).toBe(0);
    if (key === 'turning-orchard-both-ways') expect(summary.runsWithoutFlip).toBe(0);
  },
  120000,
);
