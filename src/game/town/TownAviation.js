import { hasRoundedTransport } from '../../data/roundedArchitecture';
import { roundedAircraft } from './RoundedTransports';
import { airportAppearance } from '../../data/airport';
import { SKY_MOON_DIRECTION, saucerFliesToMoon, skySaucer } from '../../data/skyCraft';
import { futureModel, cityModel } from './buildings/city';
import { AIRPORT } from './TownLayout';
import airportLayout from '../../data/airportLayout.json';
import { Box3, Quaternion, Vector3 } from 'three';
import { lerp, smooth01 } from './TownMath';

// One aircraft owns the whole sequence. Arrivals and departures cannot overlap;
// town rebuilds sample the same clock instead of starting another flight.
export const AIRPORT_FLIGHT_CYCLE = 240;
const DOCK_AT = 176;
const cyclePhase = (time) =>
  ((time % AIRPORT_FLIGHT_CYCLE) + AIRPORT_FLIGHT_CYCLE) % AIRPORT_FLIGHT_CYCLE;
export function airplaneArrival(time) {
  const phase = cyclePhase(time);
  return {
    arrived: phase >= DOCK_AT,
    sinceArrival: phase - DOCK_AT,
    visit: Math.floor(time / AIRPORT_FLIGHT_CYCLE),
  };
}
// Park inside the bay and back straight out through its runway-facing opening.
// The hangar definition also drives the authored model and clear taxi corridor.
const standX = AIRPORT.center[0] + (airportLayout.hangar.frontX + airportLayout.hangar.backX) / 2;
const taxiZ = AIRPORT.center[1] + airportLayout.hangar.centerZ;
const startZ = AIRPORT.startZ + 2;
const touchdownZ = AIRPORT.startZ + 7;
const mod = (n, m) => ((n % m) + m) % m;

// Each visiting plane flies one of these departures: the rotation point (runway
// distance at lift-off), climb per unit of runway, and on some visits a gentle banked
// turn away from the town (toward -X) once it is well clear of the ground.
export const PLANE_DEPARTURES = Object.freeze([
  Object.freeze({ liftoff: 22, climb: 0.38, turn: 0 }),
  Object.freeze({ liftoff: 19, climb: 0.43, turn: 0 }),
  Object.freeze({ liftoff: 25, climb: 0.34, turn: -1 }),
]);
// A plane changes identity while it is away, so the one that lands is the one that
// parks and departs on the next visit. Liveries and departures both cycle with the
// visit, departures shifting one step every full cycle: with three of each, consecutive
// visits differ in both and nine visits fly every pairing. Deterministic in time, so a
// rebuild keeps the same plane.
const FLIGHT_SWAP = 100;
export function airplaneFlight(time, liveries = 3) {
  const visit = Math.floor(time / AIRPORT_FLIGHT_CYCLE);
  const flight = visit - (cyclePhase(time) < FLIGHT_SWAP ? 1 : 0);
  const profiles = PLANE_DEPARTURES.length;
  return {
    flight,
    livery: mod(flight, liveries),
    departure: PLANE_DEPARTURES[mod(flight + Math.floor(flight / profiles), profiles)],
  };
}

// A banked turn: an arc of TURN_RADIUS starting TURN_FROM along the runway, turning
// TURN_ANGLE radians, then straight.
const TURN_FROM = 62,
  TURN_RADIUS = 60,
  TURN_ANGLE = 0.55,
  BANK = 0.3;
function departureTrack(distance, { liftoff, climb, turn }) {
  const track = {
    x: AIRPORT.runwayX,
    z: startZ + distance,
    y: 0.2 + Math.max(0, distance - liftoff) * climb,
    yaw: 0,
    roll: 0,
    pitch: -Math.min(0.16 * (climb / 0.38), Math.max(0, distance - liftoff + 4) * 0.016),
  };
  const along = distance - TURN_FROM;
  if (!turn || along <= -6) return track;
  // Roll into the turn just before it starts and level out as it ends.
  const bankIn = smooth01(Math.min(1, (along + 6) / 10)),
    bankOut = smooth01(Math.max(0, Math.min(1, (along - TURN_RADIUS * TURN_ANGLE + 6) / 10)));
  track.roll = -turn * BANK * bankIn * (1 - bankOut);
  if (along <= 0) return track;
  const arc = Math.min(along, TURN_RADIUS * TURN_ANGLE),
    heading = arc / TURN_RADIUS,
    straight = along - arc;
  track.x += turn * (TURN_RADIUS * (1 - Math.cos(heading)) + straight * Math.sin(heading));
  track.z = startZ + TURN_FROM + TURN_RADIUS * Math.sin(heading) + straight * Math.cos(heading);
  track.yaw = turn * heading;
  return track;
}

