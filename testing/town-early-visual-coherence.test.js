import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Group, Raycaster, Vector3 } from 'three';
import { BUILDINGS, createTown } from '../src/data/town';
import { modelLevel } from '../src/data/buildingProgression';
import { heritageUpgrade } from '../src/data/heritageUpgrades';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { buildPlot } from '../src/game/town/TownPlots';
import { PLOTS, townTracks } from '../src/game/town/TownLayout';
import { NPC_BODY_MARGIN, SIDEWALK_OFFSET } from '../src/data/townClearances';
import {
  geometryFootprints,
  registerFootprints,
  sweptClear,
} from '../src/game/town/BuildingFootprints';
import { renderEraLandmark } from '../src/game/town/buildings/BuildingRenderer';
import { renderMotorBuilding } from '../src/game/town/buildings/motorAge';
import { addUtilityUpgrade } from '../src/game/town/buildings/HeritageDetails';

const drawings = [];
const labels = Object.fromEntries(BUILDINGS.map((building) => [building.id, building.name]));
function drawing(era) {
  const d = Object.create(TownDiorama.prototype);
  d.geometries = createTownGeometries();
  d.materials = new Map();
  d.sign = () => {};
  d.town = createTown();
  d.town.era = era;
  for (const building of BUILDINGS) {
    d.town.buildings[building.id] = Math.min(3, building.upgrades.length);
    d.town.buildingEras[building.id] = era;
    d.town.buildingEraLevels[building.id] = era === 'frontier' ? 0 : 3;
  }
  drawings.push(d);
  return d;
}
afterEach(() => {
  for (const d of drawings.splice(0)) {
    for (const geometry of Object.values(d.geometries)) geometry.dispose();
    for (const material of d.materials.values()) material.dispose();
  }
});
function plot(d, id, stage = 3, eraLevel = stage) {
  d.town.buildings[id] = stage;
  d.town.buildingEraLevels[id] = d.town.era === 'frontier' ? 0 : eraLevel;
  const root = new Group();
  root.position.set(PLOTS[id][0], 0.08, PLOTS[id][1]);
  buildPlot(d, id, root, d.town, labels);
  root.updateMatrixWorld(true);
  return root;
}
function meshes(root) {
  const result = [];
  root.traverse((object) => {
    if (object.isMesh) result.push(object);
  });
  return result;
}
function signatures(root) {
  root.updateMatrixWorld(true);
  return meshes(root).map((object) =>
    JSON.stringify([
      object.geometry.attributes.position.count,
      object.geometry.index?.count,
      object.material.color.getHex(),
      object.matrixWorld.elements,
    ]),
  );
}
function expectGroundedComponents(root, assembly = root) {
  const objects = meshes(assembly);
  const required = new Set(meshes(root));
  const parts = objects.map((mesh) => new Box3().setFromObject(mesh));
  const padded = parts.map((box) => box.clone().expandByScalar(0.05));
  const floor = assembly.getWorldPosition(new Vector3()).y;
  const queue = parts.flatMap((box, index) => (box.min.y <= floor + 0.12 ? [index] : []));
  const supported = new Set(queue);
  for (let cursor = 0; cursor < queue.length; cursor++)
    for (let index = 0; index < parts.length; index++) {
      if (supported.has(index) || !padded[index].intersectsBox(parts[queue[cursor]])) continue;
      supported.add(index);
      queue.push(index);
    }
  for (let index = 0; index < objects.length; index++)
    if (required.has(objects[index]))
      expect(
        supported.has(index),
        `supported ${objects[index].name || objects[index].material.color.getHexString()}`,
      ).toBe(true);
}

