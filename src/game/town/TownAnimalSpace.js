import { Box3, Ray, Triangle, Vector3 } from 'three';
import { TownNavigation, walkPath } from './TownNavigation';

const STEP = 0.4;
const snapshots = new WeakMap();
const point = (p) => new Vector3(...p);

// A balanced tree keeps each triangle exactly once. Splitting large terrain or
// roof triangles into spatial octants would duplicate them and waste memory.
function tree(triangles) {
  const bounds = new Box3();
  for (const t of triangles) bounds.expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c);
  if (triangles.length <= 24) return { bounds, triangles };
  const size = bounds.getSize(new Vector3());
  const axis = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
  triangles.sort((a, b) => a.a[axis] + a.b[axis] + a.c[axis] - b.a[axis] - b.b[axis] - b.c[axis]);
  const middle = triangles.length >> 1;
  return { bounds, left: tree(triangles.slice(0, middle)), right: tree(triangles.slice(middle)) };
}
function query(node, overlaps, match) {
  if (!overlaps(node.bounds)) return false;
  if (node.triangles) return node.triangles.some(match);
  return query(node.left, overlaps, match) || query(node.right, overlaps, match);
}

function snapshot(root) {
  if (snapshots.has(root)) return snapshots.get(root);
  root.updateWorldMatrix(true, true);
  const triangles = [];
  const visit = (object) => {
    if (object.userData.animated) return;
    if (object.isMesh && !object.material.transparent) {
      const { geometry } = object,
        vertices = geometry.attributes.position;
      const positions = Array.from({ length: vertices.count }, (_, n) =>
        new Vector3().fromBufferAttribute(vertices, n).applyMatrix4(object.matrixWorld),
      );
      const index = geometry.index;
      for (let n = 0; n < (index?.count ?? vertices.count); n += 3) {
        const at = (i) => positions[index ? index.getX(i) : i];
        triangles.push(new Triangle(at(n), at(n + 1), at(n + 2)));
      }
    }
    object.children.forEach(visit);
  };
  visit(root);
  const entry = triangles.length ? tree(triangles) : null;
  snapshots.set(root, entry);
  return entry;
}

// Static geometry is indexed once per immutable scenery root, including merged
// Blender meshes and the landscape outside d.world. Only the animal planner uses
// this extra index; the existing pedestrian navigation contract stays unchanged.
export function animalSpace(d) {
  const entries = [d.landscape, ...d.world.children]
    .filter((root) => root && (!root.userData.animated || root.userData.animalSolid))
    .map((root) =>
      root.userData.animated
        ? { bounds: root.userData.animalSolid.clone(), solid: true }
        : snapshot(root),
    )
    .filter(Boolean);
  const box = new Box3(),
    ray = new Ray(),
    hit = new Vector3();
  const ceiling = Math.max(9, ...entries.map(({ bounds }) => bounds.max.y + 1));
  const intersects = (bounds) => {
    for (const entry of entries) {
      if (!entry.bounds.intersectsBox(bounds)) continue;
      if (entry.solid) return true;
      if (
        query(
          entry,
          (node) => node.intersectsBox(bounds),
          (triangle) => bounds.intersectsTriangle(triangle),
        )
      )
        return true;
    }
    return false;
  };
  const body = (p, radius, height) => {
    box.min.set(p[0] - radius, p[1] + 0.04, p[2] - radius);
    box.max.set(p[0] + radius, p[1] + height, p[2] + radius);
    return box;
  };
  const inside = (p) => {
    // Surface intersection alone misses an animal entirely inside a solid box.
    // An upward ray whose nearest surface is an exit detects that case while
    // permitting an animal to stand underneath a porch or a tree canopy.
    ray.origin.set(p[0], p[1] + 0.15, p[2]);
    ray.direction.set(0, 1, 0);
    let nearest = Infinity,
      enclosed = false;
    for (const entry of entries) {
      if (entry.solid) {
        if (entry.bounds.containsPoint(ray.origin)) return true;
        continue;
      }
      query(
        entry,
        (bounds) => ray.intersectsBox(bounds),
        (t) => {
          if (!ray.intersectTriangle(t.a, t.b, t.c, false, hit)) return false;
          const distance = hit.y - ray.origin.y;
          if (distance < nearest) {
            nearest = distance;
            enclosed = t.getNormal(hit).y > 0;
          }
          return false;
        },
      );
    }
    return enclosed;
  };
  return {
    ceiling,
    groundY(p) {
      // Find the supporting surface once when preparing landing sites and seed
      // targets. An authored navigation height is not necessarily the floor.
      ray.origin.set(p[0], p[1] + 0.08, p[2]);
      ray.direction.set(0, -1, 0);
      let height = -Infinity;
      for (const entry of entries) {
        if (entry.solid) continue;
        query(
          entry,
          (bounds) => ray.intersectsBox(bounds),
          (triangle) => {
            if (ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit))
              height = Math.max(height, hit.y);
            return false;
          },
        );
      }
      return Number.isFinite(height) ? height : 0;
    },
    clear(p, radius, height = 1) {
      return !intersects(body(p, radius, height)) && !inside(p);
    },
    segment(a, b, radius, height = 1) {
      // The swept box contains the animal at every point of this straight
      // segment, so a thin fence cannot be skipped between sampled frames.
      body(a, radius, height);
      box.min.min(point([b[0] - radius, b[1] + 0.04, b[2] - radius]));
      box.max.max(point([b[0] + radius, b[1] + height, b[2] + radius]));
      return !intersects(box);
    },
    openSky(p, radius = 0.55) {
      return !intersects(body(p, radius, ceiling + 1));
    },
  };
}

