import { afterEach, expect, it } from 'vitest';
import { defineEra } from '../src/data/eraDefinitions';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { CITY_BUILDINGS } from '../src/data/city';
import { GARDEN_PARCELS, GARDEN_LANE_X } from '../src/data/townGardenDistrict';
import { BUILDINGS, BUILDING_BY_ID, createTown } from '../src/data/town';
import {
  advanceConstruction,
  buildWithHammer,
  finishConstruction,
  foodCapacity,
  housingCapacity,
  normalizeTown,
  plotUnlocked,
  purchase,
  upgradeOffer,
  visitorCapacity,
  waterCapacity,
} from '../src/game/town/TownRules';
import { advanceEra, eraGate, isEraComplete, plotInEra } from '../src/game/town/TownEras';
import { buildingBenefit } from '../src/game/town/TownBenefits';
import {
  gardenTracks,
  gardenConnections,
  PLOTS,
  plotStreet,
  routeBetween,
  townTracks,
} from '../src/game/town/TownLayout';
import { groundHeight } from '../src/game/town/TownLandscape';
import { wetBank } from '../src/game/town/TownRiver';

function complete(era) {
  const town = { ...createTown(), era, coins: 1e7, tourSeen: true };
  for (const building of BUILDINGS.filter((b) => plotInEra(town, b.id))) {
    town.buildings[building.id] = building.upgrades.length;
    town.buildingEras[building.id] = era;
    town.buildingEraLevels[building.id] = 3;
  }
  return town;
}
afterEach(() => {
  delete ERA_BY_ID['garden-successor'];
});

it('continues Tomorrow through Canopy and Riverlight with saved idempotent transitions', () => {
  expect(ERAS.slice(-3).map(({ id }) => id)).toEqual(['tomorrow', 'canopy', 'riverlight']);
  for (const [from, to] of [
    ['tomorrow', 'canopy'],
    ['canopy', 'riverlight'],
  ]) {
    const before = complete(from);
    const next = advanceEra(before, from);
    expect(next).toMatchObject({ era: to, transition: { from, to, pending: true } });
    expect(next.buildings).toEqual(before.buildings);
    expect(next.buildingEras).toEqual(before.buildingEras);
    expect(next.coins).toBe(before.coins);
    expect(advanceEra(next, from)).toBeNull();
    expect(normalizeTown(next).transition).toEqual(next.transition);
    for (const b of CITY_BUILDINGS.filter((b) => b.introducedEra === to)) {
      expect(plotUnlocked(before, b.id), b.id).toBe(false);
      expect(plotUnlocked(next, b.id), b.id).toBe(true);
      expect(next.buildings[b.id]).toBe(0);
    }
  }
  expect(isEraComplete(complete('riverlight'))).toBe(true);
  expect(eraGate(complete('riverlight')).next).toBeUndefined();
});

it('restores an existing Tomorrow save without buying new plots or changing established services', () => {
  const saved = complete('tomorrow');
  const reads = [waterCapacity, foodCapacity, housingCapacity, visitorCapacity];
  const services = reads.map((read) => read(saved));
  for (const id of Object.keys(GARDEN_PARCELS)) {
    delete saved.buildings[id];
    delete saved.buildingEras[id];
    delete saved.buildingEraLevels[id];
  }
  const restored = normalizeTown(saved);
  expect(restored.era).toBe('tomorrow');
  expect(restored.coins).toBe(saved.coins);
  expect(reads.map((read) => read(restored))).toEqual(services);
  for (const id of Object.keys(GARDEN_PARCELS)) {
    expect(restored.buildings[id]).toBe(0);
    expect(plotUnlocked(restored, id)).toBe(false);
  }
});

it.each(Object.keys(GARDEN_PARCELS))(
  'builds %s in three shared stages and activates its declared service only when finished',
  (id) => {
    const building = BUILDING_BY_ID[id];
    let town = complete(building.introducedEra);
    town.buildings[id] = 0;
    for (let stage = 1; stage <= 3; stage++) {
      const reads = [foodCapacity, waterCapacity, housingCapacity];
      const before = reads.map((read) => read(town));
      const offer = upgradeOffer(town, id);
      expect(offer.available).toBe(true);
      expect(buildingBenefit(town, id, stage).label).toBe(
        building.effects.water
          ? 'Water capacity'
          : building.effects.food
            ? 'Food capacity'
            : building.effects.housing
              ? 'Resident capacity'
              : building.effects.visitors
                ? 'Visitor capacity'
                : 'Happiness',
      );
      town = purchase(town, id, offer.stage);
      expect(reads.map((read) => read(town))).toEqual(before);
      const restored = normalizeTown(town);
      expect(restored.projects[id]).toMatchObject(town.projects[id]);
      town = advanceConstruction(advanceConstruction(restored));
      town = finishConstruction(town, id, stage);
      expect(town.buildings[id]).toBe(stage);
      expect(reads.map((read, index) => read(town) - before[index])).toEqual([
        building.effects.food ?? 0,
        building.effects.water ?? 0,
        building.effects.housing ?? 0,
      ]);
      expect(finishConstruction(town, id, stage)).toBeNull();
    }
    expect(buildWithHammer(town, id, 3)).toBeNull();
  },
);

