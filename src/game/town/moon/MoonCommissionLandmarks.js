import { MOON_COMMISSION_DOOR, MOON_PAD_TOP } from '../../../data/moonSettlement';
import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { futureShape } from '../buildings/futureShapes';

// Commissions are places the settlers enter, so they stand on a raised pad with one door
// at MOON_COMMISSION_DOOR on the front (+z). Each form grows through the five shared
// stages: the place opens, then fills out, then gains its signature crown.
export const COMMISSION_LANDMARK_FORMS = ['orchard-dome', 'crystal-nursery', 'bakehouse'];
const FLOOR = MOON_PAD_TOP,
  GLASS = '#a4dbea',
  TRUNK = '#8a6a4a',
  GOLD = '#eacb80',
  CRYSTAL = '#a6cfdf';

function glassDome(d, g, r, h, x = 0, z = 0) {
  const glass = d.material(GLASS);
  glass.transparent = true;
  glass.opacity = 0.28;
  glass.depthWrite = false;
  const dome = d.mesh(g, futureShape(d, 'dome'), [r, h, r], [x, FLOOR + 0.5, z], GLASS);
  dome.castShadow = false;
  // Meridians keep the glass legible from the overview.
  for (let n = 0; n < 4; n++) {
    const a = (n * Math.PI) / 2 + Math.PI / 4;
    let last;
    for (let k = 0; k <= 6; k++) {
      const t = ((k / 6) * Math.PI) / 2;
      const point = [
        x + Math.cos(a) * r * Math.cos(t),
        FLOOR + 0.5 + h * Math.sin(t),
        z + Math.sin(a) * r * Math.cos(t),
      ];
      if (last) d.rod(g, last, point, 0.03, p.shell);
      last = point;
    }
  }
}
// A ceramic drum with the airlock settlers step through.
function drum(d, g, r, colour) {
  d.mesh(g, 'cylinder', [r, 0.5, r], [0, FLOOR + 0.25, 0], p.shell);
  d.mesh(g, 'cylinder', [r + 0.05, 0.1, r + 0.05], [0, FLOOR + 0.52, 0], colour);
  d.box(g, 0.95, 1.25, 0.45, 0, FLOOR + 0.62, MOON_COMMISSION_DOOR - 0.2, p.shell);
  d.box(g, 0.62, 0.95, 0.06, 0, FLOOR + 0.52, MOON_COMMISSION_DOOR + 0.03, p.deep);
  d.box(g, 0.7, 0.09, 0.08, 0, FLOOR + 1.05, MOON_COMMISSION_DOOR + 0.03, colour);
}
function fruitTree(d, g, x, z, height, colour, fruit) {
  d.rod(g, [x, FLOOR + 0.3, z], [x, FLOOR + 0.3 + height, z], 0.09, TRUNK);
  const canopy = d.ball(g, x, FLOOR + 0.4 + height, z, [0.55, 0.5, 0.55], colour, 'rock');
  if (fruit) d.ball(g, x + 0.28, FLOOR + 0.25 + height, z + 0.2, 0.11, GOLD, 'rock');
  return canopy;
}
function buildOrchard(d, g, o, tier, move) {
  drum(d, g, 3.3, o.colour);
  glassDome(d, g, 3.3, 2.2 + tier * 0.5);
  const trees = [
    [-1.4, 0.9],
    [1.4, 0.9],
    [0, -1.5],
    [-1.8, -0.8],
    [1.8, -0.8],
    [0, 0.3],
  ];
  for (const [n, [x, z]] of trees.slice(0, 1 + tier).entries())
    move(
      fruitTree(d, g, x, z, 0.8 + tier * 0.18, o.colour, n < tier - 1),
      'pulse',
      'y',
      0.5,
      0.04,
      n,
    );
  // Later stages: lean-to glass wings, a seed cellar, then a gold lantern crown.
  if (tier >= 2)
    for (const side of [-1, 1]) {
      d.mesh(g, 'cylinder', [1.1, 0.4, 1.1], [side * 3.6, FLOOR + 0.2, -1.6], p.shell);
      glassDome(d, g, 1.05, 1.1 + tier * 0.1, side * 3.6, -1.6);
    }
  if (tier >= 3) d.box(g, 1.6, 0.5, 1, 0, FLOOR + 0.25, -3.9, p.deep);
  if (tier >= 4)
    for (const x of [-3.9, 3.9]) {
      d.rod(g, [x, FLOOR, 2], [x, FLOOR + 1.6, 2], 0.06, p.deep);
      d.ball(g, x, FLOOR + 1.7, 2, 0.2, GOLD, 'rock');
    }
  if (tier >= 5) {
    const crown = d.ball(g, 0, FLOOR + 3.5 + tier * 0.5, 0, 0.32, GOLD, 'rock');
    move(crown, 'turn', 'y', 0.3);
  }
}
function buildNursery(d, g, o, tier, move) {
  drum(d, g, 3.1, o.colour);
  // An open lattice shows the crystals growing inside.
  const top = FLOOR + 2 + tier * 0.45;
  for (let n = 0; n < 6; n++) {
    const a = (n * Math.PI) / 3 + Math.PI / 6,
      x = Math.cos(a) * 2.9,
      z = Math.sin(a) * 2.9;
    d.rod(g, [x, FLOOR + 0.5, z], [x * 0.25, top, z * 0.25], 0.06, p.deep);
  }
  d.mesh(g, 'cylinder', [0.85, 0.1, 0.85], [0, top, 0], p.shell);
  const crystals = 2 + tier * 2;
  for (let n = 0; n < crystals; n++) {
    const a = (n * Math.PI * 2) / crystals,
      r = n % 2 ? 1.7 : 0.9,
      height = 0.45 + tier * 0.12 + (n % 3) * 0.1;
    const crystal = d.ball(
      g,
      Math.cos(a) * r,
      FLOOR + 0.55 + height,
      Math.sin(a) * r - 0.2,
      [0.22, height, 0.22],
      n % 2 ? o.colour : CRYSTAL,
      'rock',
    );
    if (n % 3 === 0) move(crystal, 'pulse', 'y', 0.7, 0.06, a);
  }
  if (tier >= 2)
    for (const side of [-1, 1]) {
      d.box(g, 1.3, 0.9, 1.6, side * 3.5, FLOOR + 0.45, -1.8, p.shell);
      d.box(g, 1.1, 0.08, 1.4, side * 3.5, FLOOR + 0.94, -1.8, o.colour);
    }
  if (tier >= 3)
    for (const x of [-3.5, 3.5])
      d.ball(g, x, FLOOR + 1.35, -1.8, [0.28, 0.45, 0.28], CRYSTAL, 'rock');
  if (tier >= 4) d.box(g, 2.4, 1.1, 1, 0, FLOOR + 0.55, -3.9, p.shell);
  if (tier >= 5) {
    const crown = d.ball(g, 0, top + 0.85, 0, [0.5, 0.8, 0.5], o.colour, 'rock');
    move(crown, 'turn', 'y', 0.2);
  }
}
function buildBakehouse(d, g, o, tier, move) {
  drum(d, g, 2.9, o.colour);
  d.mesh(g, 'cylinder', [2.75, 0.9 + tier * 0.15, 2.75], [0, FLOOR + 0.95, -0.1], p.shell);
  d.mesh(
    g,
    futureShape(d, 'dome'),
    [2.75, 0.9, 2.75],
    [0, FLOOR + 1.4 + tier * 0.15, -0.1],
    o.colour,
  );
  // The oven's vent, with its warm glow lifting when the stage is lively enough.
  d.mesh(g, 'cylinder', [0.3, 1.3, 0.3], [1.2, FLOOR + 2.4 + tier * 0.12, -0.7], p.deep);
  const glow = d.ball(g, 1.2, FLOOR + 3.2 + tier * 0.12, -0.7, 0.16, GOLD, 'rock');
  move(glow, 'lift', 'y', 0.9, 0.22);
  const tables = [
    [-3.2, 1.9],
    [3.2, 1.9],
    [-3.7, -0.5],
    [3.7, -0.5],
  ];
  for (const [x, z] of tables.slice(0, tier - 1)) {
    d.mesh(g, 'cylinder', [0.42, 0.08, 0.42], [x, FLOOR + 0.5, z], p.shell);
    d.rod(g, [x, FLOOR, z], [x, FLOOR + 0.48, z], 0.05, p.deep);
    d.mesh(g, 'cylinder', [0.24, 0.07, 0.24], [x, FLOOR + 0.57, z], GOLD);
  }
  if (tier >= 3) d.box(g, 2.4, 0.08, 0.9, 0, FLOOR + 1.65, MOON_COMMISSION_DOOR - 0.35, o.colour);
  if (tier >= 4) d.box(g, 2.2, 0.9, 1, 0, FLOOR + 0.45, -3.8, p.shell);
  if (tier >= 5) {
    // The crater's landmark: one great golden pie on the roof.
    const pie = d.mesh(
      g,
      'cylinder',
      [0.95, 0.22, 0.95],
      [-0.5, FLOOR + 2.65 + tier * 0.15, 0],
      GOLD,
    );
    move(pie, 'turn', 'y', 0.12);
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3;
      d.rod(
        g,
        [-0.5, FLOOR + 2.8 + tier * 0.15, 0],
        [-0.5 + Math.cos(a) * 0.82, FLOOR + 2.8 + tier * 0.15, Math.sin(a) * 0.82],
        0.03,
        TRUNK,
      );
    }
  }
}
const BUILDERS = {
  'orchard-dome': buildOrchard,
  'crystal-nursery': buildNursery,
  bakehouse: buildBakehouse,
};
export function buildCommissionLandmark(d, g, option, tier, move) {
  BUILDERS[option.form](d, g, option, tier, move);
}
