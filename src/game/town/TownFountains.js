import { MeshStandardMaterial } from 'three';
import { horizonMaterial } from './TownAtmosphere';
import { walkObstacle } from './TownNavigation';
import { fountainDesign } from '../../data/fountains';

// The square's centerpiece follows the era its square was completed in. Every design
// fits the same 1.1-unit walk radius, is built from shared primitives and joins the
// static plot batch; only falling water uses one extra translucent material.
const WATER = '#5fa6b4';
const SPRAY_KEY = 'fountain-spray';
const TAU = Math.PI * 2;

function sprayMaterial(d) {
  if (!d.materials.has(SPRAY_KEY))
    d.materials.set(
      SPRAY_KEY,
      horizonMaterial(
        new MeshStandardMaterial({
          color: '#e4f6f5',
          roughness: 0.2,
          transparent: true,
          opacity: 0.42,
        }),
      ),
    );
  return d.materials.get(SPRAY_KEY);
}
function spray(d, mesh) {
  mesh.material = sprayMaterial(d);
  mesh.castShadow = false;
  return mesh;
}
const pool = (d, g, radius, y) => d.mesh(g, 'cylinder', [radius, 0.025, radius], [0, y, 0], WATER);
// A closed sheet of water falling from a bowl rim.
const veil = (d, g, radius, top, bottom, x = 0) =>
  spray(
    d,
    d.mesh(g, 'cylinder', [radius, top - bottom, radius], [x, (top + bottom) / 2, 0], WATER),
  );
function jet(d, g, x, z, bottom, height, radius = 0.035) {
  spray(d, d.rod(g, [x, bottom, z], [x, bottom + height, z], radius, WATER));
  spray(d, d.ball(g, x, bottom + height, z, radius, WATER));
  spray(d, d.ball(g, x, bottom, z, [radius * 3, radius * 0.8, radius * 3], WATER));
}
// A parabolic spout in three segments with a small splash where it lands.
function arc(d, g, from, to, rise, radius = 0.028) {
  let last = from;
  for (const t of [1 / 3, 2 / 3, 1]) {
    const next = from.map((v, i) => v + (to[i] - v) * t + (i === 1 ? rise * 4 * t * (1 - t) : 0));
    spray(d, d.rod(g, last, next, radius, WATER));
    last = next;
  }
  spray(d, d.ball(g, to[0], to[1], to[2], [radius * 3, radius, radius * 3], WATER));
}
function radialArcs(d, g, count, [r0, y0], [r1, y1], rise, phase = 0) {
  for (let n = 0; n < count; n++) {
    const a = phase + (n / count) * TAU,
      c = Math.cos(a),
      s = Math.sin(a);
    arc(d, g, [c * r0, y0, s * r0], [c * r1, y1, s * r1], rise);
  }
}
// A polygonal curb of straight stones, flush at the corners.
function curb(d, g, sides, radius, y, height, thickness, color, phase = Math.PI / sides) {
  const length = 2 * (radius + thickness / 2) * Math.tan(Math.PI / sides);
  for (let n = 0; n < sides; n++) {
    const a = phase + (n / sides) * TAU;
    d.box(
      g,
      thickness,
      height,
      length,
      Math.cos(a) * radius,
      y,
      Math.sin(a) * radius,
      color,
    ).rotation.y = -a;
  }
}
// Shallow cast or carved bowls use the tapered cylinder upside down.
function bowl(d, g, radius, depth, y, color, x = 0) {
  d.mesh(g, 'cone', [radius, depth, radius], [x, y, 0], color).rotation.x = Math.PI;
  pool(d, g, radius * 0.88, y + depth / 2 - 0.005).position.x = x;
}
function squareBasin(d, g, half, height, wall, coping) {
  for (const side of [-1, 1]) {
    d.box(g, half * 2 + 0.16, height, 0.16, 0, 0.16 + height / 2, side * half, wall);
    d.box(g, 0.16, height, half * 2 - 0.16, side * half, 0.16 + height / 2, 0, wall);
    d.box(g, half * 2 + 0.26, 0.06, 0.26, 0, 0.19 + height, side * half, coping);
    d.box(g, 0.26, 0.06, half * 2 - 0.26, side * half, 0.19 + height, 0, coping);
  }
  d.box(g, half * 2 - 0.1, 0.025, half * 2 - 0.1, 0, 0.1 + height, 0, WATER);
}

