import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  gravityDestination,
  gravityPath,
  incomingGravity,
  isPlayableCell,
} from '../src/game/engine/BoardTopology';
import { BonusActivator } from '../src/game/engine/BonusActivator';
import { recoverBoard } from '../src/game/engine/BoardRecovery';
import { applyDeepMineSpec, deepMineProgress } from '../src/game/engine/DeepMineMechanics';
import { createGem, BASE_GEM_TYPES as GEM_TYPES } from '../src/game/engine/GemFactory';
// These fixtures color boards from the original six-gem palette.
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { HintEngine } from '../src/game/engine/HintEngine';
import { TileManager } from '../src/game/engine/TileManager';
import { canSwapGem, isAnchored, layerCount } from '../src/game/engine/TileRules';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';

const manager = new TileManager();
const findRealMatches = MatchEngine.prototype.findMatches;
const makeState = () => {
  const board = Array.from({ length: 25 }, (_, index) =>
    createGem(GEM_TYPES[((index % 5) + Math.floor(index / 5) * 2) % GEM_TYPES.length]),
  );
  return {
    board,
    tiles: board.map(() => ({ type: 'standard', health: 0, maxHealth: 0 })),
    cols: 5,
    rows: 5,
  };
};
const resolve = (state, indices, type = 'ruby', extra = {}) =>
  manager.getResolution({ ...state, matches: [{ type, indices, ...extra }] });
const gate = (health = 1) => ({ type: 'blocker', health, maxHealth: health, bonusOnly: true });
const voidCell = () => ({ type: 'void', health: 0, maxHealth: 0 });
const step = () => ({ drops: [], spawns: [], tileUpdates: [] });
const makeFunnel = () => {
  const cols = 5,
    rows = 6;
  const masks = ['.....', '.....', '.....', '_..._', '__B__', '__E__'];
  const symbols = [...masks.join('')];
  const tiles = symbols.map((symbol) =>
    symbol === '_'
      ? voidCell()
      : symbol === 'B'
        ? gate()
        : { type: 'standard', health: 0, maxHealth: 0, ...(symbol === 'E' ? { exit: true } : {}) },
  );
  for (let index = 0; index < tiles.length - cols; index++) {
    if (!isPlayableCell(tiles[index])) continue;
    const nextRow = Math.floor(index / cols) + 1;
    const next = Array.from({ length: cols }, (_, column) => nextRow * cols + column).filter(
      (cell) => isPlayableCell(tiles[cell]),
    );
    const col = Math.max(next[0] % cols, Math.min(index % cols, next.at(-1) % cols));
    tiles[index].flowTo = nextRow * cols + col;
  }
  const board = tiles.map((tile, index) =>
    tile.type === 'void' || tile.type === 'blocker'
      ? null
      : createGem(GEM_TYPES[((index % cols) + Math.floor(index / cols) * 2) % GEM_TYPES.length]),
  );
  return { board, tiles, cols, rows, exit: 27, gate: 22 };
};

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
});

