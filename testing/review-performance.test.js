import { afterEach, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { createMeshCatalog, requiredFamilies } from '../src/game/town/assets/MeshCatalog';
import { BoardReadiness } from '../src/game/phaser/BoardReadiness';
import { retentionMode, demote, POLICY_VERSION } from '../src/game/phaser/boardRetention';
import {
  geometryFootprints,
  registerFootprints,
  sweptClear,
} from '../src/game/town/BuildingFootprints';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { footprintsFor } from '../src/game/town/FootprintCatalog';
import { TownNavigation, walkPath } from '../src/game/town/TownNavigation';
import {
  LocomotionGrid,
  stepLocomotion,
  vehicleDistance,
  updateTownLocomotion,
} from '../src/game/town/TownLocomotion';
import { createTown } from '../src/data/town';
import { triangleIndex, queryTriangles } from '../src/game/town/TriangleIndex';
import { applyRoadSetbacks, plotSetbacks } from '../src/game/town/BuildingSetbacks';

afterEach(() => vi.restoreAllMocks());
it('preserves empty corners and exported component gaps in merged geometry', () => {
  const root = new Group();
  const mesh = new Mesh(new BoxGeometry(4, 2, 0.2), new MeshStandardMaterial());
  mesh.rotation.y = Math.PI / 4;
  root.add(mesh);
  const rotated = geometryFootprints(root);
  expect(rotated[0].points).toHaveLength(4);
  const entries = registerFootprints(root, rotated);
  const nav = new TownNavigation(entries);
  expect(nav.clear([1.3, 0.1, 1.3], 0.1)).toBe(true);
  root.userData.exportFootprints = [
    { min: [-2, 0, -1], max: [-1, 2, 1] },
    { min: [1, 0, -1], max: [2, 2, 1] },
  ];
  const exported = geometryFootprints(root);
  expect(exported).toHaveLength(2);
  expect(new TownNavigation(registerFootprints(root, exported)).clear([0, 0.1, 0], 0.45)).toBe(
    true,
  );
  mesh.geometry.dispose();
  mesh.material.dispose();
});
it('keeps rotated geometry and its animated children inside shared sidewalk setbacks', () => {
  const root = new Group(),
    town = createTown();
  const mesh = new Mesh(new BoxGeometry(8, 1, 7), new MeshStandardMaterial());
  mesh.rotation.y = Math.PI / 3;
  mesh.position.y = 0.7;
  root.add(mesh);
  applyRoadSetbacks(root, 'horseField', town);
  const limits = plotSetbacks('horseField', town);
  const [solid] = geometryFootprints(root);
  expect(solid.cx - solid.halfW).toBeGreaterThanOrEqual(limits.minX - 1e-6);
  expect(solid.cx + solid.halfW).toBeLessThanOrEqual(limits.maxX + 1e-6);
  expect(solid.cz - solid.halfD).toBeGreaterThanOrEqual(limits.minZ - 1e-6);
  expect(solid.cz + solid.halfD).toBeLessThanOrEqual(limits.maxZ + 1e-6);
  expect(mesh.rotation.y).toBe(Math.PI / 3);
  mesh.geometry.dispose();
  mesh.material.dispose();
});
it('loads only required mesh families, shares work, retries failures and isolates cancellation', async () => {
  expect(requiredFamilies(createTown())).toEqual([]);
  expect(requiredFamilies({ ...createTown(), era: 'motor-age' })).toContain('post-war');
  let resolve;
  const loader = vi.fn(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const catalog = createMeshCatalog({ test: [loader] });
  const a = catalog.loadFamilies(['test'], { isCurrent: () => false });
  const b = catalog.loadFamilies(['test']);
  expect(loader).toHaveBeenCalledTimes(1);
  resolve({ default: { models: { house: [] } } });
  expect(await a).toBe(false);
  expect(await b).toBe(true);
  await catalog.loadFamilies(['test']);
  expect(loader).toHaveBeenCalledTimes(1);
  expect(catalog.resolveModel('test', 'house').status).toBe('ready');
  const retry = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ default: { models: {} } });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const recovering = createMeshCatalog({ test: [retry] });
  await recovering.loadFamilies(['test']);
  await recovering.loadFamilies(['test']);
  expect(retry).toHaveBeenCalledTimes(2);
  const town = createTown();
  town.era = 'contemporary';
  town.buildingEras.home = 'post-war';
  town.buildings.home = 1;
  expect(requiredFamilies(town)).toEqual(expect.arrayContaining(['contemporary', 'post-war']));
});
it('invalidates old renderer generations and cancels waits without replaying another session', async () => {
  const ready = new BoardReadiness(),
    animator = {};
  const waiting = ready.wait(3);
  const binding = ready.publish(3, animator);
  expect(await waiting).toBe(binding);
  expect(ready.current(binding, 3)).toBe(true);
  ready.invalidate();
  expect(ready.current(binding, 3)).toBe(false);
  const recovered = ready.wait(3);
  ready.publish(3, {});
  expect(await recovered).not.toBe(binding);
  const stale = ready.wait(4);
  ready.cancel();
  expect(await stale).toBeNull();
});
it('keeps retention opt-in after a policy reset and ignores intentional teardown', () => {
  let saved = null;
  const storage = {
    getItem: () => saved,
    setItem: (_, value) => {
      saved = value;
    },
  };
  expect(retentionMode({}, [], storage)).toBe('evict');
  const rules = [{ matches: (env) => env.validated }];
  expect(retentionMode({ validated: true }, rules, storage)).toBe('retain');
  demote('teardown', { storage, teardownInProgress: true });
  expect(saved).toBeNull();
  demote('unexpected-loss', { storage });
  expect(JSON.parse(saved).version).toBe(POLICY_VERSION);
  expect(retentionMode({ validated: true }, rules, storage)).toBe('evict');
  expect(
    retentionMode({}, [], {
      getItem: () => JSON.stringify({ version: POLICY_VERSION - 1, mode: 'retain' }),
    }),
  ).toBe('evict');
});
it('round-trips footprint coordinates and invalidates only intersecting routes', () => {
  const geometry = new BoxGeometry(2, 2, 1),
    material = new MeshStandardMaterial();
  const root = new Group();
  root.add(new Mesh(geometry, material));
  const local = geometryFootprints(root);
  root.position.set(10, 0.08, -4);
  root.rotation.y = Math.PI / 3;
  root.scale.setScalar(1.25);
  const entries = registerFootprints(root, local, { owner: 'plot:test' });
  expect(entries[0].y).toBeCloseTo(0.08 - 1.25);
  const center = root.localToWorld(new Vector3()).toArray();
  expect(
    sweptClear(entries[0], [center[0] - 3, 0.08, center[2]], [center[0] + 3, 0.08, center[2]], 0.3),
  ).toBe(false);
  const nav = new TownNavigation();
  const affected = nav.plan([
      [7, 0.07, -4],
      [13, 0.07, -4],
    ]),
    unrelated = nav.plan([
      [-12, 0.07, -4],
      [-8, 0.07, -4],
    ]);
  const changed = nav.replaceOwner('plot:test', entries);
  expect(changed).toContain(affected);
  expect(unrelated.invalidated).toBeUndefined();
  nav.replaceOwner('plot:test', [], 'removed');
  expect(nav.obstacles).toHaveLength(0);
  geometry.dispose();
  material.dispose();
});
it('builds a resumable packed triangle index and keeps geometry queries accurate', () => {
  const geometry = new BoxGeometry(2, 2, 2),
    material = new MeshStandardMaterial(),
    root = new Mesh(geometry, material);
  const builder = triangleIndex(root);
  let step;
  do {
    step = builder.next();
  } while (!step.done);
  const index = step.value;
  expect(index.vertices).toBeInstanceOf(Float32Array);
  expect(index.order).toBeInstanceOf(Uint32Array);
  let triangles = 0;
  queryTriangles(
    index,
    () => true,
    () => {
      triangles++;
      return false;
    },
  );
  expect(triangles).toBe(12);
  geometry.dispose();
  material.dispose();
});
function walker(id, x, z, targetX, targetZ, radius = 0.25) {
  return {
    id,
    y: 0.07,
    targetX,
    targetZ,
    motion: { x, z, vx: 0, vz: 0, routeDistance: 0, maxSpeed: 0.55, radius },
  };
}
it('bounds accepted movement and separation at crossings independently of array order for 60 seconds', () => {
  const run = (reverse) => {
    const agents = [
      walker('a', -2, 0, 2, 0),
      walker('b', 2, 0, -2, 0),
      walker('c', 0, -2, 0, 2, 0.18),
    ];
    const grid = new LocomotionGrid();
    for (let i = 0; i < 3600; i++) {
      const before = agents.map((a) => [a.motion.x, a.motion.z]);
      stepLocomotion(reverse ? [...agents].reverse() : agents, null, [], grid, 1 / 60);
      for (const [j, a] of agents.entries())
        expect(
          Math.hypot(a.motion.x - before[j][0], a.motion.z - before[j][1]),
        ).toBeLessThanOrEqual(a.motion.maxSpeed / 60 + 1e-8);
      for (let a = 0; a < agents.length; a++)
        for (let b = a + 1; b < agents.length; b++)
          expect(
            Math.hypot(
              agents[a].motion.x - agents[b].motion.x,
              agents[a].motion.z - agents[b].motion.z,
            ),
          ).toBeGreaterThanOrEqual(agents[a].motion.radius + agents[b].motion.radius + 0.04 - 1e-6);
    }
    for (const a of agents)
      expect(Math.hypot(a.motion.x - a.targetX, a.motion.z - a.targetZ)).toBeLessThan(0.1);
    return agents.map((a) => [a.motion.x, a.motion.z]);
  };
  expect(run(false)).toEqual(run(true));
});
it('uses narrow oriented vehicle boxes and holds a blocked route without snapping', () => {
  const bus = { cx: 0.25, cz: 0, heading: 0, halfWidth: 0.32, halfLength: 1.2 };
  expect(vehicleDistance(bus, 0.9, 0)).toBeGreaterThan(0.29);
  const a = walker('walker', 0, 0, 5, 0),
    grid = new LocomotionGrid();
  const obstacle = { x: 1, z: 0, y: 0, height: 2, radius: 0.3 };
  const nav = new TownNavigation([obstacle]);
  for (let i = 0; i < 300; i++) stepLocomotion([a], nav, [], grid);
  expect(a.motion.x).toBeLessThanOrEqual(0.45);
  expect(a.motion.state).toBe('waiting');
});

