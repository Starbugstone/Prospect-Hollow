import { expect, it } from 'vitest';
import { DoubleSide, Group, Raycaster, Vector3 } from 'three';
import {
  MOON_LOTS,
  MOON_LOT_RADIUS,
  MOON_RING_ROAD,
  moonApproach,
  moonApproaches,
  moonEntrance,
  moonLotPose,
  moonPadRadius,
  moonSegmentDistance,
} from '../src/data/moonSettlement';
import { moonAccessGeometry, moonHeight } from '../src/game/town/moon/MoonScene';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { renderMoonBuilding } from '../src/game/town/buildings/moon';

it('connects all authored arrivals to the ring without crossing another parcel or a crater', () => {
  const routes = moonApproaches();
  expect(routes).toHaveLength(Object.keys(MOON_LOTS).length);
  for (const route of routes) {
    expect(route.clear, route.id).toBe(true);
    expect(route.points[0]).toEqual(route.entry);
    expect(Math.hypot(...route.points.at(-1)), route.id).toBeCloseTo(MOON_RING_ROAD, 8);
    for (let n = route.apronSegments; n < route.points.length - 1; n++) {
      const a = route.points[n],
        b = route.points[n + 1];
      for (const [id, [x, z]] of Object.entries(MOON_LOTS))
        expect(moonSegmentDistance(x, z, a, b), `${route.id} crosses ${id}`).toBeGreaterThanOrEqual(
          (id === route.id ? route.padRadius + 0.45 : Math.max(5, moonPadRadius(id)) + 0.8) - 1e-8,
        );
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let step = 0; step <= Math.ceil(length / 0.25); step++) {
        const t = step / Math.max(1, Math.ceil(length / 0.25));
        const x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        expect(moonHeight(x, z), `${route.id} crater on approach`).toBeCloseTo(0, 7);
      }
    }
  }
});

it.each(Object.keys(MOON_LOTS).flatMap((id) => [1, 2, 3].map((level) => [id, level])))(
  '%s L%s has a clear authored pad approach through its actual building geometry',
  (id, level) => {
    const d = new TownPrimitives(),
      root = new Group();
    const route = moonApproaches({ [id]: level })[0];
    const pose = moonLotPose(id);
    root.position.set(pose.x, 0, pose.z);
    root.rotation.y = pose.rotation;
    renderMoonBuilding(d, root, id, level);
    root.traverse((part) => {
      if (part.isMesh) part.material.side = DoubleSide;
    });
    root.updateMatrixWorld(true);
    try {
      expect(route.points[0]).toEqual(moonEntrance(id, level));
      if (id !== 'craterIceWell') {
        const entry = route.points[0],
          next = route.points[1];
        const outward = new Vector3(next[0] - entry[0], 0, next[1] - entry[1]).normalize();
        const origin = new Vector3(
          entry[0],
          id === 'earthriseLookout' ? 0.4 : 0.65,
          entry[1],
        ).addScaledVector(outward, 0.35);
        const arrival = new Raycaster(origin, outward.clone().negate(), 0, 0.5).intersectObject(
          root,
          true,
        )[0];
        expect(arrival, `${id} path must meet its actual hatch or first stair`).toBeDefined();
        expect(
          Math.hypot(arrival.point.x - entry[0], arrival.point.z - entry[1]),
          `${id} path endpoint distance to its authored entrance`,
        ).toBeLessThan(0.11);
      }
      for (let n = 0; n < route.apronSegments; n++) {
        const a = route.points[n],
          b = route.points[n + 1];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let distance = n ? 0 : 0.3; distance < length; distance += 0.2) {
          const t = distance / length;
          for (const side of [-0.28, 0, 0.28]) {
            const x = a[0] + (b[0] - a[0]) * t - ((b[1] - a[1]) / length) * side;
            const z = a[1] + (b[1] - a[1]) * t + ((b[0] - a[0]) / length) * side;
            const hit = new Raycaster(
              new Vector3(x, 0.29, z),
              new Vector3(0, 1, 0),
              0,
              1.35,
            ).intersectObject(root, true)[0];
            expect(
              hit,
              `${id} L${level} obstacle at ${x.toFixed(2)},${z.toFixed(2)}`,
            ).toBeUndefined();
          }
        }
      }
    } finally {
      d.disposePrimitives();
    }
  },
);

it('uses one bounded static entrance mesh with supported pad ramps and compatible attributes', () => {
  const geometry = moonAccessGeometry();
  try {
    expect(geometry.index.count / 3).toBeLessThan(500);
    expect(geometry.index.count).toBeGreaterThan(60);
    expect(Object.keys(geometry.attributes).sort()).toEqual(['color', 'normal', 'position', 'uv']);
    expect(geometry.attributes.color.count).toBe(geometry.attributes.position.count);
    const p = geometry.attributes.position;
    expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
    for (let n = 0; n < p.count; n++) expect(p.getY(n)).toBeGreaterThanOrEqual(0.039);
    expect(
      Array.from(p.array)
        .filter((_, n) => n % 3 === 1)
        .some((y) => y > 0.26),
    ).toBe(true);
  } finally {
    geometry.dispose();
  }
});

it('preserves existing lot poses, filters unbuilt lots and extends safely to a new lot', () => {
  for (const [id, [x, z]] of Object.entries(MOON_LOTS)) {
    const expected =
      id === 'ribbonLanding' ? 0 : Math.atan2(-x, -(z + 8)) + (id === 'saucerPad' ? 0 : Math.PI);
    expect(moonLotPose(id).rotation).toBe(expected);
  }
  expect(moonApproaches({})).toEqual([]);
  expect(moonApproaches({ willowkinDome: 1 })[0].entry).not.toEqual(
    moonApproaches({ willowkinDome: 2 })[0].entry,
  );
  const lots = { ...MOON_LOTS, lunarBakery: [0, -34] };
  expect(moonPadRadius('lunarBakery')).toBe(MOON_LOT_RADIUS);
  const route = moonApproach('lunarBakery', 1, lots);
  expect(route.clear).toBe(true);
  expect(route.points.flat().every(Number.isFinite)).toBe(true);
  expect(Math.hypot(...route.points.at(-1))).toBeCloseTo(MOON_RING_ROAD, 8);
});
