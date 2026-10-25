import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const RING_TUBE = 0.13;

export function createTownGeometries() {
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    rounded: new RoundedBoxGeometry(1, 1, 1, 1, 0.09),
    sphere: new THREE.SphereGeometry(1, 10, 6),
    rock: new THREE.IcosahedronGeometry(1, 0),
    foliage: new THREE.IcosahedronGeometry(1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    cone: new THREE.CylinderGeometry(0.6, 1, 1, 10),
    shadow: new THREE.CircleGeometry(1, 24),
    // Unit-radius ring around +Z, e.g. a space helmet's collar.
    ring: new THREE.TorusGeometry(1, RING_TUBE, 6, 18),
  };
  const leaves = geometries.foliage.attributes.position;
  for (let i = 0; i < leaves.count; i++) {
    const x = leaves.getX(i),
      y = leaves.getY(i),
      z = leaves.getZ(i);
    const variation = 1 + Math.sin(x * 19 + y * 11 + z * 7) * 0.12;
    leaves.setXYZ(i, x * variation, y * variation, z * variation);
  }
  // Weld shared primitives once, before buildings copy and transform them.
  // Re-welding whole village batches on every update is much more expensive.
  for (const [key, geometry] of Object.entries(geometries)) {
    if (geometry.index) continue;
    geometries[key] = mergeVertices(geometry);
    geometry.dispose();
  }
  return geometries;
}

// A copy of `geometry` placed by `matrix`, for merging into a batch. It holds the same
// arrays as `geometry.clone().applyMatrix4(matrix)`, but copies each array once instead
// of twice and skips the bounds a merge never reads. `skip` names an attribute the caller
// would delete anyway. Interleaved or morphing geometry takes the ordinary clone.
export function placedCopy(geometry, matrix, skip) {
  const attributes = Object.entries(geometry.attributes);
  if (
    attributes.some(([, attribute]) => attribute.isInterleavedBufferAttribute) ||
    Object.keys(geometry.morphAttributes).length
  ) {
    const copy = geometry.clone().applyMatrix4(matrix);
    if (skip) copy.deleteAttribute(skip);
    return copy;
  }
  const copy = new THREE.BufferGeometry();
  copy.name = geometry.name;
  if (geometry.index) copy.setIndex(copyAttribute(geometry.index));
  for (const [name, attribute] of attributes)
    if (name !== skip) copy.setAttribute(name, copyAttribute(attribute));
  for (const { start, count, materialIndex } of geometry.groups)
    copy.addGroup(start, count, materialIndex);
  copy.drawRange.start = geometry.drawRange.start;
  copy.drawRange.count = geometry.drawRange.count;
  copy.morphTargetsRelative = geometry.morphTargetsRelative;
  copy.userData = geometry.userData;
  return copy.applyMatrix4(matrix);
}
function copyAttribute(attribute) {
  const copy = new THREE.BufferAttribute(
    attribute.array.slice(),
    attribute.itemSize,
    attribute.normalized,
  );
  copy.name = attribute.name;
  copy.usage = attribute.usage;
  copy.gpuType = attribute.gpuType;
  return copy;
}
