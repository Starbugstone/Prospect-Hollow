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
  tunnelHalfWidth: 1.5,
  tunnelCeiling: 4,
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
  const shoulder = face + depth * 0.4 * (1 - smooth(3, 6, Math.abs(localX)));
  return Math.max(baseHeight, THREE.MathUtils.lerp(shoulder, baseHeight, smooth(6, 11.4, depth)));
}

// A solid shoulder connects the exposed face to the existing hill. The only
// cavity is a four-unit-high railway tunnel; its roof and both walls are closed.
export function buildMineHillside(town, parent, mineZ, railZ, groundHeight, railway = false) {
  const root = town.group(parent);
  root.name = 'Connected mine hillside';
  root.userData.static = true;
  const { frontOffset, rearOffset, tunnelHalfWidth, tunnelCeiling } = MINE_HILLSIDE;
  const rows = [
    ...new Set([
      mineZ + frontOffset,
      railZ + tunnelHalfWidth,
      railZ,
      railZ - tunnelHalfWidth,
      mineZ + rearOffset,
      ...Array.from({ length: 18 }, (_, i) => mineZ + frontOffset - (i + 1) * 0.625),
    ]),
  ].sort((a, b) => b - a);
  const columns = [
    ...new Set([
      -8,
      ...MINE_FACE_COLUMNS.map(([x]) => x),
      8,
      ...Array.from({ length: 21 }, (_, i) => -7.5 + i * 0.75),
    ]),
  ].sort((a, b) => a - b);
  const positions = [],
    colors = [];
  const triangle = (a, b, c, hex) => {
    positions.push(...a, ...b, ...c);
    const color = new THREE.Color(hex);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  };
  const point = (x, z) => {
    const depth = mineZ + frontOffset - z;
    const worldX = x * (1 + depth * 0.13);
    return [worldX, mineHillsideHeight(worldX, z, mineZ, groundHeight(worldX, z)), z];
  };
  const clipAboveCeiling = (polygon) => {
    const clipped = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      const insideA = a[1] >= tunnelCeiling,
        insideB = b[1] >= tunnelCeiling;
      if (insideA) clipped.push(a);
      if (insideA !== insideB) {
        const t = (tunnelCeiling - a[1]) / (b[1] - a[1]);
        clipped.push(a.map((v, axis) => THREE.MathUtils.lerp(v, b[axis], t)));
      }
    }
    return clipped;
  };
  for (let row = 1; row < rows.length; row++) {
    const front = rows[row - 1],
      back = rows[row];
    const overTrack =
      railway && front <= railZ + tunnelHalfWidth && back >= railZ - tunnelHalfWidth;
    for (let col = 1; col < columns.length; col++) {
      const a = point(columns[col - 1], front),
        b = point(columns[col], front);
      const c = point(columns[col], back),
        d = point(columns[col - 1], back);
      for (const face of [
        [a, b, c],
        [a, c, d],
      ]) {
        const polygon = overTrack ? clipAboveCeiling(face) : face;
        for (let i = 2; i < polygon.length; i++) {
          triangle(
            polygon[0],
            polygon[i - 1],
            polygon[i],
            front > mineZ - 6 ? '#b5a485' : '#c2b18a',
          );
          if (overTrack)
            triangle(
              ...[polygon[0], polygon[i], polygon[i - 1]].map(([x, , z]) => [x, tunnelCeiling, z]),
              '#8e826e',
            );
        }
      }
    }
  }
  // Below the surface, close the front and rear walls of the railway tunnel.
  for (const z of railway ? [railZ + tunnelHalfWidth, railZ - tunnelHalfWidth] : []) {
    for (let col = 1; col < columns.length; col++) {
      const a = point(columns[col - 1], z),
        b = point(columns[col], z);
      a[1] = Math.min(a[1], tunnelCeiling);
      b[1] = Math.min(b[1], tunnelCeiling);
      const c = [b[0], groundHeight(b[0], z), z],
        d = [a[0], groundHeight(a[0], z), z];
      triangle(a, b, c, '#a29377');
      triangle(a, c, d, '#a29377');
      triangle(c, b, a, '#a29377');
      triangle(d, c, a, '#a29377');
    }
  }
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  source.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const geometry = mergeVertices(source);
  source.dispose();
  geometry.computeVertexNormals();
  geometry.userData.owned = true;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  material.userData.transient = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Mine shoulder and tunnel';
  mesh.castShadow = mesh.receiveShadow = true;
  root.add(mesh);
  return root;
}
