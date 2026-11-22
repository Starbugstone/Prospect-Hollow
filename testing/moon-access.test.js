import { expect, it } from 'vitest';
import { Box3, DoubleSide, Group, Raycaster, Vector3 } from 'three';
import {
  MOON_DISTRICTS,
  MOON_LOTS,
  MOON_LOT_RADIUS,
  MOON_PAD_TOP,
  MOON_PATH_LIFT,
  MOON_RING_ROAD,
  MOON_ROADS,
  MOON_ROAD_LIFT,
  moonApproach,
  moonApproachHeight,
  moonApproaches,
  moonEntrance,
  moonLotDistrict,
  moonLotPose,
  moonPadRadius,
  moonSegmentDistance,
} from '../src/data/moonSettlement';
import { moonAccessGeometry, moonHeight } from '../src/game/town/moon/MoonScene';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { moonParcelPad, renderMoonBuilding } from '../src/game/town/buildings/moon';
import { MOON_SAUCER_PAD } from '../src/game/town/moon/MoonSaucer';
import { moonHatch } from '../src/game/town/moon/MoonSettlers';

it('connects all authored arrivals to the ring without crossing another parcel or a crater', () => {
  const routes = moonApproaches();
  expect(routes).toHaveLength(Object.keys(MOON_LOTS).length);
  for (const route of routes) {
    expect(route.clear, route.id).toBe(true);
    expect(route.points[0]).toEqual(route.entry);
    // Each path ends on its own ring road: the inner ring, the outer one beyond it, or
    // the ring of the district its lot stands in.
    const district = moonLotDistrict(route.id);
    expect(route.district, route.id).toBe(district?.id ?? null);
    if (district) expect(route.ring, route.id).toBe(district.ring);
    else {
      expect(MOON_ROADS.rings, route.id).toContain(route.ring);
      expect(route.ring, route.id).toBe(
        Math.hypot(...MOON_LOTS[route.id]) > MOON_ROADS.rings.at(-1)
          ? MOON_ROADS.rings.at(-1)
          : MOON_RING_ROAD,
      );
    }
    expect(route.centre, route.id).toEqual(district ? [...district.centre] : [0, 0]);
    const [end, [cx, cz]] = [route.points.at(-1), route.centre];
    expect(Math.hypot(end[0] - cx, end[1] - cz), route.id).toBeCloseTo(route.ring, 8);
    // A district's paths cross its own level ground, once its era has opened it.
    const ground = district ? [district] : [];
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
        expect(moonHeight(x, z, ground), `${route.id} crater on approach`).toBeCloseTo(0, 7);
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
  // Every lot's path, on the ground of a town that has opened every district.
  const districts = Object.values(MOON_DISTRICTS);
  const geometry = moonAccessGeometry(undefined, (x, z) => moonHeight(x, z, districts));
  try {
    // Every lot's path at once: the crater's and each district's.
    expect(geometry.index.count / 3).toBeLessThan(
      500 + 25 * Object.keys(MOON_LOTS).filter(moonLotDistrict).length,
    );
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
  const outer = MOON_ROADS.rings.at(-1);
  for (const [id, [x, z]] of Object.entries(MOON_LOTS)) {
    const { rotation } = moonLotPose(id);
    const district = moonLotDistrict(id);
    if (district) {
      // A district's lots front its own ring: their hatch side looks at its centre.
      const [dx, dz] = [district.centre[0] - x, district.centre[1] - z];
      expect(
        (Math.sin(rotation) * dx + Math.cos(rotation) * dz) / Math.hypot(dx, dz),
        id,
      ).toBeGreaterThan(0.999);
      continue;
    }
    if (Math.hypot(x, z) < outer) {
      // The first lots keep the poses they shipped with.
      const expected =
        id === 'ribbonLanding' ? 0 : Math.atan2(-x, -(z + 8)) + (id === 'saucerPad' ? 0 : Math.PI);
      expect(rotation, id).toBe(expected);
      continue;
    }
    // Beyond the outer road a lot fronts it: its hatch side looks inward. The Earthview
    // Terraces turn their glass to Earth (-z) instead, and still open toward the road.
    if (id === 'earthviewTerraces') expect(rotation).toBe(0);
    const toRoad = [-x / Math.hypot(x, z), -z / Math.hypot(x, z)];
    const front = [Math.sin(rotation), Math.cos(rotation)];
    expect(front[0] * toRoad[0] + front[1] * toRoad[1], id).toBeGreaterThan(
      id === 'earthviewTerraces' ? 0.5 : 0.95,
    );
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

// One pad top for every raised Moon pad: buildings, the saucer's feet, path ends and
// the walkers on them all stand on MOON_PAD_TOP, and paths ramp from it to the road.
it('stands pads, the saucer, paths and walkers on one pad top', () => {
  const d = new TownPrimitives();
  const pad = new Group();
  moonParcelPad(d, pad, moonPadRadius('settlerDomes'));
  expect(new Box3().setFromObject(pad).max.y).toBeCloseTo(MOON_PAD_TOP, 9);
  expect(MOON_SAUCER_PAD.y).toBe(MOON_PAD_TOP);
  const routes = moonApproaches();
  for (const route of routes) {
    expect(moonApproachHeight(route, ...route.points[0]), route.id).toBeCloseTo(
      MOON_PAD_TOP + MOON_PATH_LIFT,
      9,
    );
    expect(moonApproachHeight(route, ...route.points.at(-1)), route.id).toBeCloseTo(
      MOON_ROAD_LIFT,
      9,
    );
    // The settlers step out of the hatch onto the same surface.
    expect(moonHatch(route)[1], route.id).toBeCloseTo(MOON_PAD_TOP + MOON_PATH_LIFT, 9);
  }
  // The drawn strip reads it too: its first vertex is beside the first route's hatch.
  const geometry = moonAccessGeometry([routes[0]]);
  const surface = geometry.attributes.position;
  const [x, z] = [surface.getX(0), surface.getZ(0)];
  expect(surface.getY(0)).toBeCloseTo(moonApproachHeight(routes[0], x, z, moonHeight(x, z)), 6);
  geometry.dispose();
  d.clearGroup(pad);
  d.disposePrimitives();
});
