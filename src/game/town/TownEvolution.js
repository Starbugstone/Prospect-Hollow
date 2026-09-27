import { DoubleSide, Raycaster, Vector3 } from 'three';
import { walkObstacle } from './TownNavigation';
import { cityAppearance } from '../../data/cityAppearance';
import { eraEvolution } from '../../data/eras';
import { resolveRoadStyle } from '../../data/roadStyles';
import { hasElectricity } from '../../data/industrial';
import { BRIDGE } from './TownRiver';
import {
  LANE_X,
  PLOTS,
  plotStreet,
  routeGraph,
  routeOnGraph,
  townTracks,
  segmentDistance,
} from './TownLayout';

export const pavedTown = (town) => eraEvolution(town.era).paved;
export const modernTransport = (town, id) =>
  town.buildings[id] > 0 && eraEvolution(town.buildingEras[id]).modernTransport;
export const motorTraffic = (town) => {
  const minimum = eraEvolution(town.buildingEras.stable).motorTrafficLevel;
  return (
    modernTransport(town, 'stable') &&
    minimum !== null &&
    (minimum === 1 || town.buildingEraLevels.stable >= minimum)
  );
};

// A shared road-following network for WebGL and the accessible map. Merge
// common branches so every completed plot gets a service without duplicate wires.
export function powerGrid(town) {
  const poles = new Map(),
    wires = new Map(),
    connections = [];
  if (!hasElectricity(town)) return { poles: [], wires: [], connections };
  const graph = routeGraph(town);
  const streets = townTracks(town);
  // Keep the mine's work yard and saved encounter paths open, and poles off the
  // square's curb.
  const [sx, sz] = PLOTS.square;
  const reserved = (x, z) =>
    (Math.abs(x) < 4.65 && z >= -18 && z < -8.7) ||
    (Math.abs(x - sx) < 2.85 && Math.abs(z - sz) < 2.75);
  const pole = ([x, z]) => {
    if (Math.abs(x) < 4.65 && z >= -18 && z < -8.7) x = (x < 0 ? -1 : 1) * 4.85;
    const origin = [x, z];
    let verge;
    for (const radius of [0.85, 1.2, 1.65, 2.1]) {
      for (let n = 0; n < 16; n++) {
        const angle = (n * Math.PI) / 8;
        const candidate = [
          origin[0] + Math.cos(angle) * radius,
          origin[1] + Math.sin(angle) * radius,
        ];
        if (
          !reserved(...candidate) &&
          streets.every(
            ({ from, to, width }) => segmentDistance(...candidate, from, to) > width / 2 + 0.22,
          )
        ) {
          verge = candidate;
          break;
        }
      }
      if (verge) break;
    }
    [x, z] = verge ?? origin;
    const key = `${x},${z}`;
    // Adjacent service branches share a verge pole.
    const shared = [...poles].find(([, p]) => Math.hypot(p[0] - x, p[2] - z) < 6);
    if (shared) return shared[0];
    if (!poles.has(key)) poles.set(key, [x, 4.8, z]);
    return key;
  };
  for (const id of Object.keys(PLOTS).filter((id) => id === 'mine' || town.buildings[id])) {
    const route = routeOnGraph(
      graph,
      plotStreet('powerHouse'),
      id === 'bridge' ? [BRIDGE.westJunction, BRIDGE.z] : plotStreet(id),
    );
    if (!route.length) continue;
    for (let i = 1; i < route.length; i++) {
      const a = pole(route[i - 1]),
        b = pole(route[i]);
      if (a === b) continue;
      wires.set([a, b].sort().join('|'), { from: poles.get(a), to: poles.get(b) });
    }
    const street = poles.get(pole(route.at(-1)));
    connections.push({
      id,
      from: street,
      to: [
        PLOTS[id][0] + Math.sign(street[0] - PLOTS[id][0]) * 1.5,
        id === 'mine' ? 3.8 : 2.9,
        PLOTS[id][1] + Math.sign(street[2] - PLOTS[id][1]) * 1.4,
      ],
    });
  }
  return { poles: [...poles.values()], wires: [...wires.values()], connections };
}

