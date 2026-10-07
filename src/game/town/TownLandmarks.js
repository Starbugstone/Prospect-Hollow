import { LANDMARK_BY_ID } from '../../data/townLandmarks';

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
  const tier = timeless ? 1 : ((stage - 1) % 3) + 1;
  const age = timeless ? 0 : Math.floor((stage - 1) / 3);
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
  } else if (o.form === 'rotunda' || o.form === 'dome') {
    d.mesh(g, 'cylinder', [3.8, height, 3.8], [0, height / 2 + 0.6, 0], wall);
    for (let n = 0; n < 10; n++) {
      const a = (n * Math.PI) / 5;
      column(d, g, Math.cos(a) * 4.3, Math.sin(a) * 4.3, height);
    }
    if (o.form === 'dome') {
      d.ball(g, 0, height + 0.5, 0, [4.1, 2.5, 4.1], colour);
      d.rod(g, [0, height + 2, 0], [2.6, height + 4, 2.6], 0.35, DARK);
    } else {
      d.mesh(g, 'cone', [4.9, 2.7, 4.9], [0, height + 1.6, 0], colour);
      ring(d, g, 2.3, height + 3, GOLD, 0, 0.14);
    }
  } else if (o.form === 'hall' || o.form === 'arcade') {
    for (const side of [-1, 1]) {
      const wing = d.group(g, side * 2.8, 0, 0);
      d.box(wing, 3.6, height, 7, 0, height / 2 + 0.6, 0, wall);
      roof(d, wing, 4.3, 7.7, height + 1.4, colour);
      windows(d, wing, 3.5, height - 1.2, 3.6);
    }
    for (let x = -4; x <= 4; x += 2) column(d, g, x, 4, o.form === 'hall' ? 3.1 : height);
    d.box(g, 9.8, 0.4, 2, 0, o.form === 'hall' ? 3.7 : height + 0.6, 4, colour);
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
  } else if (o.form === 'wing') {
    d.box(g, 8, height - 1, 5, 0, height / 2, 0, GLASS);
    for (let n = -1; n <= 1; n++) {
      const wing = d.box(g, 4.2, 0.4, 7, n * 3, height + 0.4 + Math.abs(n) * 0.7, 0, colour);
      wing.rotation.z = n * 0.24;
      column(d, g, n * 3.4, 2.9, height + 0.3, DARK);
    }
  } else if (o.form === 'terraces') {
    for (let n = 0; n < 4; n++) {
      const w = 9 - n * 1.6;
      d.box(g, w, 1.7, w, 0, 1.45 + n * 1.7, -n * 0.25, wall);
      d.box(g, w + 0.4, 0.2, w + 0.4, 0, 2.35 + n * 1.7, -n * 0.25, colour);
      for (const x of [-w / 2 + 0.5, w / 2 - 0.5])
        d.ball(g, x, 2.7 + n * 1.7, w / 2 - n * 0.25, [0.5, 0.45, 0.5], '#8caf80');
    }
  } else {
    // Four tall forms: wind tower, clock, lighthouse and open lattice spire.
    const towerHeight = height + 3.5;
    if (o.form === 'spire') {
      for (const x of [-2, 2])
        for (const z of [-2, 2])
          d.rod(g, [x, 0.6, z], [x * 0.2, towerHeight + 2, z * 0.2], 0.22, DARK);
      for (let n = 0; n < 4; n++) ring(d, g, 2.6 - n * 0.35, 2 + n * 2.2, colour, 0, 0.15);
      d.ball(g, 0, towerHeight + 2, 0, 0.65, GOLD, 'rock');
    } else {
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
      if (o.form === 'clock') {
        d.ball(g, 0, towerHeight - 0.4, 1.65, [1, 1, 0.1], '#fff8e8');
        d.rod(g, [0, towerHeight - 0.4, 1.8], [0, towerHeight + 0.25, 1.8], 0.06, DARK);
        d.rod(g, [0, towerHeight - 0.4, 1.8], [0.5, towerHeight - 0.65, 1.8], 0.06, DARK);
      } else if (o.form === 'windmill') {
        const blades = d.group(g, 0, towerHeight - 0.4, 1.9);
        for (let n = 0; n < 4; n++) {
          const blade = d.group(blades);
          blade.rotation.z = (n * Math.PI) / 2 + 0.4;
          d.box(blade, 0.7, 3.1, 0.15, 0, 1.65, 0, STONE);
        }
      } else {
        d.mesh(g, 'cylinder', [1.4, 1.5, 1.4], [0, towerHeight + 1.4, 0], '#f5ddb0');
        ring(d, g, 2.3, towerHeight + 0.8, colour);
      }
      d.mesh(
        g,
        'cone',
        [2.3, 1.6, 2.3],
        [0, towerHeight + (o.form === 'beacon' ? 2.8 : 1.4), 0],
        colour,
      );
    }
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
