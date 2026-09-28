import { afterEach, expect, it } from 'vitest';
import { Group, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { TownActors } from '../src/game/town/TownActors';
import { updateTownLocomotion } from '../src/game/town/TownLocomotion';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { addTownAnimals, animalHabitats } from '../src/game/town/TownAnimals';
import { addPowerGrid, addEraStreetscape } from '../src/game/town/TownEvolution';
import { townNavigation, walkPose } from '../src/game/town/TownNavigation';
import { buildTownSquare } from '../src/game/town/TownSquare';
import { placeTownSpawns } from '../src/game/town/TownTraffic';
import { createTown } from '../src/data/town';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { defineEra } from '../src/data/eraDefinitions';
import { PLOTS } from '../src/game/town/TownLayout';

const views = [];
function fixture(
  era = 'frontier',
  buildings = { home: 3, farm: 3, square: 5, saloon: 3, shop: 3 },
) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    actors: [],
    trafficActors: [],
    motions: [],
    elapsed: 0,
    town: createTown(),
  });
  d.scene.add(d.world);
  d.town.era = era;
  Object.assign(d.town.buildings, buildings);
  if (buildings.home) d.town.buildings.well = 3;
  if (buildings.square) {
    const square = d.group(d.world, PLOTS.square[0], 0, PLOTS.square[1]);
    buildTownSquare(d, square, buildings.square);
  }
  addPowerGrid(d, d.town);
  addEraStreetscape(d, d.town);
  d.navigation = townNavigation(d.world);
  views.push(d);
  return d;
}
function advance(d, end, step = 0.1) {
  for (let time = d.elapsed + step; time <= end + 1e-6; time += step) {
    d.elapsed = time;
    d.actors.forEach((actor) => d.animatePerson(actor, time));
    d.motions.forEach((motion) => motion(time));
    updateTownLocomotion(d, step);
  }
}
afterEach(() => {
  delete ERA_BY_ID['animal-future'];
  for (const d of views.splice(0)) {
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  }
});

it('introduces animals only with inhabited buildings and uses completed outdoor habitats', () => {
  const empty = fixture('frontier', {});
  empty.town.projects.park = { progress: 0, required: 2 };
  addTownAnimals(empty, empty.town);
  expect(empty.animals).toHaveLength(0);
  expect(empty.motions).toHaveLength(0);
  const d = fixture();
  addTownAnimals(d, d.town);
  expect(d.animals.map((a) => a.species)).toEqual([
    'dog',
    'cat',
    'hen',
    'hen',
    'hen',
    'pigeon',
    'pigeon',
    'pigeon',
    'fox',
    'raccoon',
  ]);
  expect(d.animalHabitats.map((h) => h.building)).toEqual(['square', 'farm', 'home']);
  expect(d.animals.every((a) => a.root.userData.animated)).toBe(true);
});

it.each([...ERAS.map((era) => era.id), 'unknown-animal-era'])(
  'uses actual power perches and navigable routes in %s',
  (era) => {
    const d = fixture(era, {
      home: 3,
      farm: 3,
      square: 5,
      saloon: 3,
      shop: 3,
      park: 3,
      powerHouse: 3,
    });
    addTownAnimals(d, d.town);
    const perches = d.animalHabitats.filter((h) => h.kind === 'perch');
    expect(perches.length > 0).toBe(
      eraEvolution(era).electricity && eraEvolution(era).overheadPower,
    );
    for (const animal of d.animals.filter((a) => a.path)) {
      expect(animal.path.points.at(-1)).toEqual(animal.path.points[0]);
      for (let n = 0; n <= 500; n++) {
        const p = walkPose(animal.path, n / 500);
        expect(d.navigation.clear([p.x, p.y, p.z], animal.radius)).toBe(true);
        // Domestic routes use old-town streets and stay away from the river.
        expect(p.x).toBeLessThan(20);
      }
    }
    expect(d.animalFeeder.appearance.era).toBe(era);
  },
);

it('inherits capabilities for a future era and drops removed power perches', () => {
  ERA_BY_ID['animal-future'] = defineEra({
    id: 'animal-future',
    evolution: { ...eraEvolution('contemporary') },
  });
  const future = fixture('animal-future', { home: 3, farm: 3, square: 3, powerHouse: 3 });
  addTownAnimals(future, future.town);
  expect(future.animals).toHaveLength(10);
  expect(future.animalHabitats.every((h) => h.kind !== 'perch')).toBe(true);
  const d = fixture('industrial', { home: 3, square: 3, powerHouse: 3 });
  expect(animalHabitats(d, d.town).some((h) => h.kind === 'perch')).toBe(true);
  d.world.getObjectByName('Connected village power grid').removeFromParent();
  expect(animalHabitats(d, d.town).some((h) => h.kind === 'perch')).toBe(false);
});

