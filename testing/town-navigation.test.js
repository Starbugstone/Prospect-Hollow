import { addLeisureActivity } from '../src/game/town/TownLeisure';
import { afterEach, expect, it } from 'vitest';
import { Group, Scene, MeshBasicMaterial, Vector3 } from 'three';
import {
  TownNavigation,
  NPC_MARGIN,
  walkPose,
  walkObstacle,
  townNavigation,
} from '../src/game/town/TownNavigation';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { createTown } from '../src/data/town';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { addPowerGrid, addEraStreetscape } from '../src/game/town/TownEvolution';
import { addElectricLighting } from '../src/game/town/buildings/industrial';
import { TownVipArrivals } from '../src/game/town/TownVipArrivals';
import { TownBuildSequence } from '../src/game/town/TownBuildSequence';
import { TownRaid, addTownVisitors } from '../src/game/town/TownActivity';
import { TownEraIncident } from '../src/game/town/TownEraIncident';
import { prepareRoute } from '../src/game/town/TownRoutes';
import { placeTownSpawns } from '../src/game/town/TownTraffic';
import { PLOTS } from '../src/game/town/TownLayout';
const pole = (x, z, radius = 0.055) => ({ x, z, y: 0, height: 5, radius });
function clearance(path, obstacles, margin = NPC_MARGIN) {
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1],
      b = path.points[i];
    for (const o of obstacles) {
      if (Math.min(a[1], b[1]) > o.y + o.height + 0.1 || Math.max(a[1], b[1]) < o.y - 0.5) continue;
      const dx = b[0] - a[0],
        dz = b[2] - a[2];
      const t = Math.max(
        0,
        Math.min(1, ((o.x - a[0]) * dx + (o.z - a[2]) * dz) / (dx * dx + dz * dz || 1)),
      );
      expect(
        Math.hypot(a[0] + dx * t - o.x, a[2] + dz * t - o.z),
        `segment ${i} at ${o.x},${o.z}`,
      ).toBeGreaterThanOrEqual(o.radius + margin - 1e-5);
    }
  }
}
it('detours around a pole in both directions with a body gap along the entire segment', () => {
  const nav = new TownNavigation([pole(0, 0)]);
  for (const sign of [-1, 1]) {
    const points = [
      [-3 * sign, 0.07, 0],
      [0, 0.07, 0],
      [3 * sign, 0.07, 0],
    ];
    const path = nav.plan(points);
    expect(path.points[0]).toEqual(points[0]);
    expect(path.points.at(-1)).toEqual(points.at(-1));
    expect(path.total).toBeGreaterThan(6);
    expect(path.total).toBeLessThan(7);
    clearance(path, nav.obstacles);
    let previous = walkPose(path, 0);
    for (let i = 1; i <= 600; i++) {
      const p = walkPose(path, i / 600);
      expect(Math.hypot(p.x - previous.x, p.z - previous.z)).toBeLessThanOrEqual(
        path.total / 600 + 1e-6,
      );
      previous = p;
    }
  }
});
it('handles overlapping furniture and an occupied spawn without crossing a footprint', () => {
  const nav = new TownNavigation([pole(0, 0, 0.4), pole(0.6, 0.25, 0.4), pole(-0.6, -0.25, 0.4)]);
  const path = nav.plan([
    [-3, 0.07, 0],
    [3, 0.07, 0],
  ]);
  expect(path.points.at(-1)).toEqual([3, 0.07, 0]);
  clearance(path, nav.obstacles);
  const escape = nav.plan([
    [0, 0.07, 0],
    [3, 0.07, 0],
  ]);
  clearance(escape, nav.obstacles);
  expect(nav.clear(escape.points[0])).toBe(true);
});
it('indexes authored footprints through transforms and drops removed scenery on rebuild', () => {
  const world = new Group(),
    root = new Group();
  world.add(root);
  root.position.set(10, 0, 20);
  root.rotation.y = Math.PI / 2;
  root.scale.setScalar(2);
  walkObstacle(root, 1, 0, 0.1);
  const nav = townNavigation(world);
  expect(nav.obstacles[0].x).toBeCloseTo(10);
  expect(nav.obstacles[0].z).toBeCloseTo(18);
  expect(nav.obstacles[0].radius).toBe(0.2);
  root.removeFromParent();
  expect(townNavigation(world).obstacles).toHaveLength(0);
});
it('caches route variants and only plans again for a new layout', () => {
  const nav = new TownNavigation([pole(0, 0)]),
    route = prepareRoute([
      [-3, 0],
      [3, 0],
    ]);
  const path = nav.route(route);
  for (let i = 0; i < 1000; i++) {
    expect(nav.route(route)).toBe(path);
    walkPose(path, i / 999);
  }
  expect(nav.plans).toBe(1);
  const fresh = new TownNavigation([]);
  expect(fresh.route(route).total).toBeCloseTo(6);
  const high = nav.plan([
    [-3, 6, 0],
    [3, 6, 0],
  ]);
  expect(high.total).toBe(6);
});
const views = [];
function fixture(era = 'industrial') {
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
    school: 3,
    post: 3,
    park: 3,
    powerHouse: 3,
    railDepot: 3,
    riverPort: 3,
    airport: 3,
    bridge: 3,
  });
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
it.each([...ERAS.map((e) => e.id), 'unknown-navigation-era'])(
  'keeps residents and every VIP transport route clear in %s',
  (era) => {
    const d = fixture(era);
    addPowerGrid(d, d.town);
    addElectricLighting(d, d.town);
    addEraStreetscape(d, d.town);
    d.navigation = townNavigation(d.world);
    const grid = d.world.getObjectByName('Connected village power grid');
    expect(!!grid).toBe(eraEvolution(era).overheadPower && eraEvolution(era).electricity);
    d.vipArrivals = new TownVipArrivals(d, 16);
    d.vipArrivals.attach(d.town);
    addTownVisitors(d, d.town);
    for (const a of [...d.actors, ...d.vipArrivals.actors]) {
      if (!d.navigation.obstacles.length) continue;
      expect(a.walkPath).toBeDefined();
      clearance(a.walkPath, d.navigation.obstacles);
      expect(a.walkPath.points.at(-1)).toEqual(a.walkPath.points[0]);
      if (a.transportVisitor)
        expect(new Vector3(...a.walkPath.points[0]).distanceTo(a.door)).toBeLessThan(1.1);
      const planned = d.navigation.plans;
      for (let i = 0; i <= 200; i++) {
        d.animatePerson(a, (a.duration * i) / 200);
        expect(d.navigation.clear(a.root.position.toArray())).toBe(true);
      }
      expect(d.navigation.plans).toBe(planned);
    }
  },
);
it('keeps crowd and vehicle separation from pushing walkers into a pole', () => {
  const d = fixture();
  d.navigation = new TownNavigation([pole(0, 0)]);
  d.actors = [
    d.person({
      route: [
        [-3, 0],
        [3, 0],
      ],
      seed: 0,
    }),
    d.person({
      route: [
        [-3, 0],
        [3, 0],
      ],
      seed: 1,
    }),
  ];
  d.actors.forEach((a) => a.root.position.set(0.52, 0.07, 0));
  const vehicle = new Group();
  vehicle.position.set(1.3, 0.07, 0);
  d.trafficActors = [vehicle];
  placeTownSpawns(d);
  for (const a of d.actors) expect(d.navigation.clear(a.root.position.toArray())).toBe(true);
  expect(d.actors[0].root.position.distanceTo(d.actors[1].root.position)).toBeGreaterThanOrEqual(
    0.549,
  );
});
it('routes manual riders and responders around props, including offset paths', () => {
  const d = fixture();
  d.navigation = new TownNavigation([pole(0, 0)]);
  const root = new Group(),
    actor = { root };
  d.world.add(root);
  const route = prepareRoute([
    [-3, 0],
    [3, 0],
  ]);
  const raid = { d };
  const incident = { d, path: route };
  for (let i = 0; i <= 200; i++) {
    TownRaid.prototype.travel.call(raid, actor, route, (i / 200) * 7);
    expect(d.navigation.clear(root.position.toArray(), 0.8)).toBe(true);
    for (const offset of [-0.35, 0, 0.35]) {
      TownEraIncident.prototype.travel.call(incident, actor, i / 200, offset);
      expect(d.navigation.clear(root.position.toArray())).toBe(true);
    }
  }
  expect(d.navigation.plans).toBe(4);
});
it('routes construction workers around props in a translated scene in both directions', () => {
  const d = fixture(),
    root = new Group(),
    building = new Group();
  d.scene.add(root);
  root.position.x = 10;
  root.add(building);
  d.navigation = new TownNavigation([pole(9.8, 4)]);
  const sequence = new TownBuildSequence(d, root, building, {
    era: 'industrial',
    start: 6,
    end: 16,
    leave: 18,
    stations: [[0, 0]],
    focus: [0, -2],
  });
  const point = new Vector3();
  for (let t = 1; t < 22; t += 0.025) {
    sequence.frame(t);
    const worker = sequence.crew[0].worker;
    worker.root.getWorldPosition(point);
    expect(d.navigation.clear(point.toArray())).toBe(true);
  }
  expect(d.navigation.plans).toBe(1);
  sequence.dispose();
});

