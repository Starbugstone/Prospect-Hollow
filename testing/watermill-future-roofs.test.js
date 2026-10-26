import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Group, Triangle, Vector3 } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { futureAppearance } from '../src/data/futureArchitecture';
import { WATERMILL_SITE, watermillAppearance } from '../src/data/watermill';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { WATERMILL_WHEEL, renderWatermill } from '../src/game/town/buildings/watermill';
import TownWatermill from '../src/components/town/TownWatermill.vue';

const ERAS = ['skysail', 'stargazer', 'moonward', 'twin-hollows'];
const SUCCESSOR = 'watermill-roof-successor';
afterEach(() => delete ERA_BY_ID[SUCCESSOR]);

function drawing(run) {
  const d = new TownPrimitives();
  d.sign = () => {};
  try {
    return run(d);
  } finally {
    d.disposePrimitives();
  }
}
function model(d, era, level) {
  const root = renderWatermill(d, new Group(), era, level, 'Watermill');
  root.updateMatrixWorld(true);
  return root;
}
function roofs(root) {
  const result = [];
  root.traverse((part) => {
    if (/^Watermill .+ roof$/.test(part.name)) result.push(part);
  });
  return result;
}
function meshes(root) {
  const result = [];
  root.traverse((part) => {
    if (part.isMesh) result.push(part);
  });
  return result;
}
function intersects(root, box) {
  const triangle = new Triangle();
  for (const part of meshes(root)) {
    const positions = part.geometry.attributes.position;
    const index = part.geometry.index;
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      for (const [offset, vertex] of [
        [0, triangle.a],
        [1, triangle.b],
        [2, triangle.c],
      ])
        vertex
          .fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset)
          .applyMatrix4(part.matrixWorld);
      if (box.intersectsTriangle(triangle)) return true;
    }
  }
  return false;
}

describe('heritage watermill roofs in future settlements', () => {
  it('inherits a future architecture and keeps unsupported definitions safe', () => {
    ERA_BY_ID[SUCCESSOR] = { evolution: { ...eraEvolution('stargazer') } };
    expect(watermillAppearance(SUCCESSOR).future).toEqual(futureAppearance('stargazer'));
    drawing((d) => {
      const root = model(d, SUCCESSOR, 3);
      expect(roofs(root).map((roof) => roof.name)).toEqual([
        'Watermill observatory roof',
        'Watermill observatory roof',
      ]);
    });
    ERA_BY_ID[SUCCESSOR] = { evolution: { style: 'city', architecture: 'unregistered' } };
    expect(watermillAppearance(SUCCESSOR).future).toBeNull();
    expect(watermillAppearance('missing-era')).toEqual(watermillAppearance('frontier'));
  });

  it.each(ERAS)('keeps the working wheel, entrance and loading expansion in %s', (era) =>
    drawing((d) => {
      const reference = model(d, 'frontier', 3).getObjectByName(WATERMILL_WHEEL);
      for (const level of [1, 2, 3]) {
        const root = model(d, era, level);
        const wheel = root.getObjectByName(WATERMILL_WHEEL);
        expect(wheel.position.toArray()).toEqual([
          WATERMILL_SITE.wheelX,
          WATERMILL_SITE.axleHeight,
          0,
        ]);
        expect(wheel.children.map((part) => [part.geometry.uuid, ...part.matrix.elements])).toEqual(
          reference.children.map((part) => [part.geometry.uuid, ...part.matrix.elements]),
        );
        expect(!!root.getObjectByName('Watermill grain loading expansion')).toBe(level === 3);
        expect(roofs(root)).toHaveLength(level === 3 ? 2 : 1);

        // A standing person can reach the original door beneath both canopies.
        const approach = new Box3(new Vector3(-0.8, 0.4, 1.36), new Vector3(0.1, 1.85, 3.2));
        for (const roof of roofs(root)) expect(intersects(roof, approach)).toBe(false);

        // Roof supports remain clear of the wheel at every sampled rotation.
        for (const angle of [0, Math.PI / 4, Math.PI / 2]) {
          wheel.rotation.x = angle;
          root.updateMatrixWorld(true);
          const sweep = new Box3().setFromObject(wheel).expandByScalar(0.08);
          for (const roof of roofs(root)) expect(intersects(roof, sweep)).toBe(false);
        }
      }
    }),
  );

  it('grounds the sailcloth supports without changing shared roof geometries', () =>
    drawing((d) => {
      const root = model(d, 'skysail', 3);
      for (const roof of roofs(root)) {
        const supports = meshes(roof).filter(
          (part) => part.geometry === d.geometries.cylinder && part.scale.y > 1,
        );
        expect(supports).toHaveLength(4);
        for (const support of supports)
          expect(new Box3().setFromObject(support).min.y).toBeCloseTo(0, 6);
        expect(meshes(roof).some((part) => part.geometry === d.geometries['future-hypar'])).toBe(
          true,
        );
      }
    }));

  it('bounds static roof work and reuses geometry across purchases', () =>
    drawing((d) => {
      for (const era of ERAS) model(d, era, 3);
      const geometries = new Set(Object.values(d.geometries));
      for (const era of ERAS)
        for (const level of [1, 2, 3]) {
          const root = model(d, era, level);
          const triangles = roofs(root)
            .flatMap(meshes)
            .reduce(
              (sum, part) =>
                sum + (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3,
              0,
            );
          expect(triangles, `${era} stage ${level}`).toBeLessThan(900);
          expect(roofs(root).flatMap(meshes).length).toBeLessThanOrEqual(20);
          expect(
            roofs(root)
              .flatMap(meshes)
              .every((part) => geometries.has(part.geometry)),
          ).toBe(true);
          expect(root.children.some((part) => part.isLight)).toBe(false);
        }
      expect(new Set(Object.values(d.geometries))).toEqual(geometries);
    }));

  it.each(ERAS)('uses the same %s roof style in the accessible drawing', async (era) => {
    const style = watermillAppearance(era).future.style;
    for (const level of [1, 2, 3]) {
      const svg = await renderToString(
        createSSRApp({
          render: () => h('svg', [h(TownWatermill, { era, level })]),
        }),
      );
      expect(svg).toContain(`data-watermill-roof="${style}"`);
      expect(svg).not.toMatch(/undefined|NaN/);
      expect(svg).toContain('translate(52 -14)');
      if (style === 'sail') expect(svg).toMatch(/Q[^"]+Z/);
      else if (style === 'observatory') expect(svg).toContain('a32.4 32.4');
      else expect(svg).toContain(watermillAppearance(era).future.palette.light);
    }
  });
});
