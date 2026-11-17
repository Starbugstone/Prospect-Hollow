import { CylinderGeometry, TorusGeometry } from 'three';
import { futureShape } from '../buildings/futureShapes';

// Hollowborn Square, New Hollow Rising's moonstone site on the outer ring: three keepsakes for
// the first children born under Earthlight, carved from moon rock and set with moonstones.
// Each design keeps one silhouette from the usual map camera at every level: a grove of
// silver trees, one slender bell tower, a round carousel under a pointed canopy.
const ROCK = '#aaa79f',
  SHELL = '#e5e8e7',
  STEEL = '#657481',
  GOLD = '#eacb80',
  CRYSTAL = '#a6cfdf',
  VIOLET = '#b8a4d8';
export const HOLLOWBORN_LANDMARK_FORMS = ['silverbough-grove', 'first-bell', 'moonstone-carousel'];
const TAU = Math.PI * 2;
// The top of the square's shared octagonal deck, where every design stands. It sits just
// above the public path's head, so the path tucks under the deck's back edge.
const DECK = 0.3;

// The square is small and seen from afar, so it draws with lean parts: six-sided open rods,
// faceted stones, low hoops and eight-sided peaks keep every level within the budget.
function rod(d, g, a, b, radius, colour) {
  const mesh = d.rod(g, a, b, radius, colour);
  mesh.geometry = d.geometries['hollowborn-rod'] ??= new CylinderGeometry(1, 1, 1, 6, 1, true);
  return mesh;
}
/** A flat hoop of radius 1 about +z, like the shared ring, with fewer facets. */
function hoop(d) {
  d.geometries['hollowborn-hoop'] ??= new TorusGeometry(1, 0.13, 3, 16);
  return 'hollowborn-hoop';
}
// A pointed roof: an eight-sided peak standing on `y`.
function peak(d, g, radius, height, y, colour) {
  return d.mesh(g, futureShape(d, 'peak'), [radius, height, radius], [0, y, 0], colour);
}

/** An octagonal slab, a corner toward the front like every Moon parcel. */
function octagon(d, g, radius, height, y, colour) {
  return d.mesh(g, futureShape(d, 'octagon'), [radius, height, radius], [0, y, 0], colour);
}
function crystal(d, g, x, y, z, width, height, colour) {
  return d.ball(g, x, y, z, [width, height, width], colour, 'rock');
}
function lamp(d, g, x, z, height, colour) {
  rod(d, g, [x, DECK, z], [x, DECK + height, z], 0.05, STEEL);
  return crystal(d, g, x, DECK + height + 0.14, z, 0.13, 0.2, colour);
}
// Low lamps round the deck's edge, the front left open for whoever walks up.
function lampRing(d, g, radius, height, colour, count = 8) {
  for (let n = 0; n < count; n++) {
    const a = (n + 0.5) * (TAU / count);
    if (Math.cos(a) > 0.8) continue;
    lamp(d, g, Math.sin(a) * radius, Math.cos(a) * radius, height, colour);
  }
}
function bench(d, g, x, z, turn) {
  const seat = d.group(g, x, DECK, z);
  seat.rotation.y = turn;
  d.box(seat, 1.5, 0.12, 0.42, 0, 0.42, 0, SHELL);
  for (const side of [-0.55, 0.55]) d.box(seat, 0.16, 0.38, 0.36, side, 0.19, 0, ROCK);
  return seat;
}

