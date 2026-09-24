import { afterEach, expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Scene } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { animalSpace, animalNavigation } from '../src/game/town/TownAnimalSpace';
import { townNavigation, TownNavigation } from '../src/game/town/TownNavigation';
import { resolveTownTraffic } from '../src/game/town/TownTraffic';
import { addTownAnimals } from '../src/game/town/TownAnimals';
import { addLeisureActivity } from '../src/game/town/TownLeisure';
import { buildLandscape } from '../src/game/town/TownLandscape';
import {
  renderBuilding,
  renderEraLandmark,
  renderModernization,
} from '../src/game/town/buildings/BuildingRenderer';
import { addImprovements } from '../src/game/town/TownImprovements';
import { buildTownSquare } from '../src/game/town/TownSquare';
import { addPowerGrid, addEraStreetscape } from '../src/game/town/TownEvolution';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { PLOTS } from '../src/game/town/TownLayout';

const views = [];
function fixture() {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    actors: [],
    motions: [],
    elapsed: 0,
    town: createTown(),
    plotCache: new Map(),
    sign: () => {},
  });
  d.scene.add(d.world);
  views.push(d);
  return d;
}
afterEach(() => {
  for (const d of views.splice(0)) {
    d.clearGroup(d.world);
    d.clearGroup(d.landscape);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  }
});

it('detects unmarked thin fences, solid interiors and covered landing columns after batching', () => {
  const d = fixture(),
    props = d.group(d.world);
  d.box(props, 0.03, 1, 3, 0, 0.5, 0, '#777777');
  d.box(props, 2, 0.1, 2, 4, 2, 0, '#777777');
  d.box(props, 3, 3, 3, 8, 1.5, 0, '#777777');
  d.batch(props);
  const space = animalSpace(d),
    nav = animalNavigation(new TownNavigation(), space);
  expect(space.clear([8, 0.07, 0], 0.3)).toBe(false);
  expect(space.clear([4, 0.07, 0], 0.3)).toBe(true);
  expect(space.openSky([4, 0.07, 0])).toBe(false);
  expect(space.segment([-2, 0.07, 0], [2, 0.07, 0], 0.5)).toBe(false);
  const path = nav.plan(
    [
      [-2, 0.07, 0],
      [2, 0.07, 0],
    ],
    0.5,
  );
  expect(path.points.at(-1)).toEqual([2, 0.07, 0]);
  expect(path.total).toBeGreaterThan(4);
  for (let i = 1; i < path.points.length; i++)
    expect(space.segment(path.points[i - 1], path.points[i], 0.5)).toBe(true);
  props.removeFromParent();
  expect(animalSpace(d).segment([-2, 0.07, 0], [2, 0.07, 0], 0.5)).toBe(true);
});

it('reserves moving scenery and prevents traffic correction from pushing an animal through an unmarked wall', () => {
  const d = fixture(),
    rotor = d.group(d.world);
  d.box(rotor, 1, 1, 1, 6, 3, 0, '#777777');
  rotor.userData.animated = true;
  rotor.userData.animalSolid = new Box3().setFromObject(rotor);
  const wall = d.group(d.world);
  d.box(wall, 0.03, 2, 8, 0, 1, 0, '#777777');
  d.animalSpace = animalSpace(d);
  expect(d.animalSpace.openSky([6, 0.07, 0])).toBe(false);
  const root = new Group();
  root.position.set(0.7, 0.07, 0);
  d.animals = [{ root, species: 'dog', radius: 0.64 }];
  const car = new Group();
  car.position.set(1.5, 0.07, 0);
  d.trafficActors = [car];
  resolveTownTraffic(d);
  expect(d.animalSpace.clear(root.position.toArray(), 0.64)).toBe(true);
  expect(root.position.x).toBeGreaterThan(0.65);
  expect(root.position.distanceTo(car.position)).toBeGreaterThanOrEqual(0.8 + 0.64 + 0.05 - 1e-6);
});