it('roams beyond the old tiny orbits, idles, flies and lands without growing or saving the cast', () => {
  const d = fixture('industrial', {
    home: 3,
    farm: 3,
    square: 5,
    saloon: 3,
    shop: 3,
    park: 3,
    powerHouse: 3,
  });
  const saved = JSON.stringify(d.town);
  addTownAnimals(d, d.town);
  const count = d.world.children.length,
    plans = d.navigation.plans;
  const seen = new Map(
    d.animals.map((a) => [
      a,
      { positions: [], states: new Set(), habitats: new Set(), visible: 0, hidden: 0 },
    ]),
  );
  const previous = new Map();
  for (let step = 1; step <= 4000; step++) {
    advance(d, step / 10);
    for (const a of d.animals) {
      const sample = seen.get(a);
      sample.states.add(a.state);
      if (a.root.visible) {
        sample.visible++;
        sample.positions.push(a.root.position.x);
        if (previous.has(a)) expect(a.root.position.distanceTo(previous.get(a))).toBeLessThan(1.8);
        previous.set(a, a.root.position.clone());
        if (!a.flight && a.habitat) sample.habitats.add(a.habitat.kind);
      } else {
        sample.hidden++;
        previous.delete(a);
      }
    }
  }
  for (const a of d.animals.filter((a) => a.path && !a.wild)) {
    const s = seen.get(a);
    expect(Math.max(...s.positions) - Math.min(...s.positions)).toBeGreaterThan(
      a.species === 'hen' ? 2 : 8,
    );
    expect(s.states.has(a.idle)).toBe(true);
  }
  expect(
    d.animals.filter((a) => a.species === 'pigeon').some((a) => seen.get(a).habitats.has('perch')),
  ).toBe(true);
  for (const a of d.animals.filter((a) => a.wild)) {
    expect(seen.get(a).visible).toBeGreaterThan(0);
    expect(seen.get(a).hidden).toBeGreaterThan(0);
    expect(a.path.points.every((p) => p[2] >= 29)).toBe(true);
  }
  expect(d.navigation.plans).toBe(plans);
  expect(d.world.children).toHaveLength(count);
  expect(JSON.stringify(d.town)).toBe(saved);
});

it('coordinates visible feeding and pauses every animal on the village clock', () => {
  const d = fixture();
  addTownAnimals(d, d.town);
  for (let n = 0; n < 200 && !d.animalFeeder.active; n++) advance(d, d.elapsed + 0.1);
  advance(d, d.elapsed + 1);
  expect(d.animalFeeder.active).toBe(true);
  expect(d.animalFeeder.grain.visible).toBe(true);
  expect(d.animals.some((a) => a.state === 'feeding')).toBe(true);
  const poses = () =>
    d.animals.map((a) => [
      a.root.position.toArray(),
      a.root.rotation.toArray(),
      a.head.rotation.toArray(),
      a.state,
    ]);
  const frozen = poses();
  for (let n = 0; n < 20; n++) d.motions.forEach((motion) => motion(d.elapsed));
  expect(poses()).toEqual(frozen);
  for (let n = 0; n < 350 && d.animalFeeder.active; n++) advance(d, d.elapsed + 0.1);
  expect(d.animalFeeder.active).toBe(false);
  expect(d.animalFeeder.grain.visible).toBe(false);
});

it.each(['frontier', 'industrial', 'motor-age', 'unknown-animal-era'])(
  'walks the feeder to the birds and back through the actual movement loop in %s',
  (era) => {
    const d = fixture(era);
    addTownAnimals(d, d.town);
    const food = d.animalFeeder;
    expect(d.actors).toContain(food);
    let active = false,
      returned = false,
      travel = 0;
    for (let frame = 1; frame <= 900; frame++) {
      const before = food.root.position.clone();
      advance(d, frame / 10);
      const step = food.root.position.distanceTo(before);
      expect(step).toBeLessThanOrEqual(0.055 + 1e-6);
      travel += step;
      if (food.active) {
        active = true;
        expect(food.root.position.distanceTo(new Vector3(...food.path.points.at(-1)))).toBeLessThan(
          1e-5,
        );
      }
      if (active && food.workRoutine.phase === 'rest') {
        returned = true;
        expect(food.root.position.distanceTo(new Vector3(...food.walkPath.points[0]))).toBeLessThan(
          1e-5,
        );
      }
    }
    expect(active).toBe(true);
    expect(returned).toBe(true);
    expect(travel).toBeGreaterThan(4);
  },
);