// c. 1865: a dry-laid fieldstone spring with a hand pump; later a cistern and
// split-log flume add a second stream to the upper stone basin.
function frontierSpring(d, g, grand) {
  const stones = ['#a39a82', '#8b8573', '#b3a98f'],
    wood = '#7a5a3a',
    iron = '#4a4c49';
  d.mesh(g, 'cylinder', [1.02, 0.1, 1.02], [0, 0.21, 0], '#8d8470');
  pool(d, g, 0.86, 0.4);
  for (let n = 0; n < 14; n++) {
    const a = (n / 14) * TAU;
    d.ball(
      g,
      Math.cos(a) * 0.9,
      0.34,
      Math.sin(a) * 0.9,
      [0.2, 0.17, 0.17],
      stones[n % 2],
      'rock',
    ).rotation.y = a * 1.7;
    const b = a + Math.PI / 14;
    d.ball(
      g,
      Math.cos(b) * 0.9,
      0.5,
      Math.sin(b) * 0.9,
      [0.17, 0.12, 0.15],
      stones[(n % 2) + 1],
      'rock',
    ).rotation.y = b * 2.3;
  }
  for (const [y, size, color] of [
    [0.48, [0.32, 0.2, 0.3], stones[1]],
    [0.72, [0.26, 0.17, 0.24], stones[0]],
    [0.92, [0.21, 0.14, 0.2], stones[2]],
  ])
    d.ball(g, 0, y, 0, size, color, 'rock');
  if (grand) {
    // A raised stone basin on the pillar makes the spring a two-tier fountain.
    d.mesh(g, 'cylinder', [0.46, 0.14, 0.46], [0, 1.08, 0], stones[1]);
    pool(d, g, 0.4, 1.155);
    veil(d, g, 0.44, 1.14, 0.41);
  }
  const top = grand ? 1.15 : 1.02;
  d.mesh(g, 'cylinder', [0.1, 0.5, 0.1], [-0.08, top + 0.25, 0], iron);
  d.mesh(g, 'cone', [0.12, 0.08, 0.12], [-0.08, top + 0.54, 0], iron);
  d.rod(g, [-0.08, top + 0.4, 0], [0.2, top + 0.4, 0], 0.035, iron);
  d.rod(g, [0.2, top + 0.4, 0], [0.24, top + 0.32, 0], 0.035, iron);
  d.rod(g, [-0.08, top + 0.5, 0], [-0.46, top + 0.7, 0], 0.024, iron);
  d.ball(g, -0.46, top + 0.7, 0, 0.04, wood);
  jet(d, g, 0.24, 0, grand ? 1.16 : 0.41, top + 0.3 - (grand ? 1.16 : 0.41), 0.04);
  if (!grand) return;
  // Timber-stand cistern behind the pump, its flume spilling into the upper basin.
  for (const x of [-0.2, 0.2])
    for (const z of [-0.95, -0.6]) d.box(g, 0.07, 1.25, 0.07, x, 0.9, z, wood);
  d.box(g, 0.52, 0.06, 0.48, 0, 1.52, -0.78, wood);
  d.mesh(g, 'cylinder', [0.24, 0.42, 0.24], [0, 1.76, -0.78], '#8e6a44');
  for (const y of [1.62, 1.9]) d.mesh(g, 'cylinder', [0.25, 0.035, 0.25], [0, y, -0.78], iron);
  d.box(g, 0.14, 0.07, 0.5, 0.1, 1.72, -0.4, wood).rotation.x = 0.28;
  arc(d, g, [0.1, 1.64, -0.17], [0.14, 1.16, -0.24], 0.03, 0.04);
}

