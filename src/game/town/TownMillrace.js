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

// Refine just the channel's neighborhood; a 1.25-unit prairie grid cannot
// represent a narrow excavation reliably. The rest of the terrain keeps its grid.
export function landscapeGeometry() {
  const axis = (min, max, extra) =>
    [
      ...new Set([
        ...extra,
        ...Array.from({ length: 209 }, (_, i) => -130 + i * 1.25),
        ...Array.from({ length: Math.ceil((max - min) / 0.2) + 1 }, (_, i) =>
          Math.min(max, min + i * 0.2),
        ),
      ]),
    ].sort((a, b) => a - b);
  const xs = axis(MILLRACE.minX, MILLRACE.maxX, [-MINE_SHAFT.bankWidth, MINE_SHAFT.bankWidth]),
    zs = axis(MILLRACE.minZ, MILLRACE.maxZ, [MINE_SHAFT.portalZ, MINE_SHAFT.rampStartZ]);
  const geometry = new THREE.PlaneGeometry(260, 260, xs.length - 1, zs.length - 1);
  geometry.rotateX(-Math.PI / 2);
  for (let iz = 0; iz < zs.length; iz++)
    for (let ix = 0; ix < xs.length; ix++)
      geometry.attributes.position.setXYZ(iz * xs.length + ix, xs[ix], 0, zs[iz]);
  // Leave an actual opening in the heightfield. A separate ramp meets these
  // edges below ground; closing this rectangle would seal the shaft entrance.
  const indices = [];
  for (let iz = 0; iz < zs.length - 1; iz++)
    for (let ix = 0; ix < xs.length - 1; ix++) {
      if (
        xs[ix] >= -MINE_SHAFT.bankWidth &&
        xs[ix + 1] <= MINE_SHAFT.bankWidth &&
        zs[iz] >= MINE_SHAFT.portalZ &&
        zs[iz + 1] <= MINE_SHAFT.rampStartZ
      )
        continue;
      const a = iz * xs.length + ix,
        b = a + 1,
        c = a + xs.length + 1,
        d = a + xs.length;
      indices.push(a, d, b, b, d, c);
    }
  geometry.setIndex(indices);
  return geometry;
}