export function addPowerGrid(d, town) {
  const network = powerGrid(town);
  if (!network.poles.length || !eraEvolution(town.era).overheadPower) return;
  const root = d.group(d.world);
  root.name = 'Connected village power grid';
  root.userData.static = true;
  root.userData.connections = network.connections;
  root.userData.animalPerches = network.poles.map(([x, y, z]) => [x, y + 0.23, z]);
  for (const [x, y, z] of network.poles) {
    walkObstacle(root, x, z, 0.055, y + 0.2);
    d.rod(root, [x, 0, z], [x, y + 0.2, z], 0.055, '#897255');
    d.box(root, 0.7, 0.1, 0.12, x, y, z, '#6a786e');
    for (const dx of [-0.25, 0.25])
      d.mesh(root, 'cylinder', [0.065, 0.15, 0.065], [x + dx, y + 0.08, z], '#c6d7c4');
  }
  for (const { from, to } of network.wires) {
    let previous = from;
    for (let i = 1; i <= 6; i++) {
      const next = sag(from, to, i / 6);
      d.rod(root, previous, next, 0.017, WIRE);
      previous = next;
    }
  }
  d.batch(root);
  return root;
}
const WIRE = '#58645d';
const sag = (from, to, t) =>
  from.map((v, axis) => v + (to[axis] - v) * t - (axis === 1 ? Math.sin(t * Math.PI) * 0.3 : 0));
const ray = new Raycaster();
ray.layers.enableAll();
const along = new Vector3(),
  start = new Vector3(),
  side = new Vector3(),
  normal = new Vector3(),
  origin = new Vector3();
// Distance to the first building surface met by a rod of `radius` from a to b: the
// centerline and four rays along its edges, so a wire cannot graze a roof edge.
function surface(target, a, b, radius = 0.035) {
  start.set(...a);
  along.set(...b).sub(start);
  const length = along.length();
  along.normalize();
  side.set(0, 1, 0).cross(along);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  side.normalize();
  normal.copy(along).cross(side);
  // Imported models include open, one-sided panels: test both faces, then restore.
  const sides = new Map();
  target.traverse(({ isMesh, material }) => {
    if (isMesh && !sides.has(material)) sides.set(material, material.side);
  });
  for (const material of sides.keys()) material.side = DoubleSide;
  let nearest = Infinity;
  try {
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      origin
        .copy(start)
        .addScaledVector(side, u * radius)
        .addScaledVector(normal, v * radius);
      ray.set(origin, along);
      ray.far = length;
      const hit = ray
        .intersectObject(target, true)
        .find(({ object }) => object.isMesh && !object.material.transparent);
      if (hit) nearest = Math.min(nearest, hit.distance);
    }
  } finally {
    for (const [material, value] of sides) material.side = value;
  }
  // Stop just short of the surface so the insulator rests against it.
  return nearest < Infinity
    ? start.addScaledVector(along, Math.max(0, nearest - 0.05)).toArray()
    : undefined;
}
/** Service drops run from their street pole to the first surface of the finished
 * building, so a wire never continues through a wall or roof. Built after the plots
 * (and again when one plot is swapped); `plots` maps plot ids to their groups. */
