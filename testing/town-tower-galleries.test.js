import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Group } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  TOWER_GALLERIES,
  galleryOverlaps,
  towerGallery,
  towerStoreys,
} from '../src/data/towerRefinements';
import { ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { renderCozyBuilding } from '../src/game/town/buildings/cozy';
import { renderFutureBuilding } from '../src/game/town/buildings/future';
import { addTowerGallery } from '../src/game/town/buildings/future/towerRefinements';
import TownCozyBuilding from '../src/components/town/TownCozyBuilding.vue';
import TownFutureBuilding from '../src/components/town/TownFutureBuilding.vue';

const KINDS = Object.keys(TOWER_GALLERIES);
const ERAS = ['canopy', 'riverlight', 'skysail', 'stargazer', 'moonward', 'twin-hollows'];
const SUCCESSOR = 'tower-gallery-successor';
afterEach(() => delete ERA_BY_ID[SUCCESSOR]);
const cosy = (era) => ['canopy', 'riverlight'].includes(era);
function descendants(root, predicate) {
  const found = [];
  root.traverse((part) => {
    if (predicate(part)) found.push(part);
  });
  return found;
}
const meshes = (root) => descendants(root, (part) => part.isMesh);
const galleries = (root) => descendants(root, (part) => part.userData.towerGallery);
function model(d, era, kind, level, serviceLevel = 3) {
  const parent = new Group();
  (cosy(era) ? renderCozyBuilding : renderFutureBuilding)(
    d,
    parent,
    kind,
    kind,
    level,
    era,
    serviceLevel,
  );
  parent.updateMatrixWorld(true);
  return parent;
}
function retained(root) {
  return descendants(root, (part) => part.userData.galleryPart === 'structure').map((part) =>
    meshes(part).map((mesh) => [mesh.geometry.uuid, ...mesh.matrixWorld.elements]),
  );
}
function drawing(run) {
  const d = new TownPrimitives();
  d.sign = () => {};
  try {
    return run(d);
  } finally {
    d.disposePrimitives();
  }
}

describe('retained upper galleries and folding tower shades', () => {
  it('safely skips unsupported, incomplete and small-room definitions', () => {
    const s = { kind: 'hotel', style: 'sail', structureLevel: 3, finishLevel: 1 };
    for (const changes of [
      { kind: 'home' },
      { kind: 'constructor' },
      { style: 'missing' },
      { style: 'constructor' },
      { structureLevel: undefined },
      { structureLevel: 1 },
    ])
      expect(towerGallery({ ...s, ...changes }, { r: 1, h: 5 })).toBeNull();
    for (const size of [
      { r: 1, h: 1.55 },
      { r: 0, h: 5 },
      { r: Infinity, h: 5 },
      { r: 1, h: NaN },
    ])
      expect(towerGallery(s, size)).toBeNull();
    drawing((d) => {
      const root = new Group();
      expect(addTowerGallery(d, root, { ...s, kind: 'home' }, { r: 1, h: 5 })).toBeNull();
      expect(root.children).toHaveLength(0);
    });
  });

  it('keeps the mature envelope while glazing and the existing shades change', () => {
    const variants = [1, 2, 3].map((finishLevel) =>
      towerGallery(
        { kind: 'hotel', style: 'homestead', structureLevel: 3, finishLevel },
        { r: 1.15, h: 4.7 },
      ),
    );
    expect(new Set(variants.map((g) => `${g.floor},${g.radius},${g.height}`)).size).toBe(1);
    expect(variants[1].windowHeight).toBeGreaterThan(variants[0].windowHeight * 2);
    expect(variants[2].bladeDepth).toBeGreaterThan(variants[1].bladeDepth);
    expect(variants[2].pitch).toBeGreaterThan(0);
    expect(galleryOverlaps(variants[0], variants[0].floor, variants[0].floor + 0.1)).toBe(true);
    expect(galleryOverlaps(variants[0], 0, 1.8)).toBe(false);
  });

  it.each(ERAS)('retains supported galleries and ground access across all %s finishes', (era) =>
    drawing((d) => {
      for (const kind of KINDS) {
        const roots = [1, 2, 3].map((level) => model(d, era, kind, level));
        const count = kind === 'skyline' ? 3 : kind === 'cityHomes' ? 2 : 1;
        for (const [n, root] of roots.entries()) {
          const groups = galleries(root);
          expect(groups, `${kind} finish${n + 1}`).toHaveLength(count);
          for (const gallery of groups) {
            expect(
              new Box3().setFromObject(gallery).min.y,
              `${kind} overhead clearance`,
            ).toBeGreaterThan(1.85);
            expect(
              meshes(gallery).filter((mesh) => mesh.name === 'Gallery folding shade'),
            ).toHaveLength(4);
            expect(
              meshes(gallery).filter((mesh) => mesh.name === 'Wall-seated gallery bracket'),
            ).toHaveLength(4);
            expect(
              descendants(gallery, (part) => part.isLight || part.userData.animated),
            ).toHaveLength(0);
          }
        }
        expect(retained(roots[1])).toEqual(retained(roots[0]));
        expect(retained(roots[2])).toEqual(retained(roots[0]));
      }
    }),
  );

  it('reuses cached surfaces and keeps each gallery under 128 triangles', () =>
    drawing((d) => {
      for (const era of ERAS) for (const kind of KINDS) model(d, era, kind, 3);
      const cache = new Set(Object.values(d.geometries));
      for (const era of ERAS)
        for (const kind of KINDS) {
          for (const gallery of galleries(model(d, era, kind, 3))) {
            const parts = meshes(gallery);
            expect(parts).toHaveLength(14);
            expect(
              parts.reduce(
                (n, part) =>
                  n + (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3,
                0,
              ),
            ).toBeLessThan(128);
            expect(parts.every((part) => cache.has(part.geometry))).toBe(true);
          }
        }
      expect(new Set(Object.values(d.geometries))).toEqual(cache);
    }));

  it('preserves triangles and bounds through the older primitive batching path', () =>
    drawing((d) => {
      for (const era of ERAS)
        for (const kind of KINDS) {
          const root = model(d, era, kind, 3),
            before = new Box3().setFromObject(root, true);
          const triangles = meshes(root).reduce(
            (n, part) =>
              n + (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3,
            0,
          );
          expect(() => d.batch(root), `${era} ${kind}`).not.toThrow();
          const after = new Box3().setFromObject(root, true);
          expect(after.min.distanceTo(before.min)).toBeLessThan(1e-5);
          expect(after.max.distanceTo(before.max)).toBeLessThan(1e-5);
          expect(
            meshes(root).reduce(
              (n, part) =>
                n + (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3,
              0,
            ),
          ).toBe(triangles);
          d.clearGroup(root);
        }
    }));

  it('keeps the open shade edges below the existing roof seat', () =>
    drawing((d) => {
      for (const style of ['canopy', 'riverlight', 'sail', 'observatory', 'homestead', 'twin'])
        for (const kind of KINDS)
          for (const [r, height] of [
            [1.35, 3.6],
            [1.05, 3],
            [0.75, 2.4],
            [1.15, 4.7],
            [0.8, 7],
          ]) {
            const root = new Group();
            addTowerGallery(
              d,
              root,
              {
                kind,
                style,
                structureLevel: 3,
                finishLevel: 3,
                palette: {
                  timber: '#886644',
                  light: '#eeddaa',
                  green: '#779966',
                  roof: '#aabbcc',
                  shell: '#eeddbb',
                  glass: '#99bbbb',
                },
              },
              { r, h: height },
            );
            root.updateMatrixWorld(true);
            expect(new Box3().setFromObject(root).max.y, `${style} ${kind} ${height}`).toBeLessThan(
              height,
            );
          }
    }));

  it('inherits the architecture of a synthetic successor without era-name branches', () =>
    drawing((d) => {
      ERA_BY_ID[SUCCESSOR] = { evolution: { ...eraEvolution('stargazer') } };
      const root = model(d, SUCCESSOR, 'hotel', 1);
      expect(galleries(root)).toHaveLength(1);
      expect(galleries(root)[0].userData.towerGallery.style).toBe('observatory');
      expect(galleries(root)[0].userData.towerGallery.finish).toBe(1);
    }));

  it.each(ERAS)('matches gallery counts and finish states in the %s SVG drawing', async (era) => {
    for (const kind of KINDS)
      for (const level of [1, 2, 3]) {
        const svg = await renderToString(
          createSSRApp({
            render: () =>
              h('svg', [
                h(cosy(era) ? TownCozyBuilding : TownFutureBuilding, {
                  kind,
                  era,
                  level,
                  serviceLevel: 3,
                }),
              ]),
          }),
        );
        expect(svg).not.toMatch(/NaN|undefined/);
        expect((svg.match(/data-tower-gallery=/g) ?? []).length).toBe(
          kind === 'skyline' ? 3 : kind === 'cityHomes' ? 2 : 1,
        );
        expect(svg).toContain(`data-gallery-finish="${level}"`);
      }
  });
});

it('keeps a renderer’s own storey spacing for a style without galleries (a future era)', () => {
  const fallback = { first: 1.3, storey: 1.1 };
  expect(towerStoreys('a-future-style', fallback)).toBe(fallback);
  expect(towerStoreys('a-future-style')).toBeNull();
  expect(towerStoreys('sail', fallback)).not.toBe(fallback);
  expect(
    towerGallery(
      { kind: 'apartments', style: 'a-future-style', structureLevel: 3 },
      { r: 1, h: 6 },
    ),
  ).toBeNull();
});
