// Vehicles share the ring roads with people on foot: the rovers, and the tram on the outer
// ring (MoonTram.js). A vehicle keeps to the middle of its ring, walkers to its edges
// (`MOON_WALK_LANE`), and it brakes for anyone in its way: a settler crossing to a path or a
// spoke, or a vehicle waiting ahead. Nobody is ever driven through. A vehicle that has never
// had to wait is exactly where its timetable puts it; one that rests at stops (the tram)
// makes up what it lost there.
const TAU = Math.PI * 2;
/** The outer ring's rovers: their speed (radians a second) and the first one's start angle. */
export const OUTER_RING_ROVER = Object.freeze({ speed: 0.06, phase: 1, dir: -1 });
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
/** How far a rover's body reaches ahead of or behind its middle, with a little room. Someone
 * level with its body is in its way too, not a lap ahead. A longer vehicle sets `length`. */
export const ROVER_LENGTH = 0.7;
// A rover knows where a settler will be: their day is planned. It looks this many steps of
// LOOK seconds ahead for someone about to step into the road.
const LOOKS = 5,
  LOOK = 0.4;
// How near the middle of the road a walker's body reaches the rover's.
const ROVER_REACH = 0.62;
// How much nearer the middle someone must be heading to be stepping in. A lane walker's
// straight steps round a ring cut in by under 0.1, so it never counts; a crosser closes
// about 0.4 a look.
const STEPPING_IN = 0.15;
// Room a vehicle leaves between its body and the vehicle in front.
const VEHICLE_ROOM = 0.5;
// How quickly it eases off and pulls away again (share of full speed per second).
const BRAKE = 4,
  PULL_AWAY = 1.6;
// Resting at a stop, a late vehicle's timetable runs this much faster than the clock, so a
// late tram leaves early by up to half its rest.
const CATCH_UP = 1;

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

// How far round its ring (radians) a vehicle has gone by `time`, less `lost`, the radians it
// has lost waiting at its cruising speed: a rover drives at a steady `speed`; a vehicle with
// a `timetable` (the tram) follows its own, on a clock running that far behind.
const travelled = (vehicle, time, lost) =>
  vehicle.timetable
    ? vehicle.timetable.travel(time - lost / vehicle.speed)
    : time * vehicle.speed - lost;

/**
 * A vehicle's angle on its ring at `time`. It follows its timetable from `phase` in direction
 * `dir` (a rover: `phase + dir * speed * time`), less whatever it has lost waiting
 * (`vehicle.held`, radians at its cruising speed), and slows when a visible walker stands in its corridor ahead
 * or another vehicle on its ring is close in front. `length` (ROVER_LENGTH by default) is how
 * far its body reaches from its middle; `speed` is its cruising speed. A vehicle whose
 * `timetable.resting(clock)` is true stands at a stop and catches up lost time there.
 */
export function moonRoverAngle(rover, time, step, people = [], rovers = [], predict = null) {
  const angle = () => rover.phase + rover.dir * travelled(rover, time, rover.held ?? 0);
  if (!step) return angle();
  const here = angle();
  const length = rover.length ?? ROVER_LENGTH;
  // A longer vehicle stops and looks further ahead by as much as its body is longer.
  const longer = length - ROVER_LENGTH;
  const stop = ROVER_STOP + longer,
    sight = ROVER_SIGHT + longer;
  let gap = Infinity;
  for (const person of people) {
    const { root } = person;
    if (!root?.visible) {
      lastSeen.delete(person);
      continue;
    }
    const { x, z } = root.position;
    const offset = Math.hypot(x, z) - rover.radius;
    // Someone about to step into the road: stop before them, unless the vehicle is already
    // passing and will be clear by the time they do.
    if (predict && Math.abs(offset) > ROVER_CORRIDOR && Math.abs(offset) < 3)
      for (let look = 1; look <= LOOKS; look++) {
        const soon = predict(person, time + look * LOOK, future);
        const soonOffset = soon?.visible ? Math.abs(Math.hypot(soon.x, soon.z) - rover.radius) : 0;
        if (
          !soon?.visible ||
          soonOffset > ROVER_REACH ||
          Math.abs(offset) - soonOffset < STEPPING_IN
        )
          continue;
        const reach = ahead(here, Math.atan2(soon.z, soon.x), rover.dir, rover.radius, length);
        const clearBy = (reach + length + 0.2) / (rover.speed * rover.radius);
        if (clearBy > look * LOOK - 0.15) gap = Math.min(gap, reach);
        break;
      }
    if (Math.abs(offset) > ROVER_CROSSING) continue;
    const before = lastSeen.get(person);
    const sideways = before
      ? Math.abs(Math.hypot(before.x, before.z) - rover.radius - offset) / step
      : 0;
    // In the vehicle's strip, or walking across the road toward or out of it.
    if (Math.abs(offset) > ROVER_CORRIDOR && sideways < CROSSING_SPEED) continue;
    gap = Math.min(gap, ahead(here, Math.atan2(z, x), rover.dir, rover.radius, length));
  }
  for (const other of rovers) {
    if (other === rover || other.radius !== rover.radius || other.dir !== rover.dir) continue;
    const there = Math.atan2(other.root.position.z, other.root.position.x);
    const distance = ahead(here, there, rover.dir, rover.radius);
    // The vehicle behind gives way; two that start level let the first in the list go.
    const room = length + (other.length ?? ROVER_LENGTH) + VEHICLE_ROOM;
    if (distance > 1e-6) gap = Math.min(gap, distance - room + stop);
  }
  const target = roverPace(gap, stop, sight);
  const pace = rover.pace ?? 1;
  rover.pace =
    target < pace
      ? Math.max(target, pace - BRAKE * step)
      : Math.min(target, pace + PULL_AWAY * step);
  // At rest by its timetable it loses nothing more, and makes up what it has lost.
  const held = rover.held ?? 0;
  rover.held = rover.timetable?.resting(time - held / rover.speed)
    ? Math.max(0, held - CATCH_UP * rover.speed * step)
    : held + (1 - rover.pace) * rover.speed * step;
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
