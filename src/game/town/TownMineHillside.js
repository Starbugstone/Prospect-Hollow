import { horizonMaterial } from './TownAtmosphere';
import {
  addTunnelPortals,
  RAIL_TUNNEL,
  tunnelCeilingAt,
  tunnelOuterHeightAt,
  tunnelInnerProfile,
  tunnelOuterProfile,
  tunnelRearX,
} from './TownRailTunnel';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const MINE_FACE_COLUMNS = [
  [-6.4, 0.3],
  [-4.8, 1.9],
  [-3.5, 4.6],
  [-1.3, 5.4],
  [0.8, 5.1],
  [2.8, 4.7],
  [4.3, 2.3],
  [6.1, 0.35],
];
export const MINE_HILLSIDE = Object.freeze({
  frontOffset: -1.1,
  rearOffset: -12.5,
  tunnelHalfWidth: RAIL_TUNNEL.halfWidth,
  tunnelCeiling: RAIL_TUNNEL.spring + RAIL_TUNNEL.radius,
});
const smooth = (a, b, value) => {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function mineHillsideHeight(x, z, mineZ, baseHeight) {
  const depth = mineZ + MINE_HILLSIDE.frontOffset - z;
  if (depth < -0.98 || depth > 11.4) return baseHeight;
  const localX = x / (1 + Math.max(0, depth) * 0.13);
  let face = 0;
  for (let i = 1; i < MINE_FACE_COLUMNS.length; i++) {
    const [ax, ay] = MINE_FACE_COLUMNS[i - 1],
      [bx, by] = MINE_FACE_COLUMNS[i];
    if (localX >= ax && localX <= bx)
      face = THREE.MathUtils.lerp(ay, by, (localX - ax) / (bx - ax));
  }
  if (depth < 0) return Math.max(baseHeight, face * smooth(-0.98, 0, depth));
  // Rock above the future bore remains a normal solid shoulder until completion.
  const tunnelCover =
    (tunnelOuterHeightAt(z, mineZ - 3) + 0.6) *
    (1 - smooth(6.8, 9, Math.abs(x))) *
    (1 - smooth(1.5, 2.25, Math.abs(z - (mineZ - 3))));
  const shoulder = Math.max(tunnelCover, face + depth * 0.4 * (1 - smooth(3, 6, Math.abs(localX))));
  return Math.max(baseHeight, THREE.MathUtils.lerp(shoulder, baseHeight, smooth(6, 11.4, depth)));
}

// The exposed surface and portal retaining faces share an exact world-space grid.
// The rock stops at the BACK of the masonry; its bore meets the inner arch there.
export function buildMineHillside(town, parent, mineZ, railZ, groundHeight, railway = false) {
  const root = town.group(parent);
  root.name = 'Connected mine hillside';
  root.userData.static = true;
  const { frontOffset, rearOffset } = MINE_HILLSIDE;
  const { approachHalfWidth, radius } = RAIL_TUNNEL;
  const rows = [
    ...new Set([
      mineZ + frontOffset,
      mineZ + rearOffset,
      railZ - approachHalfWidth,
      railZ + approachHalfWidth,
      ...tunnelInnerProfile.map(([z]) => railZ + z),
      ...tunnelOuterProfile.map(([z]) => railZ + z),
      ...Array.from(
        { length: 24 },
        (_, i) => mineZ + rearOffset + (i * (frontOffset - rearOffset)) / 23,
      ),
    ]),
  ].sort((a, b) => b - a);
  const columns = [
    ...new Set([
      -20,
      -tunnelRearX,
      tunnelRearX,
      20,
      ...MINE_FACE_COLUMNS.map(([x]) => x),
      ...Array.from({ length: 81 }, (_, i) => -20 + i * 0.5),
    ]),
  ].sort((a, b) => a - b);
  const positions = [],
    colors = [];
  const triangle = (a, b, c, hex) => {
    positions.push(...a, ...b, ...c);
    const tone = new THREE.Color(hex);
    for (let i = 0; i < 3; i++) colors.push(tone.r, tone.g, tone.b);
  };
  const quad = (a, b, c, d, color) => {
    triangle(a, b, c, color);
    triangle(a, c, d, color);
  };
  const wall = (a, b, c, d) => {
    quad(a, b, c, d, '#a29377');
    quad(c, b, a, d, '#a29378');
  };
  const height = (x, z) => mineHillsideHeight(x, z, mineZ, groundHeight(x, z));
  const point = (x, z) => [x, height(x, z), z];
  for (let row = 1; row < rows.length; row++) {
    const front = rows[row - 1],
      back = rows[row];
    const approach =
      railway && front <= railZ + approachHalfWidth && back >= railZ - approachHalfWidth;
    const bore = railway && front <= railZ + radius && back >= railZ - radius;
    for (let col = 1; col < columns.length; col++) {
      const left = columns[col - 1],
        right = columns[col];
      if (approach && (left >= tunnelRearX || right <= -tunnelRearX)) continue;
      const a = point(left, front),
        b = point(right, front),
        c = point(right, back),
        d = point(left, back);
      quad(a, b, c, d, front > mineZ - 6 ? '#b5a485' : '#c2b18a');
      if (bore)
        quad(
          [left, tunnelCeilingAt(back, railZ), back],
          [right, tunnelCeilingAt(back, railZ), back],
          [right, tunnelCeilingAt(front, railZ), front],
          [left, tunnelCeilingAt(front, railZ), front],
          '#8e826e',
        );
    }
  }
  if (railway) {
    for (const side of [-1, 1]) {
      const x = side * tunnelRearX;
      for (let row = 1; row < rows.length; row++) {
        const front = rows[row - 1],
          back = rows[row];
        if (front > railZ + approachHalfWidth || back < railZ - approachHalfWidth) continue;
        const arch = front <= railZ + radius + 0.5 && back >= railZ - radius - 0.5;
        const low = (z) => (arch ? tunnelOuterHeightAt(z, railZ) : groundHeight(x, z));
        // A fitted rock collar slopes onto the OUTER edge of the arch face.
        // This buries its backing instead of leaving a second opening above it.
        const faceX = side * RAIL_TUNNEL.portalX;
        const outer = (z) => (arch ? tunnelOuterHeightAt(z, railZ) : groundHeight(faceX, z));
        const a = point(x, front),
          b = [faceX, outer(front), front],
          c = [faceX, outer(back), back],
          e = point(x, back);
        if (side > 0) quad(a, b, c, e, '#b5a485');
        else quad(e, c, b, a, '#b5a485');
      }
      for (const z of [railZ - approachHalfWidth, railZ + approachHalfWidth]) {
        const approachColumns = columns.filter((v) => side * v >= tunnelRearX);
        for (let i = 1; i < approachColumns.length; i++) {
          const a = approachColumns[i - 1],
            b = approachColumns[i];
          wall([a, groundHeight(a, z), z], [b, groundHeight(b, z), z], point(b, z), point(a, z));
        }
      }
    }
    for (const z of [railZ - radius, railZ + radius])
      wall(
        [-tunnelRearX, 0, z],
        [tunnelRearX, 0, z],
        [tunnelRearX, RAIL_TUNNEL.spring, z],
        [-tunnelRearX, RAIL_TUNNEL.spring, z],
      );
  }
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  source.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const geometry = mergeVertices(source);
  source.dispose();
  geometry.computeVertexNormals();
  geometry.userData.owned = true;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  horizonMaterial(material);
  material.userData.transient = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Mine shoulder and tunnel';
  mesh.castShadow = mesh.receiveShadow = true;
  root.add(mesh);
  if (railway) addTunnelPortals(town, root, railZ);
  return root;
}
