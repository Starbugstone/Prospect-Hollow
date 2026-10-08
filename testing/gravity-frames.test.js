import { describe, expect, it } from 'vitest';
import { createGem } from '../src/game/engine/GemFactory';
import { TileManager } from '../src/game/engine/TileManager';
import { HintEngine } from '../src/game/engine/HintEngine';
import { canSwapCells } from '../src/game/engine/TileRules';
import {
  cargoPath,
  cargoReachesExit,
  gravityFrames,
  strandedCargo,
} from '../src/game/engine/GravityFrames';

const manager = new TileManager();
const COLS = 5;
const ROWS = 5;
// A board with no ready-made matches: five colours offset per row.
const COLORS = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'];
const makeState = ({ up = () => false, extra = {} } = {}) => {
  const board = Array.from({ length: COLS * ROWS }, (_, index) =>
    createGem(COLORS[((index % COLS) + Math.floor(index / COLS) * 2) % COLORS.length]),
  );
  const tiles = board.map((_, index) => ({
    type: 'standard',
    health: 0,
    maxHealth: 0,
    ...(up(Math.floor(index / COLS)) ? { fall: 'up' } : {}),
    ...(extra[index] ?? {}),
  }));
  return { board, tiles, cols: COLS, rows: ROWS };
};
const float = () => ({ ...createGem('relic'), float: true });
const pearl = () => createGem('relic');
const clear = (state, indices) =>
  manager.getResolution({
    ...state,
    gemTypes: COLORS,
    matches: [{ type: 'bonus-activation', indices }],
  });
const column = (board, col) =>
  Array.from({ length: ROWS }, (_, row) => board[row * COLS + col]?.id);

describe('gravity frames', () => {
  it('groups rows into frames by direction', () => {
    expect(gravityFrames(makeState().tiles, COLS, ROWS)).toEqual([
      { start: 0, end: 5, dir: 'down' },
    ]);
    expect(gravityFrames(makeState({ up: (row) => row < 2 }).tiles, COLS, ROWS)).toEqual([
      { start: 0, end: 2, dir: 'up' },
      { start: 2, end: 5, dir: 'down' },
    ]);
  });

  it('lets gems fall up and refills from the bottom on an inverted board', () => {
    const state = makeState({ up: () => true });
    const before = column(state.board, 0);
    const result = clear(state, [10]);
    const after = column(result.board, 0);
    // Rows 3 and 4 rise one cell; the refill enters at the bottom.
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
    expect(after.slice(2, 4)).toEqual(before.slice(3, 5));
    const fall = result.steps[0];
    expect(fall.spawns).toEqual([expect.objectContaining({ index: 20, path: [20], rise: true })]);
    expect(fall.drops.map(({ from, to, rise }) => ({ from, to, rise }))).toEqual([
      { from: 15, to: 10, rise: true },
      { from: 20, to: 15, rise: true },
    ]);
  });

  it('refills a split board from the middle seam outwards', () => {
    const state = makeState({ up: (row) => row < 2 });
    const result = clear(state, [0, 24]);
    const spawned = result.steps[0].spawns.map(({ index }) => index).sort((a, b) => a - b);
    // The top frame refills at its lowest row, the bottom frame at its top row.
    expect(spawned).toEqual([5, 14]);
  });
});

