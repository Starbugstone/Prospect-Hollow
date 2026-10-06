import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';
import { createPinia, setActivePinia } from 'pinia';
import { HintEngine } from '../src/game/engine/HintEngine';
import { levelConfig } from '../src/game/engine/LevelGenerator';

afterEach(() => useGameStore().exitLevel());

describe('Starting an unlocked mine', () => {
  let gameStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    gameStore = useGameStore();

    gameStore.bootstrap(); // Load levels
    gameStore.sessionActive = true;
  });

  it('starts an unlocked early level with a compact, fully populated, playable board', () => {
    const levelThree = levelConfig(3);
    expect(levelThree).toBeDefined();

    useCampaignStore().records = { 1: { stars: 1, score: 0 }, 2: { stars: 1, score: 0 } };
    gameStore.startLevel(levelThree.id);

    expect(gameStore.boardCols).toBe(6);
    expect(gameStore.boardRows).toBe(7);
    expect(gameStore.currentBoardLayout.name).toBe('level_3');

    const allCellsFilled = gameStore.board.every((cell) => cell !== null);
    expect(allCellsFilled).toBe(true);

    expect(
      new HintEngine().findBestMove(
        gameStore.board,
        gameStore.tiles,
        gameStore.boardCols,
        gameStore.boardRows,
      ),
    ).not.toBeNull();
  });
});
