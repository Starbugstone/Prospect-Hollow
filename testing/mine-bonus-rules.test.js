import { afterEach, describe, expect, it, vi } from 'vitest';
import { BonusActivator } from '../src/game/engine/BonusActivator';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { TileManager } from '../src/game/engine/TileManager';
import { createGem, GEM_TYPES } from '../src/game/engine/GemFactory';
import { describeBonusEffects } from '../src/game/phaser/BonusEffects';
import { HintEngine } from '../src/game/engine/HintEngine';
const engine = new MatchEngine();
const activator = new BonusActivator();
const fixture = () => {
  const board = Array.from({ length: 36 }, (_, i) =>
    createGem(GEM_TYPES[((i % 6) + 2 * Math.floor(i / 6)) % 6]),
  );
  return { board, tiles: board.map(() => ({ type: 'standard', health: 0 })), cols: 6, rows: 6 };
};
afterEach(() => vi.restoreAllMocks());

describe('rainbows against blast-only crates', () => {
  const crates = [28, 30, 35];
  const setup = () => {
    const state = fixture();
    state.board[0] = createGem('rainbow');
    for (const index of crates) {
      state.board[index] = null;
      state.tiles[index] = { type: 'blocker', health: 2, maxHealth: 2, bonusOnly: true };
    }
    return state;
  };

  it('adds one crate to a swapped colour and records one blast hit', () => {
    const state = setup();
    const evaluation = engine.evaluateSwap(state.board, 6, 6, 0, 1, state.tiles);
    const match = evaluation.matches[0];
    const colors = evaluation.board.flatMap((gem, i) =>
      gem?.type === state.board[1].type || i === 1 ? [i] : [],
    );
    expect(match.indices.sort((a, b) => a - b)).toEqual([...colors, 28].sort((a, b) => a - b));
    expect(match.blasts.get(28)).toBe(1);
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
    const { steps } = new TileManager().getResolution({ ...evaluation, tiles: state.tiles });
    expect(crates.map((i) => state.tiles[i].health)).toEqual([1, 2, 2]);
    expect(describeBonusEffects(steps[0], (i) => evaluation.board[i]?.type)[0].targets).toContain(
      28,
    );
  });

  it.each([
    [0, 1],
    [0.5, 2],
    [0.999999, 3],
  ])('double-tap roll %s hits %i distinct crates alongside the dominant colour', (roll, count) => {
    const state = setup();
    for (const i of [1, 2, 3]) state.board[i] = createGem('emerald');
    vi.spyOn(Math, 'random').mockReturnValue(roll);
    const evaluation = engine.evaluateActivation(state.board, 6, 6, 0, state.tiles);
    const match = evaluation.matches[0];
    const hit = crates.filter((i) => match.indices.includes(i));
    expect(hit).toHaveLength(count);
    expect(match.indices.filter((i) => !crates.includes(i)).sort((a, b) => a - b)).toEqual(
      state.board.flatMap((gem, i) => (gem?.type === 'emerald' || i === 0 ? [i] : [])),
    );
    for (const index of hit) expect(match.blasts.get(index)).toBe(1);
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
    new TileManager().getResolution({ ...evaluation, tiles: state.tiles });
    expect(crates.map((i) => state.tiles[i].health)).toEqual(
      crates.map((i) => (hit.includes(i) ? 1 : 2)),
    );
  });

  it('can pick a later crate and ignores completed crates, ordinary stone and holes', () => {
    const state = setup();
    state.tiles[28].health = 0;
    state.tiles[30].bonusOnly = false;
    state.tiles[34] = { type: 'void', health: 2, bonusOnly: true };
    state.board[34] = null;
    state.tiles[35].health = 1;
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    const evaluation = engine.evaluateActivation(state.board, 6, 6, 0, state.tiles);
    expect(crates.filter((i) => evaluation.matches[0].indices.includes(i))).toEqual([35]);
    expect(evaluation.matches[0].indices).not.toContain(34);
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
    new TileManager().getResolution({ ...evaluation, tiles: state.tiles });
    expect(state.tiles[35]).toMatchObject({ type: 'standard', health: 0 });
  });

  it('chooses crate locations randomly without replacement', () => {
    const state = setup();
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.999999);
    const { matches } = engine.evaluateActivation(state.board, 6, 6, 0, state.tiles);
    expect(crates.filter((i) => matches[0].indices.includes(i))).toEqual([35]);
  });

  it('includes a crate in chained rainbows and previews without consuming randomness', () => {
    const state = setup();
    const random = vi.spyOn(Math, 'random');
    expect(activator.previewBonus('rainbow', state.board, 6, 6, 0, state.tiles)).toContain(28);
    expect(activator.activatePower('tnt', state.board, 6, 6, 1, state.tiles)).toContain(28);
    expect(new HintEngine().findBestMove(state.board, state.tiles, 6, 6)).not.toBeNull();
    expect(random).not.toHaveBeenCalled();
  });
});

