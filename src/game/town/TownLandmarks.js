import { LANDMARK_BY_ID } from '../../data/townLandmarks';
import { futureShape } from './buildings/futureShapes';

const STONE = '#ddd1b5',
  DARK = '#655343',
  GOLD = '#cc954f',
  GLASS = '#a0ccc4';
function ring(d, g, radius, height, colour, tilt = 0, thickness = 0.1) {
  const r = d.group(g, 0, height, 0);
  r.rotation.x = tilt;
  for (let n = 0; n < 32; n++) {
    const a = (n * Math.PI) / 16,
      b = ((n + 1) * Math.PI) / 16;
    d.rod(
      r,
      [Math.cos(a) * radius, 0, Math.sin(a) * radius],
      [Math.cos(b) * radius, 0, Math.sin(b) * radius],
      thickness,
      colour,
    );
  }
}
// A continuous arch of joined segments, from (-span, base) over to (span, base).
function arch(d, g, span, base, rise, z, radius, colour, colours = null) {
  let last = null;
  for (let n = 0; n <= 14; n++) {
    const a = (n * Math.PI) / 14;
    const point = [-Math.cos(a) * span, base + Math.sin(a) * rise, z];
    if (last) d.rod(g, last, point, radius, colours ? colours[n % colours.length] : colour);
    last = point;
  }
}
function column(d, g, x, z, height, colour = STONE) {
  d.box(g, 0.65, 0.3, 0.65, x, 0.4, z, STONE);
  d.mesh(g, 'cylinder', [0.2, height, 0.2], [x, height / 2 + 0.4, z], colour);
  d.box(g, 0.65, 0.25, 0.65, x, height + 0.4, z, STONE);
}
function windows(d, g, width, height, z, colour = DARK) {
  for (let x = -width / 2 + 0.75; x < width / 2; x += 1.25) {
    d.box(g, 0.85, height, 0.16, x, height / 2 + 1, z, colour);
    d.box(g, 0.61, height - 0.25, 0.18, x, height / 2 + 1, z + 0.02, GLASS);
  }
}
function roof(d, g, width, depth, y, colour) {
  for (const side of [-1, 1]) {
    const r = d.box(g, width * 0.57, 0.22, depth, side * width * 0.24, y, 0, colour);
    r.rotation.z = -side * 0.38;
  }
}
function pedestal(d, g, radius, height = 0.6) {
  for (let n = 0; n < 3; n++)
    d.mesh(
      g,
      'cylinder',
      [radius - n * 0.4, height / 3, radius - n * 0.4],
      [0, ((n + 0.5) * height) / 3, 0],
      n === 1 ? DARK : STONE,
    );
}
function tree(d, g, x, z, height, colour) {
  d.rod(g, [x, 0.3, z], [x, height, z], 0.35, DARK);
  for (const side of [-1, 1]) {
    d.rod(g, [x, height * 0.55, z], [x + side * height * 0.32, height * 0.86, z], 0.16, DARK);
    d.ball(
      g,
      x + side * height * 0.28,
      height * 0.92,
      z,
      [height * 0.34, height * 0.26, height * 0.3],
      colour,
      'rock',
    );
  }
}