// 1884: a painted cast-iron tiered fountain in an octagonal granite basin.
function victorianIron(d, g, grand) {
  const granite = '#9d9b92',
    cap = '#c4c0b3',
    iron = '#3d5c4f',
    gilt = '#c9a44c';
  d.mesh(g, 'cylinder', [1.06, 0.08, 1.06], [0, 0.2, 0], '#8f8c82');
  curb(d, g, 8, 0.9, 0.36, 0.3, 0.16, granite);
  curb(d, g, 8, 0.92, 0.53, 0.05, 0.24, cap);
  pool(d, g, 0.86, 0.45);
  d.mesh(g, 'cone', [0.3, 0.32, 0.3], [0, 0.6, 0], iron);
  for (let n = 0; n < 4; n++) {
    // Small cast swans spout outward from the pedestal.
    const a = Math.PI / 4 + (n / 4) * TAU,
      c = Math.cos(a),
      s = Math.sin(a);
    d.ball(g, c * 0.3, 0.55, s * 0.3, [0.09, 0.07, 0.09], iron);
    d.ball(g, c * 0.37, 0.66, s * 0.37, 0.045, iron);
    arc(d, g, [c * 0.4, 0.66, s * 0.4], [c * 0.72, 0.46, s * 0.72], 0.14);
  }
  d.mesh(g, 'cylinder', [0.075, 0.5, 0.075], [0, 1, 0], iron);
  d.ball(g, 0, 0.86, 0, [0.13, 0.08, 0.13], gilt);
  bowl(d, g, 0.62, 0.16, 1.28, iron);
  curb(d, g, 16, 0.62, 1.36, 0.04, 0.05, iron);
  veil(d, g, 0.64, 1.34, 0.46);
  if (grand) {
    d.mesh(g, 'cylinder', [0.055, 0.42, 0.055], [0, 1.55, 0], iron);
    d.ball(g, 0, 1.47, 0, [0.1, 0.06, 0.1], gilt);
    bowl(d, g, 0.36, 0.12, 1.8, iron);
    curb(d, g, 12, 0.36, 1.86, 0.035, 0.04, iron);
    veil(d, g, 0.375, 1.85, 1.36);
  }
  const top = grand ? 1.87 : 1.37;
  d.mesh(g, 'cylinder', [0.05, 0.16, 0.05], [0, top + 0.08, 0], iron);
  d.ball(g, 0, top + 0.2, 0, [0.09, 0.12, 0.09], iron);
  d.mesh(g, 'cone', [0.05, 0.12, 0.05], [0, top + 0.34, 0], gilt);
  jet(d, g, 0, 0, top + 0.4, 0.3, 0.03);
}

// 1908: a City Beautiful limestone basin with a bronze prospector raising the
// first nugget. The completed square adds electric globes on the rim.
function civicMonument(d, g, grand) {
  const lime = '#d9d0bb',
    coping = '#ebe4d2',
    granite = '#a7a59b',
    bronze = '#6b5637',
    gold = '#e0b64f';
  d.mesh(g, 'cylinder', [1.02, 0.28, 1.02], [0, 0.3, 0], lime);
  curb(d, g, 16, 0.98, 0.49, 0.1, 0.16, coping);
  pool(d, g, 0.94, 0.45);
  d.box(g, 0.74, 0.18, 0.74, 0, 0.53, 0, granite);
  d.box(g, 0.5, 0.62, 0.5, 0, 0.92, 0, lime);
  d.box(g, 0.64, 0.1, 0.64, 0, 1.27, 0, coping);
  d.box(g, 0.46, 0.1, 0.46, 0, 1.37, 0, granite);
  for (let n = 0; n < 4; n++) {
    const a = (n / 4) * TAU,
      c = Math.cos(a),
      s = Math.sin(a);
    d.ball(g, c * 0.26, 0.98, s * 0.26, [0.07, 0.07, 0.07], bronze);
    arc(d, g, [c * 0.3, 0.96, s * 0.3], [c * 0.76, 0.46, s * 0.76], 0.12);
  }
  // Bronze prospector: boots, coat, hat, shouldered pick and a raised nugget.
  for (const x of [-0.06, 0.06]) d.box(g, 0.09, 0.34, 0.1, x, 1.59, 0, bronze);
  d.box(g, 0.26, 0.32, 0.15, 0, 1.9, 0, bronze, true);
  d.ball(g, 0, 2.14, 0, 0.085, bronze);
  d.mesh(g, 'cylinder', [0.14, 0.02, 0.14], [0, 2.2, 0], bronze);
  d.mesh(g, 'cylinder', [0.08, 0.09, 0.08], [0, 2.25, 0], bronze);
  d.rod(g, [0.13, 2.01, 0], [0.19, 2.3, 0.03], 0.035, bronze);
  d.ball(g, 0.2, 2.36, 0.03, 0.055, gold, 'rock');
  d.rod(g, [-0.13, 2.01, 0], [-0.12, 1.8, 0.1], 0.035, bronze);
  d.rod(g, [-0.12, 1.72, 0.12], [-0.16, 2.2, -0.12], 0.02, bronze);
  d.box(g, 0.05, 0.05, 0.34, -0.16, 2.2, -0.12, bronze).rotation.x = 0.5;
  if (!grand) return;
  for (let n = 0; n < 4; n++) {
    const a = Math.PI / 4 + (n / 4) * TAU,
      x = Math.cos(a) * 0.98,
      z = Math.sin(a) * 0.98;
    d.mesh(g, 'cylinder', [0.07, 0.1, 0.07], [x, 0.59, z], granite);
    d.rod(g, [x, 0.6, z], [x, 1.5, z], 0.03, '#39413f');
    d.ball(g, x, 1.6, z, [0.11, 0.13, 0.11], '#fff0b6');
    d.mesh(g, 'cone', [0.08, 0.05, 0.08], [x, 1.74, z], '#39413f');
    jet(d, g, Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.45, 0.4);
  }
}

