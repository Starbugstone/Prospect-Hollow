import { afterEach, expect, it, vi } from 'vitest';
import { Box3, Group, MeshBasicMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { addTownAnimals } from '../src/game/town/TownAnimals';
import { animalModel, animateAnimal } from '../src/game/town/TownAnimalModels';
import { dressSpaceHelmet, spaceHelmetTargets } from '../src/game/town/TownSpaceHelmet';
import { FIND_HINT_SCALE, FIND_SCALE, hiddenFindTap } from '../src/game/town/TownHiddenFinds';
import { townNavigation } from '../src/game/town/TownNavigation';
import { swingLimbs } from '../src/game/town/TownGait';
import {
  RACCOON_HEIGHT,
  WANDERERS,
  pairTargets,
  strideRaccoon,
  wanderersPlace,
  wanderersTargets,
} from '../src/game/town/TownWanderers';
import { MoonScene } from '../src/game/town/moon/MoonScene';
import {
  MOON_PAIR_LANE,
  MOON_WALK_LANE,
  animateMoonSettler,
  moonWanderersPlan,
} from '../src/game/town/moon/MoonSettlers';
import { MOON_RING_ROAD } from '../src/data/moonSettlement';
import { HIDDEN_FINDS } from '../src/data/hiddenFinds';
import { createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { villageAppearance } from '../src/services/publicVillage';

const DEBUT = HIDDEN_FINDS[WANDERERS].debut;
const town = (completedRuns, era = DEBUT) => ({ ...createTown(), era, completedRuns });
const views = [];
afterEach(() => {
  for (const d of views.splice(0)) {
    d.clearGroup(d.scene);
    d.disposePrimitives?.();
  }
});

it('debuts in New Hollow Rising and walks the valley or the Moon after each puzzle', () => {
  expect(DEBUT).toBe('hollow-rising');
  const before = ERAS[ERAS.findIndex(({ id }) => id === DEBUT) - 1].id;
  expect(wanderersPlace(town(5, before))).toBeNull();
  expect(wanderersPlace(null)).toBeNull();
  const places = Array.from({ length: 200 }, (_, runs) => wanderersPlace(town(runs)));
  // Deterministic, and both settlements get their share.
  expect(places).toEqual(Array.from({ length: 200 }, (_, runs) => wanderersPlace(town(runs))));
  const moon = places.filter((place) => place === 'moon').length;
  expect(places.every((place) => ['valley', 'moon'].includes(place))).toBe(true);
  expect(moon).toBeGreaterThan(70);
  expect(moon).toBeLessThan(130);
  // Neither settlement keeps them for long.
  expect(/(valley,){9}|(moon,){9}/.test(`${places},`)).toBe(false);
});

it('is placed the same for a visitor, from the shared town alone', () => {
  for (let runs = 0; runs < 40; runs++) {
    const own = town(runs);
    const shared = villageAppearance({
      name: 'Red Rock',
      era: DEBUT,
      appearance: JSON.parse(JSON.stringify({ ...own, completedRuns: runs })),
    });
    expect(wanderersPlace(shared), `after ${runs} puzzles`).toBe(wanderersPlace(own));
  }
});

it('builds the raccoon upright on the villager skeleton, beside the game’s Willowkin', () => {
  const d = new TownPrimitives();
  views.push(Object.assign(d, { scene: new Group() }));
  for (const costume of [null, 'space-helmet']) {
    const pair = animalModel(d, WANDERERS, 0, costume, d.scene);
    const { raccoon, willowkin } = pair;
    expect(willowkin.species).toBe('willowkinResident');
    expect(!!willowkin.root.getObjectByName('Space helmet')).toBe(!!costume);
    // Two figures a step apart, under one walker.
    expect(raccoon.root.parent).toBe(willowkin.root.parent);
    expect(Math.abs(raccoon.root.position.x - willowkin.root.position.x)).toBeGreaterThan(0.45);
    expect(Math.abs(raccoon.root.position.x - willowkin.root.position.x)).toBeLessThan(0.8);
    // Hind legs only: two legs and two arms, each an upper and lower joint.
    expect(raccoon.legs).toHaveLength(2);
    expect(raccoon.arms).toHaveLength(2);
    for (const limb of [...raccoon.legs, ...raccoon.arms])
      expect(limb.lower.parent).toBe(limb.upper);
    expect(raccoon.body.position.y).toBeGreaterThan(0.25);
    pair.root.updateMatrixWorld(true);
    const top = raccoon.head.getWorldPosition(new Vector3()).y;
    expect(top).toBeGreaterThan(0.7);
    expect(top).toBeLessThan(RACCOON_HEIGHT + 0.1);

    // The shared walk cycle: the same limb poses as any villager at the same step.
    const reference = {
      arms: [0, 1].map(() => ({ upper: new Group(), lower: new Group() })),
      legs: [0, 1].map(() => ({ upper: new Group(), lower: new Group() })),
    };
    for (const [time, moving] of [
      [0.37, true],
      [1.9, true],
      [2.4, false],
    ]) {
      animateAnimal(pair, time, moving ? 'walking' : 'looking around', moving);
      swingLimbs(reference.arms, reference.legs, time * 7, moving);
      for (const limbs of ['arms', 'legs'])
        for (const n of [0, 1])
          for (const joint of ['upper', 'lower'])
            expect(raccoon[limbs][n][joint].rotation.x).toBeCloseTo(
              reference[limbs][n][joint].rotation.x,
            );
    }
  }
});

it('keeps the raccoon cheap to draw, inside its tap height and at rest under reduced motion', () => {
  const d = new TownPrimitives();
  views.push(Object.assign(d, { scene: new Group() }));
  for (const costume of [null, 'space-helmet']) {
    const { raccoon, willowkin } = animalModel(d, WANDERERS, 0, costume, d.scene);
    // Each rigid part is one mesh per colour: detail costs triangles, not draw calls.
    let meshes = 0,
      triangles = 0;
    raccoon.root.traverse((object) => {
      if (!object.isMesh) return;
      meshes++;
      triangles += object.geometry.index.count / 3;
    });
    expect(meshes).toBeLessThanOrEqual(34);
    expect(triangles).toBeLessThan(4600);
    d.scene.updateMatrixWorld(true);
    const top = new Box3().setFromObject(raccoon.root, true).max.y;
    expect(Math.abs(top - RACCOON_HEIGHT)).toBeLessThan(0.1);

    const pose = () =>
      [raccoon.head, raccoon.tail, raccoon.tailTip, ...raccoon.ears].map(({ rotation }) =>
        rotation.toArray().slice(0, 3),
      );
    // Reduced motion: the shared gait still walks it; its own touches hold one pose.
    d.reducedMotion = true;
    strideRaccoon(raccoon, 3, true, 0.1);
    const still = pose(),
      leg = raccoon.legs[0].upper.rotation.x;
    strideRaccoon(raccoon, 9.4, true, 3.78);
    expect(pose()).toEqual(still);
    expect(raccoon.legs[0].upper.rotation.x).not.toBeCloseTo(leg);
    // Otherwise the tail sways and, here, an ear is mid-flick.
    d.reducedMotion = false;
    strideRaccoon(raccoon, 9.4, true, 3.78);
    expect(raccoon.tail.rotation.y).not.toBeCloseTo(0);
    expect(raccoon.tailTip.rotation.z).not.toBeCloseTo(0);
    expect(raccoon.ears.map(({ rotation }) => rotation.z)).not.toEqual(
      still.slice(3).map((r) => r[2]),
    );
    // Standing, it turns its head up toward the Willowkin beside it.
    strideRaccoon(raccoon, 0, false, 5);
    expect(Math.sign(raccoon.head.rotation.y)).toBe(
      Math.sign(willowkin.root.position.x - raccoon.root.position.x),
    );
    expect(raccoon.head.rotation.x).toBeLessThan(0);
  }
});

function valley(completedRuns) {
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
    town: town(completedRuns),
    rebuildActors() {},
    render() {},
  });
  d.scene.add(d.world);
  Object.assign(d.town.buildings, { home: 3, farm: 3, square: 3, saloon: 3, shop: 3, well: 3 });
  d.navigation = townNavigation(d.world);
  views.push(d);
  addTownAnimals(d, d.town);
  return d;
}
const runsIn = (place) => {
  for (let runs = 1; ; runs++) if (wanderersPlace(town(runs)) === place) return runs;
};
function aim(d, at, pixels) {
  d.camera = new PerspectiveCamera(40, 2, 0.1, 400);
  const rect = { left: 100, top: 50, width: 800, height: 400 };
  d.canvas = { getBoundingClientRect: () => rect };
  const distance = (rect.height / 2 / Math.tan((40 * Math.PI) / 360) / pixels) * 1;
  const way = new Vector3(0, 6, 8).normalize().multiplyScalar(distance);
  d.camera.position.set(at.x + way.x, at.y + way.y, at.z + way.z);
  d.camera.lookAt(at);
  d.camera.updateMatrixWorld();
  return (target) => {
    const feet = target.root.getWorldPosition(new Vector3());
    const mid = feet
      .clone()
      .setY(feet.y + target.height / 2)
      .project(d.camera);
    return [rect.left + ((mid.x + 1) * rect.width) / 2, rect.top + ((1 - mid.y) * rect.height) / 2];
  };
}

