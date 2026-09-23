import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useGameStore } from '../src/stores/gameStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { recoverBoard } from '../src/game/engine/BoardRecovery';
import { HintEngine } from '../src/game/engine/HintEngine';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { createGem, GEM_TYPES } from '../src/game/engine/GemFactory';
let game;
beforeEach(() => {
  vi.useFakeTimers();
  setActivePinia(createPinia());
  game = useGameStore();
  game.boardCols = game.boardRows = 3;
  game.sessionActive = true;
  game.remainingLayers = 18;
  game.board = Array.from({ length: 9 }, (_, i) =>
    createGem(GEM_TYPES[((i % 3) + Math.floor(i / 3)) % 3]),
  );
  game.tiles = game.board.map(() => ({ type: 'standard', health: 2, maxHealth: 2 }));
  vi.spyOn(Math, 'random').mockReturnValue(0.999999);
});
afterEach(() => {
  game.cancelHint();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('constructs a legal move after three unsuccessful shuffles without changing jewels, obstacles, earnings or moves', async () => {
  const ids = game.board.map((g) => g.id).sort();
  const tiles = game.tiles.map((t) => ({ ...t }));
  game.moves = 101;
  game.elapsedMs = 600000;
  expect(game._hasPlayableMove()).toBe(false);
  expect(await game.ensurePlayableBoard()).toBe(true);
  expect(game._hasPlayableMove()).toBe(true);
  expect(game.board.map((g) => g.id).sort()).toEqual(ids);
  expect(game.tiles).toEqual(tiles);
  expect(game.moves).toBe(101);
  expect(game.elapsedMs).toBe(600000);
  expect(game.score).toBe(0);
  expect(useInventoryStore().quickAccessSlots.every((s) => s.quantity === 0)).toBe(true);
  expect(new MatchEngine().findMatches(game.board, 3, 3)).toEqual([]);
});
it('preserves frozen, chained, stone, empty and relic cells during constructive recovery', () => {
  const board = Array.from({ length: 25 }, (_, i) =>
    createGem(GEM_TYPES[((i % 5) + Math.floor(i / 5)) % 3]),
  );
  const tiles = board.map(() => ({ type: 'standard', health: 0 }));
  tiles[0].state = 'FROZEN';
  tiles[1].chainHealth = 1;
  tiles[2] = { type: 'blocker', health: 2 };
  board[2] = null;
  board[3] = createGem('relic');
  board[4] = null;
  const result = recoverBoard(board, tiles, 5, 5);
  expect(result).not.toBeNull();
  for (const i of [0, 1, 2, 3, 4]) expect(result[i]).toBe(board[i]);
  expect(
    result
      .filter(Boolean)
      .map((g) => g.id)
      .sort(),
  ).toEqual(
    board
      .filter(Boolean)
      .map((g) => g.id)
      .sort(),
  );
  expect(new HintEngine().findBestMove(result, tiles, 5, 5)).toBeTruthy();
});
it('provides a free in-place cross when isolated jewels cannot form a normal match', async () => {
  game.board = game.board.map((g, i) => (i === 4 ? g : null));
  game.tiles = game.tiles.map((t, i) =>
    i === 4 ? { ...t } : { type: 'blocker', health: 2, maxHealth: 2 },
  );
  expect(await game.ensurePlayableBoard()).toBe(true);
  expect(game.board[4].type).toBe('cross');
  expect(game._hasPlayableMove()).toBe(true);
  const hint = new HintEngine().findBestMove(game.board, game.tiles, 3, 3);
  expect(hint).toMatchObject({ activateInPlace: true, indices: [4] });
  expect(await game.activateBonusGem(4)).toBe(true);
});
it('recovers a fully anchored chamber without consuming powers or imposing a restart', async () => {
  game.tiles.forEach((t) => (t.state = 'FROZEN'));
  expect(await game.ensurePlayableBoard()).toBe(true);
  expect(game.levelCleared || game._hasPlayableMove()).toBe(true);
  expect(useInventoryStore().quickAccessSlots.every((s) => s.quantity === 0)).toBe(true);
});
it('does not carry a delayed shuffle recovery into a replacement session', async () => {
  let finish;
  game.renderer = {
    animator: { animateShuffle: () => new Promise((resolve) => (finish = resolve)) },
  };
  const recovery = game.ensurePlayableBoard();
  game.sessionVersion++;
  game.board = [createGem('emerald')];
  finish();
  expect(await recovery).toBe(false);
  expect(game.board).toHaveLength(1);
});
it('recognizes an isolated existing bonus without replacing it or spending a shuffle', async () => {
  game.board = game.board.map((g, i) => (i === 4 ? createGem('bomb') : null));
  const shuffle = vi.spyOn(game, 'shuffleBoard');
  expect(await game.ensurePlayableBoard()).toBe(false);
  expect(shuffle).not.toHaveBeenCalled();
  expect(game._hasPlayableMove()).toBe(true);
});