// 1920: a war memorial fountain: granite obelisk, bronze wreaths, lion spouts and,
// on the finished square, bronze urns of remembrance poppies.
function memorialObelisk(d, g, grand) {
  const granite = '#a8a69d',
    light = '#d0cbbe',
    bronze = '#5d8a74';
  d.box(g, 2.12, 0.08, 2.12, 0, 0.2, 0, '#8f8c83');
  squareBasin(d, g, 0.9, 0.34, granite, light);
  for (const x of [-0.92, 0.92])
    for (const z of [-0.92, 0.92]) {
      d.box(g, 0.3, 0.5, 0.3, x, 0.41, z, light);
      if (!grand) continue;
      d.mesh(g, 'cone', [0.12, 0.16, 0.12], [x, 0.74, z], bronze).rotation.x = Math.PI;
      for (let n = 0; n < 3; n++)
        d.ball(
          g,
          x + Math.cos(n * 2.1) * 0.06,
          0.86,
          z + Math.sin(n * 2.1) * 0.06,
          0.06,
          '#c0453a',
        );
    }
  d.box(g, 0.8, 0.2, 0.8, 0, 0.5, 0, granite);
  d.box(g, 0.62, 0.2, 0.62, 0, 0.7, 0, light);
  d.box(g, 0.46, 0.5, 0.46, 0, 1.05, 0, granite);
  for (let n = 0; n < 4; n++) {
    const a = (n / 4) * TAU,
      c = Math.cos(a),
      s = Math.sin(a);
    d.rod(g, [c * 0.22, 1.07, s * 0.22], [c * 0.25, 1.07, s * 0.25], 0.14, bronze);
    d.ball(g, c * 0.33, 0.72, s * 0.33, [0.06, 0.06, 0.06], bronze);
    arc(d, g, [c * 0.36, 0.7, s * 0.36], [c * 0.72, 0.5, s * 0.72], 0.1);
  }
  const shaft = grand ? 1.5 : 0.95;
  d.box(g, 0.32, shaft * 0.6, 0.32, 0, 1.3 + shaft * 0.3, 0, light);
  d.box(g, 0.27, shaft * 0.4, 0.27, 0, 1.3 + shaft * 0.8, 0, light);
  // Stepped courses taper the shaft into its pyramidion.
  for (const [n, size] of [0.22, 0.15, 0.08].entries())
    d.box(g, size, 0.06, size, 0, 1.33 + shaft + n * 0.06, 0, light);
}

