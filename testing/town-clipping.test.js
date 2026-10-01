import { vi as testTiming } from 'vitest';
// Whole-town builds for several eras exceed the default 5s on CI.
testTiming.setConfig({ testTimeout: 60000 });
import { afterEach, describe, expect, it } from 'vitest';
import { Box3, DoubleSide, Group, MeshBasicMaterial, Raycaster, Scene, Vector3 } from 'three';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownActors } from '../src/game/town/TownActors';
import { TownStatics } from '../src/game/town/TownStatics';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';
import { eraIndex } from '../src/game/town/TownEras';
import { addEraStreetscape, powerGrid, STREET_FURNITURE } from '../src/game/town/TownEvolution';
import { PLOTS, segmentDistance, townTracks } from '../src/game/town/TownLayout';
import { SIDEWALK_OFFSET, NPC_BODY_MARGIN } from '../src/data/townClearances';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { geometryFootprints } from '../src/game/town/BuildingFootprints';

const views = [];
function diorama() {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
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
  d.scene.add(d.world);
  views.push(d);
  return d;
}
afterEach(() => {
  for (const d of views.splice(0)) {
    d.actorRenderer?.dispose();
    d.buildingRenderer?.dispose();
    d.upgradeGlow?.dispose();
    d.staticScenery?.dispose(d);
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  }
});
function completeTown(era, buildingEra = era) {
  const town = createTown();
  town.era = era;
  for (const b of BUILDINGS) {
    if (eraIndex(b.introducedEra) > eraIndex(era)) continue;
    town.buildings[b.id] = b.upgrades.length;
    const own = eraIndex(b.introducedEra) > eraIndex(buildingEra) ? era : buildingEra;
    town.buildingEras[b.id] = own;
    town.buildingEraLevels[b.id] = own === 'frontier' ? 0 : 3;
  }
  return town;
}
const labels = Object.fromEntries(BUILDINGS.map((b) => [b.id, b.shortName]));
labels.mine = 'Mine';
// Sample every triangle of `mesh` for a point inside the rotor's swept disc.
function sweeps(mesh, center, radius, z0, z1) {
  const position = mesh.geometry.attributes.position,
    index = mesh.geometry.index;
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3(),
    p = new Vector3();
  const at = (k) => (index ? index.getX(k) : k);
  for (let i = 0; i < (index?.count ?? position.count); i += 3) {
    a.fromBufferAttribute(position, at(i)).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, at(i + 1)).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, at(i + 2)).applyMatrix4(mesh.matrixWorld);
    for (let u = 0; u <= 6; u++)
      for (let v = 0; u + v <= 6; v++) {
        p.set(0, 0, 0)
          .addScaledVector(a, 1 - (u + v) / 6)
          .addScaledVector(b, u / 6)
          .addScaledVector(c, v / 6);
        if (p.z > z0 && p.z < z1 && Math.hypot(p.x - center.x, p.y - center.y) < radius)
          return true;
      }
  }
  return false;
}

