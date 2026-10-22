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
import { SAUCER_TRAIL, SAUCER_TRAIL_STYLES, TRAIL_SILVER } from '../../data/skyCraft';

// The sky saucer's departure and arrival effect. Each style draws into one preallocated
// geometry: a fixed vertex count with per-vertex colour and alpha, written in world
// space every frame without allocating. The mesh sits under the saucer but cancels the
// saucer's transform, so an effect can stay behind in the sky while the saucer flies on.
// It is hidden whenever the saucer is not departing or arriving, and its instanced
// bucket then draws nothing.

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const mod = (n, m) => ((n % m) + m) % m;
// Deterministic jitter in [0, 1) for particle k.
const hash = (k) => {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Flight segments the trail follows, in seconds of the airport cycle.
const TRAIL_DEPARTURE = Object.freeze({ start: 49, end: 57 });
const TRAIL_APPROACH = Object.freeze({ start: 135, end: 147 });
const segmentAt = (phase) =>
  phase >= TRAIL_DEPARTURE.start - 0.5 && phase < TRAIL_DEPARTURE.end
    ? TRAIL_DEPARTURE
    : phase >= TRAIL_APPROACH.start && phase < TRAIL_APPROACH.end
      ? TRAIL_APPROACH
      : null;

// Scratch values shared by every trail.
const s = {
  a: new Vector3(),
  b: new Vector3(),
  p: new Vector3(),
  dir: new Vector3(),
  u: new Vector3(),
  w: new Vector3(),
  view: new Vector3(),
  right: new Vector3(),
  up: new Vector3(),
  axis: new Vector3(),
  worldUp: new Vector3(0, 1, 0),
  color: new Color(),
  inverse: new Matrix4(),
};

function makeGeometry(vertices, indices) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(vertices * 4), 4));
  geometry.setIndex(indices);
  geometry.userData.owned = true;
  return geometry;
}

class TrailWriter {
  constructor(geometry) {
    this.position = geometry.getAttribute('position');
    this.color = geometry.getAttribute('color');
  }
  vertex(index, point, color, alpha) {
    const p = this.position.array,
      c = this.color.array;
    p[index * 3] = point.x;
    p[index * 3 + 1] = point.y;
    p[index * 3 + 2] = point.z;
    c[index * 4] = color.r;
    c[index * 4 + 1] = color.g;
    c[index * 4 + 2] = color.b;
    c[index * 4 + 3] = clamp01(alpha);
  }
  /** Fully transparent: the vertices keep their place but draw nothing. */
  hide(from, to) {
    this.color.array.fill(0, from * 4, to * 4);
  }
  commit() {
    this.position.needsUpdate = true;
    this.color.needsUpdate = true;
  }
}

/** Unit direction of travel at `phase`, from two nearby points of the flight. */
function travel(ctx, phase, out) {
  ctx.path(phase + 0.03, ctx.toMoon, s.a);
  ctx.path(phase - 0.03, ctx.toMoon, s.b);
  out.subVectors(s.a, s.b);
  if (out.lengthSq() < 1e-10) out.set(0, 1, 0);
  return out.normalize();
}
/** Camera-facing basis at `point` (s.view, s.right, s.up). */
function billboard(ctx, point) {
  if (ctx.camera) s.view.subVectors(ctx.camera.position, point).normalize();
  else s.view.set(0, 0, 1);
  s.right.crossVectors(s.worldUp, s.view);
  if (s.right.lengthSq() < 1e-8) s.right.set(1, 0, 0);
  s.right.normalize();
  s.up.crossVectors(s.view, s.right).normalize();
}

// A. Warp rings: thin glowing rings pop out behind the hull as it jumps away, each
// widening and fading where it was left. Arriving, the same rings close in on the
// saucer as it slows: the jump played backwards.
const RINGS = 4,
  RING_SEGMENTS = 20,
  RING_LIFE = 1.1,
  RING_TIMES = Object.freeze([0.35, 0.85, 1.45, 2.15]);
