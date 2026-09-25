import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';
import { mineTip, townTip } from '../src/data/guidance';
import fr from '../src/i18n/fr.json';

let saved;
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('remembers entering an empty village, without requiring a purchase or puzzle', () => {
  const campaign = useCampaignStore();
  expect(campaign.hasVisitedVillage).toBe(false);
  campaign.visitVillage();
  expect(campaign.completedCount).toBe(0);
  expect(Object.values(campaign.town.buildings).some(Boolean)).toBe(false);
  setActivePinia(createPinia());
  expect(useCampaignStore().hasVisitedVillage).toBe(true);
});
it('does not treat unrelated settings or unreadable progress as a returning village', () => {
  saved.set('settings', '{}');
  expect(useCampaignStore().hasVisitedVillage).toBe(false);
  saved.set(SAVE_KEY, 'broken');
  setActivePinia(createPinia());
  expect(useCampaignStore().hasVisitedVillage).toBe(false);
});
it('moves from the building tip to mining through actual building state', () => {
  const campaign = useCampaignStore();
  const coins = campaign.town.coins;
  expect(townTip(campaign)?.id).toBe('well');
  expect(campaign.upgradeBuilding('well', 0)).toBe(true);
  expect(campaign.town.coins).toBe(coins);
  expect(townTip(campaign)?.id).toBe('mine');
  campaign.records[1] = { stars: 1, score: 1 };
  expect(townTip(campaign)).toBe(null);
  campaign.town.buildings.home = 1;
  expect(townTip(campaign)?.id).toBe('happiness');
  campaign.town.tourSeen = true;
  expect(townTip(campaign)).toBe(null);
});
it('persists individual dismissals across backups and filters unknown tip ids', () => {
  const campaign = useCampaignStore();
  campaign.markTipSeen('well');
  campaign.markTipSeen('well');
  campaign.markTipSeen('invented');
  const backup = campaign.exportSave();
  campaign.markTipSeen('mine');
  campaign.importSave(backup);
  expect(campaign.seenTips).toEqual(['well']);
  expect(townTip(campaign)).toBe(null);
  const profile = JSON.parse(saved.get(SAVE_KEY));
  profile.seenTips = ['well', 'well', false, 'unknown'];
  saved.set(SAVE_KEY, JSON.stringify(profile));
  setActivePinia(createPinia());
  expect(useCampaignStore().seenTips).toEqual(['well']);
});
it('introduces bonus and fusion rules only when applicable, without wrapping rows', () => {
  const campaign = useCampaignStore();
  const game = {
    sessionActive: true,
    currentLevelId: 2,
    moves: 0,
    boardCols: 3,
    board: [{ type: 'ruby' }, { type: 'ruby' }, { type: 'bomb' }, { type: 'rainbow' }],
  };
  expect(mineTip(game, campaign)?.id).toBe('bonus');
  campaign.markTipSeen('bonus');
  expect(mineTip(game, campaign)).toBe(null);
  game.board[1] = { type: 'cross' };
  expect(mineTip(game, campaign)?.id).toBe('fusion');
  campaign.markTipSeen('fusion');
  campaign.powers[0].quantity = 1;
  expect(mineTip(game, campaign)?.id).toBe('powers');
  expect(fr[mineTip(game, campaign).text]).toBeTruthy();
});
it('keeps objective labels tied to the initial board after obstacles are cleared', () => {
  const game = useGameStore();
  game.bootstrap();
  game.startLevel(1);
  expect(game.layerLabel).toBe('Ice');
  game.tiles.forEach((tile) => {
    tile.health = 0;
  });
  expect(game.layerLabel).toBe('Ice');
  const mixed = game.availableLevels.find((level) =>
    level.config.tiles.some((tile) => tile.type === 'blocker'),
  );
  game.currentLevelId = mixed.id;
  game.objectives = mixed.config.objectives;
  expect(game.layerLabel).toBe('Ice & stone');
  game.currentLevelId = -1;
  game.objectives = [];
  expect(game.layerLabel).toBe('Layers');
});
