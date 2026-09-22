import { mineAppearance } from '../../data/mineEvolution';
import { PLOTS } from './TownLayout';

// The same authored assembly is used in the permanent town and its construction.
// All equipment stands west of the decline; the cart and encounter lanes stay open.
export function addMineWorks(d, parent, era) {
  const a = mineAppearance(era);
  const root = d.group(parent, PLOTS.mine[0], 0.08, PLOTS.mine[1]);
  root.name = 'Mine surface works';
  root.userData.static = true;
  const section = (name, phase) => {
    const group = d.group(root);
    group.name = name;
    group.userData.buildPhase = phase;
    return group;
  };
  const base = section('Mine machinery foundations', 0);
  d.box(base, 1.95, 0.18, 2.35, -3.65, 0.1, 1.45, '#b8ad94');
  const frame = section('Mine winding frame', 1);
  const h = a.height;
  for (const x of [-4.35, -2.95]) {
    for (const z of [0.55, 2.25]) {
      d.rod(frame, [x, 0.18, z], [x + (x < -3.65 ? 0.12 : -0.12), h, z], 0.105, a.frame);
    }
    if (h > 2) {
      d.rod(frame, [x, 0.6, 0.55], [x, h - 0.4, 2.25], 0.06, a.frame);
      d.rod(frame, [x, 0.6, 2.25], [x, h - 0.4, 0.55], 0.06, a.frame);
    }
  }
  d.box(frame, 1.75, 0.22, 2, -3.65, h, 1.4, a.frame);
  const machinery = section('Mine winding machinery', 2);
  d.mesh(machinery, 'cylinder', [0.4, 0.6, 0.4], [-3.65, 0.65, 1.4], '#53635c').rotation.z =
    Math.PI / 2;
  if (a.machine !== 'hand') {
    // An exposed sheave and spokes make the headframe readable as mining machinery.
    const center = [-3.65, h + 0.34, 2.45];
    const radius = 0.48;
    const point = (angle) => [
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius,
      center[2],
    ];
    for (let n = 0; n < 12; n++) {
      const angle = (n * Math.PI) / 6;
      d.rod(machinery, point(angle), point(angle + Math.PI / 6), 0.055, '#53635c');
      if (n % 3 === 0) d.rod(machinery, center, point(angle), 0.035, a.frame);
    }
    d.rod(machinery, [-3.65, h + 0.34, 1.4], center, 0.1, a.frame);
    d.rod(machinery, [-3.18, 0.7, 2.45], [-3.18, h + 0.34, 2.45], 0.035, '#514738');
    d.box(machinery, 1.05, 0.8, 0.8, -3.65, 0.6, 2.1, a.wall);
  }
  const house = section('Mine power and control house', 3);
  if (a.machine === 'steam') {
    d.mesh(house, 'cylinder', [0.34, 1.3, 0.34], [-4.25, 0.9, 2.65], a.frame);
    d.rod(house, [-4.25, 1.4, 2.65], [-4.25, 2.8, 2.65], 0.08, '#53635c');
  } else if (a.machine !== 'hand') {
    d.box(house, 1.5, 1.8, 1.25, -4.5, 1, 3.55, a.wall);
    d.box(house, 1.75, 0.16, 1.5, -4.5, 1.99, 3.55, a.roof);
    d.box(house, 0.75, 0.65, 0.06, -4.5, 1.35, 4.2, '#85b8c8');
    d.box(house, 0.08, 0.75, 0.09, -4.5, 1.35, 4.23, a.wall);
    if (a.machine === 'electric') {
      d.box(house, 0.65, 0.8, 0.4, -5.1, 0.6, 4.15, a.frame);
      d.box(house, 0.35, 0.28, 0.06, -5.1, 0.8, 4.38, '#edcf79');
    }
  }
  const finish = section('Mine roof and era equipment', 4);
  if (['enclosed', 'motor', 'radio', 'control', 'digital'].includes(a.machine)) {
    d.box(finish, 1.95, 0.18, 2.4, -3.65, h + 0.95, 1.4, a.roof);
    for (const x of [-4.38, -2.92]) d.box(finish, 0.1, 0.8, 0.1, x, h + 0.5, 2.3, a.wall);
    d.box(finish, 1.4, 0.6, 0.07, -3.65, h + 0.5, 2.3, '#85b8c8');
    if (a.machine === 'motor') d.box(finish, 1.8, 0.18, 0.9, -4.5, 1.55, 4.3, a.roof);
    if (['radio', 'control', 'digital'].includes(a.machine)) {
      d.rod(finish, [-4.1, h + 1, 1.3], [-4.1, h + 2, 1.3], 0.035, a.frame);
      d.rod(finish, [-4.45, h + 1.7, 1.3], [-3.75, h + 1.7, 1.3], 0.025, a.frame);
    }
    if (['control', 'digital'].includes(a.machine)) {
      d.box(finish, 1, 0.7, 0.12, -4.5, 1.3, 4.25, '#435764');
      for (let n = 0; n < 3; n++)
        d.box(
          finish,
          0.65,
          0.07,
          0.04,
          -4.5,
          1.1 + n * 0.18,
          4.34,
          a.machine === 'digital' ? '#83c7be' : '#e5bc77',
        );
    }
    if (a.machine === 'digital') {
      for (const x of [-4.9, -4.05]) d.box(finish, 0.75, 0.06, 1.1, x, 2.13, 3.55, '#526f79');
    }
  }
  return root;
}