it('activates a rainbow in place against the most common color without randomness or collateral colors', () => {
  const { board, tiles } = fixture();
  board[0] = createGem('rainbow');
  for (const i of [1, 2, 3]) board[i] = createGem('emerald');
  const expected = board.flatMap((gem, i) => (gem.type === 'emerald' || i === 0 ? [i] : []));
  const random = vi.spyOn(Math, 'random');
  expect(
    engine.evaluateActivation(board, 6, 6, 0, tiles).matches[0].indices.sort((a, b) => a - b),
  ).toEqual(expected);
  expect(random).not.toHaveBeenCalled();
});

it.each(['tnt', 'clear-row', 'tile-breaker'])(
  '%s chains a cross and then a remote bomb, including its full preview',
  (type) => {
    const state = fixture();
    state.board[1] = createGem('cross');
    state.board[31] = createGem('bomb');
    const targets = activator.activatePower(type, state.board, 6, 6, 0, state.tiles);
    expect(targets).toEqual(expect.arrayContaining([1, 31, 32]));
    expect(activator.previewBonus(type, state.board, 6, 6, 0, state.tiles)).toEqual(targets);
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
    const { steps } = new TileManager().getResolution({
      ...state,
      matches: [{ type, indices: targets }],
    });
    steps[0].bonusEffect = { type, originIndex: 0 };
    const effects = describeBonusEffects(steps[0], (i) => state.board[i]?.type);
    expect(effects.map(({ type }) => type)).toEqual([type, 'cross', 'bomb']);
    expect(steps[0].cleared).toEqual(expect.arrayContaining([1, 31, 32]));
    expect(new Set(steps[0].collectedJewels.map(({ id }) => id)).size).toBe(
      steps[0].collectedJewels.length,
    );
  },
);

it('does not let a color wand select a bonus or relic as though it were a color', () => {
  const { board, tiles } = fixture();
  for (const type of ['bomb', 'rainbow', 'cross', 'relic']) {
    board[0] = createGem(type);
    expect(activator.activatePower('color-wand', board, 6, 6, 0, tiles)).toEqual([]);
    expect(activator.previewBonus('color-wand', board, 6, 6, 0, tiles)).toEqual([]);
  }
});

describe.each(['chain', 'frozen'])('%s bonus anchoring', (anchor) => {
  it.each(['board', 'toolbar'])(
    'releases but does not detonate an anchored cross hit by a %s bomb',
    (source) => {
      const state = fixture();
      state.board[0] = createGem('bomb');
      const cross = (state.board[7] = createGem('cross'));
      if (anchor === 'chain') state.tiles[7].chainHealth = 1;
      else state.tiles[7].state = 'FROZEN';
      const indices =
        source === 'board'
          ? engine.evaluateActivation(state.board, 6, 6, 0, state.tiles).matches[0].indices
          : activator.activatePower('tnt', state.board, 6, 6, 0, state.tiles);
      expect(indices).not.toContain(31);
      vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
      const result = new TileManager().getResolution({
        ...state,
        matches: [{ type: 'bonus-activation', indices }],
      });
      expect(result.steps[0].cleared).not.toContain(7);
      expect(result.steps[0].cleared).not.toContain(31);
      expect(result.board).toContain(cross);
      const index = result.board.indexOf(cross);
      expect(
        engine.evaluateActivation(result.board, 6, 6, index, state.tiles).matches,
      ).toHaveLength(1);
    },
  );
  it('lets a fusion chain the cross only when its two hits also consume it', () => {
    const state = fixture();
    state.board[0] = createGem('bomb');
    state.board[1] = createGem('bomb');
    state.board[7] = createGem('cross');
    if (anchor === 'chain') state.tiles[7].chainHealth = 1;
    else state.tiles[7].state = 'FROZEN';
    const evaluation = engine.evaluateSwap(state.board, 6, 6, 0, 1, state.tiles);
    expect(evaluation.matches[0].indices).toContain(31);
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
    const result = new TileManager().getResolution({ ...evaluation, tiles: state.tiles });
    expect(result.steps[0].cleared).toEqual(expect.arrayContaining([7, 31]));
  });
});

it('does not chain through a two-link chain that absorbs both fusion hits', () => {
  const state = fixture();
  state.board[0] = createGem('bomb');
  state.board[1] = createGem('bomb');
  state.board[7] = createGem('cross');
  state.tiles[7].chainHealth = 2;
  const evaluation = engine.evaluateSwap(state.board, 6, 6, 0, 1, state.tiles);
  expect(evaluation.matches[0].indices).not.toContain(31);
  vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
  const result = new TileManager().getResolution({ ...evaluation, tiles: state.tiles });
  expect(result.steps[0].cleared).not.toContain(7);
  expect(state.tiles[7].chainHealth).toBe(0);
});