const rings = {
  vertices: RINGS * RING_SEGMENTS * 2,
  indices() {
    const indices = [];
    for (let r = 0; r < RINGS; r++)
      for (let i = 0; i < RING_SEGMENTS; i++) {
        const base = r * RING_SEGMENTS * 2,
          a = base + 2 * i,
          b = base + 2 * ((i + 1) % RING_SEGMENTS);
        indices.push(a, a + 1, b + 1, a, b + 1, b);
      }
    return indices;
  },
  write(ctx, out) {
    const { phase, segment, colors } = ctx;
    const arriving = segment === TRAIL_APPROACH;
    for (let r = 0; r < RINGS; r++) {
      const first = r * RING_SEGMENTS * 2;
      // Departing, ring r is left at start + t; arriving, it closes on end - t.
      const at = arriving ? segment.end - RING_TIMES[r] : segment.start + RING_TIMES[r];
      const age = arriving ? at - phase : phase - at;
      if (age < 0 || age > RING_LIFE) {
        out.hide(first, first + RING_SEGMENTS * 2);
        continue;
      }
      const k = age / RING_LIFE;
      ctx.path(at, ctx.toMoon, s.p);
      travel(ctx, at, s.dir);
      // Two axes across the direction of travel span the ring.
      s.axis.copy(Math.abs(s.dir.y) > 0.95 ? s.right.set(1, 0, 0) : s.worldUp);
      s.u.crossVectors(s.dir, s.axis).normalize();
      s.w.crossVectors(s.dir, s.u).normalize();
      const radius = 1.5 + 3 * smooth(k),
        width = 0.34 * (1 - 0.6 * k),
        // A quick pop in as each ring appears (departing) or reaches the hull (arriving).
        alpha = 0.9 * (1 - smooth(k)) * smooth(age / 0.08 + (arriving ? 1 : 0)),
        color = colors[r % 2];
      for (let i = 0; i < RING_SEGMENTS; i++) {
        const angle = (i / RING_SEGMENTS) * Math.PI * 2,
          cos = Math.cos(angle),
          sin = Math.sin(angle);
        for (let edge = 0; edge < 2; edge++) {
          const reach = radius + (edge ? width : -width) / 2;
          s.a
            .copy(s.p)
            .addScaledVector(s.u, cos * reach)
            .addScaledVector(s.w, sin * reach);
          out.vertex(first + 2 * i + edge, s.a, color, alpha);
        }
      }
    }
  },
};

// B. Ribbon of light: a tapered ribbon along the path the saucer actually flew, bright
// at the hull and fading to nothing, inside a wider, fainter glow. Arriving, it trails
// back along the way it came in and shortens as it slows.
const RIBBON_POINTS = 18,
  RIBBON_STEP = 0.05,
  // [first vertex, width scale, alpha] for the glow, then the core drawn over it.
  RIBBON_LAYERS = Object.freeze([
    Object.freeze([0, 2.6, 0.28]),
    Object.freeze([RIBBON_POINTS * 2, 1, 0.95]),
  ]);
