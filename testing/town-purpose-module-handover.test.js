import { afterEach, beforeAll, expect, it } from 'vitest';
import { Box3, Group, Scene, Vector3 } from 'three';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS, eraEvolution } from '../src/data/eras';
import { CITY_FAMILIES } from '../src/data/city';
import { heritageUpgrade } from '../src/data/heritageUpgrades';
import { buildingStages } from '../src/data/buildingStages';
import { MOON_LOTS, moonLotPose } from '../src/data/moonSettlement';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { TownStatics } from '../src/game/town/TownStatics';
import { buildPlot } from '../src/game/town/TownPlots';
import { PLOTS } from '../src/game/town/TownLayout';
import { eraIndex, finishEra, modernizesInEra } from '../src/game/town/TownEras';
import { ALL_MESH_FAMILIES, loadFamilies } from '../src/game/town/assets/MeshCatalog';
import { renderMoonBuilding } from '../src/game/town/buildings/moon';

const eras = ERAS.filter(({ enabled }) => enabled);
const labels = Object.fromEntries(BUILDINGS.map((building) => [building.id, building.shortName]));
const drawings = [];
const architecture = (era) => ['city', 'motor-age'].includes(eraEvolution(era).style);
// Hard ceilings include existing timber farms/bridges and the largest retained
// garden pavilion. These are source geometry caps; static batching has its own
// draw-call gate below. Later eras cannot accumulate a new room per handover.
const PLOT_BUDGET = { meshes: 500, triangles: 16000 };
const MODULE_BUDGET = { meshes: 64, triangles: 3200 };
const excludedFamilies = new Set(['square', 'bridge', 'park', 'field', 'leisure']);
const isModulePlot = (building) =>
  !building.settlement &&
  building.kind !== 'watermill' &&
  CITY_FAMILIES[building.kind] &&
  !excludedFamilies.has(CITY_FAMILIES[building.kind]);

beforeAll(() => loadFamilies(ALL_MESH_FAMILIES));
afterEach(() => drawings.splice(0).forEach((d) => d.disposePrimitives()));

function drawing(era) {
  const d = Object.assign(Object.create(TownDiorama.prototype), new TownPrimitives());
  d.town = createTown();
  d.town.era = era;
  // Keep physical production signs. SSR intentionally has no atlas face texture.
  for (const building of BUILDINGS) {
    if (eraIndex(building.introducedEra) > eraIndex(era)) continue;
    d.town.buildings[building.id] = building.upgrades.length;
    d.town.buildingEras[building.id] = finishEra(building.id, era);
    d.town.buildingEraLevels[building.id] = era === 'frontier' ? 0 : 3;
  }
  drawings.push(d);
  return d;
}

function plot(d, building, finishLevel = 3) {
  const root = new Group();
  root.userData.plot = building.id;
  if (building.settlement === 'moon') {
    const [x, z] = MOON_LOTS[building.id];
    root.position.set(x, 0, z);
    root.rotation.y = moonLotPose(building.id).rotation;
    renderMoonBuilding(d, root, building.kind, finishLevel);
  } else {
    root.position.set(PLOTS[building.id][0], 0.08, PLOTS[building.id][1]);
    d.town.buildingEraLevels[building.id] =
      d.town.buildingEras[building.id] === 'frontier' ? 0 : finishLevel;
    buildPlot(d, building.id, root, d.town, labels);
  }
  root.updateMatrixWorld(true);
  return root;
}

function modules(root) {
  const result = [];
  root.traverse((part) => {
    if (part.userData.purposeModule) result.push(part);
  });
  return result;
}

function parts(module, semantic) {
  const result = [];
  module.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (let node = mesh; node && node !== module; node = node.parent) {
      if (node.userData.modulePart) {
        if (node.userData.modulePart === semantic) result.push(mesh);
        break;
      }
    }
  });
  return result;
}

function localBounds(root, objects) {
  const inverse = root.matrixWorld.clone().invert();
  const box = new Box3();
  for (const object of objects) box.union(new Box3().setFromObject(object).applyMatrix4(inverse));
  return box;
}