// Silhouettes belong to choices, not eras. Upgrades add wings, crowns and material
// detail without turning one chosen destination into another. Monument geometry
// depends only on its ID: era, stage, paint and crest cannot change it.
export function buildLandmark(d, parent, choice, stage = 1, timeless = false) {
  const o = LANDMARK_BY_ID[choice];
  if (!o) return null;
  const g = d.group(parent);
  g.name = o.label;
  // One stage per era: the second adds side pavilions, the third lanterns, and each
  // stage after the first raises the monument and lays another band at its foot.
  const tier = timeless ? 1 : Math.min(stage, 3);
  const age = timeless ? 0 : stage - 1;
  const colour = o.colour,
    height = 4.5 + Math.min(age, 10) * 0.23;
  const wall = age >= 5 ? '#f4ead5' : STONE;
  pedestal(d, g, timeless ? 7.5 : 5.8);
  if (o.form === 'arch') {
    for (const x of [-4, 4]) {
      d.box(g, 2.1, 7, 2.8, x, 4, 0, STONE);
      d.box(g, 2.8, 0.5, 3.3, x, 7.6, 0, DARK);
      for (const dz of [-1.5, 1.5]) for (const dx of [-0.65, 0.65]) column(d, g, x + dx, dz, 6.7);
    }
    // A segmented stone arch leaves a genuine open passage.
    for (let n = 0; n < 13; n++) {
      const a = (n * Math.PI) / 12;
      const stone = d.box(g, 0.98, 1.4, 2.6, Math.cos(a) * 3, 6.4 + Math.sin(a) * 3, 0, STONE);
      stone.rotation.z = a - Math.PI / 2;
    }
    d.ball(g, 0, 10.2, 0, [0.9, 0.9, 0.3], GOLD, 'rock');
  } else if (o.form === 'crystal') {
    for (const [x, z, h, c] of [
      [0, 0, 12, colour],
      [-3, 0.6, 7, '#76b0a6'],
      [2.8, 1, 8, '#bfb6db'],
      [-1.8, -2, 6, '#41658f'],
      [2.1, -2.6, 5, '#76b0a6'],
    ]) {
      const crystal = d.ball(g, x, h / 2 + 0.5, z, [1.5, h / 2, 1.35], c, 'rock');
      crystal.rotation.z = x * -0.06;
    }
    ring(d, g, 5.4, 0.7, GOLD);
  } else if (o.form === 'guardian') {
    d.box(g, 4, 2.2, 3.5, 0, 1.6, 0, DARK);
    d.ball(g, 0, 5.4, 0, [2.8, 3.2, 2.1], GOLD, 'rock');
    for (const side of [-1, 1]) {
      const wing = d.ball(g, side * 3, 5.8, 0, [1.6, 3.3, 0.7], '#b77839', 'rock');
      wing.rotation.z = -side * 0.55;
      d.mesh(g, 'cone', [0.6, 1.6, 0.6], [side * 1.7, 9, 0], GOLD);
      d.ball(g, side * 1.05, 7.4, 1.8, [1, 1.1, 0.35], STONE);
      d.ball(g, side * 1.05, 7.4, 2.15, [0.4, 0.5, 0.12], DARK);
      for (let n = 0; n < 3; n++)
        d.box(g, 0.22, 0.18, 1, side * 0.95 + (n - 1) * 0.3, 2.85, 1.3, GOLD);
    }
    d.mesh(g, 'cone', [0.35, 0.9, 0.5], [0, 6.5, 2.3], DARK).rotation.z = Math.PI;
  } else if (o.form === 'tree') {
    tree(d, g, 0, 0, 9, '#52948e');
    for (const side of [-1, 1]) {
      d.rod(g, [0, 4, 0], [side * 3.5, 7, 1.5], 0.25, GOLD);
      d.ball(g, side * 3.5, 7.3, 1.5, [2.5, 1.7, 2.1], '#8caf80', 'rock');
    }
    ring(d, g, 5.7, 0.75, GOLD);
  } else if (o.form === 'orrery') {
    for (let n = 0; n < 4; n++)
      column(d, g, Math.cos((n * Math.PI) / 2) * 2.5, Math.sin((n * Math.PI) / 2) * 2.5, 3.8);
    d.ball(g, 0, 7, 0, 1.8, colour, 'rock');
    for (let n = 0; n < 3; n++) ring(d, g, 4 + n * 0.35, 7, GOLD, n * 0.8 + 0.35, 0.13);
    for (const [x, y, z] of [
      [4, 7, 0],
      [-3, 9, 1],
      [0, 5, 4],
    ])
      d.ball(g, x, y, z, 0.6, '#e8bf79', 'rock');
  } else if (o.form === 'headframe') {
    // Timber legs and back braces carry the winding wheel above the shaft.
    const top = height + 4;
    for (const side of [-1, 1]) {
      d.rod(g, [side * 2.4, 0.6, 1.4], [side * 0.6, top, 0], 0.26, colour);
      d.rod(g, [side * 2.2, 0.6, -3], [side * 0.6, top - 0.6, 0], 0.22, colour);
      d.rod(g, [side * 1.7, 2.6, 0.95], [side * 1.6, 2.6, -2.2], 0.14, DARK);
    }
    d.box(g, 2.2, 0.35, 0.8, 0, top - 0.2, 0, DARK);
    d.mesh(g, 'ring', [1.5, 1.5, 1.5], [0, top + 0.6, 0], DARK);
    for (let n = 0; n < 4; n++)
      d.box(g, 0.14, 2.8, 0.14, 0, top + 0.6, 0, GOLD).rotation.z = (n * Math.PI) / 4;
    d.box(g, 3.2, 2.2, 2.4, 0, 1.7, -3.4, colour);
    roof(d, g, 3.6, 2.8, 3.1, DARK);
    for (const z of [-0.4, 0.4]) d.box(g, 8.5, 0.12, 0.14, 0, 0.7, 3 + z, DARK);
    d.box(g, 1.8, 1, 1.2, 2.4, 1.3, 3, DARK);
    for (const [x, c] of [
      [1.9, '#9b91c4'],
      [2.5, '#76b0a6'],
      [2.9, '#cc954f'],
    ])
      d.ball(g, x, 2, 3, [0.35, 0.5, 0.35], c, 'rock');
  } else if (o.form === 'windpump') {
    // An open lattice tower and a many-bladed wheel over the farm's water tank.
    const top = height + 4.5;
    for (const x of [-1.6, 1.6])
      for (const z of [-1.6, 1.6]) d.rod(g, [x, 0.6, z], [x * 0.2, top, z * 0.2], 0.14, DARK);
    for (const y of [2.4, 4.4]) d.box(g, 3.2 - y * 0.35, 0.12, 3.2 - y * 0.35, 0, y, 0, DARK);
    const wheel = d.group(g, 0, top, 0.7);
    d.mesh(wheel, 'ring', [1.9, 1.9, 1.2], [0, 0, 0], DARK);
    for (let n = 0; n < 16; n++) {
      const blade = d.group(wheel);
      blade.rotation.z = (n * Math.PI) / 8;
      d.box(blade, 0.42, 1.5, 0.06, 0, 1.05, 0, n % 2 ? STONE : colour).rotation.y = 0.35;
    }
    d.box(g, 0.1, 1.1, 2.2, 0, top, -1.4, colour);
    d.mesh(g, 'cylinder', [1.3, 2.4, 1.3], [3.3, 1.8, 1.4], '#9c6a3c');
    for (const y of [1.1, 2.5]) d.mesh(g, 'cylinder', [1.34, 0.14, 1.34], [3.3, y, 1.4], DARK);
    for (const x of [-3.4, -1.6]) {
      d.box(g, 1.4, 0.45, 3, x, 0.85, 2, '#8a5a34');
      for (const z of [1, 2, 3]) d.ball(g, x, 1.25, z, [0.45, 0.35, 0.4], '#8caf80');
    }
  } else if (o.form === 'hall') {
    for (const side of [-1, 1]) {
      const wing = d.group(g, side * 2.8, 0, 0);
      d.box(wing, 3.6, height, 7, 0, height / 2 + 0.6, 0, wall);
      roof(d, wing, 4.3, 7.7, height + 1.4, colour);
      windows(d, wing, 3.5, height - 1.2, 3.6);
    }
    for (let x = -4; x <= 4; x += 2) column(d, g, x, 4, 3.1);
    d.box(g, 9.8, 0.4, 2, 0, 3.7, 4, colour);
  } else if (o.form === 'station') {
    // A filling-station canopy with a sunburst crest, pumps and a corner kiosk.
    d.box(g, 4.2, 2.6, 2.4, 0, 1.9, -2.4, wall);
    windows(d, g, 4, 1.4, -1.15);
    d.box(g, 4.6, 0.3, 2.8, 0, 3.35, -2.4, colour);
    for (const x of [-2.6, 2.6])
      d.mesh(g, 'cylinder', [0.22, height, 0.22], [x, height / 2 + 0.6, 1.4], STONE);
    d.box(g, 7.4, 0.4, 3.6, 0, height + 0.8, 1.4, colour);
    d.box(g, 7.6, 0.12, 3.8, 0, height + 0.55, 1.4, STONE);
    for (let n = 0; n <= 6; n++) {
      const a = (n * Math.PI) / 6;
      d.rod(
        g,
        [0, height + 1, 3.2],
        [Math.cos(a) * 2.2, height + 1 + Math.sin(a) * 2.2, 3.2],
        0.09,
        GOLD,
      );
    }
    d.ball(g, 0, height + 1, 3.25, [0.7, 0.7, 0.2], GOLD);
    for (const x of [-1.5, 0, 1.5]) {
      d.box(g, 0.7, 1.7, 0.55, x, 1.45, 1.4, x ? colour : '#41658f', true);
      d.ball(g, x, 2.55, 1.4, 0.32, '#f5ddb0');
    }
  } else if (o.form === 'diner') {
    // A streamlined body with rounded ends, chrome bands and a neon pylon.
    d.box(g, 6, 2.6, 3, 0, 1.9, -0.6, colour);
    for (const x of [-3, 3]) {
      d.mesh(g, 'cylinder', [1.5, 2.6, 1.5], [x, 1.9, -0.6], colour);
      d.mesh(g, 'cylinder', [1.55, 0.16, 1.55], [x, 1.25, -0.6], '#d9dee2');
    }
    d.box(g, 6.05, 0.16, 3.05, 0, 1.25, -0.6, '#d9dee2');
    d.box(g, 5.4, 0.8, 3.08, 0, 2.15, -0.6, GLASS);
    d.box(g, 9.2, 0.25, 3.6, 0, 3.3, -0.6, STONE);
    d.box(g, 3.6, 0.9, 0.18, 0, 4, -0.6, '#bd705f');
    d.box(g, 0.45, height + 1.5, 0.45, 4.2, (height + 1.5) / 2 + 0.6, 2.6, DARK);
    d.ball(g, 4.2, height + 2.5, 2.6, [1.2, 1.2, 0.25], '#bd705f');
    d.mesh(g, 'ring', [1.25, 1.25, 1.25], [4.2, height + 2.5, 2.6], '#f5ddb0');
    d.box(g, 2.2, 0.8, 1.1, -2, 1.1, 2.6, '#bd705f', true);
    d.box(g, 1.3, 0.55, 1, -2.1, 1.7, 2.6, GLASS, true);
    for (const x of [-2.7, -1.3]) d.ball(g, x, 0.75, 2.6, [0.3, 0.3, 1.15], DARK);
  } else if (o.form === 'screen') {
    // A colour screen on twin legs above a small stage and speaker stacks.
    const middle = height + 1.8;
    for (const x of [-3.3, 3.3]) d.box(g, 0.5, middle, 0.5, x, middle / 2 + 0.6, -1.2, DARK);
    d.box(g, 7.4, 4.2, 0.5, 0, middle, -1.2, DARK);
    ['#f5ddb0', '#e8bf79', '#52948e', '#8caf80', '#bd705f', colour].forEach((c, n) =>
      d.box(g, 1.1, 3.6, 0.1, (n - 2.5) * 1.12, middle, -0.9, c),
    );
    d.box(g, 6.4, 0.5, 2.6, 0, 0.85, 1.4, STONE);
    for (const x of [-4.2, 4.2]) {
      d.box(g, 1.3, 2.4, 1.2, x, 1.8, 1.4, '#393c43');
      for (const y of [1.2, 2.3]) d.ball(g, x, y, 2.02, [0.42, 0.42, 0.08], '#9c9a92');
    }
  } else if (o.form === 'dome') {
    d.mesh(g, 'cylinder', [3.8, height, 3.8], [0, height / 2 + 0.6, 0], wall);
    for (let n = 0; n < 10; n++) {
      const a = (n * Math.PI) / 5;
      column(d, g, Math.cos(a) * 4.3, Math.sin(a) * 4.3, height);
    }
    d.ball(g, 0, height + 0.5, 0, [4.1, 2.5, 4.1], colour);
    d.rod(g, [0, height + 2, 0], [2.6, height + 4, 2.6], 0.35, DARK);
  } else if (o.form === 'solar') {
    // A slender stem opens a crown of solar petals above a garden ring.
    const top = height + 5;
    d.mesh(g, 'cone', [1.4, 2, 1.4], [0, 1.6, 0], wall);
    d.mesh(g, 'cylinder', [0.6, top, 0.6], [0, top / 2 + 0.6, 0], wall);
    for (let n = 0; n < 12; n++) {
      const petal = d.group(g, 0, top, 0);
      petal.rotation.y = (n * Math.PI) / 6;
      d.box(petal, 2.4, 0.1, 0.95, 1.6, 0.45, 0, n % 2 ? '#41658f' : '#52948e').rotation.z = 0.4;
    }
    d.mesh(g, 'cylinder', [1, 0.3, 1], [0, top, 0], colour);
    d.ball(g, 0, top + 0.8, 0, 0.6, GOLD, 'rock');
    ring(d, g, 3.4, 0.75, '#8caf80', 0, 0.3);
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3 + 0.3;
      d.ball(g, Math.cos(a) * 3.4, 1.1, Math.sin(a) * 3.4, [0.6, 0.45, 0.6], '#8caf80');
    }
  } else if (o.form === 'loop') {
    // A tall upright loop of glowing rail with a pod parked on its curve.
    const radius = 2.8 + Math.min(height, 7) * 0.12;
    const middle = radius + 1.2;
    d.mesh(g, 'ring', [radius, radius, radius], [0, middle, 0], colour);
    d.mesh(g, 'ring', [radius - 0.5, radius - 0.5, 0.6], [0, middle, 0], '#f5ddb0');
    for (const x of [-1, 1]) d.box(g, 0.5, 1, 1.6, x * 1.2, 0.9, 0, DARK);
    d.box(g, 9, 0.35, 0.8, 0, 0.95, 0, colour);
    const pod = d.group(g, 0, middle, 0);
    pod.rotation.z = Math.PI / 4;
    d.ball(pod, 0, radius + 0.55, 0, [1.4, 0.65, 0.8], STONE);
    d.ball(pod, 0, radius + 0.7, 0, [1, 0.38, 0.84], GLASS);
  } else if (o.form === 'glass') {
    for (const [x, scale] of [
      [0, 1],
      [-3.4, 0.65],
      [3.4, 0.65],
    ]) {
      d.mesh(
        g,
        'cylinder',
        [2.8 * scale, height * scale, 2.8 * scale],
        [x, (height * scale) / 2 + 0.6, 0],
        GLASS,
      );
      d.ball(g, x, height * scale + 0.6, 0, [2.85 * scale, 2.2 * scale, 2.85 * scale], colour);
      for (const z of [-1.9, 1.9])
        for (const dx of [-1.9, 1.9])
          column(d, g, x + dx * scale, z * scale, height * scale, colour);
    }
  } else if (o.form === 'theatre') {
    for (let n = 0; n < 5; n++) {
      const radius = 2.8 + n * 0.65;
      for (let j = 0; j < 12; j++) {
        const a = (j * Math.PI) / 11;
        const seat = d.box(
          g,
          1.2,
          0.35 + n * 0.35,
          0.65,
          Math.cos(a) * radius,
          0.6 + (0.35 + n * 0.35) / 2,
          Math.sin(a) * radius,
          STONE,
        );
        seat.rotation.y = -a + Math.PI / 2;
      }
    }
    d.box(g, 6, 0.7, 3, 0, 0.9, -2, DARK);
    for (let n = 0; n < 9; n++) {
      const shell = d.box(
        g,
        0.75,
        height + 1,
        0.25,
        (n - 4) * 0.75,
        height / 2 + 1,
        -3,
        n % 2 ? STONE : colour,
      );
      shell.rotation.z = (n - 4) * -0.09;
    }
  } else if (o.form === 'spire') {
    const towerHeight = height + 3.5;
    for (const x of [-2, 2])
      for (const z of [-2, 2])
        d.rod(g, [x, 0.6, z], [x * 0.2, towerHeight + 2, z * 0.2], 0.22, DARK);
    for (let n = 0; n < 4; n++) ring(d, g, 2.6 - n * 0.35, 2 + n * 2.2, colour, 0, 0.15);
    d.ball(g, 0, towerHeight + 2, 0, 0.65, GOLD, 'rock');
  } else if (o.form === 'springs') {
    // Round pools of warm spring water step down between amber lanterns.
    for (let n = 0; n < 3; n++) {
      const radius = 4.6 - n * 1.25,
        y = 1.05 + n * 0.9;
      d.mesh(g, 'cylinder', [radius, 0.9, radius], [0, y, -n * 0.4], wall);
      d.mesh(g, 'cylinder', [radius - 0.35, 0.1, radius - 0.35], [0, y + 0.42, -n * 0.4], colour);
    }
    d.box(g, 0.9, 2.6, 0.12, 0, 2, 2.45, colour).rotation.x = 0.35;
    for (const [x, y, z] of [
      [-1, 4.6, -0.6],
      [0.6, 5.3, -1],
      [-0.2, 6, -0.4],
    ])
      d.ball(g, x, y, z, [0.8, 0.45, 0.7], '#f4f1ea');
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3;
      const x = Math.cos(a) * 5,
        z = Math.sin(a) * 5;
      d.rod(g, [x, 0.6, z], [x, 2.6, z], 0.07, DARK);
      d.ball(g, x, 2.75, z, 0.28, '#e8bf79');
    }
  } else if (o.form === 'lotus') {
    // Pearl petals open above slender columns hung with amber lanterns.
    d.mesh(g, 'cylinder', [3.8, 0.3, 3.8], [0, 0.75, 0], wall);
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3;
      column(d, g, Math.cos(a) * 2.7, Math.sin(a) * 2.7, height - 0.4, '#f4ead5');
      d.ball(g, Math.cos(a + 0.5) * 2.7, height - 0.6, Math.sin(a + 0.5) * 2.7, 0.3, '#e8bf79');
    }
    for (let n = 0; n < 8; n++) {
      const petal = d.group(g, 0, height + 0.6, 0);
      petal.rotation.y = (n * Math.PI) / 4;
      d.ball(petal, 0, 0.5, 2, [1.15, 0.22, 2.3], n % 2 ? '#f4ead5' : colour).rotation.x = -0.45;
    }
    d.ball(g, 0, height + 1.4, 0, [1, 1.5, 1], '#f5ddb0');
  } else if (o.form === 'orbits') {
    // Stargazer: brass planets circle a golden sun inside a ring of hedges.
    for (let n = 0; n < 16; n++) {
      const a = (n * Math.PI) / 8;
      d.ball(g, Math.cos(a) * 5, 1.1, Math.sin(a) * 5, [0.75, 0.55, 0.75], '#8caf80');
    }
    d.mesh(g, 'cylinder', [0.3, height, 0.3], [0, height / 2 + 0.6, 0], DARK);
    d.ball(g, 0, height + 1.4, 0, 1.3, GOLD, 'rock');
    for (const [r, y, c, size] of [
      [2, height - 0.5, colour, 0.45],
      [3.2, height - 1.5, '#9c86d0', 0.6],
      [4.2, height - 2.6, '#5fb8a8', 0.5],
    ]) {
      ring(d, g, r, y, STONE, 0, 0.06);
      const a = r * 1.3;
      d.rod(
        g,
        [Math.cos(a) * r, 0.6, Math.sin(a) * r],
        [Math.cos(a) * r, y, Math.sin(a) * r],
        0.07,
        DARK,
      );
      d.ball(g, Math.cos(a) * r, y + size, Math.sin(a) * r, size, c, 'rock');
    }
  } else if (o.form === 'comet') {
    // Stargazer: a slender arch with a comet and its tail of stars.
    for (const x of [-4, 4]) d.box(g, 1.2, 0.8, 1.6, x, 1, 0, wall);
    arch(d, g, 4, 1.2, height + 2, 0, 0.45, wall, [wall, wall, colour]);
    d.ball(g, 3.2, height + 5, 0.8, 0.9, '#fff3c8', 'rock');
    for (let n = 1; n <= 6; n++)
      d.ball(
        g,
        3.2 - n * 0.95,
        height + 5 - n * 0.35,
        0.8 - n * 0.1,
        0.75 - n * 0.1,
        n % 2 ? colour : GOLD,
        'rock',
      );
  } else if (o.form === 'aurora') {
    // Stargazer: a glass dome under ribbons of aurora light.
    d.mesh(g, 'cylinder', [3.8, 1.6, 3.8], [0, 1.4, 0], wall);
    d.mesh(g, futureShape(d, 'dome'), [3.7, 3.2, 3.7], [0, 2.2, 0], GLASS);
    d.ball(g, 0, 5.6, 0, 0.5, GOLD, 'rock');
    // Aurora curtains: wavy rows of thin slats in teal, green and violet.
    for (const [z, y, c] of [
      [-3.2, height + 3.4, '#5fb8a8'],
      [-2.2, height + 4.4, colour],
      [-1.2, height + 3.8, '#9c86d0'],
    ])
      for (let n = 0; n < 11; n++) {
        const x = -4 + n * 0.8,
          h = 1.6 + Math.sin(n * 0.9 + z) * 0.9 + 1;
        const slat = d.box(
          g,
          0.55,
          h,
          0.06,
          x,
          y + Math.sin(n * 0.7 + z * 2) * 0.6,
          z + Math.sin(n * 0.6) * 0.5,
          c,
        );
        slat.rotation.y = Math.sin(n * 0.6) * 0.5;
      }
  } else if (o.form === 'lantern-walk') {
    // Twin Hollows: an avenue of twin lanterns under homecoming arbors.
    for (const z of [-3.6, -1.2, 1.2, 3.6])
      for (const side of [-1, 1]) {
        d.rod(g, [side * 2.2, 0.6, z], [side * 2.2, height - 0.5, z], 0.12, DARK);
        d.ball(g, side * 2.2 - 0.3, height - 0.7, z, [0.28, 0.36, 0.28], colour, 'rock');
        d.ball(g, side * 2.2 + 0.3, height - 0.7, z, [0.28, 0.36, 0.28], '#f0c45a', 'rock');
      }
    for (const z of [-2.4, 2.4]) arch(d, g, 2.2, height - 0.5, 1.6, z, 0.12, colour);
    for (const side of [-1, 1]) d.box(g, 0.8, 0.5, 2.4, side * 3.6, 0.85, 0, '#b88757');
  } else if (o.form === 'globes') {
    // Twin Hollows: a little Earth and Moon share one fountain pool.
    d.mesh(g, 'cylinder', [4.4, 0.7, 4.4], [0, 0.95, 0], wall);
    d.mesh(g, 'cylinder', [3.9, 0.12, 3.9], [0, 1.32, 0], '#7fc0d0');
    for (const [x, r, c, h] of [
      [-1.6, 1.3, colour, height - 0.6],
      [2, 0.85, '#f1eee6', height - 1.6],
    ]) {
      // Slender gold stands with a little cup under each globe.
      d.mesh(g, 'cylinder', [0.12, h, 0.12], [x, h / 2 + 1, 0], GOLD);
      d.mesh(g, 'cylinder', [0.45, 0.16, 0.45], [x, h + 1, 0], GOLD);
      d.ball(g, x, h + 1.1 + r, 0, r, c);
    }
    // Continents on the little Earth, facing the path.
    for (const [dx, dy, dz, sx] of [
      [-0.35, 0.3, 1.02, 0.55],
      [0.45, -0.2, 0.95, 0.4],
      [0.1, 0.75, 0.75, 0.35],
    ])
      d.ball(g, -1.6 + dx, height + 1.8 + dy, dz, [sx, sx * 0.7, 0.25], '#8caf80', 'rock');
    for (let n = 1; n <= 4; n++)
      d.ball(g, -0.6 + n * 0.55, height + 1.6 + Math.sin(n * 0.8) * 0.6, 0, 0.18, '#a6d8e6');
  } else if (o.form === 'welcome-arch') {
    // Twin Hollows: a homecoming arch with banners and a family bench.
    for (const side of [-1, 1]) {
      d.box(g, 0.9, height + 2, 0.9, side * 3.4, (height + 2) / 2 + 0.6, 0, wall);
      d.box(g, 1.2, 0.3, 1.2, side * 3.4, height + 2.75, 0, DARK);
      d.box(g, 0.08, 2.2, 1.1, side * 3.4 + side * 0.5, height - 0.4, 0, colour);
      d.ball(
        g,
        side * 2.6,
        height + 2.2,
        0.6,
        [0.25, 0.32, 0.25],
        side < 0 ? '#3f8f8a' : '#f0c45a',
        'rock',
      );
    }
    d.box(g, 7.6, 0.8, 1, 0, height + 3.3, 0, colour);
    d.box(g, 4.6, 0.5, 0.15, 0, height + 3.3, 0.58, '#f4efe4');
    d.ball(g, -0.5, height + 4.3, 0, 0.5, '#4f8fc7');
    d.ball(g, 0.6, height + 4.2, 0, 0.35, '#f1eee6');
    d.box(g, 2.8, 0.25, 0.8, 0, 1.05, 2.6, '#b88757');
    d.box(g, 2.8, 0.7, 0.15, 0, 1.4, 2.95, '#b88757');
  } else {
    // The stepped Art Deco clock tower.
    const towerHeight = height + 3.5;
    for (let n = 0; n < 3; n++) {
      const w = 4.2 - n * 0.65;
      d.box(
        g,
        w,
        towerHeight / 3,
        w,
        0,
        0.6 + ((n + 0.5) * towerHeight) / 3,
        0,
        n === 1 ? colour : wall,
      );
      d.box(g, w + 0.4, 0.3, w + 0.4, 0, 0.6 + ((n + 1) * towerHeight) / 3, 0, DARK);
    }
    d.ball(g, 0, towerHeight - 0.4, 1.65, [1, 1, 0.1], '#fff8e8');
    d.rod(g, [0, towerHeight - 0.4, 1.8], [0, towerHeight + 0.25, 1.8], 0.06, DARK);
    d.rod(g, [0, towerHeight - 0.4, 1.8], [0.5, towerHeight - 0.65, 1.8], 0.06, DARK);
    d.mesh(g, 'cone', [2.3, 1.6, 2.3], [0, towerHeight + 1.4, 0], colour);
  }
  if (!timeless) {
    // Every paid stage adds visible architecture. Later-era bands introduce new
    // materials and elevation while all models stay within their reserved parcel.
    if (tier >= 2)
      for (const side of [-1, 1]) {
        d.box(g, 1.5, 1.1, 2.8, side * 4.5, 1.15, -2.5, colour);
        tree(d, g, side * 4.5, -2.5, 2, '#8caf80');
      }
    if (tier >= 3)
      for (const side of [-1, 1]) {
        column(d, g, side * 3.8, 4.2, 2.5, colour);
        d.ball(g, side * 3.8, 3.15, 4.2, 0.4, '#f5ddb0');
      }
    for (let n = 0; n < age; n++)
      d.box(g, 0.6, 0.09, 0.7, (n - (age - 1) / 2) * 0.85, 0.65, 4.8, n % 2 ? colour : GOLD);
  }
  return g;
}
