import { walkObstacle } from './TownNavigation';
import { cityAppearance } from '../../data/cityAppearance';
import { eraEvolution } from '../../data/eras';
import { hasElectricity } from '../../data/industrial';
import {
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
  const pole = ([x, z]) => {
    // Keep the mine's work yard and saved encounter paths open.
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
          !(Math.abs(candidate[0]) < 4.65 && candidate[1] >= -18 && candidate[1] < -8.7) &&
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
      id === 'bridge' ? [24, 7.5] : plotStreet(id),
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
  root.userData.connections = network.connections.map(({ id }) => id);
  for (const [x, y, z] of network.poles) {
    walkObstacle(root, x, z, 0.055, y + 0.2);
    d.rod(root, [x, 0, z], [x, y + 0.2, z], 0.055, '#897255');
    d.box(root, 0.7, 0.1, 0.12, x, y, z, '#6a786e');
    for (const dx of [-0.25, 0.25])
      d.mesh(root, 'cylinder', [0.065, 0.15, 0.065], [x + dx, y + 0.08, z], '#c6d7c4');
  }
  for (const { from, to } of [...network.wires, ...network.connections]) {
    let previous = from;
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      const next = from.map(
        (v, axis) => v + (to[axis] - v) * t - (axis === 1 ? Math.sin(t * Math.PI) * 0.3 : 0),
      );
      d.rod(root, previous, next, 0.017, '#58645d');
      previous = next;
    }
  }
  d.batch(root);
  return root;
}

export const roadSurface = (town) => eraEvolution(town.era).roadColor;

export function addEraStreetscape(d, town) {
  const profile = eraEvolution(town.era);
  if (profile.style === 'frontier') return null;
  const a = cityAppearance(town.era);
  const root = d.group(d.world);
  root.name = 'Era street furniture';
  root.userData.static = true;
  for (const [x, z] of [
    [-4.8, -4.5],
    [4.8, 3.5],
    [-4.8, 11.5],
    [4.8, 19.5],
  ]) {
    const metal = profile.electricity ? a.roof : '#8a7454';
    const height = profile.busService ? 2.8 : 2.4;
    walkObstacle(root, x, z, 0.07, height);
    d.rod(root, [x, 0, z], [x, height, z], 0.07, metal);
    if (a.modern && profile.style === 'city') d.box(root, 0.8, 0.12, 0.4, x, height, z, '#e8d6aa');
    else d.ball(root, x, height, z, [0.22, 0.28, 0.22], '#e8d6aa');
    if (profile.busService) {
      walkObstacle(root, x, z + 1.3, Math.hypot(0.8, 0.275), 0.7);
      d.box(root, 1.6, 0.12, 0.55, x, 0.6, z + 1.3, a.wall);
      for (const dx of [-0.6, 0.6]) d.box(root, 0.12, 0.55, 0.45, x + dx, 0.3, z + 1.3, metal);
    }
    if (profile.digitalCity) {
      walkObstacle(root, x, z - 1.2, Math.hypot(0.275, 0.15), 1.4);
      d.box(root, 0.55, 1.3, 0.3, x, 0.75, z - 1.2, metal);
      d.box(root, 0.4, 0.7, 0.04, x, 0.9, z - 1.02, '#85b8c8');
    }
  }
  d.batch(root);
  return root;
}
