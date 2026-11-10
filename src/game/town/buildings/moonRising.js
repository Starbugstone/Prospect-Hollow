import { BufferGeometry, Float32BufferAttribute } from 'three';
import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { futureShape } from './futureShapes';
import {
  airlock,
  dome,
  habitatGlass,
  habitatRim,
  lamp,
  module,
  moonRover,
  vaultArch,
  vaultFrame,
  willowkinTree,
} from './moonKit';

// New Hollow Rising: the outer ring's buildings. They use the same lunar kit as the first
// lots, and add what a settled town has: glazed streets and vaults, warm lit windows,
// planters, awnings, benches and lanterns. Every form keeps its hatch and its public path
// (MOON_LOT_TABLE) clear at every level, and uses at most eight materials.
const TAU = Math.PI * 2;
export const GROUND = 0.25;

/** A group turned about its own place, so a part can face any way on its pad. */
export function turned(d, g, x, z, turn) {
  const group = d.group(g, x, 0, z);
  group.rotation.y = turn;
  return group;
}
/** A glazed vault along x on a ceramic kerb: the era's glass streets, orchards and wings. */
export function glassVault(d, g, x, z, length, { half = 0.9, height = 0.95 } = {}) {
  d.box(g, length, 0.3, half * 2, x, 0.4, z, p.shell);
  habitatGlass(
    d,
    d.mesh(g, futureShape(d, 'dome'), [length / 2, height, half], [x, 0.55, z], p.glass),
  );
  vaultFrame(d, g, x, z, length, { half, height });
}
/**
 * A glazed canopy along x on a gold-foil frame, its posts along the back edge: the cover of
 * a tram platform.
 */
