import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { applyDeepMineSpec, deepMineProgress } from '../src/game/engine/DeepMineMechanics';
import { BonusActivator } from '../src/game/engine/BonusActivator';
import { recoverBoard } from '../src/game/engine/BoardRecovery';
import { createGem, GEM_TYPES } from '../src/game/engine/GemFactory';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { TileManager } from '../src/game/engine/TileManager';
import { canSwapGem, isAnchored, layerCount } from '../src/game/engine/TileRules';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';

const manager = new TileManager();
const makeState = (spec = {}) => {
  const board = Array.from({ length: 25 }, (_, index) =>
    createGem(GEM_TYPES[((index % 5) + Math.floor(index / 5) * 2) % GEM_TYPES.length]),
  );
  const tiles = applyDeepMineSpec(
    board.map(() => ({ type: 'standard', health: 0, maxHealth: 0 })),
    spec,
  );
  for (const [index, tile] of tiles.entries()) if (tile.type === 'blocker') board[index] = null;
  return { board, tiles, cols: 5, rows: 5 };
};
const resolve = (state, indices, type = 'ruby') =>
  manager.getResolution({ ...state, matches: [{ type, indices }] });
const finishStep = (state, result) => ({ ...state, board: result.board });
const footprint = [6, 7, 11, 12];
const roots = [{ id: 'a', knot: 12, bindings: [7, 11, 13, 17] }];

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
});

describe('fossil sediment', () => {
  beforeEach(() => vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]));

  it('reveals the floor on its own cells, leaving progress permanent and gems freely movable', () => {
    const state = makeState({ fossils: [{ id: 'shell', cells: footprint, layers: 2 }] });
    const result = resolve(state, [6, 7, 8]);
    expect(canSwapGem(state.board[11], state.tiles[11])).toBe(true);
    expect(state.tiles[6].health).toBe(1);
    expect(state.tiles[11].health).toBe(2);
    expect(state.tiles[12].health).toBe(2);
    expect(result.layersCleared).toBe(2);
    expect(deepMineProgress(state.tiles).fossils).toEqual({ total: 1, completed: 0 });
    expect(result.steps[0].collectedFossils).toBeUndefined();
  });

  it.each(['tnt', 'tile-breaker', 'clear-row', 'color-wand', 'bonus-activation'])(
    'automatically collects a fully exposed footprint using %s without a new gesture',
    (type) => {
      const state = makeState({ fossils: [{ id: 'shell', cells: footprint }] });
      const result = resolve(state, footprint, type);
      expect(result.layersCleared).toBe(footprint.length);
      expect(result.steps[0].collectedFossils).toEqual([{ group: 'shell', indices: footprint }]);
      expect(footprint.every((index) => state.tiles[index].fossilCollected)).toBe(true);
      expect(deepMineProgress(state.tiles).fossils).toEqual({ total: 1, completed: 1 });
      const repeated = resolve(finishStep(state, result), footprint, type);
      expect(repeated.layersCleared).toBe(0);
      expect(repeated.steps[0].collectedFossils).toBeUndefined();
    },
  );

  it('collects only the finished group and accepts the final patch during a later cascade', () => {
    const state = makeState({
      fossils: [
        { id: 'shell', cells: footprint },
        { id: 'fern', cells: [18, 19, 23, 24] },
      ],
    });
    MatchEngine.prototype.findMatches
      .mockReturnValueOnce([{ type: 'emerald', indices: [12] }])
      .mockReturnValue([]);
    const result = resolve(state, [6, 7, 11]);
    expect(result.steps[0].collectedFossils).toBeUndefined();
    expect(result.steps[1].collectedFossils).toEqual([{ group: 'shell', indices: footprint }]);
    expect(deepMineProgress(state.tiles).fossils).toEqual({ total: 2, completed: 1 });
    expect(state.tiles[18].health).toBe(1);
  });

  it('uncovers the last patch beneath an earned bonus and leaves that bonus available', () => {
    const state = makeState({ fossils: [{ id: 'shell', cells: [12] }] });
    const bomb = (state.board[12] = createGem('bomb'));
    const result = manager.getResolution({
      ...state,
      matches: [{ type: 'ruby', indices: [10, 11, 12, 13] }],
      bonuses: [{ type: 'bomb', index: 12 }],
    });
    expect(result.steps[0].collectedFossils).toEqual([{ group: 'shell', indices: [12] }]);
    expect(result.board).toContain(bomb);
    expect(result.steps[0].cleared).not.toContain(12);
  });

  it('lets gems fall through the footprint without moving its floor markers', () => {
    const state = makeState({ fossils: [{ id: 'shell', cells: footprint }] });
    const above = state.board[7];
    const result = resolve(state, [17, 22], 'clear-row');
    expect(result.steps[0].drops).toContainEqual({ from: 7, to: 17, gem: above });
    expect(state.tiles[7].fossilGroup).toBe('shell');
    expect(state.tiles[7].health).toBe(1);
    expect(result.board.every(Boolean)).toBe(true);
  });

  it('handles two sediment layers through the existing fusion hit rules', () => {
    const state = makeState({ fossils: [{ id: 'shell', cells: footprint, layers: 2 }] });
    const result = manager.getResolution({
      ...state,
      matches: [{ type: 'bonus-activation', indices: footprint, fusion: { targets: footprint } }],
    });
    expect(result.layersCleared).toBe(8);
    expect(deepMineProgress(state.tiles).fossils.completed).toBe(1);
    expect(result.steps[0].collectedFossils).toHaveLength(1);
  });
});

