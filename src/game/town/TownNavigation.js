import { footprintDistance, sweptClear } from './BuildingFootprints';
import { Vector3 } from 'three';
import { prepareRoute, routePose } from './TownRoutes';

// Physical footprint plus a visible gap. No mesh intersections or physics bodies.
import { NPC_BODY_MARGIN } from '../../data/townClearances';
export const NPC_MARGIN = NPC_BODY_MARGIN;
const CELL = 4,
  SIDES = 12,
  EPS = 1e-6;
export function walkObstacle(root, x, z, radius, height = 3) {
  (root.userData.walkObstacles ??= []).push({ x, z, radius, height });
}
export function townNavigation(world) {
  world.updateMatrixWorld(true);
  const obstacles = [];
  world.traverse((root) => {
    for (let node = root; node; node = node.parent)
      if (node.userData.activation === 'removed' || node.userData.activation === 'pending') return;
    obstacles.push(...(root.userData.footprints ?? []).filter((o) => o.activation !== 'removed'));
    for (const footprint of root.userData.walkObstacles ?? []) {
      const p = root.localToWorld(new Vector3(footprint.x, 0, footprint.z));
      const scale = root.getWorldScale(new Vector3());
      obstacles.push({
        x: p.x,
        z: p.z,
        y: p.y,
        radius: footprint.radius * Math.max(Math.abs(scale.x), Math.abs(scale.z)),
        height: footprint.height * Math.abs(scale.y),
        owner: root.userData.plot ? `plot:${root.userData.plot}` : undefined,
      });
    }
  });
  return new TownNavigation(obstacles);
}
function distanceToSegment(o, a, b) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((o.x - a[0]) * dx + (o.z - a[2]) * dz) / length)) : 0;
  return Math.hypot(o.x - a[0] - dx * t, o.z - a[2] - dz * t);
}
const sameHeight = (o, p) => p[1] + 1.65 > o.y && p[1] + 0.08 < o.y + o.height;
const ring = (o, margin, y) =>
  o.polygon
    ? o.polygon.map(([x, z], i, polygon) => {
        const previous = polygon[(i + polygon.length - 1) % polygon.length],
          next = polygon[(i + 1) % polygon.length];
        const edge1 = [x - previous[0], z - previous[1]],
          edge2 = [next[0] - x, next[1] - z];
        const winding =
          polygon.reduce((sum, p, j) => {
            const q = polygon[(j + 1) % polygon.length];
            return sum + p[0] * q[1] - q[0] * p[1];
          }, 0) >= 0
            ? 1
            : -1;
        const normal = ([dx, dz]) => {
          const length = Math.hypot(dx, dz) || 1;
          return [(winding * dz) / length, (-winding * dx) / length];
        };
        const n1 = normal(edge1),
          n2 = normal(edge2),
          denom = 1 + n1[0] * n2[0] + n1[1] * n2[1];
        const scale = (margin + 0.04) / Math.max(0.01, denom);
        return [x + (n1[0] + n2[0]) * scale, y, z + (n1[1] + n2[1]) * scale];
      })
    : Array.from({ length: SIDES }, (_, i) => {
        // Circumscribed polygon: chords, not just vertices, clear the footprint.
        const angle = (i * Math.PI * 2) / SIDES,
          r = (o.radius + margin + 0.035) / Math.cos(Math.PI / SIDES);
        return [o.x + Math.cos(angle) * r, y, o.z + Math.sin(angle) * r];
      });
