import { expect, it } from 'vitest';
import { PROTOTYPE_BOARDS, prototypeConfig } from '../../src/data/prototypeBoards';
import { hollowLevelSpec } from '../../src/data/hollowMineLevels';
import { prototypeLevelConfig } from '../../src/game/engine/LevelGenerator';
import { GEM_TYPES } from '../../src/game/engine/GemFactory';
import { simulateCampaignLevel } from '../helpers/campaignSimulation';

// Hint-led runs of the boards on trial for chapters 95–101 (src/data/prototypeBoards.js) on
// 60 seeds, with variants that take the pairing apart. Prints one summary line per board or
// variant; every run must finish. Turn budgets inside the simulator are diagnostics, never
// gameplay move limits.
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const at = (values, share) => {
  const sorted = values.filter((value) => value != null && value !== Infinity);
  sorted.sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) * share)] : null;
};
const median = (values) => at(values, 0.5);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const cellsWhere = (level, test) =>
  level.tiles.flatMap((tile, index) => (test(tile, index) ? [index] : []));
const near = (a, b, cols) =>
  a === b ||
  Math.abs((a % cols) - (b % cols)) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) === 1;

// Runs a board on every seed. `watch(step, context, run)` sees each resolution step with the
// tiles as they stand after the move; `run` collects that board's own figures.
function play(level, watch = () => {}) {
  return SEEDS.map((seed) => {
    const run = { done: {}, opened: {}, flips: [], delivered: [], deliveredUp: [] };
    run.result = simulateCampaignLevel(level, seed, {
      observe(resolution, { turn, tiles }) {
        let afterShift = false;
        for (const step of resolution.steps) {
          if (step.phaseShifts) afterShift = true;
          if (step.gravityFlip) run.flips.push(turn);
          for (const route of step.breakthroughs ?? []) run.opened[route] ??= turn;
          for (const update of step.tileUpdates ?? [])
            if (update.health === 0) run.done[update.index] ??= turn;
          watch(step, { turn, tiles, afterShift, cols: level.boardCols }, run);
        }
        for (let count = resolution.relicsCollected ?? 0; count > 0; count--) {
          run.delivered.push(turn);
          run.deliveredUp.push(tiles.some((tile) => tile.fall === 'up'));
        }
      },
    });
    return run;
  });
}

function summarize(label, runs, extra = {}) {
  const summary = {
    label,
    completed: runs.filter(({ result }) => !result.remaining).length,
    moves: [0.1, 0.5, 0.9, 1].map((share) =>
      at(
        runs.map(({ result }) => result.turns),
        share,
      ),
    ),
    medianScore: median(runs.map(({ result }) => result.score)),
    shuffles: sum(runs.map(({ result }) => result.shuffles)),
    medianCraftedBonuses: median(runs.map(({ result }) => result.craftedBonuses)),
    ...extra,
  };
  console.log(JSON.stringify(summary));
  return summary;
}

const lastDone = (cells) => (run) => Math.max(...cells.map((cell) => run.done[cell] ?? Infinity));
const board = (key) => PROTOTYPE_BOARDS.find((entry) => entry.key === key);
// The same board built from an edited layout, with the same level number (and so the same
// generator seed) and chapter details.
function edited(key, level, motif) {
  const config = prototypeConfig(key);
  const { boardCols: cols, boardRows: rows } = config;
  return prototypeLevelConfig({
    id: config.id,
    spec: hollowLevelSpec({ cols, rows, motif }, level),
    trial: {
      chapter: config.chapter,
      chapterName: board(key).chapterName,
      theme: config.theme,
      pace: 'explore',
      cols,
      rows,
      gemTypes: config.boardLayout.gemTypes,
    },
  });
}
// The same board with some tiles changed in place; gems stay where they are.
const retiled = (level, change) => ({
  ...level,
  tiles: level.tiles.map((tile) => change({ ...tile }) ?? tile),
  board: level.board.map((gem) => (gem ? { ...gem } : null)),
});
// A route walled up for good: its chamber and walls become rock-free void.
function shut(level, routes) {
  const routeOf = (tile) => tile.waist ?? (tile.sealed ? tile.chamber : null);
  return {
    ...level,
    tiles: level.tiles.map((tile) =>
      routes.includes(routeOf(tile)) ? { type: 'void', health: 0, maxHealth: 0 } : { ...tile },
    ),
    board: level.board.map((gem, index) =>
      routes.includes(routeOf(level.tiles[index])) ? null : gem && { ...gem },
    ),
  };
}

