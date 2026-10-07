import { futureShape } from '../futureShapes';

// Stargazer: night-blue ceramic walls, copper cornices, starlit windows and
// white observatory domes split by a viewing slit.
const TAU = Math.PI * 2;

function stars(d, g, x, y, z, w, h, p, count = 5) {
  for (let n = 0; n < count; n++) {
    const u = ((n * 0.618) % 1) - 0.5,
      v = ((n * 0.382 + 0.17) % 1) * 0.8 + 0.1;
    d.ball(g, x + u * w * 0.9, y + v * h, z, n % 2 ? 0.05 : 0.07, p.light, 'rock');
  }
}
function slitDome(d, g, x, y, z, r, p) {
  d.mesh(g, futureShape(d, 'dome'), [r, r, r], [x, y, z], p.shell);
  d.mesh(g, futureShape(d, 'octagon'), [r + 0.05, 0.08, r + 0.05], [x, y + 0.02, z], p.timber);
  // The viewing slit runs over the top from the front edge.
  let last = null;
  for (let n = 0; n <= 4; n++) {
    const a = (n / 4) * (Math.PI / 2) * 0.92;
    const point = [x, y + Math.sin(a) * r * 1.02, z + Math.cos(a) * r * 1.02];
    if (last) d.rod(g, last, point, r * 0.11, p.deep);
    last = point;
  }
}
function arched(d, g, x, y, z, p, w = 0.3, h = 0.8) {
  d.box(g, w + 0.1, h + 0.1, 0.06, x, y, z, p.timber);
  d.box(g, w, h, 0.08, x, y, z + 0.01, p.glass);
}

export const observatoryKit = {
  block(d, g, s, { x = 0, z = 0, w, dep, h }) {
    const p = s.palette;
    d.box(g, w + 0.3, 0.26, dep + 0.3, x, 0.13, z, p.shell);
    d.box(g, w, h - 0.26, dep, x, 0.26 + (h - 0.26) / 2, z, p.roof);
    d.box(g, w + 0.16, 0.16, dep + 0.16, x, h - 0.08, z, p.timber);
    for (let y = 0.95; y < h - 0.4; y += 1.15)
      for (const side of [-1, 1]) arched(d, g, x + side * w * 0.3, y + 0.25, z + dep / 2 + 0.02, p);
    stars(d, g, x, 0.4, z + dep / 2 + 0.05, w, h - 0.6, p, Math.round(w * 1.6));
    return h;
  },
  // A pale parapet and a slit dome sit on every flat roof.
  roof(d, g, s, { x = 0, z = 0, w, dep, y }) {
    const p = s.palette,
      r = Math.min(w, dep) * 0.36;
    d.box(g, w + 0.24, 0.2, dep + 0.24, x, y + 0.1, z, p.shell);
    d.mesh(g, 'cylinder', [r + 0.08, 0.24, r + 0.08], [x, y + 0.32, z], p.roof);
    slitDome(d, g, x, y + 0.44, z, r, p);
    return y + 0.44 + r;
  },
  round(d, g, s, { x = 0, z = 0, r, h }) {
    const p = s.palette;
    d.mesh(g, futureShape(d, 'octagon'), [r + 0.18, 0.26, r + 0.18], [x, 0.13, z], p.shell);
    d.mesh(g, futureShape(d, 'octagon'), [r, h - 0.26, r], [x, 0.26 + (h - 0.26) / 2, z], p.roof);
    for (let y = 1.2; y < h - 0.3; y += 1.15) {
      d.mesh(g, futureShape(d, 'octagon'), [r + 0.08, 0.08, r + 0.08], [x, y, z], p.timber);
      for (const side of [-1, 1])
        arched(d, g, x + side * r * 0.4, y + 0.5, z + r * 0.9, p, 0.24, 0.6);
    }
    stars(d, g, x, 0.5, z + r * 0.93, r * 1.4, h - 0.8, p, 4);
    return h;
  },
  cap(d, g, s, { x = 0, z = 0, r, y }) {
    const p = s.palette;
    d.mesh(g, futureShape(d, 'octagon'), [r + 0.12, 0.16, r + 0.12], [x, y + 0.08, z], p.timber);
    slitDome(d, g, x, y + 0.16, z, r * 0.92, p);
    d.rod(g, [x, y + 0.16 + r * 0.92, z], [x, y + r * 0.92 + 0.6, z], 0.03, p.timber);
    d.ball(g, x, y + r * 0.92 + 0.66, z, [0.12, 0.16, 0.12], p.light, 'rock');
    return y + r + 0.4;
  },
  door(d, g, s, x, z) {
    const p = s.palette;
    d.box(g, 0.72, 1.18, 0.1, x, 0.85, z, p.timber, true);
    d.box(g, 0.56, 1.04, 0.12, x, 0.8, z + 0.02, p.deep, true);
    d.ball(g, x, 1.5, z + 0.08, 0.07, p.light);
  },
  wing(d, g, s, { x, z, r = 0.7 }) {
    const top = observatoryKit.round(d, g, s, { x, z, r, h: 1.5 });
    observatoryKit.cap(d, g, s, { x, z, r, y: top });
  },
  // A copper telescope points through the slit and a violet orbit ring circles it.
  crown(d, g, s, { x = 0, z = 0, y, r = 1 }) {
    const p = s.palette;
    const base = [x, y - r * 0.35, z + 0.1],
      tip = [x + 0.25, y + r * 0.85, z + r * 0.95];
    d.rod(g, base, tip, 0.15, p.timber);
    d.ball(g, ...tip, [0.17, 0.06, 0.17], p.glass, 'rock');
    const ring = d.mesh(
      g,
      futureShape(d, 'hoop'),
      [r * 1.1, r * 1.1, 0.35],
      [x, y - r * 0.25, z],
      p.flower,
    );
    ring.rotation.set(Math.PI / 2 - 0.38, 0, 0.2);
    d.ball(g, x + r * 1.08, y - r * 0.25 + 0.16, z - 0.2, 0.13, p.light, 'rock');
  },
  // A star lamp: a copper post crowned by a little gold star.
  prop(d, g, s, x, z, y = 0) {
    const p = s.palette;
    d.mesh(g, futureShape(d, 'octagon'), [0.2, 0.2, 0.2], [x, y + 0.1, z], p.roof);
    d.rod(g, [x, y + 0.15, z], [x, y + 1.45, z], 0.04, p.deep);
    d.mesh(g, futureShape(d, 'octagon'), [0.15, 0.04, 0.15], [x, y + 1.5, z], p.timber);
    const star = d.ball(g, x, y + 1.62, z, [0.13, 0.13, 0.05], p.light, 'rock');
    star.rotation.z = TAU / 10;
  },
};
