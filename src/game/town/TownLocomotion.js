import { Vector3 } from 'three';
const blockerPosition = new Vector3();
import { sweptClear } from './BuildingFootprints';
import { walkPose, routeDistanceAt } from './TownNavigation';

export const LOCOMOTION_STEP = 1 / 60;
export const MAX_SUBSTEPS = 4;
const GAP = 0.04;
const pairKey = (a, b) => (a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);
const hash = (value) => {
  let n = 0;
  for (let i = 0; i < value.length; i++) n = (Math.imul(n, 31) + value.charCodeAt(i)) | 0;
  return n >>> 0;
};
export class LocomotionGrid {
  constructor() {
    this.cells = new Map();
    this.encounters = new Map();
    this.agents = [];
  }
  rebuild(agents) {
    this.agents.length = 0;
    for (const bucket of this.cells.values()) bucket.length = 0;
    for (const a of agents) {
      this.agents.push(a);
      const m = a.motion;
      m.sx = m.x;
      m.sz = m.z;
      const key = `${Math.floor(m.x / 3)},${Math.floor(m.z / 3)}`;
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(a);
    }
    this.agents.sort((a, b) => a.id.localeCompare(b.id));
  }
  neighbours(a, visit) {
    const x = Math.floor(a.motion.sx / 3),
      z = Math.floor(a.motion.sz / 3);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = this.cells.get(`${x + dx},${z + dz}`);
        if (bucket)
          for (const b of bucket) if (a !== b && Math.abs((a.y ?? 0) - (b.y ?? 0)) < 1) visit(b);
      }
  }
}
export function vehicleDistance(vehicle, x, z) {
  const c = Math.cos(vehicle.heading),
    s = Math.sin(vehicle.heading),
    dx = x - vehicle.cx,
    dz = z - vehicle.cz;
  const localX = dx * c - dz * s,
    localZ = dx * s + dz * c;
  return Math.hypot(
    Math.max(0, Math.abs(localX) - vehicle.halfWidth),
    Math.max(0, Math.abs(localZ) - vehicle.halfLength),
  );
}
function closestApproach(a, b) {
  const x = a.motion.sx - b.motion.sx,
    z = a.motion.sz - b.motion.sz;
  const dx = a.proposal.dx - b.proposal.dx,
    dz = a.proposal.dz - b.proposal.dz;
  const t = Math.max(0, Math.min(1, -(x * dx + z * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x + dx * t, z + dz * t);
}
export function stepLocomotion(agents, statics, vehicles, grid, h = LOCOMOTION_STEP) {
  grid.rebuild(agents);
  for (const a of grid.agents) {
    const m = a.motion,
      p = (a.proposal ??= { dx: 0, dz: 0 });
    let dx = (a.targetX ?? m.x) - m.x,
      dz = (a.targetZ ?? m.z) - m.z;
    const distance = Math.hypot(dx, dz),
      speed = a.hold ? 0 : m.maxSpeed;
    if (distance) {
      dx /= distance;
      dz /= distance;
    }
    let encounter = null;
    grid.neighbours(a, (b) => {
      const other = b.motion,
        rx = other.sx - m.sx,
        rz = other.sz - m.sz,
        separation = Math.hypot(rx, rz);
      if (separation > m.radius + other.radius + 0.65 || rx * dx + rz * dz < 0) return;
      if (encounter && separation >= encounter.distance) return;
      encounter = a.nearestEncounter ??= {};
      encounter.agent = b;
      encounter.distance = separation;
    });
    if (encounter) {
      const key = pairKey(a, encounter.agent);
      let pair = grid.encounters.get(key);
      if (!pair) {
        pair = { turn: hash(key) & 1, active: false };
        grid.encounters.set(key, pair);
      }
      if (!pair.active) {
        pair.turn ^= 1;
        pair.active = true;
      }
      pair.touched = true;
      if (m.encounter !== key) {
        m.encounter = key;
        m.passingSide = pair.turn ? 1 : -1;
      }
      const forward = Math.max(
        0,
        (encounter.distance - m.radius - encounter.agent.motion.radius - GAP) / 0.6,
      );
      // Same route-relative side sends head-on walkers to opposite world sides.
      const side = m.passingSide * 0.85,
        nx = dx * forward + dz * side,
        nz = dz * forward - dx * side,
        norm = Math.hypot(nx, nz) || 1;
      dx = nx / norm;
      dz = nz / norm;
    } else {
      m.encounter = null;
      m.passingSide = 0;
    }
    const travel = Math.min(speed * h, distance);
    p.dx = dx * travel;
    p.dz = dz * travel;
    const from = (a.from ??= []);
    from[0] = m.sx;
    from[1] = a.y ?? 0.07;
    from[2] = m.sz;
    const to = (a.to ??= []);
    to[0] = m.sx + p.dx;
    to[1] = from[1];
    to[2] = m.sz + p.dz;
    if (
      (statics && !statics.segment(from, to, m.radius)) ||
      (a.clearance && !a.clearance(from, to, m.radius))
    )
      p.dx = p.dz = 0;
    for (const vehicle of vehicles) {
      const c = Math.cos(vehicle.heading),
        s = Math.sin(vehicle.heading);
      const local = (x, z, cx, cz) => [
        (x - cx) * c - (z - cz) * s,
        from[1],
        (x - cx) * s + (z - cz) * c,
      ];
      const start = local(
        from[0],
        from[2],
        vehicle.previousX ?? vehicle.cx,
        vehicle.previousZ ?? vehicle.cz,
      );
      const end = local(to[0], to[2], vehicle.cx, vehicle.cz);
      const box = (vehicle.footprint ??= { x: 0, z: 0, polygon: [] });
      const w = vehicle.halfWidth,
        l = vehicle.halfLength;
      box.polygon = [
        [-w, -l],
        [w, -l],
        [w, l],
        [-w, l],
      ];
      const future = local(
        to[0],
        to[2],
        vehicle.cx + (vehicle.cx - (vehicle.previousX ?? vehicle.cx)) * 60,
        vehicle.cz + (vehicle.cz - (vehicle.previousZ ?? vehicle.cz)) * 60,
      );
      // Reserve an approaching crossing before entering its swept lane.
      const currentClear = sweptClear(box, start, end, m.radius + GAP),
        crossing = sweptClear(box, end, future, m.radius + GAP);
      if (!currentClear || !crossing) {
        // Someone already crossing must finish stepping out of the swept lane;
        // freezing inside an approaching vehicle's envelope would create contact.
        const current = local(from[0], from[2], vehicle.cx, vehicle.cz);
        const side = current[0] < 0 ? -1 : 1,
          shift = side * (w + m.radius + GAP + 0.04) - current[0];
        const amount = Math.max(-travel, Math.min(travel, shift));
        const escape = [from[0] + amount * c, from[1], from[2] - amount * s];
        const escaping =
          Math.abs(shift) > 1e-5 &&
          Math.abs(shift) < 1.5 &&
          (!statics || statics.segment(from, escape, m.radius)) &&
          (!a.clearance || a.clearance(from, escape, m.radius));
        if (escaping) {
          p.dx = escape[0] - from[0];
          p.dz = escape[2] - from[2];
        } else p.dx = p.dz = 0;
      }
    }
  }
  // Symmetric swept pair checks; stable ID ordering and common snapshots make
  // outcomes independent of caller array order. Recheck after every contraction.
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const a of grid.agents)
      grid.neighbours(a, (b) => {
        if (a.id >= b.id) return;
        const min = a.motion.radius + b.motion.radius + GAP;
        const initial = Math.hypot(a.motion.sx - b.motion.sx, a.motion.sz - b.motion.sz);
        if (closestApproach(a, b) >= Math.min(min, initial) - 1e-7) return;
        if (a.proposal.dx || a.proposal.dz || b.proposal.dx || b.proposal.dz) changed = true;
        const pair = grid.encounters.get(pairKey(a, b)),
          first = pair?.turn ? a : b,
          second = first === a ? b : a;
        const dx = second.proposal.dx,
          dz = second.proposal.dz;
        second.proposal.dx = second.proposal.dz = 0;
        if (closestApproach(a, b) >= Math.min(min, initial) - 1e-7) return;
        second.proposal.dx = dx;
        second.proposal.dz = dz;
        first.proposal.dx = first.proposal.dz = 0;
        if (closestApproach(a, b) >= Math.min(min, initial) - 1e-7) return;
        second.proposal.dx = second.proposal.dz = 0;
      });
    if (!changed) break;
  }
  for (const a of grid.agents) {
    const m = a.motion,
      p = a.proposal,
      travel = Math.hypot(p.dx, p.dz);
    const tx = (a.targetX ?? m.x) - m.x,
      tz = (a.targetZ ?? m.z) - m.z,
      len = Math.hypot(tx, tz) || 1;
    m.routeDistance += (a.routeDirection ?? 1) * Math.max(0, (p.dx * tx + p.dz * tz) / len);
    m.x += p.dx;
    m.z += p.dz;
    m.vx = p.dx / h;
    m.vz = p.dz / h;
    m.state = travel > 1e-7 ? 'moving' : a.noPath ? 'no-path' : 'waiting';
    if (travel) m.heading = Math.atan2(p.dx, p.dz);
  }
  for (const pair of grid.encounters.values()) {
    if (!pair.touched) pair.active = false;
    pair.touched = false;
  }
}

