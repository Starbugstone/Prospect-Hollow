import { MeshBasicMaterial } from 'three';
import { futureShape } from '../buildings/futureShapes';

// Voyagers' Court, The Quiet Signal's monument site: three keepsakes of the old dream of
// travelling further, each in New Hollow's own language (moon-white ceramic, gold trim,
// navy panels, an octagonal deck). Every level develops its composition, and each keeps a
// silhouette that reads from the usual map camera: a dark panel with one red light, two
// wheels on an axle, a ball with two arms.
const SHELL = '#ece9e1',
  IVORY = '#f3ecd9',
  NAVY = '#27365a',
  PANEL = '#161b28',
  STEEL = '#657481',
  GOLD = '#e8b84a',
  GLASS = '#a9dbe0';
export const SIGNAL_LANDMARK_FORMS = ['steady-lens', 'twin-wheel', 'work-pod'];
const TAU = Math.PI * 2;
// The monument pedestal's top, where every design stands.
const DECK = 0.6;

/** An octagonal deck or slab, a corner toward the front like every Moon parcel. */
function octagon(d, g, radius, height, y, colour) {
  return d.mesh(g, futureShape(d, 'octagon'), [radius, height, radius], [0, y, 0], colour);
}
// An unlit colour: a light that is on, the same in sun and in the shadow of a canopy.
function lit(d, mesh, colour) {
  const key = `signal-lit-${colour}`;
  if (!d.materials.has(key)) d.materials.set(key, new MeshBasicMaterial({ color: colour }));
  mesh.material = d.materials.get(key);
  mesh.castShadow = false;
  return mesh;
}
function lamp(d, g, x, z, height = 1.3) {
  d.rod(g, [x, DECK, z], [x, DECK + height, z], 0.05, STEEL);
  d.ball(g, x, DECK + height + 0.1, z, 0.15, GOLD, 'rock');
}

