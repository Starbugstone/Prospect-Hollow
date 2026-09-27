import { Box3, Matrix4, Vector3 } from 'three';
import { FOOTPRINT_ANCHORS } from '../../data/footprintOverrides';
import { BUILDING_BY_ID } from '../../data/town';
const componentCache = new WeakMap();
function hull(points) {
  const sorted = [...new Map(points.map((p) => [p.join(','), p])).values()].sort(
    (a, b) => a[0] - b[0] || a[1] - b[1],
  );
  if (sorted.length < 3) return sorted;
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (items) => {
    const result = [];
    for (const p of items) {
      while (result.length > 1 && cross(result.at(-2), result.at(-1), p) <= 1e-8) result.pop();
      result.push(p);
    }
    result.pop();
    return result;
  };
  return [...half(sorted), ...half(sorted.slice().reverse())];
}
const corners = (s) =>
  s.points ?? [
    [s.cx - s.halfW, s.cz - s.halfD],
    [s.cx + s.halfW, s.cz - s.halfD],
    [s.cx + s.halfW, s.cz + s.halfD],
    [s.cx - s.halfW, s.cz + s.halfD],
  ];

export const footprintKey = ({ id, kind, era, serviceLevel, eraLevel, path, construction }) =>
  [id, kind, era, serviceLevel, eraLevel, path, construction ?? 'none'].join('|');