// Keep street-graph routing and authored prop detours. Repair only sections that
// still hit real meshes, on a small cached local grid. No geometry raycasts or
// route searches run in the animation loop.
export function animalNavigation(base = new TownNavigation(), space) {
  const cache = new Map();
  const clear = (p, radius, height) => {
    const key = `${p.join(',')}:${radius}:${height}`;
    if (!cache.has(key)) cache.set(key, base.clear(p, radius) && space.clear(p, radius, height));
    return cache.get(key);
  };
  const safePoint = (p, radius, height = 1, sky = false) => {
    const valid = (q) => clear(q, radius, height) && (!sky || space.openSky(q));
    if (valid(p)) return p.slice();
    for (let step = 1; step <= 8; step++)
      for (let n = 0; n < 16; n++) {
        const angle = (n * Math.PI) / 8;
        const q = [
          p[0] + Math.cos(angle) * step * STEP,
          p[1],
          p[2] + Math.sin(angle) * step * STEP,
        ];
        if (valid(q)) return q;
      }
    return null;
  };
  const detour = (a, b, radius, height) => {
    if (space.segment(a, b, radius, height)) return [a, b];
    const open = [{ p: a, x: 0, z: 0, cost: 0, estimate: Math.hypot(b[0] - a[0], b[2] - a[2]) }];
    const costs = new Map([['0,0', 0]]);
    const bounds = [
      Math.min(a[0], b[0]) - 4,
      Math.max(a[0], b[0]) + 4,
      Math.min(a[2], b[2]) - 4,
      Math.max(a[2], b[2]) + 4,
    ];
    for (let searched = 0; open.length && searched < 2400; searched++) {
      let best = 0;
      for (let n = 1; n < open.length; n++) if (open[n].estimate < open[best].estimate) best = n;
      const current = open.splice(best, 1)[0];
      if (
        Math.hypot(current.p[0] - b[0], current.p[2] - b[2]) <= STEP * 1.5 &&
        space.segment(current.p, b, radius, height)
      ) {
        const path = [b];
        for (let node = current; node; node = node.parent) path.unshift(node.p);
        return path;
      }
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const x = current.x + dx,
          z = current.z + dz,
          key = `${x},${z}`;
        const cost = current.cost + STEP;
        if (cost >= (costs.get(key) ?? Infinity)) continue;
        const p = [a[0] + x * STEP, a[1], a[2] + z * STEP];
        if (p[0] < bounds[0] || p[0] > bounds[1] || p[2] < bounds[2] || p[2] > bounds[3]) continue;
        if (!clear(p, radius, height) || !space.segment(current.p, p, radius, height)) continue;
        costs.set(key, cost);
        open.push({
          p,
          x,
          z,
          cost,
          estimate: cost + Math.hypot(p[0] - b[0], p[2] - b[2]),
          parent: current,
        });
      }
    }
    return null;
  };
  const plan = (points, radius = 0.45, height = 1) => {
    const original = base.plan(points, radius);
    const first = original.points[0] && safePoint(original.points[0], radius, height);
    if (!first) return walkPath([]);
    const route = [first];
    for (const p of original.points.slice(1)) {
      const end = safePoint(p, radius, height);
      const section = end && detour(route.at(-1), end, radius, height);
      if (!section) break;
      route.push(...section.slice(1));
    }
    if (points.length > 1 && point(points[0]).distanceTo(point(points.at(-1))) < 1e-5) {
      const closing = detour(route.at(-1), first, radius, height);
      route.push(...(closing ? closing.slice(1) : route.slice(0, -1).reverse()));
    }
    return walkPath(route);
  };
  return {
    obstacles: base.obstacles,
    safePoint,
    clear: (p, radius, height = 1) => clear(p, radius, height),
    plan,
    route: (points, offset, radius) => plan(base.route(points, offset, radius).points, radius),
  };
}
