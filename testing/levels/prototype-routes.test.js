import { expect, it } from 'vitest';
import { prototypeConfig } from '../../src/data/prototypeBoards';
import { GEM_TYPES } from '../../src/game/engine/GemFactory';
import { simulateCampaignLevel } from '../helpers/campaignSimulation';

// Hint-led runs of the route-choice prototype (src/data/prototypeBoards.js) on 60 seeds, with
// both routes, with one route shut for good, with neither, and with one route open from the
// start. Prints one summary line per variant; every run must finish. Turn budgets inside the
// simulator are diagnostics, never gameplay move limits.
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const base = prototypeConfig('deep-lantern-routes');
const cols = base.boardCols;
const well = base.tiles.flatMap((tile, index) =>
  index >= 8 * cols && (tile.signal === 'lantern' || tile.phaseSeal) ? [index] : [],
);
const routeOf = (tile) => tile.waist ?? (tile.sealed ? tile.chamber : null);

// `shut` routes become rock; `open` routes start broken in, their cells filled without a match.
function variant({ shut = [], open = [] }) {
  const tiles = base.tiles.map((tile) => ({ ...tile }));
  const board = base.board.map((gem) => (gem ? { ...gem } : null));
  const types = base.boardLayout.gemTypes;
  const lines = (index, type) =>
    [
      [-1, -2],
      [-1, 1],
      [1, 2],
    ].some((pair) =>
      [1, cols].some((step) =>
        pair.every((offset) => {
          const cell = index + offset * step;
          const sameRow = step !== 1 || Math.floor(cell / cols) === Math.floor(index / cols);
          return sameRow && board[cell]?.type === type;
        }),
      ),
    );
  for (const [index, tile] of tiles.entries()) {
    const route = routeOf(tile);
    if (shut.includes(route)) {
      tiles[index] = { type: 'void', health: 0, maxHealth: 0 };
      board[index] = null;
    } else if (open.includes(route)) {
      Object.assign(tile, tile.waist ? { type: 'standard', health: 0 } : { sealed: false });
      const type = types.find((candidate) => !lines(index, candidate)) ?? types[0];
      board[index] = { id: `open-${index}`, type };
    }
  }
  return { ...base, tiles, board };
}

const median = (values) => {
  const sorted = values.filter((value) => value != null).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
};

function measure(label, config) {
  const runs = SEEDS.map((seed) => {
    const opened = {};
    const lit = { horizontal: 0, vertical: 0, blast: 0 };
    let cascades = 0;
    const result = simulateCampaignLevel(config, seed, {
      observe(resolution, { turn, tiles }) {
        for (const step of resolution.steps) {
          for (const route of step.breakthroughs ?? []) opened[route] ??= turn;
          for (const update of step.tileUpdates ?? []) {
            const done =
              update.signalHealth === 0 || (update.health != null && tiles[update.index].phaseSeal);
            if (!well.includes(update.index) || !done) continue;
            const match = step.matches.find((candidate) =>
              candidate.indices.includes(update.index),
            );
            if (!match || !GEM_TYPES.includes(match.type)) lit.blast++;
            else lit[match.orientation === 'vertical' ? 'vertical' : 'horizontal']++;
          }
        }
        cascades += Math.max(0, resolution.steps.filter((step) => step.cleared?.length).length - 1);
      },
    });
    return { result, opened, lit, cascades };
  });
  const first = (route, other) =>
    runs.filter(
      ({ opened }) =>
        opened[route] != null && (opened[other] == null || opened[route] < opened[other]),
    ).length;
  const summary = {
    label,
    completed: runs.filter(({ result }) => !result.remaining).length,
    medianMoves: median(runs.map(({ result }) => result.turns)),
    maxMoves: Math.max(...runs.map(({ result }) => result.turns)),
    shaftFirst: first('a', 'b'),
    sideFirst: first('b', 'a'),
    medianShaftOpens: median(runs.map(({ opened }) => opened.a)),
    medianSideOpens: median(runs.map(({ opened }) => opened.b)),
    wellHits: Object.fromEntries(
      Object.keys(runs[0].lit).map((how) => [
        how,
        runs.reduce((sum, run) => sum + run.lit[how], 0),
      ]),
    ),
    medianCascades: median(runs.map(({ cascades }) => cascades)),
    medianCraftedBonuses: median(runs.map(({ result }) => result.craftedBonuses)),
    medianScore: median(runs.map(({ result }) => result.score)),
    shuffles: runs.reduce((sum, { result }) => sum + result.shuffles, 0),
  };
  console.log(JSON.stringify(summary));
  return summary;
}

it.each([
  ['both routes', {}],
  ['drop shaft only', { shut: ['b'] }],
  ['side chamber only', { shut: ['a'] }],
  ['neither route', { shut: ['a', 'b'] }],
  ['drop shaft open from the start', { open: ['a'], shut: ['b'] }],
  ['side chamber open from the start', { open: ['b'], shut: ['a'] }],
])(
  'finishes the route-choice prototype on every seed: %s',
  (label, options) => {
    expect(measure(label, variant(options)).completed).toBe(SEEDS.length);
  },
  120000,
);
