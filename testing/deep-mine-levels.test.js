import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { markRaw } from 'vue';
import { CHAPTERS, LEVEL_COUNT } from '../src/data/campaign';
import { LEVEL_NAMES } from '../src/data/levelNames';
import { STAR_SCORE_TARGETS } from '../src/data/starScoreTargets';
import {
  DEEP_MINE_CHAPTERS,
  DEEP_MINE_LEVELS,
  parseDeepMineBoard,
} from '../src/data/deepMineLevels';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { deepMineProgress } from '../src/game/engine/DeepMineMechanics';
import { gravityDestination, isPlayableCell } from '../src/game/engine/BoardTopology';
import { HintEngine } from '../src/game/engine/HintEngine';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { TileManager } from '../src/game/engine/TileManager';
import { PlayClock } from '../src/game/engine/PlayClock';
import { BOARD_BONUSES, layerCount, neighborsOf } from '../src/game/engine/TileRules';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';
import { simulateCampaignLevel } from './helpers/campaignSimulation';

const FIRST = 373;
const levels = generateLevelConfigs();
const deep = levels.slice(FIRST - 1);
const themed = (theme) => deep.filter((level) => level.theme === theme);
const firstOfTheme = (theme) => themed(theme)[0];
const introductions = ['fossil-beds', 'root-bound-vault'].map(firstOfTheme);
const hints = new HintEngine();
const sorted = (values) => [...values].sort((a, b) => a - b);
const median = (values) => sorted(values)[Math.floor(values.length / 2)];

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
});