function signature(root, objects, includeMaterials = true) {
  const inverse = root.matrixWorld.clone().invert();
  return JSON.stringify(
    objects
      .map((mesh) => [
        Array.from(mesh.geometry.attributes.position.array),
        Array.from(mesh.geometry.index?.array ?? []),
        mesh.matrixWorld
          .clone()
          .premultiply(inverse)
          .elements.map((n) => Number(n.toFixed(5))),
        ...(includeMaterials
          ? [mesh.material.color?.getHexString(), mesh.material.opacity, mesh.material.transparent]
          : []),
      ])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
}

function substantialStructure(root, module, context) {
  const structure = parts(module, 'structure');
  expect(structure.length, `${context}: actual structural meshes`).toBeGreaterThan(0);
  const size = localBounds(root, structure).getSize(new Vector3());
  expect(size.x, `${context}: working module width`).toBeGreaterThanOrEqual(0.4);
  expect(size.z, `${context}: working module depth`).toBeGreaterThanOrEqual(0.35);
  expect(size.y, `${context}: working module height`).toBeGreaterThan(0.05);
  expect(
    size.x * size.y * size.z,
    `${context}: structure is more than a small trim piece`,
  ).toBeGreaterThan(0.1);
  return structure;
}

const transitions = eras.slice(1).flatMap((era, index) => {
  const previous = eras[index];
  return architecture(previous.id) && architecture(era.id) ? [[previous.id, era.id]] : [];
});

it.each(transitions)(
  'hands every actual %s mature purpose module to %s finish1 without buying the room again',
  (previousEra, era) => {
    const before = drawing(previousEra);
    const after = drawing(era);
    const eligible = BUILDINGS.filter(
      (building) =>
        PLOTS[building.id] &&
        isModulePlot(building) &&
        eraIndex(building.introducedEra) < eraIndex(era) &&
        modernizesInEra(era, building.id) &&
        finishEra(building.id, previousEra) !== finishEra(building.id, era),
    );
    expect(eligible.length, `${previousEra}→${era} actual eligible plots`).toBeGreaterThan(0);
    for (const building of eligible) {
      const context = `${previousEra}→${era}/${building.id}`;
      const oldRoot = plot(before, building);
      const oldModules = modules(oldRoot);
      // A native base such as gardenCourt's three houses is not reclassified as
      // an extra purpose module. Every previously authored module must survive.
      expect(
        oldModules.length,
        `${context}: no accumulated predecessor modules`,
      ).toBeLessThanOrEqual(1);
      const roots = [1, 2, 3].map((level) => plot(after, building, level));
      const current = roots.map((root, index) => {
        const found = modules(root);
        expect(
          found,
          `${context} finish${index + 1}: exactly one mature purpose module`,
        ).toHaveLength(1);
        const module = found[0];
        expect(module.userData.purposeModule).toMatchObject({
          role: 'purposeModule',
          level: 3,
          finishLevel: index + 1,
        });
        expect(module.userData.purposeModule.feature ?? 'service').toBe(
          heritageUpgrade(building.kind) ?? 'service',
        );
        substantialStructure(root, module, `${context} finish${index + 1}`);
        expect(parts(module, 'frontage').length, `${context}: functional frontage`).toBeGreaterThan(
          0,
        );
        return module;
      });
      const structural = roots.map((root, index) =>
        signature(root, parts(current[index], 'structure'), false),
      );
      expect(structural[1], `${context}: L2 upgrades the same completed structure`).toBe(
        structural[0],
      );
      expect(structural[2], `${context}: L3 upgrades the same completed structure`).toBe(
        structural[0],
      );
      const finalEnvelope = localBounds(roots[2], [current[2]]).expandByScalar(0.025);
      for (const [index, root] of roots.entries()) {
        expect(
          finalEnvelope.containsBox(localBounds(root, [current[index]])),
          `${context}: finish${index + 1} inside one reserved mature envelope`,
        ).toBe(true);
      }
      expect(
        signature(roots[1], parts(current[1], 'frontage'), false),
        `${context}: paid L2 frontage/glazing grade`,
      ).not.toBe(signature(roots[0], parts(current[0], 'frontage'), false));
      expect(
        parts(current[2], 'operation').length,
        `${context}: actual L3 operational grade`,
      ).toBeGreaterThan(0);
      expect(
        signature(roots[2], parts(current[2], 'operation'), false),
        `${context}: paid L3 operational grade`,
      ).not.toBe(signature(roots[1], parts(current[1], 'operation'), false));
      if (oldModules.length) {
        const old = oldModules[0];
        substantialStructure(oldRoot, old, `${context} completed predecessor`);
        expect(
          current[0].userData.purposeModule.feature ?? 'service',
          `${context}: functional purpose counterpart`,
        ).toBe(old.userData.purposeModule.feature ?? 'service');
        for (const semantic of ['frontage', 'operation']) {
          if (parts(old, semantic).length)
            expect(
              parts(current[0], semantic).length,
              `${context}: prior ${semantic} still has a functional counterpart`,
            ).toBeGreaterThan(0);
        }
        if (
          previousEra === 'motor-age' &&
          era === 'aviation' &&
          ['home', 'garage'].includes(building.kind)
        ) {
          expect(
            current[0].userData.purposeModule.component,
            `${context}: upper storey/service tower counterpart`,
          ).toBe(old.userData.purposeModule.component);
          const oldSize = localBounds(oldRoot, parts(old, 'structure')).getSize(new Vector3());
          const newSize = localBounds(roots[0], parts(current[0], 'structure')).getSize(
            new Vector3(),
          );
          // These handovers share the same working-room design: a reskin must
          // not replace the occupied room/bay with a tiny roof ornament.
          expect(newSize.x).toBeGreaterThanOrEqual(oldSize.x * 0.9);
          expect(newSize.z).toBeGreaterThanOrEqual(oldSize.z * 0.9);
          expect(newSize.y).toBeGreaterThanOrEqual(oldSize.y * 0.9);
        }
      }
      before.clearGroup(oldRoot);
      roots.forEach((root) => after.clearGroup(root));
    }
  },
  60000,
);

function meshStatistics(root, visibleOnly = false) {
  const result = { meshes: 0, triangles: 0, materials: new Set(), geometryBytes: new Map() };
  const visit = (mesh) => {
    if (!mesh.isMesh || (visibleOnly && !mesh.layers.isEnabled(0))) return;
    result.meshes++;
    result.triangles +=
      ((mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3) *
      (mesh.isInstancedMesh ? mesh.count : 1);
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) =>
      result.materials.add(material.uuid),
    );
    result.geometryBytes.set(
      mesh.geometry.uuid,
      Object.values(mesh.geometry.attributes).reduce(
        (sum, attribute) => sum + attribute.array.byteLength,
        0,
      ) + (mesh.geometry.index?.array.byteLength ?? 0),
    );
  };
  root[visibleOnly ? 'traverseVisible' : 'traverse'](visit);
  return result;
}

