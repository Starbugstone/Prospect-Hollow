import * as chestRewards from '../src/data/rewards';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { markRaw } from 'vue';
import { PlayClock } from '../src/game/engine/PlayClock';
import { speedChestEarned } from '../src/data/campaign';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';

beforeEach(() => {
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

it('counts actionable time, excluding intros, cascades, and pauses without timer drift', () => {
  let now = 0;
  const clock = new PlayClock(() => now);
  now = 2000;
  expect(clock.read()).toBe(0);
  clock.setRunning(true);
  now = 3500;
  expect(clock.setRunning(false)).toBe(1500);
  now = 100000;
  expect(clock.read()).toBe(1500);
  clock.setRunning(true);
  now += 500;
  clock.setRunning(true);
  now += 500;
  expect(clock.setRunning(false)).toBe(2500);
  now += 5000;
  expect(clock.read()).toBe(2500);
  clock.reset();
  expect(clock.read()).toBe(0);
  expect(clock.started).toBe(false);
});

it.each([
  [30000, 1],
  [30001, 1],
  [45000, 1],
  [45001, 1],
  [60000, 1],
  [60001, 0],
  [0, 0],
  [-1, 0],
  [NaN, 0],
  [Infinity, 0],
  [undefined, 0],
])('maps %s active milliseconds to %i speed powers', (elapsed, count) => {
  expect(Number(speedChestEarned(elapsed, 60000))).toBe(count);
});

it.each([
  [12000, 20000, ['score', 'speed'], 2],
  [100, 20000, ['speed'], 1],
  [12000, 60001, ['score'], 1],
  [100, 60001, ['completion'], 1],
])('awards score %i and time %i independently', (score, elapsedMs, sources, count) => {
  const campaign = useCampaignStore();
  const rewards = campaign.recordVictory({
    id: 1,
    score,
    target: 6000,
    combo: 1,
    elapsedMs,
    speedTargetMs: 60000,
  });
  expect(campaign.town.coins).toBe(count * 500);
  expect(rewards.map((reward) => reward.source)).toEqual(sources);
  rewards.forEach((reward) => expect(reward.items).toHaveLength(1));
  expect(campaign.powers.reduce((sum, power) => sum + power.quantity, 0)).toBe(0);
});

it('saves both chests and the fastest run together, preserving old saves', () => {
  let saved = JSON.stringify({ records: { 1: { score: 9000, stars: 3 } } });
  vi.stubGlobal('localStorage', {
    getItem: () => saved,
    setItem: (key, value) => {
      expect(key).toBe(SAVE_KEY);
      saved = value;
    },
  });
  const campaign = useCampaignStore();
  campaign.recordVictory({
    id: 1,
    score: 12000,
    target: 6000,
    combo: 1,
    elapsedMs: 22000,
    speedTargetMs: 60000,
  });
  campaign.recordVictory({
    id: 1,
    score: 0,
    target: 6000,
    combo: 1,
    elapsedMs: 80000,
    speedTargetMs: 60000,
  });
  setActivePinia(createPinia());
  expect(useCampaignStore().records[1]).toEqual({ score: 12000, stars: 3, bestTimeMs: 22000 });
  expect(useCampaignStore().powers.reduce((sum, power) => sum + power.quantity, 0)).toBe(0);
});

it('freezes elapsed time on victory, grants both rewards only once and resets on replay', () => {
  let now = 0;
  const game = useGameStore();
  game.playClock = markRaw(new PlayClock(() => now));
  game.bootstrap();
  game.startLevel(1);
  game.syncRunClock(true);
  now = 20000;
  game.score = 12000;
  game.remainingLayers = 0;
  game.completeLevel();
  expect(game.elapsedMs).toBe(20000);
  expect(game.levelRewards.map((reward) => reward.source)).toEqual(['score', 'speed']);
  now = 100000;
  game.completeLevel();
  game.syncRunClock();
  expect(game.elapsedMs).toBe(20000);
  expect(useCampaignStore().powers.reduce((sum, power) => sum + power.quantity, 0)).toBe(0);
  useCampaignStore().town.buildings.museum = 1;
  game.startLevel(1);
  expect(game.elapsedMs).toBe(0);
  expect(game.levelRewards).toEqual([]);
});