describe('shared playable shape and directed gravity', () => {
  it('keeps legacy vertical routing and falls back safely from unsupported flow definitions', () => {
    const state = makeState();
    expect(gravityPath(state.tiles, 2, 5, 5)).toEqual([2, 7, 12, 17, 22]);
    for (const invalid of [-1, 100, 0, 13, '7', null]) {
      state.tiles[2].flowTo = invalid;
      expect(gravityDestination(state.tiles, 2, 5, 5)).toBe(7);
    }
    state.tiles[7] = voidCell();
    expect(gravityDestination(state.tiles, 2, 5, 5)).toBe(-1);
    expect(gravityPath(state.tiles, 7, 5, 5)).toEqual([]);
    expect(canSwapGem(createGem('ruby'), state.tiles[7])).toBe(false);
    expect(isAnchored(state.tiles[7])).toBe(true);
    expect(layerCount({ ...voidCell(), health: 999, chainHealth: 999 })).toBe(0);
  });

  it('converges every pearl branch through the same solid gate and marked exit', () => {
    const state = makeFunnel();
    for (const index of [0, 2, 4]) {
      const path = gravityPath(state.tiles, index, state.cols, state.rows);
      expect(path).toContain(state.gate);
      expect(path.at(-1)).toBe(state.exit);
      expect(path.every((cell) => isPlayableCell(state.tiles[cell]))).toBe(true);
    }
    expect(incomingGravity(state.tiles, 5, 6)[state.gate]).toEqual([16, 17, 18]);
  });

  it('never refills the exit below a closed gate, regardless of which branch remains full', () => {
    const state = makeFunnel();
    state.board[state.exit] = null;
    state.board[0] = createGem('relic');
    state.board[4] = createGem('relic');
    const receipt = step();
    manager.applyGravity(state.board, state.tiles, 5, 6, GEM_TYPES, 0, receipt);
    expect(state.board[state.exit]).toBeNull();
    expect(state.board[state.gate]).toBeNull();
    expect(receipt.drops.some(({ to }) => to === state.exit)).toBe(false);
    expect(receipt.spawns.some(({ index }) => index === state.exit)).toBe(false);
    expect(state.board[0].type).toBe('relic');
    expect(state.board[4].type).toBe('relic');
  });

  it('delivers pearls from both outer arms despite continuous center refill, with one path receipt per gem', () => {
    const state = makeFunnel();
    state.tiles[state.gate].health = 0;
    state.tiles[state.gate].type = 'standard';
    const pearls = [0, 4].map((index) => (state.board[index] = createGem('relic')));
    const collected = new Set();
    const incoming = incomingGravity(state.tiles, 5, 6);
    for (let vacancy = 0; vacancy < 80 && collected.size < 2; vacancy++) {
      state.board[state.exit] = null;
      const receipt = step();
      manager.applyGravity(state.board, state.tiles, 5, 6, GEM_TYPES, 0, receipt);
      if (state.board[state.exit]?.type === 'relic') collected.add(state.board[state.exit].id);
      expect(new Set(receipt.drops.map(({ gem }) => gem.id)).size).toBe(receipt.drops.length);
      for (const { from, to, path } of receipt.drops) {
        expect(path[0]).toBe(from);
        expect(path.at(-1)).toBe(to);
        expect(path.every((cell) => isPlayableCell(state.tiles[cell]))).toBe(true);
        for (let part = 1; part < path.length; part++)
          expect(gravityDestination(state.tiles, path[part - 1], 5, 6)).toBe(path[part]);
      }
      for (const { index, path } of receipt.spawns) {
        expect(incoming[path[0]]).toEqual([]);
        expect(path.at(-1)).toBe(index);
      }
      for (let index = 0; index < state.board.length; index++)
        if (!isPlayableCell(state.tiles[index])) expect(state.board[index]).toBeNull();
    }
    expect([...collected].sort()).toEqual(pearls.map(({ id }) => id).sort());
  });

  it('lets a relic fall first through a merge, ahead of nearer gems and the refill', () => {
    const state = makeFunnel();
    state.tiles[state.gate].health = 0;
    state.tiles[state.gate].type = 'standard';
    const pearl = (state.board[0] = createGem('relic'));
    for (const index of [5, 10, 16, state.gate, state.exit]) state.board[index] = null;
    // The rotation points at the nearer center and inner-left gems.
    state.tiles[state.gate].flowCursor = 1;
    state.tiles[16].flowCursor = 1;
    const receipt = step();
    manager.applyGravity(state.board, state.tiles, 5, 6, GEM_TYPES, 0, receipt);
    expect(state.board[state.exit]).toBe(pearl);
    expect(receipt.drops[0]).toMatchObject({
      from: 0,
      to: state.exit,
      path: [0, 5, 10, 16, 22, 27],
    });
    expect(receipt.spawns.every(({ index }) => index !== state.exit)).toBe(true);

    // Through a full move, the pearl is delivered in the same resolution.
    const move = makeFunnel();
    move.tiles[move.gate].health = 0;
    move.tiles[move.gate].type = 'standard';
    move.board[0] = createGem('relic');
    move.tiles[move.gate].flowCursor = 1;
    move.tiles[16].flowCursor = 1;
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
    const result = resolve(move, [5, 10, 16, move.exit], 'tnt');
    expect(result.relicsCollected).toBe(1);
  });

  it('lands a relic in a straight column before any refill enters it', () => {
    const state = makeState();
    const relic = (state.board[2] = createGem('relic'));
    for (const index of [7, 12, 17, 22]) state.board[index] = null;
    const receipt = step();
    manager.applyGravity(state.board, state.tiles, 5, 5, GEM_TYPES, 0, receipt);
    expect(state.board[22]).toBe(relic);
    expect(receipt.spawns.map(({ index }) => index).sort((a, b) => a - b)).toEqual([2, 7, 12, 17]);
  });

  it('preserves chain pinning and lets upstream pieces flow past a binding along its route', () => {
    const state = makeFunnel();
    state.tiles[state.gate].health = 0;
    state.tiles[state.gate].type = 'standard';
    state.tiles[17].chainHealth = 1;
    const pinned = state.board[17];
    const above = state.board[12];
    state.board[state.exit] = state.board[state.gate] = null;
    state.tiles[state.gate].flowCursor = 1;
    const receipt = step();
    manager.applyGravity(state.board, state.tiles, 5, 6, GEM_TYPES, 0, receipt);
    expect(state.board[17]).toBe(pinned);
    expect(receipt.drops).toContainEqual(
      expect.objectContaining({ from: 12, to: state.exit, gem: above, path: [12, 17, 22, 27] }),
    );
  });

  it('ignores voids for matching, bonus targeting and even the isolated free cross recovery', () => {
    const state = makeState();
    for (const index of [0, 1, 2]) state.board[index] = createGem('ruby');
    state.tiles[1] = voidCell();
    expect(
      new MatchEngine()
        .findMatches(state.board, 5, 5, state.tiles)
        .some(({ indices }) => indices.includes(1)),
    ).toBe(false);
    expect(
      new BonusActivator().activatePower('tile-breaker', state.board, 5, 5, 1, state.tiles),
    ).toEqual([]);
    expect(
      new BonusActivator().activatePower('tnt', state.board, 5, 5, 6, state.tiles),
    ).not.toContain(1);
    const sparse = makeFunnel();
    sparse.board = sparse.board.map(() => null);
    sparse.board[12] = createGem('ruby');
    const recovered = recoverBoard(sparse.board, sparse.tiles, 5, 6);
    expect(recovered[12].type).toBe('cross');
    expect(
      sparse.tiles.every((tile, index) => isPlayableCell(tile) || recovered[index] === null),
    ).toBe(true);
    const evaluation = new MatchEngine().evaluateActivation(recovered, 5, 6, 12, sparse.tiles);
    expect(evaluation.matches[0].indices).toContain(sparse.gate);
    const result = manager.getResolution({ ...sparse, ...evaluation });
    expect(sparse.tiles[sparse.gate].health).toBe(0);
    expect(result.layersCleared).toBe(1);
  });

  it('suggests an isolated bonus at the throat even while the upper workbench has ordinary matches', () => {
    const state = makeState();
    for (let index = 10; index < 25; index++) {
      state.tiles[index] = voidCell();
      state.board[index] = null;
    }
    state.tiles[12] = { type: 'standard', health: 0 };
    state.tiles[17] = gate();
    state.tiles[22] = { type: 'standard', health: 0, exit: true };
    state.board[12] = createGem('cross');
    state.board[7] = createGem('relic');
    for (const index of [0, 1, 3]) state.board[index] = createGem('ruby');
    state.board[2] = createGem('emerald');
    expect(
      new MatchEngine().evaluateSwap(state.board, 5, 5, 2, 3, state.tiles).matches.length,
    ).toBeGreaterThan(0);
    const hint = new HintEngine().findBestMove(state.board, state.tiles, 5, 5);
    expect(hint).toMatchObject({ activateInPlace: true, swap: { aIndex: 12, bIndex: 12 } });
    const activation = new MatchEngine().evaluateActivation(state.board, 5, 5, 12, state.tiles);
    expect(activation.matches[0].indices).toContain(17);
  });

  it('aims an available bonus at a mandatory gate before spending another blast on easy floor layers', () => {
    const state = makeState();
    for (const index of [0, 1, 2, 5, 6, 7, 10, 11, 12]) state.tiles[index].health = 1;
    state.tiles[24] = gate();
    state.board[24] = null;
    state.board[6] = createGem('bomb');
    state.board[23] = createGem('cross');
    const boardBefore = [...state.board];
    const tilesBefore = structuredClone(state.tiles);
    const random = vi.spyOn(Math, 'random');
    const hint = new HintEngine().findBestMove(state.board, state.tiles, 5, 5);
    const footprint = hint.activateInPlace
      ? new MatchEngine().evaluateActivation(state.board, 5, 5, hint.swap.aIndex, state.tiles)
          .matches[0].indices
      : new BonusActivator().previewSwap(state.board, 5, 5, hint.swap, state.tiles);
    expect(hint.usesBonus).toBe(true);
    expect([hint.swap.aIndex, hint.swap.bIndex]).toContain(23);
    expect(footprint).toContain(24);
    expect(state.board).toEqual(boardBefore);
    expect(state.tiles).toEqual(tilesBefore);
    expect(random).not.toHaveBeenCalled();
  });

  it('earns a bonus beside the live gate instead of another bonus above already accessible dust', () => {
    const cols = 6,
      rows = 6;
    const board = Array.from({ length: cols * rows }, (_, index) =>
      createGem(GEM_TYPES[((index % cols) + Math.floor(index / cols) * 2) % GEM_TYPES.length]),
    );
    const tiles = board.map(() => ({ type: 'standard', health: 0, maxHealth: 0 }));
    for (const index of [0, 1, 3, 8]) board[index] = createGem('ruby');
    board[2] = createGem('emerald');
    for (const index of [18, 19, 21, 14]) board[index] = createGem('sapphire');
    board[20] = createGem('ruby');
    for (const index of [0, 1, 2, 3]) tiles[index].health = 1;
    tiles[26] = gate();
    board[26] = null;
    const engine = new MatchEngine();
    expect(engine.evaluateSwap(board, cols, rows, 2, 8, tiles).bonuses).toHaveLength(1);
    expect(engine.evaluateSwap(board, cols, rows, 14, 20, tiles).bonuses).toHaveLength(1);
    const hint = new HintEngine().findBestMove(board, tiles, cols, rows);
    expect(hint.createsBonus).toBe(true);
    const earned = engine.evaluateSwap(
      board,
      cols,
      rows,
      hint.swap.aIndex,
      hint.swap.bIndex,
      tiles,
    );
    expect(
      earned.bonuses.some(({ index }) =>
        engine
          .evaluateActivation(earned.board, cols, rows, index, tiles)
          .matches[0].indices.includes(26),
      ),
    ).toBe(true);
  });
});