export function airplanePose(time) {
  const phase = cyclePhase(time);
  const pose = {
    x: standX,
    z: taxiZ,
    y: 0.2,
    yaw: Math.PI / 2,
    pitch: 0,
    roll: 0,
    visible: true,
    opacity: 1,
    propellers: false,
    phase: 'parked',
  };
  if (phase < 18 || phase >= DOCK_AT) return pose;
  if (phase < 28)
    return {
      ...pose,
      x: lerp(standX, AIRPORT.runwayX, smooth01((phase - 18) / 10)),
      phase: 'pushback',
    };
  if (phase < 32)
    return {
      ...pose,
      x: AIRPORT.runwayX,
      yaw: lerp(Math.PI / 2, Math.PI, smooth01((phase - 28) / 4)),
      propellers: true,
      phase: 'taxi-out',
    };
  if (phase < 44)
    return {
      ...pose,
      x: AIRPORT.runwayX,
      z: lerp(taxiZ, startZ, smooth01((phase - 32) / 12)),
      yaw: Math.PI,
      propellers: true,
      phase: 'taxi-out',
    };
  if (phase < 48)
    return {
      ...pose,
      x: AIRPORT.runwayX,
      z: startZ,
      yaw: lerp(Math.PI, Math.PI * 2, smooth01((phase - 44) / 4)),
      propellers: true,
      phase: 'line-up',
    };
  if (phase < 70) {
    const t = phase - 48;
    const distance = Math.min(t, 10) ** 2 * 0.35 + Math.max(0, t - 10) * 7;
    return {
      ...pose,
      ...departureTrack(distance, airplaneFlight(time).departure),
      propellers: true,
      phase: 'takeoff',
      opacity: 1 - smooth01(Math.max(0, Math.min(1, (phase - 62) / 8))),
    };
  }
  if (phase < 135) return { ...pose, visible: false, phase: 'away' };
  if (phase < 151) {
    const approach = (phase - 135) / 16;
    const z = lerp(touchdownZ - 72, touchdownZ, approach);
    return {
      ...pose,
      x: AIRPORT.runwayX,
      z,
      y: 0.2 + (touchdownZ - z) * 0.38,
      yaw: 0,
      pitch: 0.045 * (1 - smooth01(approach)),
      propellers: true,
      phase: 'landing',
      opacity: smooth01(Math.min(1, (phase - 135) / 6)),
    };
  }
  if (phase < 160) {
    const t = (phase - 151) / 9;
    return {
      ...pose,
      x: AIRPORT.runwayX,
      z: lerp(touchdownZ, taxiZ, 1 - (1 - t) ** 2),
      yaw: 0,
      propellers: true,
      phase: 'rollout',
    };
  }
  if (phase < 164)
    return {
      ...pose,
      x: AIRPORT.runwayX,
      yaw: (Math.PI / 2) * smooth01((phase - 160) / 4),
      propellers: true,
      phase: 'taxi-in',
    };
  return {
    ...pose,
    x: lerp(AIRPORT.runwayX, standX, smooth01((phase - 164) / 12)),
    propellers: true,
    phase: 'taxi-in',
  };
}

// The saucer needs no runway: it hovers out of the hangar to a pad on the runway beside
// the hangar door, lifts straight up, pauses, then streaks away along its route.
export const SAUCER_PAD = Object.freeze({ x: AIRPORT.runwayX, z: taxiZ });
const PARKED_Y = 0.2,
  // Low enough that every era's saucer clears the hangar door lintel.
  HOVER_LOW = 0.5,
  HOVER_HIGH = 10;