it.each(ERAS.flatMap((era, index) => [1, 3].map((tier) => [era.id, index, tier])))(
  'clears real scenery in %s (era %i, tier %i)',
  (era, eraIndex, tier) => {
    const d = fixture();
    d.town.era = era;
    d.landscape = buildLandscape(d);
    d.scene.add(d.landscape);
    for (const b of BUILDINGS.filter(
      (b) => ERAS.findIndex((e) => e.id === b.introducedEra) <= eraIndex,
    )) {
      const stage = tier === 3 ? b.upgrades.length : 1;
      d.town.buildings[b.id] = stage;
      d.town.buildingEras[b.id] = era;
      d.town.buildingEraLevels[b.id] = tier;
      const [x, z] = PLOTS[b.id];
      const root = d.group(d.world, x, 0.08, z);
      root.userData.plot = b.id;
      const { kind } = b;
      if (kind === 'bridge') {
        renderBuilding({ town: d, parent: root, kind, level: stage, label: b.name });
        renderModernization(d, root, kind, era, tier);
      } else if (!renderEraLandmark(d, root, kind, b.name, tier, era, stage)) {
        if (kind === 'square') buildTownSquare(d, root, stage, era === 'frontier');
        else if (kind === 'well') d.well(root);
        else d.building(root, kind, stage, b.name);
        if (!['fisherman', 'blacksmith', 'school', 'doctor'].includes(kind))
          addImprovements(d, root, kind, stage, era);
        renderModernization(d, root, kind, era, tier);
      }
      d.batch(root);
      d.plotCache.set(b.id, { group: root });
    }
    addPowerGrid(d, d.town);
    addEraStreetscape(d, d.town);
    d.navigation = townNavigation(d.world);
    addTownAnimals(d, d.town);
    addLeisureActivity(d, d.town);
    expect(d.animals.filter((a) => a.species === 'dog' || a.species === 'cat')).toHaveLength(2);
    expect(d.animals.filter((a) => a.species === 'hen')).toHaveLength(3);
    expect(d.animals.filter((a) => a.species === 'pigeon').length).toBeGreaterThan(0);
    for (const a of d.animals.filter((a) => a.path)) {
      expect(a.path.total, a.species).toBeGreaterThan(1);
      for (let i = 1; i < a.path.points.length; i++) {
        expect(
          d.animalSpace.segment(a.path.points[i - 1], a.path.points[i], a.radius),
          a.species,
        ).toBe(true);
      }
    }
    for (const a of d.animals.filter((a) => a.species === 'pigeon'))
      for (const h of a.habitats)
        expect(d.animalSpace.openSky(h.point), h.building ?? 'pole').toBe(true);
    const walk = d.world.getObjectByName('Park dog walk')?.userData.walkPath;
    if (walk) {
      expect(walk.total).toBeGreaterThan(1);
      for (let i = 1; i < walk.points.length; i++)
        expect(d.animalSpace.segment(walk.points[i - 1], walk.points[i], 1.2, 1.65)).toBe(true);
    }
    // Test the positions actually drawn, including changing bird altitude and
    // terrain-following wildlife, rather than only the route control points.
    for (let frame = 1; frame <= 360; frame++) {
      const time = frame / 4;
      d.actors.forEach((a) => d.animatePerson(a, time));
      d.motions.forEach((motion) => motion(time));
      resolveTownTraffic(d);
      for (const a of d.animals) {
        if (!a.root.visible) continue;
        expect(
          d.animalSpace.clear(a.root.position.toArray(), a.radius),
          `${a.species} at ${time}: ${a.root.position.toArray()}`,
        ).toBe(true);
      }
      if (d.animalFeeder)
        expect(
          d.animalSpace.clear(d.animalFeeder.root.position.toArray(), 0.45, 1.5),
          'feeder',
        ).toBe(true);
    }
  },
  60000,
);