export class TownNavigation {
  constructor(obstacles = []) {
    this.obstacles = obstacles;
    this.cells = new Map();
    this.routes = new WeakMap();
    this.plans = 0;
    this.prepared = new Map();
    this.reindex();
  }
  reindex() {
    this.cells.clear();
    this.bounds = new WeakMap();
    for (const o of this.obstacles) {
      const bounds = o.polygon
        ? {
            minX: Math.min(...o.polygon.map((p) => p[0])),
            maxX: Math.max(...o.polygon.map((p) => p[0])),
            minZ: Math.min(...o.polygon.map((p) => p[1])),
            maxZ: Math.max(...o.polygon.map((p) => p[1])),
          }
        : {
            minX: o.x - o.radius,
            maxX: o.x + o.radius,
            minZ: o.z - o.radius,
            maxZ: o.z + o.radius,
          };
      this.bounds.set(o, bounds);
      for (
        let x = Math.floor((bounds.minX - 2) / CELL);
        x <= Math.floor((bounds.maxX + 2) / CELL);
        x++
      )
        for (
          let z = Math.floor((bounds.minZ - 2) / CELL);
          z <= Math.floor((bounds.maxZ + 2) / CELL);
          z++
        ) {
          const key = `${x},${z}`;
          if (!this.cells.has(key)) this.cells.set(key, []);
          this.cells.get(key).push(o);
        }
    }
  }
  segment(a, b, margin = NPC_MARGIN) {
    return this.nearbySegment(a, b, margin).every((o) => sweptClear(o, a, b, margin));
  }
  replaceOwner(owner, entries, activation = 'completed') {
    const old = this.obstacles.filter((o) => o.owner === owner);
    this.obstacles = this.obstacles.filter((o) => o.owner !== owner);
    const next = entries.map((entry) => ({ ...entry, owner, activation }));
    if (activation !== 'removed') this.obstacles.push(...next);
    this.reindex();
    const changed = [...old, ...next];
    return this.invalidateRegion(
      changed.length
        ? {
            minX: Math.min(...changed.map((o) => o.x - o.radius)),
            maxX: Math.max(...changed.map((o) => o.x + o.radius)),
            minZ: Math.min(...changed.map((o) => o.z - o.radius)),
            maxZ: Math.max(...changed.map((o) => o.z + o.radius)),
          }
        : null,
    );
  }
  invalidateRegion(bounds) {
    const ids = [];
    if (!bounds) return ids;
    for (const [id, record] of this.prepared) {
      const b = record.bounds;
      if (
        b.maxX < bounds.minX ||
        b.minX > bounds.maxX ||
        b.maxZ < bounds.minZ ||
        b.minZ > bounds.maxZ
      )
        continue;
      record.path.invalidated = true;
      record.variants?.delete(record.key);
      ids.push(id);
      this.prepared.delete(id);
    }
    return ids;
  }
  near(x, z) {
    return this.cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? [];
  }
  nearbySegment(a, b, margin = NPC_MARGIN) {
    const found = new Set();
    const minX = Math.min(a[0], b[0]) - margin - EPS,
      maxX = Math.max(a[0], b[0]) + margin + EPS,
      minZ = Math.min(a[2], b[2]) - margin - EPS,
      maxZ = Math.max(a[2], b[2]) + margin + EPS;
    for (
      let x = Math.floor((Math.min(a[0], b[0]) - margin) / CELL);
      x <= Math.floor((Math.max(a[0], b[0]) + margin) / CELL);
      x++
    )
      for (
        let z = Math.floor((Math.min(a[2], b[2]) - margin) / CELL);
        z <= Math.floor((Math.max(a[2], b[2]) + margin) / CELL);
        z++
      )
        for (const o of this.cells.get(`${x},${z}`) ?? []) {
          const bounds = this.bounds.get(o);
          if (bounds.maxX < minX || bounds.minX > maxX || bounds.maxZ < minZ || bounds.minZ > maxZ)
            continue;
          if (sameHeight(o, a) || sameHeight(o, b)) found.add(o);
        }
    return [...found];
  }
  clear(p, margin = NPC_MARGIN) {
    return this.near(p[0], p[2]).every(
      (o) => !sameHeight(o, p) || footprintDistance(o, p[0], p[2]) >= margin - EPS,
    );
  }
  safePoint(p, margin = NPC_MARGIN) {
    if (this.clear(p, margin)) return p.slice();
    const candidates = this.near(p[0], p[2])
      .filter((o) => sameHeight(o, p))
      .flatMap((o) => ring(o, margin, p[1]));
    candidates.sort(
      (a, b) => Math.hypot(a[0] - p[0], a[2] - p[2]) - Math.hypot(b[0] - p[0], b[2] - p[2]),
    );
    return candidates.find((a) => this.clear(a, margin)) ?? null;
  }
  detour(a, b, margin) {
    const obstacles = this.nearbySegment(a, b, margin).filter((o) => !sweptClear(o, a, b, margin));
    if (obstacles.every((o) => sweptClear(o, a, b, margin))) return [a, b];
    const nodes = [
      a,
      b,
      ...obstacles
        .flatMap((o) => ring(o, margin, (a[1] + b[1]) / 2))
        .filter((p) => this.clear(p, margin)),
    ];
    const distances = nodes.map(() => Infinity),
      previous = nodes.map(() => -1),
      done = new Set();
    distances[0] = 0;
    while (done.size < nodes.length) {
      let at = -1;
      for (let n = 0; n < nodes.length; n++)
        if (!done.has(n) && (at < 0 || distances[n] < distances[at])) at = n;
      if (at < 0 || !Number.isFinite(distances[at])) break;
      if (at === 1) {
        const path = [];
        for (let n = 1; n >= 0; n = previous[n]) path.unshift(nodes[n]);
        return path;
      }
      done.add(at);
      for (let next = 0; next < nodes.length; next++) {
        if (done.has(next)) continue;
        const length = Math.hypot(nodes[at][0] - nodes[next][0], nodes[at][2] - nodes[next][2]);
        if (distances[at] + length >= distances[next]) continue;
        if (
          this.nearbySegment(nodes[at], nodes[next], margin).some(
            (o) => !sweptClear(o, nodes[at], nodes[next], margin),
          )
        )
          continue;
        distances[next] = distances[at] + length;
        previous[next] = at;
      }
    }
    // A blocked route stops at the last safe point; never fall through scenery.
    return [a];
  }
  track(path, margin) {
    if (!path.points.length) return path;
    const xs = path.points.map((p) => p[0]),
      zs = path.points.map((p) => p[2]);
    this.prepared.set(path, {
      path,
      bounds: {
        minX: Math.min(...xs) - margin,
        maxX: Math.max(...xs) + margin,
        minZ: Math.min(...zs) - margin,
        maxZ: Math.max(...zs) + margin,
      },
    });
    return path;
  }
  plan(points, margin = NPC_MARGIN) {
    this.plans++;
    if (!points.length) return walkPath([]);
    const first = this.safePoint(points[0], margin);
    if (!first) return walkPath([]);
    const last = this.safePoint(points.at(-1), margin);
    if (!last) return walkPath([first]);
    const anchors = [first, ...points.slice(1, -1).filter((p) => this.clear(p, margin)), last];
    const route = [first];
    for (const p of anchors.slice(1)) {
      if (Math.hypot(p[0] - route.at(-1)[0], p[2] - route.at(-1)[2]) < EPS) continue;
      const section = this.detour(route.at(-1), p, margin);
      if (section.length < 2) {
        // If a loop is blocked, retrace the verified prefix. Repeating a truncated
        // loop would otherwise jump from its dead end back to the start.
        if (Math.hypot(...points[0].map((v, i) => v - points.at(-1)[i])) < EPS)
          route.push(...route.slice(0, -1).reverse());
        break;
      }
      route.push(...section.slice(1));
    }
    return this.track(walkPath(route), margin);
  }
  route(route, offset = 0, margin = NPC_MARGIN) {
    let variants = this.routes.get(route);
    if (!variants) {
      variants = new Map();
      this.routes.set(route, variants);
    }
    const key = `${offset}:${margin}`;
    if (variants.has(key)) return variants.get(key);
    const original = Array.isArray(route) ? prepareRoute(route) : route;
    const count = Math.max(1, Math.ceil(original.total / 0.4));
    const points = Array.from({ length: count + 1 }, (_, i) => {
      const p = routePose(original, (original.total * i) / count);
      return [p.x + Math.cos(p.heading) * offset, 0.07, p.z - Math.sin(p.heading) * offset];
    });
    const path = this.plan(points, margin);
    variants.set(key, path);
    this.prepared.set(path, {
      path,
      variants,
      key,
      bounds: {
        minX: Math.min(...points.map((p) => p[0])) - margin,
        maxX: Math.max(...points.map((p) => p[0])) + margin,
        minZ: Math.min(...points.map((p) => p[2])) - margin,
        maxZ: Math.max(...points.map((p) => p[2])) + margin,
      },
    });
    return path;
  }
}
export function walkPath(points) {
  const ends = [],
    headings = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(...points[i].map((v, j) => v - points[i - 1][j]));
    ends.push(total);
    headings.push(Math.atan2(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]));
  }
  return { points, ends, headings, total };
}
export function routeDistanceAt(path, x, z) {
  let best = Infinity,
    distance = 0,
    before = 0;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1],
      b = path.points[i],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      length = path.ends[i - 1] - before;
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)),
    );
    const gap = Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
    if (gap < best) {
      best = gap;
      distance = before + t * length;
    }
    before = path.ends[i - 1];
  }
  return distance;
}
export function walkPose(path, progress, out = {}) {
  const { points, ends, headings, total } = path;
  if (points.length < 2) {
    if (points[0]) [out.x, out.y, out.z] = points[0];
    out.state = 'no-path';
    out.heading = 0;
    return out;
  }
  const distance = Math.max(0, Math.min(1, progress)) * total;
  let lo = 0,
    hi = ends.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ends[mid] < distance) lo = mid + 1;
    else hi = mid;
  }
  const before = lo ? ends[lo - 1] : 0,
    t = (distance - before) / (ends[lo] - before || 1),
    a = points[lo],
    b = points[lo + 1];
  out.x = a[0] + (b[0] - a[0]) * t;
  out.y = a[1] + (b[1] - a[1]) * t;
  out.z = a[2] + (b[2] - a[2]) * t;
  out.heading = headings[lo];
  // Ease facing only. Rounding the positions would cut inside the safe boundary.
  const length = ends[lo] - before,
    along = distance - before;
  const radius = Math.min(0.25, length / 3);
  const turn = (from, to, amount) => {
    const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + delta * amount * amount * (3 - 2 * amount);
  };
  if (radius && lo > 0 && along < radius)
    out.heading = turn(headings[lo - 1], out.heading, 0.5 + along / (2 * radius));
  else if (radius && lo < headings.length - 1 && along > length - radius)
    out.heading = turn(out.heading, headings[lo + 1], 0.5 - (length - along) / (2 * radius));
  return out;
}
export function prepareActorWalk(d, actor, offset = 0.9) {
  if (!d.navigation?.obstacles.length || actor.work || (actor.manual && !actor.transportVisitor))
    return;
  if (actor.navigation === d.navigation && !actor.walkPath?.invalidated) return;
  const count = Math.max(8, Math.ceil(actor.curve.getLength() / 0.35));
  const door = actor.door ?? actor.curve.getPointAt(0);
  const points = Array.from({ length: count + 1 }, (_, i) => {
    const t = Math.min(0.999999, i / count),
      p = actor.curve.getPointAt(t),
      tangent = actor.curve.getTangentAt(t);
    const lane = offset * (actor.visitor ? Math.min(1, p.distanceTo(door) / 2) : 1);
    return [p.x + tangent.z * lane, p.y, p.z - tangent.x * lane];
  });
  points[points.length - 1] = points[0].slice();
  actor.walkPath = d.navigation.plan(points);
  if (actor.motion)
    actor.motion.routeDistance = routeDistanceAt(actor.walkPath, actor.motion.x, actor.motion.z);
  actor.navigation = d.navigation;
  actor.walkSpeed ??= actor.curve.getLength() / actor.duration;
  actor.duration = actor.walkPath.total / (actor.walkSpeed || 0.55);
  actor.duration = Math.max(0.1, actor.duration);
  actor.walkPose = { x: actor.root.position.x, y: actor.root.position.y, z: actor.root.position.z };
}

