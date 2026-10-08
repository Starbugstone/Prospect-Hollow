import { afterEach, expect, it, vi } from 'vitest';
import { Group, MeshBasicMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { TownActors } from '../src/game/town/TownActors';
import { updateTownLocomotion } from '../src/game/town/TownLocomotion';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { addTownAnimals, animalHabitats, animalKey } from '../src/game/town/TownAnimals';
import {
  dressSpaceHelmet,
  HELMET_FIND_SCALE,
  HELMET_HINT_SCALE,
  spaceHelmetTap,
  spaceHelmetWearer,
} from '../src/game/town/TownSpaceHelmet';
import { addPowerGrid, addEraStreetscape } from '../src/game/town/TownEvolution';
import { townNavigation, walkPose, walkPath } from '../src/game/town/TownNavigation';
import { createAnimalBehavior } from '../src/game/town/TownAnimalBehavior';
import { prepareAnimalRoaming } from '../src/game/town/TownAnimalRoaming';
import { buildTownSquare } from '../src/game/town/TownSquare';
import { placeTownSpawns } from '../src/game/town/TownTraffic';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { defineEra } from '../src/data/eraDefinitions';
import { PLOTS } from '../src/game/town/TownLayout';
import { COMPANION_NEIGHBORHOODS } from '../src/data/townCompanions';
import { SPACE_HELMET, TOWN_ANIMALS, townFauna } from '../src/data/townAnimals';
import { birdPopulation } from '../src/game/town/TownBirdHabitats';
import { monumentCast } from '../src/game/town/TownMonumentLife';

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
  expect(d.animals.filter((a) => !a.monumentSite).map((a) => a.species)).toEqual([
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
    'deer',
  ]);
  expect(d.animalHabitats.map((h) => h.building)).toEqual(
    expect.arrayContaining(['square', 'farm', 'home']),
  );
  expect(d.animals.every((a) => a.root.userData.animated)).toBe(true);
});

