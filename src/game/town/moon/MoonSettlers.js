import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { MOON_RING_ROAD, moonApproaches } from '../../../data/moonSettlement';
import { swingLimbs } from '../TownGait';
import { hash01 as hash } from '../TownMath';
import { walkPath, walkPose } from '../TownNavigation';

// New Hollow's settlers: suited figures who leave one building's hatch, walk its
// public path to the ring road, cross to another building and step inside. Each
// settler's day is a fixed loop of trips, so every pose is a pure function of time.
// They share the valley villagers' skeleton, walk cycle and path sampling.
const TAU = Math.PI * 2;
export const MOON_WALK_SPEED = 1.1;
// Seconds a settler takes to pass through a hatch, shrinking in or growing out.
export const MOON_DOOR_TIME = 0.7;
// A long low-gravity stride: the valley's walk cycle at the valley's cadence.
const STRIDE = 1.2;
// Each footfall lifts the suit off the regolith.
const HOP = 0.12;
// Walkers keep to their own side of the ring road.
const LANE = 0.35;
const RING_STEP = 0.12;
const PAD_TOP = 0.27,
  ROAD = 0.04;
// The saucer pad is an open landing apron, not a building to step into.
const OPEN_PADS = new Set(['saucerPad']);
const HOMES = ['settlerDomes', 'craterHomesteads'];

const heightOn = (route, x, z) => {
  const radius = Math.hypot(x - route.pose.x, z - route.pose.z);
  const t = Math.max(
    0,
    Math.min(1, (radius - route.rampStart) / (route.rampEnd - route.rampStart)),
  );
  return PAD_TOP * (1 - t) + ROAD * t;
};
const approachPoints = (route) => route.points.map(([x, z]) => [x, heightOn(route, x, z), z]);
/** A lot's hatch, on its pad: where walkers step in and out. */
export const moonHatch = (route) => approachPoints(route)[0];

