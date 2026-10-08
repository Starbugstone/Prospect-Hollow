import { describe, expect, it } from 'vitest';
import { createGem } from '../src/game/engine/GemFactory';
import { TileManager } from '../src/game/engine/TileManager';
import { BonusActivator } from '../src/game/engine/BonusActivator';
import { HintEngine } from '../src/game/engine/HintEngine';
import { bentBeams, lensGeometry } from '../src/game/engine/LensBeams';

const COLS = 5;
const ROWS = 5;
const COLORS = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'];
const at = (row, col) => row * COLS + col;
const makeState = (extra = {}) => {
  const tiles = Array.from({ length: COLS * ROWS }, (_, index) => ({
    type: 'standard',
    health: 0,
    maxHealth: 0,
    ...(extra[index] ?? {}),
  }));
  const board = tiles.map((tile, index) =>
    tile.type === 'standard'
      ? createGem(COLORS[((index % COLS) + Math.floor(index / COLS) * 2) % COLORS.length])
      : null,
  );
  return { board, tiles, cols: COLS, rows: ROWS };
};
const lens = (out) => ({ type: 'void', health: 0, maxHealth: 0, lens: out });
const starglass = (health = 1) => ({
  type: 'blocker',
  health,
  maxHealth: health,
  bonusOnly: true,
  lensOnly: true,
});

describe('lens beams', () => {
  it('turns a row sweep square at an edge lens', () => {
    const { tiles } = makeState({ [at(1, 0)]: lens('s') });
    const { cells, beams } = bentBeams(tiles, COLS, ROWS, [{ axis: 'row', index: 1 }]);
    expect(cells).toEqual([at(2, 0), at(3, 0), at(4, 0)]);
    expect(beams).toEqual([{ lens: at(1, 0), cells: [at(2, 0), at(3, 0), at(4, 0)] }]);
  });

  it('sends a diagonal lens beam corner to corner', () => {
    const { tiles } = makeState({ [at(0, 0)]: lens('se') });
    const { cells } = bentBeams(tiles, COLS, ROWS, [{ axis: 'column', index: 0 }]);
    expect(cells).toEqual([at(1, 1), at(2, 2), at(3, 3), at(4, 4)]);
  });

  it('chains through a second lens and never loops', () => {
    const { tiles } = makeState({
      [at(1, 0)]: lens('s'),
      [at(4, 0)]: lens('n'),
    });
    const { cells, beams } = bentBeams(tiles, COLS, ROWS, [{ axis: 'row', index: 1 }]);
    expect(cells).toEqual([at(2, 0), at(3, 0)]);
    expect(beams.map((beam) => beam.lens)).toEqual([at(1, 0), at(4, 0)]);
  });

  it('ignores sweeps whose line does not end at a lens', () => {
    const { tiles } = makeState({ [at(1, 0)]: lens('s') });
    expect(bentBeams(tiles, COLS, ROWS, [{ axis: 'row', index: 2 }]).cells).toEqual([]);
  });

  it('adds turned cells to a cross and records them for starglass', () => {
    const state = makeState({ [at(1, 0)]: lens('s') });
    const lenses = { bent: new Set(), beams: [] };
    const indices = new BonusActivator().activateBonus('cross', state.board, COLS, ROWS, at(1, 3), {
      tiles: state.tiles,
      lenses,
    });
    expect(indices).toEqual(expect.arrayContaining([at(2, 0), at(3, 0), at(4, 0)]));
    expect([...lenses.bent]).toEqual([at(2, 0), at(3, 0), at(4, 0)]);
  });

  it('draws silver mirrors and gold prisms at their real angle', () => {
    expect(lensGeometry(at(1, 0), 's', COLS, ROWS)).toEqual({ out: [0, 1], angle: 135 });
    const prism = lensGeometry(at(0, 0), 'se', COLS, ROWS);
    expect(prism.out[0]).toBeCloseTo(Math.SQRT1_2);
    expect(prism.out[1]).toBeCloseTo(Math.SQRT1_2);
  });
});

