import * as chestRewards from '../src/data/rewards';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { LEVEL_COUNT, getChestTier } from '../src/data/campaign';
import { localProfile } from '../src/services/localProfile';

let saved;
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  setActivePinia(createPinia());
  vi.spyOn(chestRewards, 'rollChestReward').mockReturnValue({
    id: 'coins',
    kind: 'coins',
    label: 'Coins',
    quantity: 500,
  });
});
afterEach(() => {
  useGameStore().cancelHint();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('keeps view replacement income hooks from writing or reporting a storage failure', () => {
  const campaign = useCampaignStore();
  campaign.save();
  const before = saved.get(SAVE_KEY);
  const release = localProfile.suspendWrites();
  try {
    campaign.reloadLocal();
    campaign.accrueSaloonIncome(Date.now() + 1000);
    expect(saved.get(SAVE_KEY)).toBe(before);
    expect(campaign.saveWarning).toBe('');
    expect(campaign.save()).toBe(false);
  } finally {
    release();
  }
  expect(campaign.save()).toBe(true);
  expect(saved.get(SAVE_KEY)).not.toBe(before);
});

it('stages obstacles while leaving a lighter fifth puzzle in every chapter', () => {
  const levels = generateLevelConfigs();
  expect(levels).toHaveLength(LEVEL_COUNT);
  for (let start = 0; start < levels.length; start += 6) {
    const chapter = levels.slice(start, start + 6);
    const workload = chapter.map((level) => level.objectives[0].target);
    expect(workload[4]).toBeLessThan(workload[3]);
    expect(workload[5]).toBeGreaterThan(workload[4]);
    expect(chapter[4].chestTarget).toBeLessThan(chapter[3].chestTarget);
    if (start) expect(workload[0]).toBeLessThan(levels[start - 1].objectives[0].target);
  }
  for (const level of levels.slice(0, 36)) {
    const blockers = level.tiles.filter((tile) => tile.type === 'blocker');
    expect(blockers.length > 0).toBe(level.id >= 7);
    expect(blockers.some((tile) => tile.health === 2)).toBe(
      level.id >= 19 && level.pace !== 'rest',
    );
    expect(level.tiles.some((tile) => tile.state === 'FROZEN')).toBe(level.id >= 31);
    level.tiles.forEach((tile, i) => expect(level.board[i] === null).toBe(tile.type === 'blocker'));
  }
});

it('gives the four-color opening enough ice to play and keeps the first two chapters single-layered', () => {
  const levels = generateLevelConfigs();
  expect(levels[0].objectives[0].target).toBe(32);
  for (const level of levels.slice(0, 12)) {
    level.tiles.forEach((tile) => {
      expect(tile.health).toBeLessThanOrEqual(1);
    });
  }
  for (const level of levels) expect(level.tiles.every((tile) => tile.health <= 2)).toBe(true);
});
it('enforces sequential unlocks in the game action, saves completion and awards only once', () => {
  const game = useGameStore();
  const campaign = useCampaignStore();
  game.bootstrap();
  expect(game.startLevel(3)).toBe(false);
  expect(game.sessionActive).toBe(false);
  game.startLevel(1);
  game.score = game.objectives.find((objective) => objective.type === 'score').target;
  game.completeLevel();
  expect(campaign.completedCount).toBe(0);
  game.remainingLayers = 0;
  game.completeLevel();
  expect(campaign.nextLevel).toBe(2);
  expect(game.levelRewards[0].items).toHaveLength(1);
  const powers = campaign.powers.reduce((sum, power) => sum + power.quantity, 0);
  game.completeLevel();
  expect(campaign.powers.reduce((sum, power) => sum + power.quantity, 0)).toBe(powers);
  setActivePinia(createPinia());
  expect(useCampaignStore().nextLevel).toBe(2);
  expect(useCampaignStore().powers.reduce((sum, power) => sum + power.quantity, 0)).toBe(powers);
});
it.each([
  [5999, 1],
  [6000, 1],
  [8999, 1],
  [9000, 1],
  [12000, 1],
])('awards the correct chest at score %i', (score, count) => {
  const campaign = useCampaignStore();
  const reward = campaign.recordVictory({ id: 1, score, target: 6000, combo: 1 });
  expect(reward[0]?.items.length ?? 0).toBe(count);
  expect(campaign.powers.reduce((sum, power) => sum + power.quantity, 0)).toBe(0);
  expect(campaign.town.coins).toBe(count * 500);
  expect(getChestTier(score, 0)).toBeNull();
});
it('keeps the best score and stars on replay, and saves used powers', () => {
  const campaign = useCampaignStore();
  campaign.recordVictory({ id: 1, score: 12000, target: 6000, combo: 4 });
  campaign.recordVictory({ id: 1, score: 100, target: 6000, combo: 1 });
  expect(campaign.records[1]).toEqual({ score: 12000, stars: 3 });
  const inventory = useInventoryStore();
  inventory.awardPower('tnt');
  const before = inventory.quickAccessSlots.find((power) => power.id === 'tnt').quantity;
  inventory.consumeItem('tnt');
  setActivePinia(createPinia());
  expect(useInventoryStore().quickAccessSlots.find((power) => power.id === 'tnt').quantity).toBe(
    before - 1,
  );
});
it('recovers from malformed saves and unavailable storage', () => {
  saved.set(SAVE_KEY, '{broken');
  expect(useCampaignStore().nextLevel).toBe(1);
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  });
  setActivePinia(createPinia());
  expect(() =>
    useCampaignStore().recordVictory({ id: 1, score: 6000, target: 6000, combo: 1 }),
  ).not.toThrow();
});

it('makes one weighted roll per earned chest and saves exactly those awards', () => {
  chestRewards.rollChestReward.mockRestore();
  const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.7);
  const campaign = useCampaignStore();
  const rewards = campaign.recordVictory({
    id: 1,
    score: 999999,
    target: 6000,
    combo: 4,
    elapsedMs: 1,
    speedTargetMs: 60000,
  });
  expect(random).toHaveBeenCalledTimes(2);
  expect(rewards.map((reward) => reward.items)).toEqual([
    [{ id: 'clear-row', kind: 'power', label: 'Clear Row', quantity: 1, overflowCoins: 0 }],
    [{ id: 'coins', kind: 'coins', label: 'Coins', quantity: 500, overflowCoins: 0 }],
  ]);
  expect(rewards.every((reward) => reward.count === 1)).toBe(true);
  setActivePinia(createPinia());
  expect(useCampaignStore().powers.map((power) => power.quantity)).toEqual([1, 0, 0, 0, 0]);
});
