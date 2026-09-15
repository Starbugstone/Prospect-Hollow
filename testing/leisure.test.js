import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Box3, BoxGeometry, Group, Scene, Vector3 } from 'three';
import { createTown } from '../src/data/town';
import {
  advanceConstruction,
  finishConstruction,
  happiness,
  normalizeTown,
  plotUnlocked,
  purchase,
  upgradeOffer,
} from '../src/game/town/TownRules';
import { buildingBenefit } from '../src/game/town/TownBenefits';
import { PLOTS, plotStreet, routeBetween } from '../src/game/town/TownLayout';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownActors } from '../src/game/town/TownActors';
import { addLeisureActivity } from '../src/game/town/TownLeisure';
import { useCampaignStore } from '../src/stores/campaignStore';

beforeEach(() => {
  const saves = new Map();
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

it.each([
  ['horseField', 'industrial', 2],
  ['park', 'motor-age', 3],
])(
  '%s unlocks in its era and adds happiness only when each paid stage finishes',
  (id, era, increment) => {
    let town = createTown();
    town.coins = 100000;
    town.buildings.stable = 1;
    expect(plotUnlocked(town, id)).toBe(false);
    town.era = 'river-rail';
    expect(plotUnlocked(town, id)).toBe(false);
    town.era = era;
    expect(plotUnlocked(town, id)).toBe(true);
    expect(routeBetween(town, plotStreet(id), plotStreet('school')).length).toBeGreaterThan(1);
    const baseline = happiness(town);
    for (let stage = 1; stage <= 3; stage++) {
      const offer = upgradeOffer(town, id),
        before = happiness(town);
      expect(buildingBenefit(town, id, stage)).toMatchObject({
        label: 'Happiness',
        before,
        after: before + increment,
      });
      town = purchase(town, id, offer.stage);
      expect(happiness(town)).toBe(before);
      expect(purchase(town, id, offer.stage)).toBeNull();
      town = normalizeTown(town);
      for (let i = 0; i < offer.runs; i++) town = advanceConstruction(town);
      expect(happiness(town)).toBe(before);
      town = finishConstruction(town, id, stage);
      expect(happiness(town)).toBe(baseline + increment * stage);
      expect(finishConstruction(town, id, stage)).toBeNull();
    }
    const campaign = useCampaignStore();
    campaign.town = town;
    const exported = campaign.exportSave();
    campaign.importSave(exported);
    expect(campaign.town.buildings[id]).toBe(3);
    expect(happiness(campaign.town)).toBe(baseline + increment * 3);
  },
);
it('adds new empty plots to an existing modern save without moving its era, wallet or paid work', () => {
  let town = createTown();
  town.era = 'industrial';
  town.coins = 50000;
  town.buildings.home = 3;
  town.buildingEras.home = 'river-rail';
  town.buildingEraLevels.home = 3;
  town.buildings.powerHouse = 1;
  town = purchase(town, 'home', upgradeOffer(town, 'home').stage);
  town.projects.home.cost = 1200; // The old, already-paid price.
  town.projects.home.wins = 1;
  delete town.buildings.horseField;
  delete town.buildings.park;
  const restored = normalizeTown(JSON.parse(JSON.stringify(town)));
  expect(restored.era).toBe(town.era);
  expect(restored.coins).toBe(town.coins);
  expect(restored.projects.home).toMatchObject({ cost: 1200, required: 2, wins: 1 });
  expect(restored.buildings).toMatchObject({ home: 3, horseField: 0, park: 0 });
  const finished = finishConstruction(
    advanceConstruction(restored),
    'home',
    restored.projects.home.stage,
  );
  expect(finished.coins).toBe(town.coins);
  expect(finished.buildingEras.home).toBe('industrial');
});
it('caps happiness at 100 even with both completed leisure plots', () => {
  const town = createTown();
  Object.assign(town.buildings, {
    square: 5,
    saloon: 5,
    museum: 3,
    school: 3,
    horseField: 3,
    park: 3,
    home: 1,
    farm: 3,
    well: 3,
  });
  expect(happiness(town)).toBe(100);
});
it('keeps horses in their field and the occasional leashed walk on the shared animation clock', () => {
  const d = Object.create(TownDiorama.prototype);
  d.scene = new Scene();
  d.world = new Group();
  d.scene.add(d.world);
  d.geometries = { cylinder: new BoxGeometry() };
  d.materials = new Map();
  d.motions = [];
  const town = createTown();
  addLeisureActivity(d, town);
  expect(d.motions).toHaveLength(0);
  Object.assign(town.buildings, { horseField: 3, park: 1 });
  addLeisureActivity(d, town);
  const horses = d.world.children.filter((x) => x.name === 'Field horse');
  expect(horses).toHaveLength(3);
  const walk = d.world.getObjectByName('Park dog walk');
  expect(walk.getObjectByName('Blender dog')).toBeTruthy();
  expect(walk.getObjectByName('Blender walker')).toBeTruthy();
  const renderer = new TownActors(d.scene);
  renderer.rebuild(d.world.children);
  let sawWalk = false,
    sawEmpty = false;
  for (const time of [0, 8, 20, 31, 40, 59, 60]) {
    d.motions.forEach((fn) => fn(time));
    renderer.update();
    sawWalk ||= walk.visible;
    sawEmpty ||= !walk.visible;
    for (const horse of horses) {
      const bounds = new Box3().setFromObject(horse),
        [x, z] = PLOTS.horseField;
      expect(bounds.min.x).toBeGreaterThan(x - 2.9);
      expect(bounds.max.x).toBeLessThan(x + 2.9);
      expect(bounds.min.z).toBeGreaterThan(z - 2.55);
      expect(bounds.max.z).toBeLessThan(z + 2.55);
    }
    if (walk.visible) {
      const size = new Box3().setFromObject(walk).getSize(new Vector3());
      expect(size.x).toBeLessThan(2);
      expect(Math.abs(walk.position.x - PLOTS.park[0])).toBeLessThan(2);
    }
    const snapshot = d.world.toJSON();
    d.motions.forEach((fn) => fn(time));
    expect(d.world.toJSON()).toEqual(snapshot); // Same paused clock cannot advance actors.
  }
  expect(sawWalk && sawEmpty).toBe(true);
  expect(renderer.buckets.reduce((n, b) => n + b.mesh.count, 0)).toBeGreaterThan(0);
  renderer.dispose();
  Object.values(d.geometries).forEach((g) => g.dispose());
  d.materials.forEach((m) => m.dispose());
});
