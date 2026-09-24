import {
  BufferGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  Float32BufferAttribute,
  TubeGeometry,
  Vector3,
} from 'three';

// Shaped, shared meshes for the silhouettes that the generic town primitives
// cannot express (the town's "cone", for example, has a flat, truncated top).
function profileGeometry(rings, side = 1) {
  const positions = [],
    indices = [],
    sections = [],
    count = 12;
  for (const [z, rx, ry, y = 0, x = 0] of rings)
    for (let n = 0; n < count; n++) {
      const angle = (n * Math.PI * 2) / count;
      positions.push(side * (x + Math.cos(angle) * rx), y + Math.sin(angle) * ry, z);
    }
  for (let r = 0; r < rings.length - 1; r++) {
    const start = indices.length;
    for (let n = 0; n < count; n++) {
      const a = r * count + n,
        b = r * count + ((n + 1) % count);
      const faces = [a, b, a + count, b, b + count, a + count];
      if (side < 0)
        for (let i = 0; i < faces.length; i += 3)
          [faces[i + 1], faces[i + 2]] = [faces[i + 2], faces[i + 1]];
      indices.push(...faces);
    }
    sections.push([start, indices.length]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, sections };
}

export function catGeometries(d) {
  const cache = d.geometries;
  if (cache.catBody) return;
  cache.catBody = profileGeometry([
    [-0.29, 0, 0, 0.35],
    [-0.23, 0.13, 0.17, 0.35],
    [-0.1, 0.145, 0.19, 0.37],
    [0.06, 0.115, 0.15, 0.39],
    [0.19, 0.14, 0.19, 0.4],
    [0.27, 0.075, 0.13, 0.45],
    [0.29, 0, 0, 0.46],
  ]).geometry;
  const ear = new BufferGeometry();
  ear.setAttribute(
    'position',
    new Float32BufferAttribute(
      [-0.5, 0, 0.25, 0.5, 0, 0.25, 0, 1, 0, -0.5, 0, -0.25, 0.5, 0, -0.25, 0, 1, -0.1],
      3,
    ),
  );
  ear.setIndex([0, 1, 2, 4, 3, 5, 3, 0, 2, 3, 2, 5, 1, 4, 5, 1, 5, 2, 3, 4, 1, 3, 1, 0]);
  cache.catEar = ear.toNonIndexed();
  cache.catEar.computeVertexNormals();
  ear.dispose();
  const tail = new CatmullRomCurve3(
    [
      [0, 0, 0],
      [0, 0.14, -0.075],
      [0, 0.32, -0.085],
      [0.035, 0.46, -0.05],
      [0.09, 0.49, -0.02],
      [0.12, 0.45, 0],
    ].map((p) => new Vector3(...p)),
  );
  cache.catTail = new TubeGeometry(tail, 18, 0.043, 7, false);
  const tip = new CatmullRomCurve3(
    Array.from({ length: 7 }, (_, i) => tail.getPoint(0.76 + i * 0.04)),
  );
  cache.catTailTip = new TubeGeometry(tip, 6, 0.044, 7, false);
}

export function pigeonGeometries(d) {
  const cache = d.geometries;
  if (cache.pigeonBeak) return;
  cache.pigeonBeak = new ConeGeometry(0.03, 0.075, 6).rotateX(Math.PI / 2);
  const rings = [
    [-0.235, 0, 0, -0.04, 0.025],
    [-0.19, 0.026, 0.06, -0.015, 0.03],
    [-0.15, 0.035, 0.09, 0, 0.03],
    [-0.125, 0.04, 0.103, 0.006, 0.03],
    [-0.075, 0.047, 0.117, 0.009, 0.03],
    [-0.05, 0.05, 0.124, 0.01, 0.03],
    [0.02, 0.05, 0.126, 0.015, 0.03],
    [0.105, 0.036, 0.09, 0.025, 0.02],
    [0.16, 0, 0, 0.03, 0],
  ];
  for (const side of [-1, 1]) {
    const { geometry, sections } = profileGeometry(rings, side);
    for (const band of [false, true]) {
      const part = geometry.clone(),
        indices = [];
      sections.forEach(([start, end], section) => {
        if ([2, 4].includes(section) !== band) return;
        for (let i = start; i < end; i++) indices.push(geometry.index.getX(i));
      });
      // Bands are adjacent faces of the wing itself, not raised decoration.
      part.setIndex(indices);
      cache[`pigeonWing${side}${band ? 'Bars' : ''}`] = part;
    }
    geometry.dispose();
  }
}
