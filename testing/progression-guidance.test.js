import { expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { BUILDINGS, BANDIT_EVENT, createTown } from '../src/data/town';
import {
  nextGoal,
  purchase,
  finishConstruction,
  advanceConstruction,
  raidForecast,
  banditEncounter,
  normalizeTown,
  raidProtection,
  gangSize,
} from '../src/game/town/TownRules';
import { modernization } from '../src/game/town/TownEras';
import { buildingBenefit } from '../src/game/town/TownBenefits';
import { gemArt, gemFinish } from '../src/data/gemAppearance';
import { GEM_TYPES } from '../src/game/engine/GemFactory';
import { LEVEL_COUNT } from '../src/data/campaign';
const settled = () => ({
  ...createTown(),
  coins: 10000,
  buildings: { ...createTown().buildings, well: 1, farm: 1, home: 1 },
});
const build = (town, id) => {
  const paid = purchase(town, id, town.buildings[id]);
  return paid.projects[id]
    ? finishConstruction(advanceConstruction(paid), id, paid.projects[id].stage)
    : paid;
};

it('guides a fresh town through its essentials, then both defenses and an earning service', () => {
  let town = createTown();
  expect(nextGoal(town)).toMatchObject({ id: 'well', cost: 0 });
  town = build(town, 'well');
  expect(nextGoal(town)).toMatchObject({ id: 'farm', cost: 75 });
  town.coins = 10000;
  for (const id of ['farm', 'home', 'sheriff', 'bank', 'saloon']) {
    expect(nextGoal(town).id).toBe(id);
    town = build(town, id);
  }
  expect(raidProtection(town)).toBe(1);
});
it('balances both defenses for a growing gang and never recommends a project already underway', () => {
  const town = settled();
  Object.assign(town.buildings, { sheriff: 2, bank: 1, square: 3, saloon: 3, armory: 3, shop: 1 });
  expect(gangSize(town)).toBe(4);
  expect(nextGoal(town).id).toBe('bank');
  const paid = purchase(town, 'bank', 1);
  expect(nextGoal(paid).id).not.toBe('bank');
  expect(nextGoal(paid).available).toBe(true);
});
it('points a crowded town to its limiting resource before more homes or decoration', () => {
  const town = settled();
  Object.assign(town.buildings, { home: 3, farm: 3, sheriff: 3, bank: 3 });
  expect(nextGoal(town).id).toBe('well');
  town.buildings.well = 3;
  town.buildings.farm = 1;
  expect(nextGoal(town).id).toBe('farm');
});
it('forecasts from saved puzzles and keeps its warning stable across reloads', () => {
  const town = { ...settled(), completedRuns: 5, nextRaidRun: 7 };
  expect(raidForecast(town)).toMatchObject({ runs: 2, soon: true, protection: 0, active: null });
  expect(raidForecast(normalizeTown(town))).toEqual(raidForecast(town));
  expect(raidForecast({ ...town, completedRuns: 4 }).soon).toBe(false);
  expect(raidForecast({ ...town, nextRaidRun: null }).soon).toBe(false);
  const raid = banditEncounter({ ...town, completedRuns: 7 }, () => 0);
  expect(raidForecast(raid)).toMatchObject({ soon: false, active: { loss: 10, seen: false } });
  expect(raid.events[BANDIT_EVENT].atRun).toBe(7);
});
it('opens the river district before suggesting cosmetic modernizations', () => {
  const town = settled();
  town.era = 'river-rail';
  for (const building of BUILDINGS.filter((b) => b.introducedEra === 'frontier'))
    town.buildings[building.id] = building.upgrades.length;
  expect(nextGoal(town).id).toBe('bridge');
  const buildingBridge = purchase(town, 'bridge', 0);
  expect(BUILDINGS.find((b) => b.id === nextGoal(buildingBridge).id).introducedEra).toBe(
    'river-rail',
  );
  for (const building of BUILDINGS.filter((b) => b.introducedEra === 'river-rail'))
    town.buildings[building.id] = building.upgrades.length;
  expect(nextGoal(town).type).toBe('modernization');
});
it('keeps bandit tension bounded even in an undefended endgame', () => {
  for (const coins of [0, 49, 50, 53, 100, 10000]) {
    const town = { ...settled(), coins, nextRaidRun: 0 };
    for (const building of BUILDINGS.filter((b) => !['sheriff', 'bank'].includes(b.id)))
      town.buildings[building.id] = building.upgrades.length;
    const raid = banditEncounter(town, () => 0);
    expect(raid.events[BANDIT_EVENT].loss).toBeLessThanOrEqual(
      Math.min(30, Math.floor(coins / 10)),
    );
    expect(raid.coins).toBeGreaterThanOrEqual(Math.min(50, coins));
    expect(raid.buildings).toEqual(town.buildings);
  }
});
it('honors a previously paid modernization after the price rebalance', () => {
  const town = settled();
  town.era = 'river-rail';
  town.buildings.saloon = 3;
  town.projects.saloon = {
    id: 'saloon',
    type: 'modernization',
    stage: 3,
    fromEra: 'frontier',
    targetEra: 'river-rail',
    wins: 1,
    required: 2,
    cost: 300,
  };
  expect(modernization(town, 'saloon').cost).toBe(800);
  const loaded = normalizeTown(town);
  expect(loaded.projects.saloon.cost).toBe(300);
  const done = finishConstruction(advanceConstruction(loaded), 'saloon', 3);
  expect(done.coins).toBe(town.coins);
  expect(done.buildingEras.saloon).toBe('river-rail');
});
it('previews actual services, including the final supporting tier and partial protection', () => {
  const town = settled(),
    snapshot = structuredClone(town);
  expect(buildingBenefit(town, 'well', 3)).toMatchObject({ before: 6, after: 30 });
  expect(buildingBenefit(town, 'sheriff', 1)).toMatchObject({ before: 0, after: 50, suffix: '%' });
  expect(buildingBenefit(town, 'armory', 3)).toMatchObject({ before: 3, after: 20 });
  expect(town).toEqual(snapshot);
});
it('has real art for every chapter palette while keeping stable gem identities', () => {
  const finishes = new Set();
  for (let id = 1; id <= LEVEL_COUNT; id++) {
    finishes.add(gemFinish(id));
    for (const gem of GEM_TYPES) expect(existsSync(`public${gemArt(gem, id)}`)).toBe(true);
  }
  expect(finishes.size).toBe(3);
  expect(gemFinish(0)).toBe('classic');
});
