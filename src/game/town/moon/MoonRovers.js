// Rovers share the ring roads with people on foot. A rover keeps to the middle of its
// ring, walkers to its edges (`MOON_WALK_LANE`), and a rover brakes for anyone in its way:
// a settler crossing to a path or a spoke, or a rover waiting ahead. Nobody is ever driven
// through. A rover that has never had to wait is exactly where its timetable puts it.
const TAU = Math.PI * 2;
/** Half the strip of road a rover sweeps, with a little room: closer than the walking lanes. */
export const ROVER_CORRIDOR = 0.5;
// Someone walking across the road is in the way from this far either side of its middle.
const ROVER_CROSSING = 1.3;
// Sideways speed, in units a second, that makes a walker a crosser and not a lane walker.
const CROSSING_SPEED = 0.25;
/** How far ahead, along the road, a rover looks: a crossing takes about a second and a half. */
export const ROVER_SIGHT = 4.5;
/** Closer than this it stands still. */
export const ROVER_STOP = 1.6;
// Someone level with the rover's own body is in its way too, not a lap ahead.
const ROVER_LENGTH = 0.7;
// A rover knows where a settler will be: their day is planned. It looks this many steps of
// LOOK seconds ahead for someone about to step into the road.
const LOOKS = 5,
  LOOK = 0.4;
// How near the middle of the road a walker's body reaches the rover's.
const ROVER_REACH = 0.62;
// Room a rover leaves behind the rover in front.
const ROVER_GAP = 1.9;
// How quickly it eases off and pulls away again (share of full speed per second).
const BRAKE = 4,
  PULL_AWAY = 1.6;

/** Seconds since the last frame, for braking only: a paused or rewound clock gives none. */
export const moonRoverStep = (time, last) =>
  Number.isFinite(last) && time > last ? Math.min(0.1, time - last) : 0;

// Distance along the ring from `from` to `to`, the way the rover is going. Anything level
// with the rover (within `behind`) counts as right in front of it.
const ahead = (from, to, dir, radius, behind = 0) => {
  const arc = (((((to - from) * dir) % TAU) + TAU) % TAU) * radius;
  return arc > TAU * radius - behind ? 0 : arc;
};
// Where each walker stood on the last frame, to tell who is walking across a road.
const lastSeen = new WeakMap();
const future = {};

/** How fast a rover may go, 0 to 1, given the nearest thing in its way (`gap` ahead). */
export const roverPace = (gap, stop = ROVER_STOP, sight = ROVER_SIGHT) =>
  gap >= sight ? 1 : gap <= stop ? 0 : (gap - stop) / (sight - stop);

/**
 * A rover's angle on its ring at `time`. It follows `phase + dir * speed * time`, less
 * whatever it has lost waiting (`rover.held`), and slows when a visible walker stands in
 * its corridor ahead or another rover on its ring is close in front.
 */
export function moonRoverAngle(rover, time, step, people = [], rovers = [], predict = null) {
  const angle = () => rover.phase + rover.dir * (time * rover.speed - (rover.held ?? 0));
  if (!step) return angle();
  const here = angle();
  let gap = Infinity;
  for (const person of people) {
    const { root } = person;
    if (!root?.visible) {
      lastSeen.delete(person);
      continue;
    }
    const { x, z } = root.position;
    const offset = Math.hypot(x, z) - rover.radius;
    // Someone about to step into the road: stop before them, unless the rover is already
    // passing and will be clear by the time they do.
    if (predict && Math.abs(offset) > ROVER_CORRIDOR && Math.abs(offset) < 3)
      for (let look = 1; look <= LOOKS; look++) {
        const soon = predict(person, time + look * LOOK, future);
        if (!soon?.visible || Math.abs(Math.hypot(soon.x, soon.z) - rover.radius) > ROVER_REACH)
          continue;
        const reach = ahead(
          here,
          Math.atan2(soon.z, soon.x),
          rover.dir,
          rover.radius,
          ROVER_LENGTH,
        );
        const clearBy = (reach + ROVER_LENGTH + 0.2) / (rover.speed * rover.radius);
        if (clearBy > look * LOOK - 0.15) gap = Math.min(gap, reach);
        break;
      }
    if (Math.abs(offset) > ROVER_CROSSING) continue;
    const before = lastSeen.get(person);
    const sideways = before
      ? Math.abs(Math.hypot(before.x, before.z) - rover.radius - offset) / step
      : 0;
    // In the rover's strip, or walking across the road toward or out of it.
    if (Math.abs(offset) > ROVER_CORRIDOR && sideways < CROSSING_SPEED) continue;
    gap = Math.min(gap, ahead(here, Math.atan2(z, x), rover.dir, rover.radius, ROVER_LENGTH));
  }
  for (const other of rovers) {
    if (other === rover || other.radius !== rover.radius || other.dir !== rover.dir) continue;
    const there = Math.atan2(other.root.position.z, other.root.position.x);
    const distance = ahead(here, there, rover.dir, rover.radius);
    // The rover behind gives way; two that start level let the first in the list go.
    if (distance > 1e-6) gap = Math.min(gap, distance - ROVER_GAP + ROVER_STOP);
  }
  const target = roverPace(gap);
  const pace = rover.pace ?? 1;
  rover.pace =
    target < pace
      ? Math.max(target, pace - BRAKE * step)
      : Math.min(target, pace + PULL_AWAY * step);
  rover.held = (rover.held ?? 0) + (1 - rover.pace) * rover.speed * step;
  return angle();
}

/** Call once a frame, after every rover has looked: remembers where the walkers stand. */
export function rememberWalkers(people) {
  for (const person of people) {
    if (!person.root?.visible) continue;
    const seen = lastSeen.get(person) ?? {};
    seen.x = person.root.position.x;
    seen.z = person.root.position.z;
    lastSeen.set(person, seen);
  }
}
