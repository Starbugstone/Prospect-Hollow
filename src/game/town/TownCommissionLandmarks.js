// Valley commissions stand on the shared monument pedestal, inside its flanking pavilions,
// colonnade and crown, so each outcome adds only its own centrepiece. Every stage adds
// something of its own and each form moves from the shared animation stage on.
export const VALLEY_COMMISSION_FORMS = ['story-hall', 'bandstand', 'wild-meadow'];
const FLOOR = 0.6,
  TIMBER = '#8a6a4a',
  CREAM = '#f4ead5',
  SLATE = '#655343',
  GOLD = '#edc66e',
  LEAF = '#6f9a4d',
  PETAL = '#e6a9b5',
  WATER = '#8cc4d8';

function buildStoryHall(d, g, o, tier, move) {
  const height = 2.2 + tier * 0.3;
  d.box(g, 5.2, height, 3.6, 0, FLOOR + height / 2, -0.4, CREAM);
  for (const x of [-2.5, -0.85, 0.85, 2.5])
    d.box(g, 0.22, height, 0.2, x, FLOOR + height / 2, 1.45, TIMBER);
  d.box(g, 5.3, 0.22, 0.2, 0, FLOOR + height, 1.45, TIMBER);
  d.box(g, 1.05, 1.5, 0.12, 0, FLOOR + 0.75, 1.52, SLATE);
  // A long pitched roof, built from two sloped planes.
  for (const side of [-1, 1]) {
    const roof = d.box(g, 5.7, 0.22, 2.35, 0, FLOOR + height + 0.62, -0.4 + side * 1.02, o.colour);
    roof.rotation.x = side * 0.58;
  }
  d.box(g, 5.7, 0.2, 0.3, 0, FLOOR + height + 1.26, -0.4, SLATE);
  if (tier >= 2)
    for (const x of [-1.68, 1.68]) d.box(g, 0.75, 0.85, 0.1, x, FLOOR + 1.3, 1.5, GOLD);
  if (tier >= 3) {
    // The story bell, swung by hand and by the wind.
    d.box(g, 0.9, 1, 0.9, 0, FLOOR + height + 1.8, -0.4, CREAM);
    const bell = d.ball(g, 0, FLOOR + height + 1.8, -0.4, [0.26, 0.34, 0.26], GOLD, 'rock');
    move(bell, 'turn', 'y', 0.5);
    d.mesh(g, 'cone', [0.85, 0.7, 0.85], [0, FLOOR + height + 2.65, -0.4], o.colour);
  }
  if (tier >= 4) for (const x of [-2.2, 2.2]) d.box(g, 1, 0.42, 0.42, x, FLOOR + 0.21, 2.3, TIMBER);
  if (tier >= 5) d.box(g, 2.4, 0.5, 0.1, 0, FLOOR + height + 0.2, 1.6, GOLD);
}
function buildBandstand(d, g, o, tier, move) {
  const posts = 8,
    radius = 2.8,
    height = 2.3 + tier * 0.25;
  d.mesh(g, 'cylinder', [radius + 0.25, 0.4, radius + 0.25], [0, FLOOR + 0.2, 0], CREAM);
  for (let n = 0; n < posts; n++) {
    const a = (n * Math.PI * 2) / posts,
      x = Math.cos(a) * radius,
      z = Math.sin(a) * radius;
    d.rod(g, [x, FLOOR + 0.4, z], [x, FLOOR + 0.4 + height, z], 0.08, CREAM);
    if (tier >= 2 && n % 2 === 0) d.ball(g, x, FLOOR + height - 0.1, z, 0.13, GOLD, 'rock');
  }
  d.mesh(g, 'cone', [radius + 0.5, 1.5, radius + 0.5], [0, FLOOR + height + 1.15, 0], o.colour);
  // A band to fill it: music stands first, then the drum, then the great horn.
  for (let n = 0; n < Math.min(tier + 1, 5); n++) {
    const a = (n * Math.PI * 2) / 5 + 0.3;
    d.rod(
      g,
      [Math.cos(a) * 1.5, FLOOR + 0.4, Math.sin(a) * 1.5],
      [Math.cos(a) * 1.5, FLOOR + 1.2, Math.sin(a) * 1.5],
      0.03,
      SLATE,
    );
  }
  if (tier >= 3) {
    d.mesh(g, 'cylinder', [0.5, 0.42, 0.5], [0, FLOOR + 0.62, -0.3], SLATE);
    const vane = d.ball(g, 0, FLOOR + height + 2.1, 0, [0.5, 0.1, 0.14], GOLD, 'rock');
    move(vane, 'turn', 'y', 0.35);
  }
  if (tier >= 4) d.mesh(g, 'cone', [0.42, 1, 0.42], [1, FLOOR + 1, 0.4], GOLD);
  if (tier >= 5)
    for (const side of [-1, 1]) {
      d.rod(g, [side * 3.6, FLOOR, 2.3], [side * 3.6, FLOOR + 2.2, 2.3], 0.05, SLATE);
      d.ball(g, side * 3.6, FLOOR + 2.3, 2.3, 0.2, GOLD, 'rock');
    }
}
function meadowTree(d, g, x, z, height, leaf) {
  d.rod(g, [x, FLOOR, z], [x, FLOOR + height, z], 0.16, TIMBER);
  return d.ball(g, x, FLOOR + height + 0.45, z, [0.95, 0.9, 0.95], leaf, 'rock');
}
function buildMeadow(d, g, o, tier, move) {
  d.mesh(g, 'cylinder', [3.9, 0.12, 3.9], [0, FLOOR + 0.06, 0], o.colour);
  // Hurdle fencing, open at the front so the animals come and go.
  for (let n = 1; n < 12; n++) {
    const a = (n * Math.PI * 2) / 12 + Math.PI / 2,
      x = Math.cos(a) * 3.75,
      z = Math.sin(a) * 3.75;
    d.rod(g, [x, FLOOR, z], [x, FLOOR + 0.62, z], 0.05, TIMBER);
    if (n < 11) {
      const b = ((n + 1) * Math.PI * 2) / 12 + Math.PI / 2;
      d.rod(
        g,
        [x, FLOOR + 0.48, z],
        [Math.cos(b) * 3.75, FLOOR + 0.48, Math.sin(b) * 3.75],
        0.035,
        TIMBER,
      );
    }
  }
  const trees = [
    [-1.9, -1.6, 2.2],
    [1.7, -1.9, 2.6],
    [-0.2, -2.6, 1.9],
    [2.3, 0.4, 1.8],
  ];
  for (const [n, [x, z, height]] of trees.slice(0, Math.max(1, tier - 1)).entries())
    move(meadowTree(d, g, x, z, height, n % 2 ? o.colour : LEAF), 'pulse', 'y', 0.45, 0.03, n);
  for (let n = 0; n < 4 + tier * 3; n++) {
    const a = n * 2.4,
      r = 0.7 + (n % 5) * 0.55;
    d.ball(g, Math.cos(a) * r, FLOOR + 0.18, 1 + Math.sin(a) * r * 0.8, 0.09, PETAL, 'rock');
  }
  if (tier >= 3) {
    d.mesh(g, 'cylinder', [1, 0.06, 0.8], [-1.6, FLOOR + 0.15, 1], WATER);
    const dragonfly = d.ball(g, -1.6, FLOOR + 0.8, 1, [0.14, 0.05, 0.05], GOLD, 'rock');
    move(dragonfly, 'lift', 'y', 0.8, 0.2);
  }
  if (tier >= 4) {
    d.rod(g, [0.6, FLOOR, 0.3], [0.6, FLOOR + 1.6, 0.3], 0.06, TIMBER);
    d.box(g, 0.42, 0.42, 0.42, 0.6, FLOOR + 1.8, 0.3, CREAM);
    d.mesh(g, 'cone', [0.42, 0.34, 0.42], [0.6, FLOOR + 2.18, 0.3], o.colour);
  }
  if (tier >= 5) {
    // The meadow's sign stands to one side, clear of the shared fountain court.
    const sign = d.group(g, -2.5, 0, 2.5);
    sign.rotation.y = -0.6;
    d.box(sign, 2, 0.5, 0.14, 0, FLOOR + 1, 0, TIMBER);
    d.box(sign, 1.6, 0.26, 0.16, 0, FLOOR + 1, 0, GOLD);
    for (const x of [-0.9, 0.9]) d.rod(sign, [x, FLOOR, 0], [x, FLOOR + 1.25, 0], 0.06, TIMBER);
  }
}
const BUILDERS = {
  'story-hall': buildStoryHall,
  bandstand: buildBandstand,
  'wild-meadow': buildMeadow,
};
export function buildValleyCommission(d, g, option, tier, move) {
  BUILDERS[option.form](d, g, option, tier, move);
}
