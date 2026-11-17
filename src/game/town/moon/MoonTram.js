import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { MOON_LOTS, MOON_ROADS } from '../../../data/moonSettlement';
import { tramCar } from '../buildings/moonRising';
import { OUTER_RING_ROVER, ROVER_LENGTH } from './MoonRovers';

// New Hollow's ring tram: once the Ring Tram stop stands, a little tram runs laps of the
// outer ring road and rests at its stop on every lap. It is never late. Its timetable is a
// pure function of the scene clock, it drives the shared vehicle rules (MoonRovers.js), so it
// gives way to people and to the vehicle in front exactly as a rover does, and whatever time
// it loses waiting it makes up at the stop.
const TAU = Math.PI * 2;
const STOP = 'ringTram';
// It shares the outer ring with the depot's rovers, the same way round and on the same lap,
// so on time it never closes on them: it leaves its stop with a rover a quarter lap off
// either side.
const LAP = TAU / OUTER_RING_ROVER.speed;
export const MOON_TRAM = Object.freeze({
  // Seconds a lap takes, rest included, and the rest at the stop.
  lap: LAP,
  rest: 8,
  // Seconds it takes to pull away to full speed, and to come to a stand.
  ease: 4,
  radius: MOON_ROADS.rings.at(-1),
  dir: OUTER_RING_ROVER.dir,
  // One car until the stop's second level, then two coupled cars.
  car: 1.8,
  coupling: 0.1,
  // The cars are drawn a little slimmer than the stop's, so they keep clear of the walkers.
  width: 0.9,
});
const DRIVE = MOON_TRAM.lap - MOON_TRAM.rest;
// Cruising speed in radians a second: a lap of driving, with time to pull away and to stop.
const CRUISE = TAU / (DRIVE - MOON_TRAM.ease);

/** Where the tram rests: on the ring right in front of its stop's platform. */
export const moonTramStopAngle = () => Math.atan2(MOON_LOTS[STOP][1], MOON_LOTS[STOP][0]);
// When it first pulls away, chosen so the outer rovers are a quarter lap off either side.
const DEPART =
  ((((OUTER_RING_ROVER.phase - moonTramStopAngle() - Math.PI / 2) / OUTER_RING_ROVER.speed) % LAP) +
    LAP) %
  LAP;

/** Radians round the ring the tram's timetable has covered `seconds` into a lap. */
function lapTravel(seconds) {
  const { ease } = MOON_TRAM;
  if (seconds < ease) return (CRUISE * seconds * seconds) / (2 * ease);
  if (seconds < DRIVE - ease) return CRUISE * (seconds - ease / 2);
  if (seconds < DRIVE) return TAU - (CRUISE * (DRIVE - seconds) ** 2) / (2 * ease);
  return TAU;
}
/**
 * The tram's timetable from the scene clock: how far round it has gone (`travel`, radians
 * since it first left its stop), and whether it is resting at the stop (`resting`).
 */
export const MOON_TRAM_TIMETABLE = Object.freeze({
  travel(clock) {
    const since = clock - DEPART;
    const laps = Math.floor(since / LAP);
    return laps * TAU + lapTravel(since - laps * LAP);
  },
  resting(clock) {
    const since = clock - DEPART;
    return since - Math.floor(since / LAP) * LAP >= DRIVE;
  },
});

/** How many cars the tram runs: none before its stop is built, then one, then two. */
export const moonTramCars = (levels) =>
  (levels?.[STOP] ?? 0) >= 2 ? 2 : (levels?.[STOP] ?? 0) >= 1 ? 1 : 0;

/** How far the tram's body reaches from its middle, with the rovers' room to spare. */
const moonTramLength = (cars) =>
  (cars * MOON_TRAM.car + (cars - 1) * MOON_TRAM.coupling) / 2 + ROVER_LENGTH - 0.55;

/**
 * The tram as a vehicle for `moonRoverAngle`, with its model in `parent`, or null before its
 * stop is built. Its model faces along local +z, as a rover's does.
 */
export function createMoonTram(d, parent, levels) {
  const cars = moonTramCars(levels);
  if (!cars) return null;
  const root = d.group(parent);
  root.name = 'New Hollow tram';
  // The stop's car runs along x: turned to run along z, slimmed across.
  const body = d.group(root);
  body.rotation.y = Math.PI / 2;
  body.scale.set(1, 1, MOON_TRAM.width);
  const pitch = MOON_TRAM.car + MOON_TRAM.coupling;
  for (let n = 0; n < cars; n++) tramCar(d, body, (n - (cars - 1) / 2) * pitch, 0);
  return {
    root,
    tram: true,
    cars,
    radius: MOON_TRAM.radius,
    dir: MOON_TRAM.dir,
    phase: moonTramStopAngle(),
    speed: CRUISE,
    length: moonTramLength(cars),
    timetable: MOON_TRAM_TIMETABLE,
  };
}

// Rails along the middle of the outer ring, under the tram's wheels, 0.6 apart.
const GAUGE = 0.3,
  RAIL = 0.05;
/** The tram's rails round the outer ring, as one flat mesh; shown once the tram runs. */
export function moonTramRails() {
  const ring = MOON_TRAM.radius;
  const parts = [-GAUGE, GAUGE].map(
    (side) => new THREE.RingGeometry(ring + side - RAIL, ring + side + RAIL, 192),
  );
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  const rails = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: p.deep, roughness: 0.6, metalness: 0.3 }),
  );
  rails.name = 'Tram rails';
  rails.rotation.x = -Math.PI / 2;
  // Just above the road and the ends of the paths that meet it (both lifted 0.04).
  rails.position.y = 0.05;
  rails.receiveShadow = true;
  return rails;
}
