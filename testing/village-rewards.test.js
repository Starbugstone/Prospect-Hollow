import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';
import { SAVE_KEY } from '../src/services/localProfile';
import { BUILDINGS } from '../src/data/town';
import {
  availableChestDrops,
  rewardUse,
  BONUS_CAPACITIES,
  chestCoinsEarned,
  CHEST_DROPS,
  CONTINUOUS_COIN_CAP,
  HAMMER_CAPACITY,
  rollChestReward,
  shuffleChestDrops,
} from '../src/data/rewards';
import { advanceConstruction } from '../src/game/town/TownRules';
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
  useGameStore().cancelHint();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const award = (id, quantity = 1) => {
  const drop = CHEST_DROPS.find((drop) => drop.id === id);
  return useCampaignStore().awardReward({ ...drop, quantity });
};

describe('A village with lasting choices', () => {
  it('requires a completed museum for replay and continuous play while leaving the next puzzle open', () => {
    const campaign = useCampaignStore(),
      game = useGameStore();
    game.bootstrap();
    expect(game.startLevel(1, 'continuous')).toBe(false);
    campaign.records[1] = { score: 8000, stars: 2 };
    campaign.upgradeBuilding('museum', 0);
    expect(game.startLevel(1)).toBe(false);
    expect(campaign.canPlay(2)).toBe(true);
    expect(campaign.canReplay).toBe(false);
    campaign.town = advanceConstruction(campaign.town);
    expect(campaign.canReplay).toBe(false);
    expect(campaign.finishConstruction('museum', 1)).toBe(true);
    expect(campaign.canPlay(1)).toBe(true);
    expect(campaign.canPlay(2, 'continuous')).toBe(true);
    expect(game.startLevel(3, 'continuous')).toBe(false);
  });
  it('opens small buildings immediately and requires one run for larger buildings', () => {
    expect(
      Object.fromEntries(BUILDINGS.filter((b) => !b.unlock).map((b) => [b.id, b.upgrades[0].runs])),
    ).toEqual({
      well: 0,
      farm: 0,
      home: 0,
      saloon: 1,
      stable: 1,
      sheriff: 1,
      museum: 1,
      armory: 1,
      bank: 1,
      shop: 1,
      square: 0,
    });
  });
  it('builds for free with no coins, grants benefits immediately, and persists exactly once', () => {
    const campaign = useCampaignStore();
    campaign.upgradeBuilding('well', 0);
    campaign.town.coins = 0;
    award('builder-hammer', 2);
    expect(campaign.useBuilderHammer('museum', 0)).toBe(true);
    expect(campaign.town.coins).toBe(0);
    expect(campaign.town.projects.museum).toBeUndefined();
    expect(campaign.canReplay).toBe(true);
    expect(campaign.builderHammers).toBe(1);
    expect(campaign.useBuilderHammer('museum', 0)).toBe(false);
    setActivePinia(createPinia());
    const reloaded = useCampaignStore();
    expect(reloaded.builderHammers).toBe(1);
    expect(reloaded.canReplay).toBe(true);
    expect(reloaded.town.coins).toBe(0);
    expect(reloaded.useBuilderHammer('museum', 0)).toBe(false);
  });
  it('opens small buildings and upgrades every tier without coins or puzzle progress', () => {
    const campaign = useCampaignStore();
    campaign.upgradeBuilding('well', 0);
    award('builder-hammer', 5);
    expect(campaign.useBuilderHammer('farm', 0)).toBe(true);
    for (let stage = 0; stage < 3; stage++) {
      expect(campaign.useBuilderHammer('armory', stage)).toBe(true);
      expect(campaign.bonusLimit).toBe(BONUS_CAPACITIES[stage + 1]);
      expect(campaign.town.projects.armory).toBeUndefined();
      expect(campaign.town.coins).toBe(0);
    }
    expect(campaign.useBuilderHammer('armory', 3)).toBe(false);
    expect(campaign.builderHammers).toBe(1);
    expect(campaign.town.buildings.armory).toBe(3);
    expect(campaign.records).toEqual({});
  });
  it('rejects locked, unknown, stale, and already funded work without spending a hammer', () => {
    const campaign = useCampaignStore();
    campaign.upgradeBuilding('museum', 0);
    award('builder-hammer', 3);
    for (const [id, stage] of [
      ['home2', 0],
      ['unknown', 0],
      ['constructor', 0],
      ['well', 1],
      ['museum', 0],
      ['museum', 1],
    ]) {
      expect(campaign.useBuilderHammer(id, stage)).toBe(false);
    }
    expect(campaign.builderHammers).toBe(3);
    expect(campaign.town.projects.museum).toMatchObject({ stage: 1, wins: 0 });
    expect(campaign.useBuilderHammer('well', 0)).toBe(true);
    expect(campaign.useBuilderHammer('well', 1)).toBe(true);
    expect(campaign.useBuilderHammer('well2', 0)).toBe(true);
    expect(campaign.town.projects.museum.wins).toBe(0);
    expect(campaign.town.coins).toBe(0);
  });
  it('requires a builder hammer even when TNT bonuses are available', () => {
    const campaign = useCampaignStore();
    award('tnt');
    expect(campaign.useBuilderHammer('museum', 0)).toBe(false);
    expect(campaign.powers.find((p) => p.id === 'tnt').quantity).toBe(1);
    expect(campaign.town.buildings.museum).toBe(0);
    expect(campaign.town.projects).toEqual({});
  });
  it('raises capacity only on completion at all armory tiers', () => {
    const campaign = useCampaignStore();
    campaign.town.coins = 1000;
    for (let stage = 0; stage < 3; stage++) {
      expect(campaign.upgradeBuilding('armory', stage)).toBe(true);
      const runs = campaign.town.projects.armory.required;
      for (let i = 0; i < runs; i++) {
        expect(campaign.bonusLimit).toBe(BONUS_CAPACITIES[stage]);
        campaign.town = advanceConstruction(campaign.town);
      }
      expect(campaign.bonusLimit).toBe(BONUS_CAPACITIES[stage]);
      expect(campaign.finishConstruction('armory', stage + 1)).toBe(true);
      expect(campaign.bonusLimit).toBe(BONUS_CAPACITIES[stage + 1]);
      award('shuffle', 100);
      expect(campaign.powers.find((p) => p.id === 'shuffle').quantity).toBe(campaign.bonusLimit);
    }
  });
});