describe('append-only deep mine campaign', () => {
  it('preserves all original 372 configurations, seeds, names, rewards and stars', () => {
    // Docker capture immediately before this append. Normalize random gem ids only.
    const original = generateLevelConfigs(372).map(({ board, ...level }) => ({
      ...level,
      board: board.map((gem) => (gem ? gem.type : null)),
    }));
    const payload = JSON.stringify({
      levels: original,
      stars: STAR_SCORE_TARGETS.slice(0, 372),
      names: LEVEL_NAMES.slice(0, 372),
      chapters: CHAPTERS.slice(0, 62),
    });
    expect(createHash('sha256').update(payload).digest('hex')).toBe(
      '76ddbc0d83aa3f68a58242986a01de2406b98cbb7feb9aad8d8aac70a5e610cf',
    );
  });

  it('adds exactly five named six-puzzle groups, ending at level 402', () => {
    expect(LEVEL_COUNT).toBe(402);
    expect(CHAPTERS.slice(62)).toEqual(DEEP_MINE_CHAPTERS);
    expect(DEEP_MINE_CHAPTERS.map(({ id }) => id)).toEqual([
      'geothermal-forge',
      'fossil-beds',
      'glowshroom-grotto',
      'root-bound-vault',
      'underground-reservoir',
    ]);
    expect(DEEP_MINE_LEVELS).toHaveLength(30);
    expect(deep.map(({ id }) => id)).toEqual(Array.from({ length: 30 }, (_, i) => FIRST + i));
    expect(LEVEL_NAMES).toHaveLength(LEVEL_COUNT);
    expect(new Set(LEVEL_NAMES).size).toBe(LEVEL_COUNT);
    expect(STAR_SCORE_TARGETS).toHaveLength(LEVEL_COUNT);
    for (const level of deep) {
      expect(LEVEL_NAMES[level.id - 1].startsWith(`${level.chapterName}: `)).toBe(true);
      expect(level.starScoreTarget).toBe(STAR_SCORE_TARGETS[level.id - 1]);
      expect(level.starScoreTarget).toBeGreaterThan(0);
      expect(level.pace).toBe(
        ['explore', 'explore', 'explore', 'explore', 'rest', 'finale'][(level.id - 1) % 6],
      );
    }
  });

  it('teaches braziers before introducing fossils and gives the first bed a familiar bomb source', () => {
    const forge = themed('geothermal-forge');
    const fossil = firstOfTheme('fossil-beds');
    expect(forge.map(({ id }) => id)).toEqual([373, 374, 375, 376, 377, 378]);
    expect(fossil.id).toBe(379);
    for (const level of deep.filter(({ id }) => id < fossil.id)) {
      expect(level.tiles.some((tile) => tile.signal === 'core')).toBe(true);
      expect(deepMineProgress(level.tiles).fossils.total).toBe(0);
    }
    expect(fossil.tiles.flatMap((tile, index) => (tile.signal === 'core' ? [index] : []))).toEqual([
      23,
    ]);
    expect(fossil.tiles[23]).toMatchObject({ coreCharges: 4, signalHealth: 4, coreBonus: 'bomb' });
    expect(DEEP_MINE_LEVELS[fossil.id - FIRST].fossils[0]).toMatchObject({
      cells: [30, 31, 37, 38],
      layers: 1,
      encased: true,
    });
    expect(fossil.tip).toContain('familiar brazier');
  });

  it('earns and uses the supported first-fossil brazier bomb through four natural legal matches', () => {
    const level = firstOfTheme('fossil-beds');
    const tiles = level.tiles.map((tile) => ({ ...tile }));
    let board = level.board.map((gem) => (gem ? { ...gem } : null));
    const engine = new MatchEngine();
    const manager = new TileManager();
    let random = 379373;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      random = (random * 16807) % 2147483647;
      return (random - 1) / 2147483646;
    });
    const resolve = (evaluation) =>
      manager.getResolution({
        ...evaluation,
        tiles,
        cols: 7,
        rows: 9,
        gemTypes: level.boardLayout.gemTypes,
      });
    // The authored starting board and natural refills are used unchanged.
    // No palette replacement, inventory power, free stock bonus or reshuffle.
    const swaps = [
      [16, 17],
      [9, 16],
      [21, 22],
      [10, 11],
    ];
    for (const [turn, [a, b]] of swaps.entries()) {
      expect(BOARD_BONUSES).not.toContain(board[a]?.type);
      expect(BOARD_BONUSES).not.toContain(board[b]?.type);
      const evaluation = engine.evaluateSwap(board, 7, 9, a, b, tiles);
      expect(evaluation.matches.length).toBeGreaterThan(0);
      const result = resolve(evaluation);
      board = result.board;
      expect(tiles[23].signalHealth).toBe(3 - turn);
      expect([30, 31, 37, 38].map((index) => tiles[index].health)).toEqual([1, 1, 1, 1]);
      if (turn === 3) {
        expect(result.steps.flatMap((step) => step.bonuses)).toContainEqual(
          expect.objectContaining({ type: 'bomb', index: 23, core: 23 }),
        );
        expect(board[23]?.type).toBe('bomb');
        expect(tiles[30]).toMatchObject({ type: 'blocker', health: 1, bonusOnly: true });
      }
    }
    const activation = engine.evaluateActivation(board, 7, 9, 23, tiles);
    expect(activation.matches[0].indices).toEqual(expect.arrayContaining([30, 31]));
    resolve(activation);
    expect([30, 31, 37, 38].map((index) => tiles[index].health)).toEqual([0, 0, 1, 1]);
    expect(deepMineProgress(tiles).fossils).toEqual({ total: 1, completed: 0 });
  });

  it('retains the published accounting thresholds for every redesigned level', () => {
    // Captured from the immutable first-expansion snapshot, not the working tree.
    const payload = JSON.stringify(
      deep.map(({ id, chestTarget, speedTargetMs, starScoreTarget }) => ({
        id,
        chestTarget,
        speedTargetMs,
        starScoreTarget,
      })),
    );
    expect(createHash('sha256').update(payload).digest('hex')).toBe(
      'af6ea754de5c2b341fdd2213763d55926ac4628335c6c846201c8faf1490933d',
    );
  });

  it('keeps open crafting space above permanent shaped walls without move or time caps', () => {
    for (const level of deep) {
      const { tiles, boardCols: cols, boardRows: rows } = level;
      expect([cols, rows, level.boardLayout.gemTypes.length]).toEqual([7, 9, 5]);
      expect(tiles.slice(0, 4 * cols).every((tile) => tile.type === 'standard')).toBe(true);
      expect(tiles.some((tile) => !isPlayableCell(tile))).toBe(true);
      for (const tile of tiles) expect(tile.health).toBeLessThanOrEqual(2);
      expect(level.objectives[0].target).toBe(
        tiles.reduce((sum, tile) => sum + layerCount(tile), 0),
      );
      level.board.forEach((gem, index) => {
        const tile = tiles[index];
        if (!isPlayableCell(tile) || tile.type === 'blocker') expect(gem).toBeNull();
        else expect(gem).not.toBeNull();
        if (!isPlayableCell(tile)) expect(layerCount(tile)).toBe(0);
        expect(['bomb', 'cross', 'rainbow']).not.toContain(gem?.type);
      });
      for (const tile of tiles) {
        if (tile.signal === 'core') {
          expect(tile.type).toBe('standard');
          expect(tile.chainHealth ?? 0).toBe(0);
          expect(tile.coreBonus).toBe('bomb');
          expect([4, 5]).toContain(tile.coreCharges);
        }
      }
      expect(level.maxMoves).toBeUndefined();
      expect(level.moveLimit).toBeUndefined();
      expect(level.timeLimitMs).toBeUndefined();
      expect(level.objectives.some(({ type }) => type === 'moves' || type === 'time')).toBe(false);
    }
  });

  it('funnels every pearl through one mandatory blast gate to one bottom exit', () => {
    const reservoirs = deep.filter(({ theme }) => theme === 'underground-reservoir');
    expect(reservoirs).toHaveLength(6);
    for (const level of reservoirs) {
      const { tiles, board, boardCols: cols, boardRows: rows } = level;
      expect(
        Array.from(
          { length: rows },
          (_, row) => tiles.slice(row * cols, (row + 1) * cols).filter(isPlayableCell).length,
        ),
      ).toEqual([7, 7, 7, 7, 7, 5, 3, 1, 1]);
      expect(tiles.flatMap((tile, index) => (tile.exit ? [index] : []))).toEqual([59]);
      expect(tiles[52]).toMatchObject({ type: 'blocker', bonusOnly: true });
      expect(tiles[52].health).toBeGreaterThan(0);
      for (let origin = 0; origin < board.length; origin++) {
        if (board[origin]?.type !== 'relic') continue;
        const route = [origin];
        for (let index = origin; ;) {
          const target = gravityDestination(tiles, index, cols, rows);
          if (target < 0) break;
          expect(Math.floor(target / cols)).toBe(Math.floor(index / cols) + 1);
          expect(Math.abs((target % cols) - (index % cols))).toBeLessThanOrEqual(1);
          route.push(target);
          index = target;
        }
        expect(route).toContain(52);
        expect(route.at(-1)).toBe(59);
      }
    }
  });

  it('requires earned board bonuses even after every one-shot spore relay fires', () => {
    for (const level of deep) {
      const relays = level.tiles.flatMap((tile, index) =>
        tile.signal === 'spore' ? [{ tile, index }] : [],
      );
      expect(
        level.tiles.some((tile, index) => {
          if (!tile.bonusOnly || !tile.health) return false;
          const freeHits = relays.filter(({ tile: relay, index: source }) =>
            relay.sporeAxis === 'row'
              ? Math.floor(source / 7) === Math.floor(index / 7)
              : source % 7 === index % 7,
          ).length;
          return tile.health > freeHits;
        }),
        `level ${level.id} needs a direct special hit`,
      ).toBe(true);
    }
  });

  it('can craft a four-match bonus in every upper field without inventory powers', () => {
    const engine = new MatchEngine();
    for (const level of deep) {
      const colors = level.boardLayout.gemTypes;
      const board = level.board.map((gem, index) =>
        gem && gem.type !== 'relic'
          ? { ...gem, type: colors[((index % 7) + Math.floor(index / 7)) % colors.length] }
          : gem,
      );
      for (const index of [10, 15, 16, 18]) board[index] = { ...board[index], type: colors[0] };
      for (const index of [14, 19]) board[index] = { ...board[index], type: colors[2] };
      board[17] = { ...board[17], type: colors[1] };
      const result = engine.evaluateSwap(board, 7, 9, 10, 17, level.tiles);
      expect(result.bonuses).toContainEqual(expect.objectContaining({ index: 17, type: 'bomb' }));
    }
  });

  it('introduces new rules with familiar support and keeps combinations to two featured mechanics', () => {
    for (const level of introductions) {
      const progress = deepMineProgress(level.tiles);
      expect(progress.fossils.total + progress.roots.total).toBe(1);
      expect(
        level.tiles.some((tile) => tile.sealColor || (tile.signal && tile.signal !== 'core')),
      ).toBe(false);
      if (level.theme === 'root-bound-vault')
        expect(level.tiles.some((tile) => tile.signal)).toBe(false);
      expect(level.board.some((gem) => gem?.type === 'relic')).toBe(false);
      expect(
        level.tiles.every((tile) => tile.type !== 'blocker' || tile.rootKnot || tile.bonusOnly),
      ).toBe(true);
    }
    expect(
      firstOfTheme('fossil-beds')
        .tiles.filter((tile) => tile.fossilGroup)
        .every((tile) => tile.health === 1),
    ).toBe(true);
    expect(firstOfTheme('root-bound-vault').tiles.find((tile) => tile.rootKnot).health).toBe(1);
    for (const level of deep) {
      const featured = new Set();
      for (const tile of level.tiles) {
        if (tile.fossilGroup) featured.add('fossil');
        if (tile.rootGroup) featured.add('root');
        if (tile.signal) featured.add(tile.signal);
        if (tile.sealColor) featured.add('seal');
        if (tile.chainHealth && !tile.rootGroup) featured.add('chain');
      }
      if (level.board.some((gem) => gem?.type === 'relic')) featured.add('delivery');
      expect(featured.size, `level ${level.id} keeps its rules focused`).toBeLessThanOrEqual(2);
    }
  });

  it('authors four-piece fossil squares and short, visible root connections', () => {
    for (const [index, spec] of DEEP_MINE_LEVELS.entries()) {
      const level = deep[index];
      for (const fossil of spec.fossils) {
        expect(fossil.encased).toBe(true);
        expect(fossil.cells).toHaveLength(4);
        expect(fossil.cells.map((cell) => level.tiles[cell].fossilPart)).toEqual([0, 1, 2, 3]);
        expect(new Set(fossil.cells.map((cell) => level.tiles[cell].fossilGroup)).size).toBe(1);
        expect(fossil.cells.every((cell) => level.tiles[cell].maxHealth === fossil.layers)).toBe(
          true,
        );
        expect(
          fossil.cells.every(
            (cell) => level.tiles[cell].bonusOnly && level.tiles[cell].type === 'blocker',
          ),
        ).toBe(true);
        expect(fossil.cells.every((cell) => level.board[cell] === null)).toBe(true);
      }
      for (const root of spec.roots) {
        expect(level.board[root.knot]).toBeNull();
        expect(level.tiles[root.knot].rootKnot).toBe(true);
        for (const binding of root.bindings) {
          expect(neighborsOf(root.knot, 7, 9)).toContain(binding);
          expect(level.tiles[binding].rootGroup).toBe(level.tiles[root.knot].rootGroup);
        }
      }
    }
  });

  it('rejects broken footprints and disconnected roots instead of publishing confusing targets', () => {
    const blank = Array(9).fill('.......').join('/');
    const authored = (placements) => {
      const cells = Array(63).fill('.');
      for (const [index, symbol] of placements) cells[index] = symbol;
      return Array.from({ length: 9 }, (_, row) => cells.slice(row * 7, row * 7 + 7).join('')).join(
        '/',
      );
    };
    expect(parseDeepMineBoard(blank)).toMatchObject({
      fossils: [],
      roots: [],
      cores: [],
      signals: [],
      spores: [],
    });
    expect(() => parseDeepMineBoard('.......')).toThrow('7 × 9');
    expect(() => parseDeepMineBoard(authored([[12, '?']]))).toThrow('Unknown');
    expect(() => parseDeepMineBoard(authored([[12, '1']]))).toThrow('2 × 2');
    expect(() =>
      parseDeepMineBoard(
        authored([
          [6, '1'],
          [7, '1'],
          [13, '1'],
          [14, '1'],
        ]),
      ),
    ).toThrow('2 × 2');
    expect(() =>
      parseDeepMineBoard(
        authored([
          [12, 'k'],
          [26, 'K'],
        ]),
      ),
    ).toThrow('connect directly');
    expect(() => parseDeepMineBoard(authored([[12, 'K']]))).toThrow('connect directly');
    expect(() =>
      parseDeepMineBoard(
        authored([
          [12, 'k'],
          [19, 'k'],
        ]),
      ),
    ).toThrow('one knot');
  });
});

