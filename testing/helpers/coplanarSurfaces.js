import { Raycaster, Triangle, Vector3 } from 'three';

const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function overlap(a, b) {
  let polygon = a;
  const sign = Math.sign(cross(b[0], b[1], b[2]));
  for (let n = 0; n < 3 && polygon.length; n++) {
    const start = b[n],
      end = b[(n + 1) % 3],
      next = [];
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i],
        q = polygon[(i + 1) % polygon.length];
      const cp = sign * cross(start, end, p),
        cq = sign * cross(start, end, q);
      if (cp >= 0) next.push(p);
      if (cp >= 0 !== cq >= 0) next.push(p.map((v, axis) => v + ((q[axis] - v) * cp) / (cp - cq)));
    }
    polygon = next;
  }
  if (polygon.length < 3) return null;
  const area =
    Math.abs(
      polygon.reduce((sum, p, n) => {
        const q = polygon[(n + 1) % polygon.length];
        return sum + p[0] * q[1] - p[1] * q[0];
      }, 0),
    ) / 2;
  return area > 0.002
    ? polygon.reduce((sum, p) => sum.map((v, axis) => v + p[axis] / polygon.length), [0, 0])
    : null;
}

// Find exposed, differently coloured triangles competing for the same depth.
// Hidden internal joins and edge-only contacts do not count as visible fighting.
export function coplanarSurfaces(root) {
  root.updateMatrixWorld(true);
  const meshes = [],
    planes = new Map(),
    conflicts = [];
  root.traverse((mesh) => {
    if (mesh.isMesh && mesh.visible && !mesh.material.transparent) meshes.push(mesh);
  });
  for (const mesh of meshes) {
    const positions = mesh.geometry.attributes.position,
      indices = mesh.geometry.index;
    for (let n = 0; n < (indices?.count ?? positions.count); n += 3) {
      const points = [0, 1, 2].map((i) =>
        new Vector3()
          .fromBufferAttribute(positions, indices ? indices.getX(n + i) : n + i)
          .applyMatrix4(mesh.matrixWorld),
      );
      const normal = new Triangle(...points).getNormal(new Vector3());
      // Settlement cameras stay above the ground; buried undersides are not a
      // player-visible surface, even in an isolated model with no terrain.
      if (!normal.lengthSq() || normal.y < -0.1) continue;
      const distance = normal.dot(points[0]);
      const key = [...normal.toArray(), distance].map((v) => Math.round(v * 10000)).join();
      const drop = normal
        .toArray()
        .map(Math.abs)
        .indexOf(Math.max(...normal.toArray().map(Math.abs)));
      const axes = [0, 1, 2].filter((axis) => axis !== drop);
      const flat = points.map((p) => axes.map((axis) => p.getComponent(axis)));
      const bucket = planes.get(key) ?? [];
      for (const other of bucket) {
        if (other.mesh === mesh || other.mesh.material === mesh.material) continue;
        const middle = overlap(flat, other.flat);
        if (!middle) continue;
        const point = new Vector3();
        axes.forEach((axis, i) => point.setComponent(axis, middle[i]));
        point.setComponent(drop, (distance - normal.dot(point)) / normal.getComponent(drop));
        const ray = new Raycaster(
          point.clone().addScaledVector(normal, 100),
          normal.clone().negate(),
          0,
          100.01,
        );
        const hit = ray.intersectObjects(meshes, false)[0];
        if (!hit || hit.distance < 99.999) continue;
        conflicts.push({ a: other.mesh, b: mesh, point, normal });
      }
      bucket.push({ mesh, flat });
      planes.set(key, bucket);
    }
  }
  return conflicts;
}
