import { MINE_SHAFT } from '../../data/mineSite';
import * as THREE from 'three';
import { WATERMILL_SITE } from '../../data/watermill';
import { TOWN_EDGE } from './TownAtmosphere';

// One curved side channel drives the terrain cut and the water mesh. Keeping it
// in the landscape also avoids rebuilding the river on every mill improvement.
const [siteX, siteZ] = WATERMILL_SITE.position;
const curve = new THREE.CatmullRomCurve3(
  [
    [5.3, -2.7],
    [3.7, -2.1],
    [2.35, -1.15],
    [2.35, 1.05],
    [3.8, 2.15],
    [5.3, 2.7],
  ].map(([x, z]) => new THREE.Vector3(siteX + x, 0, siteZ + z)),
);
export const MILLRACE = Object.freeze({
  bankWidth: 0.85,
  bedWidth: 0.3,
  minX: siteX + 1.3,
  maxX: siteX + 6.3,
  minZ: siteZ - 3.7,
  maxZ: siteZ + 3.7,
  path: curve
    .getPoints(64)
    .map(({ x, z }) => [Math.max(siteX + WATERMILL_SITE.wheelX + 0.03, x), z]),
});

export function millraceDistance(x, z) {
  if (x < MILLRACE.minX || x > MILLRACE.maxX || z < MILLRACE.minZ || z > MILLRACE.maxZ)
    return Infinity;
  let distance = Infinity;
  for (let i = 1; i < MILLRACE.path.length; i++) {
    const [ax, az] = MILLRACE.path[i - 1],
      [bx, bz] = MILLRACE.path[i];
    const dx = bx - ax,
      dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return distance;
}

// Widen the river's single strip only as far as the curved channel needs.
// The terrain hides the dry island between the wheel and the main current.
export function millraceWaterEdge(z, riverEdge) {
  let edge = riverEdge;
  for (const [x, pz] of MILLRACE.path) {
    const dz = Math.abs(z - pz);
    if (dz < MILLRACE.bankWidth)
      edge = Math.min(edge, x - Math.sqrt(MILLRACE.bankWidth ** 2 - dz ** 2));
  }
  return edge;
}

export function millraceHeight(x, z, waterHeight) {
  const distance = millraceDistance(x, z);
  if (distance >= MILLRACE.bankWidth) return Infinity;
  const t = THREE.MathUtils.clamp(
    (distance - MILLRACE.bedWidth) / (MILLRACE.bankWidth - MILLRACE.bedWidth),
    0,
    1,
  );
  return (waterHeight - 0.5) * (1 - t * t * (3 - 2 * t));
}

// Terrain lattice: 1.25-unit cells where the town, river, railway cutting and mine
// ridge need detail, then 2.5 and 5 units out to the core's ±130 border. Every
// detailed height feature lies inside the fine core or varies only along the coarse axis.
const CORE = 130;
const LATTICE = [
  [-CORE, -95, 5],
  [-95, -62.5, 2.5],
  [-62.5, 62.5, 1.25],
  [62.5, 95, 2.5],
  [95, CORE, 5],
];
// The prairie beyond the core lies in the fog: 20-unit cells there, except across
// the features that run on to the map edge. In x: the north-south trail and the
// river valley (6 to 55), then the flight corridor's level strip around -53. In z:
// the railway cutting around -23. Every far value inside the core is also a core
// value, so the far cells meet the core's border vertices exactly.
const FAR_STEP = 20;
const FAR_X = [
  [-70, -35, 5],
  [-12.5, 56.25, 1.25],
];
const FAR_Z = [[-30, -16.25, 1.25]];
const addBands = (values, bands) => {
  for (const [from, to, step] of bands) {
    for (let i = 0; from + i * step < to; i++) values.add(from + i * step);
    values.add(to);
  }
  return values;
};
const sorted = (values) => [...values].sort((a, b) => a - b);
const latticeAxis = (extra) => sorted(addBands(new Set(extra), LATTICE));
const farAxis = (detail) => {
  const values = new Set([-TOWN_EDGE, TOWN_EDGE]);
  for (let v = -CORE; v > -TOWN_EDGE; v -= FAR_STEP) values.add(v);
  for (let v = -CORE + FAR_STEP; v < TOWN_EDGE; v += FAR_STEP) values.add(v);
  return sorted(addBands(values, detail));
};
const fineAxis = (min, max) =>
  Array.from({ length: Math.ceil((max - min) / 0.2) + 1 }, (_, i) => Math.min(max, min + i * 0.2));
// A front-facing (+Y) triangle regardless of the order its corners were listed in.
function triangle(indices, points, a, b, c) {
  const [ax, az] = points[a],
    [bx, bz] = points[b],
    [cx, cz] = points[c];
  if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) < 0) indices.push(a, c, b);
  else indices.push(a, b, c);
}
// Triangulate a lattice around an optional finer `inner` rectangle, which is left
// to its own lattice. Inner border vertices are shared with the neighboring cells,
// which fan around them, so the seam cannot crack.
function addLattice(mesh, xs, zs, inner = null, skip = () => false) {
  const { points, indices, vertex } = mesh;
  const between = (axis, from, to) => axis.filter((v) => v > from && v < to);
  for (let iz = 0; iz < zs.length - 1; iz++)
    for (let ix = 0; ix < xs.length - 1; ix++) {
      const [ax, bx, az, bz] = [xs[ix], xs[ix + 1], zs[iz], zs[iz + 1]];
      if (skip(ax, bx, az, bz)) continue;
      const alongX = !!inner && ax >= inner.x0 && bx <= inner.x1,
        alongZ = !!inner && az >= inner.z0 && bz <= inner.z1;
      if (alongX && alongZ) continue;
      // Inner vertices on this cell's shared edge, walked counterclockwise.
      const ring = [
        [ax, az],
        ...(alongX && az === inner.z1 ? between(inner.xs, ax, bx).map((x) => [x, az]) : []),
        [bx, az],
        ...(alongZ && bx === inner.x0 ? between(inner.zs, az, bz).map((z) => [bx, z]) : []),
        [bx, bz],
        ...(alongX && bz === inner.z0
          ? between(inner.xs, ax, bx)
              .map((x) => [x, bz])
              .reverse()
          : []),
        [ax, bz],
        ...(alongZ && ax === inner.x1
          ? between(inner.zs, az, bz)
              .map((z) => [ax, z])
              .reverse()
          : []),
      ].map(([x, z]) => vertex(x, z));
      if (ring.length === 4) {
        triangle(indices, points, ring[0], ring[3], ring[1]);
        triangle(indices, points, ring[1], ring[3], ring[2]);
        continue;
      }
      // One edge carries inner vertices: fan from a corner that is not on it.
      const corner = (id) => [ax, bx].includes(points[id][0]) && [az, bz].includes(points[id][1]);
      const pivot = ring.findIndex(
        (id, i) =>
          corner(id) &&
          corner(ring[(i + 1) % ring.length]) &&
          corner(ring[(i + ring.length - 1) % ring.length]),
      );
      for (let i = 1; i < ring.length - 1; i++)
        triangle(
          indices,
          points,
          ring[pivot],
          ring[(pivot + i) % ring.length],
          ring[(pivot + i + 1) % ring.length],
        );
    }
}

