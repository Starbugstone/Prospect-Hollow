import { MINE_SITE, MINE_POSITION } from '../../../data/mineSite';
import { mineHillsideHeight } from '../TownMineHillside';
import { landscapeGroundHeight } from '../TownLandscape';
import { mineCart, haulCycle } from './MineRollingStock';
import { Vector3 } from 'three';
import { railEdges } from '../TownLayout';
import { RAIL_TUNNEL, tunnelRearX } from '../TownRailTunnel';

const ground = (x, z) => mineHillsideHeight(x, z, MINE_POSITION[1], landscapeGroundHeight(x, z));
export function mineSupportFoot(x, z, railway) {
  // The railway cuts away the outer shoulder. Brace overhanging terraces back
  // into solid rock above the bore instead of ending in the removed terrain.
  const cut = railway && Math.abs(z - (MINE_POSITION[1] - 3)) <= RAIL_TUNNEL.approachHalfWidth;
  const footX = cut && Math.abs(x) > tunnelRearX - 0.25 ? Math.sign(x) * (tunnelRearX - 0.25) : x;
  return [footX, ground(footX, z) - 0.2, z];
}
function terrace(d, root, point, width = 3, depth = 1.4) {
  const [x, z] = point;
  const corners = [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [-width / 2, depth / 2],
    [width / 2, depth / 2],
  ];
  const y = Math.max(ground(x, z), ...corners.map(([dx, dz]) => ground(x + dx, z + dz))) + 0.08;
  const g = d.group(root, x, y, z - MINE_POSITION[1]);
  for (const [dx, dz] of corners) {
    const foot = mineSupportFoot(x + dx, z + dz, !!railEdges(d.town).length);
    const from = new Vector3(foot[0] - x, foot[1] - y, foot[2] - z);
    const to = new Vector3(dx, 0.2, dz);
    const center = from.clone().add(to).multiplyScalar(0.5);
    const support = d.box(
      g,
      0.25,
      from.distanceTo(to),
      0.25,
      center.x,
      center.y,
      center.z,
      '#9d9a88',
    );
    support.name = 'Hillside terrace support';
    support.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), to.sub(from).normalize());
    support.userData.hillFoot = foot;
  }
  d.box(g, width, 0.2, depth, 0, 0.14, 0, '#b9b39d');
  for (const side of [-1, 1])
    d.rod(
      g,
      [(side * width) / 2, 0.3, depth / 2],
      [(side * width) / 2, 1, depth / 2],
      0.04,
      '#62766d',
    );
  d.rod(g, [-width / 2, 1, depth / 2], [width / 2, 1, depth / 2], 0.035, '#62766d');
  return g;
}
function rotor(d, parent, x, y, z, radius, color, blades = 4) {
  const g = d.group(parent, x, y, z);
  g.userData.animated = true;
  d.ball(g, 0, 0, 0, 0.12, color);
  for (let i = 0; i < blades; i++) {
    const blade = d.group(g);
    blade.rotation.z = (i * Math.PI * 2) / blades;
    d.box(blade, 0.13, radius, 0.07, 0, radius / 2, 0, color);
  }
  return g;
}
// Existing workshops keep their foundations while their facade and services
// modernize with the same era appearance as the portal and winding house.
function refitWorkshop(d, root, a, width, height, depth) {
  if (a.machine === 'hand' || a.machine === 'steam') return;
  const glazed = ['radio', 'control', 'digital'].includes(a.machine);
  const glass = d.box(
    root,
    0.06,
    glazed ? 0.65 : 0.4,
    depth * (glazed ? 0.85 : 0.45),
    width / 2 + 0.03,
    height * 0.6,
    0,
    '#7da7ad',
  );
  glass.name = 'Era workshop glazing';
  if (['motor', 'radio', 'control', 'digital'].includes(a.machine)) {
    d.box(root, width + 0.2, 0.1, depth + 0.12, 0, height, 0, a.roof);
    for (const z of [-depth * 0.42, depth * 0.42])
      d.box(root, 0.1, height, 0.1, width / 2 + 0.03, height / 2, z, a.frame);
  }
}
export const MINE_FEATURES = {
  cribbing(d, g, a) {
    for (let i = 0; i < 4; i++) d.box(g, 2.2, 0.12, 0.3, -3.1, 0.18 + i * 0.15, -0.5, a.frame);
  },
  sluice(d, g, a, motions) {
    const tray = d.group(g, -5.8, 0, 2.1);
    d.box(tray, 2.4, 0.15, 0.8, 0, 0.5, 0, a.frame);
    for (const z of [-0.4, 0.4]) d.box(tray, 2.5, 0.35, 0.08, 0, 0.62, z, a.wall);
    for (let i = 0; i < 5; i++) d.box(tray, 0.05, 0.08, 0.7, -1 + i * 0.5, 0.61, 0, '#526e72');
    const water = d.box(tray, 0.4, 0.03, 0.65, 0, 0.63, 0, '#8cbabc');
    water.userData.animated = true;
    motions.push((t) => {
      water.position.x = -1 + (t % 2);
    });
  },
  tipple(d, g, a, motions) {
    const [x, z] = MINE_SITE.tipple,
      r = d.group(g, x, 0, z - MINE_POSITION[1]);
    for (const x of [-1, 1])
      for (const z of [-0.65, 0.65]) d.rod(r, [x, 0, z], [x, 2.1, z], 0.08, a.frame);
    d.box(r, 2.1, 0.75, 1.35, 0, 2.05, 0, a.wall);
    const gate = d.box(r, 0.7, 0.13, 0.55, 0, 1.5, 0.5, a.roof);
    gate.userData.animated = true;
    motions.push((t) => {
      gate.rotation.x = haulCycle(t).state === 'unload' ? -0.55 : 0;
    });
  },
  'surface-cart-load'(d, g, a, motions) {
    const [x, z] = MINE_SITE.tipple,
      cart = mineCart(d, g, 'iron-car');
    cart.root.position.set(x, 0.04, z - MINE_POSITION[1]);
    motions.push((t) => {
      cart.load.visible = haulCycle(t).loaded;
    });
  },
  'rail-hopper'(d, g, a, motions) {
    // The stub occupies a separate track south of the main approach.
    const [[x, z], [end]] = MINE_SITE.stub;
    for (const side of [-0.28, 0.28])
      d.rod(
        g,
        [x, 0.12, z - MINE_POSITION[1] + side],
        [end, 0.12, z - MINE_POSITION[1] + side],
        0.04,
        '#677b78',
      );
    const car = mineCart(d, g, 'iron-car');
    car.root.position.set((x + end) / 2, 0.08, z - MINE_POSITION[1]);
    car.root.rotation.y = Math.PI / 2;
    motions.push((t) => {
      car.load.visible = haulCycle(t).loaded;
    });
  },
  crusher(d, g, a, motions) {
    const r = terrace(d, g, MINE_SITE.terrace, 3.1);
    d.box(r, 2.3, 1.45, 1.25, 0, 0.95, 0, a.wall);
    refitWorkshop(d, r, a, 2.3, 1.7, 1.25);
    for (let i = 0; i < 3; i++) {
      const roof = d.box(r, 0.9, 0.13, 1.6, -0.8 + i * 0.8, 1.77, 0, a.roof);
      roof.rotation.z = 0.28;
    }
    const wheel = rotor(d, r, 0, 1, 0.7, 0.45, a.frame);
    motions.push((t) => {
      wheel.rotation.z = t;
    });
  },
  conveyor(d, g, a, motions) {
    const from = [-3.8, ground(-3.8, -22) + 1.1, -2],
      to = [-5.9, 1.2, 2.5];
    for (const x of [-0.26, 0.26])
      d.rod(g, [from[0] + x, from[1], from[2]], [to[0] + x, to[1], to[2]], 0.08, a.frame);
    const ore = d.ball(g, 0, 0, 0, [0.2, 0.15, 0.2], '#9babb0', 'rock');
    ore.userData.animated = true;
    motions.push((t) => {
      const p = (t / 5) % 1;
      ore.position.set(...from.map((v, i) => v + (to[i] - v) * p));
    });
  },
  'fan-house'(d, g, a, motions) {
    const r = terrace(d, g, MINE_SITE.fanHouse, 2.8);
    d.box(r, 2.2, 1.4, 1.1, 0, 0.9, 0, a.wall);
    refitWorkshop(d, r, a, 2.2, 1.6, 1.1);
    const fan = rotor(d, r, 0, 1, 0.6, 0.55, a.frame, 6);
    motions.push((t) => {
      fan.rotation.z = t * 1.8;
    });
  },
  'truck-bay'(d, g, a, motions) {
    const [x, z] = MINE_SITE.truckBay,
      r = d.group(g, x, 0, z - MINE_POSITION[1]);
    d.box(r, 3.4, 0.08, 1.7, 0, 0.04, 0, '#a5a28e');
    const truck = d.group(r);
    truck.userData.animated = true;
    d.box(truck, 1.3, 0.45, 0.8, 0, 0.55, 0, a.frame);
    d.box(truck, 0.45, 0.6, 0.75, -0.6, 0.85, 0, a.wall);
    d.box(truck, 0.06, 0.3, 0.62, -0.84, 1, 0, '#83b3ba');
    const bed = d.group(truck, 0.35, 0.8, 0);
    d.box(bed, 0.95, 0.22, 0.7, 0, 0, 0, a.roof);
    for (const x of [-0.55, 0.55])
      for (const z of [-0.4, 0.4]) d.ball(truck, x, 0.27, z, [0.2, 0.2, 0.09], '#475354');
    motions.push((t) => {
      const p = (t % 16) / 16;
      truck.position.x = Math.cos(p * Math.PI * 2) * 0.55;
      bed.rotation.z = p > 0.4 && p < 0.65 ? -Math.sin(((p - 0.4) / 0.25) * Math.PI) * 0.4 : 0;
    });
  },
  'upper-terrace'(d, g, a) {
    const r = terrace(d, g, MINE_SITE.upperTerrace, 4.2);
    d.box(r, 2.9, 1.3, 1.2, 0, 0.9, 0, a.wall);
    refitWorkshop(d, r, a, 2.9, 1.55, 1.2);
    d.box(r, 2.6, 0.55, 0.08, 0, 1.15, 0.65, '#7da7ad');
    d.box(r, 3.4, 0.18, 1.6, 0, 1.65, 0, a.roof);
  },
  ropeway(d, g, a, motions) {
    const [from, to] = MINE_SITE.ropeway,
      upper = [from[0], ground(...from) + 3, from[1] - MINE_POSITION[1]],
      lower = [to[0], 3.5, to[1] - MINE_POSITION[1]];
    for (const point of [upper, lower]) {
      const floor = ground(point[0], point[2] + MINE_POSITION[1]);
      d.rod(g, [point[0], floor, point[2]], point, 0.09, a.frame);
    }
    const cable = (p, offset) => [
      upper[0] + (lower[0] - upper[0]) * p + offset,
      upper[1] + (lower[1] - upper[1]) * p - Math.sin(p * Math.PI) * 0.35,
      upper[2] + (lower[2] - upper[2]) * p,
    ];
    for (const offset of [-0.2, 0.2])
      for (let n = 0; n < 12; n++)
        d.rod(g, cable(n / 12, offset), cable((n + 1) / 12, offset), 0.02, '#4d5c56');
    for (let i = 0; i < 3; i++) {
      const bucket = d.group(g);
      bucket.userData.animated = true;
      d.box(bucket, 0.42, 0.36, 0.4, 0, -0.48, 0, a.frame);
      d.rod(bucket, [0, -0.3, 0], [0, 0, 0], 0.035, '#485954');
      motions.push((t) => {
        const phase = (t / 15 + i / 3) % 1,
          p = phase < 0.5 ? phase * 2 : 2 - phase * 2;
        bucket.position.set(
          upper[0] + (lower[0] - upper[0]) * p + (phase < 0.5 ? -0.2 : 0.2),
          upper[1] + (lower[1] - upper[1]) * p - Math.sin(p * Math.PI) * 0.35,
          upper[2] + (lower[2] - upper[2]) * p,
        );
      });
    }
  },
  'radio-mast'(d, g, a, motions) {
    const [x, z] = MINE_SITE.summit,
      r = d.group(g, x, ground(x, z), z - MINE_POSITION[1]);
    for (const side of [-0.35, 0.35]) d.rod(r, [side, 0, 0], [0, 3, 0], 0.04, a.frame);
    for (let y = 0.5; y < 3; y += 0.5) d.rod(r, [-0.3, y, 0], [0.3, y, 0], 0.03, a.frame);
    const beacon = d.ball(r, 0, 3.1, 0, 0.12, '#dfad6a');
    beacon.userData.animated = true;
    motions.push((t) => {
      beacon.visible = t % 2 < 1;
    });
  },
  benches(d, g, a) {
    for (let i = 0; i < 3; i++) terrace(d, g, [-6.1 - i * 0.6, -24.3 - i * 1.75], 2.3, 0.8);
  },
  'sorting-plant'(d, g, a, motions) {
    const r = terrace(d, g, MINE_SITE.sortingPlant, 3.5);
    d.box(r, 3.2, 2, 1.3, 0, 1.2, 0, a.wall);
    refitWorkshop(d, r, a, 3.2, 2.2, 1.3);
    d.box(r, 3.3, 0.18, 1.6, 0, 2.3, 0, a.roof);
    d.box(r, 2.7, 0.7, 0.08, 0, 1.7, 0.7, '#456673');
    const sensor = d.box(r, 0.4, 0.12, 0.09, 0, 0.9, 0.76, '#8dcbb5');
    sensor.userData.animated = true;
    motions.push((t) => {
      sensor.scale.x = 0.3 + Math.sin(t) * 0.05;
    });
  },
  'solar-canopy'(d, g) {
    const [x, z] = MINE_SITE.sortingPlant;
    const y =
      Math.max(
        ...[-1.75, 1.75].flatMap((dx) => [-0.7, 0.7].map((dz) => ground(x + dx, z + dz))),
        ground(x, z),
      ) + 2.8;
    for (let i = 0; i < 4; i++) {
      const panel = d.box(g, 0.7, 0.08, 1.1, x - 1.2 + i * 0.8, y, z - MINE_POSITION[1], '#456d7b');
      panel.rotation.x = -0.24;
    }
  },
  'wind-turbine'(d, g, a, motions) {
    const [x, z] = MINE_SITE.turbine,
      r = d.group(g, x, ground(x, z), z - MINE_POSITION[1]);
    d.rod(r, [0, 0, 0], [0, 3.4, 0], 0.11, '#d7d6c0');
    const blades = rotor(d, r, 0, 3.5, 0.2, 1.25, '#d7d6c0', 3);
    motions.push((t) => {
      blades.rotation.z = t * 0.55;
    });
  },
  'heritage-wheel'(d, g, a) {
    const wheel = rotor(d, g, -6.5, 0.75, 3.5, 0.6, a.frame, 8);
    wheel.userData.animated = false;
    d.box(g, 1.4, 0.18, 0.65, -6.5, 0.1, 3.5, '#aaa28b');
  },
};