describe('floatstones', () => {
  it('rise into the gap above them while gems sink past', () => {
    const state = makeState();
    state.board[16] = float();
    const [g1, g6] = [state.board[1], state.board[6]];
    const result = clear(state, [11]);
    expect(result.board[11]).toBe(state.board[16]);
    expect(result.board[16]).toBe(g6);
    expect(result.board[6]).toBe(g1);
    const rise = result.steps[0].drops.find((drop) => drop.gem.float);
    expect(rise).toMatchObject({ from: 16, to: 11, path: [16, 11] });
  });

  it('stay put when a gem below them is cleared', () => {
    const state = makeState();
    state.board[11] = float();
    const result = clear(state, [21]);
    expect(result.board[11]).toBe(state.board[11]);
    expect(result.steps[0].drops.some((drop) => drop.gem.float)).toBe(false);
  });

  it('collect at a sky hatch on the top row', () => {
    const state = makeState({ extra: { 1: { exit: true } } });
    state.board[6] = float();
    const result = clear(state, [1]);
    expect(result.relicsCollected).toBe(1);
    expect(result.board.some((gem) => gem?.float)).toBe(false);
  });

  it('sink on an inverted board and collect at the bottom', () => {
    const state = makeState({ up: () => true, extra: { 21: { exit: true } } });
    state.board[16] = float();
    expect(cargoPath(state.board, state.tiles, 16, COLS, ROWS)).toEqual([16, 21]);
    const result = clear(state, [21]);
    expect(result.relicsCollected).toBe(1);
  });

  it('let a bonus swap with a floatstone only when it can still reach a hatch', () => {
    const state = makeState({ extra: { 1: { exit: true } } });
    state.board[11] = float();
    state.board[12] = createGem('bomb');
    state.board[10] = createGem('bomb');
    // Column 2 has no hatch; column 0 neither. Only column 1 leads to one.
    expect(canSwapCells(state.board, state.tiles, 11, 12, COLS, ROWS)).toBe(false);
    state.tiles[2].exit = true;
    expect(canSwapCells(state.board, state.tiles, 11, 12, COLS, ROWS)).toBe(true);
  });

  it('report cargo that cannot reach an exit in the current gravity', () => {
    const state = makeState({ extra: { 21: { exit: true } } });
    state.board[16] = float();
    state.board[11] = pearl();
    state.board[13] = pearl();
    expect(cargoReachesExit(state.board, state.tiles, 16, COLS, ROWS)).toBe(false);
    expect(cargoReachesExit(state.board, state.tiles, 11, COLS, ROWS)).toBe(true);
    expect(strandedCargo(state.board, state.tiles, COLS, ROWS)).toEqual([13, 16]);
  });

  it('guide hints towards the cells above a floatstone', () => {
    const state = makeState({ extra: { 1: { exit: true } } });
    state.board[16] = float();
    // Moves near the floatstone's column beat an equal three-gem move far away.
    state.board[1] = createGem('ruby');
    state.board[7] = createGem('ruby');
    state.board[23] = createGem('ruby');
    const hint = new HintEngine().findBestMove(state.board, state.tiles, COLS, ROWS);
    expect([hint.swap.aIndex, hint.swap.bIndex]).toContain(7);
  });

  it('never lose or invent cargo through long cascades', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = makeState({ up: (row) => seed % 2 === 0 && row < 3 });
      state.board[seed % 25] = float();
      state.board[(seed * 7) % 25] = pearl();
      const cargo = state.board.filter((gem) => gem?.type === 'relic').length;
      const result = clear(state, [(seed * 3) % 25, (seed * 11) % 25]);
      expect(result.board.every(Boolean)).toBe(true);
      expect(
        result.board.filter((gem) => gem?.type === 'relic').length + result.relicsCollected,
      ).toBe(cargo);
      const ids = result.board.map((gem) => gem.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('gravity switches', () => {
  const blast = (state, indices) =>
    manager.getResolution({
      ...state,
      gemTypes: COLORS,
      matches: [{ type: 'bonus-activation', indices }],
    });

  it('turn the whole cavern over when a bonus blast hits a moon lock, once', () => {
    const state = makeState({ up: () => true, extra: { 20: { gravitySwitch: 'lock' } } });
    const result = blast(state, [20, 21]);
    expect(result.steps[0].gravityFlip).toEqual({ index: 20, up: false });
    expect(state.tiles.every((tile) => tile.fall !== 'up')).toBe(true);
    expect(state.tiles[20].gravitySwitch).toBeNull();
    // The refill now enters from the top again.
    expect(result.steps[0].spawns.map(({ index }) => index).sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it('ignore ordinary matches beside or on a switch', () => {
    const state = makeState({ extra: { 20: { gravitySwitch: 'dial' } } });
    const result = manager.getResolution({
      ...state,
      gemTypes: COLORS,
      matches: [{ type: 'ruby', indices: [20, 21, 22] }],
    });
    expect(result.steps.some((step) => step.gravityFlip)).toBe(false);
    expect(state.tiles.some((tile) => tile.fall === 'up')).toBe(false);
  });

  it('flip a moon dial at most once per move and again on the next', () => {
    const state = makeState({
      extra: { 20: { gravitySwitch: 'dial' }, 24: { gravitySwitch: 'dial' } },
    });
    blast(state, [20, 24]);
    expect(state.tiles[0].fall).toBe('up');
    expect(state.tiles[20].gravitySwitch).toBe('dial');
    blast(state, [20]);
    expect(state.tiles[0].fall).toBeUndefined();
  });

  it('send pearls home or set floatstones sinking after a flip', () => {
    const state = makeState({
      up: () => true,
      extra: { 21: { exit: true }, 4: { gravitySwitch: 'lock' } },
    });
    state.board[6] = pearl();
    expect(strandedCargo(state.board, state.tiles, COLS, ROWS)).toEqual([6]);
    const hint = new HintEngine();
    state.board[3] = createGem('cross');
    const move = hint.findBestMove(state.board, state.tiles, COLS, ROWS);
    // Firing the cross along row 0 reaches the lock and frees the pearl.
    expect([move.swap.aIndex, move.swap.bIndex]).toContain(3);
  });
});
