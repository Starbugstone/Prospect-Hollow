import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGem, GEM_TYPES } from '../src/game/engine/GemFactory';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { TileManager } from '../src/game/engine/TileManager';

const engine = new MatchEngine();
const makeBoard = () => Array.from({ length: 25 }, (_, i) => createGem(GEM_TYPES[i % 6]));

afterEach(() => vi.restoreAllMocks());

describe.each(['bomb', 'cross', 'rainbow'])('%s alignment during cascades', (type) => {
  it.each([
    [3, 1],
    [4, 1],
    [5, 1],
    [3, 5],
    [4, 5],
    [5, 5],
  ])('does not match a line of %i bonuses with stride %i', (length, stride) => {
    const board = makeBoard();
    for (let i = 0; i < length; i++) board[i * stride] = createGem(type);
    expect(engine.findMatches(board, 5, 5)).toEqual([]);
  });

  it('preserves all three bonus identities when gravity brings them into a line', () => {
    let refill = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => (refill++ % 6) / 6);
    const board = makeBoard();
    const bonuses = [5, 21, 22].map((index) => (board[index] = createGem(type)));
    for (const index of [10, 15, 20]) board[index] = createGem('ruby');
    const matches = engine.findMatches(board, 5, 5);
    expect(matches).toEqual([{ type: 'ruby', indices: [10, 15, 20], orientation: 'vertical' }]);

    const result = new TileManager().getResolution({
      board,
      tiles: board.map(() => ({ type: 'standard', health: 0 })),
      matches,
      cols: 5,
      rows: 5,
    });

    expect(result.steps[0].drops).toContainEqual({ from: 5, to: 20, gem: bonuses[0] });
    expect(result.board.slice(20, 23)).toEqual(bonuses);
    expect(result.steps.flatMap((step) => step.matches).every((match) => match.type !== type)).toBe(
      true,
    );
    expect(result.steps.flatMap((step) => step.bonuses)).toEqual([]);

    // The preserved pieces still activate and fuse through the usual controls.
    expect(engine.evaluateActivation(result.board, 5, 5, 20).matches[0].type).toBe(
      'bonus-activation',
    );
    expect(engine.evaluateSwap(result.board, 5, 5, 20, 21).matches[0].fusion).toBeDefined();
  });
});

describe('bonuses earned after gravity', () => {
  it.each([
    ['four', 'bomb', 32],
    ['five', 'rainbow', 32],
    ['vertical', 'bomb', 26],
    ['T', 'cross', 31],
    ['L', 'cross', 30],
  ])('reveals and preserves the %s pattern as a %s', (shape, type, index) => {
    let seed = 54321;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    });
    const board = Array.from({ length: 36 }, (_, i) =>
      createGem(GEM_TYPES[((i % 6) + 2 * Math.floor(i / 6)) % 6]),
    );
    const put = (indices, color = 'ruby') => {
      for (const i of indices) board[i] = createGem(color);
    };
    let clears;
    if (shape === 'four' || shape === 'five') {
      clears = [32];
      put([26, 30, 31, 33, ...(shape === 'five' ? [34] : [])]);
      put([32, 35], 'sapphire');
      if (shape === 'four') put([34], 'emerald');
    } else if (shape === 'vertical') {
      clears = [8, 20];
      put([2, 14, 26, 32]);
      put(clears, 'emerald');
    } else if (shape === 'T') {
      clears = [13, 25, 30];
      put([7, 19, 31, 24, 32]);
      put([1, 13, 25, 30, 33], 'sapphire');
    } else {
      clears = [12, 24, 31];
      put([6, 18, 30, 25, 32]);
      put([7, 19, 31, 24], 'emerald');
      put([1, 13, 33], 'sapphire');
    }
    expect(engine.findMatches(board, 6, 6)).toEqual([]);
    const result = new TileManager().getResolution({
      board,
      tiles: board.map(() => ({ type: 'standard', health: 0 })),
      cols: 6,
      rows: 6,
      matches: [{ type: 'tnt', indices: clears }],
    });
    const earned = result.steps[1].bonuses;
    expect(earned).toEqual([
      expect.objectContaining({ type, index, gem: expect.objectContaining({ type }) }),
    ]);
    expect(result.steps[1].cleared).not.toContain(index);
    expect(result.board).toContain(earned[0].gem);
  });
});
