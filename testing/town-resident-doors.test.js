import { vi as testTiming } from 'vitest';
// Each case draws a whole village and follows its walkers for a few minutes.
testTiming.setConfig({ testTimeout: 60000 });
import { afterEach, expect, it } from 'vitest';
import { Group, MeshBasicMaterial, Scene } from 'three';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownActors } from '../src/game/town/TownActors';
import { TownStatics } from '../src/game/town/TownStatics';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';
import { updateTownLocomotion } from '../src/game/town/TownLocomotion';
import {
  setWorkRoutine,
  updateWorkPaths,
  updateWorkRoutine,
} from '../src/game/town/TownWorkRoutine';
import { walkPath } from '../src/game/town/TownNavigation';
import { segmentDistance, townTracks } from '../src/game/town/TownLayout';
import { overWater } from '../src/game/town/TownRiver';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS, ERA_BY_ID } from '../src/data/eras';

// Permanent rule (AGENTS.md, settlement maps): villagers leave and enter buildings
// through their doors. Residents come out of their home's door and go back in
// there, workers rest inside their workplace and the patrol starts each beat from
// the sheriff office. Nobody appears or vanishes anywhere else.
const DOORSTEP = 0.6;
const VILLAGE = ['home', 'home2', 'home3', 'home4', 'well', 'farm', 'saloon', 'sheriff', 'square'];
const labels = Object.fromEntries(BUILDINGS.map(({ id, shortName }) => [id, shortName]));
labels.mine = 'Mine';
const views = [];
afterEach(() => {
  for (const view of views.splice(0)) {
    view.disposed = true;
    view.discardPlotWork();
    view.actorRenderer.dispose();
    view.buildingRenderer.dispose();
    view.upgradeGlow.dispose();
    view.staticScenery?.dispose(view);
    view.clearGroup(view.world);
    Object.values(view.geometries).forEach((geometry) => geometry.dispose());
    view.materials.forEach((material) => material.dispose());
    view.contactShadowMaterial.dispose();
  }
});

