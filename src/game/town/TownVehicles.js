import { isCityEra } from '../../data/city';
import { hasRoundedTransport, ROUNDED_PALETTE } from '../../data/roundedArchitecture';
import { cityModel } from './buildings/city';
const cream = '#e1cfab',
  glass = '#9cbbb5';
export function motorVehicle(d, parent, bus = false, appearanceEra) {
  const era = appearanceEra ?? d.town?.era ?? d.town?.buildingEras?.[bus ? 'busDepot' : 'stable'];
  if (hasRoundedTransport(era)) return hoverPod(d, parent, bus);
  if (isCityEra(era)) {
    const root = cityModel(d, parent, `${era}-${bus ? 'bus' : 'car'}`);
    root.userData.vehicleBox = { halfWidth: 0.36, halfLength: bus ? 1.2 : 0.85 };
    root.userData.wheels = [];
    root.traverse((o) => {
      if (/^wheel[0-9]+$/.test(o.name)) root.userData.wheels.push(o);
    });
    return root;
  }
  const root = d.group(parent);
  root.userData.vehicleBox = { halfWidth: 0.36, halfLength: bus ? 0.9 : 0.6 };
  root.userData.wheels = [];
  d.box(root, 0.65, 0.38, bus ? 1.75 : 1.15, 0, 0.48, 0, bus ? '#d8b976' : '#819faa');
  d.box(root, 0.57, bus ? 0.43 : 0.3, bus ? 1.55 : 0.65, 0, 0.8, bus ? 0 : -0.1, cream);
  d.box(root, 0.48, 0.23, 0.04, 0, 0.82, bus ? 0.8 : 0.25, glass);
  for (const side of [-1, 1]) {
    for (const z of bus ? [-0.5, 0, 0.5] : [-0.15])
      d.box(root, 0.04, 0.24, bus ? 0.32 : 0.42, side * 0.3, 0.83, z, glass);
    for (const z of [-1, 1]) {
      const pivot = d.group(root, side * 0.34, 0.24, z * (bus ? 0.57 : 0.38));
      root.userData.wheels.push(pivot);
      const wheel = d.mesh(pivot, 'cylinder', [0.18, 0.09, 0.18], [0, 0, 0], '#4c554f');
      wheel.rotation.z = Math.PI / 2;
      d.rod(pivot, [side * 0.05, -0.14, 0], [side * 0.05, 0.14, 0], 0.025, cream);
    }
    d.ball(root, side * 0.2, 0.5, bus ? 0.89 : 0.59, 0.065, '#f7df9b');
  }
  return root;
}

/** The vehicle parked at a depot plot. The stables keep their 2CV in every era. */
export function parkedVehicle(d, parent, kind, era) {
  return kind === 'stable'
    ? deuxChevaux(d, parent)
    : motorVehicle(d, parent, kind === 'busDepot', era);
}

// A Citroën 2CV parked at the stables: domed cabin with a roll-top canvas roof,
// ribbed bonnet, separate round front wings and headlamps on stalks. Charleston
// two-tone, faces +z like the other procedural cars.
function deuxChevaux(d, parent) {
  const root = d.group(parent);
  root.name = 'Deux chevaux';
  root.userData.vehicleBox = { halfWidth: 0.39, halfLength: 0.8 };
  root.userData.wheels = [];
  const body = '#8c4a4f',
    dark = '#3d3a3b',
    trim = '#d9d4c7';
  for (const side of [-1, 1])
    for (const z of [-0.5, 0.5]) {
      const pivot = d.group(root, side * 0.29, 0.17, z);
      root.userData.wheels.push(pivot);
      d.mesh(pivot, 'cylinder', [0.17, 0.08, 0.17], [0, 0, 0], '#3f4542').rotation.z = Math.PI / 2;
      d.ball(pivot, side * 0.045, 0, 0, [0.02, 0.08, 0.08], trim);
    }
  // A low tub under one long arched roofline that falls to a short tail.
  d.box(root, 0.6, 0.24, 1.22, 0, 0.38, -0.1, body, true);
  d.ball(root, 0, 0.48, -0.12, [0.3, 0.4, 0.6], body);
  d.ball(root, 0, 0.84, -0.2, [0.2, 0.07, 0.36], dark).name = 'Roll-top canvas roof';
  // Glazing lies on the dome: the windscreen leans back with its slope.
  d.box(root, 0.38, 0.16, 0.02, 0, 0.69, 0.35, glass).rotation.x = -0.8;
  d.box(root, 0.3, 0.12, 0.02, 0, 0.62, -0.68, glass).rotation.x = 0.85;
  for (const side of [-1, 1]) {
    d.box(root, 0.02, 0.13, 0.42, side * 0.265, 0.68, -0.15, glass);
    d.box(root, 0.02, 0.025, 0.08, side * 0.305, 0.46, 0.02, trim);
    d.ball(root, side * 0.28, 0.32, 0.48, [0.11, 0.13, 0.26], dark).name = 'Front wing';
    d.ball(root, side * 0.29, 0.31, -0.48, [0.05, 0.12, 0.24], body);
    d.rod(root, [side * 0.19, 0.46, 0.62], [side * 0.19, 0.56, 0.65], 0.018, dark);
    d.ball(root, side * 0.19, 0.58, 0.66, 0.06, trim);
    d.ball(root, side * 0.19, 0.58, 0.71, [0.045, 0.045, 0.02], '#f7df9b');
    d.ball(root, side * 0.2, 0.42, -0.71, 0.035, '#c86455');
  }
  // The ribbed bonnet slopes from the windscreen down to the grille.
  d.ball(root, 0, 0.44, 0.46, [0.25, 0.16, 0.33], dark).name = 'Ribbed bonnet';
  const bonnetTop = (x, z) =>
    0.445 + 0.16 * Math.sqrt(Math.max(0, 1 - (x / 0.25) ** 2 - ((z - 0.46) / 0.33) ** 2));
  for (const x of [-0.08, 0, 0.08])
    d.rod(root, [x, bonnetTop(x, 0.36), 0.36], [x, bonnetTop(x, 0.68), 0.68], 0.012, '#4c4848');
  d.box(root, 0.28, 0.13, 0.03, 0, 0.41, 0.77, trim).name = 'Grille';
  for (const y of [0.4, 0.44])
    for (const side of [-1, 1])
      d.rod(root, [side * 0.06, y, 0.79], [0, y + 0.03, 0.79], 0.008, '#c9a24f');
  for (const z of [-0.78, 0.8]) d.rod(root, [-0.3, 0.26, z], [0.3, 0.26, z], 0.022, trim);
  return root;
}

