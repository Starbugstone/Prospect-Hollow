import { Vector3 } from 'three';
const blockerPosition = new Vector3();
import { sweptClear } from './BuildingFootprints';
import { routeStepPose, routeDistanceAt } from './TownNavigation';

export const LOCOMOTION_STEP = 1 / 60;
const GAP = 0.04;
export const DYNAMIC_AVOIDANCE_ATTEMPTS = 3;

// Yield briefly to other actors, then keep the authored route through a crowd.
// A clear step starts a fresh budget. Static scenery never uses this exception.
function yieldToCrowd(state, blocked) {
  if (!blocked) {
    state.dynamicAttempts = 0;
    state.passingThrough = false;
    return false;
  }
  if ((state.dynamicAttempts ?? 0) < DYNAMIC_AVOIDANCE_ATTEMPTS) {
    state.dynamicAttempts = (state.dynamicAttempts ?? 0) + 1;
    return true;
  }
  state.passingThrough = true;
  return false;
}
export class LocomotionGrid {
  constructor() {
    this.cells = new Map();
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
function vehicleBlocksStep(vehicle, from, to, radius) {
  const c = Math.cos(vehicle.heading),
    s = Math.sin(vehicle.heading);
  const local = (point, x, z) => [
    (point[0] - x) * c - (point[2] - z) * s,
    point[1],
    (point[0] - x) * s + (point[2] - z) * c,
  ];
  const start = local(from, vehicle.previousX ?? vehicle.cx, vehicle.previousZ ?? vehicle.cz);
  const end = local(to, vehicle.cx, vehicle.cz);
  const w = vehicle.halfWidth,
    l = vehicle.halfLength;
  const box = (vehicle.footprint ??= {
    x: 0,
    z: 0,
    polygon: [
      [-w, -l],
      [w, -l],
      [w, l],
      [-w, l],
    ],
  });
  return !sweptClear(box, start, end, radius + GAP);
}

// Validate a prepared route only when its geometry or scenery changes. Routine
// movement samples its edges directly, so it cannot cut corners into buildings.
function preparedRouteClear(a, navigation) {
  const path = a.motion.path,
    margin = a.motion.radius;
  const revision = navigation?.revision ?? navigation?.obstacles;
  const old = a.routeValidation;
  if (
    old?.path === path &&
    old.navigation === navigation &&
    old.revision === revision &&
    old.clearance === a.clearance
  )
    return old.clear;
  const certificate = path.clearance;
  const certified =
    certificate?.navigation === navigation &&
    certificate?.revision === revision &&
    certificate?.margin >= margin;
  const clear = path.points.every(
    (point, i) =>
      !i ||
      ((certified || !navigation || navigation.segment(path.points[i - 1], point, margin)) &&
        (!a.clearance || a.clearance(path.points[i - 1], point, margin))),
  );
  a.routeValidation = {
    path,
    navigation,
    revision,
    clearance: a.clearance,
    clear,
  };
  return clear;
}
function prepareRouteStep(a, navigation, h) {
  const m = a.motion,
    p = a.proposal,
    path = m.path;
  p.routeTravel = 0;
  if (!a.followRoute || a.hold) return false;
  if (!preparedRouteClear(a, navigation)) return true;
  const pose = routeStepPose(path, m.routeDistance, (a.locomotionPose ??= {}));
  // A route replacement or construction exit may leave an actor off its new
  // route. Walk to the nearest edge using the ordinary bounded clearance check.
  if (Math.hypot(pose.x - m.x, pose.z - m.z) > 1e-4) {
    a.targetX = pose.x;
    a.targetZ = pose.z;
    return false;
  }
  p.routeTravel = m.maxSpeed * h;
  if (Number.isFinite(a.routeLimit))
    p.routeTravel = Math.min(p.routeTravel, Math.abs(a.routeLimit - m.routeDistance));
  routeStepPose(path, m.routeDistance + a.routeDirection * p.routeTravel, pose);
  p.dx = pose.x - m.x;
  p.dz = pose.z - m.z;
  p.y = pose.y;
  p.heading = pose.heading + (a.routeDirection < 0 ? Math.PI : 0);
  return true;
}

export function stepLocomotion(agents, statics, vehicles, grid, h = LOCOMOTION_STEP) {
  grid.rebuild(agents);
  // Compute every preferred step from the same snapshot before checking crowds.
  for (const a of grid.agents) {
    const m = a.motion,
      p = (a.proposal ??= { dx: 0, dz: 0 });
    p.dx = p.dz = 0;
    const prepared = prepareRouteStep(a, statics, h);
    if (!prepared) {
      const dx = (a.targetX ?? m.x) - m.x,
        dz = (a.targetZ ?? m.z) - m.z;
      const distance = Math.hypot(dx, dz);
      const scale = distance && !a.hold ? Math.min(m.maxSpeed * h, distance) / distance : 0;
      p.dx = dx * scale;
      p.dz = dz * scale;
    }
    p.blocked = false;
    const from = (a.from ??= []),
      to = (a.to ??= []);
    from[0] = m.sx;
    from[1] = a.y ?? 0.07;
    from[2] = m.sz;
    to[0] = m.sx + p.dx;
    to[1] = from[1];
    to[2] = m.sz + p.dz;
    if (
      !prepared &&
      (p.dx || p.dz) &&
      ((statics && !statics.segment(from, to, m.radius)) ||
        (a.clearance && !a.clearance(from, to, m.radius)))
    ) {
      p.dx = p.dz = 0;
      to[0] = from[0];
      to[2] = from[2];
    }
  }
  for (const a of grid.agents) {
    grid.neighbours(a, (b) => {
      if (a.id >= b.id) return;
      if (closestApproach(a, b) < a.motion.radius + b.motion.radius + GAP) {
        a.proposal.blocked = b.proposal.blocked = true;
      }
    });
    if (
      vehicles.some(
        (v) =>
          Math.abs((v.y ?? a.y) - a.y) < 1 && vehicleBlocksStep(v, a.from, a.to, a.motion.radius),
      )
    )
      a.proposal.blocked = true;
  }
  for (const a of grid.agents) {
    const m = a.motion,
      p = a.proposal;
    if (p.dx || p.dz) {
      if (yieldToCrowd(m, p.blocked)) p.dx = p.dz = 0;
    } else if (!p.blocked) yieldToCrowd(m, false);
    const travel = Math.hypot(p.dx, p.dz);
    const tx = (a.targetX ?? m.x) - m.x,
      tz = (a.targetZ ?? m.z) - m.z;
    const len = Math.hypot(tx, tz) || 1;
    const accepted = travel ? p.routeTravel || travel : 0;
    if (p.routeTravel && travel) {
      m.routeDistance += (a.routeDirection ?? 1) * p.routeTravel;
      a.root.position.y = p.y;
    } else if (!a.followRoute)
      m.routeDistance += (a.routeDirection ?? 1) * Math.max(0, (p.dx * tx + p.dz * tz) / len);
    if (Number.isFinite(m.animationTime)) {
      if (a.routeResting) m.animationTime += h;
      else if (accepted && m.path?.total) m.animationTime += (accepted * a.duration) / m.path.total;
      else if (accepted) m.animationTime += accepted / m.maxSpeed;
    }
    m.x += p.dx;
    m.z += p.dz;
    m.vx = p.dx / h;
    m.vz = p.dz / h;
    m.state = travel > 1e-7 ? 'moving' : a.noPath ? 'no-path' : 'waiting';
    if (travel) m.heading = p.routeTravel ? p.heading : Math.atan2(p.dx, p.dz);
  }
}

function vehiclesOverlap(a, b) {
  // Separating axes for the narrow oriented horse/car boxes.
  const ac = Math.cos(a.heading),
    as = Math.sin(a.heading);
  const bc = Math.cos(b.heading),
    bs = Math.sin(b.heading);
  for (const [x, z] of [
    [ac, -as],
    [as, ac],
    [bc, -bs],
    [bs, bc],
  ]) {
    const extent = (v, c, s) =>
      v.halfWidth * Math.abs(x * c - z * s) + v.halfLength * Math.abs(x * s + z * c);
    if (
      Math.abs((a.cx - b.cx) * x + (a.cz - b.cz) * z) >=
      extent(a, ac, as) + extent(b, bc, bs) + GAP
    )
      return false;
  }
  return true;
}

export function updateTownLocomotion(d, h = LOCOMOTION_STEP) {
  const grid = (d.locomotionGrid ??= new LocomotionGrid()),
    agents = (d.locomotionAgents ??= []);
  agents.length = 0;
  const add = (a) => {
    const root = a.root;
    if (!root || a.species === 'pigeon') return;
    // Indoor/fading visitors still advance their own lifecycle; hiding a mesh
    // must not disconnect its clock from its route.
    if ((!root.visible || root.scale.x < 0.5) && !a.visitor) return;
    if (a.transportVisitor && a.started === undefined) return;
    a.id ??= `${a.species ?? 'person'}:${a.seed ?? root.uuid}:${root.uuid}`;
    const path = a.walkPath ?? a.path;
    const initial = !a.motion;
    const m = (a.motion ??= {
      x: root.position.x,
      z: root.position.z,
      vx: 0,
      vz: 0,
      routeDistance: a.progress ?? 0,
      radius: a.radius ?? 0.29,
      maxSpeed: a.speed ?? a.walkSpeed ?? 0.55,
      animationTime: path?.total && !a.workRoutine ? a.lastPoseTime : undefined,
    });
    if (path && m.path !== path) {
      m.routeDistance =
        initial && Number.isFinite(a.routeProgress)
          ? a.routeProgress * path.total
          : routeDistanceAt(path, m.x, m.z);
      m.path = path;
    }
    a.routeDirection = a.direction ?? 1;
    a.y = root.position.y;
    a.hold =
      (!!a.work && !a.workRoutine) ||
      a.routeResting ||
      (a.species && !['walking', 'fleeing', 'retreating'].includes(a.state));
    a.noPath = !!path && path.points.length < 2;
    a.followRoute = !!path?.total && (!a.manual || a.transportVisitor) && !m.exitTarget;
    a.targetX = root.position.x;
    a.targetZ = root.position.z;
    if (m.exitTarget) {
      a.targetX = m.exitTarget[0];
      a.targetZ = m.exitTarget[2];
      a.hold = false;
      if (Math.hypot(a.targetX - m.x, a.targetZ - m.z) < 0.01) {
        m.exitTarget = null;
        m.path = null;
      }
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
      v.previousX = v.cx ?? root.position.x;
      v.previousY = v.y ?? root.position.y;
      v.previousZ = v.cz ?? root.position.z;
      v.previousHeading = v.heading ?? root.rotation.y;
      v.previousPitch = v.pitch ?? root.rotation.x;
      Object.assign(v, box, {
        root,
        cx: root.position.x,
        cz: root.position.z,
        y: root.position.y,
        heading: root.rotation.y,
        pitch: root.rotation.x,
      });
      vehicles.push(v);
    }
  // Decide from all proposals first, so changing the traffic array order cannot
  // give one horse an unlimited right of way over another.
  for (const v of vehicles) {
    v.blocked =
      agents.some(
        (a) =>
          Math.abs(a.y - v.y) < 1 &&
          vehicleDistance(v, a.motion.x, a.motion.z) < a.motion.radius + GAP,
      ) ||
      vehicles.some(
        (other) => other !== v && Math.abs(other.y - v.y) < 1 && vehiclesOverlap(v, other),
      );
  }
  for (const v of vehicles) {
    const moving = Math.hypot(v.cx - v.previousX, v.cz - v.previousZ) > 1e-7;
    const waiting = moving && yieldToCrowd(v, v.blocked);
    if (!v.blocked) yieldToCrowd(v, false);
    v.root.userData.trafficWaiting = waiting;
    if (waiting) {
      v.cx = v.root.position.x = v.previousX;
      v.y = v.root.position.y = v.previousY;
      v.cz = v.root.position.z = v.previousZ;
      v.heading = v.root.rotation.y = v.previousHeading;
      v.pitch = v.root.rotation.x = v.previousPitch;
      v.root.userData.trafficDelay = (v.root.userData.trafficDelay ?? 0) + h;
    }
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