describe('Bounded, saved chest rewards', () => {
  it('omits full inventory from every reel position and keeps coins available', () => {
    const campaign = useCampaignStore();
    campaign.powers.find((p) => p.id === 'tnt').quantity = campaign.bonusLimit;
    campaign.builderHammers = HAMMER_CAPACITY;
    const eligible = availableChestDrops(campaign);
    expect(eligible.map((p) => p.id)).not.toContain('tnt');
    expect(eligible.map((p) => p.id)).not.toContain('builder-hammer');
    expect(shuffleChestDrops(() => 0, eligible)).toHaveLength(CHEST_DROPS.length - 2);
    campaign.powers.forEach((p) => (p.quantity = campaign.bonusLimit));
    expect(availableChestDrops(campaign).map((p) => p.id)).toEqual(['coins']);
    campaign.town.buildings.armory = 1;
    expect(availableChestDrops(campaign).some((p) => p.id === 'tnt')).toBe(true);
  });
  it('identifies where each chest reward is used', () => {
    for (const drop of CHEST_DROPS)
      expect(rewardUse(drop)).toBe(
        ['coins', 'builder-hammer'].includes(drop.id) ? 'Village' : 'Mine',
      );
  });
  it('randomizes each visual order while preserving every reward and the weighted catalog', () => {
    const catalog = CHEST_DROPS.map((drop) => ({ ...drop }));
    const first = shuffleChestDrops(() => 0);
    const second = shuffleChestDrops(() => 0.999);
    expect(first).not.toEqual(second);
    const sorted = (drops) => [...drops].sort((a, b) => a.id.localeCompare(b.id));
    for (const order of [first, second]) {
      expect(order).not.toBe(CHEST_DROPS);
      expect(sorted(order)).toEqual(sorted(catalog));
    }
    expect(CHEST_DROPS).toEqual(catalog);
  });
  it('rolls 70% powers, 20% coins and 10% builder hammers', () => {
    const counts = {},
      powers = {};
    for (let i = 0; i < 1000; i++) {
      const r = rollChestReward(() => (i + 0.5) / 1000);
      counts[r.kind] = (counts[r.kind] ?? 0) + 1;
      if (r.kind === 'power') powers[r.id] = (powers[r.id] ?? 0) + 1;
    }
    expect(counts).toEqual({ power: 700, coins: 200, 'builder-hammer': 100 });
    expect(powers).toEqual({
      'clear-row': 210,
      shuffle: 70,
      tnt: 175,
      'color-wand': 140,
      'tile-breaker': 105,
    });
  });
  it.each(['clear-row', 'tnt', 'color-wand', 'shuffle', 'tile-breaker'])(
    'caps %s and converts excess from every award route',
    (id) => {
      const campaign = useCampaignStore(),
        slot = campaign.powers.find((p) => p.id === id);
      slot.quantity = 2;
      campaign.awardReward({ id, label: slot.label, kind: 'power', quantity: 3 });
      expect(slot.quantity).toBe(3);
      expect(campaign.town.coins).toBe(20);
      const result = award(id);
      expect(result).toMatchObject({ kind: 'coins', quantity: 10, convertedFrom: slot.label });
      setActivePinia(createPinia());
      expect(useCampaignStore().town.coins).toBe(30);
      expect(useCampaignStore().powers.find((p) => p.id === id).quantity).toBe(3);
    },
  );
  it('caps builder hammers independently of the armory and rejects invalid grants', () => {
    const campaign = useCampaignStore();
    campaign.town.buildings.armory = 3;
    award('builder-hammer', HAMMER_CAPACITY + 2);
    expect(campaign.builderHammers).toBe(5);
    expect(campaign.town.coins).toBe(20);
    for (const quantity of [0, -1, 1.5, NaN, Infinity]) expect(award('coins', quantity)).toBeNull();
    expect(campaign.town.coins).toBe(20);
  });
  it('settles coin and builder rewards once, before opening the roulette', () => {
    const campaign = useCampaignStore();
    const runId = campaign.beginRun();
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.8).mockReturnValueOnce(0.95);
    const input = {
      runId,
      id: 1,
      score: 12000,
      target: 6000,
      combo: 1,
      elapsedMs: 10000,
      speedTargetMs: 60000,
      jewels: 0,
    };
    const rewards = campaign.recordVictory(input);
    expect(rewards.map((r) => r.items[0].kind)).toEqual(['coins', 'builder-hammer']);
    expect(campaign.town.coins).toBe(500);
    expect(campaign.builderHammers).toBe(1);
    const snapshot = saved.get(SAVE_KEY);
    expect(campaign.recordVictory(input)).toEqual([]);
    expect(saved.get(SAVE_KEY)).toBe(snapshot);
    setActivePinia(createPinia());
    expect(useCampaignStore().recordVictory(input)).toEqual([]);
    expect(useCampaignStore().builderHammers).toBe(1);
  });
  it('keeps the old armory capacity for victory chests until the building is opened', () => {
    const campaign = useCampaignStore();
    campaign.upgradeBuilding('armory', 0);
    campaign.powers.find((p) => p.id === 'clear-row').quantity = 3;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const rewards = campaign.recordVictory({
      id: 1,
      runId: campaign.beginRun(),
      score: 9000,
      target: 6000,
      combo: 1,
    });
    expect(campaign.bonusLimit).toBe(3);
    expect(rewards[0].items[0]).toMatchObject({ kind: 'power', id: 'tnt' });
    expect(campaign.powers.find((p) => p.id === 'clear-row').quantity).toBe(3);
    expect(campaign.finishConstruction('armory', 1)).toBe(true);
    expect(campaign.bonusLimit).toBe(5);
  });
  it('migrates over-cap saved inventory once, preserving its value as coins', () => {
    saved.set(
      SAVE_KEY,
      JSON.stringify({ powers: [{ id: 'tnt', quantity: 20 }], builderHammers: 8 }),
    );
    const campaign = useCampaignStore();
    expect(campaign.town.coins).toBe(200);
    expect(campaign.inventoryNotice).toBeTruthy();
    campaign.save();
    setActivePinia(createPinia());
    expect(useCampaignStore().town.coins).toBe(200);
    expect(useCampaignStore().builderHammers).toBe(5);
  });
});

