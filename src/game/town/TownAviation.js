import { futureModel } from './buildings/city';
import { AIRPORT } from './TownLayout';

// Southbound, perpendicular to the railway. The aircraft becomes airborne over
// the graded western plain; it never taxis across the railway or town parcels.
export function airplanePose(time) {
  const phase = time % 62;
  if (phase < 12) return { z: AIRPORT.startZ + 2, y: 0.2, pitch: 0, visible: true };
  const t = phase - 12;
  const distance = Math.min(t, 10) ** 2 * 0.35 + Math.max(0, t - 10) * 7;
  return {
    z: AIRPORT.startZ + 2 + distance,
    y: 0.2 + Math.max(0, distance - 22) * 0.38,
    pitch: -Math.min(0.16, Math.max(0, distance - 18) * 0.016),
    visible: phase < 36,
  };
}
export function addAviationActivity(d, town) {
  if (!town.buildings.airport) return;
  const plane = futureModel(d, d.world, 'airplane');
  plane.name = 'Regional passenger plane';
  plane.userData.animated = true;
  const propellers = ['propellerLeft', 'propellerRight'].map((name) => plane.getObjectByName(name));
  const update = (time) => {
    const pose = airplanePose(time);
    plane.visible = pose.visible;
    if (!pose.visible) return;
    plane.position.set(AIRPORT.runwayX, pose.y, pose.z);
    plane.rotation.x = pose.pitch;
    for (const propeller of propellers) propeller.rotation.z = time * 18;
  };
  update(0);
  d.motions.push(update);
}
