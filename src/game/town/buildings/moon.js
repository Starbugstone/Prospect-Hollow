import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { futureShape } from './futureShapes';

// New Hollow on the Moon. Every building shares one small lunar kit: moon-white
// ceramic drums under glass domes, steel ribs, round airlocks, gold foil and
// solar fins. Geometry comes from the shared primitives and cached future shapes.
const TAU = Math.PI * 2;

function pad(d, g, r, x = 0, z = 0) {
  d.mesh(g, futureShape(d, 'octagon'), [r, 0.18, r], [x, 0.09, z], p.deep);
  d.mesh(g, futureShape(d, 'octagon'), [r - 0.25, 0.08, r - 0.25], [x, 0.22, z], p.shell);
}
function airlock(d, g, x, y, z, turn = 0) {
  const door = d.group(g, x, y, z);
  door.rotation.y = turn;
  d.mesh(door, futureShape(d, 'octagon'), [0.42, 0.1, 0.42], [0, 0, 0], p.deep).rotation.x =
    Math.PI / 2;
  d.mesh(door, futureShape(d, 'octagon'), [0.5, 0.06, 0.5], [0, 0, -0.03], p.light).rotation.x =
    Math.PI / 2;
}
/** A ceramic drum under a ribbed glass dome; returns the dome's top. */
function dome(d, g, x, z, r, h = 0.9, glass = true) {
  d.mesh(g, 'cylinder', [r, h, r], [x, 0.25 + h / 2, z], p.shell);
  d.mesh(g, 'cylinder', [r + 0.04, 0.08, r + 0.04], [x, 0.25 + h, z], p.light);
  d.mesh(
    g,
    futureShape(d, 'dome'),
    [r * 0.97, r * 0.85, r * 0.97],
    [x, 0.25 + h, z],
    glass ? p.glass : p.shell,
  );
  for (const turn of [0, Math.PI / 2]) {
    let last = null;
    for (let n = 0; n <= 6; n++) {
      const a = (n / 6) * Math.PI;
      const point = [
        x + Math.cos(a) * r * Math.cos(turn),
        0.25 + h + Math.sin(a) * r * 0.86,
        z + Math.cos(a) * r * Math.sin(turn),
      ];
      if (last) d.rod(g, last, point, 0.035, p.roof);
      last = point;
    }
  }
  airlock(d, g, x, 0.65, z + r + 0.02);
  return 0.25 + h + r * 0.85;
}
/** A white ceramic module with a gold band and a window strip. */
function module(d, g, x, z, w, dep, h, turn = 0) {
  const m = d.group(g, x, 0, z);
  m.rotation.y = turn;
  d.box(m, w, h, dep, 0, 0.25 + h / 2, 0, p.shell, true);
  d.box(m, w + 0.04, 0.08, dep + 0.04, 0, 0.45, 0, p.light);
  d.box(m, w * 0.7, 0.26, 0.05, 0, 0.25 + h * 0.62, dep / 2 + 0.01, p.glass);
  return m;
}
function solarFin(d, g, x, z, turn = 0) {
  d.rod(g, [x, 0.2, z], [x, 1.3, z], 0.04, p.deep);
  const fin = d.box(g, 1.1, 0.05, 0.55, x, 1.3, z, p.roof);
  fin.rotation.set(-0.5, turn, 0);
}
function lamp(d, g, x, z, y = 0) {
  d.rod(g, [x, y, z], [x, y + 1.1, z], 0.035, p.deep);
  d.ball(g, x, y + 1.16, z, [0.11, 0.14, 0.11], p.light, 'rock');
}
function gable(d, g, x, z, w, dep, h, roof = p.roof) {
  d.box(g, w, h, dep, x, 0.25 + h / 2, z, p.shell);
  d.mesh(g, futureShape(d, 'gable'), [w + 0.3, w * 0.32, dep + 0.25], [x, 0.25 + h, z], roof);
  d.rod(
    g,
    [x, 0.27 + h + w * 0.32, z - dep / 2 - 0.12],
    [x, 0.27 + h + w * 0.32, z + dep / 2 + 0.12],
    0.03,
    p.light,
  );
  airlock(d, g, x, 0.65, z + dep / 2 + 0.02);
}
function rover(d, g, x, z, turn = 0) {
  const r = d.group(g, x, 0, z);
  r.rotation.y = turn;
  d.box(r, 1.1, 0.35, 0.65, 0, 0.5, 0, p.shell, true);
  d.box(r, 0.45, 0.25, 0.55, 0.15, 0.78, 0, p.glass);
  for (const dx of [-0.38, 0.38])
    for (const dz of [-0.36, 0.36]) {
      const wheel = d.mesh(r, 'cylinder', [0.17, 0.1, 0.17], [dx, 0.2, dz], p.deep);
      wheel.rotation.x = Math.PI / 2;
    }
  d.rod(r, [-0.4, 0.68, -0.2], [-0.4, 1.2, -0.2], 0.02, p.deep);
  d.ball(r, -0.4, 1.24, -0.2, 0.05, p.flower, 'rock');
}
function willowkinTree(d, g, x, y, z, scale = 1) {
  d.rod(g, [x, y, z], [x, y + 1.1 * scale, z], 0.09 * scale, p.timber);
  for (const [dx, dy, dz, r] of [
    [0, 1.45, 0, 0.55],
    [-0.35, 1.2, 0.15, 0.38],
    [0.35, 1.25, -0.1, 0.4],
  ])
    d.ball(
      g,
      x + dx * scale,
      y + dy * scale,
      z + dz * scale,
      [r * scale, r * 0.85 * scale, r * scale],
      p.green,
      futureShape(d, 'leafy'),
    );
  d.ball(g, x + 0.15 * scale, y + 1.55 * scale, z + 0.4 * scale, 0.08 * scale, p.flower, 'rock');
}

