import { groundHeight } from './TownLandscape';
import { RIVER, riverDistance } from './TownRiver';
import { walkPath } from './TownNavigation';

// One small corridor check when an encounter starts; no pursuit planner or
// geometry queries in the movement loop. Roads are traversable ground here.
const RUN_OUT = 3;
function corridorClear(from, to, radius, height, navigation, space, budget) {
  const samples = Math.ceil(Math.hypot(to[0] - from[0], to[2] - from[2]) / 0.5);
  for (let n = 0; n <= samples; n++) {
    const t = samples ? n / samples : 0;
    const x = from[0] + (to[0] - from[0]) * t;
    const z = from[2] + (to[2] - from[2]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    const ground = groundHeight(x, z);
    if (
      ground < -0.05 ||
      Math.abs(y - ground - 0.07) > 0.18 ||
      riverDistance(x, z) < RIVER.bankWidth + radius
    )
      return false;
  }
  if (!navigation.segment(from, to, radius)) return false;
  // Short swept boxes hug a diagonal corridor. One large axis-aligned box can
  // incorrectly include a tree several metres beside the actual escape line.
  const sections = Math.max(1, Math.ceil(samples / 2));
  let a = from;
  for (let n = 1; n <= sections; n++) {
    if (budget.remaining <= 0) return false;
    budget.remaining--;
    const t = n / sections;
    const b = from.map((value, axis) => value + (to[axis] - value) * t);
    if (!space.segment(a, b, radius, height)) return false;
    a = b;
  }
  return true;
}

function install(animal, points, navigation, space, details) {
  const path = walkPath(points);
  path.clearance = {
    navigation,
    revision: navigation.revision ?? navigation.obstacles,
    margin: animal.radius,
    space,
    height: animal.height ?? 1,
  };
  animal.chaseRoute = {
    path,
    previousPath: animal.walkPath,
    previousLimit: animal.routeLimit,
    previousDirection: animal.direction,
    ...details,
  };
  animal.walkPath = path;
  animal.routeLimit = path.total;
  animal.direction = 1;
  animal.roamingHold = false;
  animal.escapeUntil = 0;
}

const gap = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// Bounded look-ahead over the existing tiny graph, once per encounter. Every
// chosen leg increases separation and avoids a hairpin. The final point belongs
// to ordinary roaming, so the prey never has to retrace its escape to get home.
function escapeChoices(prey, origin, start, required) {
  const { nodes = [], legs = [] } = prey.roaming;
  const dx = start[0] - origin[0],
    dz = start[2] - origin[2];
  const length = Math.hypot(dx, dz) || 1;
  const candidates = [];
  // Outward edges form a tiny acyclic graph. Cache their remaining distance
  // once, so an attractive short dead end cannot hide a longer escape branch.
  const reach = nodes.map(() => 0);
  const distances = nodes.map((node) => gap(node.point, origin));
  const order = nodes.map((_, i) => i).sort((a, b) => distances[b] - distances[a]);
  for (const node of order)
    for (const id of nodes[node].legs) {
      const leg = legs[id];
      if (distances[leg.to] - distances[node] >= 0.08)
        reach[node] = Math.max(reach[node], leg.path.total + reach[leg.to]);
    }
  for (let first = 0; first < nodes.length; first++) {
    const entry = nodes[first].point;
    const approach = gap(start, entry);
    const alignment =
      approach < 0.05
        ? 1
        : ((entry[0] - start[0]) * dx + (entry[2] - start[2]) * dz) / (approach * length);
    if (approach > 12 || alignment < 0.45) continue;
    let node = first,
      travel = approach,
      vx = dx / length,
      vz = dz / length;
    const points = approach < 1e-5 ? [start] : [start, entry];
    const visited = new Set([first]);
    for (let step = 0; travel < required && step < 16; step++) {
      let next = null,
        best = -Infinity;
      const here = nodes[node].point;
      for (const id of nodes[node].legs) {
        const leg = legs[id],
          end = nodes[leg.to].point;
        const distance = gap(here, end);
        const outward = gap(end, origin) - gap(here, origin);
        const turn = ((end[0] - here[0]) * vx + (end[2] - here[2]) * vz) / (distance || 1);
        if (
          visited.has(leg.to) ||
          outward < 0.08 ||
          turn < -0.1 ||
          travel + leg.path.total + reach[leg.to] < required
        )
          continue;
        const score = outward / (leg.path.total || 1) + turn * 0.4;
        if (score > best) {
          best = score;
          next = leg;
        }
      }
      if (!next) break;
      const end = nodes[next.to].point,
        distance = gap(here, end) || 1;
      vx = (end[0] - here[0]) / distance;
      vz = (end[2] - here[2]) / distance;
      points.push(...next.path.points.slice(1));
      travel += next.path.total;
      node = next.to;
      visited.add(node);
    }
    if (travel < required || gap(start, nodes[node].point) < 5.5) continue;
    candidates.push({ points, node, entry, score: alignment * 4 - approach * 0.03 });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

export function prepareAnimalChase(pair, navigation, space) {
  const { predator, prey, bird } = pair;
  // Every chase route is checked against the walk graph; without one (a minimal
  // village) animals keep their own itineraries instead of chasing.
  if (!navigation || !space) return false;
  // A minimal/unsupported population without a roaming controller keeps its
  // original safe itinerary. Normal ground participants always have one.
  if (!predator.roaming || (!bird && !prey.roaming))
    return (
      navigation.segment(pair.from, pair.to, predator.radius) &&
      space.segment(pair.from, pair.to, predator.radius, predator.height ?? 1)
    );
  const p = predator.root.position;
  const q = prey.root.position;
  const from = [p.x, p.y, p.z];
  const start = [q.x, q.y, q.z];
  const budget = { remaining: 32 };
  if (!corridorClear(from, start, predator.radius, predator.height ?? 1, navigation, space, budget))
    return false;
  if (bird) {
    install(predator, [from, start], navigation, space, {
      role: 'hunter',
      speed: predator.speed * 2.2,
    });
    return true;
  }
  const hunterSpeed = predator.speed * 2.2;
  const preySpeed = Math.max(prey.speed * 4, hunterSpeed * 1.6);
  const required = preySpeed * pair.duration + RUN_OUT;
  const radius = Math.max(predator.radius, prey.radius);
  const height = Math.max(predator.height ?? 1, prey.height ?? 1);
  for (const choice of escapeChoices(prey, from, start, required).slice(0, 6)) {
    if (!corridorClear(start, choice.entry, radius, height, navigation, space, budget)) continue;
    install(prey, choice.points, navigation, space, {
      role: 'prey',
      speed: preySpeed,
      endNode: choice.node,
      origin: { x: from[0], y: from[1], z: from[2] },
    });
    install(predator, [from, ...choice.points], navigation, space, {
      role: 'hunter',
      speed: hunterSpeed,
    });
    return true;
  }
  // A two-metre dead end cannot produce a convincing escape. Wait for another
  // proximity encounter with enough clear ground to run and keep moving ahead.
  return false;
}

export function updateAnimalChase(animal, time) {
  const route = animal.chaseRoute;
  if (!route) return false;
  animal.movementSpeed = route.speed;
  if (animal.encounter) return true;
  animal.rest = 0;
  if (route.role === 'prey') {
    route.released ??= time;
    const blend = Math.min(1, (time - route.released) / 1.5);
    animal.movementSpeed = route.speed + (animal.speed - route.speed) * blend;
    animal.state = blend < 1 ? 'fleeing' : 'walking';
    const end = route.path.points.at(-1),
      p = animal.root.position;
    if (Math.hypot(p.x - end[0], p.z - end[2]) > 1e-5) return true;
    animal.roaming.activeLeg = null;
    animal.roaming.node = route.endNode;
    animal.walkPath = null;
    animal.routeLimit = undefined;
    animal.escapeFrom = route.origin;
    animal.escapeUntil = Math.max(time + 10, animal.chaseCooldown ?? 0);
    animal.chaseRoute = null;
    return false;
  }
  animal.state = 'walking';
  animal.movementSpeed = animal.speed;
  if (!route.returning) {
    // Only the hunter breaks off and turns back. The prey keeps its forward
    // route and gradually eases into ordinary roaming at the far end.
    route.returning = true;
    animal.direction = -1;
    animal.routeLimit = 0;
  }
  const start = route.path.points[0];
  const p = animal.root.position;
  if (Math.hypot(p.x - start[0], p.z - start[2]) > 1e-5) return true;
  animal.walkPath = route.previousPath;
  animal.routeLimit = route.previousLimit;
  animal.direction = route.previousDirection;
  animal.chaseRoute = null;
  return false;
}
