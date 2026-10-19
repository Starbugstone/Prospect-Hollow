import { describe, expect, it } from 'vitest';
import { createGem } from '../src/game/engine/GemFactory';
import { TileManager } from '../src/game/engine/TileManager';
import {
  gravityPath,
  incomingGravity,
  isBlastTarget,
  isPlayableCell,
  withPortalPads,
} from '../src/game/engine/BoardTopology';
import { cargoReachesExit } from '../src/game/engine/GravityFrames';
import { levelConfig } from '../src/game/engine/LevelGenerator';
import { obstacleSeenKey, obstaclesInLevel, unseenObstacles } from '../src/data/obstacles';
import { LEVEL_COUNT } from '../src/data/campaign';
import { layerCount } from '../src/game/engine/TileRules';

const COLS = 5;
const ROWS = 5;
const COLORS = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'];
const at = (row, col) => row * COLS + col;
const manager = new TileManager();
const makeState = (extra = {}) => {
  const tiles = Array.from({ length: COLS * ROWS }, (_, index) => ({
    type: 'standard',
    health: 0,
    maxHealth: 0,
    ...(extra[index] ?? {}),
  }));
  const board = tiles.map((tile, index) =>
    isPlayableCell(tile)
      ? createGem(COLORS[((index % COLS) + Math.floor(index / COLS) * 2) % COLORS.length])
      : null,
  );
  return { board, tiles, cols: COLS, rows: ROWS, gemTypes: COLORS };
};
const voidCell = { type: 'void', health: 0, maxHealth: 0 };
const clear = (state, indices) =>
  manager.getResolution({ ...state, matches: [{ type: 'bonus-activation', indices }] });

