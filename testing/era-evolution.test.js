import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BUILDINGS, BUILDING_BY_ID, BANDIT_EVENT, createTown } from '../src/data/town';
import { bonusCapacity } from '../src/data/rewards';
import { shopSlots } from '../src/data/shop';
import { eraGate, advanceEra, isEraComplete } from '../src/game/town/TownEras';
import {
  normalizeTown,
  foodCapacity,
  happiness,
  housingCapacity,
  visitorCapacity,
  buildingIndicators,
  banditEncounter,
  reinforceRaid,
} from '../src/game/town/TownRules';
import { useCampaignStore } from '../src/stores/campaignStore';

beforeEach(() => {
  const data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function completeTown() {
  const town = createTown();
  for (const b of BUILDINGS.filter((b) => b.introducedEra === 'frontier'))
    town.buildings[b.id] = b.upgrades.length;
  return town;
}
it('offers the town-center compass at zero mine progress and advances without changing records', () => {
  const c = useCampaignStore();
  c.town = completeTown();
  expect(c.town.completedRuns).toBe(0);
  expect(c.records).toEqual({});
  expect(eraGate(c.town).available).toBe(true);
  expect(buildingIndicators(c.town).square).toBe('era');
  expect(c.advanceEra('frontier')).toBe(true);
  expect(c.records).toEqual({});
  expect(c.town.transition.pending).toBe(true);
  expect(c.advanceEra('frontier')).toBe(false);
  setActivePinia(createPinia());
  const reloaded = useCampaignStore();
  expect(reloaded.town.transition.pending).toBe(true);
  expect(reloaded.acknowledgeEra()).toBe(true);
  expect(reloaded.town.eraTransitionSeen['river-rail']).toBe(true);
});
it('does not offer evolution while a final construction is waiting for its finishing tap', () => {
  const town = completeTown();
  town.buildings.doctor = 2;
  town.projects.doctor = { id: 'doctor', stage: 3, wins: 1, required: 1 };
  expect(eraGate(town).available).toBe(false);
  expect(buildingIndicators(town).square).toBeUndefined();
  expect(advanceEra(town, 'frontier')).toBeNull();
});
it('keeps all old level-five service benefits at the new shorter caps', () => {
  const legacy = createTown();
  delete legacy.progressionVersion;
  for (const b of BUILDINGS.filter((b) => b.introducedEra === 'frontier'))
    legacy.buildings[b.id] = b.id === 'watermill' ? 3 : 5;
  const town = normalizeTown(legacy);
  expect(town.buildings.home).toBe(3);
  expect(town.buildings.doctor).toBe(3);
  expect(town.buildings.blacksmith).toBe(5);
  expect(town.buildings.square).toBe(5);
  expect(housingCapacity(town)).toBe(40);
  expect(visitorCapacity(town)).toBe(18);
  expect(foodCapacity(town)).toBe(95);
  expect(happiness(town)).toBe(100);
  expect(bonusCapacity(town)).toBe(20);
  expect(shopSlots(town.buildings.shop)).toBe(5);
  expect(isEraComplete(town)).toBe(true);
  expect(normalizeTown(town)).toEqual(town);
});
it('refunds a redundant paid tier once and preserves an in-progress modernization', () => {
  const legacy = createTown();
  delete legacy.progressionVersion;
  legacy.coins = 100;
  legacy.buildings.doctor = 3;
  legacy.projects.doctor = { id: 'doctor', stage: 4, required: 1, wins: 1 };
  legacy.era = 'river-rail';
  legacy.buildings.home = 5;
  legacy.projects.home = {
    id: 'home',
    type: 'modernization',
    stage: 5,
    required: 2,
    wins: 1,
    cost: 300,
    fromEra: 'frontier',
    targetEra: 'river-rail',
  };
  const town = normalizeTown(legacy);
  expect(town.coins).toBe(100 + BUILDING_BY_ID.doctor.legacyUpgradeCosts[3]);
  expect(town.projects.doctor).toBeUndefined();
  expect(town.projects.home).toMatchObject({ stage: 3, wins: 1, required: 2, cost: 300 });
  expect(normalizeTown(town).coins).toBe(town.coins);
});
it('retains the pending cinematic if its completion cannot save', () => {
  const c = useCampaignStore();
  c.town = completeTown();
  expect(c.advanceEra('frontier')).toBe(true);
  vi.spyOn(c, 'save').mockReturnValue(false);
  expect(c.acknowledgeEra()).toBe(false);
  expect(c.town.transition.pending).toBe(true);
  expect(c.town.eraTransitionSeen['river-rail']).not.toBe(true);
});
function raid(defended = true, coins = 600) {
  const town = createTown();
  town.coins = coins;
  town.nextRaidRun = 0;
  Object.assign(town.buildings, {
    home: 1,
    well: 1,
    farm: 1,
    sheriff: defended ? 1 : 0,
    bank: defended ? 1 : 0,
  });
  return banditEncounter(town, () => 0);
}
it('pays 10 coins per captured bandit exactly once, including across reload', () => {
  let c = useCampaignStore();
  c.town = raid();
  expect(c.town.coins).toBe(600);
  expect(c.markRaidSeen(1)).toBe(true);
  expect(c.town.coins).toBe(620);
  expect(c.town.events[BANDIT_EVENT]).toMatchObject({ loss: 0, bounty: 20, seen: true });
  expect(c.markRaidSeen(1)).toBe(false);
  setActivePinia(createPinia());
  c = useCampaignStore();
  expect(c.markRaidSeen(1)).toBe(false);
  expect(c.town.coins).toBe(620);
});
it.each([50, 600])(
  'does not pay a capture bounty for an undefended raid with %i coins',
  (coins) => {
    const c = useCampaignStore();
    c.town = raid(false, coins);
    const afterLoss = c.town.coins;
    expect(c.markRaidSeen(1)).toBe(true);
    expect(c.town.coins).toBe(afterLoss);
    expect(c.town.events[BANDIT_EVENT].bounty).toBe(0);
  },
);
it('awards the bounty after mid-raid defenses and rolls the payment back if saving fails', () => {
  const c = useCampaignStore();
  c.town = raid(false);
  Object.assign(c.town.buildings, { sheriff: 1, bank: 1 });
  c.town = reinforceRaid(c.town);
  expect(c.town.coins).toBe(600);
  const save = vi.spyOn(c, 'save').mockReturnValue(false);
  expect(c.markRaidSeen(1)).toBe(false);
  expect(c.town.coins).toBe(600);
  expect(c.town.events[BANDIT_EVENT].seen).toBe(false);
  save.mockRestore();
  expect(c.markRaidSeen(1)).toBe(true);
  expect(c.town.coins).toBe(620);
});

it('waits for an ongoing raid before offering the era compass', () => {
  const town = completeTown();
  town.events[BANDIT_EVENT] = {
    id: 1,
    seen: false,
    loss: 0,
    outcome: 'protected',
    gangSize: 10,
    sheriffLevel: 5,
    bankLevel: 5,
  };
  expect(eraGate(town).pendingRaid).toBe(true);
  expect(eraGate(town).available).toBe(false);
  expect(buildingIndicators(town).square).toBeUndefined();
  town.events[BANDIT_EVENT].seen = true;
  expect(buildingIndicators(town).square).toBe('era');
});
