import { MeshBasicMaterial } from 'three';
import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { MOON_DISTRICTS, moonLotPose } from '../../../data/moonSettlement';
import { futureShape } from './futureShapes';
import { dome, gable, habitatGlass, habitatRim, lamp, module, willowkinTree } from './moonKit';
import { GROUND, dish, glassVault, planter } from './moonRising';

// The Quiet Signal: the Far Rim's buildings, gathered round the Quiet Stone. Local +z is
// each lot's front and faces the stone, so dishes, lenses, benches and lit windows all look
// that way, and every leaf leans that way. They use New Hollow's lunar kit and palette, at
// most eight materials, and keep their hatch and public path (MOON_LOT_TABLE) clear.
const TAU = Math.PI * 2;
// The stone's pulse: every ninety-one seconds, a few seconds long. 0 at rest, 1 at its peak.
export const SIGNAL_PULSE = 91;
const PULSE_LENGTH = 6;
export function signalPulse(time) {
  const phase = ((time % SIGNAL_PULSE) + SIGNAL_PULSE) % SIGNAL_PULSE;
  return phase < PULSE_LENGTH ? Math.sin((phase / PULSE_LENGTH) * Math.PI) : 0;
}
/**
 * Marks `node` as moving: it stays out of the settlement's merged mesh, and the Moon scene
 * calls `motion(time)` each frame (time 0 is its pose at rest, used with reduced motion).
 */
function moves(node, motion) {
  node.userData.animated = true;
  node.userData.moonMotion = motion;
  motion(0);
  return node;
}
/** A window with the lamp on behind it: unlit, so it glows on a wall the sun never reaches. */
function litWindow(d, g, w, h, x, y, z) {
  const key = 'moon-lit-window';
  if (!d.materials.has(key)) d.materials.set(key, new MeshBasicMaterial({ color: '#ffd98a' }));
  const pane = d.box(g, w, h, 0.05, x, y, z, p.light);
  pane.material = d.materials.get(key);
  pane.castShadow = false;
  pane.name = 'Lit window';
  return pane;
}
/** A dish that follows the stone: it sweeps slowly a little either side of `turn`. */
function trackingDish(d, g, x, y, z, radius, turn, phase = 0) {
  const mount = dish(d, g, x, y, z, radius, 1.15, turn);
  mount.name = 'Listening dish';
  return moves(mount, (time) => {
    mount.rotation.y = turn + Math.sin(time * 0.07 + phase) * 0.22;
  });
}
/** A lamp on an instrument that swells with each pulse of the stone. */
function pulseLamp(d, g, x, y, z, size = 0.11) {
  const light = d.ball(g, x, y, z, size, p.light, 'rock');
  light.name = 'Pulse lamp';
  return moves(light, (time) => light.scale.setScalar(size * (1 + signalPulse(time) * 0.9)));
}
/** A tuning crystal on a tripod, cabled to its hut: the simplest pulse instrument. */
function instrument(d, g, x, z, height = 0.9) {
  for (let n = 0; n < 3; n++) {
    const a = (n * TAU) / 3;
    d.rod(
      g,
      [x + Math.sin(a) * 0.28, GROUND, z + Math.cos(a) * 0.28],
      [x, GROUND + height, z],
      0.025,
      p.deep,
    );
  }
  d.ball(g, x, GROUND + height + 0.12, z, [0.12, 0.2, 0.12], p.glass, 'rock').name =
    'Tuning crystal';
  pulseLamp(d, g, x, GROUND + height + 0.36, z, 0.06);
}
/** A wooden resonator: a tall tonewood stave under a gold cap. */
function resonator(d, g, x, z, height, crystal = false) {
  d.box(g, 0.26, height, 0.2, x, GROUND + height / 2, z, p.timber).name = 'Tonewood resonator';
  d.box(g, 0.32, 0.06, 0.26, x, GROUND + height + 0.03, z, p.light);
  if (crystal)
    d.ball(g, x, GROUND + height + 0.24, z, [0.1, 0.18, 0.1], p.glass, 'rock').name =
      'Resonator crystal';
}
/** A lens in a gold ring on a stand, facing the front. */
function lens(d, g, x, y, z, radius) {
  const ring = d.group(g, x, y, z);
  ring.name = 'Ground lens';
  d.mesh(
    ring,
    futureShape(d, 'octagon'),
    [radius * 0.9, 0.05, radius * 0.9],
    [0, 0, 0],
    p.glass,
  ).rotation.x = Math.PI / 2;
  d.mesh(ring, futureShape(d, 'hoop'), [radius, radius, radius * 0.6], [0, 0, 0], p.light);
  return ring;
}
/** A young tonewood tree under glass, leaning toward the stone (+z). */
function leaningTree(d, g, x, z, scale = 1) {
  const top = [x, 0.55 + 0.7 * scale, z + 0.3 * scale];
  d.rod(g, [x, 0.55, z], top, 0.05 * scale, p.timber);
  d.ball(
    g,
    top[0],
    top[1] + 0.16 * scale,
    top[2] + 0.1 * scale,
    [0.36 * scale, 0.28 * scale, 0.36 * scale],
    p.green,
    futureShape(d, 'leafy'),
  ).name = 'Leaning tonewood';
}
/** Roots that grow in a shape, then in the same shape again, smaller. */
function rootPattern(d, g, x, z, angle, length, depth, y) {
  const end = [x + Math.sin(angle) * length, z + Math.cos(angle) * length];
  d.rod(g, [x, y, z], [end[0], y, end[1]], 0.03 + depth * 0.012, p.timber).name = 'Patterned root';
  if (depth > 1)
    for (const turn of [-0.62, 0.62])
      rootPattern(d, g, end[0], end[1], angle + turn, length * 0.62, depth - 1, y);
}