function village(era, buildings = VILLAGE) {
  const view = Object.create(TownDiorama.prototype);
  Object.assign(view, {
    scene: new Scene(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    sign: () => {},
    elapsed: 0,
    controls: {},
    renderer: { shadowMap: {} },
    frameCache: { valid: false },
    render: () => {},
  });
  view.actorRenderer = new TownActors(view.scene);
  view.buildingRenderer = new TownStatics(view.scene);
  view.upgradeGlow = new TownUpgradeGlow(view.scene);
  views.push(view);
  const town = createTown();
  town.era = era;
  for (const id of buildings) {
    town.buildings[id] = 3;
    town.buildingEras[id] = era;
    town.buildingEraLevels[id] = 3;
  }
  view.update(town, labels);
  return { view, town };
}

// Where an actor goes in and comes out: its home or office door, or the doorway
// of the workplace it takes its breaks in.
const doorOf = (actor) =>
  actor.itinerary?.door
    ? actor.itinerary.anchor
    : actor.workRoutine?.door
      ? actor.workRoutine.paths[0].points[0]
      : null;
const flatGap = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const doorGap = (actor, door = doorOf(actor)) => flatGap(actor.root.position.toArray(), door);
const isIndoors = (actor) =>
  actor.itinerary ? actor.itinerary.inside : ['rest', 'approach'].includes(actor.workRoutine.phase);

// Advance the village, checking every frame that each followed walker walks
// continuously on clear ground and is out of sight only inside its door. The
// first broken rule per walker is reported after the run.
function follow(view, actors, seconds, { onFrame = () => {}, until = () => false } = {}) {
  const roads = townTracks(view.town).filter((road) => road.width >= 0.85);
  const states = new Map(
    actors.map((actor) => [
      actor,
      {
        previous: actor.root.position.clone(),
        hidden: !actor.root.visible,
        wentIn: 0,
        cameOut: 0,
        travel: 0,
        broken: null,
      },
    ]),
  );
  for (let frame = 1; frame <= seconds * 10; frame++) {
    view.elapsed += 0.1;
    view.actors.forEach((actor) => view.animatePerson(actor, view.elapsed));
    view.motions.forEach((motion) => motion(view.elapsed));
    view.vipArrivals?.update();
    updateTownLocomotion(view, 0.1);
    for (const [actor, state] of states) {
      const position = actor.root.position;
      const point = position.toArray();
      const step = position.distanceTo(state.previous);
      const shown = actor.root.visible && actor.root.scale.x === 1;
      const broken =
        (step > (actor.motion?.maxSpeed ?? 0.8) * 0.1 + 1e-6 && 'jumped') ||
        (!shown && doorGap(actor) >= DOORSTEP && 'faded away from its door') ||
        (!shown && !isIndoors(actor) && 'hidden outside') ||
        (shown && !view.navigation.clear(point, 0.28) && 'inside a building') ||
        (overWater(...point) && 'in the river') ||
        (actor.workRoutine &&
          roads.some(
            (road) =>
              segmentDistance(position.x, position.z, road.from, road.to) < 0.65 + 0.29 + 0.049,
          ) &&
          'in the carriageway');
      if (broken) state.broken ??= `${broken} at ${view.elapsed.toFixed(1)}s`;
      state.travel += step;
      state.previous.copy(position);
      if (state.hidden !== !actor.root.visible) {
        state.hidden = !actor.root.visible;
        if (state.hidden) state.wentIn++;
        else state.cameOut++;
      }
    }
    onFrame(frame);
    if (until(states)) break;
  }
  for (const [actor, { broken }] of states)
    expect(broken, `${actor.root.name || 'resident'} ${actor.seed}`).toBeNull();
  return states;
}

it.each(ERAS.map(({ id }) => id))(
  'lets %s villagers leave and come home only through their doors',
  (era) => {
    const { view } = village(era);
    const residents = view.actors.filter((actor) => actor.home);
    expect(residents.map((actor) => actor.seed).sort((a, b) => a - b)).toEqual([0, 1, 4, 5, 9, 13]);
    for (const actor of residents) {
      // Each lives in its own house: the first walker and the water carrier share
      // the family home, and the patrol starts from the sheriff office.
      expect(actor.itinerary.door, `${actor.seed} uses its door`).toBe(true);
      expect(actor.itinerary.anchor).toEqual(view.itineraries.endpoint(actor.home, true));
      const anchors = view.plotCache.get(actor.home).group.userData.navigationAnchors?.door;
      if (anchors) expect(anchors).toContainEqual(actor.itinerary.anchor);
      for (const { path } of actor.itinerary.plans) {
        expect(path.points[0]).toEqual(actor.itinerary.anchor);
        expect(path.points.at(-1)).toEqual(actor.itinerary.anchor);
      }
    }
    expect(Object.fromEntries(residents.map((actor) => [actor.seed, actor.home]))).toEqual({
      0: 'sheriff',
      1: 'home',
      4: 'home2',
      5: 'home',
      9: 'home4',
      13: 'home3',
    });
    // The patrol walks one beat: out of the office, along both main streets, back in.
    const patrol = residents.find((actor) => actor.patrol);
    expect(patrol.itinerary.plans).toHaveLength(1);
    const beat = patrol.itinerary.plans[0].path.points;
    expect(Math.min(...beat.map((p) => p[0]))).toBeLessThan(-3);
    expect(Math.max(...beat.map((p) => p[0]))).toBeGreaterThan(3);
    expect(Math.min(...beat.map((p) => p[2]))).toBeLessThan(-8);
    expect(Math.max(...beat.map((p) => p[2]))).toBeGreaterThan(15);
    // Workers take their breaks inside, from a doorway at the building's door.
    const workers = view.actors.filter((actor) => actor.workRoutine?.door);
    expect(workers.map((actor) => actor.root.name).sort()).toEqual([
      'Farmer tending crops',
      'Saloon host',
    ]);
    for (const actor of workers) {
      const anchors = view.plotCache.get(actor.activityBuilding).group.userData.navigationAnchors
        .door;
      const doorway = doorOf(actor);
      expect(Math.min(...anchors.map((door) => flatGap(door, doorway)))).toBeLessThanOrEqual(0.51);
      expect(actor.walkPath.total).toBeGreaterThanOrEqual(1.5);
    }
    // Follow until everyone has been in and back out; the longest first outing is
    // a tour of about 150 m.
    const states = follow(view, [...residents, ...workers], 600, {
      until: (states) => [...states.values()].every((state) => state.cameOut),
    });
    for (const [actor, { wentIn, cameOut, travel }] of states) {
      const label = `${era} ${actor.root.name || 'resident'} ${actor.seed}`;
      expect(travel, `${label} walks`).toBeGreaterThan(1);
      expect(wentIn, `${label} goes in`).toBeGreaterThan(0);
      expect(cameOut, `${label} comes back out`).toBeGreaterThan(0);
    }
  },
);

it('gives a newly added era the same doors', () => {
  const era = { ...ERAS.at(-1), id: 'test-door-era' };
  ERAS.push(era);
  ERA_BY_ID[era.id] = era;
  try {
    const { view } = village(era.id);
    const followed = view.actors.filter((actor) => actor.home || actor.workRoutine?.door);
    expect(followed).toHaveLength(8);
    for (const actor of followed) expect(doorOf(actor), actor.root.name).not.toBeNull();
    const states = follow(view, followed, 60);
    expect([...states.values()].some((state) => state.wentIn && state.cameOut)).toBe(true);
  } finally {
    ERAS.pop();
    delete ERA_BY_ID[era.id];
  }
});

it('keeps the street route for a household walker without a built home', () => {
  const { view } = village('frontier', ['well', 'farm']);
  const walker = view.actors.find((actor) => actor.seed === 1 && !actor.work);
  expect(walker.home).toBeNull();
  expect(walker.itinerary.door).toBe(false);
  expect(walker.itinerary.anchor).toEqual(walker.routePath.points[0]);
  let rested = false;
  follow(view, [walker], 300, {
    onFrame: () => {
      rested ||= walker.itinerary.phase === 'rest';
      expect(walker.root.visible).toBe(true);
      expect(walker.root.scale.x).toBe(1);
    },
  });
  expect(rested).toBe(true);
});

it('walks a resident to its new house and in through the new door', () => {
  const { view, town } = village('frontier', ['home', 'well', 'farm']);
  const walker = view.actors.find((actor) => actor.seed === 4 && !actor.work);
  expect(walker.home).toBe('home');
  follow(view, [walker], 40);
  const moved = { ...town, buildings: { ...town.buildings, home2: 3 } };
  view.update(moved, labels);
  expect(view.actors).toContain(walker);
  expect(walker.home).toBe('home2');
  const door = view.itineraries.endpoint('home2', true);
  expect(walker.itinerary.anchor).toEqual(door);
  const states = follow(view, [walker], 300, {
    onFrame: () => {
      if (walker.root.scale.x < 1) expect(doorGap(walker, door)).toBeLessThan(DOORSTEP);
    },
  });
  expect(states.get(walker).wentIn).toBeGreaterThan(0);
});

it('keeps a resident indoors through a rebuild and lets it out at its door', () => {
  const { view, town } = village('frontier');
  const residents = view.actors.filter((actor) => actor.home);
  const resting = () =>
    residents.find((actor) => !actor.root.visible && actor.itinerary.phase === 'rest');
  follow(view, residents, 300, { until: resting });
  const inside = resting();
  expect(inside).toBeDefined();
  const door = inside.itinerary.anchor;
  const position = inside.root.position.clone();
  view.update(town, labels);
  expect(view.actors).toContain(inside);
  expect(inside.itinerary.inside).toBe(true);
  expect(inside.root.visible).toBe(false);
  expect(inside.root.position.distanceTo(position)).toBeLessThan(1e-6);
  const states = follow(view, [inside], 30, {
    onFrame: () => {
      if (inside.root.scale.x < 1) expect(doorGap(inside, door)).toBeLessThan(DOORSTEP);
    },
  });
  expect(states.get(inside).cameOut).toBeGreaterThan(0);
});

it('never leaves a worker shrunken when its break moves outdoors', () => {
  const actor = { root: new Group(), seed: 2, radius: 0.29, work: 'farm' };
  const indoors = walkPath([
    [0, 0.07, 0],
    [2, 0.07, 0],
  ]);
  indoors.door = true;
  setWorkRoutine(actor, indoors, { work: 1, rest: 5, atWork: true });
  actor.routeProgress = 0;
  Object.assign(actor.workRoutine, { phase: 'return', since: 0 });
  updateWorkRoutine(actor, 1);
  expect(actor.workRoutine.phase).toBe('rest');
  updateWorkRoutine(actor, 2);
  expect(actor.root.visible).toBe(false);
  updateWorkPaths(
    actor,
    walkPath([
      [0, 0.07, 0],
      [0, 0.07, 2],
    ]),
  );
  expect(actor.workRoutine.door).toBe(false);
  expect(actor.root.visible).toBe(true);
  expect(actor.root.scale.x).toBe(1);
});