// Ring points from one angle to another the short way round, or a full lap when
// both ends meet (a settler with a single building to visit takes a stroll).
function ringArc(from, to) {
  let delta = to - from;
  delta = ((((delta + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  if (Math.abs(delta) < 1e-3) delta = TAU;
  // Keep right: travelling anticlockwise (seen from above) keeps to the inner lane.
  const radius = MOON_RING_ROAD + (delta > 0 ? -LANE : LANE);
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / RING_STEP));
  return Array.from({ length: steps + 1 }, (_, n) => {
    const a = from + (delta * n) / steps;
    return [Math.cos(a) * radius, ROAD, Math.sin(a) * radius];
  });
}

/** The walk from one building's hatch to another's, along their paths and the ring. */
export function moonSettlerRoute(from, to) {
  const out = approachPoints(from),
    back = approachPoints(to).reverse();
  const start = out.at(-1),
    end = back[0];
  const points = [
    ...out,
    ...ringArc(Math.atan2(start[2], start[0]), Math.atan2(end[2], end[0])),
    ...back,
  ];
  const path = walkPath(points);
  return { from: from.id, to: to.id, points, path, length: path.total };
}

// Built lots a settler can enter, homes first.
export function moonSettlerBuildings(levels) {
  // moonApproaches(null) lists every lot, built or not: no levels means none built.
  return moonApproaches(levels ?? {})
    .filter(({ id }) => !OPEN_PADS.has(id))
    .sort((a, b) => HOMES.includes(b.id) - HOMES.includes(a.id));
}

/**
 * One settler's looping day: home → visit → home, three times, resting indoors
 * between walks. Without any building to enter, the settler circles the ring.
 */
export function moonSettlerPlan(levels, n) {
  const buildings = moonSettlerBuildings(levels);
  if (!buildings.length)
    return {
      ring: true,
      phase: hash(n + 70) * TAU,
      speed: 0.06 + hash(n) * 0.04,
      dir: n % 2 ? 1 : -1,
    };
  const homes = buildings.filter(({ id }) => HOMES.includes(id));
  const home = (homes.length ? homes : buildings)[n % (homes.length || buildings.length)];
  const others = buildings.filter((route) => route !== home);
  const segments = [];
  let time = 0;
  const walk = (from, to) => {
    const route = moonSettlerRoute(from, to);
    const duration = route.length / MOON_WALK_SPEED;
    segments.push({ route, start: time, duration });
    time += duration;
  };
  const rest = (building, duration) => {
    segments.push({ inside: building.id, start: time, duration });
    time += duration;
  };
  for (let trip = 0; trip < 3; trip++) {
    const visit = others.length
      ? others[Math.floor(hash(n * 13 + trip * 7 + 1) * others.length)]
      : home;
    walk(home, visit);
    rest(visit, 3 + hash(n * 5 + trip) * 6);
    walk(visit, home);
    rest(home, 5 + hash(n * 3 + trip + 40) * 8);
  }
  return { segments, duration: time, offset: hash(n + 70) * time, home: home.id };
}

/** Where a settler is at `time`: position, heading, door scale and hop distance. */
export function moonSettlerPose(plan, time, out = {}) {
  if (plan.ring) {
    const a = plan.phase + plan.dir * time * plan.speed;
    const radius = MOON_RING_ROAD + (plan.dir > 0 ? -LANE : LANE);
    out.x = Math.cos(a) * radius;
    out.y = ROAD;
    out.z = Math.sin(a) * radius;
    out.heading = -a - (plan.dir > 0 ? 0 : Math.PI);
    out.visible = true;
    out.scale = 1;
    out.distance = time * plan.speed * radius;
    out.inside = null;
    return out;
  }
  const local = (((time + plan.offset) % plan.duration) + plan.duration) % plan.duration;
  let segment = plan.segments[0];
  for (const candidate of plan.segments) {
    if (candidate.start > local) break;
    segment = candidate;
  }
  const elapsed = local - segment.start;
  if (segment.inside) {
    out.visible = false;
    out.inside = segment.inside;
    out.scale = 0;
    return out;
  }
  const { path, length } = segment.route;
  const distance = Math.min(length, elapsed * MOON_WALK_SPEED);
  // The valley's path sampling, with its eased turns at corners.
  walkPose(path, distance / length, out);
  out.scale = Math.max(
    0,
    Math.min(1, elapsed / MOON_DOOR_TIME, (segment.duration - elapsed) / MOON_DOOR_TIME),
  );
  out.visible = out.scale > 0;
  out.distance = distance;
  out.inside = null;
  return out;
}

/**
 * A suited figure on the valley villager's skeleton (body at hip height, `{ upper,
 * lower }` arms and legs), so the shared walk cycle and the unveiling crowd drive it.
 * One builder serves the settlers and the monument unveiling's visitors.
 */
export function moonSuitFigure(d, { parent, suit = p.shell, pack = p.roof }) {
  const root = d.group(parent);
  root.name = 'New Hollow settler';
  const body = d.group(root, 0, 0.54, 0);
  const torso = d.group(body, 0, 0.1, 0);
  d.box(torso, 0.36, 0.5, 0.24, 0, 0.13, 0, suit, true);
  d.box(torso, 0.26, 0.32, 0.12, 0, 0.18, -0.17, pack);
  const head = d.group(torso, 0, 0.58, 0);
  d.ball(head, 0, 0, 0, 0.2, p.shell);
  d.box(head, 0.22, 0.1, 0.06, 0, 0.01, 0.17, p.light);
  const arms = [-1, 1].map((side) => {
    const upper = d.group(torso, side * 0.22, 0.32, 0);
    d.box(upper, 0.1, 0.22, 0.11, 0, -0.1, 0, suit);
    const lower = d.group(upper, 0, -0.22, 0);
    d.box(lower, 0.1, 0.22, 0.1, 0, -0.11, 0, p.deep);
    return { upper, lower };
  });
  const legs = [-1, 1].map((side) => {
    const upper = d.group(body, side * 0.085, -0.065, 0);
    d.box(upper, 0.12, 0.22, 0.13, 0, -0.11, 0, suit);
    const lower = d.group(upper, 0, -0.22, 0);
    d.box(lower, 0.12, 0.26, 0.17, 0, -0.14, 0.02, p.deep);
    return { upper, lower };
  });
  return { root, body, torso, head, arms, legs };
}

/** The valley's walk cycle on a suited figure `distance` along its walk, with a hop at
 * each footfall. Settlers and the Moon's VIP visitors share it. */
export function strideMoonFigure({ body, arms, legs }, distance, walking = true) {
  const step = (distance / STRIDE) * TAU;
  body.position.y = 0.54 + (walking ? Math.abs(Math.sin(step)) * HOP : 0);
  swingLimbs(arms, legs, step, walking);
}

const pose = {};
/** Place and animate one settler: the valley's walk cycle with a hop at each footfall. */
export function animateMoonSettler(settler, time) {
  moonSettlerPose(settler.plan, time, pose);
  const { root } = settler;
  root.visible = pose.visible;
  if (!pose.visible) return pose;
  root.position.set(pose.x, pose.y, pose.z);
  root.rotation.y = pose.heading;
  root.scale.setScalar(pose.scale);
  strideMoonFigure(settler, pose.distance);
  return pose;
}