// One silver tree: a trunk of moon-white stone, boughs fanning up and out, a moonstone
// fruit at the end of each. Returns the fruit, so later levels can make it glint.
function silverTree(d, g, x, z, height, boughs, colour, turn = 0) {
  const top = [x, DECK + height, z];
  rod(d, g, [x, DECK, z], top, 0.16 + height * 0.025, SHELL);
  d.mesh(g, futureShape(d, 'octagon'), [0.55, 0.3, 0.55], [x, DECK + 0.15, z], ROCK);
  const fruit = [];
  for (let n = 0; n < boughs; n++) {
    const a = turn + (n * TAU) / boughs,
      reach = height * 0.42,
      fork = [x, DECK + height * 0.62, z],
      tip = [x + Math.sin(a) * reach, DECK + height * 0.92, z + Math.cos(a) * reach];
    rod(d, g, fork, tip, 0.07, SHELL);
    // A twig up from each bough, then the fruit hanging under the tip.
    rod(d, g, tip, [tip[0] * 0.9 + x * 0.1, tip[1] + 0.5, tip[2] * 0.9 + z * 0.1], 0.04, SHELL);
    fruit.push(crystal(d, g, tip[0], tip[1] - 0.28, tip[2], 0.2, 0.3, n % 2 ? VIOLET : colour));
  }
  // A tuft of pale leaves at the top: three small faceted stones.
  for (let n = 0; n < 3; n++) {
    const a = turn + (n * TAU) / 3;
    crystal(
      d,
      g,
      x + Math.sin(a) * height * 0.07,
      DECK + height * (1.02 + n * 0.03),
      z + Math.cos(a) * height * 0.07,
      height * 0.08,
      height * 0.07,
      SHELL,
    );
  }
  return fruit;
}
// A grove of silver trees. One elder tree to start; its saplings, a lit walk, an arbour
// over the way in and finally a turning crown of fruit join it level by level.
function silverboughGrove(d, g, tier, move, colour) {
  octagon(d, g, 2.1, 0.36, DECK + 0.18, ROCK);
  octagon(d, g, 1.85, 0.05, DECK + 0.38, CRYSTAL);
  const elder = tier >= 5 ? 6.4 : 4.4 + tier * 0.3;
  const fruit = silverTree(d, g, 0, -0.2, elder, tier >= 3 ? 6 : 4, colour, 0.4);
  if (tier >= 2)
    for (const side of [-1, 1])
      fruit.push(...silverTree(d, g, side * 2.9, -1.7, 3.1, 3, colour, side));
  if (tier >= 3) {
    // The fruit glints, one after another, and two benches face the elder tree.
    fruit.forEach((stone, n) => move(stone, 'pulse', 'y', 0.9, 0.14, n * 0.9));
    for (const side of [-1, 1]) bench(d, g, side * 2.6, 1.9, side * 0.9);
    lampRing(d, g, 4.4, 0.6, CRYSTAL);
  }
  if (tier >= 4) {
    // Two more saplings behind, and an arbour of silver boughs over the way in.
    for (const side of [-1, 1]) silverTree(d, g, side * 1.6, -3.5, 2.5, 3, colour, -side);
    for (const side of [-1, 1]) {
      rod(d, g, [side * 1.3, DECK, 3.6], [side * 1.3, DECK + 2.6, 3.6], 0.1, SHELL);
      crystal(d, g, side * 1.3, DECK + 0.3, 3.6, 0.3, 0.3, ROCK);
    }
    let last = null;
    for (let n = 0; n <= 8; n++) {
      const a = (n * Math.PI) / 8,
        point = [-Math.cos(a) * 1.3, DECK + 2.6 + Math.sin(a) * 0.8, 3.6];
      if (last) rod(d, g, last, point, 0.07, SHELL);
      if (n % 2) crystal(d, g, point[0], point[1] - 0.3, 3.6, 0.13, 0.2, VIOLET);
      last = point;
    }
  }
  if (tier >= 5) {
    // The elder tree's crown: a ring of moonstone fruit turning slowly above it.
    const crown = d.group(g, 0, DECK + elder + 0.9, -0.2);
    crown.name = 'Silverbough crown';
    for (let n = 0; n < 8; n++) {
      const a = (n * TAU) / 8;
      crystal(d, crown, Math.sin(a) * 1.4, 0, Math.cos(a) * 1.4, 0.18, 0.28, n % 2 ? VIOLET : GOLD);
    }
    d.mesh(crown, hoop(d), [1.4, 1.4, 0.4], [0, 0, 0], GOLD).rotation.x = Math.PI / 2;
    move(crown, 'turn', 'y', 0.12);
    for (const side of [-1, 1]) crystal(d, g, side * 3.9, DECK + 0.6, 2.9, 0.35, 0.6, colour);
  }
}

