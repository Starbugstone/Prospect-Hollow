import { futureShape } from '../futureShapes';

// Skysail: stilted timber decks, sailcloth saddles stretched between masts,
// saffron pennants and little garden islands floating on tethers.
const TAU = Math.PI * 2;
// Neighbors fly different sailcloth; a stable hash keeps each building's colour.
const hash = (text = '') => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const cloth = (s, accent) =>
  accent
    ? s.palette.flower
    : [s.palette.roof, s.palette.glass, s.palette.roof, s.palette.flower][hash(s.kind) % 4];

function pennant(d, g, x, y, z, p, size = 0.5, turn = 0) {
  const flag = d.mesh(g, futureShape(d, 'pennant'), [size, size * 0.55, 1], [x, y, z], p.flower);
  flag.rotation.y = turn;
  return flag;
}
function mast(d, g, x, z, from, to, p) {
  d.rod(g, [x, from, z], [x, to, z], 0.055, p.timber);
  d.ball(g, x, to + 0.04, z, 0.07, p.deep, 'rock');
  pennant(d, g, x, to - 0.42, z, p, 0.48, -0.4);
}
function porthole(d, g, x, y, z, p, r = 0.16) {
  const pane = d.mesh(g, futureShape(d, 'octagon'), [r, 0.08, r], [x, y, z + 0.015], p.glass);
  pane.rotation.x = Math.PI / 2;
}

