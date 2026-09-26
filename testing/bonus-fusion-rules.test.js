import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBonusFusion } from '../src/game/engine/BonusFusion';
import { BonusActivator } from '../src/game/engine/BonusActivator';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { HintEngine } from '../src/game/engine/HintEngine';
import { TileManager } from '../src/game/engine/TileManager';
import { createGem, GEM_TYPES } from '../src/game/engine/GemFactory';
import { layerCount } from '../src/game/engine/TileRules';

const pairs = [
  ['bomb', 'bomb'],
  ['bomb', 'cross'],
  ['cross', 'cross'],
  ['bomb', 'rainbow'],
  ['cross', 'rainbow'],
  ['rainbow', 'rainbow'],
];
const boardFor = (pair, cols = 8, rows = 8, indices = [27, 28]) => {
  const board = Array.from({ length: cols * rows }, (_, i) =>
    createGem(GEM_TYPES[((i % cols) + Math.floor(i / cols) * 2) % 6]),
  );
  pair.forEach((type, i) => (board[indices[i]] = createGem(type)));
  return board;
};
const activator = new BonusActivator(),
  engine = new MatchEngine();
afterEach(() => vi.restoreAllMocks());

describe('fusion clearing rewards', () => {
  it('turns two adjacent bombs from a 12-cell clear into twin 5×5 blasts covering 30 cells', () => {
    const board = boardFor(['bomb', 'bomb']);
    const ordinary = new Set([27, 28].flatMap((i) => activator.activateBomb(board, 8, 8, i)));
    const fusion = getBonusFusion(board, 8, 8, { aIndex: 27, bIndex: 28 });
    expect(ordinary.size).toBe(12);
    expect(fusion.targets).toHaveLength(30);
    expect(fusion.targets).toEqual(expect.arrayContaining([...ordinary]));
    expect(fusion.nodes.every((node) => node.radius === 2)).toBe(true);
  });
  it('clears three rows and four columns with a horizontal bomb/cross pair', () => {
    const fusion = getBonusFusion(boardFor(['bomb', 'cross']), 8, 8, { aIndex: 27, bIndex: 28 });
    const expected = Array.from({ length: 64 }, (_, i) => i).filter(
      (i) => (i >= 16 && i < 40) || (i % 8 >= 2 && i % 8 <= 5),
    );
    expect(fusion.targets).toEqual(expected);
    expect(fusion.targets).toHaveLength(44);
  });
  it('adds both diagonals to each cross, including distant corner gems', () => {
    const board = boardFor(['cross', 'cross']);
    const old = new Set([27, 28].flatMap((i) => activator.activateCross(board, 8, 8, i)));
    const fusion = getBonusFusion(board, 8, 8, { aIndex: 27, bIndex: 28 });
    expect(fusion.targets).toEqual(expect.arrayContaining([...old, 0, 7, 56, 63]));
    expect(fusion.targets.length).toBeGreaterThan(old.size);
  });
  it.each(['bomb', 'cross'])(
    'detonates every gem of the most common color as a virtual %s',
    (type) => {
      const board = boardFor(['rainbow', type]);
      const before = JSON.stringify(board);
      const fusion = getBonusFusion(board, 8, 8, { aIndex: 27, bIndex: 28 });
      const colorIndices = board.flatMap((gem, i) => (gem.type === fusion.targetType ? [i] : []));
      expect(fusion.nodes.map((node) => node.index)).toEqual(expect.arrayContaining(colorIndices));
      expect(fusion.nodes.every((node) => node.type === type)).toBe(true);
      expect(fusion.targets.length).toBeGreaterThan(30);
      expect(JSON.stringify(board)).toBe(before);
    },
  );
  it('includes empty stone cells in a double-rainbow sweep', () => {
    const board = boardFor(['rainbow', 'rainbow']);
    board[0] = null;
    const fusion = getBonusFusion(board, 8, 8, { aIndex: 27, bIndex: 28 });
    expect(fusion.targets).toEqual(Array.from({ length: 64 }, (_, i) => i));
    expect(fusion.damage).toBe(2);
  });
  it.each(pairs)(
    'keeps %s + %s previews and resolution identical without RNG or mutation',
    (a, b) => {
      const board = boardFor([a, b]);
      board[19] = createGem('rainbow');
      const before = JSON.stringify(board);
      const random = vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Fusion must be deterministic');
      });
      const preview = activator.previewSwap(board, 8, 8, { aIndex: 27, bIndex: 28 });
      const evaluated = engine.evaluateSwap(board, 8, 8, 27, 28);
      expect([...preview].sort((a, b) => a - b)).toEqual(
        [...evaluated.matches[0].indices].sort((a, b) => a - b),
      );
      expect(JSON.stringify(board)).toBe(before);
      expect(random).not.toHaveBeenCalled();
    },
  );
  it('fires bonuses caught only by the expanded blast, without promoting the chain to another fusion', () => {
    const board = boardFor(['bomb', 'bomb']);
    board[9] = createGem('cross');
    const result = engine.evaluateSwap(board, 8, 8, 27, 28);
    expect(result.matches[0].fusion.targets).not.toContain(57);
    expect(result.matches[0].indices).toContain(57);
    expect(result.bonusSwap).toHaveLength(2);
  });
  it('keeps edge and vertical fusions bounded and independent of drag direction on rectangular boards', () => {
    for (const [cols, rows] of [
      [6, 7],
      [8, 8],
      [8, 10],
    ]) {
      for (const indices of [
        [0, 1],
        [0, cols],
        [cols * rows - 2, cols * rows - 1],
      ]) {
        for (const pair of pairs) {
          const board = boardFor(pair, cols, rows, indices);
          const forward = activator.previewSwap(board, cols, rows, {
            aIndex: indices[0],
            bIndex: indices[1],
          });
          const reverse = activator.previewSwap(board, cols, rows, {
            aIndex: indices[1],
            bIndex: indices[0],
          });
          expect([...forward].sort((a, b) => a - b)).toEqual([...reverse].sort((a, b) => a - b));
          expect(forward.every((i) => i >= 0 && i < cols * rows)).toBe(true);
          expect(new Set(forward).size).toBe(forward.length);
        }
      }
    }
  });
  it('uses the stronger footprint to recommend fusion moves without rolling random clears', () => {
    const board = boardFor(['bomb', 'bomb']);
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Hints must not roll');
    });
    const hint = new HintEngine().findBestMove(
      board,
      board.map(() => ({ health: 1 })),
      8,
      8,
    );
    expect(hint.indices).toEqual([27, 28]);
    expect(hint.totalCleared).toBe(30);
  });
});

