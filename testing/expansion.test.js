import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { TileManager } from '../src/game/engine/TileManager';
import { HintEngine } from '../src/game/engine/HintEngine';
import { createGem } from '../src/game/engine/GemFactory';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { layerCount } from '../src/game/engine/TileRules';
import { EXPANSION_LEVELS } from '../src/data/expansion';
import { LEVEL_NAMES } from '../src/data/levelNames';
import { LEVEL_COUNT, CHAPTERS } from '../src/data/campaign';
import { useGameStore } from '../src/stores/gameStore';
import { SAVE_KEY, useCampaignStore } from '../src/stores/campaignStore';

const engine = new MatchEngine();
const manager = new TileManager();
const makeBoard = () => {
  const board = Array.from({ length: 25 }, (_, i) =>
    createGem(['ruby', 'emerald', 'topaz', 'sapphire', 'amethyst'][(i + Math.floor(i / 5)) % 5]),
  );
  return {
    board,
    tiles: board.map(() => ({ type: 'standard', health: 0, maxHealth: 0 })),
    cols: 5,
    rows: 5,
  };
};
const singleStep = () => vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Expansion campaign', () => {
  it('provides 288 authored 7 × 9 puzzles, matching chapter metadata and reachable relic exits', () => {
    const levels = generateLevelConfigs();
    expect(levels).toHaveLength(324);
    expect(LEVEL_COUNT).toBe(LEVEL_NAMES.length);
    expect(CHAPTERS).toHaveLength(54);
    const repeat = generateLevelConfigs();
    for (const [offset, spec] of EXPANSION_LEVELS.entries()) {
      expect(spec.map.split('/')).toHaveLength(9);
      expect(spec.map.split('/').every((row) => row.length === 7)).toBe(true);
      const level = levels[offset + 36];
      expect([level.boardCols, level.boardRows, level.tiles.length]).toEqual([7, 9, 63]);
      expect(level.chapterName).toBe(CHAPTERS[Math.floor((level.id - 1) / 6)].name);
      expect(level.board.map((gem) => gem?.type)).toEqual(
        repeat[offset + 36].board.map((gem) => gem?.type),
      );
      expect(level.tiles).toEqual(repeat[offset + 36].tiles);
      expect(level.objectives[0].target).toBe(
        level.tiles.reduce((sum, tile) => sum + layerCount(tile), 0),
      );
      let moves = 0;
      for (let a = 0; a < 63; a++) {
        for (const b of [a + 1, a + 7]) {
          if (engine.evaluateSwap(level.board, 7, 9, a, b, level.tiles).matches.length) moves++;
        }
        if (level.board[a]?.type === 'relic') expect(level.tiles[56 + (a % 7)].exit).toBe(true);
      }
      expect(moves).toBeGreaterThanOrEqual(3);
      expect(engine.findMatches(level.board, 7, 9, level.tiles)).toEqual([]);
    }
  });

  it('continues an existing completed 36-level save at 37 and unlocks through 60', () => {
    const records = Object.fromEntries(
      Array.from({ length: 36 }, (_, i) => [i + 1, { score: 5000, stars: 2 }]),
    );
    const saved = new Map([[SAVE_KEY, JSON.stringify({ records })]]);
    vi.stubGlobal('localStorage', {
      getItem: (key) => saved.get(key),
      setItem: (key, value) => saved.set(key, value),
    });
    const campaign = useCampaignStore();
    expect(campaign.nextLevel).toBe(37);
    expect(campaign.totalStars).toBe(72);
    for (let id = 37; id <= 60; id++) {
      expect(campaign.isUnlocked(id)).toBe(true);
      expect(campaign.isUnlocked(id + 1)).toBe(false);
      campaign.recordVictory({ id, score: 0, target: 1000, combo: 1 });
    }
    setActivePinia(createPinia());
    expect(useCampaignStore().completedCount).toBe(60);
    expect(useCampaignStore().isUnlocked(61)).toBe(true);
  });
});