function stripIndices(points, offset) {
  const indices = [];
  for (let i = 0; i < points - 1; i++) {
    const a = offset + 2 * i;
    indices.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  return indices;
}
const ribbon = {
  vertices: RIBBON_POINTS * 2 * 2,
  indices: () => [
    ...stripIndices(RIBBON_POINTS, 0),
    ...stripIndices(RIBBON_POINTS, RIBBON_POINTS * 2),
  ],
  write(ctx, out) {
    const { phase, segment, colors, strength } = ctx;
    for (let i = 0; i < RIBBON_POINTS; i++) {
      const t = Math.max(segment.start, phase - i * RIBBON_STEP),
        k = i / (RIBBON_POINTS - 1);
      ctx.path(t, ctx.toMoon, s.p);
      travel(ctx, t, s.dir);
      billboard(ctx, s.p);
      // The width runs across the path, as seen from the camera.
      s.u.crossVectors(s.dir, s.view);
      if (s.u.lengthSq() < 1e-8) s.u.copy(s.right);
      s.u.normalize();
      s.color.copy(colors[0]).lerp(colors[1], k);
      const width = 0.62 * (1 - k) ** 0.7,
        alpha = strength * (1 - k) ** 1.4;
      for (let layer = 0; layer < RIBBON_LAYERS.length; layer++) {
        const [base, scale, fade] = RIBBON_LAYERS[layer];
        for (let side = 0; side < 2; side++) {
          s.a.copy(s.p).addScaledVector(s.u, (side ? 1 : -1) * width * scale);
          out.vertex(base + 2 * i + side, s.a, s.color, alpha * fade);
        }
      }
    }
  },
};

// C. Sparkle wake: a stream of small four-point twinkles shed along the path, drifting
// apart and down as they fade, after a bright star-flash at the moment it leaps away.
// Arriving, the flash marks where it drops in, and the twinkles follow it down.
const MOTES = 16,
  MOTE_EVERY = 0.06,
  MOTE_LIFE = MOTES * MOTE_EVERY,
  FLASH_LIFE = 0.8;
function quadIndices(count) {
  const indices = [];
  for (let q = 0; q < count; q++)
    indices.push(4 * q, 4 * q + 1, 4 * q + 2, 4 * q, 4 * q + 2, 4 * q + 3);
  return indices;
}
// A "+" star: a tall thin diamond and a wide thin one, facing the camera.
function star(out, first, point, size, color, alpha) {
  for (let q = 0; q < 2; q++) {
    const tall = q ? 0.32 : 1.7,
      wide = q ? 1.7 : 0.32,
      v = first + q * 4;
    s.a.copy(point).addScaledVector(s.up, size * tall);
    out.vertex(v, s.a, color, alpha);
    s.a.copy(point).addScaledVector(s.right, size * wide);
    out.vertex(v + 1, s.a, color, alpha);
    s.a.copy(point).addScaledVector(s.up, -size * tall);
    out.vertex(v + 2, s.a, color, alpha);
    s.a.copy(point).addScaledVector(s.right, -size * wide);
    out.vertex(v + 3, s.a, color, alpha);
  }
}
const sparkle = {
  // Two diamonds per twinkle, plus one larger star for the flash.
  vertices: (MOTES + 1) * 8,
  indices: () => quadIndices((MOTES + 1) * 2),
  write(ctx, out) {
    const { phase, segment, colors } = ctx;
    const arriving = segment === TRAIL_APPROACH;
    // Twinkles are shed while it moves fast: just after the leap, or while coming in.
    const emitFrom = segment.start + (arriving ? 0.1 : 0.3),
      emitTo = segment.end - (arriving ? 1.2 : 1.5);
    const emitted = Math.min(phase, emitTo) - emitFrom;
    const latest = emitted >= 0 ? Math.floor(emitted / MOTE_EVERY) : -1;
    for (let slot = 0; slot < MOTES; slot++) {
      const first = slot * 8,
        k = latest - mod(latest - slot, MOTES),
        age = phase - emitFrom - k * MOTE_EVERY;
      if (latest < 0 || k < 0 || age < 0 || age > MOTE_LIFE) {
        out.hide(first, first + 8);
        continue;
      }
      const life = age / MOTE_LIFE,
        h = hash(k + (arriving ? 1000 : 0));
      ctx.path(emitFrom + k * MOTE_EVERY, ctx.toMoon, s.p);
      // Drift apart along a fixed random direction, and sink a little.
      s.dir.set(hash(k * 3 + 1) - 0.5, hash(k * 5 + 2) - 0.5, hash(k * 7 + 3) - 0.5);
      if (s.dir.lengthSq() < 1e-6) s.dir.set(0, 1, 0);
      s.dir.normalize();
      s.p.addScaledVector(s.dir, 0.6 + 2.2 * life);
      s.p.y -= 0.9 * life * life;
      billboard(ctx, s.p);
      const twinkle = 0.55 + 0.45 * Math.sin(age * 19 + h * 6.28);
      star(
        out,
        first,
        s.p,
        (0.18 + 0.2 * h) * (1 - 0.5 * life),
        colors[slot % 2],
        (1 - smooth(life)) * twinkle,
      );
    }
    // The flash: a star bursting open where it leaps away or drops in.
    const flashFirst = MOTES * 8,
      flashAge = phase - (arriving ? segment.start : segment.start - 0.15);
    if (flashAge < 0 || flashAge > FLASH_LIFE) {
      out.hide(flashFirst, flashFirst + 8);
      return;
    }
    const k = flashAge / FLASH_LIFE;
    ctx.path(segment.start, ctx.toMoon, s.p);
    billboard(ctx, s.p);
    s.color.copy(colors[0]).lerp(colors[2], 0.5 * (1 - k));
    star(out, flashFirst, s.p, 0.6 + 2.6 * smooth(k * 1.6), s.color, 1 - smooth(k));
  },
};

const STYLES = { rings, ribbon, sparkle };

/** Resolve a trail style name; an unknown one falls back to the default. */
export const saucerTrailStyle = (style) =>
  SAUCER_TRAIL_STYLES.includes(style) ? style : SAUCER_TRAIL;

/** Build the saucer's trail under `parent`, the saucer root (whose own parent must sit
 * at the world origin). `path(phase, toMoon, out)` writes the saucer's flight position
 * at a cycle phase; `colors` holds the era's `light` and `secondary` colours. */
export function createSaucerTrail(d, parent, { style, colors: palette, path }) {
  const name = saucerTrailStyle(style),
    kind = STYLES[name];
  const geometry = makeGeometry(kind.vertices, kind.indices());
  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  material.userData.transient = true;
  const mesh = new Mesh(geometry, material);
  mesh.name = 'saucerTrail';
  mesh.userData.trailStyle = name;
  mesh.matrixAutoUpdate = false;
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.visible = false;
  parent.add(mesh);
  const writer = new TrailWriter(geometry);
  // Era colours, or a faint silver on the Moon route; white for the sparkle flash.
  const colors = {
    sky: Object.freeze([
      new Color(palette.light),
      new Color(palette.secondary),
      new Color('#ffffff'),
    ]),
    moon: Object.freeze([new Color(TRAIL_SILVER), new Color(palette.light), new Color('#ffffff')]),
  };
  const ctx = {
    phase: 0,
    segment: null,
    toMoon: false,
    strength: 0,
    colors: colors.sky,
    camera: null,
    path,
  };
  return {
    mesh,
    /** `phase` in the airport cycle; `strength` (0..1) scales the ribbon; `reduced`
     * (reduced motion) leaves the trail off. */
    update(phase, toMoon, strength, reduced) {
      const segment = reduced ? null : segmentAt(phase);
      mesh.visible = !!segment;
      if (!segment) return;
      // Cancel the saucer's own transform, so vertices are in world space.
      parent.updateMatrix();
      mesh.matrix.copy(s.inverse.copy(parent.matrix).invert());
      ctx.phase = phase;
      ctx.segment = segment;
      ctx.toMoon = toMoon;
      ctx.strength = strength;
      ctx.colors = toMoon ? colors.moon : colors.sky;
      ctx.camera = d.camera ?? null;
      kind.write(ctx, writer);
      writer.commit();
    },
  };
}
