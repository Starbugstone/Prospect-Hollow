import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGem } from '../src/game/engine/GemFactory';
import { TileManager } from '../src/game/engine/TileManager';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { HOLLOW_MINE_CHAPTERS } from '../src/data/hollowMineLevels';

const COLS = 5;
const ROWS = 5;
const COLORS = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'];
const at = (row, col) => row * COLS + col;
const seal = (next, health = 1) => ({
  type: 'standard',
  health,
  maxHealth: health,
  phaseSeal: true,
  phaseNext: next,
});
const makeState = (extra = {}) => {
  const tiles = Array.from({ length: COLS * ROWS }, (_, index) => ({
    type: 'standard',
    health: 0,
    maxHealth: 0,
    ...(extra[index] ?? {}),
  }));
  const board = tiles.map((_, index) =>
    createGem(COLORS[((index % COLS) + Math.floor(index / COLS) * 2) % COLORS.length]),
  );
  return { board, tiles, cols: COLS, rows: ROWS, gemTypes: COLORS };
};
const manager = new TileManager();
const clear = (state, indices) =>
  manager.getResolution({ ...state, matches: [{ type: 'bonus-activation', indices }] });

afterEach(() => vi.restoreAllMocks());

describe('phase seals', () => {
  it('change their gem once the move settles, then show a different next colour', () => {
    const state = makeState({ [at(0, 4)]: seal('ruby') });
    const id = state.board[at(0, 4)].id;
    const result = clear(state, [at(4, 0)]);
    const shift = result.steps.find((step) => step.phaseShifts);
    expect(shift.phaseShifts).toEqual([
      expect.objectContaining({ index: at(0, 4), gem: expect.objectContaining({ id }) }),
    ]);
    expect(result.board[at(0, 4)]).toMatchObject({ id, type: 'ruby' });
    expect(state.tiles[at(0, 4)].phaseNext).not.toBe('ruby');
    expect(COLORS).toContain(state.tiles[at(0, 4)].phaseNext);
    expect(result.steps.filter((step) => step.phaseShifts)).toHaveLength(1);
  });

  it('clears a line the change completes, earning bonuses like any cascade', () => {
    // Row 2 holds four emeralds around the seal, which turns its gem emerald too.
    const state = makeState({ [at(2, 2)]: seal('emerald') });
    for (const col of [0, 1, 3, 4]) state.board[at(2, col)] = createGem('emerald');
    state.board[at(2, 2)] = createGem('ruby');
    state.board[at(1, 2)] = createGem('topaz');
    state.board[at(3, 2)] = createGem('sapphire');
    // Clearing the top right corner refills it (with an amethyst) without moving row 2.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const result = clear(state, [at(0, 4)]);
    const shiftAt = result.steps.findIndex((step) => step.phaseShifts);
    const cascade = result.steps[shiftAt + 1];
    expect(cascade.matches[0].indices).toEqual(
      expect.arrayContaining([at(2, 0), at(2, 1), at(2, 2), at(2, 3), at(2, 4)]),
    );
    expect(cascade.bonuses.map(({ type }) => type)).toEqual(['rainbow']);
    // The match on the seal wears it down.
    expect(state.tiles[at(2, 2)].health).toBe(0);
  });

  it('stop changing gems once broken', () => {
    const state = makeState({ [at(0, 4)]: { ...seal('ruby'), health: 0 } });
    const result = clear(state, [at(4, 0)]);
    expect(result.steps.some((step) => step.phaseShifts)).toBe(false);
  });

  it('start every generated seal with a next colour that differs from its gem', () => {
    const first = 403 + HOLLOW_MINE_CHAPTERS.findIndex(({ id }) => id === 'phase-vault') * 6;
    const levels = generateLevelConfigs(first + 5).slice(first - 1);
    let seals = 0;
    for (const level of levels)
      for (const [index, tile] of level.tiles.entries()) {
        if (!tile.phaseSeal) continue;
        seals++;
        expect(level.boardLayout.gemTypes).toContain(tile.phaseNext);
        expect(tile.phaseNext).not.toBe(level.board[index].type);
        expect(tile.health).toBeGreaterThan(0);
      }
    expect(seals).toBeGreaterThan(20);
  });
});
