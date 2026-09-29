import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { markRaw } from 'vue';
import { CHAPTERS, LEVEL_COUNT } from '../src/data/campaign';
import { LEVEL_NAMES } from '../src/data/levelNames';
import { STAR_SCORE_TARGETS } from '../src/data/starScoreTargets';
import { obstaclesInLevel, OBSTACLES } from '../src/data/obstacles';
import { TOMORROW_CHAPTERS, TOMORROW_LEVELS, parseTomorrowBoard } from '../src/data/tomorrowLevels';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { CORE_CHARGES, coreReleaseTarget } from '../src/game/engine/ChapterMechanics';
import { createGem, GEM_TYPES } from '../src/game/engine/GemFactory';
import { HintEngine } from '../src/game/engine/HintEngine';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { TileManager } from '../src/game/engine/TileManager';
import { recoverBoard } from '../src/game/engine/BoardRecovery';
import { PlayClock } from '../src/game/engine/PlayClock';
import { canSwapGem, layerCount } from '../src/game/engine/TileRules';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';
import { simulateCampaignLevel } from './helpers/campaignSimulation';

const FIRST = 325;
const levels = generateLevelConfigs();
const tomorrow = levels.slice(FIRST - 1);
const manager = new TileManager();
const hints = new HintEngine();