describe('encased fossils and blast gates', () => {
  beforeEach(() => vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]));

  it('leaves a blast gate intact after any ordinary neighboring matches, including overlapping ones', () => {
    const state = makeState();
    state.tiles[12] = gate(2);
    state.board[12] = null;
    const result = manager.getResolution({
      ...state,
      matches: [
        { type: 'ruby', indices: [6, 7, 8] },
        { type: 'emerald', indices: [6, 11, 16] },
      ],
    });
    expect(state.tiles[12].health).toBe(2);
    expect(result.layersCleared).toBe(0);
    expect(result.steps[0].tileUpdates).toEqual([]);
  });

  it.each(['tnt', 'clear-row', 'tile-breaker', 'bonus-activation'])(
    'damages an encased fossil only on direct %s hits and collects the full fossil once',
    (type) => {
      const state = makeState();
      const cells = [6, 7, 11, 12];
      applyDeepMineSpec(state.tiles, { fossils: [{ id: 'shell', cells, encased: true }] });
      for (const index of cells) state.board[index] = null;
      expect(cells.every((index) => isAnchored(state.tiles[index]))).toBe(true);
      const adjacent = resolve(state, [5, 10, 15]);
      expect(adjacent.layersCleared).toBe(0);
      const first = resolve({ ...state, board: adjacent.board }, [6, 7], type);
      expect(first.layersCleared).toBe(2);
      expect(first.steps[0].collectedFossils).toBeUndefined();
      const final = resolve({ ...state, board: first.board }, [11, 12], type);
      expect(final.layersCleared).toBe(2);
      expect(final.steps[0].collectedFossils).toEqual([{ group: 'shell', indices: cells }]);
      expect(deepMineProgress(state.tiles).fossils.completed).toBe(1);
      expect(cells.every((index) => state.tiles[index].type === 'standard')).toBe(true);
      expect(cells.every((index) => final.board[index])).toBe(true);
    },
  );

  it('lets a real player-made fusion clear a reinforced blast gate with its normal two hits', () => {
    const state = makeState();
    state.tiles[12] = gate(2);
    state.board[12] = null;
    state.board[6] = createGem('bomb');
    state.board[7] = createGem('bomb');
    const evaluation = new MatchEngine().evaluateSwap(state.board, 5, 5, 6, 7, state.tiles);
    const result = manager.getResolution({ ...state, ...evaluation });
    expect(state.tiles[12].health).toBe(0);
    expect(result.layersCleared).toBe(2);
  });

  it('earns a bomb from a legal four-match and then uses it to open the gate without inventory powers', () => {
    const state = makeState();
    for (const index of [7, 10, 11, 13]) state.board[index] = createGem('ruby');
    state.board[12] = createGem('emerald');
    state.tiles[17] = gate();
    state.board[17] = null;
    MatchEngine.prototype.findMatches.mockImplementationOnce(function (...args) {
      return findRealMatches.call(this, ...args);
    });
    const engine = new MatchEngine();
    const evaluation = engine.evaluateSwap(state.board, 5, 5, 7, 12, state.tiles);
    expect(evaluation.bonuses).toContainEqual({ type: 'bomb', index: 12 });
    const earned = manager.getResolution({ ...state, ...evaluation });
    expect(state.tiles[17].health).toBe(1);
    expect(earned.board[12].type).toBe('bomb');
    const activation = engine.evaluateActivation(earned.board, 5, 5, 12, state.tiles);
    const opened = manager.getResolution({ ...state, ...activation });
    expect(state.tiles[17].health).toBe(0);
    expect(opened.layersCleared).toBe(1);
    expect(useCampaignStore().powers.every((power) => power.quantity === 0)).toBe(true);
  });

  it('continues beyond101 moves and expired speed targets until a board bonus cuts the actual bottleneck', async () => {
    const state = makeFunnel();
    state.board[12] = createGem('cross');
    const game = useGameStore();
    Object.assign(game, {
      sessionActive: true,
      currentLevelId: 391,
      board: state.board,
      tiles: state.tiles,
      boardCols: 5,
      boardRows: 6,
      totalLayers: 1,
      remainingLayers: 1,
      moves: 101,
      elapsedMs: 100000,
      speedTargetMs: 1000,
    });
    expect(await game.activateBonusGem(12)).toBe(true);
    expect(game.levelCleared).toBe(true);
    expect(game.remainingLayers).toBe(0);
    expect(game.moves).toBeGreaterThan(101);
    expect(useCampaignStore().powers.every((power) => power.quantity === 0)).toBe(true);
  });
});