it.each(['canopy', 'riverlight'])(
  'adds a bounded garden cast with shared bird flight in %s',
  (era) => {
    const d = fixture(era, Object.fromEntries(BUILDINGS.map((b) => [b.id, b.upgrades.length])));
    const before = JSON.stringify(d.town);
    addTownAnimals(d, d.town);
    for (const species of ['otter', 'deer', 'hedgehog'])
      expect(
        d.animals.filter((a) => a.species === species && !a.monumentSite),
        species,
      ).toHaveLength(1);
    for (const definition of townFauna(eraEvolution(era)).birds)
      expect(d.animals.filter((a) => a.species === definition.species)).toHaveLength(
        birdPopulation(
          definition,
          d.animalHabitats.filter((h) => h.kind === 'ground'),
        ),
      );

    const birds = d.animals.filter((a) => a.habitat);
    expect(new Set(birds.map((a) => a.habitat.building)).size).toBeGreaterThanOrEqual(5);
    const xs = birds.map((a) => a.habitat.point[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(60);
    expect(d.animals.find((a) => a.species === 'dog').costume).toBeUndefined();
    const companions = d.animals.filter((a) => a.companion && !a.monumentSite);
    expect(companions).toHaveLength(3);
    expect(companions.map((a) => a.neighborhood)).toEqual(COMPANION_NEIGHBORHOODS.map((n) => n.id));
    expect(
      companions.every((a) => a.species === townFauna(eraEvolution(era)).companions.species),
    ).toBe(true);
    expect(new Set(companions.map((a) => a.seed)).size).toBe(3);
    expect(d.animals.length).toBeLessThanOrEqual(
      26 + monumentCast(d.town, townFauna(eraEvolution(era))).length,
    );
    const roots = d.animals.map((a) => a.root),
      plans = d.navigation.plans;
    advance(d, 40);
    expect(d.animals.map((a) => a.root)).toEqual(roots);
    expect(d.navigation.plans).toBe(plans);
    expect(JSON.stringify(d.town)).toBe(before);
    expect(companions.every((a) => a.root.visible)).toBe(true);
    if (era === 'riverlight') {
      expect(companions.every((a) => a.acceptedDistance > 4)).toBe(true);
      expect(companions.every((a) => a.path.total > 20)).toBe(true);
    }
  },
);

it('adds wildlife without replacing existing animals or duplicating them on refresh', () => {
  const d = fixture();
  addTownAnimals(d, d.town);
  for (const era of ['river-rail', 'motor-age', 'aviation', 'broadcast']) {
    const previous = new Map(d.animals.map((a) => [animalKey(a), a]));
    d.town.era = era;
    d.repairAnimalLife();
    const current = new Map(d.animals.map((a) => [animalKey(a), a]));
    expect(current.size).toBe(d.animals.length);
    for (const [key, animal] of previous) expect(current.get(key), `${era}: ${key}`).toBe(animal);
    const retained = [...d.animals];
    d.repairAnimalLife();
    expect(d.animals).toEqual(retained);
  }
  expect(d.animals.filter((a) => !a.monumentSite)).toHaveLength(15);
});

it('evolves all three companions into neighbors and retains their accepted street routes on refresh', () => {
  const d = fixture('canopy', Object.fromEntries(BUILDINGS.map((b) => [b.id, b.upgrades.length])));
  addTownAnimals(d, d.town);
  const saplings = d.animals.filter((a) => a.companion && !a.monumentSite);
  d.town.era = 'riverlight';
  d.repairAnimalLife();
  const neighbors = d.animals.filter((a) => a.companion && !a.monumentSite);
  expect(neighbors).toHaveLength(3);
  expect(neighbors.map((a) => a.seed)).toEqual(saplings.map((a) => a.seed));
  expect(neighbors.every((a) => a.resident && a.species === 'willowkinResident')).toBe(true);
  expect(saplings.every((a) => a.root.parent === null)).toBe(true);
  advance(d, 10);
  const paths = neighbors.map((a) => a.path),
    positions = neighbors.map((a) => a.root.position.clone());
  d.repairAnimalLife();
  expect(d.animals.filter((a) => a.companion && !a.monumentSite)).toEqual(neighbors);
  neighbors.forEach((a, i) => {
    expect(a.path).toBe(paths[i]);
    expect(a.root.position.distanceTo(positions[i])).toBeLessThan(1e-6);
  });
  expect(d.world.children.filter((o) => neighbors.some((a) => a.root === o))).toHaveLength(3);
});

it.each([...ERAS.map((era) => era.id), 'unknown-animal-era'])(
  'keeps the unlocked wildlife, actual power perches and navigable routes in %s',
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
    const eraIndex = Math.max(
      0,
      ERAS.findIndex((e) => e.id === era),
    );
    for (const [species, firstEra, count] of [
      ['deer', 'frontier', 1],
      ['otter', 'river-rail', 1],
      ['hedgehog', 'motor-age', 1],
      ['bluebird', 'aviation', 2],
    ]) {
      const unlocked = eraIndex >= ERAS.findIndex((e) => e.id === firstEra);
      expect(
        d.animals.filter((a) => a.species === species && !a.monumentSite),
        species,
      ).toHaveLength(unlocked ? count : 0);
    }
    expect(d.animals.filter((a) => a.species === 'pigeon')).toHaveLength(3);
    if (eraIndex < ERAS.findIndex((e) => e.id === 'canopy'))
      expect(d.animals.some((a) => a.companion)).toBe(false);
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
        if (['dog', 'cat'].includes(animal.species)) expect(p.x).toBeLessThan(20);
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
  expect(future.animals).toHaveLength(15);
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
      {
        positions: [],
        zPositions: [],
        states: new Set(),
        habitats: new Set(),
        visible: 0,
        hidden: 0,
      },
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
        sample.zPositions.push(a.root.position.z);
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
    const spread = Math.max(
      Math.max(...s.positions) - Math.min(...s.positions),
      Math.max(...s.zPositions) - Math.min(...s.zPositions),
    );
    expect(spread, `${a.species} explores the town along either street axis`).toBeGreaterThan(
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
    if (a.exteriorHabitat === 'fox') expect(a.path.points.every((p) => p[0] < -55)).toBe(true);
    if (a.exteriorHabitat === 'raccoon') expect(a.path.points.every((p) => p[0] > 68)).toBe(true);
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

it.each([
  ['dog', 'cat', -7],
  ['fox', 'deer', 30],
])('briefly animates %s chasing %s with continuous, bounded movement', (hunter, target, z) => {
  const d = fixture('frontier', { home: 3, farm: 3 });
  addTownAnimals(d, d.town);
  const predator = d.animals.find((a) => a.species === hunter);
  const prey = d.animals.find((a) => a.species === target);
  d.animals = [predator, prey];
  d.actors = [];
  d.animalFeeder = null;
  d.elapsed = 49;
  d.animalMotion(d.elapsed);
  const path = walkPath([
    [-12, 0.07, z],
    [12, 0.07, z],
    [-12, 0.07, z],
  ]);
  for (const [i, a] of d.animals.entries()) {
    a.path = path;
    a.progress = 1 + i * 3;
    a.root.position.set(-11 + i * 3, 0.07, z);
    a.root.visible = true;
    a.root.scale.setScalar(1);
    a.motion = null;
    a.roaming = null;
    a.walkPath = null;
    a.chaseRoute = null;
    a.escapeUntil = 0;
    a.roamingHold = false;
    a.rest = 1;
    a.untilStop = 20;
  }
  const prepare = prepareAnimalRoaming(d);
  while (!prepare.next().done) {
    /* Prepare before the animation loop. */
  }
  d.animalBehavior = createAnimalBehavior(d.animals, d.navigation, d.animalSpace, d.elapsed);
  const plans = d.navigation.plans;
  const states = new Set();
  let fleeingDistance = 0;
  for (let frame = 0; frame < 150; frame++) {
    const before = d.animals.map((a) => a.root.position.clone());
    advance(d, d.elapsed + 1 / 30, 1 / 30);
    states.add(`${predator.state}:${prey.state}`);
    for (const [i, a] of d.animals.entries()) {
      const travel = a.root.position.distanceTo(before[i]);
      expect(travel).toBeLessThanOrEqual(a.movementSpeed / 30 + 0.001);
      expect(d.animalSpace.clear(a.root.position.toArray(), a.radius, a.height ?? 1)).toBe(true);
      if (a === prey && a.state === 'fleeing') fleeingDistance += travel;
    }
  }
  expect(states.has('chasing:fleeing')).toBe(true);
  expect(fleeingDistance).toBeGreaterThan(6);
  expect(d.animalBehavior.starts).toBe(1);
  expect(predator.encounter).toBeNull();
  expect(prey.encounter).toBeNull();
  expect(d.navigation.plans).toBe(plans);
});

it('lets a nearby cat briefly chase a grounded bird as it takes its normal safe flight', () => {
  const d = fixture();
  addTownAnimals(d, d.town);
  const cat = d.animals.find((a) => a.species === 'cat');
  const bird = d.animals.find((a) => a.species === 'pigeon');
  d.animals = [cat, bird];
  d.actors = [];
  d.animalFeeder = null;
  bird.habitat = bird.habitats.find((h) => h.building === 'farm');
  bird.root.position.fromArray(bird.habitat.point);
  bird.flight = null;
  bird.rest = 100;
  const [x, y, z] = bird.habitat.point;
  cat.path = walkPath([
    [x - 2.5, y, z],
    [x - 0.8, y, z],
    [x - 2.5, y, z],
  ]);
  cat.progress = 0;
  cat.root.position.set(x - 2.5, y, z);
  cat.motion = null;
  cat.walkPath = null;
  cat.roaming = null;
  cat.rest = 0;
  cat.untilStop = 20;
  const prepare = prepareAnimalRoaming(d);
  while (!prepare.next().done) {
    /* Prepared before the animation loop. */
  }
  d.animalBehavior = createAnimalBehavior(d.animals, d.navigation, d.animalSpace);
  advance(d, 0.6, 1 / 60);
  expect(d.animalBehavior.starts).toBe(1);
  expect(cat.state).toBe('chasing');
  expect(bird.state).toBe('startled');
  expect(bird.flight).not.toBeNull();
  expect(cat.encounter.goal.y).toBe(y);
  advance(d, 2.4, 1 / 60);
  expect(cat.encounter).toBeNull();
  expect(cat.root.position.y).toBeLessThan(0.5);
  expect(bird.root.position.y).toBeGreaterThan(1);
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

// A hunter walks back along its chase route. When the crowd holds it for a frame,
// it keeps facing where it travels rather than turning around twice.
it('keeps a returning hunter facing its way back while it waits', () => {
  const d = fixture('canopy');
  addTownAnimals(d, d.town);
  advance(d, 2);
  const cat = d.animals.find((a) => a.species === 'cat');
  const { x, z } = cat.root.position;
  cat.chaseRoute = {
    role: 'hunter',
    returning: true,
    speed: cat.speed,
    path: walkPath([
      [x + 3, 0.07, z],
      [x, 0.07, z],
    ]),
  };
  cat.direction = -1;
  cat.motion.heading = 1.2;
  d.animalFeeder = null;
  d.animalMotion(d.elapsed + 0.05);
  expect(cat.root.rotation.y).toBeCloseTo(1.2, 10);
  // Before locomotion has a heading, the reversed path pose turns it around.
  delete cat.motion.heading;
  d.animalMotion(d.elapsed + 0.1);
  expect(cat.root.rotation.y).toBeCloseTo(cat.pose.heading + Math.PI, 10);
});

const helmeted = (d) => d.animals.filter((a) => a.root.getObjectByName('Space helmet'));
const castOf = (d) => new Set(d.animals.map((a) => a.species));

it('picks a present wearer for each completed puzzle, never twice in a row', () => {
  expect(new Set(SPACE_HELMET.wearers).size).toBe(SPACE_HELMET.wearers.length);
  const town = { era: 'tomorrow', completedRuns: 0 };
  for (const cast of [
    SPACE_HELMET.wearers,
    ['dog', 'fox', 'raccoon', 'pigeon'],
    ['fox', 'raccoon'],
    ['hen'],
  ]) {
    const present = new Set(cast);
    const candidates = SPACE_HELMET.wearers.filter((species) => present.has(species));
    const picks = [];
    for (let runs = 0; runs < 400; runs++)
      picks.push(spaceHelmetWearer({ ...town, completedRuns: runs }, present));
    for (const pick of picks) expect(candidates).toContain(pick);
    for (let n = 1; n < picks.length && candidates.length > 1; n++)
      expect(picks[n], `${cast} run ${n}`).not.toBe(picks[n - 1]);
    // Every round lets each present animal wear the helmet once.
    if (candidates.length > 2)
      for (let round = 0; round < 400 / candidates.length - 1; round++)
        expect(
          new Set(picks.slice(round * candidates.length, (round + 1) * candidates.length)).size,
        ).toBe(candidates.length);
  }
  const all = new Set(SPACE_HELMET.wearers);
  expect(spaceHelmetWearer({ era: 'contemporary', completedRuns: 3 }, all)).toBeNull();
  expect(spaceHelmetWearer({ era: 'unknown-era', completedRuns: 3 }, all)).toBeNull();
  expect(spaceHelmetWearer({ era: 'tomorrow', completedRuns: 3 }, new Set(['pigeon']))).toBeNull();
  // Corrupt counts fall back to the first pick instead of failing.
  for (const completedRuns of [-4, 1.5, '3', undefined])
    expect(spaceHelmetWearer({ era: 'tomorrow', completedRuns }, all)).toBe(
      spaceHelmetWearer({ era: 'tomorrow', completedRuns: 0 }, all),
    );
});

it.each(ERAS.map((era) => era.id))('dresses at most one %s animal as a space animal', (era) => {
  const d = fixture(era);
  d.town.completedRuns = 11;
  addTownAnimals(d, d.town);
  const wearer = spaceHelmetWearer(d.town, castOf(d));
  expect(helmeted(d).map((a) => a.species)).toEqual(wearer ? [wearer] : []);
  expect(helmeted(d).every((a) => a.costume === 'space-helmet')).toBe(true);
  if (ERAS.findIndex(({ id }) => id === era) >= ERAS.findIndex(({ id }) => id === 'tomorrow'))
    expect(wearer).toBeTruthy();
});

// Later eras keep the latest cast, so every wearer can be picked there.
it('casts every space-helmet wearer in the latest era town', () => {
  const d = fixture(ERAS.at(-1).id);
  addTownAnimals(d, d.town);
  for (const species of SPACE_HELMET.wearers) expect(castOf(d).has(species), species).toBe(true);
});

// Wild animals only visit the town now and then; a wild wearer stays out to be found.
const helmetEras = ERAS.slice(ERAS.findIndex(({ id }) => id === SPACE_HELMET.debut)).map(
  ({ id }) => id,
);
it.each(helmetEras)('keeps the %s space-helmet wearer on screen at all times', (era) => {
  const d = fixture(era);
  Object.assign(d, { rebuildActors() {}, render() {} });
  addTownAnimals(d, d.town);
  const cast = castOf(d),
    worn = new Set(),
    missing = [];
  let time = d.elapsed + 0.5;
  for (let runs = 0; runs < 2 * SPACE_HELMET.wearers.length; runs++) {
    d.town.completedRuns = runs;
    dressSpaceHelmet(d, d.town);
    const [wearer] = helmeted(d);
    worn.add(wearer.species);
    // Longer than a whole visit cycle, so every wild visitor would leave once.
    for (const end = time + 160; time < end; time += 0.5) {
      d.animalMotion(time);
      if (!wearer.root.visible || wearer.root.scale.x !== 1)
        missing.push(`${wearer.species} after ${runs} puzzles at ${time}s`);
    }
  }
  expect(missing).toEqual([]);
  expect([...worn].sort()).toEqual(SPACE_HELMET.wearers.filter((s) => cast.has(s)).sort());
  expect(d.animals.some((a) => a.wild && worn.has(a.species))).toBe(true);
});

// A tap on the wearer finds it; a tap elsewhere is left to people and buildings.
it('finds the space-helmet wearer where it stands on the map', () => {
  const d = fixture('tomorrow');
  Object.assign(d, { rebuildActors() {}, render() {} });
  d.town.completedRuns = 5;
  addTownAnimals(d, d.town);
  const [wearer] = helmeted(d);
  wearer.root.visible = true;
  wearer.root.scale.setScalar(1);
  wearer.root.position.set(2, 0, 3);
  d.camera = new PerspectiveCamera(40, 2, 0.1, 400);
  d.camera.position.set(2, 6, 11);
  d.camera.lookAt(2, 0, 3);
  d.camera.updateMatrixWorld();
  // The camera looks at the wearer's feet, in the middle of this canvas.
  d.canvas = { getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 400 }) };
  const hit = spaceHelmetTap(d, 500, 245);
  expect(hit.x).toBeCloseTo(50, 5);
  expect(hit.y).toBeLessThan(50);
  expect(spaceHelmetTap(d, 500, 250)).toEqual(hit);
  expect(spaceHelmetTap(d, 700, 250)).toBeNull();
  // Nobody else wears the helmet, so no other animal can be found.
  wearer.root.position.set(40, 0, 3);
  expect(spaceHelmetTap(d, 500, 250)).toBeNull();
  wearer.root.position.set(2, 0, 3);
  // Not while it changes outfits, nor while a wild wearer is away.
  wearer.dressing = { costume: null, start: null, swapped: false };
  expect(spaceHelmetTap(d, 500, 250)).toBeNull();
  wearer.dressing = null;
  wearer.root.visible = false;
  expect(spaceHelmetTap(d, 500, 250)).toBeNull();
  // A town without a helmet has nothing to find.
  dressSpaceHelmet(d, { ...d.town, era: 'contemporary' });
  wearer.root.visible = true;
  expect(helmeted(d)).toEqual([]);
  expect(spaceHelmetTap(d, 500, 250)).toBeNull();
});

// The helmet is an easter egg. Far out, animals answer nothing and taps work as usual;
// just short of the find zoom, a tap on any animal that nothing else answers asks to
// zoom in, the same for the wearer as for the others, so taps cannot find it by chance.
it('only finds the space-helmet wearer close enough to see it', () => {
  const d = fixture('tomorrow');
  Object.assign(d, { rebuildActors() {}, render() {} });
  d.town.completedRuns = 5;
  addTownAnimals(d, d.town);
  const [wearer] = helmeted(d);
  const other = d.animals.find((a) => a !== wearer && !a.companion && !a.wild);
  for (const animal of d.animals) animal.root.visible = false;
  for (const animal of [wearer, other]) {
    animal.root.scale.setScalar(1);
    animal.root.position.set(2, 0, 3);
  }
  d.camera = new PerspectiveCamera(40, 2, 0.1, 400);
  const rect = { left: 100, top: 50, width: 800, height: 400 };
  d.canvas = { getBoundingClientRect: () => rect };
  // Looks at (2, 0, 3) from this many units away, from the same angle each time.
  const look = (distance) => {
    const way = new Vector3(0, 6, 8).normalize().multiplyScalar(distance);
    d.camera.position.set(2 + way.x, way.y, 3 + way.z);
    d.camera.lookAt(2, 0, 3);
    d.camera.updateMatrixWorld();
  };
  // Where a world unit spans this many pixels in the middle of the canvas.
  const spanning = (pixels) => rect.height / 2 / Math.tan((d.camera.fov * Math.PI) / 360) / pixels;
  const close = spanning(HELMET_FIND_SCALE) * 0.95,
    hint = spanning(HELMET_FIND_SCALE) * 1.05,
    far = spanning(HELMET_HINT_SCALE) * 1.05;
  expect(hint).toBeLessThan(spanning(HELMET_HINT_SCALE));
  // The middle of the animal's body on the canvas, where a player taps it.
  const body = (animal) => {
    const height = TOWN_ANIMALS[animal.species]?.height ?? 1;
    const [feet, head] = [0, height].map((y) => new Vector3(2, y, 3).project(d.camera).toArray());
    return [0, 1].map(
      (axis) =>
        [rect.left, rect.top][axis] +
        (((axis ? -1 : 1) * (feet[axis] + head[axis])) / 2 + 1) *
          ([rect.width, rect.height][axis] / 2),
    );
  };
  for (const animal of [wearer, other]) {
    for (const each of [wearer, other]) each.root.visible = each === animal;
    look(close);
    const found = spaceHelmetTap(d, ...body(animal));
    if (animal === wearer) expect(found).toMatchObject({ x: expect.any(Number) });
    // Close up, another animal is left to people and buildings as before.
    else expect(found).toBeNull();
    look(hint);
    expect(spaceHelmetTap(d, ...body(animal)), animal.species).toEqual({ zoom: true });
    // Only a tap on the body asks, so taps beside an animal are left alone.
    const [x, y] = body(animal);
    expect(spaceHelmetTap(d, x + 40, y)).toBeNull();
    for (const distance of [far, 60, 200]) {
      look(distance);
      expect(spaceHelmetTap(d, ...body(animal)), `${animal.species} at ${distance}`).toBeNull();
    }
  }
  // Finding wins over people and plots; asking to zoom in only answers a tap nothing
  // else does, so it never replaces a normal tap.
  const found = vi.fn(),
    zoom = vi.fn(),
    town = vi.fn(() => false);
  Object.assign(d, { onHelmet: found, onHelmetZoom: zoom, pickTown: town });
  wearer.root.visible = true;
  other.root.visible = false;
  look(far);
  d.pick(...body(wearer));
  expect([town.mock.calls.length, zoom.mock.calls.length]).toEqual([1, 0]);
  look(hint);
  d.pick(...body(wearer));
  expect([town.mock.calls.length, zoom.mock.calls.length]).toEqual([2, 1]);
  town.mockReturnValue(true);
  d.pick(...body(wearer));
  expect([town.mock.calls.length, zoom.mock.calls.length]).toEqual([3, 1]);
  look(close);
  d.pick(...body(wearer));
  expect(found).toHaveBeenCalledWith(expect.objectContaining({ x: expect.any(Number) }));
  expect([town.mock.calls.length, zoom.mock.calls.length]).toEqual([3, 1]);
  // Willowkin are not animals, and towns before the helmet ask nothing.
  wearer.root.visible = false;
  other.root.visible = true;
  look(hint);
  other.companion = true;
  expect(spaceHelmetTap(d, ...body(other))).toBeNull();
  delete other.companion;
  expect(spaceHelmetTap(d, ...body(other))).toEqual({ zoom: true });
  d.helmetTown = { ...d.town, era: 'contemporary' };
  expect(spaceHelmetTap(d, ...body(other))).toBeNull();
});

it('brings a wild wearer out for a visitor and lets it go back to its visits', () => {
  const d = fixture('canopy');
  Object.assign(d, { rebuildActors() {}, render() {} });
  addTownAnimals(d, d.town);
  const cast = castOf(d),
    wearerAt = (completedRuns) =>
      d.animals.find((a) => a.species === spaceHelmetWearer({ ...d.town, completedRuns }, cast));
  let runs = 1;
  while (!wearerAt(runs).wild) runs++;
  d.town.completedRuns = runs - 1;
  dressSpaceHelmet(d, d.town);
  const next = wearerAt(runs);
  let time = d.elapsed + 0.1;
  for (; next.root.visible && time < 200; time += 0.1) d.animalMotion(time);
  expect(next.root.visible).toBe(false);
  d.town.completedRuns = runs;
  dressSpaceHelmet(d, d.town, { animate: true });
  expect(helmeted(d)).toEqual([next]);
  const sizes = [];
  for (const end = time + 2.5; time < end; time += 0.1) {
    d.animalMotion(time);
    sizes.push(next.root.visible ? next.root.scale.x : 0);
  }
  // It comes out gradually rather than popping into view.
  expect(sizes[0]).toBeLessThan(0.1);
  expect(sizes.at(-1)).toBe(1);
  for (let n = 1; n < sizes.length; n++) expect(sizes[n]).toBeGreaterThanOrEqual(sizes[n - 1]);
  d.town.completedRuns = runs + 1;
  dressSpaceHelmet(d, d.town, { animate: true });
  let away = false;
  for (const end = time + 160; time < end && !away; time += 0.1) {
    d.animalMotion(time);
    away = !next.root.visible;
  }
  expect(away).toBe(true);
  expect(next.costume).toBeNull();
});

it('moves the helmet in place after a puzzle, without re-planning any walk', () => {
  const d = fixture('riverlight');
  let rebuilt = 0;
  Object.assign(d, { rebuildActors: () => rebuilt++, render() {} });
  addTownAnimals(d, d.town);
  const [first] = helmeted(d);
  const paths = new Map(d.animals.map((a) => [a, a.path]));
  const plans = d.navigation.plans;
  const { position } = first.root;
  const at = position.clone();
  d.town.completedRuns += 1;
  dressSpaceHelmet(d, d.town);
  const [next] = helmeted(d);
  expect(next).not.toBe(first);
  expect(next.species).toBe(spaceHelmetWearer(d.town, castOf(d)));
  // The former wearer is the same animal on the same spot, now in its own coat.
  expect(first.costume).toBeNull();
  expect(first.root.position.toArray()).toEqual(at.toArray());
  expect(first.root.parent).toBe(d.world);
  expect(position).not.toBe(first.root.position);
  for (const animal of d.animals) expect(animal.path).toBe(paths.get(animal));
  expect(d.navigation.plans).toBe(plans);
  expect(rebuilt).toBe(1);
});

it('shrinks the old wearer away and grows the new one for a watching visitor', () => {
  const d = fixture('canopy');
  let rebuilt = 0;
  Object.assign(d, { rebuildActors: () => rebuilt++, render() {} });
  addTownAnimals(d, d.town);
  for (const animal of d.animals) animal.root.visible = true;
  const [first] = helmeted(d);
  d.town.completedRuns += 1;
  dressSpaceHelmet(d, d.town, { animate: true });
  const next = d.animals.find((a) => a.dressing?.costume === 'space-helmet');
  expect(next.species).toBe(spaceHelmetWearer(d.town, castOf(d)));
  expect(first.dressing.costume).toBeNull();
  // Nothing changes outfit until each animal has shrunk out of sight.
  expect(helmeted(d)).toEqual([first]);
  const start = d.elapsed ?? 0,
    sizes = [],
    shadows = [];
  const shadowWidth = first.shadow.scale.x;
  for (let t = 0; t <= 1; t += 0.05) {
    d.animalMotion(start + 0.01 + t);
    sizes.push(first.body.scale.x);
    shadows.push(first.shadow.scale.x / shadowWidth);
  }
  expect(Math.min(...sizes)).toBeLessThan(0.05);
  expect(sizes.at(-1)).toBe(1);
  // The contact shadow shrinks with the body and returns to its own size.
  expect(Math.min(...shadows)).toBeLessThan(0.05);
  expect(shadows.at(-1)).toBeCloseTo(1, 10);
  expect(next.shadow.scale.x).toBe(next.shadow.userData.baseScale?.x ?? next.shadow.scale.x);
  expect(first.dressing).toBeNull();
  expect(next.dressing).toBeNull();
  expect(helmeted(d)).toEqual([next]);
  expect(next.body.scale.x).toBe(1);
  expect(rebuilt).toBe(2);
});

// A finished puzzle changes no building, so the scene keeps its older town object;
// a later animal refresh (construction, mine works) must not bring the old wearer back.
it('keeps the latest wearer when animals refresh from an older town object', async () => {
  const d = fixture('riverlight');
  Object.assign(d, { rebuildActors() {}, render() {} });
  addTownAnimals(d, d.town);
  const stale = d.town;
  const latest = { ...stale, completedRuns: stale.completedRuns + 1 };
  dressSpaceHelmet(d, latest);
  const species = spaceHelmetWearer(latest, castOf(d));
  expect(species).not.toBe(spaceHelmetWearer(stale, castOf(d)));
  d.retainedAnimals = new Map(d.animals.map((a) => [animalKey(a), a]));
  addTownAnimals(d, stale);
  expect(helmeted(d).map((a) => a.species)).toEqual([species]);
  Object.assign(d, { deferLife: true, generation: 1 });
  const before = d.animals;
  addTownAnimals(d, stale);
  for (let n = 0; n < 400 && d.animals === before; n++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  expect(helmeted(d).map((a) => a.species)).toEqual([species]);
});

// The deferred path the live village uses keeps the dressed animal object (C5).
it('keeps the helmeted animal when the town re-settles', async () => {
  const d = fixture('tomorrow');
  addTownAnimals(d, d.town);
  const [first] = helmeted(d);
  expect(first.root.userData.costume).toBe('space-helmet');
  addTownAnimals(d, d.town);
  const [settled] = helmeted(d);
  expect(animalKey(settled)).toBe(animalKey(first));
  expect(settled.path).toBe(first.path);
  Object.assign(d, { deferLife: true, generation: 1, rebuildActors() {}, render() {} });
  const before = d.animals;
  addTownAnimals(d, d.town);
  for (let n = 0; n < 400 && d.animals === before; n++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  expect(d.animals).not.toBe(before);
  expect(helmeted(d)).toEqual([settled]);
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

it('lets both original and monument wildlife wear the single cosmonaut outfit', () => {
  const d = fixture(ERAS.at(-1).id);
  addTownAnimals(d, d.town);
  const seen = new Set();
  for (let completedRuns = 0; completedRuns < 180; completedRuns++) {
    dressSpaceHelmet(d, { ...d.town, completedRuns }, { rebuild: false });
    const wearers = helmeted(d);
    expect(wearers).toHaveLength(1);
    seen.add(animalKey(wearers[0]));
  }
  for (const animal of d.animals.filter((a) => SPACE_HELMET.wearers.includes(a.species)))
    expect(seen.has(animalKey(animal)), animalKey(animal)).toBe(true);
});
