import { afterEach, expect, it } from 'vitest';
import { MeshBasicMaterial, Scene, Vector3 } from 'three';
import { BUILDINGS, createTown } from '../src/data/town';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownActors } from '../src/game/town/TownActors';
import { TownStatics } from '../src/game/town/TownStatics';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';
import { eraIndex, finishEra, modernizesInEra } from '../src/game/town/TownEras';
import { PLOTS } from '../src/game/town/TownLayout';
import { TownNavigation, walkPose } from '../src/game/town/TownNavigation';
import { updateTownLocomotion } from '../src/game/town/TownLocomotion';
import { populateLife } from '../src/game/town/TownPopulation';
import { purchase, upgradeOffer } from '../src/game/town/TownRules';

// Golden input from production 823e971: conservative X/Z envelopes of each
// plot's actual modernized stage3/finish1 solids at pedestrian body height.
// Keeping these small bounds in the test prevents regenerated catalogs from
// silently changing the old accepted-position fixture. They are not new model
// dimensions. A point clear of these envelopes was also clear of the old hulls.
const legacyBounds = {
  'river-rail': [
    [-0.91, 1.175, 0.335, 0.125],
    [-0.91, 1.245, 0.14, 0.11413],
    [-0.7, 1.245, 0.14, 0.11413],
    [0.91, 1.175, 0.335, 0.125],
    [0.7, 1.245, 0.14, 0.11413],
    [0.91, 1.245, 0.14, 0.11413],
    [1.53, 0.035, 0.11413, 0.14],
    [1.53, -0.175, 0.11413, 0.14],
    [1.53, -0.385, 0.11413, 0.14],
    [-1.3, 1.275, 0.32, 0.25679],
    [1.3, 1.275, 0.32, 0.25679],
    [1.8, 1.425, 0.45, 0.05],
    [0, 1.625, 1.625, 0.475],
    [0, -0.175, 1.6, 1.35],
  ],
  tomorrow: [
    [0, -0.1, 1.272, 1.20974],
    [0, 1.15, 0.9, 0.45],
  ],
  riverlight: [
    [0, -2.0625, 1.4, 1.4],
    [0, -0.74375, 0.34375, 0.0875],
    [0.1925, -0.6375, 0.04375, 0.04161],
    [-2.625, 0, 1.3375, 1.3375],
    [-2.625, 1.25625, 0.34375, 0.0875],
    [-2.4325, 1.3625, 0.04375, 0.04161],
    [0, 2.875, 1.3125, 0.0625],
  ],
  moonward: [
    [0, -2.3125, 1.4625, 1.65],
    [0, -0.425, 1.12875, 0.3875],
    [-2.625, -0.375, 1.3375, 1.775],
    [-2.625, 1.6375, 1.02125, 0.3875],
    [2.625, -0.375, 1.3375, 1.775],
    [2.625, 1.6375, 1.02125, 0.3875],
    [0, 1.375, 0.85065, 0.85065],
    [0, 2.875, 1.3125, 0.0625],
  ],
};
const cases = [
  ['river-rail', 'school'],
  ['tomorrow', 'home'],
  ['riverlight', 'orchardCottages'],
  ['moonward', 'orchardCottages'],
];
const views = [];
const labels = Object.fromEntries(BUILDINGS.map((building) => [building.id, building.shortName]));
labels.mine = 'Mine';

