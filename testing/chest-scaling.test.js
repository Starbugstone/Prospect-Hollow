import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { LEVEL_COUNT } from '../src/data/campaign';
import { CHEST_ECONOMY_VERSION, chestCoinCap, chestCoinReward } from '../src/data/economy';
import { ERAS } from '../src/data/eras';
import { chestReward } from '../src/data/rewards';
import { SAVE_KEY, useCampaignStore } from '../src/stores/campaignStore';

let saves;
beforeEach(() => {
  saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
  vi.spyOn(Math, 'random').mockReturnValue(0.8);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  [1, 500],
  [6, 500],
  [7, 1000],
  [31, 2250],
  [66, 3500],
  [67, 3750],
  [72, 3750],
  [121, 4000],
  [144, 4000],
])('awards %i-level chests %i coins', (level, coins) => {
  expect(chestCoinReward(level)).toBe(coins);
  expect(chestReward('coins', level).quantity).toBe(coins);
  expect(chestReward('tnt', level).quantity).toBe(1);
  expect(chestReward('builder-hammer', level).quantity).toBe(1);
});
function win(campaign, chooseRewards) {
  campaign.records = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [i + 1, { score: 100, stars: 1 }]),
  );
  return campaign.recordVictory({
    id: 31,
    score: 2000,
    target: 1000,
    combo: 1,
    elapsedMs: 1000,
    speedTargetMs: 10000,
    chooseRewards,
  });
}
it.each(['automatic', 'tap', 'skip', 'reload'])(
  'preserves chapter payouts for both score and speed chests through %s',
  (route) => {
    const campaign = useCampaignStore();
    const rewards = win(campaign, route !== 'automatic');
    expect(rewards).toHaveLength(2);
    expect(rewards.every((chest) => chest.levelId === 31 && chest.items[0].quantity === 2250)).toBe(
      true,
    );
    if (route === 'tap') {
      // A later campaign state cannot change an already earned chest.
      campaign.records[31] = { score: 100, stars: 1 };
      for (const chest of rewards) {
        expect(campaign.claimChest(chest.id, 'coins').quantity).toBe(2250);
        expect(campaign.claimChest(chest.id, 'coins')).toBeNull();
      }
    }
    if (route === 'skip') campaign.settlePendingChests();
    setActivePinia(createPinia());
    expect(useCampaignStore().town.coins).toBe(4500);
    expect(useCampaignStore().pendingChests).toEqual([]);
    setActivePinia(createPinia());
    expect(useCampaignStore().town.coins).toBe(4500);
  },
);
it('scales a tapped coin even when the saved fallback was a power', () => {
  Math.random.mockReturnValue(0);
  const campaign = useCampaignStore();
  const rewards = win(campaign, true);
  expect(rewards[0].items[0].kind).toBe('power');
  expect(campaign.claimChest(rewards[0].id, 'coins').quantity).toBe(2250);
});
it.each([undefined, -1, LEVEL_COUNT + 1, '31'])(
  'safely recovers older or invalid chest level metadata (%s)',
  (levelId) => {
    saves.set(
      SAVE_KEY,
      JSON.stringify({
        issuedRun: 1,
        settledRun: 1,
        pendingChests: [
          {
            id: '1-score',
            runId: 1,
            source: 'score',
            levelId,
            items: [{ id: 'coins', quantity: 999999 }],
          },
        ],
      }),
    );
    expect(useCampaignStore().town.coins).toBe(500);
    setActivePinia(createPinia());
    expect(useCampaignStore().town.coins).toBe(500);
  },
);

it('keeps early payouts and caps later windfalls below one new Motor Age building', () => {
  let previous = 0;
  for (let level = 1; level <= 144; level++) {
    const coins = chestCoinReward(level);
    expect(coins).toBeGreaterThanOrEqual(previous);
    expect(coins).toBeLessThanOrEqual(4000);
    if (level <= 18) expect(coins).toBe(chestCoinReward(level, 1));
    previous = coins;
  }
});
it.each(['tap', 'skip', 'reload', 'import'])(
  'honors an old pending late-game chest once through %s without trusting its stored quantity',
  (route) => {
    let campaign = useCampaignStore();
    campaign.issuedRun = campaign.settledRun = 1;
    campaign.pendingChests = [
      {
        id: '1-score',
        runId: 1,
        source: 'score',
        levelId: 144,
        items: [{ id: 'coins', quantity: 999999 }],
      },
    ];
    if (route === 'tap') campaign.claimChest('1-score', 'coins');
    if (route === 'skip') campaign.settlePendingChests();
    if (route === 'reload') {
      campaign.save();
      setActivePinia(createPinia());
      campaign = useCampaignStore();
    }
    if (route === 'import') campaign.importSave(campaign.exportSave());
    expect(campaign.town.coins).toBe(12000);
    expect(campaign.pendingChests).toEqual([]);
    expect(campaign.claimChest('1-score', 'coins')).toBeNull();
    setActivePinia(createPinia());
    expect(useCampaignStore().town.coins).toBe(12000);
  },
);