it.each(eras.map(({ id }) => id))(
  'reports bounded worst-case %s mature-module source geometry and actual static batches',
  (era) => {
    const d = drawing(era);
    const available = BUILDINGS.filter(
      (building) =>
        (PLOTS[building.id] || MOON_LOTS[building.id]) &&
        eraIndex(building.introducedEra) <= eraIndex(era),
    );
    const report = {
      era,
      scope:
        'reachable building plots only; physical signs included; browser atlas lettering, terrain/scenery/actors/shadow passes excluded',
      method:
        'Per-plot maximum over every legal mature-module finish; actual production buildPlot/setbacks plus actual TownStatics batching. Independent per-plot maxima are conservative, not a measured WebGL frame.',
      plots: available.length,
      rawMeshesUpperBound: 0,
      rawTrianglesUpperBound: 0,
      moduleMeshesUpperBound: 0,
      moduleTrianglesUpperBound: 0,
      postBatchVisibleMeshesUpperBound: 0,
      postBatchTrianglesUpperBound: 0,
      batchCeilingUpperBound: 0,
      details: [],
    };
    for (const building of available) {
      const finish = finishEra(building.id, era);
      const modernizing =
        !building.settlement &&
        finish === era &&
        modernizesInEra(era, building.id) &&
        buildingStages(building.kind, finish, 1, 3).modernizing;
      const levels = modernizing ? [1, 2, 3] : [3];
      const samples = [];
      for (const level of levels) {
        const root = plot(d, building, level);
        const source = meshStatistics(root);
        const purpose = modules(root);
        expect(
          purpose.length,
          `${era}/${building.id}: module count is bounded`,
        ).toBeLessThanOrEqual(1);
        if (purpose.length)
          expect(
            purpose[0].userData.purposeModule.level,
            `${era}/${building.id}: budget includes the mature module`,
          ).toBeGreaterThanOrEqual(3);
        const module = purpose[0] ? meshStatistics(purpose[0]) : { meshes: 0, triangles: 0 };
        expect(source.meshes, `${era}/${building.id}: source mesh ceiling`).toBeLessThanOrEqual(
          PLOT_BUDGET.meshes,
        );
        expect(
          source.triangles,
          `${era}/${building.id}: source triangle ceiling`,
        ).toBeLessThanOrEqual(PLOT_BUDGET.triangles);
        expect(
          module.meshes,
          `${era}/${building.id}: single module mesh ceiling`,
        ).toBeLessThanOrEqual(MODULE_BUDGET.meshes);
        expect(
          module.triangles,
          `${era}/${building.id}: single module triangle ceiling`,
        ).toBeLessThanOrEqual(MODULE_BUDGET.triangles);
        let unbatched = 0;
        root.traverse((mesh) => {
          if (!mesh.isMesh) return;
          let animated = false;
          for (let node = mesh; node && node !== root; node = node.parent)
            if (node.userData.animated) animated = true;
          if (
            animated ||
            mesh.isInstancedMesh ||
            mesh.material.transparent ||
            !mesh.material.isMeshStandardMaterial ||
            mesh.material.map
          )
            unbatched++;
        });
        const scene = new Scene();
        scene.add(root);
        const statics = new TownStatics(scene);
        try {
          statics.sync([root]);
          const batched = meshStatistics(scene, true);
          // One opaque vertex-color plot batch plus its optional shadowless
          // child; transparent/animated assemblies retain their own buckets.
          // This ceiling is per actual batch, independent of primitive count.
          const ceiling = 2 + unbatched;
          expect(
            batched.meshes,
            `${era}/${building.id}/finish${level}: static batch ceiling`,
          ).toBeLessThanOrEqual(ceiling);
          expect(
            batched.triangles,
            `${era}/${building.id}: batching keeps all rendered triangles`,
          ).toBeCloseTo(source.triangles, 4);
          samples.push({
            level,
            rawMeshes: source.meshes,
            triangles: source.triangles,
            moduleMeshes: module.meshes,
            moduleTriangles: module.triangles,
            postBatchVisibleMeshes: batched.meshes,
            postBatchTriangles: batched.triangles,
            batchCeiling: ceiling,
          });
        } finally {
          statics.dispose();
          d.clearGroup(root);
        }
      }
      const maximum = (key) => Math.max(...samples.map((sample) => sample[key]));
      report.rawMeshesUpperBound += maximum('rawMeshes');
      report.rawTrianglesUpperBound += maximum('triangles');
      report.moduleMeshesUpperBound += maximum('moduleMeshes');
      report.moduleTrianglesUpperBound += maximum('moduleTriangles');
      report.postBatchVisibleMeshesUpperBound += maximum('postBatchVisibleMeshes');
      report.postBatchTrianglesUpperBound += maximum('postBatchTriangles');
      report.batchCeilingUpperBound += maximum('batchCeiling');
      report.details.push({ building: building.id, finishEra: finish, samples });
    }
    expect(report.rawMeshesUpperBound).toBeGreaterThan(report.postBatchVisibleMeshesUpperBound);
    expect(report.postBatchVisibleMeshesUpperBound).toBeLessThanOrEqual(
      report.batchCeilingUpperBound,
    );
    console.info(`TOWN_MODULE_BUDGET ${JSON.stringify(report)}`);
  },
  120000,
);
