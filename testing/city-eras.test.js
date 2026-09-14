import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BUILDINGS, createTown, BANDIT_EVENT } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { CITY_BUILDINGS } from '../src/data/city';
import { hasElectricity } from '../src/data/industrial';
import { LEVEL_COUNT } from '../src/data/campaign';
import { eraIndex, plotInEra, advanceEra, isEraComplete, eraGate } from '../src/game/town/TownEras';
import {
  buildWithHammer,
  upgradeOffer,
  purchase,
  advanceConstruction,
  finishConstruction,
  normalizeTown,
  waterCapacity,
  foodCapacity,
  housingCapacity,
  visitorCapacity,
  happiness,
  banditEncounter,
  raidBounty,
  nextGoal,
} from '../src/game/town/TownRules';
import { buildingBenefit } from '../src/game/town/TownBenefits';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { visiblePlots, plotStreet, routeBetween, townTracks } from '../src/game/town/TownLayout';
import { groundHeight } from '../src/game/town/TownLandscape';
import { wetBank } from '../src/game/town/TownRiver';
import { pavedTown, modernTransport } from '../src/game/town/TownEvolution';

function complete(era) {
  const town = createTown();
  Object.assign(town, { era, coins: 1e7, tourSeen: true, completedRuns: 144, nextRaidRun: 999 });
  for (const b of BUILDINGS.filter((b) => plotInEra(town, b.id))) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = era;
    town.buildingEraLevels[b.id] = era === 'frontier' ? 0 : 3;
  }
  return town;
}
let saves;
beforeEach(() => {
  saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => saves.get(k) ?? null,
    setItem: (k, v) => saves.set(k, v),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('orders rebuilding after Electric and before cars, with two saved, idempotent transitions', () => {
  expect(ERAS.map((e) => e.id)).toEqual([
    'frontier',
    'river-rail',
    'industrial',
    'post-war',
    'motor-age',
    'aviation',
    'broadcast',
    'contemporary',
  ]);
  for (const from of ['industrial', 'motor-age']) {
    let c = useCampaignStore();
    c.town = complete(from);
    const previous = { ...c.town.buildings },
      facades = { ...c.town.buildingEras };
    expect(c.advanceEra(from)).toBe(true);
    expect(c.advanceEra(from)).toBe(false);
    expect(c.town.buildings).toEqual(previous);
    expect(c.town.buildingEras).toEqual(facades);
    setActivePinia(createPinia());
    c = useCampaignStore();
    expect(c.town.transition.pending).toBe(true);
    expect(c.acknowledgeEra()).toBe(true);
    expect(c.town.transition.pending).toBe(false);
  }
});
it.each(['post-war', 'contemporary'])(
  'preserves every established service during all three %s modernization stages',
  (era) => {
    const prev = ERAS[eraIndex(era) - 1].id;
    const base = advanceEra(complete(prev), prev);
    base.transition.pending = false;
    for (const b of BUILDINGS.filter((b) => eraIndex(b.introducedEra) < eraIndex(era))) {
      let town = structuredClone(base);
      const functional = town.buildings[b.id];
      const reads = [waterCapacity, foodCapacity, housingCapacity, visitorCapacity, happiness];
      const services = reads.map((f) => f(town));
      for (let i = 1; i <= 3; i++) {
        const offer = upgradeOffer(town, b.id);
        expect(offer.available, b.id).toBe(true);
        town = purchase(town, b.id, offer.stage);
        const paid = town.coins;
        expect(purchase(town, b.id, offer.stage)).toBeNull();
        town = normalizeTown(town);
        expect(town.coins).toBe(paid);
        expect(reads.map((f) => f(town))).toEqual(services);
        town = advanceConstruction(advanceConstruction(town));
        expect(reads.map((f) => f(town))).toEqual(services);
        town = finishConstruction(town, b.id, town.projects[b.id].stage);
        expect(town.buildings[b.id]).toBe(functional);
        expect(reads.map((f) => f(town))).toEqual(services);
        expect(buildWithHammer(town, b.id, offer.stage)).toBeNull();
      }
      expect(hasElectricity(town)).toBe(true);
      expect(modernTransport(town, 'railDepot')).toBe(true);
      expect(pavedTown(town)).toBe(true);
    }
  },
);
it.each(CITY_BUILDINGS.map((b) => [b.id, b]))(
  '%s grants bounded capacity and happiness once on finishing, and stays on dry connected ground',
  (id, b) => {
    let town = complete(b.introducedEra);
    town.buildings[id] = 0;
    town.buildingEraLevels[id] = 0;
    town.buildings.square = 1; // Leave room below the happiness cap.
    for (let stage = 1; stage <= 3; stage++) {
      const before = [
        foodCapacity(town),
        waterCapacity(town),
        housingCapacity(town),
        visitorCapacity(town),
        happiness(town),
      ];
      const offer = upgradeOffer(town, id);
      expect(offer.available).toBe(true);
      const benefit = buildingBenefit(town, id, stage);
      town = purchase(town, id, offer.stage);
      expect([
        foodCapacity(town),
        waterCapacity(town),
        housingCapacity(town),
        visitorCapacity(town),
        happiness(town),
      ]).toEqual(before);
      town = advanceConstruction(advanceConstruction(town));
      town = finishConstruction(town, id, stage);
      expect(finishConstruction(town, id, stage)).toBeNull();
      expect(foodCapacity(town) - before[0]).toBe(b.effects.food ?? 0);
      expect(waterCapacity(town) - before[1]).toBe(b.effects.water ?? 0);
      expect(housingCapacity(town) - before[2]).toBe(b.effects.housing ?? 0);
      expect(visitorCapacity(town) - before[3]).toBe(b.effects.visitors ?? 0);
      expect(happiness(town)).toBeGreaterThanOrEqual(before[4]);
      expect(benefit.after).toBeGreaterThanOrEqual(benefit.before);
    }
    const plot = visiblePlots(town).find((p) => p.id === id);
    expect(wetBank(...plot.position)).toBe(false);
    expect(Math.abs(groundHeight(...plot.position))).toBeLessThan(0.01);
    expect(routeBetween(town, plotStreet(id), plotStreet('sheriff'), 'car').length).toBeGreaterThan(
      1,
    );
  },
);
it('never draws an ordinary road across water, and supplies all residents and visitors in both new eras', () => {
  for (const era of ['post-war', 'contemporary']) {
    const town = complete(era),
      demand = housingCapacity(town) + visitorCapacity(town);
    expect(foodCapacity(town)).toBeGreaterThanOrEqual(demand);
    expect(waterCapacity(town)).toBeGreaterThanOrEqual(demand);
    for (const edge of townTracks(town).filter((e) => !e.crossing))
      for (let i = 0; i <= 20; i++)
        expect(
          wetBank(
            edge.from[0] + ((edge.to[0] - edge.from[0]) * i) / 20,
            edge.from[1] + ((edge.to[1] - edge.from[1]) * i) / 20,
          ),
          JSON.stringify(edge),
        ).toBe(false);
  }
});
it('keeps old Motor saves and their pending Industrial-to-Motor transition intact', () => {
  const town = complete('motor-age');
  for (const b of CITY_BUILDINGS) {
    delete town.buildings[b.id];
    delete town.buildingEras[b.id];
    delete town.buildingEraLevels[b.id];
  }
  town.transition = {
    id: 'industrial:motor-age',
    from: 'industrial',
    to: 'motor-age',
    pending: true,
  };
  const restored = normalizeTown(town);
  expect(restored.era).toBe('motor-age');
  expect(restored.transition).toEqual(town.transition);
  expect(restored.coins).toBe(town.coins);
  for (const b of CITY_BUILDINGS) expect(restored.buildings[b.id]).toBe(0);
});
it('saves storm cleanup once, respects bounded loss and safe coins, and never awards a capture bounty', () => {
  let town = complete('contemporary');
  town.buildings.fireStation = 0;
  town.nextRaidRun = town.completedRuns;
  town.coins = 100;
  town = banditEncounter(town, () => 0);
  const receipt = town.events[BANDIT_EVENT];
  expect(receipt).toMatchObject({ kind: 'storm-cleanup', loss: 10, targets: ['riverPark'] });
  expect(town.coins).toBe(90);
  expect(banditEncounter(town, () => 0)).toBeNull();
  expect(raidBounty(receipt)).toBe(0);
  const restored = normalizeTown(town);
  expect(restored.events[BANDIT_EVENT]).toMatchObject(receipt);
  expect(restored.coins).toBe(90);
  const c = useCampaignStore();
  c.town = restored;
  c.save();
  setActivePinia(createPinia());
  expect(useCampaignStore().town.events[BANDIT_EVENT].kind).toBe('storm-cleanup');
});
it('continues existing 144-level saves at 145 without resetting records and completes the expanded campaign', () => {
  const records = Object.fromEntries(
    Array.from({ length: 144 }, (_, i) => [i + 1, { score: 100, stars: 1 }]),
  );
  saves.set(SAVE_KEY, JSON.stringify({ schemaVersion: 2, records, town: complete('motor-age') }));
  setActivePinia(createPinia());
  const c = useCampaignStore();
  expect(c.nextLevel).toBe(145);
  expect(LEVEL_COUNT).toBe(240);
  for (let id = 145; id <= LEVEL_COUNT; id++) {
    const runId = c.beginRun('normal', id);
    expect(runId).toBeTruthy();
    c.recordVictory({ id, score: 1, target: 10000, combo: 1, runId });
    if (id % 6 === 0) expect(c.lastChapterReward.chapter).toBe(id / 6);
  }
  expect(c.nextLevel).toBe(240);
  expect(c.completedCount).toBe(240);
  expect(c.isUnlocked(241)).toBe(false);
  expect(c.records[144]).toEqual(records[144]);
});
it('only finishes the entire city once every contemporary plot and modernization is complete', () => {
  const town = complete('contemporary');
  expect(isEraComplete(town)).toBe(true);
  expect(eraGate(town).next).toBeUndefined();
  expect(nextGoal(town)).toBeNull();
  for (const b of BUILDINGS) {
    const copy = structuredClone(town);
    if (b.introducedEra === 'contemporary') copy.buildings[b.id] = 2;
    else copy.buildingEraLevels[b.id] = 2;
    expect(isEraComplete(copy), b.id).toBe(false);
  }
});
