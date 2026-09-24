import { NPC_MARGIN } from './TownNavigation';
// Vehicles use the carriageway and walkers use the right-hand sidewalk in each
// direction. At crossings, choose the nearest clear point outside the small
// exclusion circles. Already placed walkers have priority, so queues stay apart.
export const SIDEWALK_OFFSET = 0.9;
export const WALKER_CLEARANCE = 0.55;
function clearPosition(position, obstacles) {
  const clear = (x, z) => obstacles.every((o) => Math.hypot(x - o.x, z - o.z) >= o.radius - 1e-6);
  if (clear(position.x, position.z)) return;
  const candidates = [];
  for (const o of obstacles) {
    const dx = position.x - o.x,
      dz = position.z - o.z,
      length = Math.hypot(dx, dz);
    candidates.push([
      o.x + (length ? dx / length : 1) * o.radius,
      o.z + (length ? dz / length : 0) * o.radius,
    ]);
  }
  // The closest point outside a union is on one circle or an intersection of
  // two boundaries. This avoids iterative pushes oscillating between vehicles.
  for (let i = 0; i < obstacles.length; i++)
    for (let j = 0; j < i; j++) {
      const a = obstacles[i],
        b = obstacles[j],
        dx = b.x - a.x,
        dz = b.z - a.z,
        length = Math.hypot(dx, dz);
      if (!length || length > a.radius + b.radius || length < Math.abs(a.radius - b.radius))
        continue;
      const along = (a.radius * a.radius - b.radius * b.radius + length * length) / (2 * length);
      const height = Math.sqrt(Math.max(0, a.radius * a.radius - along * along));
      for (const side of [-1, 1])
        candidates.push([
          a.x + (dx / length) * along - ((side * dz) / length) * height,
          a.z + (dz / length) * along + ((side * dx) / length) * height,
        ]);
    }
  let best,
    distance = Infinity;
  for (const [x, z] of candidates) {
    const travel = (x - position.x) ** 2 + (z - position.z) ** 2;
    if (travel < distance && clear(x, z)) {
      best = [x, z];
      distance = travel;
    }
  }
  if (best) {
    position.x = best[0];
    position.z = best[1];
  }
}
export function resolveTownTraffic(d) {
  const walkers = [...(d.actors ?? []), ...(d.vipArrivals?.actors ?? [])].filter(
    (a) => !a.work && a.root?.visible && a.root.scale.x > 0.5,
  );
  const obstacles = (d.trafficActors ?? [])
    .filter((root) => root.visible)
    .map((root) => ({
      x: root.position.x,
      z: root.position.z,
      y: root.position.y,
      radius: (root.userData.trafficRadius ?? 0.8) + 0.25,
    }));
  for (const { root } of walkers) {
    clearPosition(root.position, [
      ...obstacles.filter((o) => Math.abs(root.position.y - o.y) < 0.5),
      ...(d.navigation?.near(root.position.x, root.position.z) ?? [])
        .filter((o) => root.position.y >= o.y - 0.5 && root.position.y <= o.y + o.height + 0.1)
        .map((o) => ({ ...o, radius: o.radius + NPC_MARGIN })),
    ]);
    obstacles.push({
      x: root.position.x,
      z: root.position.z,
      y: root.position.y,
      radius: WALKER_CLEARANCE,
    });
  }
}
