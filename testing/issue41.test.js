import { expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { eraIndex, modernization, plotInEra } from '../src/game/town/TownEras';
import {
  normalizeTown,
  purchase,
  upgradeOffer,
  advanceConstruction,
  finishConstruction,
  foodCapacity,
  waterCapacity,
} from '../src/game/town/TownRules';
import {
  PLOTS,
  AIRPORT,
  RAIL_EDGE,
  townTracks,
  segmentDistance,
} from '../src/game/town/TownLayout';
import { powerGrid, motorTraffic } from '../src/game/town/TownEvolution';
import { groundHeight } from '../src/game/town/TownLandscape';
import { airplanePose, AIRPORT_FLIGHT_CYCLE } from '../src/game/town/TownAviation';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { addScaffolding } from '../src/game/town/TownImprovements';
import { addLeisureActivity } from '../src/game/town/TownLeisure';
import { renderMotorLandmark } from '../src/game/town/buildings/motorAge';
import { renderCityBuilding } from '../src/game/town/buildings/city';
import { RIVER, riverCenterX } from '../src/game/town/TownRiver';
import {
  beginEventCamera,
  updateEventCamera,
  restoreEventCamera,
} from '../src/game/town/TownEventCamera';
import future from '../src/assets/future-meshes.json';

function complete(era) {
  const town = createTown();
  Object.assign(town, { era, coins: 1e7, tourSeen: true });
  for (const b of BUILDINGS.filter((b) => plotInEra(town, b.id))) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = era;
    town.buildingEraLevels[b.id] = 3;
  }
  return town;
}
function diorama(town) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    town,
    scene: new Scene(),
    world: new Group(),
    materials: new Map(),
    geometries: createTownGeometries(),
    contactShadowMaterial: new MeshBasicMaterial(),
    motions: [],
    actors: [],
    sign() {},
  });
  d.scene.add(d.world);
  return d;
}
it.each(ERAS.slice(2).map((e) => e.id))(
  'keeps all poles outside every active road in %s',
  (era) => {
    const town = complete(era),
      streets = townTracks(town),
      grid = powerGrid(town);
    expect(grid.connections.length).toBeGreaterThan(20);
    for (const [x, , z] of grid.poles)
      for (const edge of streets)
        expect(
          segmentDistance(x, z, edge.from, edge.to) - edge.width / 2,
          `${x},${z}`,
        ).toBeGreaterThan(0.2);
  },
);
it.each(['post-war', 'motor-age', 'aviation', 'broadcast', 'contemporary'])(
  'preserves motor traffic and services through %s modernization',
  (era) => {
    const previous = ERAS[eraIndex(era) - 1].id;
    let town = { ...complete(previous), era };
    const food = foodCapacity(town),
      water = waterCapacity(town);
    for (const id of ['stable', 'farm', 'well']) {
      for (let level = 0; level < 3; level++) {
        const offer = modernization(town, id);
        expect(offer.runs).toBe(level === 0 ? 2 : 1);
        town = purchase(town, id, offer.stage);
        town = normalizeTown(town);
        for (let win = 0; win < offer.runs; win++) town = advanceConstruction(town);
        town = finishConstruction(town, id, town.projects[id].stage);
        expect(motorTraffic(town)).toBe(true);
        expect(foodCapacity(town)).toBeGreaterThanOrEqual(food);
        expect(waterCapacity(town)).toBeGreaterThanOrEqual(water);
      }
    }
  },
);
it('retains an older 2005 save and its pending Motor-to-2005 receipt', () => {
  const saved = complete('contemporary');
  saved.transition = {
    id: 'motor-age:contemporary',
    from: 'motor-age',
    to: 'contemporary',
    pending: true,
  };
  for (const id of ['airport', 'radioTower', 'concertHall', 'television', 'skyline'])
    delete saved.buildings[id];
  const restored = normalizeTown(saved);
  expect(restored.era).toBe('contemporary');
  expect(restored.transition).toEqual(saved.transition);
  expect(restored.buildings.airport).toBe(0);
  expect(upgradeOffer(restored, 'airport').available).toBe(true);
  expect(restored.buildings.crystalLab).toBe(3);
});
it('reserves a multi-parcel western airfield and a clear flight path perpendicular to rail', () => {
  expect(AIRPORT.halfWidth * AIRPORT.halfDepth * 4).toBeGreaterThan(8 * 8 * 6);
  expect(AIRPORT.center[0] + AIRPORT.halfWidth).toBeLessThan(-32);
  expect(RAIL_EDGE.from[1]).toBe(RAIL_EDGE.to[1]);
  for (let x = -58; x <= -38; x += 2)
    for (let z = -16; z <= 24; z += 2) expect(groundHeight(x, z)).toBe(0);
  for (let t = 0; t < AIRPORT_FLIGHT_CYCLE; t += 0.1) {
    const p = airplanePose(t);
    if (!p.visible) continue;
    expect(p.y - groundHeight(p.x, p.z)).toBeGreaterThan(0.1);
    if (p.y < 4) expect(p.z).toBeGreaterThan(RAIL_EDGE.from[1] + 4);
    if (Math.abs(p.z - RAIL_EDGE.from[1]) < 4) expect(p.y).toBeGreaterThan(4);
  }
  expect(airplanePose(0).y).toBe(0.2);
  expect(airplanePose(65).y).toBeGreaterThan(10);
});
it.each(['motor-age', 'post-war', 'aviation', 'broadcast', 'contemporary'])(
  'keeps %s horse-field scaffolding outside the live pasture',
  (era) => {
    const town = complete(era),
      d = diorama(town),
      scaffold = new Group();
    addScaffolding(d, scaffold, 'horseField', 3, 2);
    scaffold.traverse((o) => {
      if (o.isMesh) {
        const bounds = new Box3().setFromObject(o);
        expect(bounds.max.x < -3 || bounds.min.x > 3).toBe(true);
      }
    });
    addLeisureActivity(d, town);
    const horses = d.world.children.filter((o) => o.name === 'Field horse');
    expect(horses).toHaveLength(3);
    for (let time = 0; time < 10; time += 0.2) {
      d.motions.forEach((m) => m(time));
      for (const horse of horses) {
        const box = new Box3().setFromObject(horse);
        expect(box.min.x).toBeGreaterThan(PLOTS.horseField[0] - 3);
        expect(box.max.x).toBeLessThan(PLOTS.horseField[0] + 3);
        expect(box.min.z).toBeGreaterThan(PLOTS.horseField[1] - 0.9);
        expect(box.max.z).toBeLessThan(PLOTS.horseField[1] + 1.75);
      }
    }
  },
);
it.each(['motor-age', 'post-war', 'aviation', 'broadcast', 'contemporary'])(
  'keeps a pier reaching water in %s',
  (era) => {
    const town = complete(era),
      d = diorama(town),
      root = d.group(d.world, ...[PLOTS.riverPort[0], 0, PLOTS.riverPort[1]]);
    if (era === 'motor-age') renderMotorLandmark(d, root, 'riverPort', 'Port', 3);
    else renderCityBuilding(d, root, 'riverPort', 'Port', 3, era, 3);
    const shore = riverCenterX(PLOTS.riverPort[1]) - RIVER.halfWidth;
    expect(new Box3().setFromObject(root).max.x).toBeGreaterThan(shore);
  },
);
it('exports finite indexed Blender geometry, with a bounded airport and readable city silhouettes', () => {
  for (const parts of Object.values(future.models))
    for (const part of parts) {
      expect(part.positions.every(Number.isFinite)).toBe(true);
      expect(part.normals.length).toBe(part.positions.length);
      expect(Math.max(...part.indices)).toBeLessThan(part.positions.length / 3);
      for (let i = 0; i < part.normals.length; i += 3)
        expect(Math.hypot(...part.normals.slice(i, i + 3))).toBeCloseTo(1, 3);
    }
  expect(future.models.airport.reduce((n, p) => n + p.indices.length / 3, 0)).toBeLessThan(5000);
});
it('eases into incident action, stays continuous at phase changes, and restores the user camera', () => {
  const d = {
    camera: new PerspectiveCamera(40, 1.6, 0.1, 400),
    controls: { target: new Vector3(4, 1, 2), enabled: true },
    elapsed: 0,
    overview: false,
    frameCache: { valid: true },
  };
  d.camera.position.set(40, 30, 50);
  const original = d.camera.position.clone();
  beginEventCamera(d);
  d.raid = { target: 'blacksmith', event: { targets: ['blacksmith'] } };
  let previous = original.clone();
  for (let n = 0; n <= 300; n++) {
    d.elapsed = n / 60;
    updateEventCamera(d);
    expect(d.camera.position.distanceTo(previous)).toBeLessThan(1.5);
    previous.copy(d.camera.position);
  }
  expect(d.controls.target.distanceTo(new Vector3(-15, 1.5, 13.5))).toBeLessThan(0.01);
  restoreEventCamera(d);
  d.raid = null;
  for (let n = 301; n <= 380; n++) {
    d.elapsed = n / 60;
    updateEventCamera(d);
  }
  expect(d.camera.position.distanceTo(original)).toBeLessThan(0.001);
  expect(d.controls.enabled).toBe(true);
  expect(d.eventCamera).toBeNull();
});