describe('Town models do not clip into each other', () => {
  it.each(['frontier', 'river-rail'])(
    'turns the %s farm windpump clear of its tower, wings and hayloft',
    (era) => {
      const d = diorama();
      for (const id of ['farm', 'farm2', 'farm3'])
        for (const level of era === 'frontier' ? [0] : [1, 2, 3]) {
          const town = completeTown(era);
          town.buildingEraLevels[id] = level;
          const scales = [2, 3].map((stage) => {
            town.buildings[id] = stage;
            const group = d.group(d.world, PLOTS[id][0], 0.08, PLOTS[id][1]);
            const moving = d.buildPlot(id, group, town, labels);
            group.updateMatrixWorld(true);
            if (stage === 3) {
              const rotor = moving.rotor,
                bounds = new Box3().setFromObject(rotor, true),
                center = bounds.getCenter(new Vector3());
              const radius = Math.max(bounds.max.x - center.x, bounds.max.y - center.y);
              group.traverse((mesh) => {
                if (!mesh.isMesh) return;
                for (let n = mesh; n; n = n.parent) if (n === rotor) return;
                expect(
                  sweeps(mesh, center, radius + 0.03, bounds.min.z - 0.03, bounds.max.z + 0.03),
                  `${era} ${id} L${level} ${mesh.material.color.getHexString()}`,
                ).toBe(false);
              });
            }
            const scale = group.getObjectByName('Road setback')?.scale.x ?? 1;
            d.clearGroup(group);
            return scale;
          });
          // Standing in the back yard, the tower never squeezes the farm between roads.
          expect(scales[1]).toBe(scales[0]);
        }
    },
  );

  it.each(['industrial', 'motor-age', 'aviation', 'contemporary'])(
    'keeps %s street furniture off lots, roads and sidewalks',
    (era) => {
      const d = diorama();
      const town = completeTown(era);
      d.town = town;
      const street = addEraStreetscape(d, town);
      street.updateMatrixWorld(true);
      const lots = BUILDINGS.filter((b) => town.buildings[b.id] && b.id !== 'mine').map((b) => {
        const group = d.group(d.world, PLOTS[b.id][0], 0.08, PLOTS[b.id][1]);
        d.buildPlot(b.id, group, town, labels);
        return [b.id, new Box3().setFromObject(group, true)];
      });
      const reach = SIDEWALK_OFFSET + NPC_BODY_MARGIN;
      expect(STREET_FURNITURE).toHaveLength(2);
      street.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const box = new Box3().setFromObject(mesh, true);
        for (const [id, lot] of lots) expect(box.intersectsBox(lot), id).toBe(false);
        if (box.min.y > 1.8) return; // Lanterns overhang above head height.
        for (const { from, to, width } of townTracks(town)) {
          for (const x of [box.min.x, box.max.x])
            for (const z of [box.min.z, box.max.z])
              expect(
                segmentDistance(x, z, from, to),
                `${mesh.material.color.getHexString()} near ${from}–${to}`,
              ).toBeGreaterThan(width < 0.85 ? width / 2 : reach);
        }
      });
    },
  );

  it.each(ERAS.slice(eraIndex('post-war')).map((era) => era.id))(
    'parks every %s depot vehicle clear of canopy columns and forecourt lamps',
    (era) => {
      const d = diorama();
      let parked = 0;
      for (const id of ['stable', 'garage', 'busDepot'])
        for (const level of [1, 2, 3]) {
          const town = completeTown(era);
          if (!town.buildings[id]) continue;
          town.buildingEraLevels[id] = level;
          const group = d.group(d.world, 0, 0, 0);
          d.buildPlot(id, group, town, labels);
          let vehicle = null;
          group.traverse((node) => (vehicle ??= node.userData.vehicleBox ? node : null));
          if (!vehicle) continue;
          parked++;
          group.updateMatrixWorld(true);
          const car = new Box3().setFromObject(vehicle, true);
          vehicle.removeFromParent();
          // Ground slabs and plinths sit beneath the wheels; anything taller is solid.
          for (const s of geometryFootprints(group))
            expect(
              s.yMax > car.min.y + 0.25 &&
                s.yMin < car.max.y &&
                Math.abs(s.cx - (car.min.x + car.max.x) / 2) <
                  s.halfW + (car.max.x - car.min.x) / 2 &&
                Math.abs(s.cz - (car.min.z + car.max.z) / 2) <
                  s.halfD + (car.max.z - car.min.z) / 2,
              `${id} L${level} solid at ${s.cx.toFixed(2)},${s.cz.toFixed(2)}`,
            ).toBe(false);
          d.clearGroup(group);
        }
      expect(parked).toBeGreaterThan(0);
    },
  );

  it.each(['industrial', 'post-war', 'motor-age'])(
    'ends every %s service drop on its building without passing through walls',
    (era) => {
      const view = diorama();
      view.actorRenderer = new TownActors(view.scene);
      view.buildingRenderer = new TownStatics(view.scene);
      view.upgradeGlow = new TownUpgradeGlow(view.scene);
      const town = completeTown(era);
      view.update(town, labels);
      const plots = [...view.plotCache.values()].map(({ group }) => group);
      const [sx, sz] = PLOTS.square;
      for (const [x, , z] of powerGrid(town).poles)
        expect(Math.abs(x - sx) < 2.85 && Math.abs(z - sz) < 2.75, `pole ${x},${z}`).toBe(false);
      const drops = view.serviceDrops;
      expect(drops).toBeTruthy();
      const connected = powerGrid(town).connections.map(({ id }) => id);
      const materials = new Set();
      plots.forEach((plot) => plot.traverse((m) => m.isMesh && materials.add(m.material)));
      const sides = new Map([...materials].map((m) => [m, m.side]));
      materials.forEach((m) => (m.side = DoubleSide));
      const ray = new Raycaster();
      ray.layers.enableAll();
      try {
        // Batched drops keep one merged wire geometry; rebuild them unbatched to inspect.
        view.batch = () => {};
        view.refreshServiceDrops();
        for (const id of connected) {
          const drop = view.serviceDrops.getObjectByName(`Service drop ${id}`);
          expect(drop, id).toBeTruthy();
          const rods = drop.children.filter((m) => m.material.color.getHexString() === '58645d');
          rods.forEach((rod, i) => {
            const half = rod.scale.y / 2,
              axis = new Vector3(0, 1, 0).applyQuaternion(rod.quaternion);
            const start = rod.position.clone().addScaledVector(axis, -half);
            ray.set(start, axis);
            // The final segment may touch its own wall within the insulator's reach.
            ray.far = Math.max(0, half * 2 - (i === rods.length - 1 ? 0.1 : 0));
            const hits = ray
              .intersectObjects(plots, true)
              .filter(({ object }) => !object.material.transparent);
            expect(hits.length, `${id} wire ${i}`).toBe(0);
          });
        }
      } finally {
        for (const [material, side] of sides) material.side = side;
      }
    },
  );
});