describe('Chains', () => {
  it('suggests and resolves a match through a pinned gem using only its free neighbors', () => {
    const state = makeBoard();
    for (const index of [10, 12, 16]) state.board[index] = createGem('ruby');
    state.tiles[12].chainHealth = 1;
    const evaluation = engine.evaluateSwap(state.board, 5, 5, 11, 16, state.tiles);
    expect(evaluation.matches.some(({ indices }) => indices.includes(12))).toBe(true);
    const hint = new HintEngine().findBestMove(state.board, state.tiles, 5, 5);
    expect(hint.indices).not.toContain(12);
    expect(
      engine
        .evaluateSwap(state.board, 5, 5, ...hint.indices, state.tiles)
        .matches.some(({ indices }) => indices.includes(12)),
    ).toBe(true);
    singleStep();
    manager.getResolution({ ...state, ...evaluation });
    expect(state.tiles[12].chainHealth).toBe(0);
  });
  it('includes pinned gems in matches but never swaps them', () => {
    const board = Array.from({ length: 3 }, () => createGem('ruby'));
    const tiles = [{}, { chainHealth: 1 }, {}];
    expect(engine.findMatches(board, 3, 1, tiles)[0].indices).toEqual([0, 1, 2]);
    expect(engine.evaluateSwap(board, 3, 1, 0, 1, tiles).matches).toEqual([]);
    expect(new HintEngine().findBestMove(board, tiles, 3, 1)).toBeNull();
  });

  it('pins chained gems while falling gems and refills pass them', () => {
    singleStep();
    const state = makeBoard();
    state.tiles[12].chainHealth = 1;
    const anchored = state.board[12],
      above = state.board[7];
    const result = manager.getResolution({
      ...state,
      matches: [{ type: 'tnt', indices: [22] }],
    });
    expect(result.board[12]).toBe(anchored);
    expect(result.board[17]).toBe(above);
    expect(result.board.every(Boolean)).toBe(true);
    expect(result.steps[0].drops).toContainEqual({ from: 7, to: 17, gem: above });
    expect(result.steps[0].spawns.some(({ index }) => index === 12)).toBe(false);
  });

  it.each(['ruby', 'tnt'])(
    'releases a chain once per step with %s, preserving its gem and underlying ice',
    (type) => {
      singleStep();
      const state = makeBoard();
      state.tiles[12] = {
        type: 'standard',
        health: 2,
        maxHealth: 2,
        chainHealth: 1,
        maxChainHealth: 1,
      };
      const anchored = state.board[12];
      const result = manager.getResolution({
        ...state,
        matches: [{ type, indices: [11, 12, 13] }],
      });
      expect(state.tiles[12]).toMatchObject({ chainHealth: 0, health: 2 });
      expect(result.layersCleared).toBe(1);
      expect(result.board).toContain(anchored);
      expect(result.steps[0].cleared).not.toContain(12);
    },
  );

  it('does not unlock from adjacent or diagonal matches', () => {
    singleStep();
    const state = makeBoard();
    state.tiles[12].chainHealth = 1;
    state.tiles[10].chainHealth = 1;
    manager.getResolution({
      ...state,
      matches: [{ type: 'ruby', indices: [3, 4, 9, 7, 11, 13, 17] }],
    });
    expect(state.tiles[12].chainHealth).toBe(1);
    expect(state.tiles[10].chainHealth).toBe(1);
  });
});

describe('Colored seals', () => {
  it.each([
    ['sapphire', 1],
    ['ruby', 0],
    ['tnt', 0],
    ['bonus-activation', 0],
  ])('a %s match leaves ruby seal health at %i', (type, health) => {
    singleStep();
    const state = makeBoard();
    state.tiles[12] = { type: 'seal', sealColor: 'ruby', health: 1, maxHealth: 1 };
    const gem = state.board[12];
    const result = manager.getResolution({ ...state, matches: [{ type, indices: [11, 12, 13] }] });
    expect(state.tiles[12].health).toBe(health);
    expect(result.layersCleared).toBe(1 - health);
    expect(result.board).not.toContain(gem);
    expect(state.tiles[12].sealColor).toBe('ruby');
  });

  it('opens a seal under the gem that becomes a bonus, using the original match color', () => {
    singleStep();
    const state = makeBoard();
    state.tiles[12] = { type: 'seal', sealColor: 'ruby', health: 1, maxHealth: 1 };
    state.board[12] = createGem('bomb');
    manager.getResolution({
      ...state,
      matches: [{ type: 'ruby', indices: [10, 11, 12, 13] }],
      bonusesCreated: ['bomb'],
      bonusIndices: [12],
    });
    expect(state.tiles[12].health).toBe(0);
  });
});