export function platformCanopy(d, g, x, z, length, { posts, foot = GROUND, depth = 1.4 } = {}) {
  const canopy = d.group(g, x, 0, z);
  canopy.name = 'Tram platform canopy';
  for (const px of posts) d.rod(canopy, [px, foot, -0.35], [px, 2.02, -0.35], 0.05, p.deep);
  for (const side of [-1, 1]) {
    d.box(canopy, length, 0.1, 0.12, 0, 2.05, (side * depth) / 2, p.light).name =
      'Tram canopy gold edge';
    d.box(canopy, 0.12, 0.1, depth, (side * (length - 0.12)) / 2, 2.05, 0, p.light);
  }
  habitatGlass(
    d,
    d.mesh(
      canopy,
      futureShape(d, 'dome'),
      [length / 2 - 0.1, 0.5, depth / 2],
      [0, 2.08, 0],
      p.glass,
    ),
  );
  return canopy;
}
/** An orchard tree small enough to stand under glass. */
export function orchardTree(d, g, x, z, scale = 1, blossom = false) {
  d.rod(g, [x, 0.55, z], [x, 0.55 + 0.55 * scale, z], 0.06 * scale, p.timber);
  d.ball(
    g,
    x,
    0.55 + 0.75 * scale,
    z,
    [0.4 * scale, 0.34 * scale, 0.4 * scale],
    p.green,
    futureShape(d, 'leafy'),
  );
  if (blossom)
    d.ball(g, x + 0.2 * scale, 0.55 + 0.95 * scale, z + 0.2 * scale, 0.08, p.flower, 'rock');
}
/** A timber planter with a clipped shrub. */
export function planter(d, g, x, z, scale = 1) {
  d.box(g, 0.7 * scale, 0.3, 0.7 * scale, x, GROUND + 0.15, z, p.timber);
  d.ball(
    g,
    x,
    GROUND + 0.55,
    z,
    [0.36 * scale, 0.32, 0.36 * scale],
    p.green,
    futureShape(d, 'leafy'),
  );
}
/** A round window with a gold rim, facing `turn`. */
function porthole(d, g, x, y, z, turn = 0, scale = 1, color = p.glass) {
  const window = d.group(g, x, y, z);
  window.rotation.y = turn;
  window.scale.setScalar(scale);
  d.mesh(window, futureShape(d, 'octagon'), [0.3, 0.08, 0.3], [0, 0, 0], color).rotation.x =
    Math.PI / 2;
  d.mesh(window, futureShape(d, 'octagon'), [0.37, 0.05, 0.37], [0, 0, -0.03], p.light).rotation.x =
    Math.PI / 2;
}
/** A flag on a mast. */
function pennant(d, g, x, z, height = 2.4) {
  d.rod(g, [x, GROUND, z], [x, height, z], 0.035, p.deep);
  d.mesh(g, futureShape(d, 'pennant'), [0.7, 0.42, 1], [x, height - 0.46, z], p.flower);
}
/** A two-sided parabolic bowl of unit radius, opening upward: a listening dish. */
function dishShape(d) {
  const key = 'moon-dish';
  if (d.geometries[key]) return key;
  const points = [],
    faces = [],
    around = 12,
    rings = 3,
    depth = 0.3;
  for (const side of [0, 1]) {
    const base = points.length;
    for (let ring = 0; ring <= rings; ring++)
      for (let n = 0; n < around; n++) {
        const r = ring / rings,
          a = (n / around) * TAU;
        points.push([Math.sin(a) * r, depth * r * r - side * 0.02, Math.cos(a) * r]);
      }
    for (let ring = 0; ring < rings; ring++)
      for (let n = 0; n < around; n++) {
        const a = base + ring * around + n,
          b = base + ring * around + ((n + 1) % around),
          c = a + around,
          e = b + around;
        faces.push(...(side ? [a, b, c, b, e, c] : [a, c, b, b, c, e]));
      }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute(
      points.flatMap(([x, , z]) => [x, z]),
      2,
    ),
  );
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  d.geometries[key] = geometry;
  return key;
}
/** A dish on its feed struts, tilted back by `tilt` and turned by `turn`. */
function dish(d, g, x, y, z, radius, tilt, turn = 0) {
  const mount = d.group(g, x, y, z);
  mount.rotation.y = turn;
  const bowl = d.group(mount);
  bowl.rotation.x = -tilt;
  d.mesh(bowl, dishShape(d), [radius, radius, radius], [0, 0, 0], p.shell).name = 'Starwatch dish';
  const focus = [0, radius * 0.78, 0];
  for (let n = 0; n < 3; n++) {
    const a = (n * TAU) / 3;
    d.rod(
      bowl,
      [Math.sin(a) * radius * 0.92, radius * 0.27, Math.cos(a) * radius * 0.92],
      focus,
      0.03,
      p.deep,
    );
  }
  d.ball(bowl, ...focus, radius * 0.08, p.light, 'rock');
  return mount;
}
/** One pressurised tram car, along x. */
export function tramCar(d, g, x, z) {
  d.box(g, 1.5, 0.14, 0.6, x, 0.36, z, p.deep);
  d.box(g, 1.8, 0.7, 0.8, x, 0.78, z, p.shell, true);
  d.box(g, 1.5, 0.26, 0.84, x, 0.9, z, p.glass).name = 'Tram windows';
  d.box(g, 1.82, 0.06, 0.82, x, 0.6, z, p.light);
  d.box(g, 1.5, 0.06, 0.6, x, 1.16, z, p.roof);
}
/** A ceramic shed under a barrel roof with a roll-up bay door on its front. */
function shed(d, g, x, z, w, dep, h, open = false) {
  d.box(g, w, h, dep, x, GROUND + h / 2, z, p.shell);
  const roof = d.mesh(g, 'cylinder', [w / 2, dep + 0.2, 0.6], [x, GROUND + h, z], p.roof);
  roof.rotation.x = Math.PI / 2;
  d.box(g, w + 0.06, 0.07, dep + 0.06, x, GROUND + h - 0.03, z, p.light);
  const end = d.mesh(
    g,
    'cylinder',
    [w / 2 - 0.14, 0.06, 0.46],
    [x, GROUND + h, z + dep / 2 + 0.1],
    p.shell,
  );
  end.rotation.x = Math.PI / 2;
  const door = h - 0.45;
  d.box(g, w - 1, door, 0.06, x, GROUND + door / 2, z + dep / 2 + 0.01, p.deep).name =
    'Garage bay door';
  if (!open)
    for (let n = 1; n <= 3; n++)
      d.box(g, w - 1, 0.04, 0.08, x, GROUND + (door * n) / 4, z + dep / 2 + 0.02, p.light);
}
/** A long-range rover: New Hollow's rover with a crate rack and a lamp bar. */
export function expeditionRover(d, g, x, z, turn = 0) {
  const rover = moonRover(d, g, x, z, turn);
  d.box(rover, 0.5, 0.2, 0.42, 0, 0.78, -0.3, p.timber).name = 'Expedition crate rack';
  d.box(rover, 0.26, 0.16, 0.26, -0.08, 0.96, -0.3, p.timber);
  d.box(rover, 0.6, 0.05, 0.05, 0, 0.94, 0.38, p.deep);
  for (const dx of [-0.2, 0.2]) d.ball(rover, dx, 0.94, 0.4, 0.05, p.light, 'rock');
  return rover;
}

