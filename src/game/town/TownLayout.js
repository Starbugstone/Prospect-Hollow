import { BUILDING_BY_ID } from '../../data/town';
import { plotUnlocked } from './TownRules';
import { riverCenterX, riverPath } from './TownRiver';
// Stable positions are shared by WebGL, the SVG map and route connections.
export const PLOTS = {
  home: [-7, -4],
  farm: [7, -4],
  well: [0, 2.4],
  square: [0, -5],
  saloon: [-7, 4],
  stable: [7, 4],
  sheriff: [0, 11],
  museum: [-7, 12],
  armory: [7, 12],
  mine: [0, -20],
  bank: [-7, -12],
  shop: [7, -12],
  home2: [-15, -4],
  home3: [-15, 4],
  home4: [-7, 20],
  well2: [7, 20],
  farm2: [15, -4],
  farm3: [15, 4],
  fisherman: [22, 12],
  blacksmith: [-15, 12],
  school: [-15, -12],
  doctor: [15, 12],
  bridge: [riverCenterX(7.5), 7.5],
  riverPort: [21, -4],
  railDepot: [-15, -20],
  post: [15, -12],
  warehouse: [42, -4],
  hotel: [42, 4],
  home5: [42, 12],
  market: [42, 20],
  powerHouse: [15, -20],
  fireStation: [-15, 20],
  rowHouses: [50, 12],
  mill: [50, -4],
  garage: [-23, 12],
  busDepot: [-23, 4],
  gardenCourt: [50, 20],
  diner: [50, 4],
};
export const PLOT_METADATA = Object.fromEntries(
  Object.entries(PLOTS).map(([id, position]) => [
    id,
    {
      id,
      position,
      introducedEra: BUILDING_BY_ID[id]?.introducedEra ?? 'frontier',
      requires: BUILDING_BY_ID[id]?.unlock ?? [],
      district: position[0] > 35 ? 'east-bank' : 'old-town',
      access:
        id === 'bridge' ? 'crossing' : id === 'riverPort' || id === 'fisherman' ? 'shore' : 'road',
    },
  ]),
);
export const visiblePlots = (town) =>
  Object.values(PLOT_METADATA).filter(({ id }) => id === 'mine' || plotUnlocked(town, id));
export const LANE_X = 3.5;
export const atPlot = (id, dx = 0, dz = 0) => [PLOTS[id][0] + dx, PLOTS[id][1] + dz];
export const plotStreet = (id) => {
  const [x, z] = PLOTS[id];
  return x === 0 && id !== 'mine' ? [LANE_X, z + 2] : [x, z + (id === 'mine' ? 4.5 : 3.5)];
};
// The sheriff patrols both main streets, passing the bank, mine and department.
export const SHERIFF_PATROL = [
  plotStreet('sheriff'),
  [LANE_X, 15.5],
  [-LANE_X, 15.5],
  [-LANE_X, -8.5],
  [LANE_X, -8.5],
];
const road = (from, to, width = 0.85, plot = null) => ({
  from,
  to,
  width,
  plot,
  modes: ['pedestrian', 'horse', 'wagon'],
});
export const TOWN_TRACKS = [
  road([-LANE_X, -15.5], [LANE_X, -15.5]),
  ...[-LANE_X, LANE_X].map((x) => road([x, -18], [x, 27], 1.05)),
  ...[-8.5, -0.5, 7.5, 15.5, 23.5].map((z) =>
    road([z === -0.5 || z === 7.5 ? -19 : -11, z], [z === -0.5 || z === 7.5 ? 19 : 11, z]),
  ),
  ...[-11, 11].map((x) => road([x, -8.5], [x, 7.5])),
  road([-15, -8.5], [-11, -8.5]),
  road([-19, 15.5], [24, 15.5]),
  road([-15, -16.5], [-11, -16.5], 0.85, 'railDepot'),
  road([-11, -16.5], [-LANE_X, -16.5], 0.85, 'railDepot'),
  road([11, -8.5], [15, -8.5], 0.85, 'post'),
  road([19, -0.5], [23, -0.5], 0.85, 'riverPort'),
  road([19, 7.5], [24, 7.5], 0.85, 'bridge'),
  road([15, -16.5], [LANE_X, -16.5], 0.85, 'powerHouse'),
  road([-15, 23.5], [-LANE_X, 23.5], 0.85, 'fireStation'),
  road([-23, 15.5], [-19, 15.5], 0.85, 'garage'),
  road([-23, 7.5], [-19, 7.5], 0.85, 'busDepot'),
  ...Object.keys(PLOTS)
    .filter((id) => id !== 'bridge' && PLOTS[id][0] < 35)
    .map((id) => road(atPlot(id, 0, id === 'mine' ? 2.6 : 2), plotStreet(id), 0.75, id)),
];
export const CROSSING = {
  ...road([24, 7.5], [38, 7.5], 1.6),
  id: 'bridge-crossing',
  crossing: 'bridge',
  plot: 'bridge',
};
export const RAIL_EDGE = {
  id: 'station-railroad',
  from: [-140, -23],
  to: [140, -23],
  width: 1.1,
  modes: ['train'],
  plot: 'railDepot',
};
const EAST_TRACKS = [
  road([38, -0.5], [38, 23.5]),
  ...['warehouse', 'hotel', 'home5', 'market'].flatMap((id) => [
    road([38, plotStreet(id)[1]], plotStreet(id)),
    road(atPlot(id, 0, 2), plotStreet(id), 0.75),
  ]),
];
const INDUSTRIAL_TRACKS = ['rowHouses', 'mill', 'gardenCourt', 'diner'].flatMap((id) => [
  road([38, plotStreet(id)[1]], plotStreet(id), 0.85, id),
  road(atPlot(id, 0, 2), plotStreet(id), 0.75, id),
]);
export const townTracks = (town) => [
  ...TOWN_TRACKS.filter(({ plot }) => !plot || plot === 'mine' || plotUnlocked(town, plot)),
  ...(town.era !== 'frontier' && town.buildings.bridge ? [CROSSING, ...EAST_TRACKS] : []),
  ...INDUSTRIAL_TRACKS.filter(({ plot }) => plotUnlocked(town, plot)),
];
export const railEdges = (town) =>
  town.era !== 'frontier' && town.buildings.railDepot ? [RAIL_EDGE] : [];