// 1932: an Art Deco fountain: stepped ziggurat tiers, fluted column and a gilt
// sunburst, with a ring of arcing jets in the cream-and-teal Motor Age palette.
function artDeco(d, g, grand) {
  const cream = '#ecdcb4',
    teal = '#3f8580',
    gilt = '#d6ae55';
  d.mesh(g, 'cylinder', [1.08, 0.08, 1.08], [0, 0.2, 0], '#3f7874');
  d.mesh(g, 'cylinder', [1.02, 0.26, 1.02], [0, 0.35, 0], cream);
  curb(d, g, 16, 0.97, 0.51, 0.08, 0.12, teal);
  for (let n = 0; n < 16; n++) {
    const a = ((n + 0.5) / 16) * TAU;
    d.box(g, 0.03, 0.24, 0.07, Math.cos(a) * 1.03, 0.36, Math.sin(a) * 1.03, teal).rotation.y = -a;
  }
  pool(d, g, 0.92, 0.48);
  for (const [size, y, color, turn] of [
    [0.9, 0.56, cream, 0],
    [0.58, 0.74, teal, Math.PI / 4],
    [0.42, 0.92, cream, 0],
  ]) {
    d.box(g, size, 0.18, size, 0, y, 0, color).rotation.y = turn;
    d.box(g, size - 0.06, 0.02, size - 0.06, 0, y + 0.09, 0, WATER).rotation.y = turn;
    // Thin sheets spill over every step face.
    for (let n = 0; n < 4; n++) {
      const a = turn + (n / 4) * TAU;
      const reach = size / 2 + 0.015;
      const sheet = d.box(g, 0.025, 0.2, size * 0.8, Math.cos(a) * reach, y - 0.01, 0, WATER);
      sheet.position.z = Math.sin(a) * reach;
      spray(d, sheet).rotation.y = -a;
    }
  }
  const height = grand ? 0.95 : 0.6;
  d.mesh(g, 'cylinder', [0.12, height, 0.12], [0, 1.01 + height / 2, 0], cream);
  for (let n = 1; n <= 3; n++)
    d.mesh(g, 'cylinder', [0.135, 0.04, 0.135], [0, 1.01 + (height * n) / 4, 0], teal);
  const crown = 1.01 + height;
  d.mesh(g, 'cone', [0.16, 0.1, 0.16], [0, crown, 0], gilt);
  for (const turn of [0, Math.PI / 2]) {
    const fan = d.group(g, 0, crown + 0.04, 0);
    fan.rotation.y = turn;
    for (let n = -3; n <= 3; n++) {
      const a = n * 0.42,
        length = n % 2 ? 0.2 : 0.3;
      d.box(
        fan,
        0.024,
        length,
        0.025,
        Math.sin(a) * length * 0.5,
        Math.cos(a) * length * 0.5,
        0,
        gilt,
      ).rotation.z = -a;
    }
  }
  d.ball(g, 0, crown + 0.05, 0, 0.08, gilt);
  for (let n = 0; n < 4; n++) {
    const a = Math.PI / 4 + (n / 4) * TAU;
    jet(d, g, Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0.48, grand ? 0.62 : 0.4, 0.035);
  }
  if (grand) radialArcs(d, g, 4, [0.72, 0.5], [0.5, 0.66], 0.32);
}

// 1958: mid-century saucers stepping up a slender stem to a brass Sputnik star.
function midCentury(d, g, grand) {
  const terrazzo = '#e8e2d4',
    white = '#f5f2ea',
    steel = '#8b979a',
    brass = '#d9b24c';
  d.mesh(g, 'cylinder', [1.06, 0.16, 1.06], [0, 0.24, 0], terrazzo);
  curb(d, g, 16, 1, 0.34, 0.06, 0.12, '#e2805e');
  pool(d, g, 0.96, 0.32);
  const saucers = [
    [0.62, 0.72, 0.1],
    [0.42, 1.14, -0.08],
    [0.27, 1.52, 0.04],
  ].slice(0, grand ? 3 : 2);
  for (const [radius, y, x] of saucers) {
    d.rod(g, [x, 0.3, 0], [x, y, 0], 0.04, steel);
    d.mesh(g, 'cone', [radius, 0.08, radius], [x, y - 0.03, 0], white).rotation.x = Math.PI;
    d.mesh(g, 'cylinder', [radius, 0.035, radius], [x, y + 0.02, 0], white);
    pool(d, g, radius * 0.86, y + 0.04).position.x = x;
  }
  const [, top, x] = saucers.at(-1),
    star = top + 0.36;
  d.rod(g, [x, top, 0], [x, star, 0], 0.025, steel);
  d.ball(g, x, star, 0, 0.1, brass);
  for (const [dx, dy, dz] of [
    [1, 0.4, 0.3],
    [-1, 0.3, 0.4],
    [0.3, 0.2, -1],
    [-0.4, 0.5, -0.9],
    [0.2, 1, 0.1],
    [0.5, -0.4, 0.9],
  ]) {
    const length = Math.hypot(dx, dy, dz) / 0.3;
    const tip = [x + dx / length, star + dy / length, dz / length];
    d.rod(g, [x, star, 0], tip, 0.014, brass);
    d.ball(g, ...tip, 0.025, brass);
  }
  const jets = grand ? 6 : 3;
  for (let n = 0; n < jets; n++) {
    const a = (n / jets) * TAU;
    jet(d, g, Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0.32, 0.35 + (n % 2) * 0.25, 0.03);
  }
}