it('Shifting survey: markers lit through their seals and by phase shifts', () => {
  const level = prototypeConfig('shifting-survey-stars');
  const runs = play(level, (step, { tiles, afterShift, cols }, run) => {
    for (const update of step.tileUpdates ?? []) {
      if (update.signalHealth !== 0 || tiles[update.index].signal !== 'survey') continue;
      run.lit = (run.lit ?? 0) + 1;
      if (afterShift) run.byShift = (run.byShift ?? 0) + 1;
      const throughSeal = step.matches.some((match) =>
        match.indices.some((cell) => tiles[cell].phaseSeal && near(cell, update.index, cols)),
      );
      if (throughSeal) run.throughSeal = (run.throughSeal ?? 0) + 1;
    }
  });
  const summary = summarize('shifting-survey-stars', runs, {
    markersLit: sum(runs.map((run) => run.lit ?? 0)),
    litThroughSeal: sum(runs.map((run) => run.throughSeal ?? 0)),
    litByShift: sum(runs.map((run) => run.byShift ?? 0)),
    runsWithShiftLight: runs.filter((run) => run.byShift).length,
  });
  expect(summary.completed).toBe(SEEDS.length);
  expect(summary.markersLit).toBe(SEEDS.length * 8);
  expect(summary.litByShift).toBeGreaterThan(0);
}, 120000);

it('Ember sidings: brazier bombs open the gates on the siding', () => {
  const level = prototypeConfig('ember-sidings-gates');
  const gates = cellsWhere(level, (tile) => tile.bonusOnly && tile.type === 'blocker');
  const figures = (runs) => ({
    medianCoreBonuses: median(runs.map(({ result }) => result.coreBonuses)),
    medianGatesGone: median(runs.map(lastDone(gates))),
    medianFirstDelivery: median(runs.map(({ delivered }) => delivered[0])),
    medianLastDelivery: median(runs.map(({ delivered }) => delivered.at(-1))),
    deliveredBeforeGatesGone: runs.filter((run) => run.delivered[0] < lastDone(gates)(run)).length,
  });
  const runs = play(level);
  const summary = summarize('ember-sidings-gates', runs, figures(runs));
  const plain = play(
    retiled(level, (tile) =>
      tile.signal === 'core'
        ? { ...tile, signal: undefined, signalHealth: 0, coreCharges: 0 }
        : null,
    ),
  );
  const without = summarize('ember-sidings-gates without braziers', plain, figures(plain));
  for (const result of [summary, without]) {
    expect(result.completed).toBe(SEEDS.length);
    expect(result.deliveredBeforeGatesGone).toBe(0);
  }
  expect(summary.moves[1]).toBeLessThan(without.moves[1]);
}, 240000);

it('Buried routes: either way into the fossil bed', () => {
  const level = prototypeConfig('buried-routes-bed');
  const figures = (runs) => ({
    shaftFirst: runs.filter(({ opened }) => opened.a != null && !(opened.b < opened.a)).length,
    galleryFirst: runs.filter(({ opened }) => opened.b != null && !(opened.a <= opened.b)).length,
    bothOpened: runs.filter(({ opened }) => opened.a != null && opened.b != null).length,
    medianShaftOpens: median(runs.map(({ opened }) => opened.a)),
    medianGalleryOpens: median(runs.map(({ opened }) => opened.b)),
  });
  const results = [
    ['buried-routes-bed', level],
    ['buried-routes-bed shaft only', shut(level, ['b'])],
    ['buried-routes-bed gallery only', shut(level, ['a'])],
    ['buried-routes-bed neither route', shut(level, ['a', 'b'])],
  ].map(([label, config]) => {
    const runs = play(config);
    return summarize(label, runs, figures(runs));
  });
  for (const result of results) expect(result.completed).toBe(SEEDS.length);
  // Both routes get chosen, and having both beats having either alone.
  expect(results[0].shaftFirst).toBeGreaterThan(0);
  expect(results[0].galleryFirst).toBeGreaterThan(0);
  expect(results[0].moves[1]).toBeLessThan(Math.min(results[1].moves[1], results[2].moves[1]));
}, 480000);

