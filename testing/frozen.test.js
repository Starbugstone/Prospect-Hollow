import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../src/stores/gameStore';
import { createPinia, setActivePinia } from 'pinia';
import { createGem } from '../src/game/engine/GemFactory';
import { BOARD_PRESENTERS } from '../src/game/phaser/boardPresenters';

describe('GameStore - Frozen Tiles', () => {
  let gameStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    gameStore = useGameStore();

    // Mock minimal renderer for testing attachRenderer
    gameStore.attachRenderer({
      presenters: BOARD_PRESENTERS,
      scene: {}, // Mock scene
      boardContainer: { add: () => {}, removeAll: () => {} },
      backgroundLayer: { add: () => {}, removeAll: () => {} },
      tileLayer: { add: () => {}, removeAll: () => {} },
      gemLayer: { add: () => {}, removeAll: () => {} },
      fxLayer: { add: () => {}, removeAll: () => {} },
      textures: {},
      bonusAnimations: {},
      tileTextures: {},
      particles: {},
    });

    gameStore.bootstrap(); // Load levels
    gameStore.sessionActive = true;
  });

  it('should prevent swapping of frozen tiles', async () => {
    gameStore.boardCols = 3;
    gameStore.boardRows = 3;
    gameStore.board = Array.from({ length: 9 }, (_, i) => createGem(`gem${i % 3}`));
    gameStore.tiles = Array.from({ length: 9 }, (_, i) => ({
      state: i === 0 ? 'FROZEN' : 'PLAYABLE', // Make tile at index 0 frozen
      health: 1,
    }));

    const initialBoard = [...gameStore.board];
    const initialTiles = JSON.parse(JSON.stringify(gameStore.tiles));

    // Attempt to swap frozen tile (index 0) with an adjacent playable tile (index 1)
    const swapSuccessful = await gameStore.resolveSwap(0, 1);

    expect(swapSuccessful).toBe(false); // Swap should be prevented
    expect(gameStore.board).toEqual(initialBoard); // Board should remain unchanged
    expect(gameStore.tiles).toEqual(initialTiles); // Tiles should remain unchanged
  });

  it('should unfreeze an adjacent tile when a match occurs', async () => {
    gameStore.boardCols = 3;
    gameStore.boardRows = 3;
    gameStore.board = [
      createGem('ruby'),
      createGem('ruby'),
      createGem('ruby'), // Match
      createGem('emerald'),
      createGem('emerald'),
      createGem('emerald'),
      createGem('sapphire'),
      createGem('sapphire'),
      createGem('sapphire'),
    ];
    gameStore.tiles = Array.from({ length: 9 }, (_, i) => ({
      state: i === 3 ? 'FROZEN' : 'PLAYABLE', // Tile at index 3 (below ruby match) is frozen
      health: 1,
    }));

    // Perform a dummy swap to trigger match resolution (the match is already set up)
    await gameStore.resolveSwap(0, 1);

    // Tile at index 3 should have been unfrozen
    expect(gameStore.tiles[3].state).toBe('PLAYABLE');
  });
});