it.each([...ERAS.map((era) => era.id), 'unknown-animal-era'])(
  'turns toward the feeding patch before throwing from his hand in %s',
  (era) => {
    const d = fixture(era);
    addTownAnimals(d, d.town);
    const food = d.animalFeeder;
    const plans = d.navigation.plans;
    const seeds = food.seeds.slice();
    let throws = 0,
      behind = 0;
    const emitted = new Set();
    const forward = new Vector3(),
      toward = new Vector3();
    for (let frame = 1; frame <= 900; frame++) {
      advance(d, frame / 20, 0.05);
      if (!food.active) continue;
      if (Math.abs(food.toss.turn) > Math.PI / 2) behind++;
      forward.set(Math.sin(food.root.rotation.y), 0, Math.cos(food.root.rotation.y));
      for (const [index, seed] of seeds.entries()) {
        const state = seed.userData.grain;
        if (!seed.visible || state.grounded) continue;
        // Every airborne grain goes forward toward the bird, not behind the
        // feeder or toward another patch on the opposite side of the square.
        toward.fromArray(food.seedTargets[index]).sub(food.root.position).setY(0).normalize();
        expect(forward.dot(toward)).toBeGreaterThan(0.9);
        const key = `${index}:${state.generation}`;
        if (!emitted.has(key)) {
          emitted.add(key);
          throws++;
          const hand = food.arms[1].lower.localToWorld(new Vector3(0, -0.19, 0.03));
          expect(hand.distanceTo(new Vector3(...state.from))).toBeLessThan(1e-6);
          expect(
            new Vector3(...food.seedTargets[index])
              .setY(0)
              .distanceTo(new Vector3(...food.toss.site.point).setY(0)),
          ).toBeLessThan(0.35);
        }
      }
    }
    expect(throws).toBeGreaterThan(14);
    expect(
      behind,
      'exercise turning toward patches behind his arrival/previous heading',
    ).toBeGreaterThan(0);
    expect(food.seeds).toEqual(seeds);
    expect(d.navigation.plans).toBe(plans);
  },
);

it('startles grounded pigeons and makes street animals give traffic space', () => {
  const d = fixture('industrial');
  addTownAnimals(d, d.town);
  const bird = d.animals.find((a) => a.species === 'pigeon');
  const car = new Group();
  car.position.copy(bird.root.position);
  car.userData.trafficRadius = 0.9;
  d.trafficActors.push(car);
  advance(d, 0.1);
  expect(bird.state).toBe('startled');
  advance(d, 1);
  expect(bird.root.position.y).toBeGreaterThan(1);
  const dog = d.animals.find((a) => a.species === 'dog');
  car.position.copy(dog.root.position);
  advance(d, 1.1);
  expect(dog.state).toBe('alert');
  placeTownSpawns(d);
  expect(dog.root.position.distanceTo(car.position)).toBeGreaterThanOrEqual(1.15 - 1e-6);
});

it('lands a bounded pool of grain, consumes it on actual pecks and expires uneaten grain', () => {
  const d = fixture();
  addTownAnimals(d, d.town);
  const food = d.animalFeeder,
    seeds = food.seeds.slice(),
    count = d.world.children.length;
  const renderer = new TownActors(d.scene);
  renderer.rebuild([food.grain]);
  const consumed = new Set(),
    expired = new Set();
  let groundFrames = 0;
  for (let frame = 1; frame <= 160 * 20; frame++) {
    advance(d, frame / 20, 0.05);
    renderer.update();
    const visible = food.grain.visible ? seeds.filter((seed) => seed.visible) : [];
    expect(renderer.buckets.reduce((sum, bucket) => sum + bucket.mesh.count, 0)).toBe(
      visible.length,
    );
    expect(visible.length).toBeLessThanOrEqual(14);
    for (const [index, seed] of seeds.entries()) {
      const state = seed.userData.grain,
        key = `${index}:${state.generation}`;
      if (seed.visible && food.grain.visible) {
        expect(state.age).toBeLessThan(3);
        if (state.grounded) {
          groundFrames++;
          expect(seed.position.toArray()).toEqual(food.seedTargets[index]);
          expect(seed.position.y).toBeCloseTo(
            d.animalSpace.groundY(food.seedTargets[index]) + 0.01,
          );
        }
      }
      if (state.consumed && !consumed.has(key)) {
        expect(seed.visible).toBe(false);
        const bird = d.animals.find((a) => a.grainTarget === seed && a.grainPeckDone);
        expect(bird, 'a grain disappears when a beak reaches it').toBeTruthy();
        expect(
          bird.beak.localToWorld(new Vector3(0, 0, 0.0375)).distanceTo(seed.position),
        ).toBeLessThan(0.15);
        consumed.add(key);
      }
      if (food.grain.visible && state.age >= 3) {
        expect(seed.visible).toBe(false);
        expired.add(key);
      }
    }
  }
  expect(groundFrames).toBeGreaterThan(100);
  expect(consumed.size).toBeGreaterThan(3);
  expect(expired.size).toBeGreaterThan(3);
  expect(food.seeds).toEqual(seeds);
  expect(d.world.children).toHaveLength(count);
  for (let n = 0; n < 500 && food.active; n++) advance(d, d.elapsed + 0.05, 0.05);
  renderer.update();
  expect(renderer.buckets.every((bucket) => bucket.mesh.count === 0)).toBe(true);
  renderer.dispose();
});