describe('fusion obstacle damage', () => {
  it('spends two hits on chains then ice, shatters reinforced stone, thaws frozen gems and preserves relics', () => {
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
    const board = boardFor(['rainbow', 'rainbow']);
    const tiles = board.map(() => ({ state: 'PLAYABLE', health: 2, maxHealth: 2 }));
    board[0] = null;
    tiles[0].type = 'blocker';
    tiles[1].chainHealth = 1;
    const relic = (board[2] = createGem('relic'));
    tiles[3].state = 'FROZEN';
    tiles[4].chainHealth = 2;
    const chained = board[4];
    tiles[5].health = 3;
    tiles[5].maxHealth = 3;
    tiles[6].type = 'seal';
    tiles[6].sealColor = 'ruby';
    board[8] = null;
    tiles[8] = { type: 'blocker', health: 3, maxHealth: 3 };
    const layersBefore = tiles.reduce((n, t) => n + layerCount(t), 0);
    const evaluation = engine.evaluateSwap(board, 8, 8, 27, 28, tiles);
    const result = new TileManager().getResolution({ ...evaluation, tiles });
    expect(tiles[0]).toMatchObject({ health: 0, type: 'standard' });
    expect(tiles[1]).toMatchObject({ chainHealth: 0, health: 1 });
    expect(result.steps[0].cleared).toContain(1);
    expect(tiles[3]).toMatchObject({ state: 'PLAYABLE', health: 0 });
    expect(result.steps[0].cleared).toContain(3);
    expect(tiles[4]).toMatchObject({ chainHealth: 0, health: 2 });
    expect(result.board).toContain(chained);
    expect(result.steps[0].cleared).not.toContain(4);
    expect(tiles[5].health).toBe(1);
    expect(tiles[6].health).toBe(0);
    expect(tiles[8]).toMatchObject({ type: 'blocker', health: 1 });
    expect(result.board[8]).toBeNull();
    expect(result.board).toContain(relic);
    expect(result.relicsCollected).toBe(0);
    expect(result.steps[0].cleared).not.toContain(2);
    expect(result.layersCleared).toBe(layersBefore - tiles.reduce((n, t) => n + layerCount(t), 0));
    expect(result.steps[0].bonusFusion.damage).toBe(2);
  });
  it('does not damage neighboring blocks outside the fusion footprint', () => {
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
    const board = boardFor(['bomb', 'bomb']);
    const tiles = board.map(() => ({ health: 0 }));
    tiles[0] = { type: 'blocker', health: 2 };
    board[0] = null;
    tiles[1] = { type: 'blocker', health: 2 };
    board[1] = null;
    const evaluation = engine.evaluateSwap(board, 8, 8, 27, 28, tiles);
    new TileManager().getResolution({ ...evaluation, tiles });
    expect(tiles[0].health).toBe(2);
    expect(tiles[1].health).toBe(2);
  });
});