describe('Relics', () => {
  it('cannot be matched or swapped', () => {
    const board = Array.from({ length: 3 }, () => createGem('relic'));
    expect(engine.findMatches(board, 3)).toEqual([]);
    expect(engine.evaluateSwap(board, 3, 1, 0, 1).matches).toEqual([]);
    expect(new HintEngine().findBestMove(board, [{}, {}, {}], 3, 1)).toBeNull();
  });

  it('survives a blast and stays on the board when no exit is present', () => {
    singleStep();
    const state = makeBoard();
    const relic = (state.board[12] = createGem('relic'));
    const result = manager.getResolution({
      ...state,
      matches: [{ type: 'tnt', indices: [12, 17, 22] }],
    });
    expect(result.board[22]).toBe(relic);
    expect(result.relicsCollected).toBe(0);
    expect(result.steps[0].cleared).not.toContain(12);
  });

  it('collects stacked relics through one exit, animates each fall, then refills without relic spawns', () => {
    singleStep();
    const state = makeBoard();
    state.board[12] = createGem('relic');
    state.board[17] = createGem('relic');
    state.tiles[22].exit = true;
    const result = manager.getResolution({
      ...state,
      matches: [{ type: 'tnt', indices: [22] }],
    });
    expect(result.relicsCollected).toBe(2);
    expect(result.steps.filter((step) => step.collectedRelics?.length)).toHaveLength(2);
    expect(result.board.every((gem) => gem && gem.type !== 'relic')).toBe(true);
    expect(
      result.steps.flatMap((step) => step.spawns).every(({ gem }) => gem.type !== 'relic'),
    ).toBe(true);
  });

  it('requires both relic collection and obstacle clearance to win', () => {
    const game = useGameStore();
    Object.assign(game, {
      sessionActive: true,
      currentLevelId: 1,
      remainingLayers: 0,
      board: [createGem('relic')],
    });
    game.completeLevel();
    expect(game.levelCleared).toBe(false);
    game.board = [];
    game.remainingLayers = 1;
    game.completeLevel();
    expect(game.levelCleared).toBe(false);
    game.remainingLayers = 0;
    game.completeLevel();
    expect(game.levelCleared).toBe(true);
  });

  it('updates relic progress and completes after a collection with no remaining layers', async () => {
    singleStep();
    const state = makeBoard();
    state.board[17] = createGem('relic');
    state.tiles[22].exit = true;
    const game = useGameStore();
    Object.assign(game, {
      sessionActive: true,
      currentLevelId: 1,
      board: state.board,
      tiles: state.tiles,
      boardCols: 5,
      boardRows: 5,
      totalRelics: 1,
      remainingLayers: 0,
      activeBonusMode: 'tnt',
      objectives: [{ type: 'collect-relics', target: 1, progress: 0 }],
    });
    expect(await game.resolveBonusClick(22)).toBe(true);
    expect(game.remainingRelics).toBe(0);
    expect(game.objectives[0].progress).toBe(1);
    expect(game.levelCleared).toBe(true);
  });
});

it('shuffles only movable gems and restores chains, seals and relics on replay', async () => {
  const game = useGameStore();
  useCampaignStore().records = Object.fromEntries(
    Array.from({ length: 59 }, (_, i) => [i + 1, { score: 0, stars: 1 }]),
  );
  game.bootstrap();
  singleStep();
  useCampaignStore().town.buildings.museum = 1;
  for (const id of [48, 54, 60]) {
    game.startLevel(id);
    game.animationInProgress = false;
    const original = JSON.stringify(game.availableLevels[id - 1].config);
    const anchored = game.board.flatMap((gem, index) =>
      game.tiles[index].chainHealth || gem?.type === 'relic' ? [{ index, id: gem.id }] : [],
    );
    await game.shuffleBoard();
    for (const gem of anchored) expect(game.board[gem.index].id).toBe(gem.id);
    game.tiles.forEach((tile) => {
      tile.health = 0;
      if (tile.chainHealth) tile.chainHealth = 0;
    });
    game.board = game.board.map((gem) => (gem?.type === 'relic' ? createGem('ruby') : gem));
    game.startLevel(id);
    expect(JSON.stringify(game.availableLevels[id - 1].config)).toBe(original);
    expect(game.tiles.reduce((sum, tile) => sum + layerCount(tile), 0)).toBe(game.totalLayers);
    expect(game.remainingRelics).toBe(id === 60 ? 3 : 0);
    expect(game.objectives.every((objective) => objective.progress === 0)).toBe(true);
  }
});
