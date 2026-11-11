import { commissionUse, commissionVillagers, finishedCommissions } from '../../data/commissions';
import { HOME_SETTLEMENT } from '../../data/settlements';
import { LANDMARK_BY_ID, areaChoice, siteYaw } from '../../data/townLandmarks';
import { BUILDING_BY_ID } from '../../data/town';
import { NEED_SOURCES } from '../../data/townNeeds';
import { villagerRandom } from '../../data/villagers';
import { VALLEY_COMMISSION_GROUNDS as GROUNDS } from './TownCommissionLandmarks';
import {
  addCarriedItem,
  holdCarried,
  routineDay,
  routinePose,
  routineRoute,
} from './TownCommissionUse';
import { swingLimbs, VILLAGER_WALK_SPEED } from './TownGait';
import { groundHeight } from './TownLandscape';
import { finishWork, scheduleWork } from '../PresentationWork';
import { PLOTS, segmentDistance, siteFootpath, townTracks } from './TownLayout';

// Townsfolk who use a finished valley commission. Each leaves a real home through its
// door, walks the streets to the edge of the monument field, crosses it to the site and
// does what the chosen outcome says (`commissionUse`): goes in through the door, joins
// the audience or wanders the grounds. Then it walks home, perhaps carrying something,
// and goes in. Paths are prepared once with the rest of village life; each pose is then
// a pure function of the village clock, as the Moon's settlers are.
export const COMMISSION_DOOR_TIME = 0.5;
// The pedestal's three steps rise 0.2 each from its rim (radius 5.8) to the court floor
// (radius 5). Walkers climb a little outside each step, so their feet stay on top of it.
const CLIMB = { from: 6.3, to: 5.5 };
const COURT_STEP = 0.25;
// Children are drawn at this scale on the villager skeleton.
const CHILD = 0.68;

const toWorld = (area, [lx, lift, lz]) => {
  const [x, z] = area.positions[0],
    yaw = siteYaw(area);
  const wx = x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
    wz = z - lx * Math.sin(yaw) + lz * Math.cos(yaw);
  return [wx, groundHeight(x, z) + lift, wz];
};
// The court's walking surface in site coordinates: up the pedestal's steps, onto a lawn.
function courtLift(x, z, grounds) {
  const r = Math.hypot(x, z);
  const steps = Math.max(0, Math.min(1, (CLIMB.from - r) / (CLIMB.from - CLIMB.to)));
  const lawn = grounds?.lawn && r < grounds.lawn ? 0.12 : 0;
  return GROUNDS.floor * steps + lawn + 0.07;
}
// Straight legs between corners, sampled finely enough to climb the steps smoothly.
function courtPoints(corners, grounds) {
  const points = [];
  corners.forEach(([x, z], n) => {
    if (n) {
      const [px, pz] = corners[n - 1];
      const count = Math.max(1, Math.ceil(Math.hypot(x - px, z - pz) / COURT_STEP));
      for (let s = 1; s < count; s++) {
        const t = s / count;
        const sx = px + (x - px) * t,
          sz = pz + (z - pz) * t;
        points.push([sx, courtLift(sx, sz, grounds), sz]);
      }
    }
    points.push([x, courtLift(x, z, grounds), z]);
  });
  return points;
}

/**
 * Where the `n`th visitor goes on a commission site, in site coordinates (+z the front):
 * `approach` runs from the field just before the site to where it stays, `loop` is a walk
 * it repeats there and `face` the point it looks at while standing. The stay the outcome
 * asks for needs its form's grounds; without them the visitor gathers at the front.
 */
