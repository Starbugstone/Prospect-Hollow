import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import { TRAIL_SILVER } from '../../data/skyCraft';
import { SAUCER_HULL, SAUCER_RADIUS } from './RoundedTransports';

// The sky saucer's sparkle wake. As it leaps away, a star-flash bursts open, and a
// stream of small four-point twinkles is shed along its path, drifting apart and down as
// they fade. Arriving mirrors it: the flash marks where it drops in and the twinkles
// follow it down. Everything is drawn into one preallocated geometry with per-vertex
// colour and alpha, written in world space every frame without allocating. The mesh sits
// under the saucer but cancels the saucer's transform, so twinkles stay where they were
// shed. It is hidden unless the saucer is departing or arriving; its instanced bucket
// then draws nothing.

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const mod = (n, m) => ((n % m) + m) % m;
// Deterministic jitter in [0, 1) for twinkle k.
const hash = (k) => {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Flight segments the wake follows, in seconds of the airport cycle. The departure
// window opens a moment early for the flash, which bursts just before it moves.
const DEPARTURE = Object.freeze({ start: 49, end: 57 });
const APPROACH = Object.freeze({ start: 135, end: 147 });
const segmentAt = (phase, departure, approach) =>
  phase >= departure.start - 0.5 && phase < departure.end
    ? departure
    : phase >= approach.start && phase < approach.end
      ? approach
      : null;

const MOTES = 16,
  MOTE_EVERY = 0.06,
  MOTE_LIFE = MOTES * MOTE_EVERY,
  FLASH_LIFE = 0.75,
  // Two "+" stars per flash: the halo in the core colour and a brighter centre.
  STARS = MOTES + 2,
  VERTICES = STARS * 8;

// Scratch values shared by every saucer.
const s = {
  a: new Vector3(),
  p: new Vector3(),
  drift: new Vector3(),
  heading: new Vector3(),
  view: new Vector3(),
  right: new Vector3(),
  up: new Vector3(),
  across: new Vector3(),
  along: new Vector3(),
  worldUp: new Vector3(0, 1, 0),
  color: new Color(),
  inverse: new Matrix4(),
};

/** Camera-facing basis at `point`: s.right and s.up across the view. */
function billboard(camera, point) {
  if (camera) s.view.subVectors(camera.position, point).normalize();
  else s.view.set(0, 0, 1);
  s.right.crossVectors(s.worldUp, s.view);
  if (s.right.lengthSq() < 1e-8) s.right.set(1, 0, 0);
  s.right.normalize();
  s.up.crossVectors(s.view, s.right).normalize();
}

/** The flash centre: the trait colour made more saturated and a little deeper, so it
 * reads against the pale sky. Computed once per saucer. */
function flashColor(hex) {
  const hsl = new Color(hex).getHSL({ h: 0, s: 0, l: 0 });
  return new Color().setHSL(hsl.h, Math.min(1, hsl.s + 0.3), Math.max(0.45, hsl.l - 0.12));
}

/** Build the sparkle wake under `parent`, the saucer root (whose own parent sits at the
 * world origin). `path(phase, toMoon, out)` writes the saucer's flight position at a
 * cycle phase; `colors` holds the era's `light` and `secondary` (trait or rim) colours.
 * Optional windows and scale let other scenes reuse the same wake and launch flash. */
export function createSaucerTrail(
  d,
  parent,
  { colors: palette, path, departure = DEPARTURE, approach = APPROACH, scale = 1 },
) {
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(new Float32Array(VERTICES * 3), 3);
  const color = new BufferAttribute(new Float32Array(VERTICES * 4), 4);
  geometry.setAttribute('position', position);
  geometry.setAttribute('color', color);
  const indices = [];
  for (let q = 0; q < STARS * 2; q++)
    indices.push(4 * q, 4 * q + 1, 4 * q + 2, 4 * q, 4 * q + 2, 4 * q + 3);
  geometry.setIndex(indices);
  geometry.userData.owned = true;
  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    // Drawn after the opaque saucer and depth-tested against it, so the hull hides
    // what is behind it; no depth writes, so the stars never hide each other.
    depthTest: true,
    depthWrite: false,
    side: DoubleSide,
  });
  material.userData.transient = true;
  const mesh = new Mesh(geometry, material);
  mesh.name = 'saucerTrail';
  mesh.matrixAutoUpdate = false;
  mesh.frustumCulled = false;
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.visible = false;
  parent.add(mesh);

  // [twinkle, twinkle highlight, flash centre]. The era's trait (or rim) colour carries
  // the wake against the pale sky, with its light as the highlight; on the Moon route a
  // moonlit blue-silver takes the trait colour's place.
  const colors = {
    sky: Object.freeze([
      new Color(palette.secondary),
      new Color(palette.light),
      flashColor(palette.secondary),
    ]),
    moon: Object.freeze([
      new Color(TRAIL_SILVER),
      new Color(palette.light),
      flashColor(TRAIL_SILVER),
    ]),
  };

  const vertex = (index, point, tint, alpha) => {
    position.array[index * 3] = point.x;
    position.array[index * 3 + 1] = point.y;
    position.array[index * 3 + 2] = point.z;
    color.array[index * 4] = tint.r;
    color.array[index * 4 + 1] = tint.g;
    color.array[index * 4 + 2] = tint.b;
    color.array[index * 4 + 3] = clamp01(alpha);
  };
  const hide = (star) => color.array.fill(0, star * 32, (star + 1) * 32);
  // A "+" star facing the camera: a tall thin diamond and a wide thin one. `turn` rotates
  // it in the view plane (0.785 gives an "x").
  const star = (index, point, size, tint, alpha, turn = 0) => {
    size *= scale;
    const cos = Math.cos(turn),
      sin = Math.sin(turn);
    s.along.copy(s.up).multiplyScalar(cos).addScaledVector(s.right, sin);
    s.across.copy(s.right).multiplyScalar(cos).addScaledVector(s.up, -sin);
    for (let q = 0; q < 2; q++) {
      const tall = q ? 0.32 : 1.7,
        wide = q ? 1.7 : 0.32,
        v = index * 8 + q * 4;
      vertex(v, s.a.copy(point).addScaledVector(s.along, size * tall), tint, alpha);
      vertex(v + 1, s.a.copy(point).addScaledVector(s.across, size * wide), tint, alpha);
      vertex(v + 2, s.a.copy(point).addScaledVector(s.along, -size * tall), tint, alpha);
      vertex(v + 3, s.a.copy(point).addScaledVector(s.across, -size * wide), tint, alpha);
    }
  };

  return {
    mesh,
    /** Draw the wake at cycle `phase`; `reduced` (reduced motion) leaves it off. */
    update(phase, toMoon, reduced) {
      const segment = reduced ? null : segmentAt(phase, departure, approach);
      mesh.visible = !!segment;
      if (!segment) return;
      // Cancel the saucer's own transform, so vertices are in world space.
      parent.updateMatrix();
      mesh.matrix.copy(s.inverse.copy(parent.matrix).invert());
      const camera = d.camera ?? null,
        tints = toMoon ? colors.moon : colors.sky,
        arriving = segment === approach;

      // Twinkles are shed while it moves fast: just after the leap, or while coming in.
      // Slot n holds the most recent twinkle k with k = n (mod MOTES).
      const emitFrom = segment.start + (arriving ? 0.1 : 0.3),
        emitTo = segment.end - (arriving ? 1.2 : 1.5),
        emitted = Math.min(phase, emitTo) - emitFrom,
        latest = emitted >= 0 ? Math.floor(emitted / MOTE_EVERY) : -1;
      for (let slot = 0; slot < MOTES; slot++) {
        const k = latest - mod(latest - slot, MOTES),
          age = phase - emitFrom - k * MOTE_EVERY;
        if (latest < 0 || k < 0 || age < 0 || age > MOTE_LIFE) {
          hide(slot);
          continue;
        }
        const life = age / MOTE_LIFE,
          h = hash(k + (arriving ? 1000 : 0)),
          shed = emitFrom + k * MOTE_EVERY;
        // Shed from the hull's trailing edge, at hull height, so they start behind the
        // saucer rather than under it.
        path(shed, toMoon, s.p);
        path(Math.max(segment.start, shed - 0.05), toMoon, s.heading);
        s.heading.subVectors(s.p, s.heading);
        if (s.heading.lengthSq() < 1e-10) s.heading.set(0, 1, 0);
        s.p.addScaledVector(s.heading.normalize(), -0.9 * SAUCER_RADIUS * scale);
        s.p.y += SAUCER_HULL * scale;
        // Drift apart along a fixed random direction, and sink a little.
        s.drift.set(hash(k * 3 + 1) - 0.5, hash(k * 5 + 2) - 0.5, hash(k * 7 + 3) - 0.5);
        if (s.drift.lengthSq() < 1e-6) s.drift.set(0, 1, 0);
        s.p.addScaledVector(s.drift.normalize(), (0.6 + 2.2 * life) * scale);
        s.p.y -= 0.9 * life * life * scale;
        billboard(camera, s.p);
        const twinkle = 0.55 + 0.45 * Math.sin(age * 19 + h * 6.28);
        star(
          slot,
          s.p,
          (0.38 + 0.34 * h) * (1 - 0.45 * life),
          tints[slot % 2],
          (1 - smooth(life)) * twinkle,
        );
      }
      // Upload once per frame, after the flash below is written too.
      position.needsUpdate = true;
      color.needsUpdate = true;

      // The flash, where it leaps away (just before it moves) or where it drops in: a
      // halo star in the trait colour opens wide and fades, around a brief, brighter,
      // saturated centre turned 45° so the burst has eight points.
      const age = phase - (arriving ? segment.start : segment.start - 0.15);
      if (age < 0 || age > FLASH_LIFE) {
        hide(MOTES);
        hide(MOTES + 1);
        return;
      }
      const k = age / FLASH_LIFE;
      path(segment.start, toMoon, s.p);
      s.p.y += SAUCER_HULL * scale;
      billboard(camera, s.p);
      star(MOTES, s.p, 1 + 1.8 * smooth(k * 1.4), tints[0], 0.85 * (1 - smooth(k)));
      star(
        MOTES + 1,
        s.p,
        0.8 + 0.9 * smooth(k * 2.5),
        tints[2],
        1 - smooth((age - 0.2) / 0.35),
        Math.PI / 4,
      );
    },
  };
}