export const SIGNAL_FORMS = {
  // An instrument hut on bedrock that grows into an observatory. Its dishes follow the stone.
  listeningHouse(d, g, level) {
    module(d, g, 0, -1, 3.2, 1.9, 1.5);
    d.box(g, 3.3, 0.1, 2, 0, 1.8, -1, p.roof);
    trackingDish(d, g, 0.9, 1.9, -1.1, 0.7, Math.PI);
    d.rod(g, [0.9, 1.85, -1.1], [0.9, 1.95, -1.1], 0.06, p.deep);
    for (const [x, z] of [
      [-2.7, 1.6],
      [2.7, 1.6],
      [-3.3, -0.6],
    ]) {
      instrument(d, g, x, z);
      d.rod(g, [x, 0.28, z], [Math.sign(x) * 1.6, 0.28, -0.6], 0.02, p.deep);
    }
    if (level >= 2) {
      // The observatory: a closed dome with an open slit, and a great dish on a mast.
      const top = dome(d, g, 2.7, -2.5, 1.15, 1.2, false);
      const slit = d.box(g, 0.3, 0.9, 1.5, 2.7, top - 0.42, -1.95, p.deep);
      slit.rotation.x = 0.75;
      slit.name = 'Observatory slit';
      d.rod(g, [-2.7, GROUND, -2.4], [-2.7, 2.9, -2.4], 0.09, p.shell);
      d.mesh(g, 'cylinder', [0.3, 0.3, 0.3], [-2.7, 0.4, -2.4], p.shell);
      trackingDish(d, g, -2.7, 2.9, -2.4, 1.35, Math.PI, 1.4);
    }
    if (level >= 3) {
      // A telescope through the slit, a third dish and a line of aerials along the front.
      d.rod(g, [2.7, 2.2, -2.3], [2.7, 3.15, -1.3], 0.1, p.light).name = 'Observatory telescope';
      d.rod(g, [3.5, GROUND, 0.2], [3.5, 1.7, 0.2], 0.06, p.shell);
      trackingDish(d, g, 3.5, 1.7, 0.2, 0.8, Math.PI, 2.8);
      for (const x of [-2.4, -1.6, 1.6, 2.4]) {
        d.rod(g, [x, GROUND, 3.4], [x, 1.3, 3.4], 0.025, p.deep);
        d.ball(g, x, 1.34, 3.4, 0.06, p.light, 'rock');
      }
      pulseLamp(d, g, 0, 2.05, -1.9, 0.12);
      lamp(d, g, -1.5, 0.6, GROUND);
    }
  },
  // A round basin of still water. Each pulse of the stone sends one ring across it.
  stillwaterBasin(d, g, level) {
    const z = -0.6;
    d.mesh(g, 'cylinder', [3.3, 0.3, 3.3], [0, 0.4, z], p.shell);
    d.mesh(g, 'cylinder', [3.05, 0.06, 3.05], [0, 0.55, z], p.glass).name = 'Still water';
    habitatRim(d, g, 0, 0.562, z, 3.32);
    // The ring a pulse draws: it starts at the side nearest the stone and crosses the water.
    const ripple = d.mesh(g, futureShape(d, 'hoop'), [1, 1, 0.2], [0, 0.59, z], p.shell);
    ripple.rotation.x = Math.PI / 2;
    ripple.name = 'Pulse ring';
    moves(ripple, (time) => {
      const pulse = signalPulse(time),
        phase = (((time % SIGNAL_PULSE) + SIGNAL_PULSE) % SIGNAL_PULSE) / PULSE_LENGTH;
      // At rest the ring is drawn too small to see, so it stays one of the lot's parts.
      const radius = pulse > 0 ? 0.3 + Math.min(1, phase) * 2.6 : 0.001;
      ripple.scale.set(radius, radius, 0.2);
      ripple.position.z = z + 2.6 - Math.min(1, phase) * 2.6;
    });
    module(d, g, 0, 3, 1.1, 0.8, 0.8);
    // A measuring staff at the water's edge.
    d.rod(g, [-2.2, 0.55, z + 2.2], [-2.2, 1.7, z + 2.2], 0.04, p.deep);
    for (const y of [0.9, 1.2, 1.5]) d.box(g, 0.16, 0.03, 0.05, -2.2, y, z + 2.2, p.light);
    if (level >= 2) {
      // A header tank and the main that fills it.
      d.mesh(g, 'cylinder', [0.85, 1.6, 0.85], [3.1, 1.05, 2.3], p.shell);
      d.mesh(g, 'cylinder', [0.88, 0.08, 0.88], [3.1, 1.6, 2.3], p.light);
      d.mesh(g, futureShape(d, 'dome'), [0.85, 0.3, 0.85], [3.1, 1.85, 2.3], p.roof);
      d.rod(g, [2.4, 0.5, 1.8], [2.2, 0.5, 1.2], 0.07, p.glass).name = 'Basin main';
      d.box(g, 1.5, 0.14, 0.36, -3, 0.42, 2.6, p.timber).name = 'Basin bench';
    }
    if (level >= 3) {
      // A low glass lid keeps the dust off the water, and low lamps mark the edge.
      habitatGlass(d, d.mesh(g, futureShape(d, 'dome'), [3.1, 0.8, 3.1], [0, 0.56, z], p.glass));
      for (const degrees of [50, 130, 230, 310]) {
        const a = (degrees * Math.PI) / 180,
          x = Math.sin(a) * 3.9,
          lz = z + Math.cos(a) * 3.9;
        d.rod(g, [x, GROUND, lz], [x, 0.8, lz], 0.03, p.deep);
        d.ball(g, x, 0.86, lz, [0.1, 0.13, 0.1], p.light, 'rock');
      }
      instrument(d, g, 1.6, 2.9, 0.7);
    }
  },
  // Food and tonewood under glass. Everything that grows here leans toward the stone.
  tonewoodConservatory(d, g, level) {
    glassVault(d, g, 0, -1, 6.2, { half: 1.35, height: 1.6 });
    for (const [x, scale] of [
      [-2.3, 1],
      [-0.9, 1.25],
      [0.8, 1.1],
      [2.2, 0.95],
    ])
      leaningTree(d, g, x, -1.2, scale);
    module(d, g, 0, 1.7, 1.4, 1, 1.1);
    for (const x of [-1.6, 1.6]) d.box(g, 1.2, 0.2, 0.5, x, 0.65, -0.3, p.timber);
    if (level >= 2) {
      // A second, lower vault behind, and tonewood staves seasoning on a rack.
      glassVault(d, g, 0, -3.3, 5.4, { half: 1, height: 1.15 });
      for (const x of [-1.8, 0, 1.8]) leaningTree(d, g, x, -3.5, 0.7);
      for (const x of [3.2, 3.9]) d.rod(g, [x, GROUND, 1.5], [x, 1.3, 1.5], 0.04, p.deep);
      d.rod(g, [3.2, 1.3, 1.5], [3.9, 1.3, 1.5], 0.04, p.deep);
      for (let n = 0; n < 4; n++)
        d.rod(g, [3.25 + n * 0.2, GROUND, 2.1], [3.25 + n * 0.2, 1.3, 1.5], 0.035, p.timber).name =
          'Seasoning stave';
    }
    if (level >= 3) {
      // Finished resonators waiting for the terrace, grow lights and a crystal instrument.
      for (const [n, height] of [1.3, 1.7, 2.1, 1.5].entries())
        resonator(d, g, -4 + n * 0.42, 1.6 + n * 0.12, height);
      for (const x of [-2, 0, 2]) d.ball(g, x, 2.2, -1, 0.09, p.light, 'rock').name = 'Grow light';
      instrument(d, g, 1.9, 2.5, 0.8);
      lamp(d, g, -1.6, 2.6, GROUND);
    }
  },
  // Homes for the Far Rim. Every one keeps a lit window toward the stone.
  farRimHomes(d, g, level) {
    for (const x of [-2.2, 2.2]) {
      gable(d, g, x, -1.2, 2.7, 2.2, 1.5);
      for (const side of [-1, 1]) litWindow(d, g, 0.42, 0.4, x + side * 0.85, 1.25, -0.08);
    }
    // A shared porch between them: the door the lane leads to.
    module(d, g, 0, -0.8, 1.1, 1.2, 1.2, 0, p.light);
    if (level >= 2) {
      // A taller home behind, its upper window clear of the roofs in front.
      d.box(g, 3.4, 2.5, 1.7, 0, GROUND + 1.25, -3.6, p.shell);
      d.mesh(g, futureShape(d, 'gable'), [3.7, 1.1, 1.95], [0, GROUND + 2.5, -3.6], p.roof);
      d.box(g, 3.44, 0.08, 1.74, 0, 0.5, -3.6, p.light);
      for (const x of [-0.9, 0, 0.9]) litWindow(d, g, 0.44, 0.42, x, GROUND + 2.05, -2.74);
      lamp(d, g, -3.9, 1.3, GROUND);
      lamp(d, g, 3.9, 1.3, GROUND);
    }
    if (level >= 3) {
      // Glazed porches, planters and a bench that faces the stone.
      for (const x of [-2.2, 2.2]) {
        glassVault(d, g, x, 0.55, 2.4, { half: 0.55, height: 0.75 });
        planter(d, g, x + Math.sign(x) * 1.75, 1.6, 0.8);
      }
      d.box(g, 1.6, 0.14, 0.36, -2.4, 0.42, 2.9, p.timber).name = 'Stone-facing bench';
      d.box(g, 1.6, 0.14, 0.36, 2.4, 0.42, 2.9, p.timber).name = 'Stone-facing bench';
      d.rod(g, [0, GROUND + 3.6, -3.6], [0, GROUND + 4.4, -3.6], 0.03, p.deep);
      d.ball(g, 0, GROUND + 4.46, -3.6, 0.09, p.light, 'rock');
    }
  },
  // Lenses, tuning frames and wooden resonators, made by hand.
  resonanceWorkshop(d, g, level) {
    module(d, g, 0, -1, 3.6, 2, 1.6);
    const roof = d.mesh(g, 'cylinder', [1.8, 2.1, 0.5], [0, GROUND + 1.6, -1], p.roof);
    roof.rotation.x = Math.PI / 2;
    // A workbench with the first lens, and a tuning frame hung with tonewood bars.
    d.box(g, 1.5, 0.5, 0.7, 2.8, 0.5, 1.2, p.timber);
    lens(d, g, 2.8, 1.15, 1.2, 0.36);
    for (const x of [-3.3, -2.1]) d.rod(g, [x, GROUND, 1.3], [x, 1.7, 1.3], 0.045, p.deep);
    d.rod(g, [-3.3, 1.7, 1.3], [-2.1, 1.7, 1.3], 0.045, p.deep);
    for (const [n, length] of [0.9, 0.7, 0.5].entries())
      d.box(g, 0.12, length, 0.08, -3 + n * 0.3, 1.66 - length / 2, 1.3, p.timber).name =
        'Tuning bar';
    if (level >= 2) {
      // A grinding room under glass, and a great lens set up outside to be tested.
      dome(d, g, 3, -1.8, 0.95, 0.7);
      d.rod(g, [-3, GROUND, -1.9], [-3, 1.5, -1.9], 0.06, p.deep);
      lens(d, g, -3, 2.2, -1.9, 0.75);
      for (const [n, height] of [0.9, 1.3].entries()) resonator(d, g, -2.3 + n * 0.4, 2.6, height);
    }
    if (level >= 3) {
      // The finished rack of resonators, a roof lens aimed at the stone and a pulse lamp.
      for (const [n, height] of [1.7, 2.1, 1.5].entries())
        resonator(d, g, -1.5 + n * 0.4, 2.6, height, true);
      d.rod(g, [0, GROUND + 2.05, -1], [0, GROUND + 2.9, -1], 0.05, p.deep);
      lens(d, g, 0, GROUND + 3.4, -1, 0.55);
      pulseLamp(d, g, 1.2, GROUND + 2.2, -0.4, 0.1);
      lamp(d, g, 1.7, 2.9, GROUND);
    }
  },
  // Where New Hollow gathers before the stone. It stays low and open on the sight line:
  // benches at the sides, the resonators in a half circle behind, the transmitter slender.
  signalTerrace(d, g, level) {
    // The inlay stops short of where the path arrives, so the path stays the path.
    d.mesh(g, futureShape(d, 'octagon'), [3.6, 0.03, 3.6], [0, 0.275, -0.5], p.roof).name =
      'Terrace inlay';
    d.mesh(g, futureShape(d, 'octagon'), [1.5, 0.012, 1.5], [0, 0.296, -0.5], p.shell);
    // Two rows of benches at each side, turned to the stone.
    for (const side of [-1, 1])
      for (const [row, z] of [0.8, -0.8].entries()) {
        const bench = d.box(g, 1.7, 0.14, 0.4, side * (2.9 + row * 0.25), 0.44, z, p.timber);
        bench.rotation.y = -side * 0.35;
        bench.name = 'Terrace bench';
      }
    // A low marker where the path arrives: visitors stop beside it and look at the stone.
    d.box(g, 0.5, 0.8, 0.16, 0, GROUND + 0.4, 3.1, p.shell).name = 'Terrace threshold marker';
    d.box(g, 0.54, 0.05, 0.2, 0, GROUND + 0.82, 3.1, p.light);
    // The plinth the transmitter will stand on, and a lamp at each side of the gathering.
    d.mesh(g, futureShape(d, 'octagon'), [0.95, 0.4, 0.95], [0, 0.45, -3.2], p.shell);
    d.mesh(g, futureShape(d, 'octagon'), [1.02, 0.06, 1.02], [0, 0.66, -3.2], p.light);
    for (const side of [-1, 1]) lamp(d, g, side * 4.3, -2.2, GROUND);
    if (level >= 2) {
      // The resonators: one for every family, in a half circle open to the stone.
      for (let n = 0; n < 7; n++) {
        if (n === 3) continue;
        const a = Math.PI + ((n - 3) * Math.PI) / 9,
          x = Math.sin(a) * 4.5,
          z = -0.5 + Math.cos(a) * 4.5 + 0.9;
        resonator(d, g, x, z, 1.5 + (n % 3) * 0.3);
      }
      const hoop = d.mesh(g, futureShape(d, 'hoop'), [0.5, 0.5, 0.4], [0, 1.25, -3.2], p.light);
      hoop.name = 'Transmitter ring';
      for (const x of [-0.3, 0.3]) d.rod(g, [x, 0.68, -3.2], [x, 0.85, -3.2], 0.03, p.deep);
    }
    if (level >= 3) {
      // The shared transmitter: a lens in the ring, a small dish above it and two slender
      // masts. Crystals from the valley crown the resonators.
      d.mesh(
        g,
        futureShape(d, 'octagon'),
        [0.42, 0.05, 0.42],
        [0, 1.25, -3.2],
        p.glass,
      ).rotation.x = Math.PI / 2;
      d.rod(g, [0, 1.75, -3.2], [0, 2.3, -3.2], 0.035, p.deep);
      dish(d, g, 0, 2.3, -3.2, 0.5, 1.15, Math.PI).name = 'Transmitter dish';
      for (const side of [-1, 1]) {
        d.rod(g, [side * 1.5, 0.68, -3.4], [side * 1.5, 2.9, -3.4], 0.03, p.deep).name =
          'Transmitter mast';
        d.ball(g, side * 1.5, 2.95, -3.4, 0.07, p.light, 'rock');
        d.rod(g, [side * 1.5, 2.7, -3.4], [0, 1.75, -3.2], 0.012, p.light);
      }
      for (let n = 0; n < 7; n++) {
        if (n === 3) continue;
        const a = Math.PI + ((n - 3) * Math.PI) / 9,
          height = 1.5 + (n % 3) * 0.3;
        d.ball(
          g,
          Math.sin(a) * 4.5,
          GROUND + height + 0.24,
          0.4 + Math.cos(a) * 4.5,
          [0.1, 0.18, 0.1],
          p.glass,
          'rock',
        ).name = 'Resonator crystal';
      }
      for (const x of [-2.2, -1.1, 1.1, 2.2]) {
        d.rod(
          g,
          [x, GROUND, 3.6 - Math.abs(x) * 0.42],
          [x, 0.6, 3.6 - Math.abs(x) * 0.42],
          0.025,
          p.deep,
        );
        pulseLamp(d, g, x, 0.65, 3.6 - Math.abs(x) * 0.42, 0.07);
      }
    }
  },
  // A Willowkin root garden. The roots branch in one shape, again and again, smaller.
  patternGarden(d, g, level) {
    const z = -0.6;
    d.mesh(g, 'cylinder', [2.9, 0.22, 2.9], [0, 0.36, z], p.shell);
    d.mesh(g, 'cylinder', [2.7, 0.05, 2.7], [0, 0.47, z], p.deep).name = 'Root bed';
    for (let n = 0; n < 3; n++) rootPattern(d, g, 0, z, (n * TAU) / 3, 1.05, level + 1, 0.52);
    willowkinTree(d, g, 0, 0.5, z, 0.75);
    module(d, g, 0, 2.9, 1, 0.8, 0.8);
    if (level >= 2) {
      habitatGlass(d, d.mesh(g, futureShape(d, 'dome'), [2.75, 1.5, 2.75], [0, 0.47, z], p.glass));
      habitatRim(d, g, 0, 0.475, z, 2.93);
      d.box(g, 1.4, 0.14, 0.36, -2.6, 0.42, 2.5, p.timber).name = 'Garden bench';
    }
    if (level >= 3) {
      // A lifted paving stone shows the pattern beneath it; low lanterns ring the bed.
      const stone = d.box(g, 0.9, 0.08, 0.9, 2.6, 0.62, 2.3, p.shell);
      stone.rotation.z = 0.5;
      stone.name = 'Lifted paving stone';
      for (const turn of [-0.6, 0, 0.6])
        d.rod(
          g,
          [2.4, 0.29, 2.3],
          [2.4 + Math.sin(turn) * 0.5, 0.29, 2.3 + Math.cos(turn) * 0.5],
          0.025,
          p.timber,
        );
      for (const degrees of [45, 135, 225, 315]) {
        const a = (degrees * Math.PI) / 180,
          x = Math.sin(a) * 3.5,
          lz = z + Math.cos(a) * 3.5;
        d.rod(g, [x, GROUND, lz], [x, 0.9, lz], 0.03, p.deep);
        d.ball(g, x, 0.96, lz, [0.1, 0.13, 0.1], p.light, 'rock');
      }
    }
  },
};