export function commissionGrounds(form, use, n, radius) {
  const grounds = GROUNDS[form];
  const front = radius + 1.4,
    lane = [
      [GROUNDS.lane, front],
      [GROUNDS.lane, 4],
    ];
  if (use.stay === 'enter' && grounds?.door) {
    const [x, z] = grounds.door;
    return {
      stay: 'enter',
      approach: courtPoints([...lane, [x + 0.5, z + 0.7], [x, z]], grounds),
    };
  }
  if (use.stay === 'gather' && grounds?.audience) {
    // Places across the front of the stage, filled from the middle; the walk follows the
    // audience's arc round to its place.
    const angle = [0.32, -0.32, 0.72, -0.72][n % 4],
      start = Math.atan2(lane[1][0], lane[1][1]);
    const arc = [];
    for (let a = start; Math.abs(a - angle) > 0.12; a += Math.sign(angle - start) * 0.12)
      arc.push([Math.sin(a) * grounds.audience, Math.cos(a) * grounds.audience]);
    const place = [Math.sin(angle) * grounds.audience, Math.cos(angle) * grounds.audience];
    return {
      stay: 'gather',
      approach: courtPoints([...lane, ...arc, place], grounds),
      face: [0, courtLift(0, 0, grounds) + 1, 0],
    };
  }
  if (use.stay === 'roam' && grounds?.yard) {
    const yard = grounds.yard.slice(n % grounds.yard.length);
    const loop = [...yard, ...grounds.yard.slice(0, n % grounds.yard.length), yard[0]];
    return {
      stay: 'roam',
      approach: courtPoints([...lane, grounds.gate, yard[0]], grounds),
      loop: courtPoints(loop, grounds),
      face: [0, courtLift(0, 0, grounds) + 0.5, 0],
    };
  }
  // A form without grounds for its stay: the visitors stand together before the site.
  const place = [(n - 1) * 1.3, front];
  return {
    stay: 'gather',
    approach: courtPoints([[place[0], front + 1.2], place], null),
    face: [0, 1, 0],
  };
}

// Valley homes: plots that house residents in the needs model.
const HOUSING = new Set(
  NEED_SOURCES.filter(({ stat, id }) => stat === 'housing' && id).map(({ id }) => id),
);
export function valleyHomes(town) {
  return Object.keys(PLOTS).filter((id) => {
    if (!(town?.buildings?.[id] > 0) || town.projects?.[id]) return false;
    const building = BUILDING_BY_ID[id];
    return building?.kind === 'home' || HOUSING.has(id) || building?.effects?.housing > 0;
  });
}

/**
 * One visitor's looping day: out of its home door to the commission, the stay its
 * outcome asks for, home again (carrying what the outcome gives) and a rest indoors.
 * `out` is the full walk there, `loop` the yard walk of a roaming stay.
 */
export function commissionResidentDay({
  out,
  loop = null,
  face = null,
  use,
  stay,
  n,
  homeId,
  siteId,
}) {
  const there = routineRoute(out),
    back = routineRoute([...out].reverse());
  const draw = (k) => villagerRandom(9001 + n * 131 + k * 17);
  const steps = [{ route: there, toDoor: stay === 'enter' }];
  // The site is a long walk from town, so an audience stays for the concert and children
  // play a good while; a story is heard indoors.
  if (stay === 'enter') steps.push({ inside: siteId, duration: 20 + draw(1) * 15 });
  else if (stay === 'gather') steps.push({ stand: there, face, duration: 150 + draw(2) * 60 });
  else {
    const yard = routineRoute(loop);
    for (let lap = 0; lap < 6; lap++) {
      steps.push({ route: yard, fromDoor: false, toDoor: false });
      steps.push({ stand: yard, face, duration: 4 + draw(lap + 4) * 6 });
    }
  }
  steps.push({ route: back, fromDoor: stay === 'enter', carry: use.carry });
  steps.push({ inside: homeId, duration: 8 + draw(3) * 10 });
  return routineDay(steps, VILLAGER_WALK_SPEED);
}

