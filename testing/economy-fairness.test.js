import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BUILDINGS, BANDIT_EVENT, createTown } from '../src/data/town';
import { chestCoinReward } from '../src/data/economy';
import { useCampaignStore } from '../src/stores/campaignStore';
import {
  advanceConstruction,
  banditEncounter,
  buildingIndicators,
  canRingTownBell,
  finishConstruction,
  miningPayout,
  normalizeTown,
  purchase,
  raidProtection,
  reinforceRaid,
  ringTownBell,
  upgradeOffer,
} from '../src/game/town/TownRules';

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const townWithRaid = () =>
  banditEncounter(
    {
      ...createTown(),
      coins: 600,
      nextRaidRun: 0,
      buildings: { ...createTown().buildings, home: 1, well: 1, farm: 1, square: 3 },
    },
    () => 0,
  );

it('lets a chapter-three town complete both defenses with coins and stop the largest raid', () => {
  let town = {
    ...createTown(),
    completedRuns: 12,
    coins: 20000,
    buildings: {
      ...Object.fromEntries(BUILDINGS.map((b) => [b.id, Math.min(4, b.upgrades.length)])),
      sheriff: 2,
      bank: 2,
    },
  };
  for (const id of ['sheriff', 'bank']) {
    expect(upgradeOffer(town, id).available).toBe(true);
    town = finishConstruction(advanceConstruction(purchase(town, id, 2)), id, 3);
  }
  town = normalizeTown(town);
  expect(town.buildings.sheriff).toBe(3);
  expect(town.buildings.bank).toBe(3);
  town.nextRaidRun = 0;
  const raided = banditEncounter(town, () => 0);
  expect(raided.events[BANDIT_EVENT]).toMatchObject({
    gangSize: 10,
    loss: 0,
    outcome: 'protected',
  });
  expect(raided.coins).toBe(town.coins);
  for (const riders of [2, 4, 6, 8, 10]) expect(raidProtection(town, riders)).toBe(1);
});
it('funds any final Frontier upgrade from six chapter-three mining payouts without a chest or hammer', () => {
  const coins = 6 * miningPayout(140, 2, { 2: 2 }, { 2: 3 }, 13);
  expect(coins).toBe(3600);
  const town = {
    ...createTown(),
    coins,
    completedRuns: 12,
    buildings: Object.fromEntries(BUILDINGS.map((b) => [b.id, Math.max(0, b.upgrades.length - 1)])),
  };
  for (const building of BUILDINGS.filter((b) => b.introducedEra === 'frontier')) {
    expect(upgradeOffer(town, building.id).reason).toBe('');
    expect(purchase(town, building.id, building.upgrades.length - 1)).not.toBeNull();
  }
  expect(chestCoinReward(13)).toBe(1500);
});
it('halves the loss once, refunds it immediately, and preserves the bell use through reload', () => {
  let c = useCampaignStore();
  c.town = townWithRaid();
  expect(c.town.events[BANDIT_EVENT].loss).toBe(10);
  expect(buildingIndicators(c.town).square).toBe('bell');
  expect(c.ringTownBell(1)).toBe(true);
  expect(c.town.coins).toBe(595);
  expect(c.town.events[BANDIT_EVENT]).toMatchObject({ loss: 5, bellRung: true, seen: false });
  expect(c.ringTownBell(1)).toBe(false);
  setActivePinia(createPinia());
  c = useCampaignStore();
  expect(c.ringTownBell(1)).toBe(false);
  expect(c.town.coins).toBe(595);
  expect(canRingTownBell(c.town)).toBe(false);
});
it('requires level three, an ongoing loss, and the current raid receipt', () => {
  const town = townWithRaid();
  expect(ringTownBell(town, 99)).toBeNull();
  expect(ringTownBell({ ...town, buildings: { ...town.buildings, square: 2 } }, 1)).toBeNull();
  for (const receipt of [
    { ...town.events[BANDIT_EVENT], seen: true },
    { ...town.events[BANDIT_EVENT], loss: 0 },
  ]) {
    expect(ringTownBell({ ...town, events: { [BANDIT_EVENT]: receipt } }, 1)).toBeNull();
  }
  expect(canRingTownBell({ ...town, buildings: { ...town.buildings, square: 3 } })).toBe(true);
  const odd = {
    ...town,
    coins: 599,
    events: { [BANDIT_EVENT]: { ...town.events[BANDIT_EVENT], loss: 1 } },
  };
  expect(ringTownBell(odd, 1)).toMatchObject({
    coins: 600,
    events: { [BANDIT_EVENT]: { loss: 0, outcome: 'harmless' } },
  });
});
it('makes the bell available again for the next raid, rejecting an old raid button', () => {
  const c = useCampaignStore();
  c.town = townWithRaid();
  expect(c.ringTownBell(1)).toBe(true);
  c.markRaidSeen(1);
  c.town.nextRaidRun = c.town.completedRuns;
  expect(c.resolveBandits()).toBe(true);
  expect(canRingTownBell(c.town)).toBe(true);
  expect(c.ringTownBell(1)).toBe(false);
  expect(c.ringTownBell(2)).toBe(true);
  expect(c.town.coins).toBe(590);
});
it.each(['bell-first', 'defense-first'])(
  'combines bell savings and new defenses in either order: %s',
  (order) => {
    let town = townWithRaid();
    if (order === 'bell-first') town = ringTownBell(town, 1);
    town = reinforceRaid({ ...town, buildings: { ...town.buildings, sheriff: 1 } });
    if (order === 'defense-first') town = ringTownBell(town, 1);
    expect(town.events[BANDIT_EVENT].loss).toBe(2);
    expect(town.coins).toBe(598);
    town = reinforceRaid({ ...town, buildings: { ...town.buildings, bank: 1 } });
    expect(town.events[BANDIT_EVENT]).toMatchObject({
      loss: 0,
      outcome: 'protected',
      bellRung: true,
    });
    expect(town.coins).toBe(600);
  },
);
it('rolls back both the refund and bell use when saving fails', () => {
  const c = useCampaignStore();
  c.town = townWithRaid();
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw Error('full');
  });
  expect(c.ringTownBell(1)).toBe(false);
  expect(c.town.coins).toBe(590);
  expect(c.town.events[BANDIT_EVENT].bellRung).toBeUndefined();
  expect(canRingTownBell(c.town)).toBe(true);
});