describe('linked root knots', () => {
  beforeEach(() => vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]));

  it('cuts a knot from an adjacent ordinary match and releases every linked binding once', () => {
    const state = makeState({ roots });
    const gems = roots[0].bindings.map((index) => state.board[index]);
    const result = resolve(state, [6, 7, 8]);
    expect(state.tiles[12].health).toBe(0);
    expect(state.tiles[12].type).toBe('standard');
    expect(roots[0].bindings.map((index) => state.tiles[index].chainHealth)).toEqual([0, 0, 0, 0]);
    expect(result.layersCleared).toBe(5);
    expect(gems.every((gem) => result.board.includes(gem))).toBe(true);
    expect(deepMineProgress(state.tiles).roots).toEqual({ total: 1, completed: 1 });
    const repeated = resolve(finishStep(state, result), [12], 'tnt');
    expect(repeated.layersCleared).toBe(0);
  });

  it('requires a later hit for a stronger knot despite overlapping matches on several sides', () => {
    const state = makeState({ roots: [{ ...roots[0], knotHealth: 2 }] });
    const first = manager.getResolution({
      ...state,
      matches: [
        { type: 'ruby', indices: [6, 7, 8] },
        { type: 'emerald', indices: [6, 11, 16] },
      ],
    });
    expect(state.tiles[12].health).toBe(1);
    expect(state.tiles[13].chainHealth).toBe(1);
    expect(deepMineProgress(state.tiles).roots.completed).toBe(0);
    const second = resolve(finishStep(state, first), [12], 'tnt');
    expect(second.layersCleared).toBe(3);
    expect(deepMineProgress(state.tiles).roots.completed).toBe(1);
  });

  it.each(['tnt', 'tile-breaker', 'clear-row'])(
    'cuts a directly hit knot through the actual %s power footprint',
    (power) => {
      const state = makeState({ roots });
      const indices = new BonusActivator().activatePower(power, state.board, 5, 5, 12, state.tiles);
      const result = resolve(state, indices, power);
      expect(state.tiles[12].health).toBe(0);
      expect(roots[0].bindings.every((index) => !isAnchored(state.tiles[index]))).toBe(true);
      expect(result.layersCleared).toBe(5);
    },
  );

  it.each(['bomb', 'cross'])(
    'cuts linked roots through a player-activated %s with the existing bonus gesture',
    (bonus) => {
      const state = makeState({ roots });
      state.board[6] = createGem(bonus);
      const evaluation = new MatchEngine().evaluateActivation(state.board, 5, 5, 6, state.tiles);
      const result = manager.getResolution({ ...state, ...evaluation });
      expect(state.tiles[12].health).toBe(bonus === 'bomb' ? 0 : 1);
      expect(result.layersCleared).toBe(bonus === 'bomb' ? 5 : 2);
      if (bonus === 'cross') {
        state.board = result.board;
        state.board[2] = createGem('cross');
        const next = new MatchEngine().evaluateActivation(state.board, 5, 5, 2, state.tiles);
        const final = manager.getResolution({ ...state, ...next });
        expect(state.tiles[12].health).toBe(0);
        expect(final.layersCleared).toBe(3);
      }
      expect(deepMineProgress(state.tiles).roots.completed).toBe(1);
    },
  );

  it('does not expand a special effect to a knot beside its footprint', () => {
    const state = makeState({ roots });
    const result = resolve(state, [7], 'color-wand');
    expect(state.tiles[7].chainHealth).toBe(0);
    expect(state.tiles[12].health).toBe(1);
    expect(state.tiles[13].chainHealth).toBe(1);
    expect(result.layersCleared).toBe(1);
  });

  it('retains the knot objective when its last individual binding is cleared by a match', () => {
    const state = makeState({ roots: [{ id: 'a', knot: 12, bindings: [2] }] });
    const gem = state.board[2];
    const result = resolve(state, [0, 1, 2]);
    expect(result.layersCleared).toBe(1);
    expect(result.board).toContain(gem);
    expect(state.tiles[2].chainHealth).toBe(0);
    expect(state.tiles[12].health).toBe(1);
    expect(state.tiles.reduce((sum, tile) => sum + layerCount(tile), 0)).toBe(1);
    expect(deepMineProgress(state.tiles).roots.completed).toBe(0);
  });

  it('does not release a second root group or unrelated ordinary chains', () => {
    const state = makeState({
      roots: [roots[0], { id: 'b', knot: 22, bindings: [21, 23] }],
    });
    state.tiles[0].chainHealth = 1;
    const result = resolve(state, [12], 'bonus-activation');
    expect(result.layersCleared).toBe(5);
    expect(state.tiles[21].chainHealth).toBe(1);
    expect(state.tiles[22].health).toBe(1);
    expect(state.tiles[0].chainHealth).toBe(1);
    expect(deepMineProgress(state.tiles).roots).toEqual({ total: 2, completed: 1 });
  });

  it('preserves chain absorption when a blast hits the knot and a binding with sediment together', () => {
    const state = makeState({ roots: [{ id: 'a', knot: 12, bindings: [7], bindingHealth: 2 }] });
    state.tiles[7].health = state.tiles[7].maxHealth = 1;
    const gem = state.board[7];
    const result = resolve(state, [7, 12], 'tnt');
    expect(result.layersCleared).toBe(3);
    expect(state.tiles[7].chainHealth).toBe(0);
    expect(state.tiles[7].health).toBe(1);
    expect(result.board).toContain(gem);
    expect(result.steps[0].cleared).not.toContain(7);
  });

  it('cuts reinforced knots and releases bindings through a fusion without duplicate layer credit', () => {
    const state = makeState({ roots: [{ ...roots[0], knotHealth: 2 }] });
    const result = manager.getResolution({
      ...state,
      matches: [{ type: 'bonus-activation', indices: [7, 12], fusion: { targets: [7, 12] } }],
    });
    expect(result.layersCleared).toBe(6);
    expect(state.tiles[12].health).toBe(0);
    expect(roots[0].bindings.every((index) => !state.tiles[index].chainHealth)).toBe(true);
  });

  it('keeps a bound gem pinned while other gems fall past it, then reopens the knot column', () => {
    const state = makeState({ roots: [{ id: 'a', knot: 12, bindings: [7] }] });
    const anchored = state.board[7];
    const above = state.board[2];
    const first = resolve(state, [17, 22], 'clear-row');
    expect(first.board[7]).toBe(anchored);
    expect(first.board[2]).toBe(above);
    expect(first.board[17]).toBeNull();
    expect(first.board[22]).toBeNull();
    const second = resolve(finishStep(state, first), [12], 'tnt');
    expect(second.steps[0].drops).toContainEqual({ from: 7, to: 22, gem: anchored });
    expect(second.board.every(Boolean)).toBe(true);
  });

  it('leaves an empty charged core harmless while root and fossil layers still resolve', () => {
    const state = makeState({ roots, fossils: [{ id: 'shell', cells: [18] }] });
    for (const index of [0, 1, 5]) state.board[index] = null;
    Object.assign(state.tiles[0], { signal: 'core', signalHealth: 1, coreBonus: 'bomb' });
    const result = resolve(state, [0, 12, 18], 'tnt');
    expect(state.tiles[0].signalHealth).toBe(0);
    expect(result.steps[0].bonuses).toEqual([]);
    expect(result.layersCleared).toBe(7);
    expect(deepMineProgress(state.tiles)).toEqual({
      fossils: { total: 1, completed: 1 },
      roots: { total: 1, completed: 1 },
    });
  });
});

