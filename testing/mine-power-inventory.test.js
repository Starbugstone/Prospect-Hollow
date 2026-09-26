import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useGameStore } from '../src/stores/gameStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { createGem, GEM_TYPES } from '../src/game/engine/GemFactory';
import { MatchEngine } from '../src/game/engine/MatchEngine';
let game, inventory, finishes, playSteps;
beforeEach(() => {
  vi.useFakeTimers();
  setActivePinia(createPinia());
  game = useGameStore();
  inventory = useInventoryStore();
  game.boardCols = game.boardRows = 6;
  game.board = Array.from({ length: 36 }, (_, i) =>
    createGem(GEM_TYPES[((i % 6) + 2 * Math.floor(i / 6)) % 6]),
  );
  game.tiles = game.board.map(() => ({ type: 'standard', health: 2, maxHealth: 2 }));
  game.sessionActive = true;
  game.remainingLayers = 72;
  vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
  vi.spyOn(game, 'ensurePlayableBoard').mockResolvedValue(true);
  finishes = [];
  playSteps = vi.fn(() => new Promise((resolve) => finishes.push(resolve)));
  game.renderer = { animator: { playSteps, updateTiles: vi.fn(), clear: vi.fn() } };
});
afterEach(() => {
  game.cancelHint();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const stock = (id, n) => {
  inventory.quickAccessSlots.find((s) => s.id === id).quantity = n;
};
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
it.each(['tnt', 'color-wand', 'tile-breaker'])(
  'reserves the last %s and rejects a stale queued activation without spending twice',
  async (id) => {
    stock(id, 1);
    await inventory.usePowerUp(id);
    const action = game.resolveBonusClick(0);
    expect(inventory.availableQuantity(id)).toBe(0);
    expect(await inventory.usePowerUp(id)).toBe(false);
    // A stale queued command must still revalidate stock when it starts.
    game.queuedBonus = { index: 35, bonusName: id.replaceAll('-', '_') };
    finishes[0]();
    expect(await action).toBe(true);
    await flush();
    expect(playSteps).toHaveBeenCalledOnce();
    expect(inventory.availableQuantity(id)).toBe(0);
    expect(game.queuedBonus).toBeNull();
    expect(game.powerInUse).toBeNull();
  },
);
it('allows two queued blasts when two items exist and consumes each once', async () => {
  stock('tnt', 2);
  await inventory.usePowerUp('tnt');
  const first = game.resolveBonusClick(0);
  expect(inventory.availableQuantity('tnt')).toBe(1);
  await inventory.usePowerUp('tnt');
  await game.resolveBonusClick(35);
  finishes[0]();
  await first;
  await flush();
  expect(playSteps).toHaveBeenCalledTimes(2);
  expect(inventory.availableQuantity('tnt')).toBe(0);
  finishes[1]();
  await flush();
  expect(game.tiles[35].health).toBe(1);
  expect(inventory.quickAccessSlots.find((s) => s.id === 'tnt').quantity).toBe(0);
});
it('rejects zero stock or an invalid target without changing score, tiles or inventory', async () => {
  const before = JSON.stringify({ board: game.board, tiles: game.tiles, score: game.score });
  game.activeBonusMode = 'tnt';
  expect(await game.resolveBonusClick(0)).toBe(false);
  stock('tnt', 1);
  await inventory.usePowerUp('tnt');
  expect(await game.resolveBonusClick(-1)).toBe(false);
  expect(JSON.stringify({ board: game.board, tiles: game.tiles, score: game.score })).toBe(before);
  expect(inventory.availableQuantity('tnt')).toBe(1);
  expect(playSteps).not.toHaveBeenCalled();
});
it('does not spend, damage tiles or score an abandoned power animation', async () => {
  stock('tnt', 1);
  const tiles = structuredClone(game.$state.tiles.map((t) => ({ ...t })));
  await inventory.usePowerUp('tnt');
  const action = game.resolveBonusClick(0);
  expect(game.tiles).toEqual(tiles);
  expect(game.score).toBe(0);
  game.exitLevel();
  finishes[0]();
  expect(await action).toBe(false);
  expect(inventory.availableQuantity('tnt')).toBe(1);
  expect(game.board).toEqual([]);
  expect(game.score).toBe(0);
});
it('consumes a row power before victory commits and only once', async () => {
  stock('clear-row', 1);
  const commit = vi.spyOn(game, 'commitResolution');
  const action = inventory.usePowerUp('clear-row');
  expect(inventory.availableQuantity('clear-row')).toBe(0);
  finishes[0]();
  expect(await action).toBe(true);
  expect(commit).toHaveBeenCalledOnce();
  expect(inventory.availableQuantity('clear-row')).toBe(0);
});