// A low pavilion for a reckoning engine. One dark instrument panel faces the court, with a
// single steady red lens in a gold ring. The lens never blinks; from level 3 only the small
// indicator rows on its consoles breathe.
function steadyLens(d, g, tier, move) {
  octagon(d, g, 4.7, 0.3, DECK + 0.15, SHELL);
  octagon(d, g, 3.9, 0.06, DECK + 0.33, NAVY);
  const floor = DECK + 0.36;
  // The panel: a tall dark slab in a white ceramic frame.
  d.box(g, 2.2, 3, 0.9, 0, floor + 1.5, -0.6, SHELL, true);
  d.box(g, 1.7, 2.6, 0.12, 0, floor + 1.55, -0.12, PANEL);
  const bezel = d.mesh(
    g,
    futureShape(d, 'hoop'),
    [0.36, 0.36, 0.3],
    [0, floor + 2.05, -0.03],
    GOLD,
  );
  bezel.name = 'Lens bezel';
  lit(d, d.ball(g, 0, floor + 2.05, -0.04, [0.27, 0.27, 0.1], '#e23a2c'), '#e23a2c').name =
    'Steady red lens';
  lit(d, d.ball(g, 0.06, floor + 2.11, 0.03, [0.07, 0.07, 0.03], '#ffb199'), '#ffb199');
  // A grille and a nameplate below the lens, as on any instrument.
  for (let n = 0; n < 4; n++) d.box(g, 0.9, 0.04, 0.03, 0, floor + 0.75 + n * 0.14, -0.05, STEEL);
  d.box(g, 0.7, 0.14, 0.03, 0, floor + 1.45, -0.05, GOLD);
  // A flat navy canopy on four slender columns keeps the pavilion low.
  for (const x of [-1.75, 1.75])
    for (const z of [-1.9, 1.5]) d.rod(g, [x, floor, z], [x, floor + 3.3, z], 0.09, SHELL);
  d.box(g, 4.2, 0.22, 4.4, 0, floor + 3.4, -0.2, NAVY);
  d.box(g, 4.4, 0.08, 4.6, 0, floor + 3.27, -0.2, GOLD);
  if (tier >= 2)
    // Instrument wings: two consoles angled toward whoever stands before the lens.
    for (const side of [-1, 1]) {
      const wing = d.group(g, side * 2.95, 0, 0.1);
      wing.rotation.y = -side * 0.55;
      wing.name = 'Instrument wing';
      d.box(wing, 1.9, 1.5, 0.9, 0, floor + 0.75, 0, SHELL, true);
      d.box(wing, 1.94, 0.1, 0.94, 0, floor + 0.3, 0, GOLD);
      const desk = d.box(wing, 1.7, 0.08, 0.7, 0, floor + 1.56, 0.08, PANEL);
      desk.rotation.x = 0.35;
      // The console's indicator row. From level 3 it breathes slowly; the lens never does.
      const row = d.group(wing, 0, floor + 1.64, 0.2);
      row.name = 'Console indicators';
      for (let n = 0; n < 5; n++)
        lit(
          d,
          d.box(row, 0.14, 0.06, 0.14, -0.6 + n * 0.3, 0, 0, GOLD),
          n % 2 ? '#a9dbe0' : '#f3cf6b',
        );
      if (tier >= 3) move(row, 'pulse', 'y', 0.7, 0.35, side);
    }
  if (tier >= 3) {
    // The court is lit: a ring of low lamps, and a bench for sitting with a question.
    for (let n = 0; n < 8; n++) {
      const a = (n + 0.5) * (TAU / 8);
      lamp(d, g, Math.sin(a) * 4.2, Math.cos(a) * 4.2, 0.5);
    }
    d.box(g, 2.2, 0.16, 0.5, 0, floor + 0.42, 2.9, SHELL);
    for (const x of [-0.8, 0.8]) d.box(g, 0.2, 0.42, 0.4, x, floor + 0.21, 2.9, NAVY);
  }
  if (tier >= 4) {
    // Memory stacks behind the panel: tall cabinets with a navy slot for every year kept.
    for (const side of [-1, 1])
      for (const row of [0, 1]) {
        const x = side * (1.6 + row * 1.15),
          h = 2.5 - row * 0.5;
        d.box(g, 0.95, h, 0.8, x, floor + h / 2, -2.6, SHELL, true);
        for (let n = 0; n < Math.round(h / 0.36) - 1; n++)
          d.box(g, 0.7, 0.14, 0.04, x, floor + 0.38 + n * 0.36, -2.19, NAVY);
      }
    d.box(g, 6.6, 0.12, 0.3, 0, floor + 0.06, -2.6, GOLD);
  }
  if (tier >= 5) {
    // A glazed lantern over the panel and a slender mast: the pavilion's crown.
    d.box(g, 2.6, 0.7, 1.6, 0, floor + 3.86, -0.5, GLASS);
    d.box(g, 2.9, 0.14, 1.9, 0, floor + 4.28, -0.5, NAVY);
    d.box(g, 3.05, 0.07, 2.05, 0, floor + 4.18, -0.5, GOLD);
    d.rod(g, [0, floor + 4.35, -0.5], [0, floor + 6.4, -0.5], 0.05, STEEL);
    d.ball(g, 0, floor + 6.48, -0.5, 0.13, GOLD, 'rock');
    for (const x of [-3.4, 3.4]) {
      d.box(g, 0.7, 0.5, 0.7, x, floor + 0.25, 2.6, NAVY);
      d.ball(g, x, floor + 0.72, 2.6, [0.3, 0.42, 0.3], '#9b91c4', 'rock');
    }
  }
}