// A slender bell tower for the crater school's first morning. A bell in a plain frame
// first; then the tower, its swinging bell and an Earth-phase dial, two little porches and
// finally a moonstone spire.
function firstBell(d, g, tier, move, colour) {
  octagon(d, g, 1.9, 0.4, DECK + 0.2, ROCK);
  const floor = DECK + 0.4;
  const belfry = tier >= 2 ? floor + 3.4 + (tier >= 5 ? 0.3 : 0) : floor + 2.4;
  if (tier >= 2) {
    // The tower: an octagonal shaft of moon rock with a moon-white band at each storey.
    const shaft = belfry - floor;
    d.mesh(g, futureShape(d, 'octagon'), [1.05, shaft, 1.05], [0, floor + shaft / 2, 0], ROCK);
    for (const y of [floor + 0.05, floor + shaft * 0.5, belfry - 0.05])
      d.mesh(g, futureShape(d, 'octagon'), [1.15, 0.14, 1.15], [0, y, 0], SHELL);
    // A round door at the foot, facing the square.
    d.box(g, 0.7, 1.1, 0.1, 0, floor + 0.55, 0.98, STEEL);
    d.mesh(g, 'cylinder', [0.35, 0.1, 0.35], [0, floor + 1.1, 0.98], STEEL).rotation.x =
      Math.PI / 2;
  }
  // The belfry: four posts and a cap, open so the bell shows from every side.
  const posts = tier >= 2 ? 0.85 : 1.1;
  for (const x of [-posts, posts])
    for (const z of tier >= 2 ? [-posts, posts] : [0])
      rod(d, g, [x, tier >= 2 ? belfry : floor, z], [x, belfry + 1.9, z], 0.1, SHELL);
  d.box(g, posts * 2 + 0.5, 0.2, tier >= 2 ? posts * 2 + 0.5 : 0.5, 0, belfry + 1.95, 0, SHELL);
  if (tier >= 2) peak(d, g, 1.45, 1.6, belfry + 2.05, tier >= 5 ? colour : VIOLET);
  // The bell: a moonstone cone hung from a gold yoke. It swings from level 3.
  const hanger = d.group(g, 0, belfry + 1.8, 0);
  hanger.name = 'First bell';
  rod(d, hanger, [0, 0, 0], [0, -0.35, 0], 0.05, GOLD);
  d.mesh(hanger, 'cone', [0.62, 0.9, 0.62], [0, -0.75, 0], colour);
  d.mesh(hanger, 'cylinder', [0.64, 0.08, 0.64], [0, -1.2, 0], GOLD);
  d.ball(hanger, 0, -1.3, 0, 0.12, STEEL, 'rock');
  if (tier >= 3) {
    move(hanger, 'swing', 'z', 1.6, 0.22);
    // A dial of Earth's phases on the front of the tower, and a lit walk round its foot.
    const dial = d.group(g, 0, belfry - 0.95, 1.06);
    dial.name = 'Earth-phase dial';
    d.mesh(dial, 'cylinder', [0.62, 0.08, 0.62], [0, 0, 0], SHELL).rotation.x = Math.PI / 2;
    d.mesh(dial, hoop(d), [0.66, 0.66, 0.6], [0, 0, 0.04], GOLD);
    for (let n = 0; n < 4; n++) {
      const a = (n * TAU) / 4;
      d.ball(dial, Math.sin(a) * 0.42, Math.cos(a) * 0.42, 0.06, 0.09, n ? CRYSTAL : GOLD, 'rock');
    }
    lampRing(d, g, 4.55, 0.7, CRYSTAL);
  }
  if (tier >= 4)
    // Two little porches where children wait for the bell, roofed in moonstone.
    for (const side of [-1, 1]) {
      const porch = d.group(g, side * 2.9, 0, 0.6);
      porch.name = 'Bell porch';
      octagon(d, porch, 1.1, 0.2, DECK + 0.1, SHELL);
      for (const z of [-0.6, 0.6])
        rod(d, porch, [-side * 0.6, DECK, z], [-side * 0.6, DECK + 1.5, z], 0.06, SHELL);
      peak(d, porch, 1.2, 0.9, DECK + 1.5, VIOLET);
      rod(d, porch, [0.4 * side, DECK, 0], [0.4 * side, DECK + 1.5, 0], 0.09, ROCK);
      bench(d, porch, 0, 0, Math.PI / 2);
    }
  if (tier >= 5) {
    // The spire: a long moonstone point above the roof, gold-tipped.
    crystal(d, g, 0, belfry + 4.3, 0, 0.36, 1.05, colour);
    d.ball(g, 0, belfry + 5.45, 0, 0.14, GOLD, 'rock');
    for (const side of [-1, 1]) crystal(d, g, side * 1.6, DECK + 0.6, 3.6, 0.3, 0.55, CRYSTAL);
  }
}

