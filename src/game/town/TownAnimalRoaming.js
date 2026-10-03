import { flyingAnimal } from '../../data/townAnimals';
import { PLOTS, townTracks, segmentDistance } from './TownLayout';
import { groundHeight } from './TownLandscape';
import { RIVER, riverCenterX, riverDistance } from './TownRiver';
import { routeStepPose, walkPath } from './TownNavigation';
import { hash01 } from './TownMath';

const MAX_NODES = 40;
const BASE_NODES = 24;
const MAX_CONNECTIONS = 48;
const LEG_LENGTH = 2.5;
const JOIN_GAP = 0.06;
const gap2 = (a, b) => (a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2;
const eligible = (a) =>
  !a.companion && !flyingAnimal(a.species) && (a.wild || ['dog', 'cat'].includes(a.species));
const region = (a) => (a.species === 'otter' ? 'riverbank' : a.wild ? 'outskirts' : 'town');

function retainedAnimal(d, a) {
  const parent = Object.getPrototypeOf(d);
  const retained = d.retainedAnimals ?? parent?.retainedAnimals;
  const animals = retained ? retained.values() : (parent?.animals ?? []);
  for (const old of animals)
    if (old.species === a.species && old.seed === a.seed && old.costume === a.costume) return old;
  return null;
}

function policy(d, kind, radius, height) {
  const roads = townTracks(d.town);
  const lastRow = Math.max(
    20,
    ...Object.entries(PLOTS)
      .filter(([id, [x]]) => d.town.buildings[id] && x > -28 && x < 20)
      .map(([, [, z]]) => z),
  );
  const pointClear = (p, local = false) => {
    const [x, y, z] = p;
    const ground = groundHeight(x, z);
    if (ground < -0.05 || Math.abs(y - ground - 0.07) > 0.18) return false;
    if (kind === 'town') {
      if (x < -28 || x > 19 || z < -20 || z > lastRow + 5.5) return false;
      if (riverDistance(x, z) < RIVER.bankWidth + radius) return false;
    } else {
      if (z < lastRow + 3.75 || z > lastRow + 22) return false;
      if (kind === 'riverbank') {
        const edge = riverCenterX(z) - RIVER.bankWidth;
        if (x > edge - radius - 0.15 || x < edge - 8) return false;
      } else if (x < -31 || x > 19 || riverDistance(x, z) < RIVER.bankWidth + radius) {
        return false;
      }
    }
    // Existing town itineraries already handle supported street crossings.
    // New local branches and wildlife stay outside the carriageway.
    if (
      (local || kind !== 'town') &&
      roads.some(
        (road) => segmentDistance(x, z, road.from, road.to) < road.width / 2 + radius + 0.08,
      )
    )
      return false;
    return d.navigation.clear(p, radius) && d.animalSpace.clear(p, radius, height);
  };
  const pathClear = (points, local = false) => {
    for (let i = 0; i < points.length; i++) {
      if (!pointClear(points[i], local)) return false;
      if (!i) continue;
      const a = points[i - 1],
        b = points[i];
      if (!d.navigation.segment(a, b, radius) || !d.animalSpace.segment(a, b, radius, height))
        return false;
      const samples = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.5);
      for (let n = 1; n < samples; n++) {
        const t = n / samples;
        if (
          !pointClear(
            [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
            local,
          )
        )
          return false;
      }
    }
    return true;
  };
  return { pointClear, pathClear };
}

const groundPoint = (x, z) => [x, groundHeight(x, z) + 0.07, z];
function routePoints(path, start, end) {
  const points = [];
  const count = Math.max(1, Math.ceil(Math.abs(end - start) / 0.3));
  const pose = {};
  for (let n = 0; n <= count; n++) {
    routeStepPose(path, start + ((end - start) * n) / count, pose);
    points.push(groundPoint(pose.x, pose.z));
  }
  return points;
}

function addNode(graph, point, rules) {
  if (!rules.pointClear(point)) return -1;
  const old = graph.nodes.findIndex((node) => gap2(node.point, point) < 0.02 ** 2);
  if (old >= 0) return old;
  if (graph.nodes.length >= MAX_NODES) return -1;
  graph.nodes.push({ point, legs: [] });
  return graph.nodes.length - 1;
}

function connect(graph, from, to, points, rules, local = false) {
  if (from < 0 || to < 0 || from === to || graph.legs.length >= MAX_CONNECTIONS * 2) return;
  if (graph.nodes[from].legs.some((id) => graph.legs[id].to === to)) return;
  if (!rules.pathClear(points, local)) return;
  const path = walkPath(points);
  if (path.total < 0.15 || path.total > LEG_LENGTH + 0.2) return;
  const id = graph.legs.length;
  graph.legs.push(
    Object.freeze({ from, to, path, local, reverse: id + 1 }),
    Object.freeze({
      from: to,
      to: from,
      path: walkPath(points.slice().reverse()),
      local,
      reverse: id,
    }),
  );
  graph.nodes[from].legs.push(id);
  graph.nodes[to].legs.push(id + 1);
}

function* prepareGraph(members, rules) {
  const graph = { nodes: [], legs: [] };
  const quota = Math.max(3, Math.floor(BASE_NODES / members.length));
  for (const animal of members) {
    const records = [];
    const origin = animal.progress ?? 0;
    for (let n = 0; n < quota; n++) {
      const step = n ? Math.ceil(n / 2) * (n % 2 ? 1 : -1) : 0;
      const at = origin + step * LEG_LENGTH;
      const point = routePoints(animal.path, at, at)[0];
      const node = addNode(graph, point, rules);
      if (node >= 0) records.push({ at, node });
      yield;
    }
    records.sort((a, b) => a.at - b.at);
    for (let n = 1; n < records.length; n++) {
      const a = records[n - 1],
        b = records[n];
      connect(graph, a.node, b.node, routePoints(animal.path, a.at, b.at), rules);
      yield;
    }
  }
  // Join nearby original habitats, so fox/deer encounters can happen naturally.
  // Every connector is short and checked as a swept body, never a guessed shortcut.
  const baseCount = graph.nodes.length;
  for (let from = 0; from < baseCount; from++)
    for (let to = from + 1; to < baseCount; to++) {
      const a = graph.nodes[from].point,
        b = graph.nodes[to].point;
      if (gap2(a, b) <= LEG_LENGTH ** 2) connect(graph, from, to, [a, b], rules, true);
      yield;
    }
  // A few open-ground branches make wandering vary without a runtime planner.
  for (let n = 0; n < baseCount && graph.nodes.length < MAX_NODES; n += 3) {
    const origin = graph.nodes[n].point;
    const angle = hash01(n + members[0].seed) * Math.PI * 2;
    const point = groundPoint(origin[0] + Math.cos(angle) * 1.8, origin[2] + Math.sin(angle) * 1.8);
    const node = addNode(graph, point, rules);
    connect(graph, n, node, [origin, point], rules, true);
    yield;
  }
  graph.nodes.forEach((node) => {
    Object.freeze(node.point);
    Object.freeze(node.legs);
    Object.freeze(node);
  });
  Object.freeze(graph.nodes);
  Object.freeze(graph.legs);
  return graph;
}

// Preparation belongs to the existing resumable animal population lifecycle.
// Animation only selects immutable, finite, certified legs from these small graphs.
export function* prepareAnimalRoaming(d) {
  const groups = new Map();
  for (const animal of d.animals ?? []) {
    animal.roaming = null;
    if (!eligible(animal) || !animal.path?.total) continue;
    const key = region(animal);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(animal);
  }
  if (!d.navigation?.segment || !d.animalSpace?.segment || !d.town) return;
  for (const [kind, members] of groups) {
    const memberKey = members
      .map((a) => `${a.species}:${a.seed}:${a.radius ?? 0.45}:${a.height ?? 1}`)
      .sort()
      .join('|');
    const radius = Math.max(...members.map((a) => a.radius ?? 0.45));
    const height = Math.max(...members.map((a) => a.height ?? 1));
    const rules = policy(d, kind, radius, height);
    const retained = members.map((a) => retainedAnimal(d, a));
    const previous = retained.find((a) => a?.roaming)?.roaming;
    let graph = previous?.memberKey === memberKey ? previous : null;
    if (graph)
      for (const leg of graph.legs) {
        if (!rules.pathClear(leg.path.points, leg.local)) {
          graph = null;
          break;
        }
        yield;
      }
    graph ??= yield* prepareGraph(members, rules);
    for (const leg of graph.legs) {
      leg.path.points.forEach(Object.freeze);
      Object.freeze(leg.path.points);
      leg.path.clearance = {
        navigation: d.navigation,
        revision: d.navigation.revision ?? d.navigation.obstacles,
        margin: radius,
        space: d.animalSpace,
        height,
      };
    }
    for (const [n, animal] of members.entries()) {
      const old = retained[n]?.roaming;
      animal.roaming = {
        ...(old?.nodes === graph.nodes ? old : {}),
        nodes: graph.nodes,
        legs: graph.legs,
        basePath: animal.path,
        navigation: d.navigation,
        space: d.animalSpace,
        region: kind,
        memberKey,
        node: old?.nodes === graph.nodes ? old.node : -1,
        activeLeg: old?.nodes === graph.nodes ? old.activeLeg : null,
        choice: old?.choice ?? 0,
        lastTurn: -Infinity,
      };
      yield;
    }
  }
}

function install(animal, roaming, id) {
  const leg = roaming.legs[id];
  roaming.activeLeg = id;
  roaming.node = leg.from;
  animal.walkPath = leg.path;
  animal.routeLimit = leg.path.total;
  animal.direction = 1;
}
const targetGap = (point, target) => (point[0] - target.x) ** 2 + (point[2] - target.z) ** 2;

export function updateAnimalRoaming(animal, time, targetPosition = null, flee = false) {
  animal.roamingHold = false;
  const escaping = time < (animal.escapeUntil ?? 0);
  if (escaping) {
    targetPosition = animal.escapeFrom;
    flee = true;
  }
  const roaming = animal.roaming;
  if (!roaming?.legs.length) return false;
  const position = animal.root.position;
  let active = roaming.activeLeg === null ? null : roaming.legs[roaming.activeLeg];
  // Retention can copy the controller before its old actor finishes another leg.
  // Restore its current immutable leg by identity instead of moving the actor.
  if (animal.walkPath && active?.path !== animal.walkPath) {
    const id = roaming.legs.findIndex((leg) => leg.path === animal.walkPath);
    if (id >= 0) {
      roaming.activeLeg = id;
      active = roaming.legs[id];
    }
  }
  if (active && animal.walkPath === active.path) {
    const end = roaming.nodes[active.to].point;
    const atEnd = (position.x - end[0]) ** 2 + (position.z - end[2]) ** 2 <= 1e-10;
    if (!atEnd) {
      if (targetPosition && time - roaming.lastTurn >= 0.35) {
        const start = roaming.nodes[active.from].point;
        const improvement = targetGap(end, targetPosition) - targetGap(start, targetPosition);
        if (flee ? improvement < -0.15 : improvement > 0.15) {
          install(animal, roaming, active.reverse);
          roaming.lastTurn = time;
        }
      }
      return true;
    }
    roaming.lastNode = active.from;
    roaming.node = active.to;
  } else {
    // A newly rebuilt graph may not match a retained actor's current position.
    // Keep its original safe itinerary until it reaches a prepared graph vertex.
    let nearest = -1,
      best = JOIN_GAP ** 2;
    for (let n = 0; n < roaming.nodes.length; n++) {
      const point = roaming.nodes[n].point;
      const gap = (position.x - point[0]) ** 2 + (position.z - point[2]) ** 2;
      if (gap <= best) {
        nearest = n;
        best = gap;
      }
    }
    if (nearest < 0) return false;
    roaming.node = nearest;
  }
  const options = roaming.nodes[roaming.node].legs;
  let selected = -1,
    best = -Infinity;
  roaming.choice++;
  for (const id of options) {
    const leg = roaming.legs[id];
    if (
      escaping &&
      targetGap(roaming.nodes[leg.to].point, targetPosition) <=
        targetGap(roaming.nodes[roaming.node].point, targetPosition) + 0.1
    )
      continue;
    const score = targetPosition
      ? targetGap(roaming.nodes[leg.to].point, targetPosition) * (flee ? 1 : -1)
      : hash01(animal.seed + roaming.choice * 47 + id * 13) - (leg.to === roaming.lastNode ? 1 : 0);
    if (score > best) {
      selected = id;
      best = score;
    }
  }
  if (selected < 0) {
    animal.roamingHold = escaping;
    return escaping;
  }
  install(animal, roaming, selected);
  return true;
}