// One wheel of the station: a rim on spokes about a hub, in the plane across its axle.
function wheel(d, g, z, radius, { frame = false } = {}) {
  const colour = frame ? GOLD : SHELL;
  const rim = d.mesh(g, 'ring', [radius, radius, frame ? 1.2 : 3], [0, 0, z], colour);
  rim.name = frame ? 'Station wheel frame' : 'Station wheel';
  // A thin navy line of windows round the outside of a finished wheel.
  if (!frame) d.mesh(g, 'ring', [radius * 1.07, radius * 1.07, 0.9], [0, 0, z], NAVY);
  for (let n = 0; n < (frame ? 8 : 4); n++) {
    const a = (n * TAU) / (frame ? 8 : 4) + (frame ? TAU / 16 : 0);
    d.rod(
      g,
      [0, 0, z],
      [Math.cos(a) * radius * 0.94, Math.sin(a) * radius * 0.94, z],
      frame ? 0.045 : 0.09,
      frame ? GOLD : SHELL,
    );
  }
}
// A model of a double-wheel station on a sculpted support. The second wheel begins as an
// open gold frame and is clad later; from level 3 the station turns slowly about its axle.
function twinWheel(d, g, tier, move) {
  octagon(d, g, 4.4, 0.3, DECK + 0.15, SHELL);
  octagon(d, g, 2.2, 0.3, DECK + 0.45, NAVY);
  const floor = DECK + 0.6,
    axis = floor + 4.4 + (tier >= 5 ? 0.8 : 0);
  // The support: two ceramic blades rising in a narrow V to a yoke under the axle.
  for (const side of [-1, 1]) {
    const blade = d.box(
      g,
      0.5,
      axis - floor - 0.2,
      1.1,
      side * 0.75,
      (axis + floor) / 2 - 0.2,
      0,
      SHELL,
      true,
    );
    blade.rotation.z = side * 0.16;
    blade.name = 'Station support blade';
  }
  d.box(g, 1, 0.3, 1.2, 0, axis - 0.5, 0, GOLD);
  const station = d.group(g, 0, axis, 0);
  // Turned a little, so both wheels show from the court and from the usual camera.
  station.rotation.y = 0.95;
  station.name = 'Twin wheel station';
  const rotor = d.group(station);
  const axle = d.mesh(rotor, 'cylinder', [0.26, tier >= 4 ? 5.6 : 3.4, 0.26], [0, 0, 0], SHELL);
  axle.rotation.x = Math.PI / 2;
  const hub = d.mesh(rotor, 'cylinder', [0.5, 0.8, 0.5], [0, 0, 1.1], NAVY);
  hub.rotation.x = Math.PI / 2;
  wheel(d, rotor, 1.1, 2.5);
  if (tier >= 2) {
    wheel(d, rotor, -1.1, 2.5, { frame: tier < 3 });
    const second = d.mesh(
      rotor,
      'cylinder',
      [0.5, 0.8, 0.5],
      [0, 0, -1.1],
      tier < 3 ? STEEL : NAVY,
    );
    second.rotation.x = Math.PI / 2;
  }
  if (tier >= 3) {
    // A lit docking port at the bow of the hub.
    const port = d.mesh(rotor, futureShape(d, 'octagon'), [0.42, 0.3, 0.42], [0, 0, 1.65], NAVY);
    port.rotation.x = Math.PI / 2;
    lit(d, d.ball(rotor, 0, 0, 1.83, [0.2, 0.2, 0.05], '#f3cf6b'), '#f3cf6b');
    // Lit windows round the hub.
    for (let n = 0; n < 4; n++) {
      const a = (n + 0.5) * (TAU / 4);
      lit(d, d.ball(rotor, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 1.1, 0.07, '#f3cf6b'), '#f3cf6b');
    }
    move(rotor, 'turn', 'z', 0.16);
  }
  if (tier >= 4) {
    // The full docking structure: a collar and a boom at each end of the axle, navy panels
    // on the stern, and a little white shuttle waiting off the bow.
    for (const z of [-2.8, 2.8]) {
      const collar = d.mesh(rotor, futureShape(d, 'octagon'), [0.55, 0.22, 0.55], [0, 0, z], GOLD);
      collar.rotation.x = Math.PI / 2;
    }
    for (const side of [-1, 1]) {
      d.rod(station, [0, 0, -2.8], [0, side * 1.3, -3.2], 0.05, STEEL);
      d.box(station, 0.06, 1.5, 0.9, 0, side * 2, -3.3, NAVY);
    }
    const shuttle = d.group(station, 0.2, 0.35, 4.2);
    shuttle.name = 'Waiting shuttle';
    d.box(shuttle, 0.34, 0.24, 0.9, 0, 0, 0, SHELL, true);
    d.box(shuttle, 1, 0.05, 0.4, 0, -0.04, -0.2, SHELL);
    d.box(shuttle, 0.2, 0.1, 0.24, 0, 0.1, 0.24, NAVY);
    d.rod(station, [0, 0, 2.9], [0.2, 0.3, 3.7], 0.03, GOLD);
  }
  if (tier >= 5) {
    // The station stands higher, on a terrace of its own with a lamp at each corner.
    octagon(d, g, 3.3, 0.5, floor + 0.25, SHELL);
    octagon(d, g, 3.45, 0.08, floor + 0.42, GOLD);
    for (const side of [-1, 1])
      d.box(g, 0.56, 0.12, 1.16, side * 0.62, floor + 1.4, 0, GOLD).rotation.z = side * 0.16;
    for (let n = 0; n < 4; n++) {
      const a = (n + 0.5) * (TAU / 4);
      lamp(d, g, Math.sin(a) * 3.9, Math.cos(a) * 3.9, 1);
    }
  }
}

