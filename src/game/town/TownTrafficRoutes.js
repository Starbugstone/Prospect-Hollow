import { routeGraph, routeOnGraph, plotStreet, PLOTS } from './TownLayout';
import { prepareRoute, routePose } from './TownRoutes';
import { streetHeight } from './TownItineraries';
import { villagerRandom } from '../../data/villagers';

export function placeTraffic(root, { x, z, heading }) {
  const halfAxleSpan = (root.userData.vehicleBox?.halfLength ?? 0) * (2 / 3);
  let height = streetHeight(x, z),
    pitch = 0;
  if (halfAxleSpan) {
    const dx = Math.sin(heading) * halfAxleSpan,
      dz = Math.cos(heading) * halfAxleSpan;
    const front = streetHeight(x + dx, z + dz),
      rear = streetHeight(x - dx, z - dz);
    height = (front + rear) / 2;
    pitch = -Math.atan2(front - rear, halfAxleSpan * 2);
  }
  root.position.set(x, height, z);
  // Yaw first, then pitch around the vehicle's axle, including the return trip.
  root.rotation.set(pitch, heading, 0, 'YXZ');
}

// Prepared circuits share a junction. Change route only at that junction, so a
// new choice never teleports a vehicle or asks for a path during a frame.
export function trafficRoutes(d, source = [3.5, 7.5], required) {
  const key = `${source}:${required ?? ''}`;
  const cache = d.itineraries && (d.itineraries.trafficPools ??= new Map());
  if (cache?.has(key)) return cache.get(key);
  const graph = d.itineraries?.graph ?? routeGraph(d.town);
  const destinations = Object.keys(d.town.buildings)
    .filter((id) => PLOTS[id] && d.town.buildings[id] && !d.town.projects?.[id])
    .map(plotStreet)
    .filter(Boolean);
  const junctions = [...graph.nodes]
    .filter(
      ([key, p]) =>
        graph.edges.get(key).size >= 3 &&
        destinations.some((end) => Math.hypot(end[0] - p[0], end[1] - p[1]) < 9),
    )
    .map(([, p]) => p);
  const routes = [];
  for (let n = 0; n < Math.min(6, junctions.length); n++) {
    const a = junctions[Math.floor((n * junctions.length) / Math.min(6, junctions.length))];
    const b =
      junctions[(junctions.indexOf(a) + Math.ceil(junctions.length / 3)) % junctions.length];
    const targets = [source, a, ...(required ? [required] : []), b, source];
    const points = [source];
    for (let i = 1; i < targets.length; i++) {
      const leg = routeOnGraph(graph, targets[i - 1], targets[i]);
      if (!leg.length) {
        points.length = 0;
        break;
      }
      points.push(...leg.slice(1));
    }
    const lanes = points.map((point, i) => {
      if (!i || i === points.length - 1) return point;
      const normal = (a, b) => {
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          length = Math.hypot(dx, dz) || 1;
        return [dz / length, -dx / length];
      };
      const a = normal(points[i - 1], point),
        b = normal(point, points[i + 1]);
      return [point[0] + (a[0] + b[0]) * 0.115, point[1] + (a[1] + b[1]) * 0.115];
    });
    const path = lanes.length > 1 && prepareRoute(lanes);
    if (path?.total > 5) routes.push(path);
  }
  cache?.set(key, routes);
  return routes;
}
export function trafficTour(root, routes, { seed = 0, speed = 1.6, offset = 0 } = {}) {
  if (!routes.length) return null;
  let trip = 0,
    index = seed % routes.length,
    distance = offset * routes[index].total,
    previous;
  root.userData.trafficRoutes = routes;
  return (time) => {
    const clock = time - (root.userData.trafficDelay ?? 0);
    if (previous !== undefined) distance += Math.max(0, clock - previous) * speed;
    previous = clock;
    if (distance >= routes[index].total) {
      distance -= routes[index].total;
      let next = Math.floor(villagerRandom(seed + ++trip * 719) * routes.length);
      if (routes.length > 1 && next === index) next = (next + 1) % routes.length;
      index = next;
    }
    const pose = routePose(routes[index], distance);
    // Keep vehicles inside their half of the carriageway, including bridge deck.
    placeTraffic(root, pose);
    return distance;
  };
}
