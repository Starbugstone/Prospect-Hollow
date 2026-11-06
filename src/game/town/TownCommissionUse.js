import { walkPath, walkPose } from './TownNavigation';

// What residents do at a finished commission, shared by the valley and the Moon. A day is a
// fixed loop of segments, so every pose is a pure function of time:
// - `{ route, fromDoor, toDoor, carry }` walks `route.path` (`route.length` long),
//   growing out of a door at its start and shrinking into one at its end when it has one;
// - `{ inside }` rests out of sight behind a door;
// - `{ stand, face }` stands at the end of the walk `stand` (the audience), facing `face`.
// `commissionUse` (src/data/commissions.js) decides which of these an outcome produces.

/** Builds one segment list from steps, timing each walk at `speed`. */
export function routineDay(steps, speed) {
  const segments = [];
  let time = 0;
  for (const step of steps) {
    const duration = step.route ? step.route.length / speed : step.duration;
    segments.push({ ...step, start: time, duration });
    time += duration;
  }
  return { segments, duration: time };
}

/** A walk along points, ready for `routineDay`. */
export function routineRoute(points) {
  const path = walkPath(points);
  return { points, path, length: path.total };
}

/**
 * Where a resident is `local` seconds into its day: position, heading, door scale, the
 * distance walked (for the stride), whether it walks, what it carries and where it is
 * indoors. `doorTime` is how long passing through a door takes.
 */
export function routinePose(day, local, speed, doorTime, out = {}) {
  let segment = day.segments[0];
  for (const candidate of day.segments) {
    if (candidate.start > local) break;
    segment = candidate;
  }
  const elapsed = local - segment.start;
  out.carry = null;
  out.walking = false;
  out.standing = !!segment.stand;
  if (segment.inside) {
    out.visible = false;
    out.inside = segment.inside;
    out.scale = 0;
    return out;
  }
  out.inside = null;
  if (segment.stand) {
    const { path } = segment.stand;
    walkPose(path, 1, out);
    if (segment.face) out.heading = Math.atan2(segment.face[0] - out.x, segment.face[2] - out.z);
    out.scale = 1;
    out.visible = true;
    out.distance = path.total;
    return out;
  }
  const { path, length } = segment.route;
  const distance = Math.min(length, elapsed * speed);
  // The valley's path sampling, with its eased turns at corners.
  walkPose(path, length ? distance / length : 1, out);
  const opening = segment.fromDoor === false ? Infinity : elapsed / doorTime;
  const closing = segment.toDoor === false ? Infinity : (segment.duration - elapsed) / doorTime;
  out.scale = Math.max(0, Math.min(1, opening, closing));
  out.visible = out.scale > 0;
  out.distance = distance;
  out.walking = distance < length;
  out.carry = segment.carry ?? null;
  return out;
}

// Things residents bring home, drawn from shared primitives so the valley's instanced
// townsfolk draw them without a new draw call per figure.
const ITEMS = {
  book: (d, g) => {
    d.box(g, 0.2, 0.05, 0.15, 0, 0, 0.04, '#8a3f3a', true);
    d.box(g, 0.18, 0.035, 0.13, 0.012, 0.004, 0.04, '#f4ead5', true);
  },
  fruit: (d, g) => {
    d.box(g, 0.24, 0.1, 0.18, 0, -0.02, 0.04, '#8a6a4a', true);
    for (const x of [-0.06, 0.06]) d.ball(g, x, 0.06, 0.04, 0.06, '#e98a4a', 'rock');
  },
  crystal: (d, g) => d.ball(g, 0, 0.06, 0.05, [0.06, 0.14, 0.06], '#a6cfdf', 'rock'),
  pie: (d, g) => {
    d.mesh(g, 'cylinder', [0.17, 0.05, 0.17], [0, 0, 0.05], '#eacb80');
    d.mesh(g, 'cylinder', [0.19, 0.015, 0.19], [0, -0.03, 0.05], '#d9d4c6');
  },
};
/** The item a resident carries home in one hand, hidden until `holdCarried` shows it. */
export function addCarriedItem(d, hand, carry) {
  if (!ITEMS[carry]) return null;
  const item = d.group(hand, 0, -0.2, 0.06);
  item.name = `Carried ${carry}`;
  ITEMS[carry](d, item);
  item.visible = false;
  return item;
}
/** Shows the item while carrying it, held before the body; the other arm swings on. */
export function holdCarried(item, arms, carrying) {
  if (!item) return;
  item.visible = carrying;
  if (!carrying) return;
  arms[0].upper.rotation.x = -0.75;
  arms[0].lower.rotation.x = -0.7;
}
