import { Box3, Triangle, Vector3 } from 'three';

// Packed vertices and a permutation: no Triangle/Vector3 allocation per face and
// no recursive sort/copy. The generator can be exhausted by headless callers.
export function* triangleIndex(root) {
  root.updateWorldMatrix(true, true);
  const meshes = [];
  const visit = (node) => {
    if (
      node.userData.animated ||
      node.userData.navigationExclude ||
      ['removed', 'pending'].includes(node.userData.activation)
    )
      return;
    if (node.isMesh && !node.material.transparent) meshes.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  const count = meshes.reduce(
    (n, mesh) => n + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3,
    0,
  );
  if (!count) return null;
  const vertices = new Float32Array(count * 9),
    centroids = new Float32Array(count * 3),
    order = new Uint32Array(count);
  const v = new Vector3();
  let face = 0;
  for (const mesh of meshes) {
    const {
      index,
      attributes: { position },
    } = mesh.geometry;
    for (let at = 0; at < (index?.count ?? position.count); at += 3) {
      order[face] = face;
      for (let corner = 0; corner < 3; corner++) {
        v.fromBufferAttribute(position, index ? index.getX(at + corner) : at + corner).applyMatrix4(
          mesh.matrixWorld,
        );
        v.toArray(vertices, face * 9 + corner * 3);
        centroids[face * 3] += v.x / 3;
        centroids[face * 3 + 1] += v.y / 3;
        centroids[face * 3 + 2] += v.z / 3;
      }
      if (++face % 256 === 0) yield;
    }
  }
  const entry = { start: 0, end: count },
    stack = [entry];
  while (stack.length) {
    const node = stack.pop(),
      bounds = (node.bounds = new Box3());
    for (let i = node.start; i < node.end; i++) {
      for (let c = 0; c < 3; c++) bounds.expandByPoint(v.fromArray(vertices, order[i] * 9 + c * 3));
      if ((i & 511) === 0) yield;
    }
    if (node.end - node.start <= 24) continue;
    const dx = bounds.max.x - bounds.min.x,
      dy = bounds.max.y - bounds.min.y,
      dz = bounds.max.z - bounds.min.z;
    const axis = dx > dy && dx > dz ? 0 : dy > dz ? 1 : 2;
    const middle = (node.start + node.end) >> 1;
    let lo = node.start,
      hi = node.end - 1;
    while (lo < hi) {
      const pivot = centroids[order[(lo + hi) >> 1] * 3 + axis];
      let i = lo,
        j = hi;
      while (i <= j) {
        while (centroids[order[i] * 3 + axis] < pivot) i++;
        while (centroids[order[j] * 3 + axis] > pivot) j--;
        if (i <= j) {
          const value = order[i];
          order[i++] = order[j];
          order[j--] = value;
        }
        if ((i & 511) === 0) yield;
      }
      if (middle <= j) hi = j;
      else if (middle >= i) lo = i;
      else break;
      yield;
    }
    node.left = { start: node.start, end: middle };
    node.right = { start: middle, end: node.end };
    stack.push(node.right, node.left);
  }
  entry.vertices = vertices;
  entry.order = order;
  return entry;
}
const triangle = new Triangle();
export function queryTriangles(entry, overlaps, match) {
  const visit = (node) => {
    if (!overlaps(node.bounds)) return false;
    if (node.left) return visit(node.left) || visit(node.right);
    for (let i = node.start; i < node.end; i++) {
      const offset = entry.order[i] * 9;
      triangle.a.fromArray(entry.vertices, offset);
      triangle.b.fromArray(entry.vertices, offset + 3);
      triangle.c.fromArray(entry.vertices, offset + 6);
      if (match(triangle)) return true;
    }
    return false;
  };
  return visit(entry);
}