// A 5 × 5 board without any passive match: stripes of five colors.
const makeBoard = () => {
  const board = Array.from({ length: 25 }, (_, index) =>
    createGem(GEM_TYPES[((index % 5) + Math.floor(index / 5) * 2) % 5]),
  );
  return {
    board,
    tiles: board.map(() => ({ type: 'standard', health: 0, maxHealth: 0 })),
    cols: 5,
    rows: 5,
  };
};
const core = (charges = CORE_CHARGES, coreBonus = 'cross') => ({
  type: 'standard',
  health: 0,
  maxHealth: 0,
  signal: 'core',
  signalHealth: charges,
  coreBonus,
});
const hit = (state, indices, type = 'ruby') =>
  manager.getResolution({ ...state, matches: [{ type, indices }] });

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('append-only Tomorrow City campaign', () => {
  it('keeps the existing 324 levels, names, chapters and star targets byte-for-byte stable', () => {
    // Captured from feat/future-era before the Tomorrow chapters were appended, then
    // re-captured when the unused chapter descriptions were deleted (nothing else changed).
    const original = generateLevelConfigs(324).map(({ board, ...level }) => ({
      ...level,
      board: board.map((gem) => (gem ? gem.type : null)),
    }));
    const payload = JSON.stringify({
      levels: original,
      stars: STAR_SCORE_TARGETS.slice(0, 324),
      names: LEVEL_NAMES.slice(0, 324),
      chapters: CHAPTERS.slice(0, 54),
    });
    expect(createHash('sha256').update(payload).digest('hex')).toBe(
      '6120d58cb172d53849dd7887096755d41ddba0ed3020d53da692f967377eb97d',
    );
  });

  it('appends eight six-level chapters as levels 325–372 with names, themes and star targets', () => {
    expect(LEVEL_COUNT).toBe(372);
    expect(CHAPTERS.slice(54)).toEqual(TOMORROW_CHAPTERS);
    expect(TOMORROW_CHAPTERS).toHaveLength(8);
    expect(TOMORROW_LEVELS).toHaveLength(48);
    expect(tomorrow.map((level) => level.id)).toEqual(
      Array.from({ length: 48 }, (_, i) => FIRST + i),
    );
    expect(LEVEL_NAMES).toHaveLength(LEVEL_COUNT);
    expect(STAR_SCORE_TARGETS).toHaveLength(LEVEL_COUNT);
    expect(new Set(LEVEL_NAMES).size).toBe(LEVEL_COUNT);
    for (const level of tomorrow) {
      const chapter = TOMORROW_CHAPTERS[Math.floor((level.id - FIRST) / 6)];
      expect(level.chapterName).toBe(chapter.name);
      expect(level.theme).toBe(chapter.id);
      expect(LEVEL_NAMES[level.id - 1].startsWith(`${chapter.name}: `)).toBe(true);
      expect(level.starScoreTarget).toBe(STAR_SCORE_TARGETS[level.id - 1]);
      expect(level.starScoreTarget).toBeGreaterThan(0);
      expect(level.pace).toBe(
        ['explore', 'explore', 'explore', 'explore', 'rest', 'finale'][(level.id - 1) % 6],
      );
    }
  });

  it('follows the layout guardrails and never introduces a move or time limit', () => {
    for (const level of tomorrow) {
      const { tiles, boardCols: cols, boardRows: rows } = level;
      const at = (x, y) => tiles[y * cols + x];
      const cores = tiles.flatMap((tile, index) => (tile.signal === 'core' ? [index] : []));
      expect(cores.length, `level ${level.id} has a charge core`).toBeGreaterThan(0);
      for (const index of cores) {
        const tile = tiles[index];
        expect(tile.type).toBe('standard');
        expect(tile.chainHealth ?? 0).toBe(0);
        expect(tile.exit).toBeFalsy();
        expect(level.board[index].type).not.toBe('relic');
        // Chapter 55 teaches three-charge cores; later chapters need four or five.
        expect(tile.coreCharges).toBe(level.id <= 330 ? 3 : level.id <= 360 ? 4 : 5);
        expect(tile.signalHealth).toBe(tile.coreCharges);
        expect(['cross', 'bomb']).toContain(tile.coreBonus);
        if (level.id > FIRST) expect(tile.coreBonus).toBe('bomb');
      }
      for (const [x, y] of [
        [0, 0],
        [cols - 1, 0],
        [0, rows - 1],
        [cols - 1, rows - 1],
      ])
        expect(layerCount(at(x, y)), `level ${level.id} corner`).toBe(0);
      for (let y = 0; y < rows; y++)
        for (const x of [0, cols - 1]) expect(at(x, y).type).toBe('standard');
      for (const tile of tiles) expect(tile.type === 'blocker' || tile.health <= 2).toBe(true);
      expect(tiles.slice(-2 * cols).every((tile) => tile.health === 0)).toBe(true);
      // Every relic has an exit directly below it in its own column.
      level.board.forEach((gem, index) => {
        if (gem?.type === 'relic')
          expect(tiles[(rows - 1) * cols + (index % cols)].exit).toBe(true);
      });
      for (const order of level.oreOrders)
        expect(level.boardLayout.gemTypes).toContain(order.color);
      for (const tile of tiles)
        if (tile.sealColor) expect(level.boardLayout.gemTypes).toContain(tile.sealColor);
      expect(level.objectives[0].target).toBe(
        tiles.reduce((sum, tile) => sum + layerCount(tile), 0),
      );
      expect(level.objectives.map((objective) => objective.type)).not.toContain('moves');
      expect(level.maxMoves).toBeUndefined();
      expect(level.moveLimit).toBeUndefined();
      expect(level.timeLimitMs).toBeUndefined();
    }
  });

  it('introduces the charge core alone on an open board with a small objective', () => {
    const [intro] = tomorrow;
    const seen = OBSTACLES.map((item) => item.id).filter((id) => id !== 'charge-core');
    expect(
      obstaclesInLevel(intro.tiles)
        .map((item) => item.id)
        .filter((id) => !seen.includes(id)),
    ).toEqual(['charge-core']);
    expect(intro.tiles.filter((tile) => tile.signal === 'core')).toHaveLength(1);
    expect(
      intro.tiles.some((tile) => tile.type === 'blocker' || tile.chainHealth || tile.sealColor),
    ).toBe(false);
    expect(intro.oreOrders).toEqual([]);
    expect(intro.objectives[0].target).toBeLessThan(
      Math.min(...tomorrow.slice(1, 6).map((level) => level.objectives[0].target)),
    );
    expect(intro.tip).toMatch(/charge core/);
  });

  it('rejects malformed authored boards instead of guessing a layout', () => {
    expect(() => parseTomorrowBoard('.......')).toThrow('7 × 9');
    expect(parseTomorrowBoard(Array(9).fill('.......').join('\n'))).toMatchObject({
      cores: [],
      signals: [],
      survey: false,
    });
  });
});

