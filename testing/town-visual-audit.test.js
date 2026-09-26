import { vi as testTiming } from 'vitest';
// Full geometry galleries and long cosmetic simulations may exceed the default 5s on CI.
testTiming.setConfig({ testTimeout: 20000 });
import { updateTownLocomotion, vehicleDistance } from '../src/game/town/TownLocomotion';
import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { Group, Scene, MeshBasicMaterial, Vector3, Box3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import catalog from '../src/data/cityBuildingStyles.json';
import { cityAppearance } from '../src/data/cityAppearance';
import assets from '../src/assets/city-meshes.json';
import { renderCityBuilding } from '../src/game/town/buildings/city';
import { renderMotorLandmark } from '../src/game/town/buildings/motorAge';
import { renderBuilding, renderModernization } from '../src/game/town/buildings/BuildingRenderer';
import { addTownVisitors } from '../src/game/town/TownActivity';
import { addMotorActivity } from '../src/game/town/TownMotorActivity';
import { placeTownSpawns } from '../src/game/town/TownTraffic';
import { TownEraIncident, INCIDENT_DURATION } from '../src/game/town/TownEraIncident';
import { PLOTS, LANE_X } from '../src/game/town/TownLayout';
import { TownBuildSequence } from '../src/game/town/TownBuildSequence';
import { TownConstruction, constructionParts } from '../src/game/town/TownConstruction';
import { villagerIdentity, vipVisitor } from '../src/data/villagers';
import { airplanePose } from '../src/game/town/TownAviation';

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
    sign: () => {},
  });
  d.scene.add(d.world);
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
  delete ERA_BY_ID['audit-future'];
});
const signature = (root) => {
  root.updateMatrixWorld(true);
  const hash = createHash('sha256');
  root.traverse((o) => {
    if (o.isMesh) {
      hash.update(
        JSON.stringify([
          Array.from(o.geometry.attributes.position.array),
          o.matrixWorld.elements,
          o.material.color.getHex(),
        ]),
      );
    }
  });
  return hash.digest('hex');
};

