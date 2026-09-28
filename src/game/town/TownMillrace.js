import { MINE_SHAFT } from '../../data/mineSite';
import * as THREE from 'three';
import { WATERMILL_SITE } from '../../data/watermill';

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
// ridge need detail, then 2.5 and 5 units toward the fogged horizon. Every detailed
// height feature lies inside the fine core or varies only along the coarse axis.
const LATTICE = [
  [-130, -95, 5],
  [-95, -62.5, 2.5],
  [-62.5, 62.5, 1.25],
  [62.5, 95, 2.5],
  [95, 130, 5],
];
const latticeAxis = (extra) => {
  const values = new Set(extra);
  for (const [from, to, step] of LATTICE)
    for (let i = 0; from + i * step <= to; i++) values.add(from + i * step);
  return [...values].sort((a, b) => a - b);
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

// Refine just the channel's neighborhood; a 1.25-unit prairie grid cannot represent a
// narrow excavation reliably. The refined patch stays local instead of running fine
// rows and columns across the whole map. Its border vertices are shared with the
// neighboring lattice cells, which fan around them, so the seam cannot crack.
export function landscapeGeometry() {
  const xs = latticeAxis([-MINE_SHAFT.bankWidth, MINE_SHAFT.bankWidth]),
    zs = latticeAxis([MINE_SHAFT.portalZ, MINE_SHAFT.rampStartZ]);
  const x0 = xs.findLast((x) => x <= MILLRACE.minX),
    x1 = xs.find((x) => x >= MILLRACE.maxX),
    z0 = zs.findLast((z) => z <= MILLRACE.minZ),
    z1 = zs.find((z) => z >= MILLRACE.maxZ);
  const patchX = [
      ...new Set([
        ...xs.filter((x) => x >= x0 && x <= x1),
        ...fineAxis(MILLRACE.minX, MILLRACE.maxX),
      ]),
    ].sort((a, b) => a - b),
    patchZ = [
      ...new Set([
        ...zs.filter((z) => z >= z0 && z <= z1),
        ...fineAxis(MILLRACE.minZ, MILLRACE.maxZ),
      ]),
    ].sort((a, b) => a - b);
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
  const between = (axis, from, to) => axis.filter((v) => v > from && v < to);
  for (let iz = 0; iz < zs.length - 1; iz++)
    for (let ix = 0; ix < xs.length - 1; ix++) {
      const [ax, bx, az, bz] = [xs[ix], xs[ix + 1], zs[iz], zs[iz + 1]];
      // Leave an actual opening in the heightfield. A separate ramp meets these
      // edges below ground; closing this rectangle would seal the shaft entrance.
      if (
        ax >= -MINE_SHAFT.bankWidth &&
        bx <= MINE_SHAFT.bankWidth &&
        az >= MINE_SHAFT.portalZ &&
        bz <= MINE_SHAFT.rampStartZ
      )
        continue;
      if (ax >= x0 && bx <= x1 && az >= z0 && bz <= z1) continue;
      const alongX = ax >= x0 && bx <= x1,
        alongZ = az >= z0 && bz <= z1;
      // Patch vertices on this cell's shared edge, walked counterclockwise.
      const ring = [
        [ax, az],
        ...(alongX && az === z1 ? between(patchX, ax, bx).map((x) => [x, az]) : []),
        [bx, az],
        ...(alongZ && bx === x0 ? between(patchZ, az, bz).map((z) => [bx, z]) : []),
        [bx, bz],
        ...(alongX && bz === z0
          ? between(patchX, ax, bx)
              .map((x) => [x, bz])
              .reverse()
          : []),
        [ax, bz],
        ...(alongZ && ax === x1
          ? between(patchZ, az, bz)
              .map((z) => [ax, z])
              .reverse()
          : []),
      ].map(([x, z]) => vertex(x, z));
      if (ring.length === 4) {
        triangle(indices, points, ring[0], ring[3], ring[1]);
        triangle(indices, points, ring[1], ring[3], ring[2]);
        continue;
      }
      // One edge carries patch vertices: fan from a corner that is not on it.
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
  for (let iz = 0; iz < patchZ.length - 1; iz++)
    for (let ix = 0; ix < patchX.length - 1; ix++) {
      const a = vertex(patchX[ix], patchZ[iz]),
        b = vertex(patchX[ix + 1], patchZ[iz]),
        c = vertex(patchX[ix + 1], patchZ[iz + 1]),
        d = vertex(patchX[ix], patchZ[iz + 1]);
      triangle(indices, points, a, d, b);
      triangle(indices, points, b, d, c);
    }
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
      points.flatMap(([x, z]) => [(x + 130) / 260, (130 - z) / 260]),
      2,
    ),
  );
  geometry.setIndex(indices);
  return geometry;
}
