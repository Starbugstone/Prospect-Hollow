import { afterEach, expect, it } from 'vitest';
import { Group, MeshBasicMaterial, Scene } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { createTown } from '../src/data/town';
import { ERAS, FRONTIER_ERA } from '../src/data/eras';
import { PLOTS, LANE_X } from '../src/game/town/TownLayout';
import {
  BRIDGE,
  crossesRiver,
  overWater,
  riverCenterX,
  streetHeight,
} from '../src/game/town/TownRiver';
import {
  routeDistanceAt,
  townNavigation,
  walkPath,
  walkPose,
} from '../src/game/town/TownNavigation';
import { geometryFootprints, registerFootprints } from '../src/game/town/BuildingFootprints';
import { TownItineraries } from '../src/game/town/TownItineraries';
import { repairRoute } from '../src/game/town/TownPlots';
import { updateTownLocomotion } from '../src/game/town/TownLocomotion';

// Returning from the mine can rebuild the village or swap a finished building in
// place. Either used to send a walker standing on the far bank straight back to
// its route, wading across the river beside the bridge.
const BRIDGE_ERAS = ERAS.filter(({ id }) => id !== FRONTIER_ERA).map(({ id }) => id);
const views = [];
function fixture(era) {
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
    sign: () => {},
  });
  d.scene.add(d.world);
  d.town.era = era;
  Object.assign(d.town.buildings, {
    home: 3,
    farm: 3,
    well: 3,
    stable: 3,
    saloon: 3,
    school: 3,
    bridge: 3,
    hotel: 1,
    home5: 1,
    market: 1,
  });
  d.town.buildingEras.bridge = era;
  d.town.buildingEraLevels.bridge = 3;
  const bridge = d.group(d.world, PLOTS.bridge[0], 0.08, PLOTS.bridge[1]);
  d.buildPlot('bridge', bridge, d.town, {});
  registerFootprints(bridge, geometryFootprints(bridge), { owner: 'plot:bridge' });
  d.navigation = townNavigation(d.world);
  d.itineraries = new TownItineraries(d);
  views.push(d);
  return d;
}
afterEach(() => {
  for (const d of views.splice(0)) {
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  }
});
const resident = (d) =>
  d.person({
    color: '#738a83',
    skin: '#d5ad88',
    hat: '#b38d59',
    route: [
      [-LANE_X, -8.5],
      [-LANE_X, -0.5],
      [-LANE_X, 7.5],
      [-LANE_X, 15.5],
    ],
    seed: 1,
  });
// Stand the walker on the east-bank sidewalk, as a rebuild retains it.
function standAt(actor, [x, y, z], routeDistance = 0) {
  actor.root.position.set(x, y, z);
  actor.motion = { x, z, vx: 0, vz: 0, routeDistance, radius: 0.29, maxSpeed: 0.55, heading: 0 };
}
const finish = (work) => {
  for (const _ of work) void _;
};
// Walk until the current journey ends, never standing in open water.
function walkHome(d, actor) {
  let frames = 0;
  for (; frames < 8000 && actor.itinerary.phase === 'finishing'; frames++) {
    d.elapsed += 0.1;
    d.animatePerson(actor, d.elapsed);
    updateTownLocomotion(d, 0.1);
    const { x, y, z } = actor.root.position;
    expect(overWater(x, y, z), `wading at ${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`).toBe(
      false,
    );
  }
  expect(actor.itinerary.phase).not.toBe('finishing');
  return frames;
}
const dryRoute = (points) => points.every((p, i) => !i || !crossesRiver(points[i - 1], p));

it('tells open water from the bridge deck and both banks', () => {
  const z = 16.55;
  expect(crossesRiver([24, 0.07, z], [39, 0.07, z])).toBe(true);
  expect(crossesRiver([19.05, 0.07, -8], [19.05, 0.07, 20])).toBe(false);
  expect(crossesRiver([39.05, 0.07, -0.5], [39.05, 0.07, 23.5])).toBe(false);
  const deck = Array.from({ length: 71 }, (_, i) => {
    const x = BRIDGE.westJunction + ((BRIDGE.eastJunction - BRIDGE.westJunction) * i) / 70;
    return [x, streetHeight(x, BRIDGE.z + 0.5), BRIDGE.z + 0.5];
  });
  expect(dryRoute(deck)).toBe(true);
  // The same line at street level runs under the deck, through the water.
  expect(dryRoute(deck.map(([x, , z]) => [x, 0.07, z]))).toBe(false);
  expect(overWater(riverCenterX(BRIDGE.z), 0.07, BRIDGE.z)).toBe(true);
});

it.each(BRIDGE_ERAS)('brings a %s resident left on the far bank home over the bridge', (era) => {
  const d = fixture(era);
  const actor = resident(d);
  const home = actor.walkPath;
  standAt(actor, [39.05, 0.07, 16.55]);
  // The nearest point of its own street lies straight across the river.
  const nearest = walkPose(home, routeDistanceAt(home, 39.05, 16.55) / home.total);
  expect(crossesRiver([39.05, 0.07, 16.55], [nearest.x, nearest.y, nearest.z])).toBe(true);
  // A rebuild re-creates the resident with its home route, then finishes that walk.
  finish(d.itineraries.prepare(actor));
  expect(actor.itinerary.phase).toBe('finishing');
  expect(actor.walkPath.points[0]).toEqual([39.05, 0.07, 16.55]);
  expect(actor.walkPath.points.at(-1)).toEqual(home.points.at(-1));
  expect(dryRoute(actor.walkPath.points)).toBe(true);
  expect(
    actor.walkPath.points.some(
      ([x, y, z]) => Math.abs(x - riverCenterX(z)) < 1 && Math.abs(z - BRIDGE.z) < 1 && y > 1,
    ),
  ).toBe(true);
  walkHome(d, actor);
  expect(actor.root.position.x).toBeLessThan(0);
});

it.each(BRIDGE_ERAS)('repairs a %s far-bank journey without a cut across the river', (era) => {
  const d = fixture(era);
  const actor = resident(d);
  const anchor = actor.walkPath.points[0];
  const out = d.itineraries.leg(anchor, d.itineraries.endpoint('home5'));
  expect(out?.total).toBeGreaterThan(20);
  const loop = d.navigation.track(
    walkPath([...out.points, ...out.points.slice(0, -1).reverse()]),
    0.29,
  );
  const plan = { path: loop, stops: [] };
  Object.assign(actor, { walkPath: loop, routeLimit: loop.total });
  actor.itinerary = { plans: [plan], anchor, visit: 0, current: 0, stops: [], path: loop };
  actor.itinerary.phase = 'walking';
  // Halfway along the east-bank street to the riverside home.
  const at = out.points.findLastIndex(([x]) => x > 39);
  standAt(actor, out.points[at], out.ends[at - 1]);
  actor.motion.path = loop;
  // A finished building now stands across its old-town sidewalk.
  const [x, , z] = out.points[2];
  d.navigation.replaceOwner('plot:test', [{ x, z, y: 0, height: 3, radius: 0.3 }]);
  finish(repairRoute(d, actor));
  expect(actor.itinerary.phase).toBe('finishing');
  expect(dryRoute(actor.walkPath.points)).toBe(true);
  walkHome(d, actor);
  expect(actor.root.position.x).toBeLessThan(0);
});
