import { expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { isReactive } from 'vue';
import { generateLevelConfigs, levelConfig } from '../src/game/engine/LevelGenerator';
import { LEVEL_COUNT } from '../src/data/campaign';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';

// Gem ids come from a session counter; everything else is the level contract.
const withoutGemIds = (config) =>
  JSON.stringify({ ...config, board: config.board.map((gem) => gem && { ...gem, id: null }) });

it('generates each level alone exactly as in the full campaign list', () => {
  const all = generateLevelConfigs();
  expect(all).toHaveLength(LEVEL_COUNT);
  for (const config of all)
    expect(withoutGemIds(levelConfig(config.id))).toBe(withoutGemIds(config));
});

it('generates a level once and rejects unknown ids', () => {
  expect(levelConfig(7)).toBe(levelConfig(7));
  for (const id of [0, -1, LEVEL_COUNT + 1, 1.5, null, undefined, '3'])
    expect(levelConfig(id)).toBeNull();
});

it('keeps the live board and tiles out of deep reactivity', () => {
  setActivePinia(createPinia());
  const game = useGameStore();
  useCampaignStore();
  game.bootstrap();
  expect(game.startLevel(1)).toBe(true);
  expect(isReactive(game.board)).toBe(false);
  expect(isReactive(game.tiles)).toBe(false);
  expect(game.currentLevel.config).toBe(levelConfig(1));
  expect(game.board).not.toBe(levelConfig(1).board);
});
