import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Scene } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { renderCityBuilding } from '../src/game/town/buildings/city';
import { renderCozyBuilding } from '../src/game/town/buildings/cozy';
import { renderWatermill } from '../src/game/town/buildings/watermill';
import { CITY_FAMILIES } from '../src/data/city';
import { ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { defineEra } from '../src/data/eraDefinitions';
import { createTown, BUILDING_BY_ID } from '../src/data/town';
import {
  COZY_LANDMARKS,
  COZY_PALETTES,
  cozyAppearance,
  cozyForm,
  isCozyEra,
} from '../src/data/cozyArchitecture';
import { GARDEN_PARCELS } from '../src/data/townGardenDistrict';
import TownBuilding from '../src/components/town/TownBuilding.vue';

function diorama(era) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    town: { ...createTown(), era },
  });
  d.sign = () => {};
  return d;
}
function snapshot(root) {
  const parts = [];
  root.updateMatrixWorld(true);
  root.traverse((mesh) => {
    if (mesh.isMesh) parts.push([mesh.material.color.getHex(), mesh.matrixWorld.toArray()]);
  });
  return JSON.stringify(parts);
}
function cost(root) {
  let triangles = 0;
  const materials = new Set();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    materials.add(mesh.material);
  });
  return { triangles, materials: materials.size };
}
function dispose(d) {
  Object.values(d.geometries).forEach((geometry) => geometry.dispose());
  d.materials.forEach((material) => material.dispose());
  d.contactShadowMaterial.dispose();
}
afterEach(() => delete ERA_BY_ID['cozy-successor']);