it.each([false, true])('clears traffic beside a blocked sidewalk (idle villager: %s)', (idle) => {
  const root = new Group(),
    vehicle = new Group();
  root.position.set(-0.2, 0.07, 0);
  vehicle.position.set(0, 0.07, -2);
  vehicle.userData.vehicleBox = { halfWidth: 0.4, halfLength: 0.8 };
  const actor = {
    root,
    work: idle ? 'greet' : undefined,
    walkPath: walkPath([
      [-0.2, 0.07, 0],
      [2, 0.07, 0],
    ]),
  };
  const d = {
    actors: [actor],
    trafficActors: [vehicle],
    navigation: new TownNavigation([{ x: -0.8, z: 0, y: 0, height: 2, radius: 0.3 }]),
  };
  updateTownLocomotion(d);
  let waited = false;
  for (let frame = 0; frame < 420; frame++) {
    const previous = root.position.clone(),
      proposedZ = vehicle.position.z + 1 / 60;
    vehicle.position.z = proposedZ;
    updateTownLocomotion(d);
    waited ||= vehicle.position.z < proposedZ;
    expect(root.position.distanceTo(previous)).toBeLessThanOrEqual(0.55 / 60 + 1e-6);
    expect(d.navigation.clear(root.position.toArray(), 0.29)).toBe(true);
    expect(
      vehicleDistance(vehicle.userData.locomotionBox, root.position.x, root.position.z),
    ).toBeGreaterThanOrEqual(0.33 - 1e-6);
  }
  expect(waited).toBe(true);
  expect(root.position.x).toBeGreaterThan(0.7);
  expect(vehicle.position.z).toBeGreaterThan(2);
});