it.each(['canopy', 'riverlight'])(
  'keeps %s plot approaches dry, level and connected through existing roads',
  (era) => {
    const town = complete(era);
    const demand = housingCapacity(town) + visitorCapacity(town);
    expect(foodCapacity(town)).toBeGreaterThanOrEqual(demand);
    expect(waterCapacity(town)).toBeGreaterThanOrEqual(demand);
    expect(gardenTracks(complete('tomorrow'))).toEqual([]);
    for (const [id, parcel] of Object.entries(GARDEN_PARCELS)) {
      if (!plotInEra(town, id)) continue;
      const [x, z] = PLOTS[id];
      expect(PLOTS[id]).toBe(parcel.position);
      expect(plotStreet(id)).toEqual([x, z + parcel.streetOffset]);
      for (const dx of [-parcel.halfWidth, 0, parcel.halfWidth])
        for (const dz of [-parcel.halfDepth, 0, parcel.halfDepth]) {
          expect(groundHeight(x + dx, z + dz), id).toBe(0);
          expect(wetBank(x + dx, z + dz), id).toBe(false);
        }
      for (const mode of ['pedestrian', 'car']) {
        const path = routeBetween(town, plotStreet('square'), plotStreet(id), mode);
        expect(path.length, `${id} ${mode}`).toBeGreaterThan(1);
        expect(
          path.some(([px]) => px === GARDEN_LANE_X),
          id,
        ).toBe(true);
      }
    }
    const legacy = townTracks(complete('tomorrow'));
    const evolved = townTracks(town);
    for (const track of legacy) expect(evolved).toContainEqual(track);
    // Every old street row must join the new grid directly, without a detour
    // along the northern connection that could hide missing paved links.
    for (const [x, z] of [
      [58, -8.5],
      [65, -0.5],
      [58, 7.5],
      [65, 15.5],
      [58, 23.5],
      [65, 31.5],
    ]) {
      expect(gardenConnections(town)).toContainEqual(
        expect.objectContaining({ from: [x, z], to: [GARDEN_LANE_X, z] }),
      );
      for (const mode of ['pedestrian', 'horse', 'wagon', 'car']) {
        const path = routeBetween(town, [x, z], [GARDEN_LANE_X, z], mode);
        expect(path.length, `${era} ${mode} row ${z}`).toBeGreaterThan(1);
        expect(path.every(([, pz]) => pz === z)).toBe(true);
        expect(path.at(-1)).toEqual([GARDEN_LANE_X, z]);
      }
    }
    for (const edge of gardenTracks(town))
      for (let step = 0; step <= 20; step++) {
        const x = edge.from[0] + ((edge.to[0] - edge.from[0]) * step) / 20;
        const z = edge.from[1] + ((edge.to[1] - edge.from[1]) * step) / 20;
        expect(wetBank(x, z), `${edge.from} → ${edge.to}`).toBe(false);
        expect(groundHeight(x, z), `${edge.from} → ${edge.to}`).toBe(0);
      }
  },
);

it('joins incomplete street rows at their unlocked ends and keeps the full spine connected', () => {
  const town = complete('canopy');
  town.buildings.biodome = 0;
  town.buildings.skyPods = 0;
  town.buildings.blossomAtelier = 0;
  town.buildings.orchardCottages = 0;
  // Removing prerequisites can lock the newer end of a row, while its older
  // street and the garden district still have to join without a floating link.
  const connections = gardenConnections(town);
  for (const { from, to } of connections) {
    expect(townTracks(town).some((r) => r.to[0] === from[0] && r.to[1] === from[1])).toBe(true);
    expect(routeBetween(town, from, to).length).toBeGreaterThan(1);
    expect(routeBetween(town, to, plotStreet('teaHouse')).length).toBeGreaterThan(1);
  }
});

it('validates reusable cozy capabilities and permits a successor without another era-name branch', () => {
  const base = ERA_BY_ID.canopy;
  const successor = defineEra({
    ...base,
    id: 'garden-successor',
    evolution: { ...base.evolution },
  });
  ERA_BY_ID[successor.id] = successor;
  expect(eraEvolution(successor.id)).toMatchObject({
    style: 'city',
    architecture: 'cozy',
    cozyStyle: 'canopy',
    wildlife: 'garden',
  });
  for (const cozyStyle of [null, 'missing', 'constructor'])
    expect(() => defineEra({ ...base, evolution: { ...base.evolution, cozyStyle } })).toThrow(
      'Missing cozy style',
    );
  expect(() =>
    defineEra({ ...base, evolution: { ...base.evolution, wildlife: 'missing' } }),
  ).toThrow('Unsupported wildlife');
  expect(eraEvolution('missing')).toMatchObject({
    architecture: 'standard',
    cozyStyle: null,
    wildlife: 'meadow',
  });
});