// One carousel seat: a little rover with round moonstone wheels, or a comet with a tail.
function rover(d, g, colour) {
  d.box(g, 0.5, 0.32, 0.8, 0, 0.36, 0, SHELL, true);
  d.box(g, 0.4, 0.2, 0.34, 0, 0.6, -0.1, colour);
  for (const x of [-0.3, 0.3])
    for (const z of [-0.28, 0.28]) d.ball(g, x, 0.18, z, 0.13, STEEL, 'rock');
}
function comet(d, g, colour) {
  crystal(d, g, 0, 0.5, 0.2, 0.32, 0.32, colour);
  for (const x of [-0.14, 0, 0.14]) rod(d, g, [x, 0.5, 0.15], [x * 2.5, 0.5, -0.65], 0.05, GOLD);
}
// A slow carousel for the youngest settlers. The turning deck and its rovers come first;
// then a pointed canopy, the motion itself, comets and a fence, and a crown of moonstones.
function moonstoneCarousel(d, g, tier, move, colour) {
  const floor = DECK + 0.25;
  octagon(d, g, 3.4, 0.25, DECK + 0.12, ROCK);
  const rotor = d.group(g, 0, floor, 0);
  rotor.name = 'Carousel deck';
  d.mesh(rotor, 'cylinder', [3, 0.2, 3], [0, 0.1, 0], SHELL);
  d.mesh(rotor, 'cylinder', [3.06, 0.07, 3.06], [0, 0.16, 0], GOLD);
  const height = tier >= 2 ? 3.4 : 2.4;
  rod(d, rotor, [0, 0.2, 0], [0, height + 0.3, 0], 0.18, GOLD);
  const seats = tier >= 4 ? 8 : 4;
  for (let n = 0; n < seats; n++) {
    const a = (n * TAU) / seats,
      x = Math.sin(a) * 2.2,
      z = Math.cos(a) * 2.2;
    // Each seat hangs from the canopy (or a short post) and bobs as the deck turns.
    rod(d, rotor, [x, 0.2, z], [x, height, z], 0.04, STEEL);
    const seat = d.group(rotor, x, 0.2, z);
    seat.rotation.y = a + Math.PI / 2;
    if (n % 2 && tier >= 4) comet(d, seat, VIOLET);
    else rover(d, seat, colour);
    if (tier >= 3) move(seat, 'lift', 'y', 1.4, 0.18, n * 0.8);
  }
  if (tier >= 2) {
    // The canopy: a moonstone cone over a moon-white drum hung with a gold valance.
    d.mesh(rotor, 'cylinder', [3.1, 0.35, 3.1], [0, height + 0.15, 0], SHELL);
    d.mesh(rotor, 'cylinder', [3.14, 0.1, 3.14], [0, height - 0.05, 0], GOLD);
    peak(d, rotor, 3.3, 1.8, height + 0.3, colour);
    d.ball(rotor, 0, height + 2.1, 0, 0.22, GOLD, 'rock');
  }
  if (tier >= 3) {
    // The ride turns, and moonstone lamps light the way round it.
    move(rotor, 'turn', 'y', 0.25);
    lampRing(d, g, 4.6, 0.55, CRYSTAL);
  }
  if (tier >= 4) {
    // A low fence round the ride, open at the front where children queue and at the back
    // where the public path arrives.
    for (let n = 0; n < 12; n++) {
      const a = (n * TAU) / 12,
        b = ((n + 1) * TAU) / 12;
      if ([0, 5, 6, 11].includes(n)) continue;
      rod(
        d,
        g,
        [Math.sin(a) * 4.3, DECK + 0.6, Math.cos(a) * 4.3],
        [Math.sin(b) * 4.3, DECK + 0.6, Math.cos(b) * 4.3],
        0.05,
        SHELL,
      );
      rod(
        d,
        g,
        [Math.sin(b) * 4.3, DECK, Math.cos(b) * 4.3],
        [Math.sin(b) * 4.3, DECK + 0.65, Math.cos(b) * 4.3],
        0.06,
        STEEL,
      );
    }
  }
  if (tier >= 5) {
    // The crown: moonstones round the canopy's peak and a tall faceted finial.
    const crown = d.group(rotor, 0, height + 2.25, 0);
    crown.name = 'Carousel crown';
    for (let n = 0; n < 6; n++) {
      const a = (n * TAU) / 6;
      crystal(d, crown, Math.sin(a) * 0.55, 0, Math.cos(a) * 0.55, 0.16, 0.3, VIOLET);
    }
    crystal(d, crown, 0, 0.7, 0, 0.26, 0.9, CRYSTAL);
    lampRing(d, g, 3.9, 1.3, GOLD, 6);
  }
}

/** Build one of Hollowborn Square's designs at `tier` (1 to 5) on the square's own deck. */
export function buildHollowbornLandmark(d, g, option, tier, move) {
  // The deck every design shares: a moon-rock octagon with a moon-white inlay. Its front
  // corner faces the usual camera, where visitors stand to look at the keepsake.
  octagon(d, g, 4.9, DECK, DECK / 2, ROCK);
  octagon(d, g, 4.55, 0.04, DECK + 0.01, SHELL);
  d.group(g, 0, 0, 4.8).name = 'Monument entrance';
  if (option.form === 'silverbough-grove') silverboughGrove(d, g, tier, move, option.colour);
  else if (option.form === 'first-bell') firstBell(d, g, tier, move, option.colour);
  else moonstoneCarousel(d, g, tier, move, option.colour);
}