it('does not cross through a vehicle when the nearer sidewalk is blocked', () => {
  const a = walker('animal', -0.64, 0, 1, 0, 0.18),
    grid = new LocomotionGrid();
  const wall = new TownNavigation([{ x: -1.02, z: 0, y: 0, height: 2, radius: 0.2 }]);
  const vehicle = { cx: 0, cz: 0, heading: 0, halfWidth: 0.4, halfLength: 0.8 };
  for (let frame = 0; frame < 120; frame++) {
    stepLocomotion([a], wall, [vehicle], grid);
    expect(vehicleDistance(vehicle, a.motion.x, a.motion.z)).toBeGreaterThanOrEqual(0.22 - 1e-6);
  }
  expect(a.motion.x).toBeLessThan(0);
});

it('waits for an accepted walk out before activating an occupied footprint', () => {
  const actor = { root: new Group(), seed: 1 };
  actor.root.position.set(0, 0.07, 0);
  const view = Object.create(TownDiorama.prototype);
  Object.assign(view, {
    scene: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    actors: [actor],
    navigation: new TownNavigation(),
    elapsed: 0,
  });
  const root = new Group();
  root.add(new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial()));
  const entries = registerFootprints(root, geometryFootprints(root)),
    pending = { id: 'home', entries };
  expect(view.plotVacant(pending)).toBe(false);
  expect(actor.root.position.toArray()).toEqual([0, 0.07, 0]);
  expect(view.constructionGate.visible).toBe(true);
  let cleared = false;
  for (let i = 0; i < 300; i++) {
    const before = actor.root.position.clone();
    updateTownLocomotion(view);
    view.elapsed += 1 / 60;
    expect(actor.root.position.distanceTo(before)).toBeLessThanOrEqual(0.55 / 60 + 1e-6);
    if (view.plotVacant(pending)) {
      cleared = true;
      break;
    }
  }
  expect(cleared).toBe(true);
  expect(view.constructionGate.visible).toBe(false);
  Object.values(view.geometries).forEach((g) => g.dispose());
  view.materials.forEach((m) => m.dispose());
  root.children[0].geometry.dispose();
  root.children[0].material.dispose();
});
it('holds an unreachable path at its accepted position', () => {
  const root = new Group();
  root.position.set(11, 0.07, 9);
  const actor = { root, seed: 2, walkPath: walkPath([]) };
  const d = { actors: [actor], navigation: new TownNavigation() };
  for (let i = 0; i < 120; i++) updateTownLocomotion(d);
  expect(root.position.toArray()).toEqual([11, 0.07, 9]);
  expect(actor.motion.state).toBe('no-path');
});
it('uses a provisional footprint around the actual unsupported visual', () => {
  const root = new Group();
  root.add(new Mesh(new BoxGeometry(9, 4, 7), new MeshStandardMaterial()));
  const footprint = footprintsFor('unknown|home|future|3|3|native|none', root);
  expect(footprint.provisional).toBe(true);
  expect(footprint.solids[0]).toMatchObject({ halfW: 4.5, halfD: 3.5 });
  root.children[0].geometry.dispose();
  root.children[0].material.dispose();
});