const unit = (x, y, z) => {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
};
// A route leaves the hover point along a horizontal `heading`. Its height above the hover
// point at horizontal distance s is `climb * s + rise * (1 - e^(-s / ease))`: the rise
// makes it climb steeply at first, then it settles onto its `climb` line.
const route = ([x, z], climb, rise = 0, ease = 1) =>
  Object.freeze({
    heading: Object.freeze([x / Math.hypot(x, z), z / Math.hypot(x, z)]),
    climb,
    rise,
    ease,
  });
export const SAUCER_ROUTES = Object.freeze({
  // Open sky: west and a little south, away from the town and the railway, climbing at
  // about 25°. Seen from the town it shrinks into the distance instead of rushing at the
  // camera.
  sky: route([-1, 0.25], 0.45),
  // The Moon is drawn about 5° above eye level in SKY_MOON_DIRECTION. The saucer
  // climbs steeply off the hover, then flies along that line of sight, so from any
  // camera its path runs into the drawn Moon.
  moon: route(SKY_MOON_DIRECTION, 0.09, 20, 15),
});
const routePoint = ({ heading, climb, rise, ease }, s) => ({
  x: SAUCER_PAD.x + heading[0] * s,
  y: HOVER_HIGH + climb * s + rise * (1 - Math.exp(-s / ease)),
  z: SAUCER_PAD.z + heading[1] * s,
});
/** Direction of travel away from the pad at horizontal distance s. */
const routeTangent = ({ heading, climb, rise, ease }, s) =>
  unit(heading[0], climb + (rise / ease) * Math.exp(-s / ease), heading[1]);
const DOWN = Object.freeze([0, -1, 0]);
const yawOf = ([x, z]) => Math.atan2(x, z);
const turnTo = (from, to, t) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;
const ramp = (phase, from, length) => smooth01(Math.max(0, Math.min(1, (phase - from) / length)));

/** The saucer's flight on the same four-minute cycle and arrival time as the planes.
 * `toMoon` sends it toward the sky Moon and brings it back from there; otherwise it
 * leaves for the open sky and returns straight down from overhead. Wobble and the
 * rim-light `spin` (0..1) are pure in time; `legs` is the landing-leg extension. */