describe('Grounded early town architecture', () => {
  it.each(['school', 'doctor', 'blacksmith'])(
    'grounds the native %s timber final and reserves its upper masonry room for River & Rail three',
    (kind) => {
      const native = drawing('frontier');
      const root = plot(native, kind);
      const wing = root.getObjectByName(`Frontier ${kind} final wing`);
      expect(wing).toBeDefined();
      expect(new Box3().setFromObject(wing).min.y).toBeLessThanOrEqual(0.13);
      expectGroundedComponents(wing);
      expect(root.getObjectByName(`Heritage ${heritageUpgrade(kind)}`)).toBeUndefined();
      const roof = root.getObjectByName('Frontier timber lean-to roof');
      expect(roof).toBeDefined();
      expect(
        meshes(roof).filter((mesh) => mesh.material.color.getHexString() === '937447'),
      ).toHaveLength(9);
      const river = drawing('river-rail');
      for (const tier of [1, 2, 3]) {
        const upgraded = plot(river, kind, 3, tier);
        const upper = upgraded.getObjectByName(`Heritage ${heritageUpgrade(kind)}`);
        expect(!!upper, `${kind} River ${tier}`).toBe(tier === 3);
        expect(upgraded.getObjectByName(`Frontier ${kind} final wing`)).toBeDefined();
        if (!upper) continue;
        const bounds = new Box3().setFromObject(upper);
        const center = bounds.getCenter(new Vector3());
        const ray = new Raycaster(
          new Vector3(center.x, bounds.min.y + 0.01, center.z),
          new Vector3(0, -1, 0),
          0,
          0.12,
        );
        const supports = meshes(upgraded).filter((mesh) => {
          for (let node = mesh; node; node = node.parent) if (node === upper) return false;
          return true;
        });
        expect(
          ray.intersectObjects(supports, false).length,
          `${kind} upper room foundation`,
        ).toBeGreaterThan(0);
      }
      if (kind === 'blacksmith') {
        expect(modelLevel(kind, 3)).toBe(5);
        // The wheelwright wheel and anvil are still present at the live model-five stage.
        expect(meshes(root).some((mesh) => mesh.material.color.getHexString() === '9e845c')).toBe(
          true,
        );
        expect(meshes(root).some((mesh) => mesh.material.color.getHexString() === '737c76')).toBe(
          true,
        );
      }
    },
  );

  it('connects the school chalkboard to grounded legs at every visible stage', () => {
    for (const era of ['frontier', 'river-rail']) {
      const d = drawing(era);
      for (const level of [2, 3]) {
        const root = plot(d, 'school', level, level);
        const frame = root.getObjectByName('School chalkboard frame');
        expect(frame).toBeDefined();
        expectGroundedComponents(frame);
        expect(new Box3().setFromObject(frame).min.y).toBeCloseTo(0.08, 5);
      }
    }
  });

  it('keeps the stone well and winch but replaces the pitched canopy when a reservoir occupies that space', () => {
    const frontier = plot(drawing('frontier'), 'well', 1);
    expect(meshes(frontier).filter((mesh) => mesh.name === 'Well roof')).toHaveLength(2);
    for (const level of [1, 2, 3]) {
      const river = plot(drawing('river-rail'), 'well', 3, level);
      expect(river.getObjectByName('Well roof')).toBeUndefined();
      expect(meshes(river).filter((mesh) => mesh.name === 'Well wall')).toHaveLength(36);
      expect(river.getObjectByName('Well frame')).toBeDefined();
      const valve = river.getObjectByName('River well distribution valve');
      expect(!!valve).toBe(level >= 2);
      if (valve) expectGroundedComponents(valve, river);
      expect(meshes(river).some((mesh) => mesh.material.color.getHexString() === '698e8c')).toBe(
        true,
      );
    }
  });

  it.each(['well', 'farm', 'fisherman', 'riverPort'])(
    'adds a supported working final to the Industrial %s without removing its completed annex',
    (kind) => {
      const d = drawing('industrial');
      const second = new Group(),
        final = new Group();
      renderEraLandmark(d, second, kind, kind, 2, 'industrial', 3);
      renderEraLandmark(d, final, kind, kind, 3, 'industrial', 3);
      const finalParts = new Set(signatures(final));
      for (const signature of signatures(second)) expect(finalParts.has(signature)).toBe(true);
      const feature = final.getObjectByName(`Heritage ${heritageUpgrade(kind)}`);
      expect(feature?.userData.utilityFeature).toBeTruthy();
      expectGroundedComponents(feature, final);
      const dimensions = new Box3().setFromObject(feature).getSize(new Vector3());
      expect(dimensions.x).toBeGreaterThan(1);
      expect(dimensions.z).toBeGreaterThan(1.3);
      expect(addUtilityUpgrade(d, new Group(), 'unsupported-future-utility', true)).toBe(false);
    },
  );

  it.each(['well', 'fisherman', 'riverPort'])(
    'grounds every River & Rail %s working-final part through its actual retained structure',
    (kind) => {
      const root = plot(drawing('river-rail'), kind, 3, 3);
      const feature = root.getObjectByName(`Heritage ${heritageUpgrade(kind)}`);
      expect(feature).toBeDefined();
      expectGroundedComponents(feature, root);
    },
  );
});