it('gives different building kinds distinct city meshes and preserves each paid stage', () => {
  const d = fixture();
  for (const era of ['post-war', 'aviation', 'broadcast', 'contemporary']) {
    const seen = new Map();
    for (const kind of Object.keys(catalog)) {
      const tiers = new Set();
      for (const level of [1, 2, 3]) {
        const root = new Group();
        root.position.set(...[PLOTS[kind]?.[0] ?? 0, 0, PLOTS[kind]?.[1] ?? 0]);
        expect(renderCityBuilding(d, root, kind, kind, level, era, 3)).toBe(true);
        // Compare architecture in local coordinates, independent of plot location.
        root.position.set(0, 0, 0);
        const value = signature(root);
        expect(tiers.has(value), `${era} ${kind} ${level}`).toBe(false);
        tiers.add(value);
        if (level === 1) {
          expect(seen.get(value), `${era} ${kind} duplicates ${seen.get(value)}`).toBeUndefined();
          seen.set(value, kind);
        }
        expect(root.getObjectByName('Blender skyline'), kind).toBeUndefined();
      }
    }
  }
});
it('inherits per-kind architecture and falls back for incomplete appearance definitions', () => {
  ERA_BY_ID['audit-future'] = { evolution: { ...eraEvolution('broadcast') } };
  expect(cityAppearance('audit-future', 'school').asset).toBe('broadcast-kind-school');
  ERA_BY_ID['audit-future'].evolution.cityAssets = 'missing';
  expect(cityAppearance('audit-future', 'school').asset).toBe('post-war-kind-school');
  expect(cityAppearance('audit-future', 'unsupported')).toBe(cityAppearance('post-war'));
});
it('Motor Age never restores industrial shells, and the horse field changes at every paid level', () => {
  const d = fixture();
  for (const kind of Object.keys(catalog).filter(
    (k) => !['garage', 'busDepot', 'diner', 'gardenCourt'].includes(k),
  )) {
    const root = new Group();
    renderMotorLandmark(d, root, kind, kind, 3);
    expect(root.userData.baseStyle, kind).toBe('post-war');
  }
  const tiers = [1, 2, 3].map((level) => {
    const root = new Group();
    renderMotorLandmark(d, root, 'horseField', 'Horses', level);
    return signature(root);
  });
  expect(new Set(tiers).size).toBe(3);
});
it('borrowed River & Rail shells retain their own sign and omit the source props', () => {
  const d = fixture();
  const labels = [];
  d.sign = (_, label) => labels.push(label);
  for (const kind of ['post', 'railDepot', 'hotel', 'market', 'warehouse', 'riverPort']) {
    const b = BUILDINGS.find((b) => b.kind === kind);
    const root = new Group();
    labels.length = 0;
    renderBuilding({ town: d, parent: root, kind, level: 3, label: b.name });
    renderModernization(d, root, kind, 'river-rail', 3);
    expect(labels.at(-1), kind).toBe(b.name);
  }
});
it('keeps a complete visitor cycle moving with bounded crowd yielding', () => {
  for (const era of ['frontier', 'motor-age']) {
    const d = fixture();
    d.town.era = era;
    Object.assign(d.town.buildings, {
      home: 3,
      farm: 3,
      well: 3,
      stable: 3,
      saloon: 3,
      garage: 1,
      busDepot: 1,
      bridge: 3,
    });
    for (const id of Object.keys(d.town.buildings)) {
      d.town.buildingEras[id] = era;
      d.town.buildingEraLevels[id] = 3;
    }
    addTownVisitors(d, d.town);
    addMotorActivity(d, d.town);
    for (const [seed, x] of [
      [1, -LANE_X],
      [9, LANE_X],
    ])
      d.person({
        color: '#738a83',
        skin: '#d5ad88',
        hat: '#b38d59',
        seed,
        route: [
          [x, -8.5],
          [x, 15.5],
        ],
      });
    for (let time = 0; time < 60; time += 1 / 60) {
      d.actors.forEach((a) => d.animatePerson(a, time));
      d.motions.forEach((f) => f(time));
      updateTownLocomotion(d);
      const actors = d.actors.filter((a) => a.root.visible && a.root.scale.x > 0.5);
      actors.forEach((actor, i) => {
        for (const other of actors.slice(0, i)) {
          if (actor.root.position.distanceTo(other.root.position) < 0.54)
            expect(actor.motion.passingThrough || other.motion.passingThrough).toBe(true);
        }
        for (const vehicle of d.trafficActors ?? []) {
          if (!vehicle.visible) continue;
          const box = vehicle.userData.locomotionBox;
          if (vehicleDistance(box, actor.root.position.x, actor.root.position.z) < 0.29)
            expect(
              actor.motion.passingThrough || box.passingThrough,
              `${era} t=${time} person=${actor.root.position.toArray()} vehicle=${vehicle.name}:${vehicle.position.toArray()}`,
            ).toBe(true);
          expect(box.dynamicAttempts ?? 0).toBeLessThanOrEqual(3);
        }
        expect(actor.motion.dynamicAttempts ?? 0).toBeLessThanOrEqual(3);
      });
    }
    for (const actor of d.actors.filter((a) => !a.work))
      expect(actor.acceptedDistance).toBeGreaterThan(5);
  }
});
it.each(['cargo-theft', 'storm-cleanup', 'workshop-fire'])(
  'caps actual %s movement even across distant plots',
  (kind) => {
    const d = fixture();
    d.town.era = 'contemporary';
    Object.assign(d.town.buildings, { bridge: 3, fireStation: 3 });
    const event = { kind, targets: ['riverPark'], loss: 0 };
    const scene = new TownEraIncident(
      d,
      event,
      PLOTS,
      () => {},
      () => {},
    );
    const actors = [...scene.thieves, ...scene.crew, ...(scene.vehicle ? [scene.vehicle] : [])];
    const previous = new Map();
    for (let time = 0; time < INCIDENT_DURATION - 0.05; time += 1 / 60) {
      scene.update(time);
      for (const actor of actors) {
        const before = previous.get(actor);
        if (actor.root.visible && before?.visible)
          expect(
            actor.root.position.distanceTo(before.p) * 60,
            `${kind} ${time}`,
          ).toBeLessThanOrEqual(actor === scene.vehicle ? 6.01 : 3.01);
        previous.set(actor, { p: actor.root.position.clone(), visible: actor.root.visible });
      }
    }
    scene.dispose();
  },
);
it('keeps the hammer handle passing through the palm and the head clear during every swing', () => {
  const d = fixture(),
    root = new Group(),
    building = new Group();
  d.scene.add(root);
  root.add(building);
  const sequence = new TownBuildSequence(d, root, building, {
    era: 'industrial',
    start: 6,
    end: 16,
    leave: 18,
    stations: [[0, 0]],
    focus: [0, -2],
  });
  for (let time = 6; time < 16; time += 0.1) {
    sequence.frame(time);
    const { worker, hammer } = sequence.crew[0];
    expect(hammer.parent).toBe(worker.arms[1].lower);
    expect(hammer.position.toArray()).toEqual([0, -0.19, 0]);
    const handle = hammer.getObjectByName('Hammer handle'),
      head = hammer.getObjectByName('Hammer head');
    expect(handle.position.z - handle.scale.z / 2).toBeLessThan(0);
    expect(handle.position.z + handle.scale.z / 2).toBeGreaterThan(0);
    expect(
      head.getWorldPosition(new Vector3()).distanceTo(hammer.getWorldPosition(new Vector3())),
    ).toBeCloseTo(0.27, 4);
  }
  sequence.dispose();
  d.clearGroup(root);
});
it('leaves existing walls still during an upgrade reveal', () => {
  const d = fixture(),
    root = new Group();
  d.world.add(root);
  const wall = d.box(root, 2, 2, 2, 0, 1, 0, '#ddd1ae');
  const before = constructionParts(root);
  const wing = d.box(root, 1, 1, 1, 2, 0.5, 0, '#ddd1ae');
  const reveal = new TownConstruction(d, root, null, before);
  expect(reveal.pieces.map((p) => p.object)).toEqual([wing]);
  expect(wall.position.y).toBe(1);
  expect(wall.visible).toBe(true);
  reveal.finish();
});
it('honors testers only as occasional VIP visitors after visitor capacity exists', () => {
  const d = fixture();
  Object.assign(d.town.buildings, { home: 1, well: 3, farm: 3, saloon: 1 });
  addTownVisitors(d, d.town);
  expect(d.actors).toHaveLength(0);
  d.town.buildings.stable = 1;
  addTownVisitors(d, d.town);
  expect(d.actors.length).toBeGreaterThan(0);
  const resident = d.person({
    seed: 0,
    color: '#777777',
    skin: '#d5ad88',
    hat: '#b38d59',
    route: [
      [0, 0],
      [0, 2],
    ],
  });
  expect(resident.root.userData.villager.name).toBeNull();
  const visitor = d.actors.find((a) => a.visitor && a.seed === 0);
  const visits = Array.from({ length: 100 }, (_, i) => i);
  for (const gender of ['male', 'female']) {
    const visit = visits.find((i) => vipVisitor(0, i)?.gender === gender);
    expect(visit).toBeDefined();
    d.animatePerson(visitor, visit * (visitor.duration + 7) + 1);
    expect(visitor.root.userData.villager).toEqual(vipVisitor(0, visit));
    expect(visitor.vip.visible).toBe(true);
    expect(visitor.appearance.hair.visible).toBe(gender === 'female');
  }
  const ordinary = visits.find((i) => !vipVisitor(0, i));
  d.animatePerson(visitor, ordinary * (visitor.duration + 7) + 1);
  expect(visitor.root.userData.villager.name).toBeNull();
  expect(visitor.vip.visible).toBe(false);
  expect(vipVisitor(0, 0, { male: [] })).toBeNull();
  const male = new Group(),
    female = new Group();
  const m = d.person({
    parent: male,
    manual: true,
    gender: 'male',
    seed: 0,
    color: '#777777',
    skin: '#d5ad88',
    hat: '#b38d59',
    route: [
      [0, 0],
      [0, 1],
    ],
  });
  const f = d.person({
    parent: female,
    manual: true,
    gender: 'female',
    seed: 0,
    color: '#777777',
    skin: '#d5ad88',
    hat: '#b38d59',
    route: [
      [0, 0],
      [0, 1],
    ],
  });
  expect(signature(m.root)).not.toBe(signature(f.root));
  expect(f.root.userData.villager.name).toBeNull();
});
it('fades aircraft to zero before hiding and uses distinct exported jet silhouettes', () => {
  expect(airplanePose(69.999).opacity).toBeLessThan(0.001);
  expect(airplanePose(135).opacity).toBe(0);
  expect(assets.models['airplane-jet']).toBeDefined();
  expect(assets.models['airplane-regional-jet']).toBeDefined();
  expect(assets.models['airplane-jet']).not.toEqual(assets.models['airplane-regional-jet']);
});

it('selects VIP names uniformly across the combined pool before deriving gender', () => {
  const pools = { male: ['Alex'], female: ['Bea', 'Cara', 'Dee'] },
    counts = { Alex: 0, Bea: 0, Cara: 0, Dee: 0 };
  for (let visit = 0; visit < 12000; visit++) {
    const selected = vipVisitor(4, visit, pools);
    if (!selected) continue;
    counts[selected.name]++;
    expect(pools[selected.gender]).toContain(selected.name);
  }
  for (const count of Object.values(counts)) expect(count).toBeGreaterThan(600);
  expect(Math.max(...Object.values(counts)) / Math.min(...Object.values(counts))).toBeLessThan(1.2);
});