it('keeps responder speed bounded when a detour lengthens a timed incident route', () => {
  const d = fixture();
  d.navigation = new TownNavigation([pole(0, 0, 0.5)]);
  const actor = { root: new Group() };
  d.world.add(actor.root);
  const incident = {
    d,
    path: prepareRoute([
      [-3, 0],
      [3, 0],
    ]),
  };
  let previous;
  for (let i = 0; i <= 600; i++) {
    TownEraIncident.prototype.travel.call(incident, actor, i / 600);
    if (previous) expect(actor.root.position.distanceTo(previous)).toBeLessThanOrEqual(0.010001);
    previous = actor.root.position.clone();
  }
  expect(actor.root.position.x).toBeCloseTo(3);
});

it('keeps stationary workers outside a pole footprint', () => {
  const d = fixture();
  d.navigation = new TownNavigation([pole(0, 0)]);
  const worker = d.person({
    work: 'greet',
    seed: 0,
    route: [
      [0, 0],
      [0, 0.1],
    ],
  });
  for (let t = 0; t < 10; t += 0.1) {
    d.animatePerson(worker, t);
    expect(d.navigation.clear(worker.root.position.toArray())).toBe(true);
  }
});

it('inherits obstacle support from a new era definition without another era switch', () => {
  ERA_BY_ID['navigation-future'] = {
    id: 'navigation-future',
    evolution: { ...eraEvolution('industrial') },
  };
  try {
    const d = fixture('navigation-future');
    addPowerGrid(d, d.town);
    addEraStreetscape(d, d.town);
    d.navigation = townNavigation(d.world);
    expect(d.navigation.obstacles.length).toBeGreaterThan(0);
    const o = d.navigation.obstacles[0];
    const actor = d.person({
      route: [
        [o.x - 3, o.z],
        [o.x + 3, o.z],
      ],
      seed: 0,
    });
    clearance(actor.walkPath, d.navigation.obstacles);
  } finally {
    delete ERA_BY_ID['navigation-future'];
  }
});

it('retraces a blocked loop rather than jumping back across scenery', () => {
  const obstacles = Array.from({ length: 12 }, (_, i) =>
    pole(Math.cos((i * Math.PI) / 6) * 2, Math.sin((i * Math.PI) / 6) * 2, 0.6),
  );
  const nav = new TownNavigation(obstacles);
  const path = nav.plan([
    [-5, 0.07, 0],
    [-4, 0.07, 1],
    [0, 0.07, 0],
    [-5, 0.07, 0],
  ]);
  expect(path.points.at(-1)).toEqual(path.points[0]);
  expect(path.points).not.toContainEqual([0, 0.07, 0]);
  clearance(path, obstacles);
});

it('includes the park dog-walker and its leashed dog in cached avoidance', () => {
  const d = fixture();
  const [x, z] = PLOTS.park;
  d.navigation = new TownNavigation([pole(x, z + 3.8)]);
  addLeisureActivity(d, d.town);
  const visit = d.world.getObjectByName('Park dog walk');
  for (let t = 0; t <= 60; t += 0.1) {
    d.motions.forEach((m) => m(t));
    expect(d.navigation.clear(visit.position.toArray(), 1.2)).toBe(true);
  }
  expect(d.navigation.plans).toBe(1);
});
