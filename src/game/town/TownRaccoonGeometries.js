import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  LatheGeometry,
  MathUtils,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// The upright raccoon's head and the markings that wrap round it. The markings are
// patches of the head's own surface, raised a little, so the mask follows the cheeks
// instead of sitting on the face as flat discs. Every geometry is unit-sized, indexed and
// carries position, normal and uv like the shared primitives, so `d.batch` can merge it.

// A ball with full, low cheeks and a slightly flat face.
function shape(v) {
  v.x *= 1 + 0.17 * (1 - MathUtils.smoothstep(v.y, -0.55, 0.35));
  if (v.y < 0) v.y *= 0.9;
  if (v.z > 0) v.z *= 0.96;
  return v;
}

const RAD = Math.PI / 180;
/** The point of the unit head at `yaw` (toward its left) and `pitch` (up), in degrees. */
export function raccoonHeadPoint(yaw, pitch, lift = 1, out = new Vector3()) {
  const flat = Math.cos(pitch * RAD);
  return shape(
    out.set(Math.sin(yaw * RAD) * flat, Math.sin(pitch * RAD), Math.cos(yaw * RAD) * flat),
  ).multiplyScalar(lift);
}

function finish(positions, indices) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute(new Float32Array(positions.length / 1.5), 2),
  );
  return geometry;
}

// Welded without uv, so a lathe's seam does not show as a crease.
function welded(source) {
  source.deleteAttribute('uv');
  source.deleteAttribute('normal');
  const geometry = mergeVertices(source);
  source.dispose();
  return geometry;
}
const weldedBall = () => welded(new SphereGeometry(1, 16, 10));
function smooth(source) {
  const geometry = welded(source);
  const result = finish(
    Array.from(geometry.attributes.position.array),
    Array.from(geometry.index.array),
  );
  geometry.dispose();
  return result;
}

function headGeometry() {
  const ball = weldedBall();
  const position = ball.attributes.position,
    v = new Vector3();
  for (let n = 0; n < position.count; n++) {
    shape(v.fromBufferAttribute(position, n));
    position.setXYZ(n, v.x, v.y, v.z);
  }
  const geometry = finish(Array.from(position.array), Array.from(ball.index.array));
  ball.dispose();
  return geometry;
}

// Chords of the 16-sided head lie up to 2% inside the smooth surface: a patch's rim sinks
// below them and its middle stands above, so it seals without z-fighting.
const RIM = 0.97,
  RAISED = 1.03;
const ACROSS = 4,
  ALONG = 2;
/**
 * Markings along `lines`: each a centre line of `[yaw, pitch, halfWidth]` in degrees on
 * the head's left side, mirrored onto the right unless `mirror` is false.
 */
function markings(lines, mirror = true) {
  const positions = [],
    indices = [],
    a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  for (const line of lines)
    for (const side of mirror ? [1, -1] : [1]) {
      const curve = new CatmullRomCurve3(line.map((p) => new Vector3(...p)));
      const samples = curve.getPoints((line.length - 1) * ALONG);
      const start = positions.length / 3;
      samples.forEach((at, i) => {
        const before = samples[Math.max(0, i - 1)],
          after = samples[Math.min(samples.length - 1, i + 1)];
        const along = Math.hypot(after.x - before.x, after.y - before.y) || 1;
        const nx = -(after.y - before.y) / along,
          ny = (after.x - before.x) / along;
        for (let j = 0; j <= ACROSS; j++) {
          const t = ((j * 2) / ACROSS - 1) * at.z;
          const rim = i === 0 || i === samples.length - 1 || j === 0 || j === ACROSS;
          raccoonHeadPoint(side * (at.x + nx * t), at.y + ny * t, rim ? RIM : RAISED, a);
          positions.push(a.x, a.y, a.z);
        }
      });
      const corner = (n) => a.fromArray(positions, n * 3);
      for (let i = 0; i < samples.length - 1; i++)
        for (let j = 0; j < ACROSS; j++) {
          const p = start + i * (ACROSS + 1) + j,
            q = p + ACROSS + 1;
          for (const face of [
            [p, q, p + 1],
            [p + 1, q, q + 1],
          ]) {
            // Wind every face outward, whichever side of the head it is on.
            b.fromArray(positions, face[1] * 3).sub(corner(face[0]));
            c.fromArray(positions, face[2] * 3).sub(corner(face[0]));
            if (b.cross(c).dot(corner(face[0])) < 0) face.reverse();
            indices.push(...face);
          }
        }
    }
  return finish(positions, indices);
}

/** The eye sits in the middle of the mask. */
export const RACCOON_EYE = [23, 6];

export function raccoonGeometries(d) {
  const cache = d.geometries;
  if (cache.raccoonHead) return;
  cache.raccoonHead = headGeometry();
  // A lighter ball for limbs, paws and ears, which are small on screen.
  cache.raccoonPuff = smooth(new SphereGeometry(1, 8, 5));
  // A tuft of fur: a soft base drawn out to a point along +Y, one unit long.
  cache.raccoonTuft = smooth(
    new LatheGeometry(
      [
        [0, -0.14],
        [0.38, 0],
        [0.5, 0.28],
        [0.4, 0.6],
        [0.18, 0.88],
        [0, 1],
      ].map(([radius, y]) => new Vector2(radius, y)),
      7,
    ),
  );
  // The bandit mask: round each eye, then out and down across the cheek.
  cache.raccoonMask = markings([
    [
      [4, 8, 9],
      [RACCOON_EYE[0], RACCOON_EYE[1] + 2, 17],
      [40, 3, 14],
      [57, -6, 11],
      [72, -16, 6],
    ],
  ]);
  // The dark blaze from the nose up over the forehead.
  cache.raccoonBlaze = markings(
    [
      [
        [0, 4, 4],
        [0, 30, 5.5],
        [0, 54, 5],
        [0, 74, 2.5],
      ],
    ],
    false,
  );
  // Pale brows over the mask and pale cheeks under it.
  cache.raccoonPale = markings([
    [
      [7, 31, 3.5],
      [25, 33, 6],
      [45, 27, 6.5],
      [63, 13, 5.5],
      [78, -2, 3],
    ],
    [
      [10, -16, 7],
      [30, -19, 10],
      [50, -27, 10],
      [68, -36, 6],
    ],
  ]);
}