// Split road intersections into a small deterministic graph. No route may invent a
// straight-line shortcut through water or a building to reach a newly unlocked district.
export function routeGraph(town, mode = 'pedestrian') {
  const boatPath = mode === 'boat' ? riverPath(-70, 70, 5) : [];
  const segments =
    mode === 'train'
      ? railEdges(town)
      : mode === 'boat'
        ? boatPath.slice(1).map((to, i) => ({ from: boatPath[i], to, modes: ['boat'] }))
        : townTracks(town).filter((edge) => edge.modes.includes(mode));
  const points = [...segments.flatMap(({ from, to }) => [from, to])];
  for (const a of segments)
    for (const b of segments) {
      if (a.from[0] === a.to[0] && b.from[1] === b.to[1]) {
        const p = [a.from[0], b.from[1]];
        if (
          segmentDistance(...p, a.from, a.to) < 0.001 &&
          segmentDistance(...p, b.from, b.to) < 0.001
        )
          points.push(p);
      }
    }
  const nodes = new Map(points.map((p) => [p.join(','), p]));
  const edges = new Map([...nodes.keys()].map((key) => [key, new Set()]));
  for (const segment of segments) {
    const on = [...nodes]
      .filter(([, p]) => segmentDistance(...p, segment.from, segment.to) < 0.001)
      .sort(
        (a, b) =>
          Math.hypot(a[1][0] - segment.from[0], a[1][1] - segment.from[1]) -
          Math.hypot(b[1][0] - segment.from[0], b[1][1] - segment.from[1]),
      );
    for (let i = 1; i < on.length; i++) {
      edges.get(on[i - 1][0]).add(on[i][0]);
      edges.get(on[i][0]).add(on[i - 1][0]);
    }
  }
  return { nodes, edges };
}
export function routeBetween(town, from, to, mode = 'pedestrian') {
  return routeOnGraph(routeGraph(town, mode), from, to);
}

// Reuse one graph when several routes belong to the same town snapshot.
export function routeOnGraph({ nodes, edges }, from, to) {
  const start = from.join(','),
    end = to.join(',');
  if (!nodes.has(start) || !nodes.has(end)) return [];
  const queue = [[start]],
    seen = new Set([start]);
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i],
      last = path.at(-1);
    if (last === end) return path.map((id) => nodes.get(id));
    for (const next of edges.get(last))
      if (!seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
  }
  return [];
}
export function segmentDistance(x, z, from, to) {
  const dx = to[0] - from[0],
    dz = to[1] - from[1];
  const t = Math.max(
    0,
    Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(x - from[0] - t * dx, z - from[1] - t * dz);
}
// One projection keeps the accessible SVG map's plots and dirt tracks together.
export const mapPoint = ([x, z]) => [500 + x * 24, 350 + z * 14];