describe('one-shot directional spore relay waves', () => {
  beforeEach(() => vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]));

  it('chains row and column spores and caught board bonuses before falling, without duplicate ignition', () => {
    const state = makeState();
    applyDeepMineSpec(state.tiles, {
      spores: [
        { index: 12, axis: 'row' },
        { index: 13, axis: 'column' },
      ],
    });
    state.tiles[4] = gate();
    state.board[4] = null;
    state.board[3] = createGem('bomb');
    const result = resolve(state, [5, 6, 7]);
    expect(
      result.steps.map(
        ({ sporeBursts }) => sporeBursts?.map(({ index, axis }) => [index, axis]) ?? [],
      ),
    ).toEqual([[], [[12, 'row']], [[13, 'column']]]);
    expect(
      result.steps.slice(0, -1).every(({ drops, spawns }) => !drops.length && !spawns.length),
    ).toBe(true);
    expect(result.steps[2].cleared).toContain(3);
    expect(state.tiles[4].health).toBe(0);
    expect(state.tiles[12].signalHealth).toBe(0);
    expect(state.tiles[13].signalHealth).toBe(0);
    expect(result.layersCleared).toBe(3);
    const repeated = resolve({ ...state, board: result.board }, [5, 6, 7]);
    expect(repeated.steps.some(({ sporeBursts }) => sporeBursts?.length)).toBe(false);
    expect(repeated.layersCleared).toBe(0);
  });

  it('accepts special impacts directly on a spore but does not extend their footprint to an adjacent spore', () => {
    const state = makeState();
    applyDeepMineSpec(state.tiles, { spores: [{ index: 12, axis: 'column' }] });
    const adjacent = resolve(state, [7], 'tnt');
    expect(state.tiles[12].signalHealth).toBe(1);
    expect(adjacent.steps.some(({ sporeBursts }) => sporeBursts)).toBe(false);
    const direct = resolve({ ...state, board: adjacent.board }, [12], 'bonus-activation');
    expect(direct.steps[1].sporeBursts).toEqual([
      { index: 12, axis: 'column', targets: [2, 7, 12, 17, 22] },
    ]);
    expect(direct.layersCleared).toBe(1);
  });

  it('finishes the pending swapped bonus first, then fires relays against the remaining board', () => {
    const state = makeState();
    applyDeepMineSpec(state.tiles, {
      spores: [
        { index: 12, axis: 'row' },
        { index: 13, axis: 'column' },
      ],
    });
    state.board[11] = createGem('cross');
    const result = manager.getResolution({
      ...state,
      matches: [{ type: 'ruby', indices: [5, 6, 7] }],
      pendingBonus: {
        swap: { aIndex: 11, bIndex: 16 },
        swapGems: { a: state.board[11], b: state.board[16] },
        fusion: null,
      },
    });
    expect(result.steps.map(({ matches }) => matches[0].type)).toEqual([
      'ruby',
      'bonus-activation',
      'spore-burst',
    ]);
    expect(result.steps[2].sporeBursts.map(({ index }) => index)).toEqual([12, 13]);
    expect(result.steps[1].cleared).toContain(11);
    expect(result.steps[2].cleared).not.toContain(11);
    expect(result.layersCleared).toBe(2);
  });

  it('keeps a mutually connected pair one-shot and excludes permanent voids from every emitted ray', () => {
    const state = makeState();
    state.tiles[11] = voidCell();
    state.board[11] = null;
    applyDeepMineSpec(state.tiles, {
      spores: [
        { index: 12, axis: 'row' },
        { index: 14, axis: 'row' },
      ],
    });
    const result = resolve(state, [12], 'bonus-activation');
    expect(
      result.steps.flatMap(({ sporeBursts }) => sporeBursts ?? []).map(({ index }) => index),
    ).toEqual([12, 14]);
    expect(
      result.steps.every(({ sporeBursts }) =>
        (sporeBursts ?? []).every(({ targets }) => !targets.includes(11)),
      ),
    ).toBe(true);
    expect(result.layersCleared).toBe(2);
    expect(result.board[11]).toBeNull();
  });
});