export function addServiceDrops(d, grid, plots, previous = null) {
  const connections = grid?.userData.connections;
  if (!connections?.length) return null;
  const root = d.group(d.world);
  root.name = 'Building service drops';
  root.userData.static = true;
  for (const { id, from, to } of connections) {
    const target = plots.get(id);
    if (!target) {
      const retained = previous?.getObjectByName(`Service drop ${id}`);
      if (retained) root.add(retained);
      continue;
    }
    const drop = d.group(root);
    drop.name = `Service drop ${id}`;
    target.updateMatrixWorld(true);
    const points = [from];
    let end;
    for (let i = 1; i <= 6 && !end; i++) {
      const next = sag(from, to, i / 6);
      end = surface(target, points.at(-1), next);
      points.push(end ?? next);
    }
    // Low buildings: continue level toward the plot center to reach a wall.
    if (!end) {
      end = surface(target, to, [target.position.x, to[1], target.position.z]);
      if (end) points.push(end);
    }
    // Open lots (fields, docks, squares) take the drop on a meter post, or on
    // whatever low structure already stands beneath the wire.
    if (!end) {
      end = to;
      const below = surface(target, to, [to[0], 0, to[2]], 0.08);
      if (below) points.push(below);
      else {
        walkObstacle(drop, to[0], to[2], 0.06, to[1]);
        d.rod(drop, [to[0], 0, to[2]], [to[0], to[1] + 0.15, to[2]], 0.06, '#897255').name =
          `Meter post ${id}`;
      }
    }
    for (let i = 1; i < points.length; i++) d.rod(drop, points[i - 1], points[i], 0.017, WIRE);
    d.ball(drop, ...points.at(-1), 0.045, '#c6d7c4');
    // Preserve per-plot geometry so a swap only repeats its own surface queries.
    d.batch(drop);
  }
  return root;
}

export const roadSurface = (town) => {
  const profile = eraEvolution(town.era);
  return profile.roadColor ?? resolveRoadStyle(profile.roadStyle).color;
};
export const roadAppearance = (town) => {
  const profile = eraEvolution(town.era);
  return {
    ...resolveRoadStyle(profile.roadStyle),
    color: roadSurface(town),
    paved: !!profile.paved,
  };
};

// Bus stops sit on the open verge north of the sheriff, one facing each main road.
export const STREET_FURNITURE = Object.freeze([
  [-(LANE_X - 1.45), 18.2],
  [LANE_X - 1.45, 20.1],
]);
export function addEraStreetscape(d, town) {
  const profile = eraEvolution(town.era);
  if (profile.style === 'frontier') return null;
  const a = cityAppearance(town.era);
  const root = d.group(d.world);
  root.name = 'Era street furniture';
  root.userData.static = true;
  for (const [x, z] of STREET_FURNITURE) {
    // Stops face their main road from the open verge between the two roads;
    // bench and kiosk run parallel to the curb, clear of sidewalks and lots.
    const inward = -Math.sign(x);
    const metal = profile.electricity ? a.roof : '#8a7454';
    const height = profile.busService ? 2.8 : 2.4;
    walkObstacle(root, x, z, 0.07, height);
    d.rod(root, [x, 0, z], [x, height, z], 0.07, metal);
    if (a.modern && profile.style === 'city') d.box(root, 0.4, 0.12, 0.8, x, height, z, '#e8d6aa');
    else d.ball(root, x, height, z, [0.22, 0.28, 0.22], '#e8d6aa');
    const bx = x + inward * 0.5;
    if (profile.busService) {
      walkObstacle(root, bx, z + 1.15, Math.hypot(0.275, 0.8), 0.7);
      d.box(root, 0.55, 0.12, 1.6, bx, 0.6, z + 1.15, a.wall);
      for (const dz of [-0.6, 0.6]) d.box(root, 0.45, 0.55, 0.12, bx, 0.3, z + 1.15 + dz, metal);
    }
    if (profile.digitalCity) {
      walkObstacle(root, bx, z - 1, Math.hypot(0.15, 0.275), 1.4);
      d.box(root, 0.3, 1.3, 0.55, bx, 0.75, z - 1, metal);
      d.box(root, 0.04, 0.7, 0.4, bx - inward * 0.17, 0.9, z - 1, '#85b8c8');
    }
  }
  d.batch(root);
  return root;
}