describe('charge core resolution', () => {
  beforeEach(() => {
    // Isolate each move; real cascades are covered by the playthroughs below.
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
  });

  it('gains one charge per move from a match on or beside it and ignores diagonals', () => {
    const state = makeBoard();
    state.tiles[12] = core();
    hit(state, [1, 2, 3]);
    expect(state.tiles[12].signalHealth).toBe(3);
    hit(state, [6, 8, 16]);
    expect(state.tiles[12].signalHealth).toBe(3);
    const result = hit(state, [10, 11]);
    expect(state.tiles[12].signalHealth).toBe(2);
    expect(result.layersCleared).toBe(1);
    expect(result.steps[0].tileUpdates).toContainEqual({ index: 12, signalHealth: 2 });
  });

  it('charges at most once per move even when a cascade touches it again', () => {
    vi.restoreAllMocks();
    const state = makeBoard();
    state.tiles[12] = core();
    let calls = 0;
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockImplementation(() =>
      calls++ < 2 ? [{ type: 'ruby', indices: [11, 16, 21] }] : [],
    );
    const result = hit(state, [7, 12, 17]);
    expect(result.steps.filter((step) => step.cleared.length).length).toBeGreaterThan(1);
    expect(state.tiles[12].signalHealth).toBe(2);
    expect(result.layersCleared).toBe(1);
  });

  it('needs one move per authored charge before releasing, never more', () => {
    const state = makeBoard();
    state.tiles[12] = { ...core(5, 'bomb'), coreCharges: 5 };
    let board = state.board;
    for (let move = 1; move <= 5; move++) {
      const result = hit({ ...state, board }, [11]);
      board = result.board;
      expect(state.tiles[12].signalHealth).toBe(5 - move);
      const releases = result.steps.flatMap((step) => step.bonuses.filter((b) => b.core === 12));
      expect(releases).toHaveLength(move === 5 ? 1 : 0);
    }
  });

  it.each(['tnt', 'tile-breaker', 'clear-row', 'color-wand', 'bonus-activation'])(
    'is charged by %s',
    (type) => {
      const state = makeBoard();
      state.tiles[12] = core(1);
      const result = hit(state, [12], type);
      expect(state.tiles[12].signalHealth).toBe(0);
      expect(result.layersCleared).toBe(1);
    },
  );

  it('releases its bonus on the core cell at full charge without clearing it', () => {
    const state = makeBoard();
    state.tiles[12] = core(1, 'bomb');
    const result = hit(state, [11, 12, 13]);
    const release = result.steps[0].bonuses.find((bonus) => bonus.core === 12);
    expect(release).toMatchObject({ type: 'bomb', index: 12 });
    expect(result.steps[0].cleared).not.toContain(12);
    expect(result.board).toContain(release.gem);
    expect(result.board.every(Boolean)).toBe(true);
    expect(state.tiles[12]).toMatchObject({ signal: 'core', signalHealth: 0 });
    // A spent core stays quiet: later matches beside it neither charge nor release.
    const later = hit({ ...state, board: result.board }, [11, 16, 21]);
    expect(later.layersCleared).toBe(0);
    expect(later.steps[0].bonuses).toEqual([]);
  });

  it('moves the release to an ordinary neighbor when a relic sits on the core', () => {
    const state = makeBoard();
    state.tiles[12] = core(1);
    state.board[12] = createGem('relic');
    const result = hit(state, [2, 7]);
    const release = result.steps[0].bonuses.find((bonus) => bonus.core === 12);
    expect(release.index).not.toBe(12);
    expect([11, 13, 7, 17]).toContain(release.index);
    expect(result.board.filter((gem) => gem?.type === 'relic')).toHaveLength(1);
  });

  it('still counts the final charge when no neighbor can hold a bonus', () => {
    const board = [createGem('relic'), createGem('bomb'), createGem('ruby')];
    const tiles = [core(1), { type: 'standard', health: 0 }, { type: 'standard', chainHealth: 1 }];
    expect(coreReleaseTarget(board, tiles, 0, 3, 1)).toBe(-1);
    const result = manager.getResolution({
      board,
      tiles,
      cols: 3,
      rows: 1,
      matches: [{ type: 'tile-breaker', indices: [0] }],
    });
    expect(tiles[0].signalHealth).toBe(0);
    expect(result.layersCleared).toBe(1);
    expect(result.steps[0].bonuses).toEqual([]);
  });

  it('lets gems swap and fall through cores so no cell is left unfillable', () => {
    const state = makeBoard();
    for (const index of [7, 12, 17]) state.tiles[index] = core();
    expect(canSwapGem(state.board[12], state.tiles[12])).toBe(true);
    const above = state.board[2];
    const result = hit(state, [12, 17, 22], 'clear-row');
    expect(result.steps[0].drops).toContainEqual({ from: 2, to: 17, gem: above });
    expect(result.board.every(Boolean)).toBe(true);
    expect([7, 12, 17].map((index) => state.tiles[index].signal)).toEqual(['core', 'core', 'core']);
  });
});