it('restores the camera immediately when reduced motion stops the event clock', () => {
  const d = {
    camera: new PerspectiveCamera(),
    controls: { target: new Vector3(), enabled: true },
    elapsed: 0,
    overview: true,
    motionEnabled: true,
    frameCache: { valid: true },
  };
  d.camera.position.set(12, 12, 25);
  beginEventCamera(d);
  d.camera.position.set(-10, 12, 15);
  d.motionEnabled = false;
  restoreEventCamera(d);
  expect(d.camera.position.toArray()).toEqual([12, 12, 25]);
  expect(d.frameCache.valid).toBe(false);
  expect(d.eventCamera).toBeNull();
  expect(d.controls.enabled).toBe(true);
});

it('reuses the scenery cache once an event camera settles and redraws when its target changes', () => {
  const d = {
    camera: new PerspectiveCamera(40, 1.6, 0.1, 400),
    controls: { target: new Vector3(), enabled: true },
    frameCache: { valid: true },
    elapsed: 0,
    raid: { target: 'blacksmith', event: { targets: ['blacksmith'] } },
  };
  d.camera.position.set(40, 30, 50);
  beginEventCamera(d);
  for (let i = 0; i < 720; i++) {
    d.elapsed = i / 60;
    updateEventCamera(d);
  }
  for (let i = 720; i < 960; i++) {
    d.frameCache.valid = true;
    d.elapsed = i / 60;
    updateEventCamera(d);
    expect(d.frameCache.valid).toBe(true);
  }
  d.raid.target = 'warehouse';
  d.elapsed += 1 / 60;
  updateEventCamera(d);
  expect(d.frameCache.valid).toBe(false);
});