// The Moon end of the ribbon: the anchor tower, a docked climber and cargo bays.
const RIBBON_HEIGHT = 140;
const FORMS = {
  ribbonLanding(d, g, level) {
    pad(d, g, 5.2);
    d.mesh(g, futureShape(d, 'octagon'), [1.3, 4.2, 1.3], [0, 2.35, 0], p.shell);
    d.mesh(g, futureShape(d, 'octagon'), [1.45, 0.2, 1.45], [0, 4.5, 0], p.light);
    const ribbon = d.mesh(
      g,
      'cylinder',
      [0.08, RIBBON_HEIGHT, 0.08],
      [0, 4.6 + RIBBON_HEIGHT / 2, 0],
      p.glass,
    );
    ribbon.castShadow = false;
    ribbon.name = 'Moon ribbon';
    const climber = d.box(g, 0.85, 1.1, 0.85, 0, 5.4, 0, p.shell, true);
    climber.castShadow = false;
    d.box(g, 0.9, 0.16, 0.9, 0, 5.0, 0, p.flower).castShadow = false;
    module(d, g, -2.9, 1.6, 1.8, 1.4, 1.2);
    airlock(d, g, 0, 0.75, 1.32);
    if (level >= 2) {
      module(d, g, 2.9, 1.6, 1.8, 1.4, 1.2);
      for (const x of [-1.6, 1.6]) d.box(g, 0.7, 0.6, 0.7, x, 0.55, 3.3, p.timber);
    }
    if (level >= 3) {
      const halo = d.mesh(g, futureShape(d, 'hoop'), [2.6, 2.6, 2.6], [0, 13, 0], p.shell);
      halo.rotation.x = Math.PI / 2;
      halo.castShadow = false;
      for (const [x, z] of [
        [-4.2, -3.2],
        [4.2, -3.2],
        [-4.2, 3.4],
        [4.2, 3.4],
      ])
        lamp(d, g, x, z, 0.25);
    }
  },
  settlerDomes(d, g, level) {
    pad(d, g, 4.6);
    dome(d, g, -1.5, -0.6, 1.25);
    dome(d, g, 1.5, -0.4, 1.05, 0.75);
    if (level >= 2) dome(d, g, 0, -2.6, 1.1, 1.1);
    if (level >= 3) {
      for (const x of [-2.9, 2.9]) lamp(d, g, x, 2.2, 0.25);
      d.box(g, 2.2, 0.16, 0.5, 0, 0.32, 2.4, p.timber);
    }
  },
  craterIceWell(d, g, level) {
    pad(d, g, 4.4);
    // A drilling tripod over the crater ice.
    for (let n = 0; n < 3; n++) {
      const a = (n * TAU) / 3;
      d.rod(g, [Math.sin(a) * 1.6, 0.25, Math.cos(a) * 1.6 - 0.6], [0, 3.4, -0.6], 0.07, p.deep);
    }
    d.ball(g, 0, 0.55, -0.6, [0.9, 0.45, 0.9], p.glass, 'rock');
    d.mesh(g, 'cylinder', [0.85, 1.6, 0.85], [2.2, 1.05, 0.4], p.shell);
    d.mesh(g, 'cylinder', [0.88, 0.1, 0.88], [2.2, 1.9, 0.4], p.light);
    if (level >= 2) d.mesh(g, 'cylinder', [0.7, 1.3, 0.7], [-2.2, 0.9, 0.6], p.shell);
    if (level >= 3) {
      d.rod(g, [2.2, 1.3, 0.4], [-2.2, 1.3, 0.6], 0.08, p.roof);
      for (const [x, z] of [
        [-1, 2.2],
        [1.2, 2.4],
      ])
        d.ball(g, x, 0.45, z, [0.35, 0.3, 0.3], p.glass, 'rock');
    }
  },
  earthlightGreenhouse(d, g, level) {
    pad(d, g, 4.6);
    const vault = (x, z, len) => {
      d.box(g, len, 0.3, 1.8, x, 0.4, z, p.shell);
      d.mesh(g, futureShape(d, 'dome'), [len / 2, 0.95, 0.9], [x, 0.55, z], p.glass);
      for (let n = 0; n < 4; n++)
        d.ball(
          g,
          x - len / 2 + 0.5 + n * ((len - 1) / 3),
          0.75,
          z,
          [0.3, 0.26, 0.3],
          p.green,
          'rock',
        );
    };
    vault(-0.3, -1.4, 4);
    solarFin(d, g, 2.9, 1.2, 0.3);
    if (level >= 2) vault(-0.3, 0.9, 3.4);
    if (level >= 3) {
      solarFin(d, g, -3, 1.6, -0.3);
      lamp(d, g, 2.6, 2.8, 0.25);
    }
  },
  willowkinDome(d, g, level) {
    pad(d, g, 4.8);
    const top = dome(d, g, 0, -0.4, 2.3, 0.5);
    willowkinTree(d, g, 0, 0.3, -0.5, 1.1);
    for (const [x, z] of [
      [-0.9, 0.5],
      [0.8, 0.6],
    ])
      d.ball(g, x, 0.42, z, 0.12, p.flower, 'rock');
    if (level >= 2) for (const x of [-3.4, 3.4]) lamp(d, g, x, 1.8, 0.25);
    if (level >= 3) {
      dome(d, g, 3, -2.2, 0.9, 0.4);
      willowkinTree(d, g, 3, 0.3, -2.3, 0.45);
      d.ball(g, 0, top + 0.12, -0.4, 0.14, p.light, 'rock');
    }
  },
  newHollowCommons(d, g, level) {
    pad(d, g, 4.8);
    module(d, g, 0, -0.6, 4, 2, 1.5);
    dome(d, g, 0, -0.9, 1.1, 1.35, false);
    // The Prospect Hollow pennant flies on the Moon.
    d.rod(g, [-2.4, 0.25, 1.4], [-2.4, 3.2, 1.4], 0.04, p.deep);
    d.mesh(g, futureShape(d, 'pennant'), [0.8, 0.5, 1], [-2.4, 2.7, 1.4], p.flower);
    if (level >= 2) module(d, g, 2.9, -1.8, 1.4, 1.6, 1.1, Math.PI / 2);
    if (level >= 3) {
      d.mesh(g, futureShape(d, 'octagon'), [0.35, 3.2, 0.35], [-2.9, 1.85, -1.8], p.shell);
      d.ball(g, -2.9, 3.6, -1.8, 0.2, p.light, 'rock');
      d.box(g, 2, 0.14, 0.45, 0.6, 0.35, 2.3, p.timber);
    }
  },
  craterHomesteads(d, g, level) {
    pad(d, g, 4.8);
    gable(d, g, -1.6, -1, 1.8, 1.8, 1.5);
    gable(d, g, 1.7, -0.4, 1.6, 1.7, 1.3, p.flower);
    if (level >= 2) gable(d, g, 0.1, -3, 1.6, 1.4, 1.4);
    if (level >= 3) {
      for (let n = 0; n < 6; n++) d.box(g, 0.08, 0.5, 0.08, -2.6 + n, 0.5, 2.6, p.timber);
      d.box(g, 5.2, 0.06, 0.06, -0.1, 0.65, 2.6, p.timber);
      rover(d, g, 2.4, 2.4, 0.4);
    }
  },
  moonstoneWorkshop(d, g, level) {
    pad(d, g, 4.4);
    module(d, g, -0.6, -0.8, 3, 1.9, 1.4);
    d.mesh(g, 'cylinder', [0.3, 1.6, 0.3], [-1.6, 2.2, -1.2], p.deep);
    // Polished moonstones glow on the display table.
    d.box(g, 1.4, 0.5, 0.6, 1.9, 0.5, 1.2, p.timber);
    for (const dx of [-0.4, 0, 0.4]) d.ball(g, 1.9 + dx, 0.88, 1.2, 0.13, p.glass, 'rock');
    if (level >= 2) dome(d, g, 2.2, -1.4, 0.8, 0.6);
    if (level >= 3) {
      d.rod(g, [-0.6, 1.65, -0.8], [-0.6, 2.75, -0.8], 0.08, p.deep).name =
        'Moonstone beacon mount';
      const crystal = d.ball(g, -0.6, 2.75, -0.8, [0.28, 0.5, 0.28], p.glass, 'rock');
      crystal.name = 'Moonstone beacon';
      lamp(d, g, -3, 1.6, 0.25);
    }
  },
  roverBarn(d, g, level) {
    pad(d, g, 4.6);
    gable(d, g, -0.8, -1.2, 3, 2.2, 1.6, p.flower);
    rover(d, g, 1.9, 1.6, -0.5);
    if (level >= 2) rover(d, g, -1.6, 2, 0.6);
    if (level >= 3) {
      for (const x of [2.4, 3.4]) d.rod(g, [x, 0.25, -1.8], [x, 1.85, -1.8], 0.05, p.deep);
      d.box(g, 1.5, 0.06, 1.2, 2.9, 1.85, -1.8, p.roof);
    }
  },
  earthriseLookout(d, g, level) {
    pad(d, g, 4.4);
    // A deck on stilts with a telescope pointed at the valley.
    d.box(g, 3.2, 0.18, 2.4, 0, 1.6, -0.4, p.timber);
    for (const x of [-1.4, 1.4])
      for (const z of [-1.4, 0.6]) d.box(g, 0.14, 1.5, 0.14, x, 0.85, z, p.deep);
    d.rod(g, [0.6, 1.7, -0.4], [1.1, 2.6, -1.3], 0.12, p.light);
    if (level >= 2)
      for (const z of [-1.55, 0.75]) {
        d.box(g, 3.2, 0.06, 0.06, 0, 2.2, z, p.deep);
        for (const x of [-1.4, 1.4])
          d.rod(g, [x, 1.6, z], [x, 2.2, z], 0.035, p.deep).name = 'Lookout railing post';
      }
    if (level >= 3) {
      dome(d, g, -2.4, 1.8, 0.8, 0.5);
      d.box(g, 1.4, 0.16, 0.4, 1.2, 0.45, 2.2, p.timber);
    }
  },
};

export const MOON_FORMS = Object.freeze(Object.keys(FORMS));

/** Draw one Moon building at its level, or a marked empty lot before it is built. */
export function renderMoonBuilding(d, parent, kind, level) {
  const root = d.group(parent);
  root.name = `Moon ${kind} level ${level}`;
  root.userData.eraLevel = level;
  if (level > 0 && FORMS[kind]) FORMS[kind](d, root, level);
  else {
    // An empty lot: a marked pad with four survey beacons.
    d.mesh(root, futureShape(d, 'octagon'), [3.6, 0.06, 3.6], [0, 0.03, 0], p.deep);
    for (let n = 0; n < 4; n++) {
      const a = (n * TAU) / 4 + TAU / 8;
      d.rod(
        root,
        [Math.sin(a) * 3, 0, Math.cos(a) * 3],
        [Math.sin(a) * 3, 0.7, Math.cos(a) * 3],
        0.04,
        p.deep,
      );
      d.ball(root, Math.sin(a) * 3, 0.75, Math.cos(a) * 3, 0.08, p.light, 'rock');
    }
  }
  return root;
}