// The point on a wide street nearest the site's front, stepped onto the verge toward it.
function trailheads(d, town, front) {
  const roads = townTracks(town).filter((road) => road.width >= 0.85);
  return d.itineraries.nodes
    .filter((node) => roads.some(({ from, to }) => segmentDistance(...node, from, to) < 1e-3))
    .sort(
      (a, b) =>
        Math.hypot(a[0] - front[0], a[1] - front[2]) - Math.hypot(b[0] - front[0], b[1] - front[2]),
    )
    .slice(0, 3)
    .map(([x, z]) => {
      const gap = Math.hypot(front[0] - x, front[2] - z) || 1;
      const px = x + ((front[0] - x) / gap) * 1.05,
        pz = z + ((front[2] - z) / gap) * 1.05;
      return [px, 0.07, pz];
    });
}
// The walk across the monument field, around anything standing in it, on its ground.
function fieldWalk(d, from, to) {
  const plan = d.navigation?.plan([from, to], 0.29);
  if (!plan?.points.length || Math.hypot(...[0, 2].map((i) => plan.points.at(-1)[i] - to[i])) > 0.5)
    return null;
  const points = [];
  plan.points.forEach((p, n) => {
    if (n) {
      const q = plan.points[n - 1];
      const count = Math.max(1, Math.ceil(Math.hypot(p[0] - q[0], p[2] - q[2]) / 0.75));
      for (let s = 1; s < count; s++) {
        const x = q[0] + ((p[0] - q[0]) * s) / count,
          z = q[2] + ((p[2] - q[2]) * s) / count;
        points.push([x, groundHeight(x, z) + 0.07, z]);
      }
    }
    points.push([p[0], groundHeight(p[0], p[2]) + 0.07, p[2]]);
  });
  return points;
}
// A site's footpath as a walk along its middle, from the verge of its street to the site's
// front, or null when the site has none or something stands on it.
function footpathWalk(d, town, area) {
  const corners = siteFootpath(town, area.id);
  if (!corners) return null;
  // Step off the street onto its verge, toward the path.
  const [[ax, az], [bx, bz]] = corners;
  const length = Math.hypot(bx - ax, bz - az) || 1;
  const start = [ax + ((bx - ax) / length) * 1.05, az + ((bz - az) / length) * 1.05];
  const points = [];
  [start, ...corners.slice(1)].forEach(([x, z], n, list) => {
    if (n) {
      const [px, pz] = list[n - 1];
      const count = Math.max(1, Math.ceil(Math.hypot(x - px, z - pz) / 0.75));
      for (let s = 1; s < count; s++) {
        const sx = px + ((x - px) * s) / count,
          sz = pz + ((z - pz) * s) / count;
        points.push([sx, groundHeight(sx, sz) + 0.07, sz]);
      }
    }
    points.push([x, groundHeight(x, z) + 0.07, z]);
  });
  const clear = points.every(
    (point, n) => !n || !d.navigation || d.navigation.segment(points[n - 1], point, 0.29),
  );
  return clear ? points : null;
}
// From a home's door along the streets, then by the site's footpath (or, without one,
// across the field) to the site: one walk.
function* residentWalk(d, town, home, area, court) {
  const door = d.itineraries.endpoint(home, true);
  if (!door) return null;
  const front = toWorld(area, court.approach[0]);
  const path = footpathWalk(d, town, area);
  yield;
  if (path && Math.hypot(path.at(-1)[0] - front[0], path.at(-1)[2] - front[2]) < 0.05) {
    const street = yield* d.itineraries.legSteps(door, path[0]);
    const join = street?.total ? street.points.at(-1) : null;
    if (join && Math.hypot(join[0] - path[0][0], join[2] - path[0][2]) <= 0.05)
      return [
        ...street.points,
        ...path.slice(1),
        ...court.approach.slice(1).map((point) => toWorld(area, point)),
      ];
  }
  for (const trailhead of trailheads(d, town, front)) {
    const field = fieldWalk(d, trailhead, front);
    yield;
    if (!field) continue;
    const street = yield* d.itineraries.legSteps(door, field[0]);
    if (!street?.total) continue;
    const join = street.points.at(-1);
    if (Math.hypot(join[0] - field[0][0], join[2] - field[0][2]) > 0.05) continue;
    return [
      ...street.points,
      ...field.slice(1),
      ...court.approach.map((point) => toWorld(area, point)),
    ];
  }
  return null;
}

// What the townsfolk depend on: each finished valley commission and its chosen outcome.
const residentsKey = (town) =>
  finishedCommissions(town, HOME_SETTLEMENT)
    .map(({ site, area }) => `${site}:${areaChoice(town, area)}`)
    .join('|');

/**
 * Adds the townsfolk of every finished valley commission, in resumable steps of village
 * life. Nothing is saved: the saved outcome and stage decide who comes and what they do.
 */
export function* addCommissionResidents(d, town) {
  d.commissionResidentsFor = residentsKey(town);
  // A newer call takes over from one still planning its walks.
  const run = (d.commissionResidentsRun = {});
  if (!d.itineraries) return;
  const homes = valleyHomes(town);
  if (!homes.length) return;
  for (const { site, area, outcome } of finishedCommissions(town, HOME_SETTLEMENT)) {
    const form = LANDMARK_BY_ID[areaChoice(town, area)]?.form;
    const use = commissionUse(outcome);
    const [sx, sz] = area.positions[0];
    const nearest = [...homes].sort(
      (a, b) =>
        Math.hypot(PLOTS[a][0] - sx, PLOTS[a][1] - sz) -
        Math.hypot(PLOTS[b][0] - sx, PLOTS[b][1] - sz),
    );
    const count = commissionVillagers(outcome);
    for (let n = 0; n < count; n++) {
      const home = nearest[n % Math.min(3, nearest.length)];
      const court = commissionGrounds(form, use, n, area.radius);
      const out = yield* residentWalk(d, town, home, area, court);
      if (d.commissionResidentsRun !== run) return;
      if (!out) continue;
      const day = commissionResidentDay({
        out,
        loop: court.loop?.map((point) => toWorld(area, point)),
        face: court.face && toWorld(area, court.face),
        use,
        stay: court.stay,
        n,
        homeId: home,
        siteId: site,
      });
      addResident(d, day, { use, n, count, site });
      yield;
    }
  }
}

