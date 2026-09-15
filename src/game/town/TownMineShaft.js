import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { MINE_POSITION, MINE_SHAFT } from '../../data/mineSite';
export { MINE_SHAFT } from '../../data/mineSite';

const clamp = (n) => THREE.MathUtils.clamp(n, 0, 1);
export function mineTrackHeight(z) {
  const { rampStartZ, portalZ, portalFloor, undergroundGrade } = MINE_SHAFT;
  if (z >= rampStartZ) return 0;
  if (z < portalZ) return portalFloor + (z - portalZ) * undergroundGrade;
  // Ease into the decline from the working yard, then maintain a constant grade.
  const t = clamp((rampStartZ - z) / (rampStartZ - portalZ));
  return (
    portalFloor * (-2 * t * t * t + 3 * t * t) -
    (rampStartZ - portalZ) * undergroundGrade * (t * t * t - t * t)
  );
}
export function mineTrackPitch(z) {
  const { rampStartZ, portalZ, portalFloor, undergroundGrade } = MINE_SHAFT;
  if (z >= rampStartZ) return 0;
  if (z <= portalZ) return -Math.atan(undergroundGrade);
  const length = rampStartZ - portalZ,
    t = (rampStartZ - z) / length;
  const derivative =
    portalFloor * (-6 * t * t + 6 * t) - length * undergroundGrade * (3 * t * t - 2 * t);
  return Math.atan(derivative / length);
}
export function mineExcavationHeight(x, z) {
  const side = clamp(
    (Math.abs(x) - MINE_SHAFT.halfWidth) / (MINE_SHAFT.bankWidth - MINE_SHAFT.halfWidth),
  );
  return mineTrackHeight(z) * (1 - side);
}
function ownedMesh(parent, positions, color) {
  const source = new THREE.BufferGeometry();
  source.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const geometry = mergeVertices(source);
  source.dispose();
  geometry.computeVertexNormals();
  geometry.userData.owned = true;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide });
  material.userData.transient = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function addMineExcavation(d, parent) {
  const root = d.group(parent);
  root.name = 'Excavated mine decline';
  const { rampStartZ, portalZ, bankWidth, halfWidth } = MINE_SHAFT;
  const xs = [-bankWidth, -halfWidth, halfWidth, bankWidth],
    positions = [];
  const steps = 28;
  for (let row = 0; row < steps; row++)
    for (let col = 1; col < xs.length; col++) {
      const front = THREE.MathUtils.lerp(rampStartZ, portalZ, row / steps),
        back = THREE.MathUtils.lerp(rampStartZ, portalZ, (row + 1) / steps);
      const p = (x, z) => [x, mineExcavationHeight(x, z), z];
      const a = p(xs[col - 1], front),
        b = p(xs[col], front),
        c = p(xs[col], back),
        e = p(xs[col - 1], back);
      positions.push(...a, ...b, ...c, ...a, ...c, ...e);
    }
  ownedMesh(root, positions, '#b8a17d').name = 'Mine ramp floor and banks';
  // Retain the earth around the sunken mouth, leaving only the shaft aperture.
  // Without these cheeks the cut terrain exposes the sky on either side.
  const back = [];
  const quad = (a, b, c, e) => back.push(...a, ...b, ...c, ...a, ...c, ...e);
  for (const side of [-1, 1]) {
    const a = side * halfWidth,
      b = side * bankWidth;
    const floor = [a, mineExcavationHeight(a, portalZ), portalZ],
      edge = [b, 0, portalZ],
      top = [a, 0, portalZ];
    if (side > 0) quad(floor, edge, edge, top);
    else quad(floor, top, edge, edge);
  }
  quad(
    [-halfWidth, MINE_SHAFT.portalFloor + MINE_SHAFT.height, portalZ],
    [halfWidth, MINE_SHAFT.portalFloor + MINE_SHAFT.height, portalZ],
    [halfWidth, 0, portalZ],
    [-halfWidth, 0, portalZ],
  );
  ownedMesh(root, back, '#a59576').name = 'Mine mouth retaining rock';
  return root;
}
export function addMineShaft(d, parent) {
  // Plot roots have a small foundation offset; the decline shares world heights.
  const root = d.group(parent, 0, -parent.position.y, -MINE_POSITION[1]);
  root.name = 'Descending mine shaft';
  const { rampStartZ, portalZ, endZ, halfWidth, height } = MINE_SHAFT;
  const positions = [];
  const quad = (a, b, c, e) => positions.push(...a, ...b, ...c, ...a, ...c, ...e);
  for (let z = portalZ; z > endZ; z -= 0.25) {
    const back = Math.max(endZ, z - 0.25),
      a = mineTrackHeight(z),
      b = mineTrackHeight(back);
    quad([-halfWidth, a, z], [halfWidth, a, z], [halfWidth, b, back], [-halfWidth, b, back]);
    quad(
      [-halfWidth, a + height, z],
      [-halfWidth, b + height, back],
      [halfWidth, b + height, back],
      [halfWidth, a + height, z],
    );
    quad(
      [-halfWidth, a, z],
      [-halfWidth, b, back],
      [-halfWidth, b + height, back],
      [-halfWidth, a + height, z],
    );
    quad(
      [halfWidth, a, z],
      [halfWidth, a + height, z],
      [halfWidth, b + height, back],
      [halfWidth, b, back],
    );
  }
  ownedMesh(root, positions, '#756b56').name = 'Mine shaft below railway';
  d.box(root, halfWidth * 2, height, 0.06, 0, mineTrackHeight(endZ) + height / 2, endZ, '#252c27');
  for (let z = rampStartZ + 0.65; z > endZ; z -= 0.22) {
    const back = Math.max(endZ, z - 0.22);
    for (const x of [-0.38, 0.38])
      d.rod(
        root,
        [x, mineTrackHeight(z) + 0.075, z],
        [x, mineTrackHeight(back) + 0.075, back],
        0.033,
        '#69766e',
      );
  }
  for (let z = rampStartZ + 0.6; z > endZ; z -= 0.4) {
    const sleeper = d.box(root, 1.04, 0.07, 0.13, 0, mineTrackHeight(z) + 0.035, z, '#967b55');
    sleeper.rotation.x = mineTrackPitch(z);
  }
  for (let z = portalZ - 0.7; z > endZ; z -= 1.3) {
    const y = mineTrackHeight(z);
    for (const x of [-0.94, 0.94])
      d.rod(root, [x, y, z], [x, y + height - 0.05, z], 0.06, '#91744c');
    d.rod(root, [-0.94, y + height - 0.05, z], [0.94, y + height - 0.05, z], 0.065, '#91744c');
  }
  return root;
}