describe('starglass', () => {
  const manager = new TileManager();

  it('shrugs off a direct cross but breaks under a lens-turned beam', () => {
    const state = makeState({ [at(1, 0)]: lens('s'), [at(3, 0)]: starglass() });
    state.board[at(3, 0)] = null;
    // A cross in row 3 hits the starglass directly: no damage.
    const straight = new BonusActivator();
    const blasts = new Map();
    blasts.lenses = { bent: new Set(), beams: [] };
    const tiles = state.tiles.map((tile) => ({ ...tile }));
    const hit = straight.activatePower('cross', state.board, COLS, ROWS, at(3, 2), tiles, blasts);
    expect(hit).toContain(at(3, 0));
    const first = manager.getResolution({
      ...state,
      tiles,
      gemTypes: COLORS,
      matches: [{ type: 'cross', indices: hit, blasts }],
    });
    expect(tiles[at(3, 0)].health).toBe(1);
    expect(first.layersCleared ?? 0).toBe(0);
    // A cross in row 1 turns at the lens and runs down column 0 through the starglass.
    const turned = new Map();
    turned.lenses = { bent: new Set(), beams: [] };
    const tiles2 = state.tiles.map((tile) => ({ ...tile }));
    const beam = straight.activatePower('cross', state.board, COLS, ROWS, at(1, 2), tiles2, turned);
    const second = manager.getResolution({
      ...state,
      tiles: tiles2,
      gemTypes: COLORS,
      matches: [{ type: 'cross', indices: beam, blasts: turned }],
    });
    expect(tiles2[at(3, 0)].health).toBe(0);
    expect(second.layersCleared).toBeGreaterThanOrEqual(1);
    expect(second.steps[0].lensBeams).toEqual([
      { lens: at(1, 0), cells: [at(2, 0), at(3, 0), at(4, 0)] },
    ]);
  });

  it('is never picked by a rainbow and resists a fusion that is not turned', () => {
    const state = makeState({ [at(2, 2)]: starglass() });
    state.board[at(2, 2)] = null;
    const tiles = state.tiles.map((tile) => ({ ...tile }));
    const rainbow = new BonusActivator().activateBonus('rainbow', state.board, COLS, ROWS, 0, {
      tiles,
      targetType: 'ruby',
    });
    expect(rainbow).not.toContain(at(2, 2));
    manager.getResolution({
      ...state,
      tiles,
      gemTypes: COLORS,
      matches: [
        {
          type: 'bonus-activation',
          indices: [at(2, 2), at(2, 1)],
          fusion: { targets: [at(2, 2), at(2, 1)] },
        },
      ],
    });
    expect(tiles[at(2, 2)].health).toBe(1);
  });

  it('turns spore bursts too', () => {
    const state = makeState({
      [at(1, 0)]: lens('s'),
      [at(4, 0)]: starglass(),
      [at(1, 3)]: {
        type: 'standard',
        health: 0,
        signal: 'spore',
        signalHealth: 1,
        sporeAxis: 'row',
      },
    });
    state.board[at(4, 0)] = null;
    const tiles = state.tiles.map((tile) => ({ ...tile }));
    // A vertical match beside the mushroom fires its row, which turns at the lens.
    const result = manager.getResolution({
      ...state,
      tiles,
      gemTypes: COLORS,
      matches: [{ type: 'ruby', indices: [at(0, 4), at(1, 4), at(2, 4)] }],
    });
    expect(tiles[at(4, 0)].health).toBe(0);
    expect(result.steps.some((step) => step.lensBeams?.length)).toBe(true);
  });

  it('guides hints towards a lens shot that breaks starglass', () => {
    const state = makeState({ [at(1, 0)]: lens('s'), [at(3, 0)]: starglass() });
    state.board[at(3, 0)] = null;
    state.board[at(1, 2)] = createGem('cross');
    state.board[at(3, 3)] = createGem('cross');
    const hint = new HintEngine().findBestMove(state.board, state.tiles, COLS, ROWS);
    expect(hint.swap.aIndex === at(1, 2) || hint.swap.bIndex === at(1, 2)).toBe(true);
  });
});
