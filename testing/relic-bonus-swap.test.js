import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { TileManager } from '../src/game/engine/TileManager';
import { createGem } from '../src/game/engine/GemFactory';
import { levelConfig } from '../src/game/engine/LevelGenerator';
import { canSwapCells } from '../src/game/engine/TileRules';
import { drainsToExit } from '../src/game/engine/BoardTopology';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';

// Level 400 is the reservoir from the user's report: pearls above a 7-wide bowl,
// one-hit crates at 36 and 40, two-hit crates at 45 and 52 and one basket at 59.
// Level 393 is a rectangular relic level with exits only at 57 and 61.
const RESERVOIR = 400;
const VAULT = 393;
const COLORS = ['ruby', 'sapphire', 'emerald', 'amethyst', 'moonstone'];
const engine = new MatchEngine();
const manager = new TileManager();

// The level's shape with a matchless colour pattern and only the given pieces placed.
function setup(id, place) {
  const { board, tiles, boardCols: cols, boardRows: rows } = levelConfig(id);
  const next = board.map((gem, i) =>
    gem ? createGem(COLORS[((i % cols) * 2 + Math.floor(i / cols)) % COLORS.length]) : null,
  );
  for (const [index, type] of Object.entries(place)) next[index] = createGem(type);
  return { board: next, tiles: structuredClone(tiles), cols, rows };
}

const resolve = (state, evaluation) => {
  // One settled step: refills cannot cascade into the obstacles under test.
  vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
  return manager.getResolution({ ...evaluation, tiles: state.tiles });
};

async function playLevel(id, place) {
  let random = id * 7919;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    random = (random * 16807) % 2147483647;
    return (random - 1) / 2147483646;
  });
  useCampaignStore().records = Object.fromEntries(
    Array.from({ length: id - 1 }, (_, i) => [i + 1, { score: 1, stars: 1 }]),
  );
  const game = useGameStore();
  game.bootstrap();
  expect(game.startLevel(id)).toBe(true);
  game.board = setup(id, place).board;
  return game;
}

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
});

describe('swapping a board bonus with a relic', () => {
  it('trades places with a pearl and fires the bomb in the pearl’s cell', () => {
    const state = setup(RESERVOIR, { 24: 'bomb', 31: 'relic' });
    const pearl = state.board[31];
    for (const [a, b] of [
      [24, 31],
      [31, 24],
    ]) {
      const evaluation = engine.evaluateSwap(state.board, 7, 9, a, b, state.tiles);
      expect(evaluation.matches).toHaveLength(1);
      expect(evaluation.matches[0].type).toBe('bonus-activation');
      expect(evaluation.board[24]).toBe(pearl);
      expect(evaluation.board[31].type).toBe('bomb');
      expect([...evaluation.matches[0].indices].sort((x, y) => x - y)).toEqual([
        23, 24, 25, 30, 31, 32, 37, 38, 39,
      ]);
    }
    const result = resolve(state, engine.evaluateSwap(state.board, 7, 9, 24, 31, state.tiles));
    expect(result.steps[0].cleared).not.toContain(24);
    // The pearl falls back down onto the closed two-hit crate.
    expect(result.board[38]).toBe(pearl);
    expect(state.tiles[45].health).toBe(2);
  });

  it('fires a cross or rainbow traded with a pearl the same way', () => {
    const cross = setup(RESERVOIR, { 24: 'cross', 31: 'relic' });
    resolve(cross, engine.evaluateSwap(cross.board, 7, 9, 24, 31, cross.tiles));
    // The column beam passes the pearl and reaches both crates below it.
    expect([cross.tiles[45].health, cross.tiles[52].health]).toEqual([1, 1]);
    vi.restoreAllMocks();

    const rainbow = setup(RESERVOIR, { 24: 'rainbow', 31: 'relic' });
    const evaluation = engine.evaluateSwap(rainbow.board, 7, 9, 24, 31, rainbow.tiles);
    const colors = new Set(
      evaluation.matches[0].indices
        .filter((index) => index !== 31)
        .map((index) => rainbow.board[index].type),
    );
    expect(colors.size).toBe(1);
    expect(evaluation.board[24].type).toBe('relic');
  });

  it('refuses a swap that would move a relic away from every exit', () => {
    const { board, tiles, cols, rows } = setup(VAULT, { 8: 'relic', 9: 'bomb', 1: 'cross' });
    expect(drainsToExit(tiles, 9, cols, rows)).toBe(false);
    expect(drainsToExit(tiles, 1, cols, rows)).toBe(true);
    expect(canSwapCells(board, tiles, 8, 9, cols, rows)).toBe(false);
    expect(engine.evaluateSwap(board, cols, rows, 9, 8, tiles).matches).toEqual([]);
    expect(canSwapCells(board, tiles, 8, 1, cols, rows)).toBe(true);
    expect(engine.evaluateSwap(board, cols, rows, 1, 8, tiles).matches).toHaveLength(1);
  });

  it('keeps relics fixed against ordinary gems, other relics and anchors', () => {
    const state = setup(RESERVOIR, { 24: 'bomb', 31: 'relic', 32: 'relic' });
    const { board, tiles } = state;
    expect(canSwapCells(board, tiles, 31, 30, 7, 9)).toBe(false);
    expect(canSwapCells(board, tiles, 31, 32, 7, 9)).toBe(false);
    tiles[31].chainHealth = 1;
    expect(canSwapCells(board, tiles, 24, 31, 7, 9)).toBe(false);
    tiles[31].chainHealth = 0;
    tiles[24].state = 'FROZEN';
    expect(canSwapCells(board, tiles, 24, 31, 7, 9)).toBe(false);
    expect(engine.evaluateSwap(board, 7, 9, 24, 31, tiles).matches).toEqual([]);
  });

  it('plays the swap through the store as one ordinary move', async () => {
    const game = await playLevel(RESERVOIR, { 24: 'bomb', 31: 'relic' });
    const [bomb, pearl] = [game.board[24].id, game.board[31].id];
    expect(await game.resolveSwap(24, 31)).toBe(true);
    expect(game.moves).toBe(1);
    const ids = game.board.map((gem) => gem?.id);
    expect(ids).toContain(pearl);
    expect(ids).not.toContain(bomb);
  });

  it('bounces a stranding swap in the store without spending a move', async () => {
    const game = await playLevel(VAULT, { 8: 'relic', 9: 'bomb' });
    const before = game.board.map((gem) => gem?.id);
    expect(await game.resolveSwap(9, 8)).toBe(false);
    expect(game.moves).toBe(0);
    expect(game.board.map((gem) => gem?.id)).toEqual(before);
  });
});

