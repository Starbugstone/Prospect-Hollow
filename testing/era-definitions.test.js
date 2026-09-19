import { afterEach, expect, it } from 'vitest';
import { Group } from 'three';
import { defineEra, resolveCityAsset } from '../src/data/eraDefinitions';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { createTown, BUILDING_BY_ID } from '../src/data/town';
import { isCityEra } from '../src/data/city';
import { hasElectricity } from '../src/data/industrial';
import { eraEventKind } from '../src/data/townEvents';
import { roadSurface, motorTraffic, pavedTown } from '../src/game/town/TownEvolution';
import { createModernizationOffer } from '../src/game/town/TownModernization';
import { foodCapacity, waterCapacity } from '../src/game/town/TownRules';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import {
  renderEraLandmark,
  renderModernization,
} from '../src/game/town/buildings/BuildingRenderer';
import { addMineEra } from '../src/game/town/TownMineEvolution';

const additions = [];
const register = (definition) => {
  const era = defineEra(definition);
  ERAS.push(era);
  ERA_BY_ID[era.id] = era;
  additions.push(era.id);
  return era;
};
afterEach(() => {
  for (const id of additions.splice(0)) {
    ERAS.splice(
      ERAS.findIndex((era) => era.id === id),
      1,
    );
    delete ERA_BY_ID[id];
  }
});

it.each(['constructor', 'toString', '__proto__', 'missing-era', undefined])(
  'uses the safe frontier fallback for unsupported era %s',
  (id) => {
    expect(eraEvolution(id)).toBe(eraEvolution('frontier'));
    expect(isCityEra(id)).toBe(false);
    expect(pavedTown({ era: id })).toBe(false);
    expect(eraEventKind(id)).toBe('bandits');
  },
);

it('validates reusable styles and complete tier contracts without sharing mutable arrays', () => {
  for (const style of ['river-rail', 'industrial', 'motor-age']) {
    const prices = [100, 200, 300];
    const era = defineEra({
      id: 'example',
      label: 'Example',
      yearLabel: '1910',
      enabled: true,
      evolution: { style, prices },
    });
    prices[0] = 999;
    expect(era.evolution.prices[0]).toBe(100);
    expect(era.evolution.upgradeTitle).not.toBe('');
    expect(era.evolution.upgradeDescriptions).toHaveLength(2);
    expect(Object.isFrozen(era.evolution)).toBe(true);
    expect(Object.isFrozen(era.evolution.prices)).toBe(true);
  }
  expect(() => defineEra({ id: 'bad', evolution: { style: 'unknown' } })).toThrow();
  expect(() =>
    defineEra({ id: 'bad', evolution: { style: 'industrial', prices: [1, 2] } }),
  ).toThrow();
  expect(() => defineEra({ id: 'bad', evolution: { style: 'city', prices: [1, 2, 3] } })).toThrow();
});

it('resolves an overlapping future era prefix to its own declared Blender asset family', () => {
  const future = defineEra({
    ...ERA_BY_ID.aviation,
    id: 'aviation-next',
    evolution: { ...eraEvolution('aviation'), cityAssets: 'contemporary' },
  });
  expect(resolveCityAsset('aviation-next-residence', [...ERAS, future])).toBe(
    'contemporary-residence',
  );
  expect(resolveCityAsset('aviation-residence', [...ERAS, future])).toBe('aviation-residence');
  expect(resolveCityAsset('marker-doctor', [...ERAS, future])).toBe('marker-doctor');
});

function fixture(era) {
  const town = createTown();
  town.era = era;
  for (const id of ['well', 'farm', 'stable', 'powerHouse', 'home', 'bridge']) {
    town.buildings[id] = BUILDING_BY_ID[id].upgrades.length;
    town.buildingEras[id] = era;
    town.buildingEraLevels[id] = 2;
  }
  return town;
}

it('lets an unseen era inherit services, transport, events and offers through one definition', () => {
  const future = register({
    ...ERA_BY_ID.contemporary,
    id: 'future-city',
    label: 'Future city',
    evolution: {
      ...eraEvolution('contemporary'),
      roadColor: '#123456',
      prices: [9000, 11000, 13000],
    },
  });
  const town = fixture(future.id),
    baseline = fixture('contemporary');
  expect(isCityEra(future.id)).toBe(true);
  expect(pavedTown(town)).toBe(true);
  expect(hasElectricity(town)).toBe(true);
  expect(motorTraffic(town)).toBe(true);
  expect(eraEventKind(future.id)).toBe('storm-cleanup');
  expect(roadSurface(town)).toBe('#123456');
  expect(waterCapacity(town)).toBe(waterCapacity(baseline));
  expect(foodCapacity(town)).toBe(foodCapacity(baseline));
  const offer = createModernizationOffer(town, BUILDING_BY_ID.home, 2);
  expect(offer).toMatchObject({ targetEra: future.id, eraLevel: 3, cost: 13000, runs: 1 });
  expect(offer.description).toBe(
    createModernizationOffer(baseline, BUILDING_BY_ID.home, 2).description,
  );
});

it.each(['river-rail', 'industrial', 'motor-age', 'contemporary'])(
  'renders an unseen era using the %s style without another renderer branch',
  (base) => {
    const future = register({
      ...ERA_BY_ID[base],
      id: `${base}-next`,
      evolution: { ...eraEvolution(base) },
    });
    const view = Object.create(TownDiorama.prototype);
    view.geometries = createTownGeometries();
    view.materials = new Map();
    view.sign = () => {};
    const signature = (era) => {
      const root = new Group();
      renderEraLandmark(view, root, 'home', 'Home', 3, era, 3);
      renderModernization(view, root, 'bridge', era, 3);
      addMineEra(view, root, era);
      root.updateMatrixWorld(true);
      const parts = [];
      root.traverse((part) => {
        if (part.isMesh)
          parts.push([
            part.geometry.attributes.position.count,
            part.geometry.index?.count,
            part.material.color.getHex(),
            part.matrixWorld.toArray(),
          ]);
      });
      return parts;
    };
    try {
      const original = signature(base);
      expect(original.length).toBeGreaterThan(0);
      expect(signature(future.id)).toEqual(original);
    } finally {
      for (const geometry of new Set(Object.values(view.geometries))) geometry.dispose();
      view.materials.forEach((material) => material.dispose());
    }
  },
);
