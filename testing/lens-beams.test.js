import { describe, expect, it, vi } from 'vitest';
import { createGem } from '../src/game/engine/GemFactory';
import { TileManager } from '../src/game/engine/TileManager';
import { BonusActivator } from '../src/game/engine/BonusActivator';
import { HintEngine } from '../src/game/engine/HintEngine';
import { getBonusFusion } from '../src/game/engine/BonusFusion';
import {
  bentBeams,
  blastLog,
  lensGeometry,
  lensLog,
  recordLensBeams,
} from '../src/game/engine/LensBeams';

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
    const lenses = lensLog();
    const indices = new BonusActivator().activateBonus('cross', state.board, COLS, ROWS, at(1, 3), {
      tiles: state.tiles,
      lenses,
    });
    expect(indices).toEqual(expect.arrayContaining([at(2, 0), at(3, 0), at(4, 0)]));
    expect([...lenses.bent]).toEqual([at(2, 0), at(3, 0), at(4, 0)]);
  });

  it('counts a looping beam once despite repeated input lines and retraced cells', () => {
    const { tiles } = makeState({
      [at(1, 0)]: lens('s'),
      [at(4, 0)]: lens('n'),
    });
    const lenses = lensLog();
    recordLensBeams(
      lenses,
      bentBeams(tiles, COLS, ROWS, [
        { axis: 'row', index: 1 },
        { axis: 'row', index: 1 },
      ]),
    );
    expect([...lenses.hits]).toEqual([
      [at(2, 0), 1],
      [at(3, 0), 1],
    ]);
    expect(lenses.beams).toHaveLength(2);
  });

  it('turns one hit per activation when both of its sweeps reach the same corner lens', () => {
    const { tiles } = makeState({ [at(0, 0)]: lens('se') });
    const lenses = lensLog();
    recordLensBeams(
      lenses,
      bentBeams(tiles, COLS, ROWS, [
        { axis: 'row', index: 0 },
        { axis: 'column', index: 0 },
      ]),
    );
    expect(lenses.hits.get(at(2, 2))).toBe(1);
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

  // Keep damage regressions independent of random refills and later cascades.
  const resolve = (state, matches) => {
    const resolver = new TileManager();
    vi.spyOn(resolver, 'applyGravity').mockImplementation(() => {});
    return resolver.getResolution({ ...state, gemTypes: COLORS, matches });
  };
  const fireChain = (state, index) => {
    const blasts = blastLog();
    const indices = new BonusActivator().activate(
      state.board,
      COLS,
      ROWS,
      { aIndex: index, bIndex: -1 },
      null,
      null,
      state.tiles,
      blasts,
    );
    return { type: 'bonus-activation', indices, blasts };
  };

  it.each([1, 2])(
    'removes only one of %i layers for a turned beam plus direct blasts',
    (health) => {
      const target = at(1, 3);
      const state = makeState({ [at(1, 0)]: lens('e'), [target]: starglass(health) });
      state.board[at(1, 1)] = createGem('cross');
      state.board[at(2, 1)] = createGem('cross');
      state.board[at(2, 3)] = createGem('bomb');
      const match = fireChain(state, at(1, 1));
      expect(match.blasts.get(target)).toBe(2);
      expect(match.blasts.lenses.hits.get(target)).toBe(1);
      const result = resolve(state, [match]);
      expect(state.tiles[target].health).toBe(health - 1);
      expect(result.layersCleared).toBe(1);
      expect(state.tiles[target].type).toBe(health === 1 ? 'standard' : 'blocker');
    },
  );

  it('counts two bonuses through the same lens in a single chain separately', () => {
    const target = at(3, 0);
    const state = makeState({ [at(1, 0)]: lens('s'), [target]: starglass(2) });
    state.board[at(1, 1)] = createGem('cross');
    state.board[at(1, 3)] = createGem('cross');
    const match = fireChain(state, at(1, 1));
    expect(match.blasts.lenses.hits.get(target)).toBe(2);
    const result = resolve(state, [match]);
    expect(state.tiles[target].health).toBe(0);
    expect(result.layersCleared).toBe(2);
  });

  it('turns one hit from a sweep that reaches lenses at both ends', () => {
    const target = at(1, 2);
    const state = makeState({
      [at(1, 0)]: lens('e'),
      [at(1, 4)]: lens('w'),
      [target]: starglass(2),
    });
    state.board[at(1, 1)] = createGem('cross');
    const match = fireChain(state, at(1, 1));
    expect(match.blasts.lenses.hits.get(target)).toBe(1);
    resolve(state, [match]);
    expect(state.tiles[target].health).toBe(1);
  });

  it('does not count a returning segment as another turned beam', () => {
    const target = at(3, 0);
    const state = makeState({
      [at(1, 0)]: lens('s'),
      [at(4, 0)]: lens('n'),
      [target]: starglass(2),
    });
    state.board[at(1, 2)] = createGem('cross');
    const match = fireChain(state, at(1, 2));
    expect(match.blasts.lenses.beams).toHaveLength(2);
    expect(match.blasts.lenses.hits.get(target)).toBe(1);
    resolve(state, [match]);
    expect(state.tiles[target].health).toBe(1);
  });

  it.each([0, 1, 2])(
    'a fusion with %i turned beams removes only that many starglass layers',
    (count) => {
      const target = at(3, 0);
      const crate = at(3, 2);
      const state = makeState({
        [at(1, 0)]: lens('s'),
        [target]: starglass(2),
        [crate]: { type: 'blocker', health: 2, maxHealth: 2, bonusOnly: true },
      });
      state.board[at(2, 1)] = createGem('bomb');
      state.board[at(2, 2)] = createGem('bomb');
      for (let i = 0; i < count; i++) state.board[at(1, i + 1)] = createGem('cross');
      const swap = { aIndex: at(2, 1), bIndex: at(2, 2) };
      const fusion = getBonusFusion(state.board, COLS, ROWS, swap);
      const blasts = blastLog();
      const indices = new BonusActivator().activate(
        state.board,
        COLS,
        ROWS,
        swap,
        fusion,
        null,
        state.tiles,
        blasts,
      );
      expect(fusion.targets).toContain(target);
      expect(blasts.lenses.hits.get(target) ?? 0).toBe(count);
      resolve(state, [{ type: 'bonus-activation', indices, fusion, blasts }]);
      expect(state.tiles[target].health).toBe(2 - count);
      expect(state.tiles[crate].health).toBe(0);
    },
  );

  it('keeps ordinary blast-only crates vulnerable to every separate blast', () => {
    const target = at(1, 3);
    const state = makeState({
      [at(1, 0)]: lens('e'),
      [target]: { type: 'blocker', health: 2, maxHealth: 2, bonusOnly: true },
    });
    state.board[at(1, 2)] = createGem('cross');
    state.board[at(2, 2)] = createGem('bomb');
    resolve(state, [fireChain(state, at(1, 2))]);
    expect(state.tiles[target].health).toBe(0);
  });

  it.each([1, 2])('direct blasts leave %i-layer starglass intact before a turned hit', (health) => {
    const state = makeState({ [at(1, 0)]: lens('s'), [at(3, 0)]: starglass(health) });
    state.board[at(3, 0)] = null;
    // A cross in row 3 hits the starglass directly: no damage.
    const straight = new BonusActivator();
    const blasts = blastLog();
    const tiles = state.tiles.map((tile) => ({ ...tile }));
    const hit = straight.activatePower('cross', state.board, COLS, ROWS, at(3, 2), tiles, blasts);
    expect(hit).toContain(at(3, 0));
    const first = manager.getResolution({
      ...state,
      tiles,
      gemTypes: COLORS,
      matches: [{ type: 'cross', indices: hit, blasts }],
    });
    expect(tiles[at(3, 0)].health).toBe(health);
    expect(first.layersCleared ?? 0).toBe(0);
    // A cross in row 1 turns at the lens and runs down column 0 through the starglass.
    const turned = blastLog();
    const tiles2 = state.tiles.map((tile) => ({ ...tile }));
    const beam = straight.activatePower('cross', state.board, COLS, ROWS, at(1, 2), tiles2, turned);
    const second = manager.getResolution({
      ...state,
      tiles: tiles2,
      gemTypes: COLORS,
      matches: [{ type: 'cross', indices: beam, blasts: turned }],
    });
    expect(tiles2[at(3, 0)].health).toBe(health - 1);
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

  it.each([1, 2])('turns a spore burst onto %i-layer starglass', (health) => {
    const state = makeState({
      [at(1, 0)]: lens('s'),
      [at(4, 0)]: starglass(health),
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
    expect(tiles[at(4, 0)].health).toBe(health - 1);
    expect(result.steps.some((step) => step.lensBeams?.length)).toBe(true);
  });

  it('counts two simultaneous spore relays through the same lens separately', () => {
    const target = at(4, 0);
    const spore = { signal: 'spore', signalHealth: 1, sporeAxis: 'row' };
    const state = makeState({
      [at(1, 0)]: lens('s'),
      [target]: starglass(2),
      [at(1, 2)]: spore,
      [at(1, 3)]: spore,
    });
    const result = resolve(state, [{ type: 'ruby', indices: [at(2, 2), at(2, 3), at(2, 4)] }]);
    expect(result.steps.find((step) => step.sporeBursts)?.sporeBursts).toHaveLength(2);
    expect(state.tiles[target].health).toBe(0);
  });

  it.each([1, 2])('guides hints towards a turned hit on %i-layer starglass', (health) => {
    const state = makeState({ [at(1, 0)]: lens('s'), [at(3, 0)]: starglass(health) });
    state.board[at(3, 0)] = null;
    state.board[at(1, 2)] = createGem('cross');
    state.board[at(3, 3)] = createGem('cross');
    const hint = new HintEngine().findBestMove(state.board, state.tiles, COLS, ROWS);
    expect(hint.swap.aIndex === at(1, 2) || hint.swap.bIndex === at(1, 2)).toBe(true);
  });
});
