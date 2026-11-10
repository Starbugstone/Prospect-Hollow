import { describe, expect, it } from 'vitest';
import { Box3, Group } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { renderMoonBuilding } from '../src/game/town/buildings/moon';
import { RISING_FORMS } from '../src/game/town/buildings/moonRising';
import {
  MOON_LOTS,
  MOON_ROADS,
  moonApproaches,
  moonLotDistrict,
  moonPadApothem,
  moonPadRadius,
} from '../src/data/moonSettlement';
import { moonRoofHeight } from '../src/game/town/moon/MoonScene';
import { moonRoadWalk } from '../src/game/town/moon/MoonSettlers';
import { RISING_DRAWINGS } from '../src/components/town/moonRisingDrawings';
import TownMoonBuilding from '../src/components/town/TownMoonBuilding.vue';

const KINDS = Object.keys(RISING_FORMS);
const OUTER = MOON_ROADS.rings.at(-1);
const svg = (props) =>
  renderToString(createSSRApp({ render: () => h('svg', [h(TownMoonBuilding, props)]) }));

// How far outside an octagonal pad (a corner on each axis) a point lies; negative is inside.
const beyondPad = (x, z, radius) =>
  Math.max(
    Math.abs(x) * Math.sin(Math.PI / 8) + Math.abs(z) * Math.cos(Math.PI / 8),
    Math.abs(z) * Math.sin(Math.PI / 8) + Math.abs(x) * Math.cos(Math.PI / 8),
  ) - moonPadApothem(radius);

describe('New Hollow Rising: the outer ring buildings', () => {
  it('gives every outer lot a form, a drawing and a path to the outer road', () => {
    const outerLots = Object.entries(MOON_LOTS)
      .filter(([id, at]) => Math.hypot(...at) > OUTER && !moonLotDistrict(id))
      .map(([id]) => id);
    expect([...KINDS].sort()).toEqual([...outerLots].sort());
    expect([...RISING_DRAWINGS].sort()).toEqual([...KINDS].sort());
    // A later era's district lots have their own drawings (moonSignalDrawings.js).
    for (const route of moonApproaches().filter(({ id }) => KINDS.includes(id))) {
      expect(route.clear, route.id).toBe(true);
      expect(route.ring, route.id).toBe(OUTER);
    }
  });

  it('walks between rings when a path ends exactly on a spoke', () => {
    const [inner] = MOON_ROADS.rings;
    for (const spoke of MOON_ROADS.spokes) {
      const on = (ring, angle) => [Math.cos(angle) * ring, Math.sin(angle) * ring];
      for (const [from, to, a, b] of [
        [on(inner, spoke + 1), on(OUTER, spoke), inner, OUTER],
        [on(OUTER, spoke), on(inner, spoke + 1), OUTER, inner],
        [on(inner, spoke), on(OUTER, spoke), inner, OUTER],
      ]) {
        const walk = moonRoadWalk(from, to, a, b);
        expect(walk.length).toBeGreaterThan(0);
        expect(walk.flat().every(Number.isFinite)).toBe(true);
      }
    }
  });

  it.each(KINDS)('keeps %s on its octagonal pad at every level', (kind) => {
    const d = new TownPrimitives();
    try {
      for (const level of [1, 2, 3]) {
        const root = renderMoonBuilding(d, new Group(), kind, level);
        root.updateMatrixWorld(true);
        root.traverse((part) => {
          if (!part.isMesh || part.userData.parcelPad) return;
          const box = new Box3().setFromObject(part);
          // A part's box is checked at its middle and its four sides, as round parts
          // do not fill their corners.
          const [cx, cz] = [(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2];
          for (const [x, z] of [
            [box.min.x, cz],
            [box.max.x, cz],
            [cx, box.min.z],
            [cx, box.max.z],
          ])
            expect(
              beyondPad(x, z, moonPadRadius(kind)),
              `${kind} L${level} ${part.name}`,
            ).toBeLessThan(0);
        });
      }
    } finally {
      d.disposePrimitives();
    }
  });

  it('grows each building upward or outward with its level, and keeps the low ones low', () => {
    const d = new TownPrimitives();
    const meshes = (root) => {
      let count = 0;
      root.traverse((part) => (count += part.isMesh ? 1 : 0));
      return count;
    };
    try {
      for (const kind of KINDS) {
        const counts = [1, 2, 3].map((level) =>
          meshes(renderMoonBuilding(d, new Group(), kind, level)),
        );
        expect(counts[1], kind).toBeGreaterThan(counts[0]);
        expect(counts[2], kind).toBeGreaterThan(counts[1]);
      }
      // The pond garden lies by the saucer's flight line: nothing taller than a settler.
      // The dish stays under the risen Earth.
      const roof = (kind) => moonRoofHeight(renderMoonBuilding(d, new Group(), kind, 3));
      expect(roof('craterPondGarden')).toBeLessThan(1.3);
      expect(roof('starwatchDish')).toBeLessThan(4.6);
    } finally {
      d.disposePrimitives();
    }
  });

  it.each(KINDS)('draws %s as an illustration at every stage', async (kind) => {
    const stages = new Set();
    for (const level of [0, 1, 2, 3]) {
      const html = await svg({ kind, level });
      expect(html).not.toMatch(/NaN|undefined/);
      expect(html).toContain(`data-moon-form="${kind}"`);
      // Only palette colours: no shape falls back to black.
      expect(html).not.toMatch(/<(rect|circle|ellipse|path)(?![^>]*\b(fill|stroke)=)[^>]*>/);
      stages.add(html);
    }
    expect(stages.size).toBe(4);
  });
});