describe('Motor native construction and retained service structures', () => {
  it('draws native park stages while retaining an already-completed older horse field', () => {
    const d = drawing('motor-age');
    const sizes = [];
    for (const level of [1, 2, 3]) {
      const root = plot(d, 'park', level, level);
      const structure = root.getObjectByName(`Blender park${level}`);
      expect(structure).toBeDefined();
      sizes.push({
        height: new Box3().setFromObject(structure).getSize(new Vector3()).y,
        vertices: meshes(structure).reduce(
          (count, mesh) => count + mesh.geometry.attributes.position.count,
          0,
        ),
      });
      const field = plot(d, 'horseField', 3, level);
      expect(field.getObjectByName('Blender field3')).toBeDefined();
      expect(field.getObjectByName('Blender field1')).toBeUndefined();
    }
    expect(sizes[1].vertices).toBeGreaterThan(sizes[0].vertices);
    expect(sizes[2].height).toBeGreaterThan(sizes[1].height + 0.3);
  });

  it.each(['garage', 'busDepot', 'diner'])(
    'adds a connected functional %s extension without removing its L2 wing, windows or roof',
    (kind) => {
      const d = drawing('motor-age'),
        second = new Group(),
        final = new Group();
      renderMotorBuilding(d, second, kind, kind, 2);
      renderMotorBuilding(d, final, kind, kind, 3);
      const finalParts = new Set(signatures(final));
      for (const signature of signatures(second)) expect(finalParts.has(signature)).toBe(true);
      const extension = final.getObjectByName(`Motor Age ${kind} working extension`);
      expect(extension?.userData.upgradeFeature).toBe(heritageUpgrade(kind));
      const bounds = new Box3().setFromObject(extension);
      expect(bounds.min.y).toBeLessThan(0.1);
      expect(bounds.min.z).toBeLessThanOrEqual(0.95 + 1e-6);
      expect(bounds.max.z).toBeGreaterThan(2);
      expect(bounds.max.x).toBeLessThan(-1.4);
      expectGroundedComponents(extension);
    },
  );

  it.each(['well', 'farm', 'fisherman', 'riverPort'])(
    'keeps one Motor %s forecourt lighting owner rather than nearly-coincident lamp pairs',
    (kind) => {
      const d = drawing('motor-age');
      for (const level of [1, 2, 3]) {
        const root = plot(d, kind, 3, level);
        const owners = [];
        root.traverse((object) => {
          if (object.userData.forecourtLighting) owners.push(object);
        });
        expect(owners).toHaveLength(1);
        expect(
          meshes(owners[0]).filter((mesh) => mesh.material.color.getHexString() === 'f6db98'),
        ).toHaveLength(2);
      }
    },
  );
});

it('terminates Industrial bridge final pickets at the continuous handrail', () => {
  const root = plot(drawing('industrial'), 'bridge', 3, 3);
  const pickets = meshes(root).filter((mesh) => mesh.name === 'Industrial bridge infill picket');
  expect(pickets).toHaveLength(48);
  for (const picket of pickets) {
    const bounds = new Box3().setFromObject(picket);
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(0.9, 5);
  }
});

it.each([
  ['frontier', 'school'],
  ['frontier', 'doctor'],
  ['frontier', 'blacksmith'],
  ['river-rail', 'well'],
  ['river-rail', 'well2'],
  ['river-rail', 'fisherman'],
  ['river-rail', 'riverPort'],
  ['industrial', 'well'],
  ['industrial', 'well2'],
  ['industrial', 'farm'],
  ['industrial', 'farm2'],
  ['industrial', 'farm3'],
  ['industrial', 'fisherman'],
  ['industrial', 'riverPort'],
  ['motor-age', 'garage'],
  ['motor-age', 'busDepot'],
  ['motor-age', 'diner'],
])('keeps new %s/%s solids clear of roads, sidewalks and the straight entrance line', (era, id) => {
  const d = drawing(era),
    root = plot(d, id, 3, 3);
  const additions = [];
  root.traverse((object) => {
    if (
      /^Frontier .+ final wing$|^School chalkboard frame$|^Motor Age .+ working extension$/.test(
        object.name,
      ) ||
      object.userData.utilityFeature
    )
      additions.push(object);
  });
  expect(additions.length).toBeGreaterThan(0);
  const streets = townTracks(d.town).filter((road) => road.width >= 0.85);
  for (const addition of additions) {
    const entries = registerFootprints(addition, geometryFootprints(addition));
    for (const solid of entries.filter((entry) => entry.y < 1.7 && entry.y + entry.height > 0.3)) {
      for (const road of streets)
        expect(
          sweptClear(
            solid,
            [road.from[0], 0.07, road.from[1]],
            [road.to[0], 0.07, road.to[1]],
            SIDEWALK_OFFSET + NPC_BODY_MARGIN + 0.04,
          ),
          `${era}/${id} street ${road.from}→${road.to}`,
        ).toBe(true);
      expect(
        sweptClear(
          solid,
          [PLOTS[id][0], 0.07, PLOTS[id][1] + 2.05],
          [PLOTS[id][0], 0.07, PLOTS[id][1] + 3.5],
          NPC_BODY_MARGIN,
        ),
        `${era}/${id} straight doorway`,
      ).toBe(true);
    }
  }
});
