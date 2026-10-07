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
    ).userData.paintRole = 'secondary';
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
    ).userData.paintRole = false;
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
  } else if (o.form === 'kites') {
    // Skysail: a lattice tower flying the town's kites on long strings.
    for (const x of [-1.6, 1.6])
      for (const z of [-1.6, 1.6]) d.rod(g, [x, 0.6, z], [x * 0.3, height + 4, z * 0.3], 0.2, DARK);
    for (let n = 0; n < 3; n++) ring(d, g, 1.6 - n * 0.35, 2.5 + n * 2.2, colour, 0, 0.14);
    d.box(g, 1.6, 0.3, 1.6, 0, height + 4, 0, STONE);
    for (const [x, y, z, c] of [
      [-3.4, height + 6.4, 1.5, colour],
      [3, height + 7.4, -1, '#4fa3a5'],
      [0.6, height + 9, 2.4, '#e57f62'],
    ]) {
      d.rod(g, [0, height + 4.2, 0], [x, y, z], 0.04, DARK);
      const kite = d.box(g, 1.6, 1.6, 0.12, x, y, z, c);
      kite.rotation.set(0.3, 0.4, Math.PI / 4);
      for (let t = 1; t <= 3; t++)
        d.box(g, 0.3, 0.3, 0.08, x - t * 0.25, y - 0.9 - t * 0.55, z, GOLD);
    }
  } else if (o.form === 'lanterns') {
    // Skysail: an open pavilion with paper sky lanterns drifting above.
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3;
      column(d, g, Math.cos(a) * 3.4, Math.sin(a) * 3.4, height, colour);
    }
    d.mesh(g, futureShape(d, 'peak'), [4.4, 2.2, 4.4], [0, height + 0.6, 0], colour);
    for (const [x, y, z] of [
      [-2.5, height + 5, 1],
      [1.8, height + 6.4, -1.5],
      [0.4, height + 7.6, 2],
      [2.8, height + 4.4, 2.6],
      [-1.4, height + 8.6, -2],
    ]) {
      // Glowing paper lanterns: a warm body, a darker cap and a little flame ring.
      d.ball(g, x, y, z, [0.5, 0.68, 0.5], '#f6c26b');
      d.mesh(g, 'cylinder', [0.34, 0.16, 0.34], [x, y + 0.62, z], colour);
      d.mesh(g, 'cylinder', [0.3, 0.1, 0.3], [x, y - 0.62, z], '#fff1c4');
    }
  } else if (o.form === 'organ') {
    // Skysail: a curve of pipes and sails that plays in the valley wind.
    d.box(g, 9.2, 1.4, 1.6, 0, 1.3, -1, wall);
    for (let n = 0; n < 9; n++) {
      const x = (n - 4) * 1.02,
        h = 2.5 + Math.sin((n / 8) * Math.PI) * height;
      d.mesh(g, 'cylinder', [0.38, h, 0.38], [x, h / 2 + 2, -1], n % 2 ? colour : STONE);
      d.mesh(g, futureShape(d, 'peak'), [0.5, 0.6, 0.5], [x, h + 2, -1], GOLD);
    }
    for (const side of [-1, 1]) {
      d.rod(g, [side * 3.3, 2, 0.8], [side * 3.3, height + 4, 0.8], 0.12, DARK);
      const sail = d.box(g, 2.4, 3, 0.08, side * 3.3, height + 2.4, 1.1, '#f7efe0');
      sail.rotation.set(0.25, side * 0.3, 0);
    }
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
  } else if (o.form === 'rocket') {
    // Moonward: the valley's first rocket on its launch tower.
    d.mesh(g, 'cylinder', [0.95, height + 2, 0.95], [0, (height + 2) / 2 + 0.9, 0], '#f4efe4');
    d.mesh(g, 'cylinder', [1, 0.5, 1], [0, height * 0.6, 0], colour);
    d.mesh(g, futureShape(d, 'peak'), [0.95, 2.2, 0.95], [0, height + 2.9, 0], colour);
    for (let n = 0; n < 3; n++) {
      const a = (n * Math.PI * 2) / 3;
      const fin = d.box(g, 0.12, 1.6, 1.2, Math.cos(a) * 1.1, 1.6, Math.sin(a) * 1.1, colour);
      fin.rotation.y = -a;
    }
    for (const y of [0.6, height + 3.5]) d.box(g, 0.4, 0.4, 0.4, 2.4, y, 0, DARK);
    d.rod(g, [2.4, 0.6, 0], [2.4, height + 3.5, 0], 0.16, DARK);
    for (let y = 2; y < height + 3; y += 1.6) d.rod(g, [2.4, y, 0], [1, y + 0.8, 0], 0.07, DARK);
    d.box(g, 1.6, 0.9, 0.2, 0, 1.1, 3.4, GOLD);
  } else if (o.form === 'chapel') {
    // Moonward: a frontier chapel with a round Moon window over the door.
    d.box(g, 5, height - 0.5, 6, 0, (height - 0.5) / 2 + 0.6, -0.5, wall);
    d.mesh(g, futureShape(d, 'gable'), [5.6, 2.4, 6.6], [0, height + 0.1, -0.5], colour);
    // A round window holding a crescent Moon.
    d.mesh(g, 'cylinder', [1.1, 0.14, 1.1], [0, height - 1, 2.55], DARK).rotation.x = Math.PI / 2;
    d.mesh(g, 'cylinder', [0.78, 0.18, 0.78], [0, height - 1, 2.58], '#f3e7bf').rotation.x =
      Math.PI / 2;
    d.mesh(g, 'cylinder', [0.62, 0.22, 0.62], [0.32, height - 0.88, 2.6], DARK).rotation.x =
      Math.PI / 2;
    d.box(g, 1.3, 2.2, 0.2, 0, 1.7, 2.55, DARK);
    d.box(g, 1.4, 1.8, 1.4, 0, height + 2.5, -2.2, wall);
    d.mesh(g, futureShape(d, 'peak'), [1.1, 1.6, 1.1], [0, height + 3.4, -2.2], colour);
    d.ball(g, 0, height + 5.2, -2.2, 0.25, GOLD, 'rock');
  } else if (o.form === 'sundial') {
    // Moonward: a great dial that tells the hour and the phases of the Moon.
    d.mesh(g, 'cylinder', [4.6, 0.6, 4.6], [0, 0.9, 0], wall);
    d.mesh(g, 'cylinder', [4.2, 0.1, 4.2], [0, 1.25, 0], colour);
    for (let n = 0; n < 12; n++) {
      const a = (n * Math.PI) / 6;
      d.box(g, 0.2, 0.08, 0.8, Math.cos(a) * 3.6, 1.32, Math.sin(a) * 3.6, DARK).rotation.y = -a;
    }
    // The triangular gnomon stands edge-on along the dial's noon line.
    d.mesh(g, futureShape(d, 'gable'), [3.4, height - 1.5, 0.22], [0, 1.3, 0], GOLD);
    for (const [n, lit] of [
      [0, 1],
      [1, 0.6],
      [2, 0.25],
      [3, 0.6],
    ]) {
      const a = (n * Math.PI) / 2 + Math.PI / 4;
      d.box(g, 0.9, 1.3, 0.9, Math.cos(a) * 5.2, 0.95, Math.sin(a) * 5.2, STONE);
      d.ball(g, Math.cos(a) * 5.2, 2, Math.sin(a) * 5.2, 0.45 * lit + 0.15, '#f4efe4', 'rock');
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
  if (!timeless)
    g.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.material?.color) return;
      if (Object.hasOwn(mesh.userData, 'paintRole')) return;
      const colourHex = `#${mesh.material.color.getHexString()}`;
      mesh.userData.paintRole =
        colourHex === colour
          ? 'roof'
          : colourHex === wall
            ? 'walls'
            : colourHex === DARK
              ? 'trim'
              : colourHex === GOLD
                ? 'accent'
                : false;
    });
  return g;
}