export function saucerPose(time, { toMoon = false } = {}) {
  const phase = cyclePhase(time);
  const out = toMoon ? SAUCER_ROUTES.moon : SAUCER_ROUTES.sky;
  const heading = yawOf(out.heading),
    arrivalYaw = toMoon ? heading + Math.PI : Math.PI / 2;
  const pose = (fields, wobble = 0) => ({
    x: standX,
    z: taxiZ,
    y: PARKED_Y,
    yaw: Math.PI / 2,
    visible: true,
    opacity: 1,
    propellers: false,
    spin: 0,
    legs: 0,
    trail: 0,
    travel: DOWN,
    ...fields,
    pitch: (fields.pitch ?? 0) + wobble * Math.sin(time * 2.7),
    roll: wobble * Math.sin(time * 2.1 + 1.3),
  });
  const pad = { x: SAUCER_PAD.x, z: SAUCER_PAD.z };
  if (phase < 18 || phase >= DOCK_AT) return pose({ legs: 1, phase: 'parked' });
  if (phase < 22) {
    const k = ramp(phase, 18, 4);
    return pose(
      {
        y: lerp(PARKED_Y, HOVER_LOW, k),
        legs: 1 - ramp(phase, 19, 3),
        spin: 0.3 * k,
        propellers: true,
        phase: 'lift-off',
      },
      0.015 * k,
    );
  }
  if (phase < 32)
    return pose(
      {
        x: lerp(standX, pad.x, ramp(phase, 22, 10)),
        y: HOVER_LOW,
        spin: 0.3,
        propellers: true,
        phase: 'taxi-out',
      },
      0.015,
    );
  if (phase < 38) {
    const k = ramp(phase, 32, 6);
    return pose(
      {
        ...pad,
        y: HOVER_LOW,
        yaw: turnTo(Math.PI / 2, heading, k),
        spin: 0.3 + 0.7 * k,
        propellers: true,
        phase: 'spin-up',
      },
      0.015 + 0.035 * k,
    );
  }
  if (phase < 45)
    return pose(
      {
        ...pad,
        y: lerp(HOVER_LOW, HOVER_HIGH, ramp(phase, 38, 7)),
        yaw: heading,
        spin: 1,
        propellers: true,
        phase: 'lift',
      },
      0.05,
    );
  if (phase < 49)
    return pose(
      {
        ...pad,
        y: HOVER_HIGH + 0.1 * (1 - Math.cos(((phase - 45) / 4) * Math.PI * 2)),
        yaw: heading,
        spin: 1,
        propellers: true,
        phase: 'hover',
      },
      0.05,
    );
  if (phase < 57) {
    // Accelerates from the hover, so the streak starts at rest.
    const t = phase - 49,
      s = 2.3 * t * t;
    return pose(
      {
        ...routePoint(out, s),
        travel: routeTangent(out, s),
        yaw: heading,
        pitch: 0.1 * ramp(phase, 49, 1.5),
        spin: 1,
        propellers: true,
        // The streak grows once it is moving fast.
        trail: ramp(phase, 50.5, 2),
        opacity: 1 - ramp(phase, 53, 4),
        phase: 'departure',
      },
      0.05 * (1 - ramp(phase, 49, 2)),
    );
  }
  if (phase < 135) return pose({ visible: false, opacity: 0, legs: 0, phase: 'away' });
  if (phase < 147) {
    // Decelerates to a hover above the pad, so the descent starts at rest: back down
    // the Moon route, or straight down from overhead.
    const t = (phase - 135) / 12,
      s = (toMoon ? 170 : 60) * (1 - t) ** 2;
    return pose(
      {
        ...(toMoon ? routePoint(out, s) : { ...pad, y: HOVER_HIGH + s }),
        travel: toMoon ? routeTangent(out, s).map((v) => -v) : DOWN,
        yaw: arrivalYaw,
        spin: 1,
        propellers: true,
        trail: 1 - ramp(phase, 138, 6),
        opacity: ramp(phase, 135, 4),
        phase: 'approach',
      },
      0.03,
    );
  }
  if (phase < 155) {
    const k = ramp(phase, 147, 8);
    return pose(
      {
        ...pad,
        y: lerp(HOVER_HIGH, HOVER_LOW, k),
        yaw: turnTo(arrivalYaw, Math.PI / 2, k),
        spin: 1,
        propellers: true,
        phase: 'descent',
      },
      0.03 + 0.02 * k,
    );
  }
  if (phase < 159) {
    const k = ramp(phase, 155, 4);
    return pose(
      { ...pad, y: HOVER_LOW, spin: 1 - 0.7 * k, propellers: true, phase: 'settle' },
      0.05 - 0.035 * k,
    );
  }
  if (phase < 171)
    return pose(
      {
        x: lerp(pad.x, standX, ramp(phase, 159, 12)),
        y: HOVER_LOW,
        spin: 0.3,
        propellers: true,
        phase: 'taxi-in',
      },
      0.015,
    );
  const k = ramp(phase, 171, 5);
  return pose(
    {
      y: lerp(HOVER_LOW, PARKED_Y, k),
      legs: ramp(phase, 172, 3.5),
      spin: 0.3 * (1 - k),
      propellers: true,
      phase: 'docking',
    },
    0.015 * (1 - k),
  );
}

// Each era's plane keeps its own livery accent; liveries[0] is the authored colour.
function applyLivery(materials, appearance) {
  const accent = appearance.liveryAccent?.replace('#', '');
  const targets = [...materials].filter(([original]) => original.color?.getHexString() === accent);
  return (index) => {
    const color = appearance.liveries?.[index];
    if (color) for (const [, material] of targets) material.color.set(color);
  };
}

const scratch = {
  quaternion: new Quaternion(),
  direction: new Vector3(),
  up: new Vector3(0, 1, 0),
};

