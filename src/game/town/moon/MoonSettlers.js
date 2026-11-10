import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import {
  MOON_RING_ROAD,
  MOON_ROADS,
  MOON_ROAD_LIFT,
  moonApproachHeight,
  moonApproaches,
} from '../../../data/moonSettlement';
import { swingLimbs } from '../TownGait';
import { animalModel, animateAnimal } from '../TownAnimalModels';
import { addCarriedItem, holdCarried, routineDay, routinePose } from '../TownCommissionUse';
import { hash01 as hash } from '../TownMath';
import { walkPath } from '../TownNavigation';
import { WANDERERS } from '../TownWanderers';

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
// The saucer pad is an open landing apron, not a building to step into.
const OPEN_PADS = new Set(['saucerPad']);
const HOMES = ['settlerDomes', 'craterHomesteads'];

// Walkers tread the paths' own surface, from the pad's top down to the road.
const approachPoints = (route) =>
  route.points.map(([x, z]) => [x, moonApproachHeight(route, x, z), z]);
/** A lot's hatch, on its pad: where walkers step in and out. */
export const moonHatch = (route) => approachPoints(route)[0];

// The signed turn from one angle to another, the short way round.
const turn = (from, to) => ((((to - from + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

// Ring points from one angle to another the short way round. When both ends meet, a full
// lap (a settler with a single building to visit takes a stroll), or with `lap` off, just
// the one point.
function ringArc(from, to, ring = MOON_RING_ROAD, { lap = true } = {}) {
  let delta = turn(from, to);
  if (Math.abs(delta) < 1e-3) delta = lap ? TAU : 0;
  // Keep right: travelling anticlockwise (seen from above) keeps to the inner lane.
  const radius = ring + (delta > 0 ? -LANE : LANE);
  const steps = delta ? Math.max(1, Math.ceil(Math.abs(delta) / RING_STEP)) : 0;
  return Array.from({ length: steps + 1 }, (_, n) => {
    // A path that ends exactly on a spoke has no arc to walk: it is the one point.
    const a = steps ? from + (delta * n) / steps : from;
    return [Math.cos(a) * radius, MOON_ROAD_LIFT, Math.sin(a) * radius];
  });
}

/**
 * The walk along the roads between two paths' ends, each on its ring. On one ring it is the
 * arc between them; between rings it follows the arc to the spoke that makes the walk
 * shortest, the spoke itself, then the arc on the other ring.
 */
export function moonRoadWalk(
  from,
  to,
  fromRing = MOON_RING_ROAD,
  toRing = MOON_RING_ROAD,
  roads = MOON_ROADS,
) {
  const a = Math.atan2(from[1], from[0]),
    b = Math.atan2(to[1], to[0]);
  if (fromRing === toRing) return ringArc(a, b, fromRing);
  const [inner, outer] = fromRing < toRing ? [fromRing, toRing] : [toRing, fromRing];
  // Spokes join neighbouring rings; a longer climb takes them one ring at a time.
  const rings = roads.rings.filter((ring) => ring >= inner && ring <= outer);
  const climbing = fromRing < toRing ? rings : [...rings].reverse();
  const spokes = roads.spokes.length ? roads.spokes : [a];
  const points = [];
  let angle = a;
  climbing.forEach((ring, n) => {
    const next = climbing[n + 1];
    if (next === undefined) {
      points.push(...ringArc(angle, b, ring, { lap: false }));
      return;
    }
    // The spoke nearest the way still to go: its arc here plus the arc from it on the
    // next ring toward the destination.
    const spoke = spokes.reduce((best, s) =>
      Math.abs(turn(angle, s)) * ring + Math.abs(turn(s, b)) * next <
      Math.abs(turn(angle, best)) * ring + Math.abs(turn(best, b)) * next
        ? s
        : best,
    );
    points.push(...ringArc(angle, spoke, ring, { lap: false }));
    angle = spoke;
  });
  return points;
}

/** The walk from one building's hatch to another's, along their paths and the roads. */
export function moonSettlerRoute(from, to) {
  const out = approachPoints(from),
    back = approachPoints(to).reverse();
  const start = out.at(-1),
    end = back[0];
  const points = [
    ...out,
    ...moonRoadWalk(
      [start[0], start[2]],
      [end[0], end[2]],
      from.ring ?? MOON_RING_ROAD,
      to.ring ?? MOON_RING_ROAD,
    ),
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

// The commission a resident heads for on this trip, or none: the first `visits` trips of
// their day go there, so what the player chose decides who comes and how often.
const venueForTrip = (venues, kind, trip) =>
  venues.find(({ visits }) => trip < (visits[kind] ?? 0)) ?? null;

/**
 * One settler's looping day: home → visit → home, three times, resting indoors
 * between walks. Without any building to enter, the settler circles the ring.
 */
export function moonSettlerPlan(levels, n, homeId = null, venues = [], kind = 'settler') {
  const buildings = moonSettlerBuildings(levels);
  if (!buildings.length)
    return {
      ring: true,
      phase: hash(n + 70) * TAU,
      speed: 0.06 + hash(n) * 0.04,
      dir: n % 2 ? 1 : -1,
    };
  const homes = buildings.filter(({ id }) => HOMES.includes(id));
  const home =
    buildings.find(({ id }) => id === homeId) ??
    (homes.length ? homes : buildings)[n % (homes.length || buildings.length)];
  const others = buildings.filter((route) => route !== home);
  const steps = [];
  for (let trip = 0; trip < 3; trip++) {
    const venue = venueForTrip(venues, kind, trip);
    const visit =
      venue?.route ??
      (others.length ? others[Math.floor(hash(n * 13 + trip * 7 + 1) * others.length)] : home);
    // A commission's outcome decides what happens there (`commissionUse`): settlers go in
    // through its door, or stand before it, and may bring something home.
    const stay = venue?.use?.stay ?? 'enter';
    const enters = stay === 'enter';
    const there = moonSettlerRoute(home, visit);
    steps.push({ route: there, toDoor: enters });
    const pause = 3 + hash(n * 5 + trip) * 6;
    steps.push(
      enters
        ? { inside: visit.id, duration: pause }
        : { stand: there, face: moonCommissionFront(visit), duration: pause * 2 },
    );
    steps.push({
      route: moonSettlerRoute(visit, home),
      fromDoor: enters,
      carry: venue?.use?.carry ?? null,
    });
    steps.push({ inside: home.id, duration: 5 + hash(n * 3 + trip + 40) * 8 });
  }
  const { segments, duration } = routineDay(steps, MOON_WALK_SPEED);
  return { segments, duration, offset: hash(n + 70) * duration, home: home.id };
}
// Standing at a commission without going in, a settler faces its door.
const moonCommissionFront = (route) => {
  const [x, y, z] = moonHatch(route);
  const [nx, , nz] = approachPoints(route)[1] ?? [x, y, z + 1];
  return [x - (nx - x), y, z - (nz - z)];
};

/** Where a settler is at `time`: position, heading, door scale and hop distance. */
export function moonSettlerPose(plan, time, out = {}) {
  if (plan.ring) {
    const a = plan.phase + plan.dir * time * plan.speed;
    const radius = MOON_RING_ROAD + (plan.dir > 0 ? -LANE : LANE);
    out.x = Math.cos(a) * radius;
    out.y = MOON_ROAD_LIFT;
    out.z = Math.sin(a) * radius;
    out.heading = -a - (plan.dir > 0 ? 0 : Math.PI);
    out.visible = true;
    out.scale = 1;
    out.distance = time * plan.speed * radius;
    out.inside = null;
    out.carry = null;
    out.walking = true;
    return out;
  }
  const local = (((time + plan.offset) % plan.duration) + plan.duration) % plan.duration;
  return routinePose(plan, local, MOON_WALK_SPEED, MOON_DOOR_TIME, out);
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

// The valley's Willowkin keeps its own rig and walk, at the Moon's stride and hop.
function strideMoonWillowkin(model, distance, walking = true) {
  const step = (distance / STRIDE) * TAU;
  animateAnimal(model, step / 7, walking ? 'walking' : 'idle', walking);
  model.body.position.y = walking ? Math.abs(Math.sin(step)) * HOP : 0;
}

// The wandering pair lap the ring road side by side, suited like the Moon's Willowkin.
// They never step indoors, so they can always be found.
export const moonWanderersPlan = (town) => ({
  ring: true,
  phase: hash((town?.completedRuns ?? 0) + 311) * TAU,
  speed: 0.045,
  dir: 1,
});
/** The valley's pair on the Moon: the same model in suits, at the Moon's stride. */
export function createMoonWanderers(d, parent, town) {
  return {
    ...animalModel(d, WANDERERS, 0, 'space-helmet', parent),
    plan: moonWanderersPlan(town),
    stride: strideMoonWillowkin,
  };
}

/** Completed homes add neighbors. A construction project alone never spawns them. */
export function createMoonSettlers(d, parent, levels = {}, venues = []) {
  const homes = HOMES.reduce((sum, id) => sum + (levels[id] ?? 0), 0);
  const suits = [p.shell, '#d9dde6', '#e8e1cf'];
  const settlers = Array.from({ length: Math.min(10, 2 + homes * 2) }, (_, n) => {
    const figure = moonSuitFigure(d, { parent, suit: suits[n % suits.length] });
    const plan = moonSettlerPlan(levels, n, null, venues);
    // Only a settler whose day brings something home holds the item.
    const carry = plan.segments?.find((segment) => segment.carry)?.carry;
    return { ...figure, plan, item: carry ? addCarriedItem(d, figure.arms[0].lower, carry) : null };
  });
  const dome = levels.willowkinDome ?? 0;
  for (let n = 0; n < (dome > 0 ? Math.min(4, dome + 1) : 0); n++)
    settlers.push({
      ...animalModel(d, 'willowkinResident', 0, 'space-helmet', parent),
      plan: moonSettlerPlan(levels, 100 + n, 'willowkinDome', venues, 'willowkin'),
      stride: strideMoonWillowkin,
    });
  return settlers;
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
  (settler.stride ?? strideMoonFigure)(settler, pose.distance, pose.walking);
  holdCarried(settler.item, settler.arms, !!pose.carry);
  return pose;
}