// Wheel-less hover cars and shuttles from shared primitives. The body floats in its own
// group so traffic can bob it gently; parts stay few because vehicles move every frame.
function hoverPod(d, parent, bus) {
  const root = d.group(parent);
  const length = bus ? 1.15 : 0.75;
  root.userData.vehicleBox = { halfWidth: 0.36, halfLength: bus ? 1.2 : 0.85 };
  root.userData.wheels = [];
  const body = d.group(root);
  root.userData.hoverBody = body;
  const P = ROUNDED_PALETTE;
  d.ball(body, 0, 0.5, 0, [0.38, 0.28, length], bus ? P.warm : P.shell);
  if (bus) d.ball(body, 0, 0.72, 0, [0.35, 0.2, length * 0.92], P.glass);
  else d.ball(body, 0, 0.66, 0.1, [0.27, 0.22, length * 0.55], P.glass);
  d.mesh(body, 'cylinder', [0.34, 0.05, length * 0.88], [0, 0.26, 0], P.light);
  d.ball(body, 0, 0.5, -length + 0.04, [0.2, 0.06, 0.05], P.warm);
  return root;
}

export function animateVehicle(root, distance) {
  for (const wheel of root.userData.wheels ?? []) wheel.rotation.x = distance / 0.18;
  if (root.userData.hoverBody) root.userData.hoverBody.position.y = Math.sin(distance * 1.7) * 0.04;
}

// Purpose-built response bodies share wheels and period palettes, never bus shells.
export function responseVehicle(d, parent, service = false, era = d.town?.era) {
  if (hasRoundedTransport(era)) return roundedResponsePod(d, parent, service);
  const root = d.group(parent);
  root.userData.vehicleBox = { halfWidth: 0.62, halfLength: 1.3 };
  root.userData.wheels = [];
  const color = service ? '#c8ad67' : '#b65346';
  d.box(root, 1, 0.4, 2.5, 0, 0.5, 0, color);
  d.box(root, 0.92, 0.65, 0.8, 0, 0.98, 0.75, color);
  d.box(root, 0.75, 0.38, 0.07, 0, 1.08, 1.18, glass);
  d.box(root, 0.95, 0.12, 0.95, 0, 1.36, 0.75, cream);
  if (service) {
    for (const x of [-0.45, 0.45]) d.box(root, 0.1, 0.55, 1.4, x, 0.95, -0.45, '#648d89');
    d.box(root, 0.95, 0.55, 0.1, 0, 0.95, -1.1, '#648d89');
    for (let n = 0; n < 3; n++)
      d.rod(root, [-0.3, 0.85, -0.9 + n * 0.3], [0.3, 1.12, -0.6 + n * 0.3], 0.07, '#a3825f');
  } else {
    d.box(root, 0.95, 0.65, 1.4, 0, 0.95, -0.45, color);
    for (const x of [-0.3, 0.3]) d.rod(root, [x, 1.45, -1.1], [x, 1.45, 0.5], 0.045, cream);
    for (let z = -1; z <= 0.5; z += 0.25) d.rod(root, [-0.3, 1.45, z], [0.3, 1.45, z], 0.03, cream);
    d.ball(root, 0, 1.55, 0.75, [0.17, 0.14, 0.17], '#e5a05c');
    for (const x of [-0.51, 0.51]) d.ball(root, x, 0.95, -0.45, [0.04, 0.25, 0.25], '#dfd1ab');
  }
  for (const z of [-0.8, 0.8]) {
    const axle = d.group(root, 0, 0.25, z);
    d.rod(axle, [-0.6, 0, 0], [0.6, 0, 0], 0.22, '#4c554f');
    for (const x of [-0.61, 0.61]) d.rod(axle, [x, -0.16, 0], [x, 0.16, 0], 0.035, cream);
    root.userData.wheels.push(axle);
  }
  return root;
}

// Rounded eras send a hovering response pod with a light bar instead of a truck.
function roundedResponsePod(d, parent, service) {
  const root = d.group(parent);
  root.userData.vehicleBox = { halfWidth: 0.62, halfLength: 1.3 };
  root.userData.wheels = [];
  const body = d.group(root);
  root.userData.hoverBody = body;
  const P = ROUNDED_PALETTE;
  const color = service ? '#c8ad67' : '#b65346';
  d.ball(body, 0, 0.72, 0, [0.6, 0.42, 1.3], color);
  d.ball(body, 0, 0.98, 0.55, [0.45, 0.28, 0.55], P.glass);
  d.mesh(body, 'cylinder', [0.55, 0.06, 1.15], [0, 0.32, 0], P.light);
  d.ball(body, 0, 1.24, -0.2, [0.3, 0.08, 0.14], service ? '#e5a05c' : '#e05a4a');
  return root;
}
