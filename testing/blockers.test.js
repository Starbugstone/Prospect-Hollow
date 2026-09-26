import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { TileManager } from '../src/game/engine/TileManager';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { BonusActivator } from '../src/game/engine/BonusActivator';
import { HintEngine } from '../src/game/engine/HintEngine';
import { createGem } from '../src/game/engine/GemFactory';
import { useGameStore } from '../src/stores/gameStore';

const manager = new TileManager();
const makeBoard = (health = 2) => {
  const board = Array.from({ length: 25 }, (_, i) =>
    createGem(['ruby', 'emerald', 'topaz', 'sapphire', 'amethyst'][(i + Math.floor(i / 5)) % 5]),
  );
  const tiles = board.map(() => ({ type: 'standard', health: 0, maxHealth: 0 }));
  board[12] = null;
  tiles[12] = { type: 'blocker', health, maxHealth: health };
  return { board, tiles, cols: 5, rows: 5 };
};
beforeEach(() => {
  setActivePinia(createPinia());
  // Isolate a single damage/fall step; cascade behavior is tested separately.
  vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
});
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
});

describe('Stone barriers', () => {
  it('takes just one hit from multiple adjacent matches and shows its damage', () => {
    const state = makeBoard();
    const result = manager.getResolution({
      ...state,
      matches: [
        { type: 'ruby', indices: [6, 7, 8] },
        { type: 'emerald', indices: [11, 16, 21] },
      ],
    });
    expect(state.tiles[12].health).toBe(1);
    expect(result.layersCleared).toBe(1);
    expect(result.steps[0].tileUpdates).toContainEqual({
      index: 12,
      health: 1,
      maxHealth: 2,
      type: 'blocker',
    });
    expect(result.board[12]).toBeNull();
  });
  it('does not take damage from diagonal matches', () => {
    const state = makeBoard();
    manager.getResolution({ ...state, matches: [{ type: 'ruby', indices: [0, 5, 10] }] });
    expect(state.tiles[12].health).toBe(2);
  });
  it.each(['tnt', 'tile_breaker', 'clear_row', 'color_wand', 'bonus-activation'])(
    'does not extend %s damage to a block beside its footprint',
    (type) => {
      const state = makeBoard(1);
      const result = manager.getResolution({
        ...state,
        matches: [{ type, indices: [6, 7, 8] }],
      });
      expect(state.tiles[12]).toMatchObject({ type: 'blocker', health: 1 });
      expect(result.steps[0].tileUpdates).not.toContainEqual(
        expect.objectContaining({ index: 12 }),
      );
    },
  );
  it('damages only blocks inside the actual bomb radius', () => {
    const state = makeBoard(1);
    state.board[0] = createGem('bomb');
    state.board[6] = null;
    state.tiles[6] = { type: 'blocker', health: 1, maxHealth: 1 };
    state.board[7] = null;
    state.tiles[7] = { type: 'blocker', health: 1, maxHealth: 1 };
    const evaluation = new MatchEngine().evaluateActivation(state.board, 5, 5, 0, state.tiles);
    manager.getResolution({ ...state, ...evaluation });
    expect(state.tiles[6]).toMatchObject({ type: 'standard', health: 0 });
    expect(state.tiles[7]).toMatchObject({ type: 'blocker', health: 1 });
  });
  it('still damages a remote block reached by a chained bomb', () => {
    const state = makeBoard(1);
    state.board[0] = createGem('bomb');
    state.board[6] = createGem('bomb');
    const indices = new BonusActivator().activate(state.board, 5, 5, { aIndex: 0, bIndex: -1 });
    expect(indices).toContain(12);
    manager.getResolution({ ...state, matches: [{ type: 'bonus-activation', indices }] });
    expect(state.tiles[12].health).toBe(0);
  });
  it('does not reward a hint for block damage outside a bonus footprint', () => {
    const board = Array(25).fill(null);
    board[0] = createGem('bomb');
    board[1] = createGem('ruby');
    const tiles = board.map(() => ({ type: 'standard', health: 0 }));
    const hints = new HintEngine();
    const baseline = hints.findBestMove(board, tiles, 5, 5);
    tiles[8] = { type: 'blocker', health: 1 };
    expect(hints.findBestMove(board, tiles, 5, 5).heuristicScore).toBe(baseline.heuristicScore);
    tiles[7] = { type: 'blocker', health: 1 };
    expect(hints.findBestMove(board, tiles, 5, 5).heuristicScore).toBeGreaterThan(
      baseline.heuristicScore,
    );
  });
  it('retains adjacent match damage in a step that also contains a blast', () => {
    const state = makeBoard();
    manager.getResolution({
      ...state,
      matches: [
        { type: 'ruby', indices: [6, 7, 8] },
        { type: 'tnt', indices: [11, 16, 21] },
      ],
    });
    expect(state.tiles[12].health).toBe(1);
  });
  it.each(['tnt', 'tile_breaker', 'bonus-activation', 'clear_row'])(
    'takes one hit from a direct %s blast and its overlapping neighbors',
    (type) => {
      const state = makeBoard();
      const result = manager.getResolution({
        ...state,
        matches: [{ type, indices: [7, 11, 12, 13, 17] }],
      });
      expect(state.tiles[12].health).toBe(1);
      expect(result.steps[0].cleared).not.toContain(12);
    },
  );
  it('holds gems above stone and leaves unreachable refill cells empty', () => {
    const state = makeBoard();
    const above = state.board[7];
    const lower = state.board[17];
    const result = manager.getResolution({
      ...state,
      matches: [{ type: 'tnt', indices: [22] }],
    });
    expect(result.board[7]).toBe(above);
    expect(result.board[22]).toBe(lower);
    expect(result.board[17]).toBeNull();
    expect(result.steps[0].spawns.some(({ index }) => index === 12 || index === 17)).toBe(false);
    expect(
      result.steps[0].drops.some(({ from, to }) => from < 12 && to > 12 && from % 5 === 2),
    ).toBe(false);
  });
  it('releases the entire column as soon as the last hit destroys stone', () => {
    const state = makeBoard(1);
    const above = state.board[7];
    state.board[17] = null;
    const result = manager.getResolution({
      ...state,
      matches: [{ type: 'tnt', indices: [12] }],
    });
    expect(state.tiles[12]).toMatchObject({ type: 'standard', health: 0 });
    expect(result.board.every(Boolean)).toBe(true);
    expect(result.steps[0].drops).toContainEqual({ from: 7, to: 17, gem: above });
  });
  it('damages stone next to a match even when the neighboring gem becomes a bonus', () => {
    const state = makeBoard();
    state.board[7] = createGem('bomb');
    manager.getResolution({
      ...state,
      matches: [{ type: 'ruby', indices: [5, 6, 7, 8] }],
      bonusesCreated: ['bomb'],
      bonusIndices: [7],
    });
    expect(state.tiles[12].health).toBe(1);
  });
  it('keeps barriers, frozen gems, and empty cells in place during shuffle', async () => {
    const state = makeBoard();
    const game = useGameStore();
    Object.assign(game, {
      sessionActive: true,
      board: state.board,
      tiles: state.tiles,
      boardCols: 5,
      boardRows: 5,
      remainingLayers: 2,
    });
    game.board[17] = null;
    game.tiles[0].state = 'FROZEN';
    const frozen = game.board[0];
    await game.shuffleBoard();
    expect(game.board[12]).toBeNull();
    expect(game.board[17]).toBeNull();
    expect(game.board[0]).toBe(frozen);
    expect(game.tiles[12].health).toBe(2);
  });
});
