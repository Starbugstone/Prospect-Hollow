import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { markRaw } from 'vue';
import { advanceOreOrders, remainingOre } from '../src/game/engine/ChapterMechanics';
import { createGem, GEM_TYPES } from '../src/game/engine/GemFactory';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { TileManager } from '../src/game/engine/TileManager';
import { PlayClock } from '../src/game/engine/PlayClock';
import { canSwapGem, layerCount } from '../src/game/engine/TileRules';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';
import * as chestRewards from '../src/data/rewards';

const manager = new TileManager();
const makeBoard = () => {
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
const signal = (order = 0) => ({
  type: 'standard',
  health: 0,
  signalHealth: 1,
  signal: order ? 'survey' : 'lantern',
  ...(order ? { surveyOrder: order } : {}),
});
const resolveHits = (state, indices, type = 'ruby') =>
  manager.getResolution({ ...state, matches: [{ type, indices }] });

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('light marker resolution', () => {
  beforeEach(() => {
    // Isolate the impact under test; complete legal cascade games are covered
    // by campaign-playthrough.test.js for every authored level and several seeds.
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
  });

  it('lights a lantern once when simultaneous matches touch it from several sides', () => {
    const state = makeBoard();
    state.tiles[12] = signal();
    const result = manager.getResolution({
      ...state,
      matches: [
        { type: 'ruby', indices: [6, 7, 8] },
        { type: 'emerald', indices: [11, 16, 21] },
      ],
    });
    expect(state.tiles[12].signalHealth).toBe(0);
    expect(result.layersCleared).toBe(1);
    expect(result.steps[0].tileUpdates).toEqual([{ index: 12, signalHealth: 0 }]);
  });

  it('does not light diagonally or wrap an edge match onto the next row', () => {
    const state = makeBoard();
    state.tiles[12] = signal();
    state.tiles[10] = signal();
    resolveHits(state, [3, 4, 9]);
    expect(state.tiles[12].signalHealth).toBe(1);
    expect(state.tiles[10].signalHealth).toBe(1);
  });

  it.each(['tnt', 'tile_breaker', 'clear_row', 'color_wand', 'bonus-activation'])(
    'lights a marker hit directly by %s',
    (type) => {
      const state = makeBoard();
      state.tiles[12] = signal();
      const result = resolveHits(state, [12], type);
      expect(state.tiles[12].signalHealth).toBe(0);
      expect(result.layersCleared).toBe(1);
    },
  );

  it('lights a marker beneath a newly earned bonus without destroying the bonus', () => {
    const state = makeBoard();
    state.tiles[12] = signal();
    const bomb = (state.board[12] = createGem('bomb'));
    const result = manager.getResolution({
      ...state,
      matches: [{ type: 'ruby', indices: [10, 11, 12, 13] }],
      bonusesCreated: ['bomb'],
      bonusIndices: [12],
    });
    expect(state.tiles[12].signalHealth).toBe(0);
    expect(result.board).toContain(bomb);
    expect(result.steps[0].cleared).not.toContain(12);
  });

  it('permits swapping and gravity through unlit markers and leaves the markers on their cells', () => {
    const state = makeBoard();
    state.tiles[12] = signal(1);
    const above = state.board[7];
    expect(canSwapGem(state.board[12], state.tiles[12])).toBe(true);
    const result = resolveHits(state, [17, 22], 'clear_row');
    expect(result.steps[0].drops).toContainEqual({ from: 7, to: 17, gem: above });
    expect(state.tiles[12].signal).toBe('survey');
    expect(result.board.every(Boolean)).toBe(true);
  });

  it('requires a later impact for the next survey marker even when one blast touches all markers', () => {
    const state = makeBoard();
    for (const [order, index] of [11, 12, 13].entries()) state.tiles[index] = signal(order + 1);
    const first = resolveHits(state, [10, 11, 12, 13, 14], 'clear_row');
    expect([11, 12, 13].map((index) => state.tiles[index].signalHealth)).toEqual([0, 1, 1]);
    const second = resolveHits({ ...state, board: first.board }, [12], 'tile_breaker');
    expect([11, 12, 13].map((index) => state.tiles[index].signalHealth)).toEqual([0, 0, 1]);
    const third = resolveHits({ ...state, board: second.board }, [13], 'tile_breaker');
    expect([11, 12, 13].map((index) => state.tiles[index].signalHealth)).toEqual([0, 0, 0]);
    expect(first.layersCleared + second.layersCleared + third.layersCleared).toBe(3);
  });

  it('can advance a survey in successive cascade steps of the same move', () => {
    const state = makeBoard();
    state.tiles[11] = signal(1);
    state.tiles[13] = signal(2);
    MatchEngine.prototype.findMatches
      .mockReturnValueOnce([{ type: 'emerald', indices: [13] }])
      .mockReturnValue([]);
    const result = resolveHits(state, [11]);
    expect(result.steps.map((step) => step.tileUpdates)).toEqual([
      [{ index: 11, signalHealth: 0 }],
      [{ index: 13, signalHealth: 0 }],
    ]);
    expect(result.layersCleared).toBe(2);
  });

  it('does not unlock a later survey marker before the current marker is reached', () => {
    const state = makeBoard();
    state.tiles[5] = signal(1);
    state.tiles[19] = signal(2);
    state.tiles[18] = signal();
    const result = resolveHits(state, [19], 'tile_breaker');
    expect(state.tiles[5].signalHealth).toBe(1);
    expect(state.tiles[19].signalHealth).toBe(1);
    expect(state.tiles[18].signalHealth).toBe(0);
    expect(result.layersCleared).toBe(1);
  });
});

describe('ore order collection', () => {
  beforeEach(() => vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]));

  it('counts collected colors rather than hit cells, chain releases, or earned bonuses', () => {
    const state = makeBoard();
    for (const index of [10, 11, 12, 13]) state.board[index] = createGem('ruby');
    state.tiles[11].chainHealth = 1;
    state.board[12] = createGem('bomb');
    const result = manager.getResolution({
      ...state,
      matches: [{ type: 'ruby', indices: [10, 11, 12, 13] }],
      bonusesCreated: ['bomb'],
      bonusIndices: [12],
    });
    const orders = [{ color: 'ruby', target: 10, progress: 0 }];
    advanceOreOrders(orders, result.steps);
    expect(orders[0].progress).toBe(2);
    expect(result.steps[0].collectedJewels).toHaveLength(2);
    expect(remainingOre(orders)).toBe(8);
  });

  it('caps each order independently and ignores other colors and relic receipts', () => {
    const orders = [
      { color: 'ruby', target: 2, progress: 1 },
      { color: 'emerald', target: 3, progress: 0 },
    ];
    advanceOreOrders(orders, [
      { collectedJewels: ['ruby', 'ruby', 'emerald', 'sapphire'].map(createGem) },
      { collectedRelics: [{ gem: createGem('relic') }] },
    ]);
    expect(orders.map((order) => order.progress)).toEqual([2, 1]);
    expect(remainingOre(orders)).toBe(2);
    expect(remainingOre()).toBe(0);
  });

  it('counts actual fusion removals for ore while preserving the existing mining receipt', () => {
    const state = makeBoard();
    state.board[11] = createGem('bomb');
    state.board[12] = createGem('bomb');
    const evaluation = new MatchEngine().evaluateSwap(state.board, 5, 5, 11, 12, state.tiles);
    const targets = evaluation.matches[0].fusion.targets;
    const expected = targets.filter((index) => state.board[index]?.type === 'ruby').length;
    expect(expected).toBeGreaterThan(0);
    const result = manager.getResolution({ ...state, ...evaluation });
    const orders = [{ color: 'ruby', target: 100, progress: 0 }];
    advanceOreOrders(orders, result.steps);
    expect(orders[0].progress).toBe(expected);
    expect(result.steps.flatMap((step) => step.collectedJewels)).toEqual([]);
  });

  it.each(['tnt', 'clear_row', 'tile_breaker', 'color_wand'])(
    'updates ore through the actual %s inventory-power action before checking victory',
    async (mode) => {
      const state = makeBoard();
      state.board[12] = createGem('ruby');
      state.tiles[12] = signal();
      const game = useGameStore();
      Object.assign(game, {
        sessionActive: true,
        currentLevelId: 241,
        board: state.board,
        tiles: state.tiles,
        boardCols: 5,
        boardRows: 5,
        remainingLayers: 1,
        totalLayers: 1,
        oreOrders: [{ color: 'ruby', target: 1, progress: 0 }],
        activeBonusMode: mode,
      });
      expect(await game.resolveBonusClick(12)).toBe(true);
      expect(game.remainingLayers).toBe(0);
      expect(game.remainingOre).toBe(0);
      expect(game.levelCleared).toBe(true);
    },
  );

  it('requires ore after the last obstacle is cleared, with no move-count failure', () => {
    const game = useGameStore();
    Object.assign(game, {
      sessionActive: true,
      currentLevelId: 241,
      remainingLayers: 0,
      totalLayers: 0,
      board: [],
      moves: 10000,
      oreOrders: [{ color: 'ruby', target: 2, progress: 1 }],
    });
    expect(game.goalTotal).toBe(2);
    expect(game.goalProgress).toBe(1);
    game.completeLevel();
    expect(game.levelCleared).toBe(false);
    expect(game.sessionActive).toBe(true);
    game._applyScoring([{ collectedJewels: [createGem('ruby')], cleared: [0] }]);
    game.completeLevel();
    expect(game.goalProgress).toBe(2);
    expect(game.levelCleared).toBe(true);
  });

  it('accepts a legal swap after 10,000 moves and an expired speed target, awarding completion once', async () => {
    // Use the real swap/cascade engine, victory action and payout receipt.
    vi.restoreAllMocks();
    vi.spyOn(chestRewards, 'rollChestReward').mockReturnValue({
      id: 'coins',
      kind: 'coins',
      label: 'Coins',
      quantity: 4000,
    });
    let random = 7919;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      random = (random * 16807) % 2147483647;
      return (random - 1) / 2147483646;
    });
    const campaign = useCampaignStore();
    campaign.records = Object.fromEntries(
      Array.from({ length: 240 }, (_, index) => [index + 1, { score: 1, stars: 1 }]),
    );
    const game = useGameStore();
    let now = 0;
    game.playClock = markRaw(new PlayClock(() => now));
    game.bootstrap();
    game.startLevel(241);
    expect(game.currentLevelId).toBe(241);
    expect(game.sessionActive).toBe(true);
    const state = makeBoard();
    for (const index of [10, 12, 16]) state.board[index] = createGem('ruby');
    state.tiles[11] = signal();
    Object.assign(game, {
      board: state.board,
      tiles: state.tiles,
      boardCols: 5,
      boardRows: 5,
      remainingLayers: 1,
      totalLayers: 1,
      totalRelics: 0,
      oreOrders: [{ color: 'ruby', target: 3, progress: 0 }],
      moves: 10000,
      animationInProgress: false,
    });
    game.syncRunClock(true);
    now = 60 * 60 * 1000;
    expect(await game.resolveSwap(11, 16)).toBe(true);
    expect(game.moves).toBe(10001);
    expect(game.elapsedMs).toBe(now);
    expect(game.remainingOre).toBe(0);
    expect(game.remainingLayers).toBe(0);
    expect(game.levelCleared).toBe(true);
    expect(game.levelRewards.map((reward) => reward.source)).toEqual(['completion']);
    const coins = campaign.town.coins;
    const runs = campaign.town.completedRuns;
    game.completeLevel();
    expect(await game.resolveSwap(11, 16)).toBe(false);
    expect(campaign.town.coins).toBe(coins);
    expect(campaign.town.completedRuns).toBe(runs);
  });
});