it('Frost relays: the relay chain thaws the frozen bands', () => {
  const level = prototypeConfig('frost-relays-chain');
  const thaws = (step, context, run) => {
    for (const update of step.tileUpdates ?? []) {
      if (update.state !== 'PLAYABLE') continue;
      const kinds = step.matches.map((match) => match.type);
      const how = kinds.includes('spore-burst')
        ? 'burst'
        : kinds.some((kind) => !GEM_TYPES.includes(kind))
          ? 'bonus'
          : 'match';
      run[how] = (run[how] ?? 0) + 1;
    }
  };
  const figures = (runs) => ({
    medianSporeBursts: median(runs.map(({ result }) => result.sporeBursts)),
    thawedByBurst: sum(runs.map((run) => run.burst ?? 0)),
    thawedByBonus: sum(runs.map((run) => run.bonus ?? 0)),
    thawedByMatch: sum(runs.map((run) => run.match ?? 0)),
  });
  const runs = play(level, thaws);
  const summary = summarize('frost-relays-chain', runs, figures(runs));
  const plain = play(
    retiled(level, (tile) =>
      tile.signal === 'spore' ? { ...tile, signal: undefined, signalHealth: 0 } : null,
    ),
    thaws,
  );
  const without = summarize('frost-relays-chain without relays', plain, figures(plain));
  expect(summary.completed).toBe(SEEDS.length);
  expect(without.completed).toBe(SEEDS.length);
  expect(summary.thawedByBurst).toBeGreaterThan(summary.thawedByMatch + summary.thawedByBonus);
}, 240000);

it('Tidal pearls: pearls on both sides of the seam and one order', () => {
  const level = prototypeConfig('tidal-pearls-pairs');
  const [order] = level.oreOrders;
  const runs = play(level, (step, { turn }, run) => {
    run.ore =
      (run.ore ?? 0) + (step.collectedJewels ?? []).filter((j) => j.type === order.color).length;
    if (run.ore >= order.target) run.orderFilled ??= turn;
  });
  const summary = summarize('tidal-pearls-pairs', runs, {
    medianFirstDelivery: median(runs.map(({ delivered }) => delivered[0])),
    medianLastDelivery: median(runs.map(({ delivered }) => delivered.at(-1))),
    medianOrderFilled: median(runs.map((run) => run.orderFilled)),
    orderLast: runs.filter((run) => run.orderFilled > run.delivered.at(-1)).length,
  });
  expect(summary.completed).toBe(SEEDS.length);
}, 120000);

it('Rooted vault: the knots hold the chamber shut', () => {
  const level = prototypeConfig('rooted-vault-knots');
  const knots = cellsWhere(level, (tile) => tile.rootKnot);
  const figures = (runs) => ({
    medianKnotsCut: knots.length ? median(runs.map(lastDone(knots))) : null,
    medianChamberOpens: median(runs.map(({ opened }) => opened.a)),
    openedAfterKnots: knots.length
      ? runs.filter((run) => run.opened.a > lastDone(knots)(run)).length
      : null,
  });
  const runs = play(level);
  const summary = summarize('rooted-vault-knots', runs, figures(runs));
  const free = play(
    edited(
      'rooted-vault-knots',
      {
        ...board('rooted-vault-knots').level,
        board: '......./......./......./......./......./......./__WWW__/......./.c.c.c./.......',
      },
      'twins',
    ),
  );
  const without = summarize('rooted-vault-knots without roots', free, figures(free));
  expect(summary.completed).toBe(SEEDS.length);
  expect(without.completed).toBe(SEEDS.length);
  expect(summary.medianChamberOpens).toBeGreaterThan(without.medianChamberOpens);
}, 240000);

it('The far seam: either way out, through either shaft', () => {
  const level = prototypeConfig('far-seam-either-way');
  const walls = cellsWhere(level, (tile) => tile.waist);
  const runs = play(level, (step, context, run) => {
    for (const update of step.tileUpdates ?? []) {
      if (update.health == null || !walls.includes(update.index)) continue;
      run.wallHits = (run.wallHits ?? 0) + 1;
      if (step.lensBeams?.some((beam) => beam.cells.includes(update.index)))
        run.prismHits = (run.prismHits ?? 0) + 1;
    }
  });
  // A floatstone goes against gravity: it leaves through the floor once the dial has turned.
  const ways = runs.map((run) => (run.deliveredUp[0] ? 'down' : 'up'));
  const summary = summarize('far-seam-either-way', runs, {
    wayUp: ways.filter((way) => way === 'up').length,
    wayDown: ways.filter((way) => way === 'down').length,
    runsWithoutFlip: runs.filter(({ flips }) => !flips.length).length,
    medianDelivery: median(runs.map(({ delivered }) => delivered[0])),
    shaftFirst: runs.filter(({ opened }) => opened.a != null && !(opened.b < opened.a)).length,
    floorFirst: runs.filter(({ opened }) => opened.b != null && !(opened.a <= opened.b)).length,
    wallHits: sum(runs.map((run) => run.wallHits ?? 0)),
    prismWallHits: sum(runs.map((run) => run.prismHits ?? 0)),
  });
  expect(summary.completed).toBe(SEEDS.length);
  expect(summary.wayUp).toBeGreaterThan(0);
  expect(summary.wayDown).toBeGreaterThan(0);
  expect(summary.prismWallHits).toBeGreaterThan(0);
}, 120000);
