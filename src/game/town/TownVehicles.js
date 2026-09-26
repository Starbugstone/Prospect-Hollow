import { isCityEra } from '../../data/city';
import { cityModel } from './buildings/city';
const cream = '#e1cfab',
  glass = '#9cbbb5';
export function motorVehicle(d, parent, bus = false, appearanceEra) {
  const era = appearanceEra ?? d.town?.era ?? d.town?.buildingEras?.[bus ? 'busDepot' : 'stable'];
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

export function animateVehicle(root, distance) {
  for (const wheel of root.userData.wheels ?? []) wheel.rotation.x = distance / 0.18;
}

// Purpose-built response bodies share wheels and period palettes, never bus shells.
export function responseVehicle(d, parent, service = false) {
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
