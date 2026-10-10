import { describe, expect, it } from 'vitest';
import { createGem } from '../src/game/engine/GemFactory';
import { TileManager } from '../src/game/engine/TileManager';
import { gravityPath, isPlayableCell } from '../src/game/engine/BoardTopology';
import { cargoReachesExit } from '../src/game/engine/GravityFrames';
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
  // Column 0 is a siding: its bottom cell hands gems to the middle of row 2.
  const siding = () =>
    makeState({
      [at(2, 0)]: { type: 'standard', health: 0, maxHealth: 0, portalTo: at(1, 2) },
      [at(3, 0)]: voidCell,
      [at(4, 0)]: voidCell,
      [at(4, 2)]: { type: 'standard', health: 0, maxHealth: 0, exit: true },
    });

  it('route gravity from the entrance to the paired exit', () => {
    const { tiles } = siding();
    expect(gravityPath(tiles, at(0, 0), COLS, ROWS)).toEqual([
      at(0, 0),
      at(1, 0),
      at(2, 0),
      at(1, 2),
      at(2, 2),
      at(3, 2),
      at(4, 2),
    ]);
  });

  it('carry a moon gem through the portal to its basket', () => {
    const state = siding();
    state.board[at(2, 0)] = createGem('relic');
    expect(cargoReachesExit(state.board, state.tiles, at(2, 0), COLS, ROWS)).toBe(true);
    const result = clear(state, [at(1, 2), at(2, 2), at(3, 2), at(4, 2)]);
    const drop = result.steps[0].drops.find((move) => move.gem.type === 'relic');
    expect(drop.path.slice(0, 2)).toEqual([at(2, 0), at(1, 2)]);
    expect(result.relicsCollected).toBe(1);
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
