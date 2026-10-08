import { futureShape } from '../futureShapes';

// Moonward: frontier gables return in moon-white ceramic with gold trim, navy solar
// shingles, barn-red porches and round airlock doors.
function windowPane(d, g, x, y, z, p, w = 0.4, h = 0.5) {
  d.box(g, w + 0.1, h + 0.1, 0.06, x, y, z, p.timber);
  d.box(g, w, h, 0.08, x, y, z + 0.01, p.glass);
  d.box(g, w, 0.04, 0.1, x, y, z + 0.02, p.timber);
}

export const homesteadKit = {
  block(d, g, s, { x = 0, z = 0, w, dep, h, porch = true }) {
    const p = s.palette;
    d.box(g, w + 0.24, 0.22, dep + 0.24, x, 0.11, z, p.deep);
    d.box(g, w, h - 0.22, dep, x, 0.22 + (h - 0.22) / 2, z, p.shell);
    d.box(g, w + 0.06, 0.07, dep + 0.06, x, 0.26, z, p.light);
    d.box(g, w + 0.06, 0.07, dep + 0.06, x, h - 0.04, z, p.light);
    for (let y = 1.25; y < h - 0.3; y += 1.1)
      for (const side of [-1, 1]) windowPane(d, g, x + side * w * 0.3, y, z + dep / 2 + 0.02, p);
    if (porch) {
      const front = z + dep / 2;
      d.box(g, w * 0.86, 0.14, 0.62, x, 0.17, front + 0.31, p.timber);
      for (const side of [-1, 1])
        d.rod(
          g,
          [x + side * w * 0.39, 0.2, front + 0.55],
          [x + side * w * 0.39, 1.55, front + 0.55],
          0.045,
          p.timber,
        );
      const awning = d.box(g, w * 0.92, 0.07, 0.78, x, 1.62, front + 0.33, p.flower);
      awning.rotation.x = 0.22;
    }
    return h;
  },
  // A frontier gable in navy solar shingle with a gold ridge.
  roof(d, g, s, { x = 0, z = 0, w, dep, y }) {
    const p = s.palette,
      rise = Math.min(1.1, w * 0.3);
    d.mesh(g, futureShape(d, 'gable'), [w + 0.36, rise, dep + 0.3], [x, y, z], p.roof);
    // Gold seams run along each solar slope.
    for (const side of [-1, 1])
      d.rod(
        g,
        [x + side * w * 0.24, y + rise * 0.47, z - dep / 2 - 0.1],
        [x + side * w * 0.24, y + rise * 0.47, z + dep / 2 + 0.1],
        0.025,
        p.light,
      );
    d.rod(
      g,
      [x, y + rise + 0.02, z - dep / 2 - 0.15],
      [x, y + rise + 0.02, z + dep / 2 + 0.15],
      0.045,
      p.light,
    );
    // A small round gable window over the porch.
    const vent = d.mesh(
      g,
      'cylinder',
      [0.17, 0.06, 0.17],
      [x, y + rise * 0.38, z + dep / 2 + 0.16],
      p.light,
    );
    vent.rotation.x = Math.PI / 2;
    return y + rise;
  },
  round(d, g, s, { x = 0, z = 0, r, h }) {
    const p = s.palette;
    d.mesh(g, 'cylinder', [r + 0.14, 0.22, r + 0.14], [x, 0.11, z], p.deep);
    d.mesh(g, 'cylinder', [r, h - 0.22, r], [x, 0.22 + (h - 0.22) / 2, z], p.shell);
    for (let y = 1.1; y < h - 0.2; y += 1.1) {
      d.mesh(g, 'cylinder', [r + 0.04, 0.07, r + 0.04], [x, y - 0.32, z], p.light);
      for (const side of [-1, 1])
        windowPane(d, g, x + side * r * 0.42, y + 0.15, z + r * 0.92, p, 0.3, 0.42);
    }
    return h;
  },
  cap(d, g, s, { x = 0, z = 0, r, y }) {
    const p = s.palette,
      h = r * 0.85 + 0.35;
    d.mesh(g, futureShape(d, 'peak'), [r * 1.18, h, r * 1.18], [x, y, z], p.roof);
    d.ball(g, x, y + h + 0.06, z, 0.1, p.light, 'rock');
    return y + h;
  },
  // A round airlock door ringed in gold.
  door(d, g, s, x, z) {
    const p = s.palette;
    const hatch = d.mesh(g, 'cylinder', [0.42, 0.12, 0.42], [x, 0.72, z + 0.02], p.deep);
    hatch.rotation.x = Math.PI / 2;
    const rim = d.mesh(
      g,
      futureShape(d, 'octagon'),
      [0.5, 0.06, 0.5],
      [x, 0.72, z - 0.01],
      p.light,
    );
    rim.rotation.x = Math.PI / 2;
  },
  wing(d, g, s, { x, z, w = 1.3, dep = 1.2 }) {
    const top = homesteadKit.block(d, g, s, { x, z, w, dep, h: 1.4, porch: false });
    homesteadKit.roof(d, g, s, { x, z, w, dep, y: top });
  },
  // A landing-light mast, a dish turned to the Moon and a pair of solar fins.
  crown(d, g, s, { x = 0, z = 0, y, baseY = y - 1, r = 1 }) {
    const p = s.palette,
      mx = x + r * 0.55;
    d.rod(g, [mx, baseY, z - 0.2], [mx, y + 1.3, z - 0.2], 0.04, p.deep);
    d.ball(g, mx, y + 1.38, z - 0.2, 0.12, p.light, 'rock');
    const dish = d.ball(g, x - r * 0.4, y + 0.05, z - 0.3, [0.42, 0.13, 0.42], p.shell);
    dish.rotation.set(-0.7, 0, 0.3);
    d.rod(g, [x - r * 0.4, baseY, z - 0.3], [x - r * 0.4, y, z - 0.3], 0.035, p.deep);
    // Solar fins bolt to a crossbar rather than hovering beside the mast.
    d.rod(g, [mx - 0.42, y + 0.55, z - 0.2], [mx + 0.42, y + 0.55, z - 0.2], 0.035, p.deep);
    for (const side of [-1, 1]) {
      const fin = d.box(g, 0.62, 0.04, 0.34, mx + side * 0.42, y + 0.55, z - 0.2, p.roof);
      fin.rotation.z = side * 0.25;
    }
  },
  // A gold porch lamp beside a little supply crate bound for the Moon.
  prop(d, g, s, x, z, y = 0) {
    const p = s.palette;
    d.rod(g, [x, y, z], [x, y + 1.3, z], 0.04, p.deep);
    d.ball(g, x, y + 1.36, z, [0.12, 0.15, 0.12], p.light, 'rock');
    d.mesh(g, futureShape(d, 'peak'), [0.15, 0.12, 0.15], [x, y + 1.48, z], p.roof);
    d.box(g, 0.34, 0.3, 0.34, x + 0.32, y + 0.15, z + 0.05, p.timber);
    d.box(g, 0.36, 0.05, 0.36, x + 0.32, y + 0.2, z + 0.05, p.light);
  },
};
