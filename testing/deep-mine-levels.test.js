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
import { HintEngine } from '../src/game/engine/HintEngine';
import { PlayClock } from '../src/game/engine/PlayClock';
import { layerCount, neighborsOf } from '../src/game/engine/TileRules';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';
import { simulateCampaignLevel } from './helpers/campaignSimulation';

const FIRST = 373;
const levels = generateLevelConfigs();
const deep = levels.slice(FIRST - 1);
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
      'fossil-beds',
      'glowshroom-grotto',
      'root-bound-vault',
      'underground-reservoir',
      'geothermal-forge',
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

  it('keeps every target reachable on familiar five-color boards without move or time caps', () => {
    for (const level of deep) {
      const { tiles, boardCols: cols, boardRows: rows } = level;
      expect([cols, rows, level.boardLayout.gemTypes.length]).toEqual([7, 9, 5]);
      for (const index of [0, cols - 1, cols * (rows - 1), cols * rows - 1])
        expect(layerCount(tiles[index]), `level ${level.id} clear corner`).toBe(0);
      for (let y = 0; y < rows; y++)
        for (const x of [0, cols - 1]) expect(tiles[y * cols + x].type).toBe('standard');
      for (const tile of tiles) expect(tile.health).toBeLessThanOrEqual(2);
      expect(tiles.slice(-2 * cols).every((tile) => layerCount(tile) === 0)).toBe(true);
      expect(level.objectives[0].target).toBe(
        tiles.reduce((sum, tile) => sum + layerCount(tile), 0),
      );
      level.board.forEach((gem, index) => {
        if (gem?.type === 'relic')
          expect(tiles[(rows - 1) * cols + (index % cols)].exit).toBe(true);
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

  it('teaches each new rule alone and keeps later combinations to two featured mechanics', () => {
    for (const id of [373, 385]) {
      const level = levels[id - 1];
      const progress = deepMineProgress(level.tiles);
      expect(progress.fossils.total + progress.roots.total).toBe(1);
      expect(level.tiles.some((tile) => tile.signal || tile.sealColor)).toBe(false);
      expect(level.board.some((gem) => gem?.type === 'relic')).toBe(false);
      expect(level.tiles.filter((tile) => tile.type === 'blocker' && !tile.rootKnot)).toEqual([]);
    }
    expect(
      levels[372].tiles.filter((tile) => tile.fossilGroup).every((tile) => tile.health === 1),
    ).toBe(true);
    expect(levels[384].tiles.find((tile) => tile.rootKnot).health).toBe(1);
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
        expect(fossil.cells).toHaveLength(4);
        expect(fossil.cells.map((cell) => level.tiles[cell].fossilPart)).toEqual([0, 1, 2, 3]);
        expect(new Set(fossil.cells.map((cell) => level.tiles[cell].fossilGroup)).size).toBe(1);
        expect(fossil.cells.every((cell) => level.tiles[cell].maxHealth === fossil.layers)).toBe(
          true,
        );
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
  // Held-out refill seeds; the authored star calibration uses seeds 1–30.
  // All finite budgets below are diagnostics, never rules imposed on a player.
  const runs = new Map(
    deep.map((level) => [
      level.id,
      Array.from({ length: 10 }, (_, i) => simulateCampaignLevel(level, 101 + i)),
    ]),
  );
  const priorRuns = levels
    .slice(360, 372)
    .flatMap((level) =>
      Array.from({ length: 10 }, (_, i) => simulateCampaignLevel(level, 101 + i)),
    );
  it.each(deep.map(({ id }) => [id]))('finishes level %i on every held-out seed', (id) => {
    for (const run of runs.get(id)) {
      expect(run).toMatchObject({ remaining: false, layers: 0, relics: 0, ore: 0 });
      expect(run.turns).toBeLessThanOrEqual(100);
      expect(run.shuffles).toBeLessThanOrEqual(4);
    }
  });

  it('raises late-campaign difficulty while preserving short introductions and chapter breathers', () => {
    const ordinaryIds = deep
      .filter(({ id }) => ![373, 385].includes(id) && (id - 1) % 6 !== 4)
      .map(({ id }) => id);
    const ordinaryTurns = ordinaryIds.flatMap((id) => runs.get(id).map(({ turns }) => turns));
    expect(median(ordinaryTurns)).toBeGreaterThan(median(priorRuns.map(({ turns }) => turns)));
    expect(median(ordinaryTurns)).toBeLessThanOrEqual(35);
    const all = sorted([...runs.values()].flat().map(({ turns }) => turns));
    expect(all[Math.ceil(all.length * 0.9) - 1]).toBeLessThanOrEqual(55);
    for (const id of [373, 385])
      expect(median(runs.get(id).map(({ turns }) => turns))).toBeLessThanOrEqual(18);
    for (let chapter = 0; chapter < 5; chapter++) {
      const rest = deep[chapter * 6 + 4],
        finale = deep[chapter * 6 + 5];
      expect(rest.objectives[0].target).toBeLessThan(finale.objectives[0].target);
      expect(median(runs.get(rest.id).map(({ turns }) => turns))).toBeLessThan(
        median(runs.get(finale.id).map(({ turns }) => turns)),
      );
    }
  });

  it.each([373, 378, 385, 390, 394, 400, 402])(
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
