import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Unit shapes for the future architectures, created once per diorama on first use
// and kept with the shared primitives, so plots never allocate geometry per part.
function surface(points, faces) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  // Plots merge meshes by material, so hand-built surfaces carry the same
  // attributes (position, normal, uv) as the shared primitives.
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      points.flatMap(([x, , z]) => [x, z]),
      2,
    ),
  );
  geometry.setIndex(faces.flat());
  geometry.computeVertexNormals();
  return geometry;
}

// A tensile saddle over a unit square: two opposite corners high, two low. Both
// faces are drawn with their own vertices, so the cloth reads from above and below.
function hypar(n = 6) {
  const points = [],
    faces = [];
  for (const side of [0, 1]) {
    const base = points.length;
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n; j++) {
        const u = i / n,
          v = j / n;
        const y = u * (1 - v) + v * (1 - u);
        points.push([u - 0.5, y - side * 0.004, v - 0.5]);
      }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const a = base + i * (n + 1) + j,
          b = a + 1,
          c = a + n + 1,
          d = c + 1;
        faces.push(side ? [a, b, c, b, d, c] : [a, c, b, b, c, d]);
      }
  }
  return surface(points, faces);
}

// A billowing triangular pennant in the XY plane, pointing along +X.
function pennant() {
  const points = [
    [0, 0, 0],
    [0, 1, 0],
    [1, 0.5, 0.12],
    [0.45, 0.5, 0.08],
  ];
  return surface(points, [
    [0, 3, 1],
    [0, 2, 3],
    [3, 2, 1],
    [0, 1, 3],
    [0, 3, 2],
    [3, 1, 2],
  ]);
}

const FACTORIES = {
  // Triangular prism: width along X, ridge along Z, base at y = 0, apex at y = 1.
  // Each face owns its vertices so the slopes and gable ends shade crisply.
  gable: () => {
    const [l, r, a] = [
      [-0.5, 0],
      [0.5, 0],
      [0, 1],
    ];
    const at = ([x, y], z) => [x, y, z];
    const faces = [
      [at(l, 0.5), at(r, 0.5), at(a, 0.5)],
      [at(r, -0.5), at(l, -0.5), at(a, -0.5)],
      [at(l, -0.5), at(l, 0.5), at(a, 0.5), at(a, -0.5)],
      [at(r, 0.5), at(r, -0.5), at(a, -0.5), at(a, 0.5)],
      [at(l, -0.5), at(r, -0.5), at(r, 0.5), at(l, 0.5)],
    ];
    const points = [],
      indices = [];
    for (const face of faces) {
      const base = points.length;
      points.push(...face);
      indices.push([base, base + 1, base + 2]);
      if (face.length === 4) indices.push([base, base + 2, base + 3]);
    }
    return surface(points, indices);
  },
  hypar: () => hypar(),
  pennant,
  // Upper hemisphere, base at y = 0.
  dome: () => new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  // A cheaper dome for small, distant crowns such as the mine portal.
  lowDome: () => new THREE.SphereGeometry(1, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2),
  octagon: () => new THREE.CylinderGeometry(1, 1, 1, 8),
  // Unit-radius hoop around +Z (lay it flat with rotation.x = PI / 2).
  hoop: () => new THREE.TorusGeometry(1, 0.13, 6, 18),
  // A soft low-poly crown for trees on islands and roof gardens.
  leafy: () => new THREE.IcosahedronGeometry(1, 1),
  // Pointed cone, base at y = 0, tip at y = 1.
  peak: () => new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0),
};

export function futureShape(d, key) {
  const name = `future-${key}`;
  if (!d.geometries[name]) {
    const geometry = FACTORIES[key]();
    d.geometries[name] = geometry.index ? geometry : mergeVertices(geometry);
  }
  return name;
}