describe('deep mine recovery and integration', () => {
  it('leaves unsupported and incomplete definitions inert without orphaning new bindings', () => {
    const state = makeState();
    const original = structuredClone(state.tiles);
    for (const spec of [undefined, null, {}, { fossils: 'unsupported', roots: {} }])
      expect(applyDeepMineSpec(state.tiles, spec)).toEqual(original);
    applyDeepMineSpec(state.tiles, {
      fossils: [{ id: 'missing' }, { cells: [-1, 100] }],
      roots: [{ bindings: [7] }, { knot: -1, bindings: [7] }],
    });
    expect(state.tiles).toEqual(original);
    expect(deepMineProgress(state.tiles)).toEqual({
      fossils: { total: 0, completed: 0 },
      roots: { total: 0, completed: 0 },
    });
  });

  it('reshuffles freely around root anchors and sediment while preserving their progress', () => {
    const state = makeState({ roots, fossils: [{ id: 'shell', cells: [18, 19, 23, 24] }] });
    state.tiles[18].health = 0;
    const tilesBefore = structuredClone(state.tiles);
    const anchored = roots[0].bindings.map((index) => state.board[index]);
    const repaired = recoverBoard(state.board, state.tiles, 5, 5);
    expect(repaired).not.toBeNull();
    expect(state.tiles).toEqual(tilesBefore);
    expect(repaired[12]).toBeNull();
    expect(roots[0].bindings.map((index) => repaired[index])).toEqual(anchored);
    const engine = new MatchEngine();
    expect(
      repaired.some(
        (gem, index) =>
          engine.evaluateActivation(repaired, 5, 5, index, state.tiles).matches.length ||
          [index + 1, index + 5].some(
            (other) =>
              engine.evaluateSwap(repaired, 5, 5, index, other, state.tiles).matches.length,
          ),
      ),
    ).toBe(true);
  });

  it('finishes through an ordinary legal match beyond100 moves and the optional speed target', async () => {
    const state = makeState({
      roots: [{ id: 'a', knot: 12, bindings: [7, 11, 13] }],
      fossils: [{ id: 'shell', cells: [16] }],
    });
    for (const index of [15, 16, 18]) state.board[index] = createGem('ruby');
    state.board[17] = createGem('emerald');
    const original = MatchEngine.prototype.findMatches;
    vi.spyOn(MatchEngine.prototype, 'findMatches')
      .mockImplementationOnce(function (...args) {
        return original.call(this, ...args);
      })
      .mockReturnValue([]);
    const game = useGameStore();
    Object.assign(game, {
      sessionActive: true,
      currentLevelId: 373,
      board: state.board,
      tiles: state.tiles,
      boardCols: 5,
      boardRows: 5,
      totalLayers: 5,
      remainingLayers: 5,
      moves: 100,
      elapsedMs: 200000,
      speedTargetMs: 1000,
    });
    expect(await game.resolveSwap(17, 18)).toBe(true);
    expect(game.remainingLayers).toBe(0);
    expect(game.levelCleared).toBe(true);
    expect(game.moves).toBe(101);
    expect(deepMineProgress(game.tiles)).toEqual({
      fossils: { total: 1, completed: 1 },
      roots: { total: 1, completed: 1 },
    });
  });

  it('finishes through an inventory power beyond100 moves and the optional speed target', async () => {
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
    const state = makeState({
      roots: [{ id: 'a', knot: 12, bindings: [7, 11, 13, 17] }],
      fossils: [{ id: 'shell', cells: [18] }],
    });
    const game = useGameStore();
    Object.assign(game, {
      sessionActive: true,
      currentLevelId: 373,
      board: state.board,
      tiles: state.tiles,
      boardCols: 5,
      boardRows: 5,
      totalLayers: 6,
      remainingLayers: 6,
      moves: 101,
      elapsedMs: 200000,
      speedTargetMs: 1000,
      activeBonusMode: 'tnt',
    });
    useCampaignStore().powers.find((slot) => slot.id === 'tnt').quantity = 1;
    expect(await game.resolveBonusClick(12)).toBe(true);
    expect(game.remainingLayers).toBe(0);
    expect(game.levelCleared).toBe(true);
    expect(game.moves).toBe(101);
    expect(deepMineProgress(game.tiles)).toEqual({
      fossils: { total: 1, completed: 1 },
      roots: { total: 1, completed: 1 },
    });
  });
});
