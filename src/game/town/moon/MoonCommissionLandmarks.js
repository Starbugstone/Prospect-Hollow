import { MOON_COMMISSION_DOOR, MOON_PAD_TOP } from '../../../data/moonSettlement';
import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { futureShape } from '../buildings/futureShapes';

// Commissions are places the settlers enter, so they stand on a raised pad with one door
// at MOON_COMMISSION_DOOR on the front (+z). Each form grows through the five shared
// stages: the place opens, then fills out, then gains its signature crown.
export const COMMISSION_LANDMARK_FORMS = [
  'orchard-dome',
  'crystal-nursery',
  'bakehouse',
  'lamplit-library',
  'little-planetarium',
  'earthview-studio',
  'crew-canteen',
  'mapmakers-hall',
  'rover-track',
];
const FLOOR = MOON_PAD_TOP,
  GLASS = '#a4dbea',
  TRUNK = '#8a6a4a',
  GOLD = '#eacb80',
  CRYSTAL = '#a6cfdf',
  EARTH = '#4f8fc7';

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
// New Hollow Rising's commissions, on the outer ring. The teachers' three:
function buildLibrary(d, g, o, tier, move) {
  drum(d, g, 3.2, o.colour);
  const wall = 1.6 + tier * 0.2,
    top = FLOOR + 0.5 + wall;
  d.mesh(g, 'cylinder', [2.6, wall, 2.6], [0, FLOOR + 0.5 + wall / 2, -0.3], p.shell);
  // A ring of lamplit windows, one more at each stage, clear of the door.
  const windows = 4 + tier;
  for (let n = 0; n < windows; n++) {
    const a = 0.7 + (n * (Math.PI * 2 - 1.4)) / (windows - 1);
    const pane = d.box(
      g,
      0.42,
      0.62,
      0.08,
      Math.sin(a) * 2.62,
      FLOOR + 0.5 + wall * 0.55,
      -0.3 + Math.cos(a) * 2.62,
      GOLD,
    );
    pane.rotation.y = a;
  }
  d.mesh(g, futureShape(d, 'dome'), [2.75, 1.3, 2.75], [0, top, -0.3], o.colour);
  if (tier >= 2)
    // Reading wings either side, their roofs in the library's colour.
    for (const side of [-1, 1]) {
      d.box(g, 1.3, 1, 1.6, side * 3.5, FLOOR + 0.5, -1.8, p.shell);
      d.box(g, 1.4, 0.12, 1.7, side * 3.5, FLOOR + 1.04, -1.8, o.colour);
    }
  if (tier >= 3) {
    // The reading lamp at the top of the dome, slowly turning its light round the crater.
    d.mesh(g, 'cylinder', [0.3, 0.5, 0.3], [0, top + 1.45, -0.3], p.deep);
    move(d.ball(g, 0, top + 1.85, -0.3, [0.3, 0.38, 0.3], GOLD, 'rock'), 'turn', 'y', 0.4);
  }
  if (tier >= 4)
    for (const side of [-1, 1]) {
      d.box(g, 1.2, 0.12, 0.4, side * 2.3, FLOOR + 0.42, 3.3, p.deep);
      d.box(g, 0.1, 0.4, 0.36, side * 2.3 - side * 0.5, FLOOR + 0.2, 3.3, p.shell);
    }
  if (tier >= 5) {
    // An open book of gold over the dome.
    const book = d.group(g, 0, top + 2.5, -0.3);
    for (const side of [-1, 1]) {
      const page = d.box(book, 0.7, 0.06, 0.9, side * 0.34, 0, 0, GOLD);
      page.rotation.z = side * 0.35;
    }
    move(book, 'turn', 'y', 0.25);
  }
}
function buildPlanetarium(d, g, o, tier, move) {
  drum(d, g, 3.1, o.colour);
  const height = 2 + tier * 0.25;
  d.mesh(g, 'cylinder', [2.8, 0.6, 2.8], [0, FLOOR + 0.8, -0.3], p.shell);
  d.mesh(g, futureShape(d, 'dome'), [2.85, height, 2.85], [0, FLOOR + 1.1, -0.3], o.colour);
  // Stars on the dome, more at each stage.
  const stars = 3 + tier * 2;
  for (let n = 0; n < stars; n++) {
    const a = n * 2.4,
      t = 0.35 + (n % 4) * 0.18;
    d.ball(
      g,
      Math.cos(a) * 2.86 * Math.cos(t),
      FLOOR + 1.1 + height * Math.sin(t),
      -0.3 + Math.sin(a) * 2.86 * Math.cos(t),
      0.09,
      GOLD,
      'rock',
    );
  }
  if (tier >= 2) {
    // A telescope beside it, for the real sky after the show.
    d.rod(g, [3.4, FLOOR, -1.6], [3.4, FLOOR + 1.2, -1.6], 0.06, p.deep);
    const tube = d.mesh(g, 'cylinder', [0.18, 1.1, 0.18], [3.4, FLOOR + 1.5, -1.8], p.shell);
    tube.rotation.x = -0.7;
  }
  if (tier >= 3) {
    // An orrery on the crown: the Earth and its Moon going round.
    const orrery = d.group(g, 0, FLOOR + 1.3 + height, -0.3);
    d.ball(orrery, 0, 0, 0, 0.3, EARTH, 'rock');
    d.rod(orrery, [0, 0, 0], [0.9, 0, 0], 0.03, GOLD);
    d.ball(orrery, 0.9, 0, 0, 0.12, p.shell, 'rock');
    move(orrery, 'turn', 'y', 0.5);
  }
  if (tier >= 4)
    for (let n = 0; n < 6; n++) {
      const a = Math.PI / 2 + 0.6 + (n * (Math.PI * 2 - 1.2)) / 5;
      const x = Math.cos(a) * 4.2,
        z = Math.sin(a) * 4.2 - 0.3;
      d.rod(g, [x, FLOOR, z], [x, FLOOR + 0.7, z], 0.04, p.deep);
      d.ball(g, x, FLOOR + 0.78, z, 0.12, p.glass, 'rock');
    }
  if (tier >= 5) {
    const ring = d.group(g, 0, FLOOR + 1.3 + height, -0.3);
    d.mesh(ring, 'ring', [1.4, 1.4, 1.4], [0, 0, 0], GOLD).rotation.x = Math.PI / 2;
    d.ball(ring, 1.4, 0, 0, 0.16, GOLD, 'rock');
    move(ring, 'turn', 'y', -0.3);
  }
}
// An easel with a canvas of Earth, facing away from the studio's glass.
function easel(d, g, x, z, turn) {
  const stand = d.group(g, x, FLOOR, z);
  stand.rotation.y = turn;
  for (const dx of [-0.2, 0.2]) d.rod(stand, [dx, 0, 0], [dx * 0.3, 1.2, -0.1], 0.03, TRUNK);
  d.rod(stand, [0, 0, -0.35], [0, 1.1, -0.1], 0.03, TRUNK);
  d.box(stand, 0.55, 0.45, 0.04, 0, 0.95, -0.05, p.shell);
  d.ball(stand, 0, 0.95, -0.02, [0.15, 0.15, 0.02], EARTH, 'rock');
}
function buildStudio(d, g, o, tier, move) {
  drum(d, g, 3, o.colour);
  const height = 1.6 + tier * 0.15;
  d.box(g, 4.4, height, 2.8, 0, FLOOR + 0.5 + height / 2, -0.6, p.shell);
  // The glazed front looks out to Earth over the door, its panes framed by mullions; the
  // roof slopes up toward it.
  d.box(g, 4.2, height - 0.2, 0.08, 0, FLOOR + 0.5 + height / 2, 0.84, p.glass);
  for (const x of [-1.4, 0, 1.4])
    d.box(g, 0.08, height - 0.2, 0.1, x, FLOOR + 0.5 + height / 2, 0.86, p.deep);
  const roof = d.box(g, 4.7, 0.16, 3.3, 0, FLOOR + 0.62 + height, -0.6, o.colour);
  roof.rotation.x = -0.12;
  for (const [x, z, turn] of [
    [-2.3, 3.4, 0.4],
    [2.3, 3.4, -0.4],
    [-3.4, 0.9, 1.2],
    [3.4, 0.9, -1.2],
  ].slice(0, Math.max(0, tier >= 4 ? 4 : tier >= 2 ? 2 : 0)))
    easel(d, g, x, z, turn);
  if (tier >= 3) {
    // The studio's sign: a palette turning on its pole.
    d.rod(g, [1.8, FLOOR + 0.6 + height, -1.6], [1.8, FLOOR + 1.7 + height, -1.6], 0.04, p.deep);
    const palette = d.ball(
      g,
      1.8,
      FLOOR + 1.8 + height,
      -1.6,
      [0.45, 0.06, 0.34],
      o.colour,
      'rock',
    );
    move(palette, 'turn', 'y', 0.35);
  }
  if (tier >= 4) {
    d.box(g, 0.6, 0.7, 0.6, -2.9, FLOOR + 0.35, -2.8, p.deep);
    d.ball(g, -2.9, FLOOR + 1, -2.8, [0.3, 0.42, 0.3], o.colour, 'rock');
  }
  if (tier >= 5) {
    // A great painted Earth on the roof, turning as the real one does.
    const globe = d.group(g, -0.9, FLOOR + 1.8 + height, -1);
    d.ball(globe, 0, 0, 0, 0.62, EARTH, 'sphere');
    d.ball(globe, 0.2, 0.25, 0.4, [0.3, 0.16, 0.3], p.shell, 'rock');
    move(globe, 'turn', 'y', 0.15);
  }
}
// And the rover crews' three:
function buildCanteen(d, g, o, tier, move) {
  drum(d, g, 3.2, o.colour);
  d.box(g, 5, 1.3 + tier * 0.1, 2.6, 0, FLOOR + 1.15, -0.7, p.shell);
  d.mesh(
    g,
    futureShape(d, 'dome'),
    [2.55, 0.9 + tier * 0.1, 1.35],
    [0, FLOOR + 1.8 + tier * 0.1, -0.7],
    o.colour,
  );
  // The kitchen chimney, rising clear of the vault, and its steam.
  const vault = FLOOR + 1.8 + tier * 0.1,
    rise = 0.9 + tier * 0.1;
  const flue = vault + rise * 0.78 + 0.7;
  d.mesh(g, 'cylinder', [0.26, flue - vault, 0.26], [-1.6, (vault + flue) / 2, -1.3], p.deep);
  move(d.ball(g, -1.6, flue + 0.3, -1.3, 0.22, p.shell, 'rock'), 'lift', 'y', 0.8, 0.25);
  for (const [x, z] of [
    [-3.4, 1.7],
    [3.4, 1.7],
    [-3.7, -0.9],
    [3.7, -0.9],
  ].slice(0, (tier - 1) * 1)) {
    d.mesh(g, 'cylinder', [0.45, 0.08, 0.45], [x, FLOOR + 0.5, z], p.shell);
    d.rod(g, [x, FLOOR, z], [x, FLOOR + 0.48, z], 0.05, p.deep);
    d.mesh(g, 'cylinder', [0.08, 0.2, 0.08], [x + 0.15, FLOOR + 0.64, z], GOLD);
  }
  if (tier >= 3)
    // A flask hung over the door for a sign.
    d.mesh(
      g,
      'cylinder',
      [0.22, 0.6, 0.22],
      [0.9, FLOOR + 1.6, MOON_COMMISSION_DOOR - 0.3],
      o.colour,
    );
  if (tier >= 4) {
    // A crew rover parked by the canteen, home from the plains.
    const rover = d.group(g, -3.1, FLOOR, -2.9);
    rover.rotation.y = 0.5;
    d.box(rover, 1.5, 0.5, 0.9, 0, 0.55, 0, p.shell);
    d.box(rover, 0.6, 0.35, 0.7, -0.3, 0.98, 0, p.glass);
    for (const [x, z] of [
      [-0.5, 0.5],
      [0.5, 0.5],
      [-0.5, -0.5],
      [0.5, -0.5],
    ])
      d.mesh(rover, 'cylinder', [0.25, 0.15, 0.25], [x, 0.25, z], p.deep).rotation.x = Math.PI / 2;
  }
  if (tier >= 5) {
    // The great soup pot on top of the vault, its lid lifting.
    const top = vault + rise * 0.95;
    d.mesh(g, 'cylinder', [0.6, 0.6, 0.6], [0.8, top + 0.2, -0.7], GOLD);
    const lid = d.mesh(g, 'cylinder', [0.64, 0.08, 0.64], [0.8, top + 0.54, -0.7], p.deep);
    move(lid, 'lift', 'y', 1.2, 0.08);
  }
}
function buildMapHall(d, g, o, tier, move) {
  drum(d, g, 3.2, o.colour);
  d.mesh(g, 'cylinder', [2.9, 1.1, 2.9], [0, FLOOR + 1.05, -0.3], p.shell);
  // The floor map under glass: the crater and the roads the crews have found, more of
  // them at each stage.
  d.mesh(g, 'cylinder', [2.7, 0.08, 2.7], [0, FLOOR + 1.62, -0.3], p.deep);
  for (let n = 0; n < 2 + tier * 2; n++) {
    const a = n * 1.9,
      r = 0.6 + (n % 3) * 0.7;
    const road = d.box(
      g,
      0.9,
      0.04,
      0.12,
      Math.cos(a) * r,
      FLOOR + 1.68,
      -0.3 + Math.sin(a) * r,
      n % 2 ? GOLD : o.colour,
    );
    road.rotation.y = a;
  }
  glassDome(d, g, 2.9, 1.4 + tier * 0.2, 0, -0.3);
  if (tier >= 2)
    // Expedition flags, one for each far place the crews have reached.
    for (let n = 0; n < tier + 1; n++) {
      const a = Math.PI / 2 + 0.8 + (n * (Math.PI * 2 - 1.6)) / tier;
      const x = Math.cos(a) * 3.9,
        z = Math.sin(a) * 3.9 - 0.3;
      d.rod(g, [x, FLOOR, z], [x, FLOOR + 1.5, z], 0.04, p.deep);
      d.box(g, 0.5, 0.3, 0.04, x + 0.25, FLOOR + 1.35, z, n % 2 ? GOLD : o.colour);
    }
  if (tier >= 3) {
    // A globe of the Moon on the crown.
    const globe = d.ball(g, 0, FLOOR + 2.4 + tier * 0.2, -0.3, 0.42, p.shell, 'sphere');
    move(globe, 'turn', 'y', 0.3);
  }
  if (tier >= 4) {
    d.rod(g, [-2.6, FLOOR, -3.2], [-2.6, FLOOR + 2.6, -3.2], 0.07, p.deep);
    const dish = d.mesh(g, 'cone', [0.5, 0.2, 0.5], [-2.6, FLOOR + 2.7, -3.2], p.shell);
    dish.rotation.x = 0.6;
  }
  if (tier >= 5) {
    // A gold compass rose above the globe.
    const rose = d.group(g, 0, FLOOR + 3.4 + tier * 0.2, -0.3);
    for (let n = 0; n < 4; n++)
      d.ball(rose, 0, 0, 0, [0.7, 0.06, 0.12], GOLD, 'rock').rotation.y = (n * Math.PI) / 4;
    move(rose, 'turn', 'y', 0.2);
  }
}
// A model rover on the track: body, cab and wheels.
function modelRover(d, g, colour) {
  d.box(g, 0.5, 0.18, 0.3, 0, 0.17, 0, colour);
  d.box(g, 0.2, 0.12, 0.24, -0.1, 0.32, 0, p.glass);
  for (const x of [-0.17, 0.17]) d.box(g, 0.12, 0.12, 0.36, x, 0.08, 0, p.deep);
}
function buildRoverTrack(d, g, o, tier, move) {
  // A raised oval track round an infield, open to watch from every side.
  d.mesh(g, 'cylinder', [3.9, 0.12, 3.9], [0, FLOOR + 0.06, 0], p.shell);
  const track = d.mesh(g, 'ring', [3.1, 3.1, 0.6], [0, FLOOR + 0.14, 0], p.deep);
  track.rotation.x = Math.PI / 2;
  d.mesh(g, 'cylinder', [2.4, 0.1, 2.4], [0, FLOOR + 0.12, 0], o.colour);
  // The racers go round together, one more at alternate stages.
  const racers = d.group(g, 0, FLOOR + 0.18, 0);
  for (let n = 0; n < Math.ceil(tier / 2); n++) {
    const a = (n * Math.PI * 2) / 3;
    const rover = d.group(racers, Math.cos(a) * 3.1, 0, Math.sin(a) * 3.1);
    rover.rotation.y = -a;
    modelRover(d, rover, n % 2 ? GOLD : o.colour);
  }
  move(racers, 'turn', 'y', -0.6);
  if (tier >= 2)
    // A stand behind the track, a row more at each stage, each one higher.
    for (let row = 0; row < Math.min(3, tier - 1); row++)
      d.box(
        g,
        3.4 - row * 0.4,
        0.3 + row * 0.3,
        0.35,
        0,
        FLOOR + (0.3 + row * 0.3) / 2,
        -3.9 - row * 0.35,
        p.shell,
      );
  if (tier >= 4) {
    // The start arch over the track at the front, chequered.
    for (const x of [-0.8, 0.8]) d.rod(g, [x, FLOOR, 3.1], [x, FLOOR + 1.3, 3.1], 0.05, p.deep);
    for (let n = 0; n < 4; n++)
      d.box(g, 0.4, 0.2, 0.08, -0.6 + n * 0.4, FLOOR + 1.3, 3.1, n % 2 ? p.deep : p.shell);
  }
  if (tier >= 5) {
    // The crews' trophy, in the middle of the infield.
    d.mesh(g, 'cylinder', [0.4, 0.5, 0.4], [0, FLOOR + 0.4, 0], p.shell);
    const cup = d.mesh(g, 'cone', [0.35, 0.5, 0.35], [0, FLOOR + 0.95, 0], GOLD);
    cup.rotation.x = Math.PI;
    move(d.ball(g, 0, FLOOR + 1.35, 0, 0.14, GOLD, 'rock'), 'turn', 'y', 0.5);
  }
}
const BUILDERS = {
  'orchard-dome': buildOrchard,
  'crystal-nursery': buildNursery,
  bakehouse: buildBakehouse,
  'lamplit-library': buildLibrary,
  'little-planetarium': buildPlanetarium,
  'earthview-studio': buildStudio,
  'crew-canteen': buildCanteen,
  'mapmakers-hall': buildMapHall,
  'rover-track': buildRoverTrack,
};
export function buildCommissionLandmark(d, g, option, tier, move) {
  BUILDERS[option.form](d, g, option, tier, move);
}