export const RISING_FORMS = {
  // The outer road's station: a ticket drum, a glazed platform and a tram at the kerb.
  ringTram(d, g, level) {
    dome(d, g, 0, -2.5, 1.5, 1);
    d.box(g, 6.8, 0.16, 1.1, 0, 0.33, 2.55, p.roof).name = 'Tram platform';
    d.box(g, 6.8, 0.05, 0.14, 0, 0.42, 3.03, p.light);
    platformCanopy(d, g, 0, 2.5, 7, { posts: [-3, -1, 1, 3], foot: 0.41 });
    for (const z of [3.7, 4.2]) d.box(g, 6.6, 0.05, 0.08, 0, 0.275, z, p.deep);
    for (const x of level >= 2 ? [-1.95, 0, 1.95] : [-0.975, 0.975]) tramCar(d, g, x, 3.95);
    if (level >= 2) {
      // A waiting room faces the ticket drum, and the platform gets benches.
      module(d, g, 3.4, -1.6, 1.5, 1.3, 1.1, -Math.PI / 2);
      for (const x of [-2, 2]) d.box(g, 1, 0.14, 0.3, x, 0.52, 2.3, p.timber);
    }
    if (level >= 3) {
      d.rod(g, [-2.9, GROUND, -1.6], [-2.9, 4.2, -1.6], 0.06, p.deep).name = 'Tram clock mast';
      for (const turn of [0, Math.PI / 2]) {
        const face = d.group(g, -2.9, 4.4, -1.6);
        face.rotation.y = turn;
        d.mesh(face, futureShape(d, 'octagon'), [0.4, 0.2, 0.4], [0, 0, 0], p.shell).rotation.x =
          Math.PI / 2;
        d.mesh(face, futureShape(d, 'octagon'), [0.48, 0.12, 0.48], [0, 0, 0], p.light).rotation.x =
          Math.PI / 2;
      }
      for (const x of [1.5, 3.2]) planter(d, g, x, 0.7);
      lamp(d, g, -3.6, -3.4, GROUND);
      lamp(d, g, 3.9, 1.1, GROUND);
    }
  },
  // Water for the new streets: a squat tank ringed with frost pipes under a sight dome.
  dewfallCistern(d, g, level) {
    d.mesh(g, 'cylinder', [1.9, 1.4, 1.9], [0, 0.95, -1], p.shell);
    for (const y of [0.72, 1.12]) d.mesh(g, 'cylinder', [1.95, 0.07, 1.95], [0, y, -1], p.glass);
    d.mesh(g, 'cylinder', [1.93, 0.1, 1.93], [0, 1.5, -1], p.light);
    d.ball(g, 0, 1.68, -1, [0.85, 0.28, 0.85], p.glass).name = 'Cistern water';
    habitatGlass(d, d.mesh(g, futureShape(d, 'dome'), [1.1, 0.75, 1.1], [0, 1.65, -1], p.glass));
    airlock(d, g, 0, 0.65, 0.92);
    // The pump that feeds the street main.
    d.box(g, 0.7, 0.55, 0.6, -2.5, 0.52, 0.5, p.roof);
    d.rod(g, [-2.5, 0.6, 0.5], [-1.6, 0.6, -0.1], 0.07, p.glass);
    d.ball(g, -2.5, 0.9, 0.5, 0.12, p.light, 'rock');
    if (level >= 2) {
      d.mesh(g, 'cylinder', [1.15, 1.1, 1.15], [2.9, 0.8, -0.3], p.shell);
      d.mesh(g, 'cylinder', [1.19, 0.07, 1.19], [2.9, 0.8, -0.3], p.glass);
      d.mesh(g, 'cylinder', [1.18, 0.08, 1.18], [2.9, 1.25, -0.3], p.light);
      d.mesh(g, futureShape(d, 'lowDome'), [1.1, 0.35, 1.1], [2.9, 1.35, -0.3], p.shell);
      d.rod(g, [1.7, 1, -0.6], [2.1, 1, -0.45], 0.08, p.glass);
    }
    if (level >= 3) {
      // Radiator fins shed the works' heat; a fountain gives the street a drink.
      d.box(g, 1.3, 0.08, 1.4, -2.95, 0.3, -1.7, p.deep);
      for (let n = 0; n < 4; n++)
        d.box(g, 0.06, 1.25, 1.3, -2.5 - n * 0.3, 0.95, -1.7, p.roof).name = 'Cistern radiator fin';
      d.mesh(g, 'cylinder', [0.34, 0.55, 0.34], [1.8, 0.52, 2.6], p.shell);
      habitatRim(d, g, 1.8, 0.8, 2.6, 0.42);
      d.ball(g, 1.8, 0.86, 2.6, [0.3, 0.1, 0.3], p.glass).name = 'Drinking fountain';
      lamp(d, g, -1.7, 2.7, GROUND);
    }
  },
  // Willowkin-tended orchards under long glass, their ends toward the road.
  orchardVaults(d, g, level) {
    const row = (x) => {
      const vault = turned(d, g, x, -0.7, Math.PI / 2);
      glassVault(d, vault, 0, 0, 6, { half: 1.05, height: 1.5 });
      d.box(vault, 5.4, 0.04, 1.5, 0, 0.57, 0, p.green);
      [-2, -0.7, 0.7, 2].forEach((tx, n) =>
        orchardTree(d, vault, tx, n % 2 ? 0.22 : -0.22, Math.abs(tx) > 1 ? 0.85 : 1.1, n % 2 === 0),
      );
    };
    row(0);
    row(-2.4);
    module(d, g, 0, 2.85, 1.2, 0.9, 1, 0, p.roof);
    // A Willowkin sapling waits by the hatch under its own glass bell.
    d.mesh(g, 'cylinder', [0.5, 0.2, 0.5], [-1.9, 0.35, 3.3], p.shell);
    willowkinTree(d, g, -1.9, 0.45, 3.3, 0.42);
    habitatGlass(
      d,
      d.mesh(g, futureShape(d, 'dome'), [0.5, 0.95, 0.5], [-1.9, 0.45, 3.3], p.glass),
    );
    if (level >= 2) {
      row(2.4);
      d.box(g, 0.7, 0.4, 0.6, 1.5, 0.45, 3, p.timber).name = 'Orchard fruit crate';
      for (const dx of [-0.15, 0.15]) d.ball(g, 1.5 + dx, 0.7, 3, 0.12, p.flower, 'rock');
    }
    if (level >= 3) {
      dome(d, g, 3.3, 3.25, 0.9, 0.4);
      willowkinTree(d, g, 3.3, 0.3, 3.2, 0.45);
      for (const [dx, dz] of [
        [-0.3, 0.2],
        [0.25, -0.2],
        [0, 0.35],
      ])
        d.ball(g, 3.3 + dx, 1.05, 3.2 + dz, 0.08, p.flower, 'rock');
      for (const x of [-0.9, 0.9]) lamp(d, g, x, 4.7, GROUND);
    }
  },
  // Family homes along a glazed street, one lantern for every door.
  lanternRow(d, g, level) {
    // A ceramic family dome: lighter than the glass habitats, with two lit windows.
    const home = (x, z, turn = 0) => {
      const house = turned(d, g, x, z, turn);
      d.mesh(house, 'cylinder', [0.95, 0.7, 0.95], [0, 0.6, 0], p.shell);
      d.mesh(house, 'cylinder', [0.98, 0.07, 0.98], [0, 0.93, 0], p.light);
      d.mesh(house, futureShape(d, 'dome'), [0.92, 0.8, 0.92], [0, 0.95, 0], p.shell).name =
        'Lantern Row home';
      d.mesh(house, futureShape(d, 'lowDome'), [0.3, 0.16, 0.3], [0, 1.7, 0], p.roof);
      airlock(d, house, 0, 0.65, 0.97);
      for (const side of [-1, 1])
        d.ball(house, side * 0.6, 0.72, 0.72, 0.13, p.light, 'rock').name = 'Home lit window';
    };
    const doors = [-3.15, -1.05, 1.05, 3.15];
    for (const x of doors) home(x, -1.2);
    glassVault(d, g, 0, 0.55, 8.6, { half: 0.75, height: 1.25 });
    module(d, g, 0, 1.75, 1.1, 0.9, 1, 0, p.light);
    for (const x of doors) lamp(d, g, x, 1.75, GROUND);
    if (level >= 2)
      for (const x of [-3, 3]) {
        home(x, 3.1, Math.PI);
        lamp(d, g, x * 0.5, 3.3, GROUND);
      }
    if (level >= 3) {
      d.mesh(g, futureShape(d, 'gable'), [1.4, 0.45, 1.1], [0, 1.25, 1.75], p.flower).name =
        'Lantern Row porch gable';
      for (let n = 0; n < 7; n++) {
        const x = -3.6 + n * 1.2;
        d.ball(
          g,
          x,
          0.66 + 1.25 * Math.sqrt(1 - (x / 4.3) ** 2),
          0.55,
          0.09,
          p.light,
          'rock',
        ).name = 'Arcade lantern';
      }
      for (const x of [-1.3, 1.3]) planter(d, g, x, 4.2, 0.9);
    }
  },
  // Stalls for crater produce in an eight-sided glass hall under a gold-foil tent.
  ringMarket(d, g, level) {
    const hall = turned(d, g, 0, -0.7, Math.PI / 8);
    const octagon = futureShape(d, 'octagon');
    d.mesh(hall, octagon, [2.6, 0.5, 2.6], [0, 0.5, 0], p.shell);
    habitatGlass(d, d.mesh(hall, octagon, [2.5, 1.3, 2.5], [0, 1.4, 0], p.glass));
    for (let n = 0; n < 8; n++) {
      const a = (n * TAU) / 8;
      d.rod(
        hall,
        [Math.sin(a) * 2.58, GROUND, Math.cos(a) * 2.58],
        [Math.sin(a) * 2.58, 2.1, Math.cos(a) * 2.58],
        0.05,
        p.deep,
      );
    }
    d.mesh(hall, octagon, [2.85, 0.1, 2.85], [0, 2.1, 0], p.light);
    d.mesh(hall, futureShape(d, 'peak'), [3, 0.7, 3], [0, 2.15, 0], p.light).name =
      'Market gold-foil canopy';
    d.mesh(hall, futureShape(d, 'peak'), [1.5, 0.8, 1.5], [0, 2.6, 0], p.shell);
    airlock(d, g, 0, 0.65, 1.72);
    // Produce on the counters inside.
    d.box(g, 1.6, 0.5, 0.6, 0, 1, -0.7, p.timber);
    [p.green, p.flower, p.green].forEach((color, n) =>
      d.ball(g, -0.5 + n * 0.5, 1.36, -0.7, 0.16, color, 'rock'),
    );
    for (const x of [-1.4, 1.4]) {
      d.box(g, 0.6, 0.45, 0.6, x, 0.97, -1.6, p.timber);
      d.ball(g, x, 1.3, -1.6, 0.15, x < 0 ? p.flower : p.green, 'rock');
    }
    d.box(g, 0.7, 0.5, 0.7, 2.7, 0.5, 2.3, p.timber);
    d.box(g, 0.45, 0.35, 0.45, 2.75, 0.92, 2.3, p.timber);
    if (level >= 2)
      for (const side of [-1, 1]) {
        // A side stall under a striped awning.
        const stall = turned(d, g, side * 3.5, 1.4, side * -0.5);
        d.box(stall, 1.4, 0.55, 0.6, 0, 0.52, 0, p.timber);
        for (const x of [-0.65, 0.65])
          d.rod(stall, [x, GROUND, -0.28], [x, 1.7, -0.28], 0.035, p.deep);
        for (let n = 0; n < 4; n++) {
          const stripe = d.box(
            stall,
            0.375,
            0.05,
            0.95,
            -0.56 + n * 0.375,
            1.55,
            0.1,
            n % 2 ? p.shell : p.flower,
          );
          stripe.rotation.x = 0.35;
          stripe.name = 'Market awning stripe';
        }
        for (const x of [-0.35, 0.05, 0.4])
          d.ball(stall, x, 0.9, 0, 0.13, x > 0 ? p.flower : p.green, 'rock');
      }
    if (level >= 3) {
      d.rod(hall, [0, 3.3, 0], [0, 4.3, 0], 0.04, p.deep).name = 'Market beacon mast';
      d.ball(hall, 0, 4.4, 0, 0.16, p.light, 'rock');
      d.mesh(g, futureShape(d, 'pennant'), [0.6, 0.36, 1], [0, 3.6, -0.7], p.flower);
      for (let n = 0; n < 8; n++) {
        const a = (n * TAU) / 8;
        d.ball(hall, Math.sin(a) * 2.8, 1.92, Math.cos(a) * 2.8, 0.1, p.light, 'rock').name =
          'Market eave lantern';
      }
      d.box(g, 1.4, 0.14, 0.35, -2.2, 0.42, 3.3, p.timber);
    }
  },
  // The first Moon-born class: a porthole classroom, a bell and hop-scotch on the pad.
  craterSchool(d, g, level) {
    const classroom = (x, z, r, h) => {
      d.mesh(g, 'cylinder', [r, h, r], [x, GROUND + h / 2, z], p.shell);
      d.mesh(g, 'cylinder', [r + 0.03, 0.08, r + 0.03], [x, 0.45, z], p.light);
      d.mesh(g, futureShape(d, 'dome'), [r + 0.08, r * 0.35, r + 0.08], [x, GROUND + h, z], p.roof);
      for (const degrees of [-148, -106, -64, -32, 32, 64, 106, 148]) {
        const a = (degrees * Math.PI) / 180;
        porthole(
          d,
          g,
          x + Math.sin(a) * (r + 0.01),
          GROUND + h * 0.62,
          z + Math.cos(a) * (r + 0.01),
          a,
        );
      }
      airlock(d, g, x, 0.65, z + r + 0.02);
    };
    classroom(0, -1.5, 1.9, 1.5);
    // The school bell on its short mast.
    d.rod(g, [1.9, GROUND, 1.3], [1.9, 2.3, 1.3], 0.045, p.deep);
    d.rod(g, [1.95, 2.2, 1.3], [1.4, 2.2, 1.3], 0.03, p.deep);
    d.mesh(g, 'cone', [0.3, 0.4, 0.3], [1.4, 1.95, 1.3], p.light).name = 'School bell';
    d.ball(g, 1.4, 1.7, 1.3, 0.07, p.deep, 'rock');
    // Hop-scotch painted on the pad.
    const squares = [
      [0, 1.3],
      [0, 1.75],
      [-0.22, 2.2],
      [0.22, 2.2],
      [0, 2.65],
      [-0.22, 3.1],
      [0.22, 3.1],
      [0, 3.55],
    ];
    squares.forEach(([dx, z], n) => {
      d.box(g, 0.4, 0.02, 0.4, -1.5 + dx, 0.272, z, [p.flower, p.light, p.glass][n % 3]).name =
        'Hop-scotch square';
    });
    if (level >= 2) {
      classroom(3.25, -0.9, 1.35, 1.2);
      d.box(g, 0.9, 0.2, 0.7, 1.95, 0.35, -1.15, p.shell);
      habitatGlass(d, d.box(g, 0.9, 0.7, 0.7, 1.95, 0.8, -1.15, p.glass));
      d.box(g, 1.4, 0.14, 0.35, 2.3, 0.42, 3.1, p.timber);
    }
    if (level >= 3) {
      // A small planetarium, its dome dotted with stars.
      d.mesh(g, 'cylinder', [1.25, 0.6, 1.25], [-3.1, 0.55, 0.2], p.shell);
      d.mesh(g, 'cylinder', [1.29, 0.08, 1.29], [-3.1, 0.83, 0.2], p.light);
      d.mesh(g, futureShape(d, 'dome'), [1.25, 1.1, 1.25], [-3.1, 0.85, 0.2], p.roof).name =
        'Planetarium dome';
      for (let n = 0; n < 7; n++) {
        const a = n * 2.4,
          lift = 0.35 + (n % 3) * 0.25,
          r = 1.27 * Math.sqrt(1 - lift * lift);
        d.ball(
          g,
          -3.1 + Math.sin(a) * r,
          0.85 + lift * 1.12,
          0.2 + Math.cos(a) * r,
          0.06,
          p.light,
          'rock',
        );
      }
      airlock(d, g, -3.1, 0.65, 1.47, 0, 0.8);
      pennant(d, g, 2.7, 1.6, 2.7);
      lamp(d, g, -1.1, 4, GROUND);
    }
  },
  // Stepped homes whose glass fronts and balconies look toward Earth (local -z).
  earthviewTerraces(d, g, level) {
    const tier = (w, h, z, dep = 1.3) => {
      const top = GROUND + h,
        front = z - dep / 2;
      d.box(g, w, h, dep, 0, GROUND + h / 2, z, p.shell);
      d.box(g, w + 0.04, 0.06, dep + 0.04, 0, top - 0.09, z, p.light);
      d.box(g, w * 0.86, 0.42, 0.06, 0, top - 0.42, front - 0.01, p.glass).name =
        'Terrace Earth window';
      for (const side of [-1, 1])
        d.box(g, 0.08, 0.6, 0.08, (side * w) / 6, top - 0.38, front - 0.02, p.deep);
      d.box(g, w - 0.2, 0.26, 0.04, 0, top + 0.13, front + 0.06, p.glass).name =
        'Terrace balustrade';
      return top;
    };
    const roof = tier(6.4, 3, 0.3);
    const middle = tier(6.4, 2.2, -1);
    const lower = tier(5.6, 1.4, -2.3);
    for (const [top, z, w] of [
      [middle, -1.25, 5.2],
      [lower, -2.55, 4.4],
    ])
      for (const side of [-1, 0, 1])
        d.ball(g, (side * w) / 2.4, top + 0.16, z, [0.3, 0.2, 0.22], p.green, 'rock').name =
          'Terrace planter';
    // The street side: a stair bay with the shared hatch, between rows of lit portholes.
    d.box(g, 1.5, 3.3, 0.4, 0, GROUND + 1.65, 1.15, p.shell).name = 'Terrace stair bay';
    d.box(g, 1.54, 0.06, 0.44, 0, GROUND + 3.24, 1.15, p.light);
    d.box(g, 0.5, 0.9, 0.05, 0, 2.6, 1.36, p.glass);
    airlock(d, g, 0, 0.65, 1.37);
    for (const y of [1.25, 2.45])
      for (const x of [-2.6, -1.5, 1.5, 2.6]) porthole(d, g, x, y, 0.96, 0, 0.9, p.light);
    for (const side of [-1, 1]) d.box(g, 2.3, 0.07, 0.3, side * 2.05, 1.85, 1.1, p.light);
    for (const x of [-2.2, 2.2]) {
      d.rod(g, [x, roof, 0.5], [x, roof + 0.55, 0.5], 0.04, p.deep);
      const fin = d.box(g, 1.3, 0.05, 0.6, x, roof + 0.55, 0.5, p.roof);
      fin.rotation.x = 0.5;
      fin.name = 'Terrace solar fin';
    }
    if (level >= 2) {
      const garden = tier(4.6, 0.7, -3.6);
      for (const x of [-1.5, 0, 1.5])
        d.ball(g, x, garden + 0.16, -3.85, [0.3, 0.2, 0.22], p.green, 'rock');
    }
    if (level >= 3) {
      // A roof garden under glass, and a lantern at each balcony's end.
      habitatGlass(d, d.mesh(g, futureShape(d, 'dome'), [1.5, 0.95, 0.6], [0, roof, 0.3], p.glass));
      d.box(g, 2.6, 0.06, 0.9, 0, roof + 0.03, 0.3, p.green);
      for (const x of [-0.7, 0.1, 0.8])
        d.ball(g, x, roof + 0.4, 0.3, [0.34, 0.3, 0.3], p.green, futureShape(d, 'leafy'));
      for (const [top, z, w] of [
        [middle, -1.55, 6.4],
        [lower, -2.85, 5.6],
      ])
        for (const side of [-1, 1])
          d.ball(g, side * (w / 2 - 0.12), top + 0.36, z, 0.1, p.light, 'rock');
    }
  },
  // Rovers that leave the crater: a wide roll-up bay, a crew lock and fuel spheres.
  expeditionGarage(d, g, level) {
    shed(d, g, -1.7, -1.6, 3.4, 2.6, 1.9);
    d.box(g, 3.45, 0.14, 2.65, -1.7, 1.75, -1.6, p.flower).name = 'Expedition stripe';
    module(d, g, 0.75, -1.2, 1.3, 1.4, 1.2);
    expeditionRover(d, g, -1.7, 1.5, 0.15);
    for (const [x, z] of [
      [-3.6, 0.8],
      [-3.3, 2.3],
    ]) {
      d.mesh(g, 'cylinder', [0.3, 0.3, 0.3], [x, 0.4, z], p.deep);
      d.ball(g, x, 1.05, z, 0.55, p.shell).name = 'Fuel sphere';
      d.mesh(g, 'cylinder', [0.56, 0.06, 0.56], [x, 1.05, z], p.light);
    }
    if (level >= 2) {
      shed(d, g, 2.9, -1.5, 2.2, 2.2, 1.6, true);
      expeditionRover(d, g, 2.9, 1.3, -0.2);
    }
    if (level >= 3) {
      d.rod(g, [0.75, GROUND, -2.5], [0.75, 5, -2.5], 0.06, p.deep).name = 'Expedition signal mast';
      d.rod(g, [0.3, 4.3, -2.5], [1.2, 4.3, -2.5], 0.03, p.deep);
      dish(d, g, 0.75, 3.6, -2.5, 0.5, 0.9, 0.6);
      d.ball(g, 0.75, 5.1, -2.5, 0.14, p.light, 'rock');
      d.box(g, 0.5, 0.45, 0.5, -0.2, 0.48, 0.2, p.timber);
      d.box(g, 0.35, 0.3, 0.35, -0.2, 0.85, 0.2, p.timber);
      lamp(d, g, -0.5, 3.5, GROUND);
    }
  },
  // Beds for guests: sleeping pods ringed round a glass common room.
  craterInn(d, g, level) {
    const top = dome(d, g, 0, -0.6, 1.7, 0.8);
    const pod = (degrees, y, inner) => {
      const arm = turned(d, g, 0, -0.6, (degrees * Math.PI) / 180);
      const length = 3.1 - inner,
        middle = -(inner + 3.1) / 2;
      const capsule = d.mesh(arm, 'cylinder', [0.5, length, 0.5], [0, y + 0.5, middle], p.shell);
      capsule.rotation.x = Math.PI / 2;
      capsule.name = 'Inn sleeping pod';
      d.ball(arm, 0, y + 0.5, -3.1, [0.5, 0.5, 0.3], p.shell);
      const band = d.mesh(arm, 'cylinder', [0.52, 0.08, 0.52], [0, y + 0.5, -2.3], p.light);
      band.rotation.x = Math.PI / 2;
      d.ball(arm, 0, y + 0.55, -3.36, [0.2, 0.2, 0.08], p.light).name = 'Inn warm window';
      if (y === GROUND) d.box(arm, 0.5, 0.1, 0.9, 0, 0.3, -2.6, p.deep);
    };
    for (const degrees of [-100, -50, 0, 50, 100]) pod(degrees, GROUND, 1.6);
    if (level >= 2) for (const degrees of [-75, -25, 25, 75]) pod(degrees, GROUND + 0.9, 1.3);
    if (level >= 3) {
      // A rooftop bubble for watching the Earth rise.
      d.rod(g, [0, top - 0.1, -0.6], [0, top + 0.5, -0.6], 0.12, p.shell);
      d.mesh(g, 'cylinder', [0.5, 0.05, 0.5], [0, top + 0.5, -0.6], p.shell);
      habitatGlass(d, d.ball(g, 0, top + 0.95, -0.6, 0.62, p.glass)).name = 'Inn viewing bubble';
      habitatRim(d, g, 0, top + 0.95, -0.6, 0.66);
      for (const x of [-1.6, 1.6]) lamp(d, g, x, 2.7, GROUND);
      pennant(d, g, -2.6, 2, 2.3);
      d.box(g, 1.3, 0.14, 0.35, 2.5, 0.42, 1.7, p.timber);
      planter(d, g, 3, 2.8, 0.85);
    }
  },
  // Listens past the rim, and stays low under the risen Earth.
  starwatchDish(d, g, level) {
    d.mesh(g, 'cylinder', [1.1, 1.3, 1.1], [0, 0.9, -1], p.shell);
    d.mesh(g, 'cylinder', [1.13, 0.08, 1.13], [0, 0.45, -1], p.light);
    d.mesh(g, 'cylinder', [1.13, 0.08, 1.13], [0, 1.46, -1], p.light);
    airlock(d, g, 0, 0.65, 0.12);
    for (const side of [-1, 1])
      d.rod(g, [side * 0.7, 1.5, -1], [side * 0.8, 2.75, -1], 0.07, p.roof);
    d.rod(g, [-0.85, 2.75, -1], [0.85, 2.75, -1], 0.06, p.roof);
    // The bowl looks up across the crater, so the town sees into it.
    dish(d, g, 0, 2.75, -1, 1.7, 0.35, Math.PI - 0.5);
    if (level >= 2) {
      dome(d, g, 2.6, 0.9, 0.95, 0.5);
      d.box(g, 0.7, 0.3, 0.4, 2.6, 0.85, 0.8, p.glass).name = 'Starwatch console';
      d.rod(g, [1, 0.3, -0.6], [2, 0.3, 0.4], 0.05, p.deep);
    }
    if (level >= 3) {
      d.mesh(g, 'cylinder', [0.2, 1, 0.2], [-2.7, 0.75, 0.9], p.shell);
      dish(d, g, -2.7, 1.3, 0.9, 0.85, 0.5, Math.PI + 0.6);
      for (let n = 0; n < 8; n++) {
        const a = ((n + 0.5) * TAU) / 8,
          x = Math.sin(a) * 4.1,
          z = Math.cos(a) * 4.1;
        d.rod(g, [x, GROUND, z], [x, 0.5, z], 0.03, p.deep);
        d.ball(g, x, 0.54, z, 0.08, p.light, 'rock').name = 'Starwatch ground light';
      }
    }
  },
  // Low-gravity play: a marked pitch under a net of steel arches, two hoops and a bench.
  moonballField(d, g, level) {
    d.box(g, 6.6, 0.03, 3.8, 0, 0.27, -1, p.green).name = 'Moonball pitch';
    for (const z of [-2.8, 0.8]) d.box(g, 6.4, 0.006, 0.07, 0, 0.287, z, p.shell);
    for (const x of [-3.2, 0, 3.2]) d.box(g, 0.07, 0.006, 3.6, x, 0.287, -1, p.shell);
    for (const x of [-3.3, 0, 3.3])
      d.mesh(g, vaultArch(d), [0.06, 2.6, 2.1], [x, GROUND, -1], p.roof).name = 'Moonball net arch';
    d.rod(g, [-3.3, 2.9, -1], [3.3, 2.9, -1], 0.035, p.roof);
    for (const side of [-1, 1]) {
      d.rod(g, [side * 2.9, GROUND, -1], [side * 2.9, 1.75, -1], 0.04, p.deep);
      const hoop = d.mesh(
        g,
        futureShape(d, 'hoop'),
        [0.42, 0.42, 0.42],
        [side * 2.9, 2.2, -1],
        p.light,
      );
      hoop.rotation.y = Math.PI / 2;
      hoop.name = 'Moonball hoop';
    }
    d.ball(g, 0.7, 1.55, -1.3, 0.2, p.flower).name = 'Moonball';
    module(d, g, 0, 2.6, 1.6, 1, 1);
    d.box(g, 1.4, 0.14, 0.35, -2.4, 0.42, 1.9, p.timber);
    if (level >= 2)
      for (let n = 0; n < 3; n++)
        d.box(
          g,
          2.2,
          0.2 * (n + 1),
          0.36,
          2.6,
          GROUND + 0.1 * (n + 1),
          1.75 + n * 0.36,
          p.timber,
        ).name = 'Moonball stand';
    if (level >= 3) {
      for (const x of [-3.75, 3.75])
        for (const z of [-3, 1]) {
          d.rod(g, [x, GROUND, z], [x, 3.5, z], 0.045, p.deep);
          const head = d.box(g, 0.5, 0.26, 0.12, x, 3.55, z, p.light);
          head.rotation.y = Math.atan2(-x, -1 - z);
          head.name = 'Moonball floodlight';
        }
      for (const x of [-0.7, 0.7]) d.rod(g, [x, GROUND, -3.45], [x, 2, -3.45], 0.04, p.deep);
      d.box(g, 1.8, 0.7, 0.1, 0, 2.2, -3.45, p.shell).name = 'Moonball scoreboard';
      for (const [x, color] of [
        [-0.45, p.flower],
        [0.45, p.light],
      ])
        d.box(g, 0.45, 0.4, 0.04, x, 2.2, -3.39, color);
    }
  },
  // A Willowkin pond under a low glass lid. Nothing here stands taller than a settler.
  craterPondGarden(d, g, level) {
    const z = -0.6;
    d.mesh(g, 'cylinder', [2.9, 0.22, 2.9], [0, 0.36, z], p.shell);
    d.mesh(g, 'cylinder', [2.65, 0.06, 2.65], [0, 0.47, z], p.glass).name = 'Crater pond';
    for (const [x, dz] of [
      [-1.9, 0.9],
      [-1.2, 0.3],
      [-0.4, 0.5],
      [0.4, 0.1],
      [1.2, 0.4],
      [1.9, -0.1],
    ])
      d.ball(g, x, 0.51, z + dz, [0.26, 0.05, 0.24], p.shell, 'rock').name = 'Pond stepping stone';
    for (const [x, dz, lean] of [
      [-1.7, -1.4, 0.1],
      [1.6, 1.2, -0.1],
      [0.5, -2, 0.06],
    ])
      for (let n = 0; n < 3; n++) {
        const rx = x + n * 0.14,
          h = 0.42 + n * 0.1;
        d.rod(g, [rx, 0.48, z + dz], [rx + lean, 0.48 + h, z + dz], 0.022, p.green);
        d.ball(g, rx + lean, 0.5 + h, z + dz, [0.04, 0.09, 0.04], p.timber, 'rock');
      }
    for (const [x, dz] of [
      [0.9, -1.2],
      [-0.7, -1.5],
      [-1.4, 1.5],
    ]) {
      d.mesh(g, 'cylinder', [0.22, 0.02, 0.22], [x, 0.51, z + dz], p.green);
      d.ball(g, x + 0.05, 0.56, z + dz, 0.06, p.flower, 'rock');
    }
    habitatGlass(d, d.mesh(g, futureShape(d, 'dome'), [2.75, 0.75, 2.75], [0, 0.47, z], p.glass));
    habitatRim(d, g, 0, 0.475, z, 2.93);
    d.box(g, 0.6, 0.5, 0.6, 0, 0.5, 2.4, p.shell);
    module(d, g, 0, 3, 1, 0.8, 0.8);
    if (level >= 2) {
      // A low foot-bridge arches over the water.
      const bridge = d.group(g, 0, 0, z - 0.9);
      bridge.name = 'Pond foot-bridge';
      for (const [x, y, tilt] of [
        [-1.25, 0.66, 0.22],
        [0, 0.8, 0],
        [1.25, 0.66, -0.22],
      ])
        d.box(bridge, 1.3, 0.06, 0.5, x, y, 0, p.timber).rotation.z = tilt;
      for (const side of [-1, 1])
        d.rod(bridge, [-0.6, 1, side * 0.24], [0.6, 1, side * 0.24], 0.02, p.deep);
    }
    if (level >= 3) {
      for (const [x, dz] of [
        [-0.2, -0.2],
        [1.3, -0.5],
        [-1.5, 0.2],
        [0.6, 1.2],
        [-0.6, 1.4],
      ]) {
        d.mesh(g, 'cylinder', [0.12, 0.03, 0.12], [x, 0.515, z + dz], p.shell);
        d.ball(g, x, 0.6, z + dz, 0.08, p.light, 'rock').name = 'Pond floating lantern';
      }
      for (const degrees of [35, 145, 215, 325]) {
        const a = (degrees * Math.PI) / 180,
          x = Math.sin(a) * 3.5,
          lz = z + Math.cos(a) * 3.5;
        d.rod(g, [x, GROUND, lz], [x, 0.9, lz], 0.03, p.deep);
        d.ball(g, x, 0.96, lz, [0.1, 0.13, 0.1], p.light, 'rock');
      }
    }
  },
};