describe('Continuous play for amusement', () => {
  it('stays playable after objectives, saves a separate score, and never advances the campaign or town', () => {
    const campaign = useCampaignStore(),
      game = useGameStore();
    campaign.town.buildings.museum = 1;
    campaign.town.coins = 50;
    campaign.upgradeBuilding('well', 0);
    game.bootstrap();
    game.startLevel(1, 'continuous');
    const before = structuredClone(JSON.parse(JSON.stringify(campaign.town.projects)));
    game.remainingLayers = 0;
    game._applyScoring([{ cleared: Array(100).fill(0), collectedJewels: Array(300).fill({}) }]);
    game.completeLevel();
    expect(game.sessionActive).toBe(true);
    expect(game.levelCleared).toBe(false);
    expect(game.levelRewards).toEqual([]);
    expect(campaign.continuousRecords[1]).toEqual({ coins: 25, score: 10000 });
    expect(campaign.records).toEqual({});
    expect(campaign.nextLevel).toBe(1);
    expect(campaign.town.projects).toEqual(before);
    expect(campaign.recordVictory({ id: 1, score: 10000, target: 100, runId: game.runId })).toEqual(
      [],
    );
    expect(campaign.powers.every((p) => p.quantity === 0)).toBe(true);
  });
  it('caps coins per level across moves, repeat visits and reloads, while scores can keep improving', () => {
    let campaign = useCampaignStore();
    campaign.town.buildings.museum = 1;
    const run = campaign.beginRun('continuous', 1);
    const record = (runId, jewels, score) =>
      campaign.recordContinuous({ id: 1, runId, jewels, score });
    record(run, 100, 1000);
    record(run, 100, 1000);
    expect(campaign.town.coins).toBe(10);
    record(run, 200, 2000);
    expect(campaign.town.coins).toBe(20);
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    expect(record(run, 300, 3000)).toBe(false);
    const next = campaign.beginRun('continuous', 1);
    record(next, 10000, 99999);
    record(next, 20000, 199999);
    expect(campaign.town.coins).toBe(CONTINUOUS_COIN_CAP);
    expect(campaign.continuousRecords[1].score).toBe(199999);
    const third = campaign.beginRun('continuous', 1);
    record(third, 10000, 5000);
    expect(campaign.town.coins).toBe(25);
    campaign.records[1] = { score: 100, stars: 1 };
    const other = campaign.beginRun('continuous', 2);
    expect(campaign.recordContinuous({ id: 2, runId: other, jewels: 250, score: 2000 })).toBe(true);
    expect(campaign.town.coins).toBe(50);
  });
  it('rejects normal, replaced, locked, or invalid continuous receipts', () => {
    const campaign = useCampaignStore();
    campaign.town.buildings.museum = 1;
    let runId = campaign.beginRun();
    expect(campaign.recordContinuous({ id: 1, runId, jewels: 100, score: 100 })).toBe(false);
    runId = campaign.beginRun('continuous', 1);
    for (const data of [
      { id: 2 },
      { jewels: NaN },
      { jewels: -1 },
      { score: Infinity },
      { runId: runId - 1 },
    ])
      expect(campaign.recordContinuous({ id: 1, runId, jewels: 100, score: 100, ...data })).toBe(
        false,
      );
    expect(campaign.town.coins).toBe(0);
  });
  it('resets continuous scores, coin caps, hammers and buildings together', () => {
    const campaign = useCampaignStore();
    campaign.town.buildings.museum = 1;
    award('builder-hammer', 3);
    const runId = campaign.beginRun('continuous', 1);
    campaign.recordContinuous({ id: 1, runId, jewels: 250, score: 10000 });
    campaign.resetProgress();
    setActivePinia(createPinia());
    const reset = useCampaignStore();
    expect(reset.continuousRecords).toEqual({});
    expect(reset.builderHammers).toBe(0);
    expect(reset.canReplay).toBe(false);
    expect(reset.bonusLimit).toBe(3);
    expect(reset.town.coins).toBe(0);
  });
});

it('totals chest coin prizes and overflow once without counting inventory items', () => {
  expect(chestCoinsEarned([])).toBe(0);
  expect(chestCoinsEarned([{ items: [{ kind: 'power', quantity: 1, overflowCoins: 0 }] }])).toBe(0);
  expect(
    chestCoinsEarned([
      { items: [{ kind: 'coins', quantity: 1500 }] },
      { items: [{ kind: 'coins', quantity: 1500, overflowCoins: 0 }] },
    ]),
  ).toBe(3000);
  expect(
    chestCoinsEarned([
      { items: [{ kind: 'coins', quantity: 10, convertedFrom: 'TNT' }] },
      {
        items: [
          { kind: 'power', quantity: 1, overflowCoins: 20 },
          { kind: 'builder-hammer', quantity: 1, overflowCoins: 0 },
        ],
      },
    ]),
  ).toBe(30);
});
