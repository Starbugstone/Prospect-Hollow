import { isCityEra } from '../../data/city';
import { cityModel } from './buildings/city';
const cream = '#e1cfab',
  glass = '#9cbbb5';
export function motorVehicle(d, parent, bus = false) {
  const era = d.town?.buildingEras?.[bus ? 'busDepot' : 'stable'];
  if (isCityEra(era)) return cityModel(d, parent, `${era}-${bus ? 'bus' : 'car'}`);
  const root = d.group(parent);
  d.box(root, 0.65, 0.38, bus ? 1.75 : 1.15, 0, 0.48, 0, bus ? '#d8b976' : '#819faa');
  d.box(root, 0.57, bus ? 0.43 : 0.3, bus ? 1.55 : 0.65, 0, 0.8, bus ? 0 : -0.1, cream);
  d.box(root, 0.48, 0.23, 0.04, 0, 0.82, bus ? 0.8 : 0.25, glass);
  for (const side of [-1, 1]) {
    for (const z of bus ? [-0.5, 0, 0.5] : [-0.15])
      d.box(root, 0.04, 0.24, bus ? 0.32 : 0.42, side * 0.3, 0.83, z, glass);
    for (const z of [-1, 1]) {
      const wheel = d.mesh(
        root,
        'cylinder',
        [0.18, 0.09, 0.18],
        [side * 0.34, 0.24, z * (bus ? 0.57 : 0.38)],
        '#4c554f',
      );
      wheel.rotation.z = Math.PI / 2;
    }
    d.ball(root, side * 0.2, 0.5, bus ? 0.89 : 0.59, 0.065, '#f7df9b');
  }
  return root;
}
