import { hasElectricity } from '../../data/industrial';
import { PLOTS, plotStreet, routeGraph, routeOnGraph } from './TownLayout';

export const pavedTown = (town) =>
  ['industrial', 'motor-age', 'post-war', 'contemporary'].includes(town.era);
export const modernTransport = (town, id) =>
  town.buildings[id] > 0 &&
  ['industrial', 'motor-age', 'post-war', 'contemporary'].includes(town.buildingEras[id]);
export const motorTraffic = (town) =>
  modernTransport(town, 'stable') &&
  (['motor-age', 'contemporary'].includes(town.buildingEras.stable) ||
    town.buildingEraLevels.stable >= 2);

// A shared road-following network for WebGL and the accessible map. Merge
// common branches so every completed plot gets a service without duplicate wires.
export function powerGrid(town) {
  const poles = new Map(),
    wires = new Map(),
    connections = [];
  if (!hasElectricity(town)) return { poles: [], wires: [], connections };
  const graph = routeGraph(town);
  const pole = ([x, z]) => {
    // Keep the mine's work yard and saved encounter paths open.
    if (Math.abs(x) < 4.65 && z >= -18 && z < -8.7) x = (x < 0 ? -1 : 1) * 4.85;
    const key = `${x},${z}`;
    if (!poles.has(key)) poles.set(key, [x, 6.4, z + 0.7]);
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
      to: [PLOTS[id][0], id === 'mine' ? 4 : 3.4, PLOTS[id][1] + 1.5],
    });
  }
  return { poles: [...poles.values()], wires: [...wires.values()], connections };
}

export function addPowerGrid(d, town) {
  const network = powerGrid(town);
  if (!network.poles.length || town.era === 'contemporary') return;
  const root = d.group(d.world);
  root.name = 'Connected village power grid';
  root.userData.static = true;
  root.userData.connections = network.connections.map(({ id }) => id);
  for (const [x, y, z] of network.poles) {
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

export const roadSurface = (town) =>
  ({
    frontier: '#c3a477',
    'river-rail': '#b3a18a',
    industrial: '#89928a',
    'post-war': '#a38f7d',
    'motor-age': '#858b86',
    contemporary: '#a5afa5',
  })[town.era] ?? '#c3a477';
