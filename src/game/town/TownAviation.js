import { airportAppearance } from '../../data/airport';
import { futureModel, cityModel } from './buildings/city';
import { AIRPORT } from './TownLayout';
import airportLayout from '../../data/airportLayout.json';

// One aircraft owns the whole sequence. Arrivals and departures cannot overlap;
// town rebuilds sample the same clock instead of starting another flight.
export const AIRPORT_FLIGHT_CYCLE = 240;
const DOCK_AT = 176;
export function airplaneArrival(time) {
  const phase = ((time % AIRPORT_FLIGHT_CYCLE) + AIRPORT_FLIGHT_CYCLE) % AIRPORT_FLIGHT_CYCLE;
  return {
    arrived: phase >= DOCK_AT,
    sinceArrival: phase - DOCK_AT,
    visit: Math.floor(time / AIRPORT_FLIGHT_CYCLE),
  };
}
// Passengers arrive on the apron, visibly outside the maintenance hangar.
const standX = AIRPORT.center[0] + airportLayout.passengerStand.x;
const taxiZ = AIRPORT.center[1] + airportLayout.passengerStand.z;
const startZ = AIRPORT.startZ + 2;
const touchdownZ = AIRPORT.startZ + 7;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

export function airplanePose(time) {
  const phase = ((time % AIRPORT_FLIGHT_CYCLE) + AIRPORT_FLIGHT_CYCLE) % AIRPORT_FLIGHT_CYCLE;
  const pose = {
    x: standX,
    z: taxiZ,
    y: 0.2,
    yaw: Math.PI / 2,
    pitch: 0,
    visible: true,
    opacity: 1,
    propellers: false,
    phase: 'parked',
  };
  if (phase < 18 || phase >= DOCK_AT) return pose;
  if (phase < 28)
    return {
      ...pose,
      x: lerp(standX, AIRPORT.runwayX, smooth((phase - 18) / 10)),
      phase: 'pushback',
    };
  if (phase < 32)
    return {
      ...pose,
      x: AIRPORT.runwayX,
      yaw: lerp(Math.PI / 2, Math.PI, smooth((phase - 28) / 4)),
      propellers: true,
      phase: 'taxi-out',
    };
  if (phase < 44)
    return {
      ...pose,
      x: AIRPORT.runwayX,
      z: lerp(taxiZ, startZ, smooth((phase - 32) / 12)),
      yaw: Math.PI,
      propellers: true,
      phase: 'taxi-out',
    };
  if (phase < 48)
    return {
      ...pose,
      x: AIRPORT.runwayX,
      z: startZ,
      yaw: lerp(Math.PI, Math.PI * 2, smooth((phase - 44) / 4)),
      propellers: true,
      phase: 'line-up',
    };
  if (phase < 70) {
    const t = phase - 48;
    const distance = Math.min(t, 10) ** 2 * 0.35 + Math.max(0, t - 10) * 7;
    return {
      ...pose,
      x: AIRPORT.runwayX,
      z: startZ + distance,
      y: 0.2 + Math.max(0, distance - 22) * 0.38,
      yaw: 0,
      pitch: -Math.min(0.16, Math.max(0, distance - 18) * 0.016),
      propellers: true,
      phase: 'takeoff',
      opacity: 1 - smooth(Math.max(0, Math.min(1, (phase - 62) / 8))),
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
      pitch: 0.045 * (1 - smooth(approach)),
      propellers: true,
      phase: 'landing',
      opacity: smooth(Math.min(1, (phase - 135) / 6)),
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
      yaw: (Math.PI / 2) * smooth((phase - 160) / 4),
      propellers: true,
      phase: 'taxi-in',
    };
  return {
    ...pose,
    x: lerp(AIRPORT.runwayX, standX, smooth((phase - 164) / 12)),
    propellers: true,
    phase: 'taxi-in',
  };
}

export function addAviationActivity(d, town) {
  if (!town.buildings.airport) return;
  const aircraft = airportAppearance(town.buildingEras?.airport).aircraft ?? 'airplane';
  const plane =
    aircraft === 'airplane' ? futureModel(d, d.world, aircraft) : cityModel(d, d.world, aircraft);
  plane.name = aircraft === 'airplane' ? 'Regional passenger plane' : 'Passenger jet';
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
  const update = (time) => {
    const pose = airplanePose(time);
    plane.visible = pose.visible;
    d.visitorTransports?.set('airport', { ...airplaneArrival(time), root: plane });
    for (const material of materials.values()) material.opacity = pose.opacity;
    plane.userData.flightPhase = pose.phase;
    if (!pose.visible) return;
    plane.position.set(pose.x, pose.y, pose.z);
    plane.rotation.set(pose.pitch, pose.yaw, 0);
    for (const propeller of propellers.filter(Boolean))
      propeller.rotation.z = pose.propellers ? time * 18 : 0;
  };
  update(0);
  d.motions.push(update);
}
