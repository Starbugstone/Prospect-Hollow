import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import MineGoals from '../src/components/MineGoals.vue';
import { PROTOTYPE_BOARDS, prototypeConfig } from '../src/data/prototypeBoards';
import { prototypeLevelConfig } from '../src/game/engine/LevelGenerator';
import { hollowLevelSpec } from '../src/data/hollowMineLevels';
import { TileManager } from '../src/game/engine/TileManager';
import { isPlayableCell } from '../src/game/engine/BoardTopology';
import { layerCount } from '../src/game/engine/TileRules';
import { useGameStore } from '../src/stores/gameStore';
import { simulateCampaignLevel } from './helpers/campaignSimulation';

// Route chambers: several ways into the same place, none of them required. The prototype
// "The deep lantern: Two ways down" has a well of two lanterns and two phase seals that a
// drop shaft (route a) or a side chamber (route b) opens. Moves stay unlimited; the turn
// budgets below are diagnostics, never gameplay move limits.
const KEY = 'deep-lantern-routes';
const level = prototypeConfig(KEY);
const { boardCols: cols, boardRows: rows } = level;
const well = level.tiles.flatMap((tile, index) =>
  index >= 8 * cols && (tile.signal === 'lantern' || tile.phaseSeal) ? [index] : [],
);
const routeWall = (route) =>
  level.tiles.flatMap((tile, index) => (tile.waist === route ? [index] : []));

// The board once one route is open, as the breakthrough leaves it: wall broken, chamber playable.
const openRoute = (tiles, route) =>
  tiles.map((tile) =>
    tile.waist === route
      ? { ...tile, type: 'standard', health: 0 }
      : tile.sealed && tile.chamber === route
        ? { ...tile, sealed: false }
        : tile,
  );
// Every straight run of three cells a match could fill: playable and not blocked.
const matchLines = (tiles) => {
  const open = (index) =>
    isPlayableCell(tiles[index]) && !(tiles[index].type === 'blocker' && tiles[index].health > 0);
  const lines = [];
  for (let index = 0; index < cols * rows; index++)
    for (const [axis, step] of [
      ['horizontal', 1],
      ['vertical', cols],
    ]) {
      const cells = [index, index + step, index + 2 * step];
      if (axis === 'horizontal' && (index % cols) + 2 >= cols) continue;
      if (cells.at(-1) >= cols * rows || !cells.every(open)) continue;
      lines.push({ axis, cells });
    }
  return lines;
};
const wellAxes = (tiles) =>
  [
    ...new Set(
      matchLines(tiles)
        .filter((line) => line.cells.some((cell) => well.includes(cell)))
        .map((line) => line.axis),
    ),
  ].sort();

