import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { markRaw } from 'vue';
import { CHAPTERS, LEVEL_COUNT } from '../src/data/campaign';
import { LEVEL_NAMES } from '../src/data/levelNames';
import { STAR_SCORE_TARGETS } from '../src/data/starScoreTargets';
import { HOLLOW_MINE_CHAPTERS, HOLLOW_MINE_LEVELS } from '../src/data/hollowMineLevels';
import { obstaclesInLevel } from '../src/data/obstacles';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { cargoPath, cargoReachesExit } from '../src/game/engine/GravityFrames';
import { bentBeams } from '../src/game/engine/LensBeams';
import { HintEngine } from '../src/game/engine/HintEngine';
import { PlayClock } from '../src/game/engine/PlayClock';
import { layerCount } from '../src/game/engine/TileRules';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';
import { simulateCampaignLevel } from './helpers/campaignSimulation';

const FIRST = 403;
const levels = generateLevelConfigs();
const hollow = levels.slice(FIRST - 1);
const hints = new HintEngine();
const ice = (tile) =>
  tile.type !== 'blocker' && !tile.sealColor && !tile.phaseSeal && tile.fossilGroup == null
    ? tile.health
    : 0;
// The board as it is once every sealed chamber has been broken into.
const opened = (tiles) => tiles.map((tile) => ({ ...tile, sealed: false }));
// The board after a gravity switch turns it over.
const flipped = (tiles) =>
  tiles.map((tile) =>
    tile.type === 'void' ? tile : { ...tile, fall: tile.fall === 'up' ? undefined : 'up' },
  );
const extraction = (level) =>
  level.board.some((gem) => gem?.type === 'relic') ||
  level.tiles.some((tile) => tile.signal === 'lantern' || tile.signal === 'survey');

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
});