describe('blast-only obstacles in chain reactions', () => {
  it('take one hit per bonus blast while ice keeps one hit per chain', () => {
    // The user's case: a cross fires down past two pearls into a bomb beside a crate.
    const state = setup(RESERVOIR, { 17: 'cross', 24: 'relic', 31: 'relic', 38: 'bomb' });
    expect([state.tiles[38].health, state.tiles[45].health, state.tiles[52].health]).toEqual([
      2, 2, 2,
    ]);
    const evaluation = engine.evaluateActivation(state.board, 7, 9, 17, state.tiles);
    const result = resolve(state, evaluation);
    // Beam and bomb both reach crate 45; only the beam reaches crate 52.
    expect(state.tiles[45]).toMatchObject({ health: 0, type: 'standard' });
    expect(state.tiles[52]).toMatchObject({ health: 1, type: 'blocker' });
    // Ice under the bomb is covered by both blasts but still takes one hit.
    expect(state.tiles[38].health).toBe(1);
    expect(result.layersCleared).toBeGreaterThanOrEqual(3);
  });

  it('counts a single blast once and adds chained blasts to a fusion’s double hit', () => {
    const single = setup(RESERVOIR, { 17: 'cross' });
    resolve(single, engine.evaluateActivation(single.board, 7, 9, 17, single.tiles));
    expect([single.tiles[45].health, single.tiles[52].health]).toEqual([1, 1]);
    vi.restoreAllMocks();

    const fixture = () => {
      const board = Array.from({ length: 36 }, (_, i) =>
        createGem(COLORS[((i % 6) * 2 + Math.floor(i / 6)) % COLORS.length]),
      );
      const tiles = board.map(() => ({ type: 'standard', health: 0, maxHealth: 0 }));
      board[14] = null;
      tiles[14] = { type: 'blocker', health: 3, maxHealth: 3, bonusOnly: true };
      board[0] = createGem('bomb');
      board[1] = createGem('bomb');
      return { board, tiles };
    };
    for (const [chained, health] of [
      [false, 1],
      [true, 0],
    ]) {
      const state = fixture();
      if (chained) state.board[8] = createGem('cross');
      resolve(state, engine.evaluateSwap(state.board, 6, 6, 0, 1, state.tiles));
      expect(state.tiles[14].health).toBe(health);
      vi.restoreAllMocks();
    }
  });

  it('applies to toolbar powers that set off board bonuses', async () => {
    const game = await playLevel(RESERVOIR, { 24: 'relic', 31: 'relic', 38: 'bomb' });
    expect(await game._activatePower('tile-breaker', 17, false)).toBe(true);
    expect(game.tiles[45].health).toBe(0);
    expect(game.tiles[52].health).toBe(1);
  });
});