it('walks the valley sidewalks only while the puzzles put the pair there, and is found by a tap', () => {
  const d = valley(runsIn('valley'));
  const pairs = d.animals.filter(({ species }) => species === WANDERERS);
  expect(pairs).toHaveLength(1);
  const [pair] = pairs;
  expect(pair.path.total).toBeGreaterThan(10);
  expect(pair.root.visible).toBe(true);
  // Never an animal for the helmet: it wears none and hints at none.
  expect(spaceHelmetTargets(d).some(({ root }) => root === pair.root)).toBe(false);
  expect(pair.root.getObjectByName('Space helmet')).toBeUndefined();
  d.motions.forEach((motion) => motion(0.5, 0.5));
  d.world.updateMatrixWorld(true);
  const targets = wanderersTargets(d.animals);
  expect(targets).toHaveLength(2);
  const at = pair.root.getWorldPosition(new Vector3());

  // Close enough, a tap on the raccoon or on the Willowkin finds the pair.
  let spot = aim(d, at, FIND_SCALE * 1.1);
  const camera = d.camera.position.clone();
  for (const target of targets)
    expect(hiddenFindTap(d, d.findTargets(), ...spot(target))).toMatchObject({
      find: WANDERERS,
      x: expect.any(Number),
      y: expect.any(Number),
    });
  const found = vi.fn(),
    zoom = vi.fn();
  Object.assign(d, { onFind: found, onFindZoom: zoom, pickTown: () => false });
  d.pick(...spot(targets[0]));
  expect(found).toHaveBeenCalledWith(expect.objectContaining({ find: WANDERERS }));
  // Taps never move the camera.
  expect(d.camera.position.equals(camera)).toBe(true);
  // Just short of the find zoom it asks to zoom in; farther out it answers nothing.
  spot = aim(d, at, (FIND_SCALE + FIND_HINT_SCALE) / 2);
  d.pick(...spot(targets[0]));
  expect(zoom).toHaveBeenCalledWith(WANDERERS);
  expect(found).toHaveBeenCalledTimes(1);
  spot = aim(d, at, FIND_HINT_SCALE * 0.9);
  expect(hiddenFindTap(d, d.findTargets(), ...spot(targets[0]))).toBeNull();

  // The next puzzle may send them to the Moon: the same cast, hidden, nothing to tap.
  spot = aim(d, at, FIND_SCALE * 1.1);
  const away = { ...d.town, completedRuns: runsIn('moon') };
  dressSpaceHelmet(d, away);
  expect(pair.root.visible).toBe(false);
  expect(wanderersTargets(d.animals)).toEqual([]);
  d.motions.forEach((motion) => motion(1, 0.5));
  expect(pair.root.visible).toBe(false);
  expect(hiddenFindTap(d, d.findTargets(), ...spot(targets[0]))?.find).not.toBe(WANDERERS);
  dressSpaceHelmet(d, { ...d.town, completedRuns: runsIn('valley') });
  expect(pair.root.visible).toBe(true);
});