describe('route chambers', () => {
  it('count neither wall toward the goal', () => {
    const goal = level.objectives.find((objective) => objective.type === 'clear-layers');
    const walls = [...routeWall('a'), ...routeWall('b')];
    expect(walls.every((index) => level.tiles[index].health > 0)).toBe(true);
    expect(walls.every((index) => layerCount(level.tiles[index]) === 0)).toBe(true);
    expect(goal.target).toBe(level.tiles.reduce((sum, tile) => sum + layerCount(tile), 0));
    // Two lanterns, a single and a double phase seal in the well, two seals above.
    expect(goal.target).toBe(7);

    // Breaking a route wall clears nothing the goal counts.
    const tiles = level.tiles.map((tile) => ({ ...tile }));
    const counted = () => tiles.reduce((sum, tile) => sum + layerCount(tile), 0);
    const before = counted();
    const board = level.board.map((gem) => (gem ? { ...gem } : null));
    const [piece] = routeWall('b');
    board[piece - cols] = { id: 'test-bomb', type: 'bomb' };
    const result = new TileManager().getResolution({
      board,
      tiles,
      cols,
      rows,
      matches: [{ type: 'bomb', indices: [piece - cols, piece, piece - 1, piece + 1] }],
      bonuses: [],
      gemTypes: level.boardLayout.gemTypes,
    });
    expect(tiles[piece].health).toBe(0);
    // Refills are random, so a cascade may still reach a counted seal: the goal moves by
    // exactly the counted layers that went, and the broken wall adds nothing.
    expect(result.layersCleared).toBe(before - counted());
  });

  it('seal the well until a route opens, and each route opens it a different way', () => {
    // No swap can line up a match through the well while both routes are shut.
    expect(wellAxes(level.tiles)).toEqual([]);
    // The drop shaft feeds the well from above: vertical matches only.
    expect(wellAxes(openRoute(level.tiles, 'a'))).toEqual(['vertical']);
    // The side chamber opens beside it: horizontal matches only.
    expect(wellAxes(openRoute(level.tiles, 'b'))).toEqual(['horizontal']);
    expect(wellAxes(openRoute(openRoute(level.tiles, 'a'), 'b'))).toEqual([
      'horizontal',
      'vertical',
    ]);
  });

  it(
    'let either route alone open the objective, in either order, without closing the other',
    { timeout: 60000 },
    () => {
      const runs = Array.from({ length: 30 }, (_, i) => {
        const opened = {};
        let tiles;
        const result = simulateCampaignLevel(level, i + 1, {
          observe(resolution, state) {
            for (const step of resolution.steps)
              for (const route of step.breakthroughs ?? []) opened[route] ??= state.turn;
            tiles = state.tiles;
          },
        });
        return { result, opened, tiles };
      });
      expect(runs.every(({ result }) => !result.remaining)).toBe(true);
      for (const [route, other] of [
        ['a', 'b'],
        ['b', 'a'],
      ]) {
        // Seeds where only this route opened: the level finished with the other wall standing.
        const alone = runs.filter(({ opened }) => opened[route] != null && opened[other] == null);
        expect(alone.length, `route ${route} alone`).toBeGreaterThanOrEqual(3);
        for (const { tiles } of alone) {
          const standing = routeWall(other).filter((index) => tiles[index].health > 0);
          expect(standing.length).toBeGreaterThan(0);
          // Still reachable: a blast from the playable cell above can hit it.
          expect(standing.some((index) => isPlayableCell(tiles[index - cols]))).toBe(true);
        }
        // Both orders occur: this route first, then the other one later.
        const first = runs.filter(
          ({ opened }) => opened[route] != null && opened[other] > opened[route],
        );
        expect(first.length, `route ${route} first`).toBeGreaterThanOrEqual(2);
      }
    },
  );

  it('never needs a route: the well completes with both routes shut', { timeout: 60000 }, () => {
    // Bonus blasts can still reach the well, so even a player who opens neither finishes.
    const shut = level.tiles.map((tile) =>
      tile.waist || tile.sealed ? { type: 'void', health: 0, maxHealth: 0 } : tile,
    );
    const board = level.board.map((gem, index) => (shut[index].type === 'void' ? null : gem));
    for (const seed of [1, 2, 3, 4, 5, 6])
      expect(
        simulateCampaignLevel({ ...level, tiles: shut, board }, seed).remaining,
        `seed ${seed}`,
      ).toBe(false);
  });

  // A lantern, a relic or the basket a relic must reach would each make that route required.
  it.each([
    ['a lantern', '__..l../__lZ.../__zl...'],
    ['a relic', '__...R./__lZ.../__zl...'],
    ['an exit', '__...../__lZ.../__zl..E'],
  ])('reject a route chamber holding %s', (_, rows) => {
    const plan = { cols: 7, rows: 10, motif: 'arch' };
    const spec = hollowLevelSpec(plan, {
      ...PROTOTYPE_BOARDS[0].level,
      board: `......./.z...z./......./......./......./__YY.../__..www/${rows}`,
    });
    const trial = { chapter: 93, chapterName: 'Test', cols: 7, rows: 10, gemTypes: ['ruby'] };
    expect(() => prototypeLevelConfig({ id: 559, spec, trial })).toThrow(/route chamber/);
  });
});

describe('the prototype board in the game store', () => {
  let saves;
  beforeEach(() => {
    saves = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => saves.get(key) ?? null,
      setItem: (key, value) => saves.set(key, value),
      removeItem: (key) => saves.delete(key),
    });
    setActivePinia(createPinia());
  });
  afterEach(() => {
    useGameStore().cancelHint();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('lists only the goal in its counters, not the route walls', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const game = useGameStore();
    expect(game.startLevel(KEY, 'prototype')).toBe(true);
    const initialTiles = game.currentLevel.config.tiles;
    const html = await renderToString(
      createSSRApp({ render: () => h(MineGoals, { initialTiles }) }).use(pinia),
    );
    expect(html).toContain('Lanterns: 0 / 2');
    expect(html).toContain('Phase seals: 0 / 5');
    expect(html).not.toContain('Cracked walls');
    game.exitLevel();
  });

  it('stays out of the public game', () => {
    vi.stubEnv('DEV', false);
    expect(useGameStore().startLevel(KEY, 'prototype')).toBe(false);
    expect(useGameStore().startLevel(559)).toBe(false);
  });
});