describe('deep mine completion and pacing', () => {
  // Held-out refill seeds independent of the ten-seed shape measurements.
  // All finite budgets below are diagnostics, never rules imposed on a player.
  const runs = new Map();
  const measure = (id) => {
    if (!runs.has(id))
      runs.set(
        id,
        Array.from({ length: 10 }, (_, i) => simulateCampaignLevel(levels[id - 1], 101 + i)),
      );
    return runs.get(id);
  };
  const priorRuns = () =>
    levels
      .slice(360, 372)
      .flatMap((level) =>
        Array.from({ length: 10 }, (_, i) => simulateCampaignLevel(level, 101 + i)),
      );
  it.each(deep.map(({ id }) => [id]))('finishes level %i on every held-out seed', (id) => {
    for (const run of measure(id)) {
      expect(run).toMatchObject({ remaining: false, layers: 0, relics: 0, ore: 0 });
      const level = levels[id - 1];
      expect(run.blastOnlyHits).toBe(
        level.tiles.reduce((sum, tile) => sum + (tile.bonusOnly ? tile.health : 0), 0),
      );
      expect(run.boardBonusMoves).toBeGreaterThan(0);
      expect(run.craftedBonuses + run.coreBonuses).toBeGreaterThan(0);
      if (level.theme === 'underground-reservoir')
        expect(run.diagonalPearlDrops).toBeGreaterThan(0);
      expect(run.turns).toBeLessThanOrEqual(180);
      expect(run.shuffles).toBeLessThanOrEqual(8);
    }
  });

  // A diagnostic simulation of 300+ runs: the default 5 s is too tight in a parallel suite.
  it('raises late-campaign difficulty while preserving short introductions and chapter breathers', () => {
    const ordinaryIds = deep
      .filter(({ id }) => !introductions.some((level) => level.id === id) && (id - 1) % 6 !== 4)
      .map(({ id }) => id);
    const ordinaryTurns = ordinaryIds.flatMap((id) => measure(id).map(({ turns }) => turns));
    expect(median(ordinaryTurns)).toBeGreaterThan(median(priorRuns().map(({ turns }) => turns)));
    expect(median(ordinaryTurns)).toBeLessThanOrEqual(55);
    const all = sorted(deep.flatMap(({ id }) => measure(id).map(({ turns }) => turns)));
    expect(all[Math.ceil(all.length * 0.9) - 1]).toBeLessThanOrEqual(90);
    for (const { id } of introductions)
      expect(median(measure(id).map(({ turns }) => turns))).toBeLessThanOrEqual(30);
    for (let chapter = 0; chapter < 5; chapter++) {
      const rest = deep[chapter * 6 + 4],
        finale = deep[chapter * 6 + 5];
      expect(rest.objectives[0].target).toBeLessThan(finale.objectives[0].target);
      expect(median(measure(rest.id).map(({ turns }) => turns))).toBeLessThan(
        median(measure(finale.id).map(({ turns }) => turns)),
      );
    }
  }, 30_000);

  it.each([
    firstOfTheme('fossil-beds').id,
    themed('fossil-beds').at(-1).id,
    firstOfTheme('root-bound-vault').id,
    themed('root-bound-vault').at(-1).id,
    themed('underground-reservoir')[3].id,
    themed('geothermal-forge')[3].id,
    themed('geothermal-forge').at(-1).id,
  ])(
    'completes level %i through normal play beyond 100 moves after its speed target elapsed',
    async (id) => {
      let random = id * 7919;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        random = (random * 16807) % 2147483647;
        return (random - 1) / 2147483646;
      });
      const campaign = useCampaignStore();
      campaign.records = Object.fromEntries(
        Array.from({ length: id - 1 }, (_, i) => [i + 1, { score: 1, stars: 1 }]),
      );
      const game = useGameStore();
      let now = 0;
      game.playClock = markRaw(new PlayClock(() => now));
      game.bootstrap();
      game.startLevel(id);
      expect(game.currentLevelId).toBe(id);
      game.moves = 100;
      game.syncRunClock(true);
      now = game.speedTargetMs + 60000;
      for (let turn = 0; turn < 400 && !game.levelCleared; turn++) {
        const move = hints.findBestMove(game.board, game.tiles, game.boardCols, game.boardRows, {
          oreOrders: game.oreOrders,
        });
        if (!move) {
          expect(await game.ensurePlayableBoard()).toBe(true);
          continue;
        }
        expect(
          await game.resolveSwap(move.swap.aIndex, move.swap.bIndex, {
            activateInPlace: !!move.activateInPlace,
          }),
        ).toBe(true);
      }
      expect(game.levelCleared).toBe(true);
      expect(game.moves).toBeGreaterThan(100);
      expect(game.elapsedMs).toBeGreaterThan(game.speedTargetMs);
      expect(game.tiles.every((tile) => layerCount(tile) === 0)).toBe(true);
      const progress = deepMineProgress(game.tiles);
      expect(progress.fossils.completed).toBe(progress.fossils.total);
      expect(progress.roots.completed).toBe(progress.roots.total);
      expect(game.levelRewards.length).toBeGreaterThan(0);
      expect(campaign.records[id]).toBeTruthy();
    },
    30000,
  );
});