it('casts no pair before their era', () => {
  const d = valley(3);
  expect(d.animals.some(({ species }) => species === WANDERERS)).toBe(true);
  const early = Object.create(TownDiorama.prototype);
  Object.assign(early, d, { animals: [], world: new Group(), town: town(3, 'tomorrow') });
  Object.assign(early.town.buildings, d.town.buildings);
  addTownAnimals(early, early.town);
  expect(early.animals.some(({ species }) => species === WANDERERS)).toBe(false);
});

it('laps the Moon’s ring road in suits while the puzzles put the pair there', () => {
  const d = new TownPrimitives();
  const view = Object.assign(Object.create(MoonScene.prototype), {
    d,
    scene: new Scene(),
    elapsed: 0,
    onFind: vi.fn(),
    onFindZoom: vi.fn(),
  });
  views.push(Object.assign(d, { scene: view.scene }));
  view.placeWanderers(town(runsIn('valley')));
  expect(view.wanderers).toBeNull();
  expect(view.findTargets()).toEqual([]);
  const onMoon = town(runsIn('moon'));
  view.placeWanderers(onMoon);
  const pair = view.wanderers;
  expect(pair.root.parent).toBe(view.scene);
  // Suited like the Moon's Willowkin, and always out on the public ring road.
  expect(pair.willowkin.root.getObjectByName('Space helmet')).toBeTruthy();
  expect(pair.root.userData.costume).toBe('space-helmet');
  expect(moonWanderersPlan(onMoon)).toEqual(moonWanderersPlan({ ...onMoon }));
  for (const time of [0, 40, 900]) {
    const pose = animateMoonSettler(pair, time);
    expect(pose.visible).toBe(true);
    // Two abreast on the road's shoulder: the inner of the pair keeps the walking lane.
    expect(Math.abs(Math.hypot(pose.x, pose.z) - MOON_RING_ROAD)).toBeCloseTo(MOON_PAIR_LANE, 6);
    expect(MOON_PAIR_LANE - 0.3).toBeGreaterThan(MOON_WALK_LANE - 1e-9);
  }
  // The same town again keeps the same pair; a tap finds them without moving the camera.
  view.placeWanderers({ ...onMoon });
  expect(view.wanderers).toBe(pair);
  view.scene.updateMatrixWorld(true);
  const targets = pairTargets(pair);
  const spot = aim(view, pair.root.getWorldPosition(new Vector3()), FIND_SCALE * 1.1);
  const camera = view.camera.position.clone();
  view.tap({ clientX: spot(targets[0])[0], clientY: spot(targets[0])[1] });
  expect(view.onFind).toHaveBeenCalledWith(expect.objectContaining({ find: WANDERERS }));
  expect(view.camera.position.equals(camera)).toBe(true);
  // Back to the valley after the next puzzle.
  view.placeWanderers(town(runsIn('valley')));
  expect(view.wanderers).toBeNull();
});