describe('portals', () => {
  // Column 0 is a siding over the entrance pad at (2, 0); the exit pad tops column 2.
  const siding = () =>
    makeState({
      [at(1, 0)]: { type: 'standard', health: 0, maxHealth: 0, portalTo: at(1, 2), portalPair: 0 },
      [at(2, 0)]: { type: 'standard', health: 0, maxHealth: 0, portal: 'in', portalPair: 0 },
      [at(0, 2)]: { type: 'standard', health: 0, maxHealth: 0, portal: 'out', portalPair: 0 },
      [at(3, 0)]: voidCell,
      [at(4, 0)]: voidCell,
      [at(4, 2)]: { type: 'standard', health: 0, maxHealth: 0, exit: true },
    });

  it('fill their own cells, out of play and out of reach of blasts', () => {
    const { board, tiles } = siding();
    for (const pad of [at(2, 0), at(0, 2)]) {
      expect(isPlayableCell(tiles[pad])).toBe(false);
      expect(isBlastTarget(tiles[pad])).toBe(false);
      expect(board[pad]).toBeNull();
    }
  });

  it('route gravity from the cell above the entrance to the cell below the exit', () => {
    const { tiles } = siding();
    expect(gravityPath(tiles, at(0, 0), COLS, ROWS)).toEqual([
      at(0, 0),
      at(1, 0),
      at(1, 2),
      at(2, 2),
      at(3, 2),
      at(4, 2),
    ]);
    // The animation passes over both pads.
    expect(withPortalPads(tiles, [at(1, 0), at(1, 2), at(2, 2)])).toEqual([
      at(1, 0),
      at(2, 0),
      at(0, 2),
      at(1, 2),
      at(2, 2),
    ]);
  });

  it('feed the column below the exit through the portal alone', () => {
    const { steps, board } = clear(siding(), [at(1, 2), at(2, 2)]);
    const arrivals = [...steps[0].drops, ...steps[0].spawns].filter(({ path }) =>
      path.some((index) => index % COLS === 2),
    );
    expect(arrivals).toHaveLength(2);
    // Both come down the siding in column 0 and through the portal.
    for (const { path } of arrivals) {
      expect(path[0] % COLS).toBe(0);
      expect(path).toContain(at(1, 2));
    }
    // Every cell but the two pads and the two voids holds a gem again.
    expect(board.filter(Boolean)).toHaveLength(COLS * ROWS - 4);
  });

  it('carry a moon gem through the portal to its basket', () => {
    const state = siding();
    state.board[at(1, 0)] = createGem('relic');
    expect(cargoReachesExit(state.board, state.tiles, at(1, 0), COLS, ROWS)).toBe(true);
    const result = clear(state, [at(1, 2), at(2, 2), at(3, 2), at(4, 2)]);
    const drop = result.steps[0].drops.find((move) => move.gem.type === 'relic');
    expect(drop.path.slice(0, 2)).toEqual([at(1, 0), at(1, 2)]);
    expect(result.relicsCollected).toBe(1);
  });

  it('put every authored exit pad on the top row, the column below fed by its portal', () => {
    const levels = Array.from({ length: LEVEL_COUNT - 402 }, (_, i) => levelConfig(403 + i));
    const portalLevels = levels.filter((level) => level.tiles.some((tile) => tile.portal));
    expect(portalLevels.length).toBeGreaterThanOrEqual(19);
    for (const { id, tiles, boardCols: cols, boardRows: rows } of portalLevels) {
      const incoming = incomingGravity(tiles, cols, rows);
      for (const [exit, tile] of tiles.entries()) {
        if (tile.portal !== 'out') continue;
        const entrance = tiles.findIndex(
          (other) => other.portal === 'in' && other.portalPair === tile.portalPair,
        );
        expect(exit, `level ${id}`).toBeLessThan(cols);
        expect(incoming[exit + cols], `level ${id}`).toEqual([entrance - cols]);
        expect(tiles[entrance - cols].portalTo, `level ${id}`).toBe(exit + cols);
      }
    }
  });

  it('introduce the reworked portal again to players who met the old one, once', () => {
    const level = levelConfig(475);
    const guide = obstaclesInLevel(level.tiles, level.theme);
    const portal = (seen) => unseenObstacles(guide, seen).find(({ id }) => id === 'portal');
    expect(portal([])).toMatchObject({ id: 'portal' });
    expect(portal([]).updated).toBeUndefined();
    expect(portal(['portal'])).toMatchObject({ id: 'portal', updated: true });
    const seen = ['portal', ...guide.map(obstacleSeenKey)];
    expect(unseenObstacles(guide, seen)).toEqual([]);
    const lantern = obstaclesInLevel([{ signal: 'lantern' }]);
    expect(unseenObstacles(lantern, ['lantern'])).toEqual([]);
  });

  it('never loops forever on a misauthored portal cycle', () => {
    const { tiles } = makeState({
      [at(4, 1)]: { type: 'standard', health: 0, maxHealth: 0, portalTo: at(0, 1) },
    });
    expect(gravityPath(tiles, at(0, 1), COLS, ROWS)).toHaveLength(ROWS);
  });
});

describe('breakthrough chambers', () => {
  // Rows 3–4 are sealed behind a two-piece cracked wall in row 2.
  const cavern = () => {
    const wall = { type: 'blocker', bonusOnly: true, waist: 'a', health: 1, maxHealth: 1 };
    const extra = { [at(2, 1)]: { ...wall }, [at(2, 3)]: { ...wall } };
    for (const row of [3, 4])
      for (let col = 0; col < COLS; col++)
        extra[at(row, col)] = {
          type: 'standard',
          health: 1,
          maxHealth: 1,
          sealed: true,
          chamber: 'a',
        };
    const state = makeState(extra);
    for (const index of [at(2, 1), at(2, 3)]) state.board[index] = null;
    return state;
  };

  it('keep sealed cells out of play while still counting their layers', () => {
    const { tiles } = cavern();
    expect(isPlayableCell(tiles[at(3, 0)])).toBe(false);
    expect(tiles.reduce((sum, tile) => sum + layerCount(tile), 0)).toBe(12);
  });

  it('open the chamber once every piece of its wall is broken, then fill it', () => {
    const state = cavern();
    clear(state, [at(2, 1)]);
    expect(state.tiles[at(3, 0)].sealed).toBe(true);
    const result = clear(state, [at(2, 3)]);
    expect(result.steps[0].breakthroughs).toEqual(['a']);
    expect(state.tiles.some((tile) => tile.sealed)).toBe(false);
    expect(result.board.every(Boolean)).toBe(true);
  });
});