it('clears tall future roofs and makes wildlife retreat away from an approaching person', () => {
  const d = fixture();
  const tower = d.group(d.world);
  d.box(tower, 3, 24, 3, 30, 12, 0, '#aaaaaa');
  d.plotCache = new Map([['future-roof', { group: tower }]]);
  addTownAnimals(d, d.town);
  const flying = d.animals.find((a) => a.flight);
  expect(flying.flight.cruise).toBeGreaterThanOrEqual(25);
  let wildlife;
  for (let time = 1; time <= 60 && !wildlife; time++) {
    advance(d, time);
    wildlife = d.animals.find((a) => a.wild && a.root.visible && a.root.scale.x > 0.9);
  }
  expect(wildlife).toBeTruthy();
  const observer = new Group();
  observer.position.copy(wildlife.root.position);
  observer.position.x += Math.sin(wildlife.pose.heading);
  observer.position.z += Math.cos(wildlife.pose.heading);
  d.actors.push({ root: observer });
  const before = wildlife.root.position.distanceTo(observer.position);
  for (let n = 0; n < 10; n++) {
    d.elapsed += 0.1;
    d.motions.forEach((motion) => motion(d.elapsed));
    updateTownLocomotion(d, 0.1);
  }
  expect(wildlife.state).toBe('retreating');
  expect(wildlife.root.position.distanceTo(observer.position)).toBeGreaterThan(before);
});

// C5: re-settling animals after a plot swap keeps every route the town still allows.
it('keeps animal routes that the changed town still allows', () => {
  const d = fixture();
  addTownAnimals(d, d.town);
  const paths = new Map(d.animals.map((a) => [`${a.species}:${a.seed}`, a.path]));
  const plans = d.navigation.plans;
  addTownAnimals(d, d.town);
  for (const animal of d.animals.filter((a) => a.species !== 'pigeon'))
    expect(animal.path).toBe(paths.get(`${animal.species}:${animal.seed}`));
  // No ground route was planned again; only the feeder may plan its own walk.
  expect(d.navigation.plans - plans).toBeLessThanOrEqual(1);
});

it('plans again only the animal route that a new building now blocks', () => {
  const d = fixture();
  addTownAnimals(d, d.town);
  const before = new Map(
    d.animals.filter((a) => a.species !== 'pigeon').map((a) => [`${a.species}:${a.seed}`, a.path]),
  );
  const dog = d.animals.find((a) => a.species === 'dog');
  const [x, , z] = dog.path.points[Math.floor(dog.path.points.length / 2)];
  const block = d.group(d.world, x, 0, z);
  d.box(block, 1.4, 1.6, 1.4, 0, 0.8, 0, '#777777');
  d.navigation = townNavigation(d.world);
  addTownAnimals(d, d.town);
  const near = (path) => path.points.some(([px, , pz]) => Math.hypot(px - x, pz - z) < 2);
  const replanned = d.animals.find((a) => a.species === 'dog').path;
  expect(replanned).not.toBe(dog.path);
  expect(replanned.points.every(([px, , pz]) => Math.hypot(px - x, pz - z) > 0.7)).toBe(true);
  // Routes well away from the new block are kept as they were.
  const untouched = [...before].filter(([, path]) => !near(path));
  expect(untouched.length).toBeGreaterThan(0);
  for (const [key, path] of untouched)
    expect(d.animals.find((a) => `${a.species}:${a.seed}` === key).path).toBe(path);
});