// Which way the stone lies from a lot, as a dish's turn in the lot's own frame.
function towardStone(kind) {
  const { x, z, rotation } = moonLotPose(kind),
    [sx, sz] = MOON_DISTRICTS.farRim.centre;
  const wx = sx - x,
    wz = sz - z;
  const lx = wx * Math.cos(rotation) - wz * Math.sin(rotation),
    lz = wx * Math.sin(rotation) + wz * Math.cos(rotation);
  return Math.atan2(-lx, -lz);
}
/** The Quiet Signal's modernized finishes of earlier Moon buildings (moonFinishes.js). */
export const SIGNAL_FINISHES = {
  // Stonewatch Dish: the starwatch gains a dish that looks past the rim, at the stone.
  starwatchDish(d, g, step) {
    const turn = towardStone('starwatchDish'),
      [x, z] = [2.9, -2.3];
    d.mesh(g, 'cylinder', [0.34, 0.5, 0.34], [x, 0.5, z], p.shell);
    d.rod(g, [x, 0.7, z], [x, 3.3, z], 0.1, p.shell).name = 'Stonewatch mast';
    d.mesh(g, 'cylinder', [0.2, 0.08, 0.2], [x, 3.3, z], p.light);
    trackingDish(d, g, x, 3.35, z, 1.25, turn, 0.6);
    if (step >= 2) {
      // A recording room, with a lamp that swells at every pulse.
      module(d, g, -2.7, -2.2, 1.5, 1.3, 1.1, 0.5);
      d.rod(g, [-2.7, 1.35, -2.2], [-2.7, 1.9, -2.2], 0.035, p.deep);
      pulseLamp(d, g, -2.7, 1.98, -2.2, 0.12);
      d.rod(g, [-1.9, 0.3, -2], [2.6, 0.3, -2.3], 0.03, p.deep);
    }
    if (step >= 3)
      // A line of small aerials, all leaning the way the dish looks.
      for (let n = 0; n < 4; n++) {
        const ax = -1.2 + n * 0.8,
          az = -3.6;
        d.rod(
          g,
          [ax, GROUND, az],
          [ax - Math.sin(turn) * 0.3, 1.5, az - Math.cos(turn) * 0.3],
          0.025,
          p.deep,
        );
        d.ball(
          g,
          ax - Math.sin(turn) * 0.3,
          1.55,
          az - Math.cos(turn) * 0.3,
          0.06,
          p.light,
          'rock',
        );
      }
  },
};