describe('Shared cozy architecture', () => {
  it('uses distinct bounded palettes and safely supports incomplete successors', () => {
    expect(isCozyEra('canopy')).toBe(true);
    expect(isCozyEra('riverlight')).toBe(true);
    expect(isCozyEra('tomorrow')).toBe(false);
    expect(isCozyEra('unknown-save-era')).toBe(false);
    expect(new Set(Object.values(COZY_PALETTES.canopy)).size).toBe(8);
    expect(new Set(Object.values(COZY_PALETTES.riverlight)).size).toBe(8);
    expect(COZY_PALETTES.canopy).not.toEqual(COZY_PALETTES.riverlight);
    ERA_BY_ID['cozy-successor'] = {
      evolution: { ...eraEvolution('canopy'), cozyStyle: 'missing' },
    };
    expect(cozyAppearance('cozy-successor').palette).toBe(COZY_PALETTES.canopy);
    expect(cozyForm('missing-building')).toBeNull();
    expect(cozyForm('constructor')).toBeNull();
  });

  it.each(['canopy', 'riverlight'])(
    'renders every %s family through three distinct paid stages',
    (era) => {
      const d = diorama(era),
        geometries = new Set(Object.values(d.geometries));
      for (const kind of Object.keys(CITY_FAMILIES)) {
        if (!cozyForm(kind)) continue;
        const stages = new Set();
        for (const level of [1, 2, 3]) {
          const root = new Group();
          expect(renderCityBuilding(d, root, kind, kind, level, era, 3), kind).toBe(true);
          stages.add(snapshot(root));
          const art = root.getObjectByName(`${era} cozy ${kind} level ${level}`);
          expect(art, kind).toBeTruthy();
          art.traverse((part) => {
            expect(part.isLight, kind).not.toBe(true);
            if (part.isMesh && !part.userData.exportFootprints)
              expect(part.matrixWorld.elements.every(Number.isFinite), kind).toBe(true);
          });
          if (
            !['garden', 'square'].includes(cozyForm(kind)) &&
            !['stable', 'garage', 'busDepot'].includes(kind)
          ) {
            const budget = cost(art);
            expect(budget.triangles, kind).toBeLessThan(COZY_LANDMARKS[kind] ? 6000 : 4000);
            expect(budget.materials, kind).toBeLessThanOrEqual(8);
          }
        }
        expect(stages.size, kind).toBe(3);
      }
      // Both tailored surfaces are cached once. Rebuilding a plot shares them and
      // does not expand the geometry cache or replace the existing primitives.
      const leaf = d.geometries['cozy-leaf'],
        seed = d.geometries['cozy-seed-panel'],
        count = Object.keys(d.geometries).length;
      for (const kind of ['home', 'blossomAtelier'])
        renderCityBuilding(d, new Group(), kind, kind, 3, era);
      expect(d.geometries['cozy-leaf']).toBe(leaf);
      expect(d.geometries['cozy-seed-panel']).toBe(seed);
      expect(Object.keys(d.geometries)).toHaveLength(count);
      expect(
        [...geometries].every((geometry) => Object.values(d.geometries).includes(geometry)),
      ).toBe(true);
      dispose(d);
    },
  );

  it.each(['canopy', 'riverlight'])(
    'keeps every %s landmark inside its reserved garden parcel',
    (era) => {
      const d = diorama(era);
      for (const [kind, parcel] of Object.entries(GARDEN_PARCELS)) {
        const root = new Group();
        renderCozyBuilding(d, root, kind, kind, 3, era);
        const bounds = new Box3().setFromObject(root, true);
        expect(bounds.min.x, kind).toBeGreaterThanOrEqual(-parcel.halfWidth);
        expect(bounds.max.x, kind).toBeLessThanOrEqual(parcel.halfWidth);
        expect(bounds.min.z, kind).toBeGreaterThanOrEqual(-parcel.halfDepth);
        expect(bounds.max.z, kind).toBeLessThanOrEqual(parcel.halfDepth);
        expect(bounds.max.z, `${kind} pedestrian frontage`).toBeLessThan(parcel.entranceZ - 0.35);
      }
      dispose(d);
    },
  );

  it('retains the working watermill wheel in both cozy styles and changes each tier', () => {
    const d = diorama('canopy');
    const eras = new Set();
    for (const era of ['canopy', 'riverlight']) {
      const stages = new Set();
      for (const level of [1, 2, 3]) {
        const root = new Group();
        renderWatermill(d, root, era, level, 'Watermill');
        expect(root.getObjectByName('Watermill wheel')).toBeTruthy();
        stages.add(snapshot(root));
      }
      expect(stages.size).toBe(3);
      eras.add([...stages].at(-1));
    }
    expect(eras.size).toBe(2);
    dispose(d);
  });

  it('extends the same architecture through capability definitions without renderer changes', () => {
    ERA_BY_ID['cozy-successor'] = defineEra({
      ...ERA_BY_ID.canopy,
      id: 'cozy-successor',
      evolution: { ...eraEvolution('canopy') },
    });
    const d = diorama('canopy');
    for (const kind of ['home', 'blossomAtelier', 'skyPods']) {
      const before = new Group(),
        after = new Group();
      renderCityBuilding(d, before, kind, kind, 3, 'canopy');
      renderCityBuilding(d, after, kind, kind, 3, 'cozy-successor');
      expect(snapshot(after), kind).toBe(snapshot(before));
    }
    dispose(d);
  });

  it('draws accessible illustrations from the same forms, palettes and stages', async () => {
    for (const era of ['canopy', 'riverlight'])
      for (const id of [
        'home',
        'saloon',
        'watermill',
        'museum',
        'skyPods',
        'bridge',
        'airport',
        ...Object.keys(COZY_LANDMARKS),
      ]) {
        const stages = new Set();
        for (const level of [1, 2, 3]) {
          const html = await renderToString(
            createSSRApp({
              render: () => h('svg', [h(TownBuilding, { id, era, eraLevel: level, stage: 3 })]),
            }),
          );
          expect(html, id).not.toContain('NaN');
          expect(html, id).toContain(cozyAppearance(era).palette.shell);
          if (id !== 'watermill')
            expect(html, id).toContain(`data-form="${cozyForm(BUILDING_BY_ID[id].kind) ?? id}"`);
          stages.add(html);
        }
        expect(stages.size, `${era} ${id}`).toBe(3);
      }
  });
});