// Manual scene actors use the same index, including translated construction roots.
export function localWalk(d, parent, points, margin = NPC_MARGIN) {
  if (!d.navigation?.obstacles.length) return null;
  parent.updateWorldMatrix(true, false);
  const world = points.map(([x, z]) => parent.localToWorld(new Vector3(x, 0.08, z)).toArray());
  const path = d.navigation.plan(world, margin);
  return walkPath(path.points.map((p) => parent.worldToLocal(new Vector3(...p)).toArray()));
}
export function planCurve(d, curve, margin = NPC_MARGIN) {
  if (!d.navigation?.obstacles.length) return null;
  const count = Math.max(8, Math.ceil(curve.getLength() / 0.35));
  return d.navigation.plan(
    Array.from({ length: count + 1 }, (_, i) => curve.getPointAt(i / count).toArray()),
    margin,
  );
}
const placement = new Vector3();
export function placeSafely(d, root, margin = NPC_MARGIN) {
  if (!d.navigation?.obstacles.length) return;
  root.parent.updateWorldMatrix(true, false);
  placement.copy(root.position);
  root.parent.localToWorld(placement);
  const safe = d.navigation.safePoint(placement.toArray(), margin);
  if (safe) root.position.copy(root.parent.worldToLocal(placement.fromArray(safe)));
}

export function planOrbit(d, x, z, rx, rz, margin, y = 0.07) {
  if (!d.navigation?.obstacles.length) return null;
  return d.navigation.plan(
    Array.from({ length: 65 }, (_, i) => {
      const angle = (i / 64) * Math.PI * 2;
      return [x + Math.sin(angle) * rx, y, z + Math.cos(angle) * rz];
    }),
    margin,
  );
}

export function plotDoor(d, id, fallback) {
  const anchors = d.plotCache?.get(id)?.group.userData.navigationAnchors?.door;
  const point = anchors?.find((p) => !d.navigation || d.navigation.clear(p));
  return point ? [point[0], point[2]] : fallback;
}
