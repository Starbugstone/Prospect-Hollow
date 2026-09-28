import { ROUNDED_PALETTE as P } from '../../data/roundedArchitecture';

// Transport for rounded eras, from the shared sphere and cylinder primitives. These
// move every frame, so each vehicle keeps to a handful of meshes and palette colors.
const pod = (d, g, size, position, color) => d.mesh(g, 'sphere', size, position, color);

/** A saucer-style sky shuttle: a flat disc under a glass dome, standing on three landing
 * legs that reach from the hull to the ground (y = 0). Its lit rim ring spins using the
 * shared "propeller" hook, so the flight animation needs no special case. */
export function roundedAircraft(d, parent) {
  const saucer = d.group(parent);
  const hull = 0.95;
  pod(d, saucer, [2.5, 0.42, 2.5], [0, hull, 0], P.shell);
  d.mesh(saucer, 'cylinder', [2.56, 0.1, 2.56], [0, hull, 0], P.accent);
  pod(d, saucer, [1.05, 0.72, 1.05], [0, hull + 0.25, 0], P.glass);
  pod(d, saucer, [1.3, 0.16, 1.3], [0, hull - 0.34, 0], P.light);
  for (let n = 0; n < 3; n++) {
    const a = (n / 3) * Math.PI * 2 + Math.PI / 6;
    const top = [Math.cos(a) * 1.1, hull - 0.1, Math.sin(a) * 1.1];
    const foot = [Math.cos(a) * 1.55, 0.05, Math.sin(a) * 1.55];
    d.rod(saucer, top, foot, 0.06, P.deep);
    d.mesh(saucer, 'cylinder', [0.2, 0.05, 0.2], foot, P.deep);
  }
  // The shared propeller animation spins a named group around its local Z. Tilting the
  // group upright makes that Z the saucer's vertical axis, so the rim lights circle.
  const upright = d.group(saucer, 0, hull, 0);
  upright.rotation.x = -Math.PI / 2;
  const ring = d.group(upright);
  ring.name = 'propellerLeft';
  for (let n = 0; n < 4; n++) {
    const a = (n / 4) * Math.PI * 2;
    pod(d, ring, [0.2, 0.2, 0.09], [Math.cos(a) * 2.35, Math.sin(a) * 2.35, 0], P.light);
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
