import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

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