export const sailKit = {
  // A raised deck on short stilts carries every cabin above the breeze line.
  block(d, g, s, { x = 0, z = 0, w, dep, h }) {
    const p = s.palette,
      floor = 0.45;
    // The deck overhangs the sides and back; the front stays flush for forecourts.
    d.box(g, w + 0.42, 0.16, dep + 0.21, x, floor, z - 0.105, p.timber);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        d.box(g, 0.12, floor, 0.12, x + (sx * w) / 2, floor / 2, z + (sz * dep) / 2, p.deep);
    const wall = h - floor - 0.08;
    d.box(g, w, wall, dep, x, floor + 0.08 + wall / 2, z, p.shell);
    d.box(g, w * 0.84, 0.36, 0.06, x, floor + wall * 0.62, z + dep / 2 + 0.01, p.glass);
    for (let y = floor + 1.4; y < h - 0.6; y += 1.1)
      for (const side of [-1, 1])
        porthole(d, g, x + side * w * 0.28, y + 0.35, z + dep / 2 + 0.02, p, 0.14);
    return h;
  },
  // A saddle of sailcloth: high at the front-left and rear-right masts.
  roof(d, g, s, { x = 0, z = 0, w, dep, y, accent = false }) {
    const p = s.palette,
      lift = Math.min(1.5, 0.45 + w * 0.22);
    d.box(g, w + 0.1, 0.1, dep + 0.1, x, y + 0.05, z, p.timber);
    d.mesh(
      g,
      futureShape(d, 'hypar'),
      [w + 0.7, lift, dep + 0.7],
      [x, y + 0.32, z],
      cloth(s, accent),
    );
    // The cloth overhangs the deck: its freestanding supports must reach the
    // ground, not stop in mid-air beside the upper wall. Support low corners too.
    for (const side of [-1, 1]) {
      const mx = x + (side * (w + 0.7)) / 2;
      mast(d, g, mx, z - (side * (dep + 0.7)) / 2, 0, y + lift + 0.75, p);
      d.rod(
        g,
        [mx, 0, z + (side * (dep + 0.7)) / 2],
        [mx, y + 0.32, z + (side * (dep + 0.7)) / 2],
        0.055,
        p.timber,
      );
    }
    // Crowns attach at the saddle's centre, below its high corners.
    return y + 0.32 + lift / 2;
  },
  round(d, g, s, { x = 0, z = 0, r, h }) {
    const p = s.palette;
    d.mesh(g, 'cylinder', [r + 0.3, 0.16, r + 0.3], [x, 0.4, z], p.timber);
    for (let n = 0; n < 4; n++) {
      const a = (n * TAU) / 4 + TAU / 8;
      d.box(g, 0.1, 0.4, 0.1, x + Math.sin(a) * r * 0.9, 0.2, z + Math.cos(a) * r * 0.9, p.deep);
    }
    d.mesh(g, 'cylinder', [r, h - 0.45, r], [x, 0.45 + (h - 0.45) / 2, z], p.shell);
    for (let y = 1.3; y < h - 0.4; y += 1.1) {
      d.mesh(g, 'cylinder', [r + 0.12, 0.08, r + 0.12], [x, y, z], p.timber);
      d.mesh(g, 'cylinder', [r + 0.02, 0.3, r + 0.02], [x, y + 0.45, z], p.glass);
    }
    return h;
  },
  // A peaked sailcloth tent with guy lines and a pennant mast.
  cap(d, g, s, { x = 0, z = 0, r, y, accent = false }) {
    const p = s.palette,
      h = r * 0.95 + 0.4;
    d.mesh(g, futureShape(d, 'peak'), [r * 1.32, h, r * 1.32], [x, y, z], cloth(s, accent));
    for (let n = 0; n < 4; n++) {
      const a = (n * TAU) / 4 + TAU / 8;
      d.rod(
        g,
        [x, y + h, z],
        [x + Math.sin(a) * r * 1.45, y - 0.05, z + Math.cos(a) * r * 1.45],
        0.018,
        p.deep,
      );
    }
    mast(d, g, x, z, y + h - 0.1, y + h + 0.8, p);
    return y + h;
  },
  door(d, g, s, x, z) {
    const p = s.palette;
    d.box(g, 0.66, 1.08, 0.1, x, 0.53 + 0.45, z, p.timber);
    d.box(g, 0.5, 0.94, 0.12, x, 0.5 + 0.45, z + 0.02, p.deep);
    porthole(d, g, x, 1.72, z + 0.03, p, 0.12);
  },
  wing(d, g, s, { x, z, w = 1.35, dep = 1.25 }) {
    const top = sailKit.block(d, g, s, { x, z, w, dep, h: 1.55 });
    sailKit.roof(d, g, s, { x, z, w, dep, y: top, accent: true });
  },
  // A garden island floats over some roofs, tethered to a mooring ring; the
  // others fly a tall kite line from their mast.
  crown(d, g, s, { x = 0, z = 0, y, r = 1 }) {
    const p = s.palette;
    if (hash(s.kind) % 5 > 1) {
      d.rod(g, [x, y - 0.3, z], [x, y + 1.2, z], 0.045, p.timber);
      d.rod(g, [x, y + 1.2, z], [x + 0.9, y + 2.5, z - 0.5], 0.012, p.deep);
      for (const [dx, dy, color] of [
        [0.95, 2.6, p.flower],
        [0.55, 2.05, p.glass],
      ]) {
        const kite = d.box(g, 0.5, 0.5, 0.04, x + dx, y + dy, z - 0.5, color);
        kite.rotation.set(0.35, 0.3, Math.PI / 4);
      }
      return;
    }
    const ix = x + r * 0.25,
      iz = z - 0.35,
      iy = y + 1.6;
    d.rod(g, [x, y - 0.2, z], [ix, iy - 0.3, iz], 0.022, p.deep);
    const rock = d.ball(g, ix, iy - 0.32, iz, [0.95, 0.75, 0.9], p.timber, 'rock');
    rock.rotation.set(Math.PI, 0.4, 0);
    d.mesh(g, 'cylinder', [0.95, 0.14, 0.88], [ix, iy, iz], p.green);
    d.rod(g, [ix + 0.15, iy, iz], [ix + 0.15, iy + 0.55, iz], 0.05, p.timber);
    d.ball(g, ix + 0.15, iy + 0.85, iz, [0.42, 0.38, 0.42], p.green, futureShape(d, 'leafy'));
    d.ball(g, ix - 0.35, iy + 0.18, iz + 0.3, 0.13, p.flower, 'rock');
    d.ball(g, ix + 0.45, iy + 0.18, iz + 0.25, 0.1, p.light, 'rock');
  },
  // A kite post: a small sailcloth diamond tugging on its string.
  prop(d, g, s, x, z, y = 0) {
    const p = s.palette;
    d.mesh(g, 'cylinder', [0.22, 0.16, 0.22], [x, y + 0.08, z], p.timber);
    d.rod(g, [x, y + 0.1, z], [x, y + 1.35, z], 0.035, p.deep);
    d.rod(g, [x, y + 1.35, z], [x + 0.35, y + 1.95, z - 0.1], 0.012, p.deep);
    const kite = d.box(g, 0.34, 0.34, 0.03, x + 0.42, y + 2.05, z - 0.12, p.flower);
    kite.rotation.set(0.3, 0.2, Math.PI / 4);
  },
};