// 1986: postmodern plaza fountain: pastel stepped cascade, a Memphis sphere and,
// on the finished square, a fragment of colonnade framing four plaza jets.
function postmodern(d, g, grand) {
  const pink = '#e0a39b',
    mint = '#7cc2b4',
    granite = '#77737c',
    stone = '#d6cfc4',
    yellow = '#ecc45a';
  d.box(g, 2.12, 0.08, 2.12, 0, 0.2, 0, '#5f5c64');
  squareBasin(d, g, 0.9, 0.3, granite, stone);
  for (const [size, y, color] of [
    [0.86, 0.5, pink],
    [0.6, 0.72, stone],
    [0.36, 0.94, pink],
  ]) {
    d.box(g, size, 0.22, size, 0, y, 0, color).rotation.y = Math.PI / 4;
    d.box(g, size - 0.06, 0.02, size - 0.06, 0, y + 0.11, 0, WATER).rotation.y = Math.PI / 4;
    for (let n = 0; n < 4; n++) {
      const a = Math.PI / 4 + (n / 4) * TAU;
      const sheet = d.box(g, 0.02, 0.22, size * 0.62, 0, y, 0, WATER);
      sheet.position.set(Math.cos(a) * size * 0.37, y - 0.01, Math.sin(a) * size * 0.37);
      sheet.rotation.y = -a;
      spray(d, sheet);
    }
  }
  d.mesh(g, 'cylinder', [0.09, 0.42, 0.09], [0, 1.26, 0], mint);
  d.mesh(g, 'cylinder', [0.15, 0.05, 0.15], [0, 1.49, 0], stone);
  d.ball(g, 0, 1.68, 0, 0.18, yellow);
  if (!grand) return;
  for (const x of [-0.7, 0.7])
    for (const z of [-0.7, 0.7]) {
      d.mesh(g, 'cylinder', [0.065, 1.2, 0.065], [x, 0.9, z], mint);
      d.box(g, 0.17, 0.08, 0.17, x, 1.54, z, stone);
    }
  for (const side of [-1, 1]) {
    d.box(g, 1.56, 0.1, 0.1, 0, 1.63, side * 0.7, pink);
    d.box(g, 0.1, 0.1, 1.3, side * 0.7, 1.63, 0, pink);
  }
  for (const [x, z] of [
    [0.7, 0],
    [-0.7, 0],
    [0, 0.7],
    [0, -0.7],
  ])
    jet(d, g, x, z, 0.4, 0.55, 0.03);
}

// 2005: a black-granite splash plaza with two glass LED towers facing across the
// water film, spouting into it, and a ring of playful ground jets.
function splashPlaza(d, g, grand) {
  const granite = '#555a5f',
    glass = '#b8dbe6',
    screen = '#7cc3e4',
    steel = '#c7cfd3';
  d.mesh(g, 'cylinder', [1.08, 0.06, 1.08], [0, 0.19, 0], granite);
  pool(d, g, 1, 0.225);
  const height = grand ? 1.5 : 1;
  for (const side of [-1, 1]) {
    const x = side * 0.62;
    d.box(g, 0.34, height, 0.48, x, 0.22 + height / 2, 0, glass);
    d.box(g, 0.02, height * 0.62, 0.36, x - side * 0.17, 0.22 + height * 0.55, 0, screen);
    d.box(g, 0.36, 0.04, 0.5, x, 0.24 + height, 0, steel);
    arc(d, g, [x - side * 0.18, 0.22 + height * 0.42, 0], [side * 0.14, 0.24, 0], 0.12, 0.03);
  }
  d.ball(g, 0, 0.36, 0, 0.14, steel);
  const jets = grand ? 10 : 6;
  for (let n = 0; n < jets; n++) {
    const a = Math.PI / jets + (n / jets) * TAU,
      x = Math.cos(a) * 0.84,
      z = Math.sin(a) * 0.84;
    d.mesh(g, 'cylinder', [0.05, 0.02, 0.05], [x, 0.23, z], steel);
    jet(d, g, x, z, 0.23, 0.3 + 0.25 * Math.abs(Math.sin(n * 1.7)), 0.028);
  }
}

/** One renderer for each id in FOUNTAIN_DESIGNS (src/data/fountains.js). */
export const FOUNTAINS = Object.freeze({
  'frontier-spring': frontierSpring,
  'victorian-iron': victorianIron,
  'civic-monument': civicMonument,
  'memorial-obelisk': memorialObelisk,
  'art-deco': artDeco,
  'mid-century': midCentury,
  postmodern,
  'splash-plaza': splashPlaza,
});
/** Build the central fountain for a square completed in `era`; stage 3 adds its tier. */
export function addTownFountain(d, parent, stage, era = 'frontier') {
  const fountain = d.group(parent);
  fountain.name = 'Town fountain';
  fountain.userData.design = fountainDesign(era);
  walkObstacle(fountain, 0, 0, 1.08, 2.2);
  FOUNTAINS[fountain.userData.design](d, fountain, stage >= 3);
  return fountain;
}