export function addAviationActivity(d, town) {
  if (!town.buildings.airport) return null;
  const era = town.buildingEras?.airport;
  const appearance = airportAppearance(era);
  const aircraft = appearance.aircraft ?? 'airplane';
  const rounded = hasRoundedTransport(era);
  const plane = rounded
    ? roundedAircraft(d, d.world, skySaucer(era))
    : aircraft === 'airplane'
      ? futureModel(d, d.world, aircraft)
      : cityModel(d, d.world, aircraft);
  plane.name = rounded
    ? 'Sky saucer'
    : aircraft === 'airplane'
      ? 'Regional passenger plane'
      : 'Passenger jet';
  plane.rotation.order = 'YXZ';
  const size = new Box3().setFromObject(plane).getSize(new Vector3());
  const bay = airportLayout.hangar;
  // All supported aircraft must fit the same authored door and back wall.
  // Local Z becomes the hangar's X axis after the aircraft's quarter turn.
  plane.scale.multiplyScalar(
    Math.min(1, (bay.backX - bay.frontX - 0.5) / size.z, (bay.roofRadius * 2 - 0.5) / size.x),
  );
  const materials = new Map();
  plane.traverse((o) => {
    if (!o.isMesh) return;
    if (!materials.has(o.material)) {
      const material = o.material.clone();
      material.transparent = true;
      material.userData.transient = true;
      materials.set(o.material, material);
    }
    o.material = materials.get(o.material);
  });
  plane.userData.animated = true;
  const propellers = ['propellerLeft', 'propellerRight'].map((name) => plane.getObjectByName(name));
  const legs = plane.getObjectByName('saucerLegs');
  const trail = plane.getObjectByName('saucerTrail');
  // The streak is fainter than the hull. Its cone is drawn on its own in any case, so
  // its own material adds no draw call.
  if (trail) {
    trail.material = trail.material.clone();
    trail.material.depthWrite = false;
  }
  const livery = rounded ? null : applyLivery(materials, appearance);
  const liveries = appearance.liveries?.length || 1;
  // The Moon route is fixed per visit: it is decided while the saucer is parked, so a
  // newly drawn Moon never bends a flight already in the air.
  let visit = null,
    toMoon = false,
    flight = null,
    spin = 0,
    last = null;
  const update = (time) => {
    const elapsed = last === null ? 0 : Math.min(0.25, Math.max(0, time - last));
    last = time;
    let pose;
    if (rounded) {
      const current = Math.floor(time / AIRPORT_FLIGHT_CYCLE);
      if (current !== visit) {
        visit = current;
        toMoon = saucerFliesToMoon(era, d.town ?? town);
      }
      pose = saucerPose(time, { toMoon });
    } else {
      pose = airplanePose(time);
      const current = airplaneFlight(time, liveries);
      if (current.flight !== flight) {
        flight = current.flight;
        livery(current.livery);
      }
    }
    plane.visible = pose.visible;
    d.visitorTransports?.set('airport', { ...airplaneArrival(time), root: plane });
    for (const material of materials.values()) material.opacity = pose.opacity;
    if (trail) trail.material.opacity = pose.opacity * 0.35;
    plane.userData.flightPhase = pose.phase;
    plane.userData.flightToMoon = rounded && toMoon;
    if (!pose.visible) return;
    plane.position.set(pose.x, pose.y, pose.z);
    plane.rotation.set(pose.pitch, pose.yaw, pose.roll);
    if (rounded) {
      // Rim lights speed up and slow down instead of jumping between rates.
      spin += elapsed * pose.spin * 9;
      propellers[0].rotation.z = spin;
      legs.visible = pose.legs > 0.02;
      legs.scale.setScalar(lerp(0.15, 1, pose.legs));
      updateTrail(plane, trail, pose);
    } else
      for (const propeller of propellers.filter(Boolean))
        propeller.rotation.z = pose.propellers ? time * 18 : 0;
  };
  update(0);
  d.motions.push(update);
  return { root: plane, motion: update };
}

// Points the saucer's streak opposite its travel, in the saucer's own (tilted) frame.
function updateTrail(plane, trail, pose) {
  trail.visible = pose.trail > 0.01;
  if (!trail.visible) return;
  const { quaternion, direction, up } = scratch;
  const length = 6 * pose.trail;
  quaternion.setFromEuler(plane.rotation).invert();
  direction
    .set(-pose.travel[0], -pose.travel[1], -pose.travel[2])
    .applyQuaternion(quaternion)
    .normalize();
  trail.quaternion.setFromUnitVectors(up, direction);
  trail.scale.set(0.4, length, 0.4);
  trail.position.copy(direction).multiplyScalar(1.1 + length / 2);
  trail.position.y += 0.95;
}