// Refine just the channel's neighborhood; a 1.25-unit prairie grid cannot represent a
// narrow excavation reliably. The refined patch stays local instead of running fine
// rows and columns across the whole map, just as the core's fine rows and columns stop
// at its border instead of running out to the horizon.
export function landscapeGeometry() {
  const xs = latticeAxis([-MINE_SHAFT.bankWidth, MINE_SHAFT.bankWidth]),
    zs = latticeAxis([MINE_SHAFT.portalZ, MINE_SHAFT.rampStartZ]);
  const x0 = xs.findLast((x) => x <= MILLRACE.minX),
    x1 = xs.find((x) => x >= MILLRACE.maxX),
    z0 = zs.findLast((z) => z <= MILLRACE.minZ),
    z1 = zs.find((z) => z >= MILLRACE.maxZ);
  const patchX = sorted(
      new Set([...xs.filter((x) => x >= x0 && x <= x1), ...fineAxis(MILLRACE.minX, MILLRACE.maxX)]),
    ),
    patchZ = sorted(
      new Set([...zs.filter((z) => z >= z0 && z <= z1), ...fineAxis(MILLRACE.minZ, MILLRACE.maxZ)]),
    );
  const points = [],
    ids = new Map(),
    indices = [];
  const vertex = (x, z) => {
    const key = `${x}|${z}`;
    if (!ids.has(key)) {
      ids.set(key, points.length);
      points.push([x, z]);
    }
    return ids.get(key);
  };
  const mesh = { points, indices, vertex };
  addLattice(mesh, farAxis(FAR_X), farAxis(FAR_Z), {
    x0: -CORE,
    x1: CORE,
    z0: -CORE,
    z1: CORE,
    xs,
    zs,
  });
  // Leave an actual opening in the heightfield. A separate ramp meets these
  // edges below ground; closing this rectangle would seal the shaft entrance.
  addLattice(
    mesh,
    xs,
    zs,
    { x0, x1, z0, z1, xs: patchX, zs: patchZ },
    (ax, bx, az, bz) =>
      ax >= -MINE_SHAFT.bankWidth &&
      bx <= MINE_SHAFT.bankWidth &&
      az >= MINE_SHAFT.portalZ &&
      bz <= MINE_SHAFT.rampStartZ,
  );
  addLattice(mesh, patchX, patchZ);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      points.flatMap(([x, z]) => [x, 0, z]),
      3,
    ),
  );
  // Keep the plane's attribute set: flat normals until heights are applied, and UVs.
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(
      points.flatMap(() => [0, 1, 0]),
      3,
    ),
  );
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      points.flatMap(([x, z]) => [
        (x + TOWN_EDGE) / (2 * TOWN_EDGE),
        (TOWN_EDGE - z) / (2 * TOWN_EDGE),
      ]),
      2,
    ),
  );
  geometry.setIndex(indices);
  return geometry;
}