const aVehicle = (root, box) => ({
  ...box,
  cx: root.position.x,
  cz: root.position.z,
  heading: root.rotation.y,
});
export function updateTownLocomotion(d, h = LOCOMOTION_STEP) {
  const grid = (d.locomotionGrid ??= new LocomotionGrid()),
    agents = (d.locomotionAgents ??= []);
  agents.length = 0;
  const add = (a) => {
    const root = a.root;
    if (!root?.visible || root.scale.x < 0.5 || a.species === 'pigeon') return;
    a.id ??= `${a.species ?? 'person'}:${a.seed ?? root.uuid}:${root.uuid}`;
    const path = a.walkPath ?? a.path;
    const m = (a.motion ??= {
      x: root.position.x,
      z: root.position.z,
      vx: 0,
      vz: 0,
      routeDistance: a.progress ?? 0,
      radius: a.radius ?? 0.29,
      maxSpeed: a.speed ?? a.walkSpeed ?? 0.55,
    });
    if (path && m.path !== path) {
      m.routeDistance = routeDistanceAt(path, m.x, m.z);
      m.path = path;
    }
    a.routeDirection = a.direction ?? 1;
    a.y = root.position.y;
    a.hold = !!a.work || (a.species && !['walking', 'fleeing', 'retreating'].includes(a.state));
    a.noPath = !!path && path.points.length < 2;
    if (m.exitTarget) {
      a.targetX = m.exitTarget[0];
      a.targetZ = m.exitTarget[2];
      a.hold = false;
      if (Math.hypot(a.targetX - m.x, a.targetZ - m.z) < 0.06) m.exitTarget = null;
    } else if (path?.total && (!a.manual || a.transportVisitor)) {
      const pose = walkPose(
        path,
        ((((m.routeDistance + a.routeDirection * Math.max(0.08, m.maxSpeed * h)) % path.total) +
          path.total) %
          path.total) /
          path.total,
        (a.locomotionPose ??= {}),
      );
      a.targetX = pose.x;
      a.targetZ = pose.z;
    } else {
      a.targetX = root.position.x;
      a.targetZ = root.position.z;
    }
    if (d.reducedMotion && !m.exitTarget) a.hold = true;
    if (a.noPath && !m.exitTarget) {
      a.targetX = m.x;
      a.targetZ = m.z;
      a.hold = true;
    }
    agents.push(a);
  };
  for (const a of d.actors ?? []) add(a);
  for (const a of d.vipArrivals?.actors ?? []) add(a);
  for (const a of d.animals ?? []) add(a);
  for (const actor of d.manualBlockers ?? []) {
    let visible = true;
    for (let node = actor.root; node; node = node.parent) if (!node.visible) visible = false;
    if (!visible) continue;
    actor.root.getWorldPosition(blockerPosition);
    const proxy = (actor.collisionProxy ??= {
      id: `worker:${actor.root.uuid}`,
      hold: true,
      staticProxy: true,
      motion: { routeDistance: 0, radius: 0.29, maxSpeed: 0 },
    });
    proxy.motion.x = blockerPosition.x;
    proxy.motion.z = blockerPosition.z;
    proxy.y = blockerPosition.y;
    agents.push(proxy);
  }
  const vehicles = (d.locomotionVehicles ??= []);
  vehicles.length = 0;
  for (const root of d.trafficActors ?? [])
    if (root.visible) {
      const box = root.userData.vehicleBox ?? {
        halfWidth: 0.4,
        halfLength: root.userData.trafficRadius ?? 0.8,
      };
      const v = (root.userData.locomotionBox ??= {});
      if (v.cx !== undefined) {
        const candidate = aVehicle(root, box);
        if (
          agents.some(
            (agent) =>
              Math.abs(agent.y - root.position.y) < 1 &&
              vehicleDistance(candidate, agent.motion.x, agent.motion.z) <
                agent.motion.radius + GAP,
          )
        ) {
          root.position.x = v.cx;
          root.position.z = v.cz;
          root.rotation.y = v.heading;
          root.userData.trafficDelay = (root.userData.trafficDelay ?? 0) + h;
        }
      }
      v.previousX = v.cx ?? root.position.x;
      v.previousZ = v.cz ?? root.position.z;
      Object.assign(v, box, { cx: root.position.x, cz: root.position.z, heading: root.rotation.y });
      vehicles.push(v);
    }
  stepLocomotion(agents, d.navigation, vehicles, grid, h);
  for (const a of agents) {
    if (a.staticProxy) continue;
    const m = a.motion;
    a.root.position.x = m.x;
    a.root.position.z = m.z;
    if (m.state === 'moving') a.root.rotation.y = m.heading;
    if (a.species && !a.flight) {
      a.progress = m.routeDistance;
      a.acceptedWalking = m.state === 'moving';
    }
    a.distance = (a.acceptedDistance ?? 0) + Math.hypot(m.vx, m.vz) * h;
    a.acceptedDistance = a.distance;
  }
}