// Per-component bounds preserve gaps in merged Blender meshes. Coordinates are
// plot-local; registering applies the world matrix exactly once.
export function geometryFootprints(root) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(),
    point = new Vector3();
  const solids = [];
  root.traverse((mesh) => {
    if (mesh !== root && root.userData.exportFootprints) return;
    if (
      (!mesh.isMesh && !mesh.userData.exportFootprints) ||
      mesh.userData.animated ||
      mesh.material?.transparent ||
      mesh.material?.map
    )
      return;
    if (mesh.userData.navigationExclude || mesh.isInstancedMesh) return;
    for (let node = mesh.parent; node && node !== root; node = node.parent)
      if (
        node.userData.animated ||
        node.userData.exportFootprints ||
        node.userData.activation === 'removed'
      )
        return;
    const geometry = mesh.geometry,
      position = geometry?.attributes.position,
      index = geometry?.index;
    let boxes =
      mesh.userData.exportFootprints?.map(({ min, max }) => ({
        bounds: new Box3(new Vector3(...min), new Vector3(...max)),
        points: [
          [min[0], min[2]],
          [max[0], min[2]],
          [max[0], max[2]],
          [min[0], max[2]],
        ],
      })) ?? componentCache.get(geometry);
    if (!boxes) {
      const parent = new Uint32Array(position.count),
        first = new Map();
      for (let i = 0; i < position.count; i++) {
        const key = `${position.getX(i).toFixed(5)},${position.getY(i).toFixed(5)},${position.getZ(i).toFixed(5)}`;
        parent[i] = first.get(key) ?? i;
        first.set(key, parent[i]);
      }
      const find = (i) => {
        while (parent[i] !== i) {
          parent[i] = parent[parent[i]];
          i = parent[i];
        }
        return i;
      };
      const at = (i) => (index ? index.getX(i) : i);
      for (let i = 0; i < (index?.count ?? position.count); i += 3) {
        const a = find(at(i));
        parent[find(at(i + 1))] = a;
        parent[find(at(i + 2))] = a;
      }
      const components = new Map();
      for (let i = 0; i < position.count; i++) {
        const key = find(i);
        if (!components.has(key)) components.set(key, { bounds: new Box3(), points: [] });
        const component = components.get(key);
        point.fromBufferAttribute(position, i);
        component.bounds.expandByPoint(point);
        component.points.push([point.x, point.z]);
      }
      for (const component of components.values()) component.points = hull(component.points);
      boxes = components;
      componentCache.set(geometry, boxes);
    }
    const transform = new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    for (const component of boxes.values()) {
      const box = component.bounds.clone().applyMatrix4(transform);
      if (box.isEmpty()) continue;
      const points = hull(
        component.points.flatMap(([x, z]) =>
          [component.bounds.min.y, component.bounds.max.y].map((y) => {
            point.set(x, y, z).applyMatrix4(transform);
            return [point.x, point.z];
          }),
        ),
      );
      const axisAligned =
        points.length === 4 &&
        points.every(
          ([x, z]) =>
            (Math.abs(x - box.min.x) < 1e-6 || Math.abs(x - box.max.x) < 1e-6) &&
            (Math.abs(z - box.min.z) < 1e-6 || Math.abs(z - box.max.z) < 1e-6),
        );
      solids.push({
        ...(axisAligned || points.length < 3 ? {} : { points }),
        shape: 'rect',
        cx: (box.min.x + box.max.x) / 2,
        cz: (box.min.z + box.max.z) / 2,
        halfW: (box.max.x - box.min.x) / 2,
        halfD: (box.max.z - box.min.z) / 2,
        rotation: 0,
        yMin: box.min.y,
        yMax: box.max.y,
      });
    }
  });
  // Discard contained detail only when its complete vertical interval is covered.
  return solids.filter(
    (s, i) =>
      !solids.some(
        (o, j) =>
          j !== i &&
          o.halfW >= s.halfW &&
          o.halfD >= s.halfD &&
          o.yMin <= s.yMin &&
          o.yMax >= s.yMax &&
          Math.abs(s.cx - o.cx) + s.halfW <= o.halfW + 1e-5 &&
          Math.abs(s.cz - o.cz) + s.halfD <= o.halfD + 1e-5 &&
          (!o.points ||
            corners(s).every(([x, z]) => footprintDistance({ polygon: o.points }, x, z) <= 1e-5)) &&
          (o.halfW > s.halfW || o.halfD > s.halfD || j < i),
      ),
  );
}
export function registerFootprints(
  root,
  solids,
  {
    owner = `plot:${root.userData.plot}`,
    activation = 'completed',
    version = 0,
    provisional = false,
  } = {},
) {
  root.updateWorldMatrix(true, false);
  const scale = root.getWorldScale(new Vector3()),
    origin = root.getWorldPosition(new Vector3());
  const entries = solids.map((solid) => {
    const points =
      solid.points ??
      [
        [-solid.halfW, -solid.halfD],
        [solid.halfW, -solid.halfD],
        [solid.halfW, solid.halfD],
        [-solid.halfW, solid.halfD],
      ].map(([x, z]) => {
        const c = Math.cos(solid.rotation),
          s = Math.sin(solid.rotation);
        return [solid.cx + x * c - z * s, solid.cz + x * s + z * c];
      });
    const polygon = points.map(([x, z]) => {
      const p = root.localToWorld(new Vector3(x, 0, z));
      return [p.x, p.z];
    });
    const xs = polygon.map((p) => p[0]),
      zs = polygon.map((p) => p[1]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2,
      z = (Math.min(...zs) + Math.max(...zs)) / 2;
    return {
      polygon,
      x,
      z,
      radius: Math.max(...polygon.map(([px, pz]) => Math.hypot(px - x, pz - z))),
      y: origin.y + solid.yMin * scale.y,
      height: (solid.yMax - solid.yMin) * scale.y,
      owner,
      activation,
      version,
      provisional,
    };
  });
  const id = root.userData.plot,
    anchors = FOOTPRINT_ANCHORS[id] ?? FOOTPRINT_ANCHORS[BUILDING_BY_ID[id]?.kind];
  if (anchors)
    root.userData.navigationAnchors = Object.fromEntries(
      Object.entries(anchors).map(([kind, points]) => [
        kind,
        points.map(([x, z]) => root.localToWorld(new Vector3(x, 0.07, z)).toArray()),
      ]),
    );
  root.userData.footprints = entries;
  root.userData.activation = activation;
  return entries;
}
export function footprintDistance(o, x, z) {
  if (!o.polygon) return Math.hypot(x - o.x, z - o.z) - o.radius;
  let inside = false,
    distance = Infinity;
  for (let i = 0, j = o.polygon.length - 1; i < o.polygon.length; j = i++) {
    const [ax, az] = o.polygon[j],
      [bx, bz] = o.polygon[i];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax,
      dz = bz - az,
      t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    distance = Math.min(distance, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return inside ? -distance : distance;
}
export function sweptClear(o, a, b, margin) {
  if (
    footprintDistance(o, a[0], a[2]) < margin - 1e-6 ||
    footprintDistance(o, b[0], b[2]) < margin - 1e-6
  )
    return false;
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    len = dx * dx + dz * dz;
  if (!o.polygon) {
    const t = Math.max(0, Math.min(1, ((o.x - a[0]) * dx + (o.z - a[2]) * dz) / (len || 1)));
    return Math.hypot(o.x - a[0] - t * dx, o.z - a[2] - t * dz) >= o.radius + margin - 1e-6;
  }
  for (let i = 0; i < o.polygon.length; i++) {
    const [x, z] = o.polygon[i],
      [nx, nz] = o.polygon[(i + 1) % o.polygon.length];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (len || 1)));
    if (Math.hypot(x - a[0] - t * dx, z - a[2] - t * dz) < margin - 1e-6) return false;
    const ex = nx - x,
      ez = nz - z,
      cross = dx * ez - dz * ex;
    if (Math.abs(cross) > 1e-9) {
      const u = ((x - a[0]) * ez - (z - a[2]) * ex) / cross,
        v = ((x - a[0]) * dz - (z - a[2]) * dx) / cross;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) return false;
    }
  }
  return true;
}