describe('append-only floating seam chapters', () => {
  it('preserves every one of the first 402 levels, names, stars and chapters', () => {
    // Captured on preprod before this append. Normalize random gem ids only.
    const original = generateLevelConfigs(402).map(({ board, ...level }) => ({
      ...level,
      board: board.map((gem) => (gem ? gem.type : null)),
    }));
    const payload = JSON.stringify({
      levels: original,
      stars: STAR_SCORE_TARGETS.slice(0, 402),
      names: LEVEL_NAMES.slice(0, 402),
      chapters: CHAPTERS.slice(0, 67),
    });
    expect(createHash('sha256').update(payload).digest('hex')).toBe(
      'e11ba3d4525f3367f0c5a5c343b2c125bdcbf5ab950749ddeee67e7379aa88eb',
    );
  });

  it('appends six-puzzle chapters with names and star targets', () => {
    expect(CHAPTERS.slice(67)).toEqual(HOLLOW_MINE_CHAPTERS);
    expect(HOLLOW_MINE_LEVELS).toHaveLength(HOLLOW_MINE_CHAPTERS.length * 6);
    expect(LEVEL_COUNT).toBe(402 + HOLLOW_MINE_LEVELS.length);
    expect(hollow.map(({ id }) => id)).toEqual(
      Array.from({ length: HOLLOW_MINE_LEVELS.length }, (_, i) => FIRST + i),
    );
    expect(STAR_SCORE_TARGETS).toHaveLength(LEVEL_COUNT);
    for (const level of hollow) {
      expect(LEVEL_NAMES[level.id - 1].startsWith(`${level.chapterName}: `)).toBe(true);
      expect(level.starScoreTarget).toBe(STAR_SCORE_TARGETS[level.id - 1]);
      expect(level.chestTarget).toBeGreaterThan(0);
      expect(level.tip.length).toBeGreaterThan(20);
    }
  });

  it('keeps ice off every lantern and delivery level', () => {
    for (const level of hollow.filter(extraction))
      expect(
        level.tiles.reduce((sum, tile) => sum + ice(tile), 0),
        `level ${level.id}`,
      ).toBe(0);
  });

  it('gives every floatstone a straight way to a hatch or, after a flip, a basket', () => {
    const floats = hollow.filter((level) => level.board.some((gem) => gem?.float));
    expect(floats.length).toBeGreaterThan(0);
    for (const level of floats) {
      const { board, tiles, boardCols: cols, boardRows: rows } = level;
      const switched = tiles.some((tile) => tile.gravitySwitch);
      for (const [index, gem] of board.entries()) {
        if (!gem?.float) continue;
        expect(
          [tiles, ...(switched ? [flipped(tiles)] : [])].some((state) =>
            cargoReachesExit(board, opened(state), index, cols, rows),
          ),
          `level ${level.id} cell ${index}`,
        ).toBe(true);
        expect(cargoPath(board, tiles, index, cols, rows)[0]).toBe(index);
      }
      expect(obstaclesInLevel(tiles).map(({ id }) => id)).toContain('floatstone');
      // Hatches that only receive floatstones are not shown as relic baskets.
      if (board.every((gem) => gem?.type !== 'relic' || gem.float))
        expect(obstaclesInLevel(tiles).map(({ id }) => id)).not.toContain('relic');
    }
  });

  it('gives every cargo piece a route to an exit once every chamber is open', () => {
    for (const level of hollow) {
      const { board, boardCols: cols, boardRows: rows } = level;
      const tiles = opened(level.tiles);
      // With a moon dial either gravity will do; a moon lock leaves gravity flipped.
      const dial = tiles.some((tile) => tile.gravitySwitch === 'dial');
      const lock = tiles.some((tile) => tile.gravitySwitch === 'lock');
      const states = dial ? [tiles, flipped(tiles)] : lock ? [flipped(tiles)] : [tiles];
      for (const [index, gem] of board.entries())
        if (gem?.type === 'relic')
          expect(
            states.some((state) => cargoReachesExit(board, state, index, cols, rows)),
            `level ${level.id} cell ${index}`,
          ).toBe(true);
    }
  });

  it('only asks for colors that the level can drop', () => {
    for (const level of hollow) {
      const colors = level.boardLayout.gemTypes;
      for (const order of level.oreOrders ?? [])
        expect(colors, `level ${level.id} order`).toContain(order.color);
      for (const tile of level.tiles)
        if (tile.sealColor) expect(colors, `level ${level.id} seal`).toContain(tile.sealColor);
    }
  });

  it('lets some row or column beam reach every starglass through the lenses', () => {
    const lensLevels = hollow.filter((level) => level.tiles.some((tile) => tile.lensOnly));
    expect(lensLevels.length).toBeGreaterThan(0);
    for (const level of lensLevels) {
      const { boardCols: cols, boardRows: rows } = level;
      const tiles = opened(level.tiles);
      const lines = [
        ...Array.from({ length: rows }, (_, index) => ({ axis: 'row', index })),
        ...Array.from({ length: cols }, (_, index) => ({ axis: 'column', index })),
      ];
      const reach = new Set(lines.flatMap((line) => bentBeams(tiles, cols, rows, [line]).cells));
      for (const [index, tile] of tiles.entries())
        if (tile.lensOnly) expect(reach.has(index), `level ${level.id} cell ${index}`).toBe(true);
    }
  });

  it('completes every new level in hint-led play without inventory powers', () => {
    for (const level of hollow)
      for (const seed of [101, 102, 103]) {
        const run = simulateCampaignLevel(level, seed);
        expect(run, `level ${level.id} seed ${seed}`).toMatchObject({
          remaining: false,
          layers: 0,
          relics: 0,
          ore: 0,
        });
      }
  }, 120000);
});

describe('floating seam play', () => {
  it.each([408, 412, 414])(
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
      expect(game.board.some((gem) => gem?.type === 'relic')).toBe(false);
      expect(game.levelRewards.length).toBeGreaterThan(0);
      expect(campaign.records[id]).toBeTruthy();
    },
    30000,
  );
});
