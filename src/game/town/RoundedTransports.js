import { ROUNDED_PALETTE as P } from '../../data/roundedArchitecture';

// Transport for rounded eras, from the shared sphere and cylinder primitives. These
// move every frame, so each vehicle keeps to a handful of meshes and palette colors.
const pod = (d, g, size, position, color) => d.mesh(g, 'sphere', size, position, color);

/** An electric blended-wing liner. Nose along +Z and wheels at y = 0, like the jets. */
export function roundedAircraft(d, parent) {
  const plane = d.group(parent);
  pod(d, plane, [0.52, 0.48, 3.3], [0, 0.95, 0], P.shell);
  pod(d, plane, [0.53, 0.14, 2.3], [0, 1.05, 0.2], P.glass);
  pod(d, plane, [0.36, 0.3, 0.9], [0, 1.2, 2.2], P.glass);
  pod(d, plane, [3.4, 0.1, 1.15], [0, 0.85, -0.6], P.shell);
  pod(d, plane, [0.08, 0.75, 0.6], [0, 1.6, -2.7], P.accent);
  pod(d, plane, [1.3, 0.07, 0.45], [0, 1.15, -2.85], P.accent);
  for (const [side, name] of [
    [-1, 'propellerLeft'],
    [1, 'propellerRight'],
  ]) {
    // Ducted electric fans; the named discs keep the shared spin animation.
    const duct = d.mesh(plane, 'cylinder', [0.32, 1, 0.32], [side * 1.55, 0.72, -0.5], P.deep);
    duct.rotation.x = Math.PI / 2;
    const fan = pod(d, plane, [0.27, 0.27, 0.04], [side * 1.55, 0.72, 0.02], P.light);
    fan.name = name;
  }
  for (const [x, z] of [
    [0, 2.1],
    [-0.55, -0.4],
    [0.55, -0.4],
  ])
    pod(d, plane, [0.13, 0.26, 0.16], [x, 0.26, z], P.deep);
  return plane;
}

/** One maglev pod carriage. Authored along +Z like the city railcars, then turned a
 * quarter so its forward axis follows the track and pitches with the carriage. */
export function roundedRailcar(d, parent, lead = false) {
  const car = d.group(parent);
  car.rotation.y = Math.PI / 2;
  pod(d, car, [0.6, 0.56, 1.85], [0, 0.95, 0], lead ? P.warm : P.shell);
  pod(d, car, [0.62, 0.2, 1.75], [0, 1.08, 0], P.glass);
  d.box(car, 0.8, 0.18, 3.2, 0, 0.38, 0, P.deep, true);
  if (lead) pod(d, car, [0.5, 0.32, 0.55], [0, 0.98, 1.55], P.glass);
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
