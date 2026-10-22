import { ROUNDED_PALETTE as P } from '../../data/roundedArchitecture';
import { skySaucer } from '../../data/skyCraft';

// Transport for rounded eras, from the shared sphere and cylinder primitives. These
// move every frame, so each vehicle keeps to a handful of meshes and palette colors.
const pod = (d, g, size, position, color) => d.mesh(g, 'sphere', size, position, color);
// A flat band around the dome's foot (the torus is authored upright).
const band = (d, g, radius, y, color) => {
  const mesh = d.mesh(g, 'ring', [radius, radius, 0.6], [0, y, 0], color);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
};

// The saucer's era trait: at most two meshes in the trait colour. `top` is the dome's
// crown and `base` the height where the dome meets the hull; the stern faces local -Z.
const SAUCER_TRAITS = {
  // Canopy: a pair of leaves sprouting from the crown.
  leaves(d, g, c, top) {
    for (const side of [-1, 1]) {
      const leaf = pod(d, g, [0.16, 0.05, 0.5], [side * 0.2, top + 0.08, -0.05], c.traitColor);
      leaf.rotation.set(-0.45, side * 0.5, side * 0.65);
    }
  },
  // Riverlight: a lavender crystal finial and a garden ring at the dome's foot.
  crystal(d, g, c, top, base) {
    d.mesh(g, 'rock', [0.15, 0.24, 0.15], [0, top + 0.06, 0], c.rim);
    band(d, g, 1.03, base, c.traitColor);
  },
  // Skysail: a saffron sail fin and a pennant at the stern.
  sails(d, g, c, top) {
    pod(d, g, [0.05, 0.5, 0.42], [0, top - 0.25, -1.0], c.traitColor).rotation.x = -0.35;
    d.box(g, 0.04, 0.16, 0.4, 0, top + 0.14, -1.25, c.traitColor);
  },
  // Stargazer: a copper band around the dome and a star on top.
  star(d, g, c, top, base) {
    band(d, g, 1.03, base, c.traitColor);
    d.mesh(g, 'rock', [0.15, 0.15, 0.15], [0, top + 0.1, 0], c.light);
  },
  // Moonward: gold trim around the dome and a gold landing beacon.
  'gold-trim'(d, g, c, top, base) {
    band(d, g, 1.03, base, c.traitColor);
    pod(d, g, [0.11, 0.13, 0.11], [0, top + 0.05, 0], c.traitColor);
  },
  // Twin Hollows: twin lanterns, one for the valley and one for the Moon.
  'twin-lanterns'(d, g, c, top, base) {
    pod(d, g, [0.15, 0.19, 0.15], [-1.0, base + 0.08, 0], c.traitColor);
    pod(d, g, [0.15, 0.19, 0.15], [1.0, base + 0.08, 0], c.light);
  },
};

/** A saucer-style sky shuttle: a flat disc under a glass dome, standing on three landing
 * legs that reach from the hull to the ground (y = 0). Colours and one small trait follow
 * the airport's era (`skySaucer()` in skyCraft.js); an unknown trait draws nothing.
 * The flight animation drives two named parts: `propellerLeft`, the rim lights, which
 * circle the hull's vertical axis, and `saucerLegs`, folded up in flight. Its departure
 * and arrival trail is added by the flight (SaucerTrails.js). */
export function roundedAircraft(d, parent, c = skySaucer()) {
  const saucer = d.group(parent);
  const hull = 0.95;
  pod(d, saucer, [2.5, 0.42, 2.5], [0, hull, 0], c.shell);
  d.mesh(saucer, 'cylinder', [2.56, 0.1, 2.56], [0, hull, 0], c.rim);
  pod(d, saucer, [1.05, 0.72, 1.05], [0, hull + 0.25, 0], c.glass);
  pod(d, saucer, [1.3, 0.16, 1.3], [0, hull - 0.34, 0], c.light);
  SAUCER_TRAITS[c.trait]?.(d, saucer, c, hull + 0.97, hull + 0.42);
  // The legs hang from one pivot inside the hull, so scaling it folds them up together.
  const legs = d.group(saucer, 0, hull - 0.1, 0);
  legs.name = 'saucerLegs';
  for (let n = 0; n < 3; n++) {
    const a = (n / 3) * Math.PI * 2 + Math.PI / 6;
    const top = [Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1];
    const foot = [Math.cos(a) * 1.55, 0.05 - legs.position.y, Math.sin(a) * 1.55];
    d.rod(legs, top, foot, 0.06, c.deep);
  }
  // The rim lights circle a named group around its local Z. Tilting the group upright
  // makes that Z the saucer's vertical axis.
  const upright = d.group(saucer, 0, hull, 0);
  upright.rotation.x = -Math.PI / 2;
  const ring = d.group(upright);
  ring.name = 'propellerLeft';
  for (let n = 0; n < 4; n++) {
    const a = (n / 4) * Math.PI * 2;
    pod(d, ring, [0.2, 0.2, 0.09], [Math.cos(a) * 2.35, Math.sin(a) * 2.35, 0], c.light);
  }
  return saucer;
}

/** One carriage of the Tomorrow solar express, running on the shared rails. Authored
 * along +Z like the city railcars, then turned a quarter so its forward axis follows the
 * track and pitches with the carriage. Returns the wheel axles for the rolling animation. */
export function roundedRailcar(d, parent, lead = false) {
  const car = d.group(parent);
  car.rotation.y = Math.PI / 2;
  const along = (mesh) => {
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  along(d.mesh(car, 'cylinder', [0.6, 3.1, 0.52], [0, 1.0, 0], P.shell));
  along(d.mesh(car, 'cylinder', [0.62, 3, 0.18], [0, 1.12, 0], P.glass));
  // A continuous under-skirt carries the bogies; the wheels show below it on the rails.
  d.box(car, 1.2, 0.24, 3.4, 0, 0.5, 0, P.deep, true);
  pod(d, car, [0.6, 0.52, 0.32], [0, 1.0, -1.55], P.shell);
  if (lead) {
    d.box(car, 0.3, 0.06, 3.1, 0, 1.52, 0, P.warm);
    pod(d, car, [0.6, 0.52, 1.35], [0, 1.0, 1.55], P.shell);
    pod(d, car, [0.48, 0.28, 0.7], [0, 1.2, 2.05], P.glass);
  } else pod(d, car, [0.6, 0.52, 0.32], [0, 1.0, 1.55], P.shell);
  const wheels = [];
  for (const z of [-1.1, 1.1]) {
    // One axle mesh spans both rails; ZYX order lets the animation spin it about its axis.
    const axle = d.mesh(car, 'cylinder', [0.2, 1.1, 0.2], [0, 0.22, z], '#3f4d4a');
    axle.rotation.order = 'ZYX';
    axle.rotation.z = Math.PI / 2;
    wheels.push(axle);
  }
  car.userData.wheels = wheels;
  return car;
}

/** A hover ferry with a glazed dome cabin. Bow along +Z. */
export function roundedFerry(d, parent) {
  const boat = d.group(parent);
  pod(d, boat, [1, 0.42, 2.6], [0, 0.05, 0], P.shell);
  d.mesh(boat, 'cylinder', [1.02, 0.08, 2.62], [0, 0.26, 0], P.accent);
  pod(d, boat, [0.75, 0.62, 1.35], [0, 0.4, -0.15], P.glass);
  d.mesh(boat, 'cylinder', [0.8, 0.07, 1.4], [0, 0.72, -0.15], P.shell);
  pod(d, boat, [0.18, 0.12, 0.18], [0, 1.08, -0.15], P.light);
  return boat;
}