describe('charge cores can never block completion', () => {
  it('recovers a dead board with cores present without moving or spending the cores', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    const game = useGameStore();
    Object.assign(game, {
      boardCols: 3,
      boardRows: 3,
      sessionActive: true,
      remainingLayers: 9,
      board: Array.from({ length: 9 }, (_, i) =>
        createGem(GEM_TYPES[((i % 3) + Math.floor(i / 3)) % 3]),
      ),
      tiles: Array.from({ length: 9 }, (_, i) =>
        i === 4 ? core() : { type: 'standard', health: 1, maxHealth: 1 },
      ),
      moves: 150,
    });
    const tiles = JSON.stringify(game.tiles);
    expect(game._hasPlayableMove()).toBe(false);
    expect(recoverBoard(game.board, game.tiles, 3, 3)).not.toBeNull();
    expect(await game.ensurePlayableBoard()).toBe(true);
    expect(game._hasPlayableMove()).toBe(true);
    expect(JSON.stringify(game.tiles)).toBe(tiles);
    expect(game.moves).toBe(150);
    vi.useRealTimers();
  });

  it.each([FIRST, 330, 348, 354, 362, 372])(
    'completes level %i by normal play beyond 100 moves after the speed target elapsed',
    async (id) => {
      let random = id * 7919;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        random = (random * 16807) % 2147483647;
        return (random - 1) / 2147483646;
      });
      const campaign = useCampaignStore();
      campaign.records = Object.fromEntries(
        Array.from({ length: id - 1 }, (_, index) => [index + 1, { score: 1, stars: 1 }]),
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
      // A diagnostic budget for this headless test only, never a gameplay limit.
      for (let turn = 0; turn < 400 && !game.levelCleared; turn++) {
        const move = hints.findBestMove(game.board, game.tiles, game.boardCols, game.boardRows, {
          oreOrders: game.oreOrders,
        });
        if (!move) {
          await game.ensurePlayableBoard();
          continue;
        }
        const played = await game.resolveSwap(move.swap.aIndex, move.swap.bIndex, {
          activateInPlace: !!move.activateInPlace,
        });
        expect(played).toBe(true);
      }
      expect(game.levelCleared).toBe(true);
      expect(game.moves).toBeGreaterThan(100);
      expect(game.elapsedMs).toBeGreaterThan(game.speedTargetMs);
      expect(game.tiles.every((tile) => layerCount(tile) === 0)).toBe(true);
      // Completion always pays at least one chest; score/speed chests stay optional.
      expect(game.levelRewards.length).toBeGreaterThan(0);
      expect(campaign.records[id]).toBeTruthy();
    },
    30000,
  );
});

describe('Tomorrow City pacing', () => {
  // Ten refill seeds per level: hint-led play with earned bonuses and free
  // reshuffles, no inventory powers. Budgets are diagnostics, never move caps.
  const runs = new Map(
    tomorrow.map((level) => [
      level.id,
      Array.from({ length: 10 }, (_, i) => simulateCampaignLevel(level, i + 1)),
    ]),
  );
  it.each(tomorrow.map((level) => [level.id]))('finishes level %i on every sampled seed', (id) => {
    for (const run of runs.get(id)) {
      expect(run).toMatchObject({ remaining: false, layers: 0, relics: 0, ore: 0 });
      expect(run.turns).toBeLessThanOrEqual(80);
      expect(run.shuffles).toBeLessThanOrEqual(3);
    }
  });

  it('eases into the new mechanic, ramps toward the late campaign and stays below a slog', () => {
    const turns = (ids) =>
      ids.flatMap((id) => runs.get(id).map((run) => run.turns)).sort((a, b) => a - b);
    const median = (values) => values[Math.floor(values.length / 2)];
    const all = turns([...runs.keys()]);
    const intro = turns([FIRST, FIRST + 1, FIRST + 2, FIRST + 3, FIRST + 4, FIRST + 5]);
    const later = turns([...runs.keys()].filter((id) => id >= FIRST + 6));
    expect(median(intro)).toBeLessThanOrEqual(median(later));
    expect(
      median(
        runs
          .get(FIRST)
          .map((run) => run.turns)
          .sort((a, b) => a - b),
      ),
    ).toBeLessThanOrEqual(16);
    // Measured (30 seeds): chapter medians 17, 19, 19, 19, 19, 20, 21, 21.
    expect(median(all)).toBeGreaterThanOrEqual(17);
    expect(median(all)).toBeLessThanOrEqual(23);
    expect(median(later)).toBeGreaterThanOrEqual(18);
    expect(median(turns([...runs.keys()].filter((id) => id > FIRST + 35)))).toBeGreaterThanOrEqual(
      median(turns([...runs.keys()].filter((id) => id > FIRST + 5 && id <= FIRST + 17))),
    );
    expect(all[Math.ceil(all.length * 0.9) - 1]).toBeLessThanOrEqual(42);
    // Rest puzzles stay lighter than their chapter finales.
    for (let chapter = 0; chapter < 8; chapter++) {
      const rest = tomorrow[chapter * 6 + 4],
        finale = tomorrow[chapter * 6 + 5];
      expect(rest.objectives[0].target).toBeLessThan(finale.objectives[0].target);
    }
  });
});