// One arm of the pod: shoulder, elbow and an open claw, reaching forward and down.
function podArm(d, pod, side) {
  // Wide at the elbow so each arm reads as its own shape from the map camera, then in
  // over the sample. Thick ivory limbs, a navy ball at every joint, a gold claw and one
  // lit work lamp at the tip.
  const shoulder = [side * 1.05, -0.95, 0.75],
    elbow = [side * 2.35, -0.25, 2.2],
    wrist = [side * 0.62, -1.2, 3.15];
  d.rod(pod, shoulder, elbow, 0.15, IVORY).name = 'Pod upper arm';
  d.rod(pod, elbow, wrist, 0.12, IVORY).name = 'Pod forearm';
  d.ball(pod, ...shoulder, 0.26, NAVY);
  d.ball(pod, ...elbow, 0.24, NAVY).name = 'Pod elbow';
  d.ball(pod, ...wrist, 0.2, NAVY);
  for (const finger of [-1, 1])
    d.rod(
      pod,
      wrist,
      [wrist[0] - side * 0.3 + finger * 0.16, wrist[1] - 0.36, wrist[2] + finger * 0.14],
      0.055,
      GOLD,
    );
  lit(
    d,
    d.ball(pod, wrist[0] - side * 0.24, wrist[1] - 0.14, wrist[2], 0.16, '#fff3d2'),
    '#fff3d2',
  ).name = 'Pod arm lamp';
}
// A small ivory work pod held over a display terrace. Its two arms reach out over a
// crystal sample from the valley mine; later levels complete the exhibit around it.
function workPod(d, g, tier, move, colour) {
  octagon(d, g, 4.6, 0.3, DECK + 0.15, SHELL);
  octagon(d, g, 3.6, 0.06, DECK + 0.33, NAVY);
  const floor = DECK + 0.36,
    centre = floor + 3.2;
  // A cradle: two navy ribs curving up behind the pod to hold it over the terrace.
  for (const side of [-1, 1]) {
    d.rod(g, [side * 1.5, floor, -1.9], [side * 1.25, centre - 0.2, -1.5], 0.16, NAVY);
    d.rod(g, [side * 1.25, centre - 0.2, -1.5], [side * 0.9, centre, -0.8], 0.14, NAVY);
  }
  d.box(g, 3.4, 0.3, 0.9, 0, floor + 0.15, -1.9, SHELL);
  const pod = d.group(g, 0, centre, -0.4);
  pod.name = 'Ivory work pod';
  d.ball(pod, 0, 0, 0, 1.55, IVORY);
  // One round dark window in a gold rim, like a New Hollow hatch, and a gold seam.
  const port = d.group(pod, 0, 0.3, 1.36);
  port.rotation.x = -0.22;
  port.name = 'Pod window';
  d.mesh(port, futureShape(d, 'octagon'), [0.78, 0.2, 0.78], [0, 0, 0], PANEL).rotation.x =
    Math.PI / 2;
  d.mesh(port, futureShape(d, 'octagon'), [0.9, 0.12, 0.9], [0, 0, -0.06], GOLD).rotation.x =
    Math.PI / 2;
  const seam = d.mesh(pod, 'ring', [1.56, 1.56, 0.5], [0, -0.35, 0], GOLD);
  seam.rotation.x = Math.PI / 2;
  // The sample: a crystal from the valley mine on a low plinth before the pod.
  d.mesh(g, futureShape(d, 'octagon'), [0.75, 0.7, 0.75], [0, floor + 0.35, 2.75], SHELL);
  d.mesh(g, futureShape(d, 'octagon'), [0.82, 0.07, 0.82], [0, floor + 0.72, 2.75], GOLD);
  const sample = d.ball(g, 0, floor + 1.3, 2.75, [0.36, 0.6, 0.36], colour, 'rock');
  sample.name = 'Crystal sample';
  if (tier >= 2) for (const side of [-1, 1]) podArm(d, pod, side);
  if (tier >= 3) {
    // Work lights on the pod's brow, and the sample turning slowly under them.
    for (const x of [-0.5, 0, 0.5])
      lit(d, d.ball(pod, x, 1.2, 0.95 - Math.abs(x) * 0.3, 0.1, '#f3cf6b'), '#f3cf6b');
    d.rod(pod, [0, 1.5, -0.2], [0, 2.1, -0.2], 0.03, STEEL);
    d.ball(pod, 0, 2.15, -0.2, 0.07, GOLD, 'rock');
    move(sample, 'turn', 'y', 0.3);
  }
  if (tier >= 4) {
    // A fuller exhibit: thruster packs on the pod, a hoop of the bay it would fly from
    // behind it, and two glass cases of smaller samples.
    for (const side of [-1, 1]) {
      d.box(pod, 0.35, 0.6, 0.7, side * 1.55, -0.3, -0.35, SHELL, true);
      d.box(pod, 0.2, 0.2, 0.12, side * 1.6, -0.3, -0.76, NAVY);
    }
    const bay = d.mesh(g, 'ring', [2.75, 2.75, 2.2], [0, centre, -2.3], SHELL);
    bay.name = 'Pod bay hoop';
    d.mesh(g, 'ring', [2.5, 2.5, 0.6], [0, centre, -2.3], GOLD);
    for (const side of [-1, 1]) {
      d.box(g, 0.9, 0.5, 0.9, side * 2.7, floor + 0.25, 2, SHELL);
      d.box(g, 0.8, 0.6, 0.8, side * 2.7, floor + 0.8, 2, GLASS);
      d.ball(
        g,
        side * 2.7,
        floor + 0.72,
        2,
        [0.16, 0.26, 0.16],
        side > 0 ? '#76b0a6' : GOLD,
        'rock',
      );
    }
  }
  if (tier >= 5) {
    // The terrace complete: a gold rail, lamps, and a small dish that follows the pod.
    for (let n = 0; n < 8; n++) {
      const a = (n + 0.5) * (TAU / 8),
        b = (n + 1.5) * (TAU / 8);
      // The front stays open for whoever walks up to the sample.
      if (n === 7 || n === 0) continue;
      d.rod(
        g,
        [Math.sin(a) * 4.3, floor + 0.7, Math.cos(a) * 4.3],
        [Math.sin(b) * 4.3, floor + 0.7, Math.cos(b) * 4.3],
        0.04,
        GOLD,
      );
      lamp(d, g, Math.sin(a) * 4.3, Math.cos(a) * 4.3, 0.75);
    }
    d.rod(g, [-3.1, floor, -2.4], [-3.1, floor + 4.6, -2.4], 0.07, STEEL);
    const dish = d.mesh(g, 'cone', [0.75, 0.3, 0.75], [-3.1, floor + 4.7, -2.3], SHELL);
    dish.rotation.x = Math.PI / 2 + 0.5;
    d.ball(g, -3.1, floor + 4.86, -2.02, 0.07, GOLD, 'rock');
  }
}

/** Build one of Voyagers' Court's designs at `tier` (1 to 5) on the shared pedestal. */
export function buildSignalLandmark(d, g, option, tier, move) {
  // The base every design shares: a moon-white octagon with a navy band and a gold edge.
  octagon(d, g, 5.1, DECK, DECK / 2, SHELL);
  octagon(d, g, 5.16, 0.1, DECK - 0.2, NAVY);
  octagon(d, g, 4.95, 0.04, DECK + 0.01, GOLD);
  if (option.form === 'steady-lens') steadyLens(d, g, tier, move);
  else if (option.form === 'twin-wheel') twinWheel(d, g, tier, move);
  else workPod(d, g, tier, move, option.colour);
}
