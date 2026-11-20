// Valley commissions stand on the shared monument pedestal, inside its flanking pavilions,
// colonnade and crown, so each outcome adds only its own centrepiece. Every stage adds
// something of its own and each form moves from the shared animation stage on.
export const VALLEY_COMMISSION_FORMS = [
  'story-hall',
  'bandstand',
  'wild-meadow',
  'seedling-grove',
  'lantern-orchard',
  'story-tree',
];
const FLOOR = 0.6,
  TIMBER = '#8a6a4a',
  CREAM = '#f4ead5',
  SLATE = '#655343',
  GOLD = '#edc66e',
  LEAF = '#6f9a4d',
  PETAL = '#e6a9b5',
  WATER = '#8cc4d8',
  SOIL = '#6b5038',
  LANTERN = '#f2b65a';

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
// The Willowkin Glade's outcomes share a lawn walkers step onto, as the meadow's.
function gladeLawn(d, g, colour) {
  d.mesh(g, 'cylinder', [3.9, 0.12, 3.9], [0, FLOOR + 0.06, 0], colour);
}
// A young tree: a thin stem and a small round crown.
function sapling(d, g, x, z, height, leaf) {
  d.rod(g, [x, FLOOR + 0.3, z], [x, FLOOR + 0.3 + height, z], 0.04, TIMBER);
  return d.ball(g, x, FLOOR + 0.35 + height, z, [0.22, 0.24, 0.22], leaf, 'rock');
}
// Raised beds of seedlings, a row more at each stage, with aisles the Willowkin walk.
const GROVE_BEDS = [-2.6, -0.9, 2.9];
function buildSeedlingGrove(d, g, o, tier, move) {
  gladeLawn(d, g, LEAF);
  for (const [b, x] of GROVE_BEDS.slice(0, tier >= 2 ? 3 : 2).entries()) {
    d.box(g, 0.8, 0.3, 3.4, x, FLOOR + 0.27, -0.3, TIMBER);
    d.box(g, 0.66, 0.06, 3.26, x, FLOOR + 0.43, -0.3, SOIL);
    const count = 3 + Math.min(tier, 3);
    for (let n = 0; n < count; n++) {
      const z = -1.8 + (n * 3) / (count - 1);
      const tree = sapling(
        d,
        g,
        x,
        z,
        0.35 + ((n + b) % 3) * 0.12 + tier * 0.05,
        b % 2 ? o.colour : LEAF,
      );
      if (n % 2 === b % 2) move(tree, 'pulse', 'y', 0.6, 0.05, n + b);
    }
  }
  // A potting bench at the back.
  d.box(g, 1.6, 0.12, 0.6, 0.9, FLOOR + 0.8, -3.1, TIMBER);
  for (const x of [0.2, 1.6]) d.rod(g, [x, FLOOR, -3.1], [x, FLOOR + 0.8, -3.1], 0.05, TIMBER);
  if (tier >= 2) d.mesh(g, 'cylinder', [0.5, 0.35, 0.3], [-1.75, FLOOR + 0.3, -3.2], WATER);
  if (tier >= 3)
    // Willowkin charms on posts at the bed ends, swaying in the evening air.
    for (const x of [GROVE_BEDS[0], GROVE_BEDS[2]]) {
      d.rod(g, [x, FLOOR, 1.8], [x, FLOOR + 1.4, 1.8], 0.05, TIMBER);
      move(d.ball(g, x, FLOOR + 1.25, 1.8, [0.14, 0.2, 0.14], GOLD, 'rock'), 'turn', 'y', 0.8);
    }
  if (tier >= 4) {
    // A glass cold frame for the youngest shoots.
    d.box(g, 1.4, 0.5, 0.9, -1.75, FLOOR + 0.25, -3.25, CREAM);
    d.box(g, 1.3, 0.06, 0.8, -1.75, FLOOR + 0.55, -3.25, WATER);
  }
  if (tier >= 5) {
    // The crate bound for the Moon, waiting by the gate with its seedlings.
    d.box(g, 0.9, 0.6, 0.7, 2.5, FLOOR + 0.3, 2.6, TIMBER);
    for (const dx of [-0.25, 0.25]) sapling(d, g, 2.5 + dx, 2.6, 0.4, o.colour);
    d.box(g, 0.92, 0.1, 0.1, 2.5, FLOOR + 0.45, 2.96, GOLD);
  }
}
// Fruit trees with lanterns in their boughs, a tree more at each stage.
const ORCHARD_TREES = [
  [-2.3, -1.4, 2],
  [2.1, -1.9, 2.2],
  [-0.4, -2.9, 1.9],
  [-2.6, 1.4, 1.7],
  [2.6, 0.6, 1.8],
];
function buildLanternOrchard(d, g, o, tier, move) {
  gladeLawn(d, g, '#86a85a');
  const trees = ORCHARD_TREES.slice(0, 1 + tier);
  for (const [n, [x, z, height]] of trees.entries()) {
    move(meadowTree(d, g, x, z, height, n % 2 ? LEAF : '#5f8a4a'), 'pulse', 'y', 0.4, 0.03, n);
    d.ball(g, x + 0.45, FLOOR + height + 0.1, z + 0.4, 0.11, PETAL, 'rock');
    d.ball(g, x - 0.4, FLOOR + height + 0.25, z + 0.3, 0.11, GOLD, 'rock');
    // A lantern hung below the bough.
    const lantern = d.group(g, x + 0.55, FLOOR + height - 0.25, z + 0.55);
    d.rod(lantern, [0, 0, 0], [0, 0.35, 0], 0.012, SLATE);
    d.box(lantern, 0.2, 0.26, 0.2, 0, -0.08, 0, o.colour, true);
    move(lantern, 'turn', 'y', 0.5 + n * 0.1);
  }
  // A string of small lanterns between the first trees.
  if (tier >= 2)
    for (let k = 1; k < 5; k++) {
      const [ax, az, ah] = ORCHARD_TREES[0],
        [bx, bz, bh] = ORCHARD_TREES[2];
      const t = k / 5;
      d.ball(
        g,
        ax + (bx - ax) * t,
        FLOOR + ah + (bh - ah) * t - 0.2 - Math.sin(t * Math.PI) * 0.3,
        az + (bz - az) * t,
        0.09,
        LANTERN,
        'rock',
      );
    }
  if (tier >= 4) {
    // A picking ladder and a full basket under the first tree.
    const ladder = d.group(g, -2.9, FLOOR, -0.7);
    ladder.rotation.x = 0.25;
    for (const x of [-0.2, 0.2]) d.rod(ladder, [x, 0, 0], [x, 1.6, 0], 0.035, TIMBER);
    for (let k = 1; k < 4; k++) d.box(ladder, 0.4, 0.04, 0.05, 0, k * 0.4, 0, TIMBER);
    d.mesh(g, 'cylinder', [0.3, 0.25, 0.3], [-1.4, FLOOR + 0.25, -2.6], TIMBER);
    for (const dx of [-0.1, 0.1]) d.ball(g, -1.4 + dx, FLOOR + 0.42, -2.6, 0.1, '#e98a4a', 'rock');
  }
  if (tier >= 5) {
    // A lantern arch over the gate.
    for (const x of [-0.1, 2.1]) d.rod(g, [x, FLOOR, 3.1], [x, FLOOR + 2.6, 3.1], 0.06, TIMBER);
    d.box(g, 2.4, 0.12, 0.12, 1, FLOOR + 2.65, 3.1, TIMBER);
    for (const x of [0.3, 1, 1.7]) {
      const lantern = d.box(g, 0.2, 0.26, 0.2, x, FLOOR + 2.4, 3.1, LANTERN, true);
      move(lantern, 'turn', 'y', 0.7);
    }
  }
}
// One great old tree with a ring of benches, its crown filling out at each stage.
function buildStoryTree(d, g, o, tier, move) {
  gladeLawn(d, g, '#86a85a');
  const trunk = 0.45 + tier * 0.05,
    height = 2.4 + tier * 0.3;
  d.mesh(g, 'cylinder', [trunk, height, trunk], [0, FLOOR + height / 2, -0.6], TIMBER);
  // Roots spread over the lawn.
  for (let n = 0; n < 5; n++) {
    const a = (n * Math.PI * 2) / 5 + 0.4;
    d.rod(
      g,
      [0, FLOOR + 0.35, -0.6],
      [Math.cos(a) * 1.2, FLOOR + 0.1, -0.6 + Math.sin(a) * 1.2],
      0.12,
      TIMBER,
    );
  }
  const crowns = [
    [0, 0, 0, 1.9],
    [-1.3, -0.4, -0.3, 1.3],
    [1.3, -0.3, -0.2, 1.35],
    [0, 0.6, -1.2, 1.2],
    [0.2, 0.5, 0.8, 1.15],
  ].slice(0, 1 + tier);
  for (const [n, [x, y, z, r]] of crowns.entries())
    move(
      d.ball(
        g,
        x,
        FLOOR + height + y + 0.5,
        -0.6 + z,
        [r, r * 0.75, r],
        n % 2 ? o.colour : LEAF,
        'rock',
      ),
      'pulse',
      'y',
      0.35,
      0.025,
      n,
    );
  if (tier >= 2)
    // A ring of benches round the trunk, open toward the front.
    for (let n = 0; n < 5; n++) {
      const a = Math.PI / 2 + 0.7 + (n * (Math.PI * 2 - 1.4)) / 4;
      const bench = d.group(g, Math.cos(a) * 2.1, 0, -0.6 + Math.sin(a) * 2.1);
      bench.rotation.y = -a + Math.PI / 2;
      d.box(bench, 1, 0.1, 0.36, 0, FLOOR + 0.42, 0, TIMBER);
      for (const x of [-0.4, 0.4]) d.box(bench, 0.08, 0.4, 0.3, x, FLOOR + 0.2, 0, SLATE);
    }
  if (tier >= 3) {
    // A swing from the lowest bough.
    const swing = d.group(g, 1.2, FLOOR + height - 0.1, 0.3);
    for (const x of [-0.25, 0.25]) d.rod(swing, [x, 0, 0], [x, -1.5, 0], 0.015, SLATE);
    d.box(swing, 0.65, 0.06, 0.25, 0, -1.5, 0, TIMBER);
    move(swing, 'lift', 'z', 0.9, 0.1);
  }
  if (tier >= 4) {
    // The storyteller's stump and a lantern for evening tales.
    d.mesh(g, 'cylinder', [0.4, 0.5, 0.4], [-0.9, FLOOR + 0.25, 1.1], TIMBER);
    d.rod(g, [-1.5, FLOOR, 1.2], [-1.5, FLOOR + 1.3, 1.2], 0.04, SLATE);
    d.box(g, 0.22, 0.28, 0.22, -1.5, FLOOR + 1.4, 1.2, LANTERN, true);
  }
  if (tier >= 5)
    // Golden leaves among the crown, turning in the light.
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3;
      const leaf = d.ball(
        g,
        Math.cos(a) * 1.6,
        FLOOR + height + 0.6 + (n % 2) * 0.5,
        -0.6 + Math.sin(a) * 1.4,
        [0.22, 0.08, 0.16],
        GOLD,
        'rock',
      );
      move(leaf, 'turn', 'y', 0.4 + n * 0.05);
    }
}
// Where residents use each finished valley commission, in site coordinates with +z the
// front (TownCommissionResidents): `door` is the threshold they step through, `audience`
// the radius of the arc they gather on and `yard` the loop they wander, inside a `lawn`
// raised above the pedestal. The court's fountain stands at [0, 4.8] from stage 3, so
// walkers come in to its right (`lane`). An unknown form gathers at the front instead.
export const VALLEY_COMMISSION_GROUNDS = Object.freeze({
  lane: 1.6,
  floor: FLOOR,
  'story-hall': Object.freeze({ door: [0, 1.75] }),
  bandstand: Object.freeze({ audience: 3.6 }),
  'wild-meadow': Object.freeze({
    lawn: 3.9,
    gate: [1, 3.3],
    yard: Object.freeze([
      [1.2, 2],
      [1.3, 0.6],
      [0.9, -0.8],
      [-0.6, -0.7],
      [-0.1, 0.5],
      [0.4, 1.9],
    ]),
  }),
  // Between the grove's beds, then behind them and back down the far aisle.
  'seedling-grove': Object.freeze({
    lawn: 3.9,
    gate: [1, 3.3],
    yard: Object.freeze([
      [1.1, 2.6],
      [1.5, 0.6],
      [1.4, -1.4],
      [0.4, -2.5],
      [-1.75, -2.5],
      [-1.75, 1.9],
      [0.2, 2.5],
    ]),
  }),
  // Round the orchard's trees, under the lanterns.
  'lantern-orchard': Object.freeze({
    lawn: 3.9,
    gate: [1, 3.3],
    yard: Object.freeze([
      [1.2, 2.4],
      [1, 0.4],
      [0.1, -1.3],
      [-1.1, -0.4],
      [-1, 1.2],
      [0.3, 2],
    ]),
  }),
  // An audience before the story tree, outside its ring of benches.
  'story-tree': Object.freeze({ lawn: 3.9, audience: 3.6 }),
});
const BUILDERS = {
  'story-hall': buildStoryHall,
  bandstand: buildBandstand,
  'wild-meadow': buildMeadow,
  'seedling-grove': buildSeedlingGrove,
  'lantern-orchard': buildLanternOrchard,
  'story-tree': buildStoryTree,
};
export function buildValleyCommission(d, g, option, tier, move) {
  BUILDERS[option.form](d, g, option, tier, move);
}