/**
 * Brings the townsfolk in line with a town that changed without a rebuild: a commission
 * unveiled on the map changes only the saved outcome. Village life that is still being
 * populated adds them itself, from the same town.
 */
export function syncCommissionResidents(d, town) {
  if (d.commissionResidentsFor === undefined || d.commissionResidentsFor === residentsKey(town))
    return;
  const leaving = d.commissionResidents ?? [];
  const motions = new Set(leaving.map(({ motion }) => motion));
  d.motions = d.motions.filter((motion) => !motions.has(motion));
  for (const { actor } of leaving) d.clearGroup(actor.root);
  d.commissionResidents = [];
  // A rebuilt village populates itself; this work is for the world it started in.
  const world = d.world;
  const isCurrent = () => d.world === world && !d.disposed;
  const settle = () => {
    if (!isCurrent()) return;
    d.rebuildActors?.();
    d.render?.();
  };
  if (leaving.length) settle();
  const work = addCommissionResidents(d, town);
  if (typeof requestAnimationFrame === 'undefined') {
    finishWork(work);
    settle();
  } else scheduleWork(work, { budget: 8, isCurrent, complete: settle });
}

const SKINS = ['#d5ad88', '#9e7559', '#c99d78', '#edc7a4'];
function addResident(d, day, { use, n, count, site }) {
  const seed = 2101 + n * 37 + site.length * 11;
  const actor = d.person({
    manual: true,
    color: '#7f8f72',
    skin: SKINS[n % SKINS.length],
    hat: '#c3a274',
    route: [
      [0, 0],
      [0.1, 0],
    ],
    seed,
    dress: n % 2 === 1,
  });
  actor.root.name = use.young ? 'Child at the commission' : 'Resident at the commission';
  // Visitors spread over the day, so someone is usually on the way or there.
  const offset = (n / Math.max(1, count)) * day.duration;
  const resident = {
    actor,
    day,
    offset,
    size: use.young ? CHILD : 1,
    item: addCarriedItem(d, actor.arms[0].lower, use.carry),
    pose: {},
  };
  resident.motion = (time) => animateCommissionResident(d, resident, time);
  (d.commissionResidents ??= []).push(resident);
  d.motions.push(resident.motion);
  animateCommissionResident(d, resident, d.elapsed ?? 0);
}

/** Places one commission visitor at `time`, with the valley's walk cycle. */
export function animateCommissionResident(d, resident, time) {
  const { actor, day, offset, size, item, pose } = resident;
  const local = (((time + offset) % day.duration) + day.duration) % day.duration;
  routinePose(day, local, VILLAGER_WALK_SPEED, COMMISSION_DOOR_TIME, pose);
  const { root, body, torso, head, arms, legs, seed } = actor;
  root.visible = pose.visible;
  if (!pose.visible) return pose;
  root.position.set(pose.x, pose.y, pose.z);
  root.rotation.y = pose.heading;
  root.scale.setScalar(pose.scale * size);
  // The same stride as every villager: a step every 0.58 units, scaled with the figure.
  const step = (pose.distance / (0.58 * size)) * Math.PI * 2;
  body.position.y =
    0.54 + (pose.walking ? Math.cos(step * 2) * 0.013 : Math.sin(time * 1.8 + seed) * 0.005);
  torso.rotation.z = pose.walking ? Math.sin(step) * 0.025 : 0;
  head.rotation.y = Math.sin(time * 0.7 + seed) * (pose.walking ? 0.1 : 0.2);
  swingLimbs(arms, legs, step, pose.walking);
  // An audience applauds now and then; reduced motion keeps it still and listening.
  if (pose.standing && !d.reducedMotion && Math.sin(time * 0.35 + seed) > 0.75)
    for (const arm of arms) {
      arm.upper.rotation.x = -0.9;
      arm.lower.rotation.x = -0.6 - Math.abs(Math.sin(time * 9)) * 0.35;
    }
  holdCarried(item, arms, !!pose.carry);
  return pose;
}
