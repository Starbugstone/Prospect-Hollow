import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGameStore } from '../src/stores/gameStore';

// Mock dependencies
vi.mock('../src/game/engine/MatchEngine', () => ({
  MatchEngine: class {
    evaluateSwap() {
      return {
        matches: [{ type: 'standard', indices: [0, 1] }],
        board: [],
        bonuses: [],
      };
    }
    findMatches() {
      return [];
    }
  },
}));

vi.mock('../src/game/engine/TileManager', () => ({
  TileManager: class {
    getResolution() {
      return { board: [], steps: [], layersCleared: 1 };
    }
  },
}));

vi.mock('../src/game/engine/LevelGenerator', () => {
  const level = {
    id: 1,
    board: [
      { id: 'a', type: 'ruby' },
      { id: 'b', type: 'sapphire' },
    ],
    tiles: [{ health: 1, maxHealth: 1 }],
    objectives: [{ type: 'clear-layers', target: 1 }],
  };
  return {
    generateLevelConfigs: () => [level],
    levelConfig: (id) => (id === 1 ? level : null),
  };
});

describe('Victory Logic', () => {
  let store;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useGameStore();
    store.bootstrap();
    store.startLevel(1);
  });

  it('should initialize with correct state', () => {
    expect(store.sessionActive).toBe(true);
    expect(store.levelCleared).toBe(false);
    expect(store.remainingLayers).toBe(1);
  });

  it('should complete level when remaining layers reach 0', async () => {
    // Simulate swap that clears layers
    // We mocked TileManager to return layersCleared: 1

    // Mock resolveSwap internals or just call it
    // Since we mocked TileManager, calling resolveSwap should trigger completion if we set up state right

    store.remainingLayers = 1;
    store.animationInProgress = false;

    // Force resolveSwap to proceed
    await store.resolveSwap(0, 1);

    expect(store.remainingLayers).toBe(0);
    expect(store.levelCleared).toBe(true);
    expect(store.sessionActive).toBe(true); // Should remain true now
  });

  it('should prevent moves after level cleared', async () => {
    store.levelCleared = true;
    const result = await store.resolveSwap(0, 1);
    expect(result).toBe(false);
  });

  it('should track moves', async () => {
    expect(store.moves).toBe(0);
    store.animationInProgress = false;
    await store.resolveSwap(0, 1);
    expect(store.moves).toBe(1);
  });
});