it.each([
  ['frontier', 4000],
  ['river-rail', 4000],
  ['motor-age', 4000],
  ['broadcast', 4000],
  ['contemporary', 4500],
  ['tomorrow', 5300],
  ['canopy', 6100],
  ['riverlight', 7000],
])('caps %s chests at %i coins', (era, cap) => {
  expect(chestCoinCap(era)).toBe(cap);
  expect(chestCoinReward(LEVEL_COUNT, CHEST_ECONOMY_VERSION, era)).toBe(cap);
});
it('derives every era cap from its prices and never pays less than version 2', () => {
  for (const era of ERAS) {
    const middle = era.evolution.prices?.[1] ?? 0;
    expect(chestCoinCap(era.id)).toBe(Math.max(4000, Math.round(middle / 100) * 50));
    let previous = 0;
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const coins = chestCoinReward(level, 3, era.id);
      expect(coins).toBeGreaterThanOrEqual(Math.max(previous, chestCoinReward(level, 2)));
      expect(coins).toBeLessThanOrEqual(chestCoinCap(era.id));
      previous = coins;
    }
  }
  // Shallow levels keep their chapter value, and an unknown era falls back to 4,000.
  expect(chestCoinReward(1, 3, 'riverlight')).toBe(500);
  expect(chestCoinReward(LEVEL_COUNT, 3, 'atlantis')).toBe(4000);
  expect(chestCoinReward(LEVEL_COUNT, 3)).toBe(4000);
});
function lateWin(campaign, chooseRewards) {
  // Level 397 opens the last chapter, so no chapter gift joins the chest money.
  campaign.records = Object.fromEntries(
    Array.from({ length: 396 }, (_, i) => [i + 1, { score: 100, stars: 1 }]),
  );
  return campaign.recordVictory({
    id: 397,
    score: 2000,
    target: 1000,
    combo: 1,
    elapsedMs: 1000,
    speedTargetMs: 10000,
    chooseRewards,
  });
}
it('pays the town era cap for late chests and records the terms on the receipt', () => {
  const campaign = useCampaignStore();
  campaign.town.era = 'riverlight';
  const coins = campaign.town.coins;
  const rewards = lateWin(campaign, false);
  expect(rewards.map((chest) => chest.items[0].quantity)).toEqual([7000, 7000]);
  expect(campaign.town.coins).toBe(coins + 14000);
  const receipt = campaign.integrity.actions.findLast((action) => action.kind === 'victory');
  expect(receipt.data.economyVersion).toBe(CHEST_ECONOMY_VERSION);
});
it('keeps a pending chest on the era it was earned in', () => {
  const campaign = useCampaignStore();
  campaign.town.era = 'canopy';
  const coins = campaign.town.coins;
  const [tapped, interrupted] = lateWin(campaign, true);
  expect(tapped).toMatchObject({ economyVersion: CHEST_ECONOMY_VERSION, era: 'canopy' });
  campaign.town.era = 'riverlight';
  expect(campaign.claimChest(tapped.id, 'coins').quantity).toBe(6100);
  expect(campaign.claimChest(tapped.id, 'coins')).toBeNull();
  // A reload claims the unopened chest's saved coin fallback under the same terms.
  expect(interrupted.items[0]).toMatchObject({ kind: 'coins', quantity: 6100 });
  campaign.save();
  setActivePinia(createPinia());
  expect(useCampaignStore().town.coins).toBe(coins + 12200);
  expect(useCampaignStore().pendingChests).toEqual([]);
});
it('keeps an old version 2 chest at its original cap in a later era', () => {
  const campaign = useCampaignStore();
  campaign.town.era = 'riverlight';
  campaign.issuedRun = campaign.settledRun = 1;
  campaign.pendingChests = [
    {
      id: '1-score',
      runId: 1,
      source: 'score',
      levelId: LEVEL_COUNT,
      economyVersion: 2,
      items: [{ id: 'coins', quantity: 999999 }],
    },
  ];
  expect(campaign.claimChest('1-score', 'coins').quantity).toBe(4000);
});
it.each([undefined, 'atlantis'])(
  'rejects an imported version 3 chest without a known era (%s)',
  (era) => {
    const campaign = useCampaignStore();
    campaign.town.era = 'riverlight';
    lateWin(campaign, true);
    const file = JSON.parse(campaign.exportSave());
    expect(file.profile.pendingChests).toHaveLength(2);
    expect(() => campaign.importSave(JSON.stringify(file))).not.toThrow();
    for (const chest of file.profile.pendingChests) chest.era = era;
    expect(() => campaign.importSave(JSON.stringify(file))).toThrow();
  },
);