describe('append-only campaign and replay', () => {
  it('preserves all original 240 level layouts, objectives, seeds, tips and reward targets', () => {
    // Baseline digest from 8aa015e. Ignore ephemeral gem IDs and the new empty
    // oreOrders property, which has no effect on any original level.
    const levels = generateLevelConfigs(240).map(({ board, oreOrders, ...level }) => {
      expect(oreOrders ?? []).toEqual([]);
      return {
        ...level,
        board: board.map((gem) => (gem ? { type: gem.type, highlight: gem.highlight } : null)),
      };
    });
    expect(createHash('sha256').update(JSON.stringify(levels)).digest('hex')).toBe(
      'cfc3e3c569d690d39e43c394aec83dce9423d0569c54255dfc6978cd8be4521f',
    );
  });

  it('gives every appended puzzle a reachable chapter mechanic and available ore colors', () => {
    const levels = generateLevelConfigs().slice(240);
    expect(levels).toHaveLength(84);
    for (const level of levels) {
      const signals = level.tiles.filter((tile) => tile.signalHealth);
      expect(signals.length + level.oreOrders.length, `level ${level.id}`).toBeGreaterThan(0);
      for (const tile of signals) expect(tile.type).not.toBe('blocker');
      for (const order of level.oreOrders) {
        expect(level.boardLayout.gemTypes).toContain(order.color);
        expect(order.progress).toBe(0);
        expect(order.target).toBeGreaterThan(0);
      }
      expect(level.moveLimit).toBeUndefined();
      expect(level.maxMoves).toBeUndefined();
    }
  });

  it('resets ore and signal progress on replay without mutating the authored level', () => {
    const game = useGameStore();
    const campaign = useCampaignStore();
    campaign.records = Object.fromEntries(
      Array.from({ length: 324 }, (_, index) => [index + 1, { score: 1, stars: 1 }]),
    );
    game.bootstrap();
    campaign.town.buildings.museum = 1;
    for (const id of [241, 247, 259, 266]) {
      game.startLevel(id);
      expect(game.currentLevelId).toBe(id);
      expect(game.sessionActive).toBe(true);
      const original = JSON.stringify(game.availableLevels[id - 1].config);
      for (const order of game.oreOrders) order.progress = order.target;
      for (const tile of game.tiles) if (tile.signalHealth) tile.signalHealth = 0;
      game.startLevel(id);
      expect(JSON.stringify(game.availableLevels[id - 1].config)).toBe(original);
      expect(game.oreOrders.every((order) => order.progress === 0)).toBe(true);
      expect(game.tiles.reduce((sum, tile) => sum + layerCount(tile), 0)).toBe(game.totalLayers);
    }
    game.startLevel(1);
    expect(game.oreOrders).toEqual([]);
    expect(game.tiles.some((tile) => tile.signalHealth)).toBe(false);
  });
});