function fixture(era) {
  const view = Object.create(TownDiorama.prototype);
  Object.assign(view, {
    scene: new Scene(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    elapsed: 0,
    controls: {},
    renderer: { shadowMap: {} },
    frameCache: { valid: false },
    render: () => {},
  });
  view.actorRenderer = new TownActors(view.scene);
  view.buildingRenderer = new TownStatics(view.scene);
  view.upgradeGlow = new TownUpgradeGlow(view.scene);
  const town = createTown();
  town.era = era;
  town.coins = 1000000;
  for (const building of BUILDINGS) {
    if (eraIndex(building.introducedEra) > eraIndex(era)) continue;
    town.buildings[building.id] = building.upgrades.length;
    town.buildingEras[building.id] = finishEra(building.id, era);
    town.buildingEraLevels[building.id] =
      building.introducedEra === era || !modernizesInEra(era, building.id) ? 3 : 1;
  }
  views.push(view);
  view.update(town, labels);
  updateTownLocomotion(view);
  return { view, town };
}

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

function legacyNavigation(view, era, id) {
  const [x, z] = PLOTS[id];
  const entries = legacyBounds[era].map(([cx, cz, halfW, halfD]) => ({
    owner: `plot:${id}`,
    activation: 'completed',
    x: x + cx,
    z: z + cz,
    y: 0.08,
    height: 1.65,
    radius: Math.hypot(halfW, halfD),
    polygon: [
      [cx - halfW, cz - halfD],
      [cx + halfW, cz - halfD],
      [cx + halfW, cz + halfD],
      [cx - halfW, cz + halfD],
    ].map(([px, pz]) => [x + px, z + pz]),
  }));
  return new TownNavigation([
    ...view.navigation.obstacles.filter((entry) => entry.owner !== `plot:${id}`),
    ...entries,
  ]);
}

function newlyOccupiedPoint(view, legacy, id, radius, avoid = []) {
  for (const solid of view.navigation.obstacles.filter(
    (entry) => entry.owner === `plot:${id}` && entry.y < 1.72 && entry.y + entry.height > 0.15,
  )) {
    const xs = solid.polygon?.map(([x]) => x) ?? [solid.x - solid.radius, solid.x + solid.radius];
    const zs = solid.polygon?.map(([, z]) => z) ?? [solid.z - solid.radius, solid.z + solid.radius];
    for (let x = Math.min(...xs); x <= Math.max(...xs) + 0.001; x += 0.2)
      for (let z = Math.min(...zs); z <= Math.max(...zs) + 0.001; z += 0.2) {
        const point = [x, 0.07, z];
        if (
          legacy.clear(point, radius) &&
          !view.navigation.clear(point, radius) &&
          avoid.every((other) => Math.hypot(point[0] - other[0], point[2] - other[2]) > 0.65)
        )
          return point;
      }
  }
  return null;
}

function acceptedPosition(actor, point) {
  actor.root.position.fromArray(point);
  Object.assign(actor.motion, {
    x: point[0],
    z: point[2],
    sx: point[0],
    sz: point[2],
    vx: 0,
    vz: 0,
  });
}

function expectDoorReachable(view, id) {
  const anchors = view.plotCache.get(id).group.userData.navigationAnchors?.door;
  // Use the real authored ground-level arrival, including the early civic
  // porch's step foot; a higher clear point inside a plinth is not an entrance.
  expect(anchors?.length, `${id} authored entrance available`).toBeGreaterThan(0);
  const target = view.itineraries.endpoint(id, true);
  expect(target, `${id} clear production entrance`).not.toBeNull();
  expect(anchors, `${id} authored entrance selected`).toContainEqual(target);
  expect(view.navigation.clear(target, 0.29), `${id} entrance clearance`).toBe(true);
  const from = view.itineraries.endpoint(id, false);
  const route = view.navigation.plan([from, target], 0.29);
  expect(route.total, `${id} road-to-door route`).toBeGreaterThan(0);
  expect(route.points.at(-1)).toEqual(target);
  for (let index = 1; index < route.points.length; index++)
    expect(
      view.navigation.segment(route.points[index - 1], route.points[index], 0.29),
      `${id} entry segment ${index}`,
    ).toBe(true);
}

it('keeps legacy animal safePoint arguments compatible with constrained retained-actor placement', () => {
  const nav = new TownNavigation([{ x: 0, z: 0, y: 0, height: 3, radius: 1 }]);
  const clear = [4, 0.07, 4];
  expect(nav.safePoint(clear, 0.55, 0.7, true)).toEqual(clear);
  const blocked = [0, 0.07, 0];
  expect(nav.safePoint(blocked, 0.45, 1.5)).toEqual(nav.safePoint(blocked, 0.45));
  const constrained = nav.safePoint(blocked, 0.45, (point) => point[0] < -1);
  expect(constrained).not.toBeNull();
  expect(constrained[0]).toBeLessThan(-1);
  expect(nav.clear(constrained, 0.45)).toBe(true);
});

it('revalidates retained transport VIP and live-visitor owners before their first rebuilt frame', () => {
  const { view, town } = fixture('tomorrow');
  view.setReducedMotion(true);
  view.setLiveVisitors(
    [{ id: 'retained-nav-visitor', name: 'Camille', townName: 'Silver Creek', era: 'tomorrow' }],
    'retained-nav-town',
  );
  const vip =
    view.vipArrivals.actors.find((actor) => actor.source === 'railDepot') ??
    view.vipArrivals.actors[0];
  const live = view.liveVisitors.actors[0];
  expect(vip).toBeDefined();
  expect(live).toBeDefined();
  vip.started = view.elapsed;
  vip.root.visible = live.root.visible = true;
  vip.root.scale.setScalar(1);
  live.root.scale.setScalar(1);
  updateTownLocomotion(view);
  const current = view.navigation,
    legacy = legacyNavigation(view, 'tomorrow', 'home');
  const visitors = [vip, live],
    blocked = [];
  for (const actor of visitors) {
    expect(actor.motion).toBeDefined();
    const point = newlyOccupiedPoint(view, legacy, 'home', actor.motion.radius, blocked);
    expect(point, 'actual baseline-clear/newly-retained wing position').not.toBeNull();
    blocked.push(point);
  }
  const destination = view.itineraries.endpoint('home', false);
  expect(current.clear(destination, 0.29)).toBe(true);
  const states = visitors.map((actor, index) => {
    acceptedPosition(actor, blocked[index]);
    actor.motion.exitTarget = destination;
    return {
      identity: actor.root.userData.villager,
      itinerary: actor.itinerary,
      phase: actor.itinerary?.phase,
      pendingStops: actor.itinerary?.stops,
      walkPath: actor.walkPath,
      started: actor.started,
      arrivedAt: actor.arrivedAt,
      acceptedDistance: actor.acceptedDistance,
    };
  });
  view.navigation = legacy;
  // Stop at the real first static frame. Deferred population must not conceal
  // an invalid accepted position by sampling a newly planned visitor route.
  view.deferLife = true;
  const frames = [];
  view.render = () =>
    frames.push(
      visitors.map((actor) => ({
        attached: actor.root.parent === view.world,
        clear: view.navigation.clear(actor.root.position.toArray(), actor.motion.radius),
        position: actor.root.position.clone(),
      })),
    );
  view.update(town, labels);
  expect(frames.length).toBeGreaterThan(0);
  for (const [index, actor] of visitors.entries()) {
    expect(frames[0][index].attached).toBe(true);
    expect(frames[0][index].clear).toBe(true);
    expect(actor.root.position.distanceTo(new Vector3().fromArray(blocked[index]))).toBeLessThan(3);
    expect(actor.root.position.x).toBeLessThan(0); // stays in the home parcel's bank
    expect(actor.motion.x).toBe(actor.root.position.x);
    expect(actor.motion.z).toBe(actor.root.position.z);
    expect(actor.motion.exitTarget).toBe(destination);
    expect(actor.motion.path).toBeNull();
    expect(actor.root.userData.villager).toBe(states[index].identity);
    expect(actor.itinerary).toBe(states[index].itinerary);
    expect(actor.itinerary?.phase).toBe(states[index].phase);
    expect(actor.itinerary?.stops).toBe(states[index].pendingStops);
    expect(actor.walkPath).toBe(states[index].walkPath);
    expect(actor.started).toBe(states[index].started);
    expect(actor.arrivedAt).toBe(states[index].arrivedAt);
    expect(actor.acceptedDistance).toBe(states[index].acceptedDistance);
  }
  const positions = visitors.map((actor) => actor.root.position.clone());
  view.update(town, labels);
  visitors.forEach((actor, index) => expect(actor.root.position).toEqual(positions[index]));
  expect(view.vipArrivals.actors).toContain(vip);
  expect(view.liveVisitors.actors).toContain(live);

  // Resume the actual population lifecycle, including both visitor owners'
  // attach/update calls and their immediate render before a locomotion step.
  // The corrected position can be off the replacement route; its nearest pose
  // must not briefly become the actor's accepted position.
  view.reducedMotion = false;
  const resumedFrame = frames.length;
  for (const step of populateLife(view, town)) void step;
  let offRoute = false;
  for (const [index, actor] of visitors.entries()) {
    const pose = walkPose(actor.walkPath, actor.motion.routeDistance / actor.walkPath.total);
    offRoute ||= Math.hypot(pose.x - positions[index].x, pose.z - positions[index].z) > 0.05;
    expect(actor.root.position.x).toBe(positions[index].x);
    expect(actor.root.position.z).toBe(positions[index].z);
    expect(actor.motion.exitTarget).toBe(destination);
    expect(actor.acceptedDistance).toBe(states[index].acceptedDistance);
  }
  expect(offRoute, 'fixture exercises a corrected point away from its route sample').toBe(true);
  expect(frames.length).toBeGreaterThan(resumedFrame);
  for (const frame of frames.slice(resumedFrame))
    for (const [index, sample] of frame.entries()) {
      expect(sample.clear).toBe(true);
      expect(sample.position.x).toBe(positions[index].x);
      expect(sample.position.z).toBe(positions[index].z);
    }
  updateTownLocomotion(view);
  for (const [index, actor] of visitors.entries()) {
    expect(view.navigation.clear(actor.root.position.toArray(), actor.motion.radius)).toBe(true);
    expect(
      Math.hypot(
        actor.root.position.x - positions[index].x,
        actor.root.position.z - positions[index].z,
      ),
    ).toBeLessThanOrEqual(actor.motion.maxSpeed / 60 + 0.00001);
  }
  view.disposed = true; // Cancel the deferred after-paint population callbacks.
}, 60000);

it.each(cases)(
  'revalidates accepted resident/worker positions once after a complete %s first-finish rebuild',
  (era, id) => {
    const { view, town } = fixture(era);
    const current = view.navigation;
    const legacy = legacyNavigation(view, era, id);
    const resident = view.actors.find(
      (actor) => actor.persistentKey && !actor.work && !actor.visitor && actor.motion,
    );
    const worker = view.actors.find(
      (actor) => actor.persistentKey && actor.workRoutine && actor.motion,
    );
    const valid = view.actors.find(
      (actor) =>
        actor !== resident &&
        actor !== worker &&
        actor.persistentKey &&
        actor.motion &&
        current.clear(actor.root.position.toArray(), actor.motion.radius),
    );
    expect(resident).toBeDefined();
    expect(worker).toBeDefined();
    expect(valid).toBeDefined();
    const blocked = [resident, worker].map((actor) =>
      newlyOccupiedPoint(view, legacy, id, actor.motion.radius),
    );
    for (const point of blocked)
      expect(point, `${era}/${id}: real baseline-clear/new-solid position`).not.toBeNull();
    const identity = resident.root.userData.villager;
    const itinerary = resident.itinerary;
    const accepted = resident.acceptedDistance;
    const stationary = valid.root.position.clone();
    const nearest = blocked.map((point, index) =>
      current.safePoint(point, [resident, worker][index].motion.radius),
    );
    for (const point of nearest) expect(point).not.toBeNull();
    [resident, worker].forEach((actor, index) => acceptedPosition(actor, blocked[index]));
    view.navigation = legacy;
    for (const actor of [resident, worker])
      expect(legacy.clear(actor.root.position.toArray(), actor.motion.radius)).toBe(true);

    // Actors store accepted positions in runtime motion state, not town saves.
    // A same-era presentation rebuild models loading newly retained solids while
    // keeping this already accepted population and its pending work/itinerary.
    view.update(town, labels);
    for (const [index, actor] of [resident, worker].entries()) {
      expect(view.actors).toContain(actor);
      expect(view.navigation.clear(actor.root.position.toArray(), actor.motion.radius)).toBe(true);
      expect(actor.motion.x).toBe(actor.root.position.x);
      expect(actor.motion.z).toBe(actor.root.position.z);
      expect(actor.root.position.distanceTo(new Vector3().fromArray(nearest[index]))).toBeLessThan(
        0.001,
      );
    }
    expect(resident.root.userData.villager).toBe(identity);
    expect(resident.itinerary).toBe(itinerary);
    expect(resident.acceptedDistance).toBe(accepted);
    expect(valid.root.position).toEqual(stationary);
    expectDoorReachable(view, id);
    const relocated = [resident, worker].map((actor) => actor.root.position.clone());
    view.update(town, labels);
    [resident, worker].forEach((actor, index) =>
      expect(actor.root.position).toEqual(relocated[index]),
    );
    updateTownLocomotion(view);
    for (const [index, actor] of [resident, worker].entries()) {
      expect(view.navigation.clear(actor.root.position.toArray(), actor.motion.radius)).toBe(true);
      expect(actor.root.position.distanceTo(relocated[index])).toBeLessThanOrEqual(
        actor.motion.maxSpeed / 60 + 0.00001,
      );
    }
  },
  60000,
);

function geometryCounts(root) {
  const counts = new Map();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const key = `${mesh.geometry.uuid}:${mesh.material.uuid}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

it.each(cases)(
  'retains %s mature solids and usable door routes while its next finish is under construction',
  (era, id) => {
    const { view, town } = fixture(era);
    const completed = geometryCounts(view.plotCache.get(id).group);
    const offer = upgradeOffer(town, id);
    expect(offer?.type).toBe('modernization');
    expect(offer.reason).toBeFalsy();
    const next = purchase(town, id, offer.stage);
    expect(next.projects[id].type).toBe('modernization');
    view.update(next, labels);
    const site = view.plotCache.get(id).group;
    const during = geometryCounts(site);
    for (const [key, count] of completed)
      expect(during.get(key), `${era}/${id} retained completed geometry`).toBeGreaterThanOrEqual(
        count,
      );
    const footprints = view.navigation.obstacles.filter((entry) => entry.owner === `plot:${id}`);
    expect(footprints.length).toBeGreaterThan(0);
    expect(footprints.every((entry) => entry.activation === 'construction')).toBe(true);
    const legacy = legacyNavigation(view, era, id);
    expect(
      newlyOccupiedPoint(view, legacy, id, 0.29),
      `${era}/${id} retained solids stay in navigation during work`,
    ).not.toBeNull();
    expectDoorReachable(view, id);
    // Generic old-shell scaffolding remains cosmetic polish; this regression
    // promises retained solids/navigation and entry access, not module-only staging.
  },
  60000,
);
