import { Vector3 } from 'three';
import { PLOTS } from './TownLayout';
import { keepCameraAboveTerrain } from './TownLandscape';

const direction = new Vector3(0.28, 0.72, 0.64).normalize();
const smooth = (t) => t * t * (3 - 2 * t);
export function beginEventCamera(d) {
  d.eventCamera = {
    position: d.camera.position.clone(),
    target: d.controls.target.clone(),
    overview: d.overview,
    started: d.elapsed,
    previous: d.elapsed,
    focus: new Vector3(),
    destination: new Vector3(),
    lastPosition: d.camera.position.clone(),
    lastTarget: d.controls.target.clone(),
  };
  d.controls.enabled = false;
}
export function restoreEventCamera(d) {
  if (!d.eventCamera || d.eventCamera.returning) return;
  if (d.motionEnabled === false) {
    d.camera.position.copy(d.eventCamera.position);
    d.controls.target.copy(d.eventCamera.target);
    d.overview = d.eventCamera.overview;
    d.eventCamera = null;
    d.controls.enabled = !d.paused && !d.cinematic;
    d.camera.lookAt(d.controls.target);
    d.frameCache.valid = false;
    return;
  }
  Object.assign(d.eventCamera, {
    returning: true,
    started: d.elapsed,
    fromPosition: d.camera.position.clone(),
    fromTarget: d.controls.target.clone(),
  });
}
export function updateEventCamera(d) {
  const shot = d.eventCamera;
  if (!shot) return;
  const elapsed = d.elapsed - shot.started;
  if (shot.returning) {
    const t = smooth(Math.min(1, elapsed / 1.2));
    d.camera.position.lerpVectors(shot.fromPosition, shot.position, t);
    d.controls.target.lerpVectors(shot.fromTarget, shot.target, t);
    if (t === 1) {
      d.overview = shot.overview;
      d.controls.enabled = !d.paused && !d.cinematic;
      d.eventCamera = null;
    }
  } else if (d.raid) {
    const targetId = d.raid.target ?? d.raid.event.targets?.[0] ?? 'mine';
    const [x, z] = PLOTS[targetId] ?? PLOTS.mine;
    const focus = shot.focus.set(x, 1.5, z + 1.5);
    // Track the response as it approaches, then hold on the actual incident.
    const vehicle = d.raid.vehicle?.root;
    if (vehicle?.visible && elapsed < 8)
      focus.lerp(vehicle.position, Math.max(0, 1 - focus.distanceTo(vehicle.position) / 35) * 0.4);
    const distance = d.camera.aspect < 0.8 ? 34 : 23;
    if (!shot.checkedFocus?.equals(focus) || shot.distance !== distance) {
      shot.destination.copy(focus).addScaledVector(direction, distance);
      keepCameraAboveTerrain(shot.destination, focus);
      (shot.checkedFocus ??= new Vector3()).copy(focus);
      shot.distance = distance;
    }
    const position = shot.destination;
    if (elapsed < 1.4) {
      const t = smooth(Math.min(1, elapsed / 1.4));
      d.camera.position.lerpVectors(shot.position, position, t);
      d.controls.target.lerpVectors(shot.target, focus, t);
    } else {
      const alpha = 1 - Math.exp(-3 * Math.max(0, d.elapsed - shot.previous));
      d.camera.position.lerp(position, alpha);
      d.controls.target.lerp(focus, alpha);
      // Finish the approach exactly so a held shot can reuse cached scenery.
      if (d.camera.position.distanceToSquared(position) < 1e-6) d.camera.position.copy(position);
      if (d.controls.target.distanceToSquared(focus) < 1e-6) d.controls.target.copy(focus);
    }
  }
  shot.previous = d.elapsed;
  if (!shot.lastPosition.equals(d.camera.position) || !shot.lastTarget.equals(d.controls.target)) {
    d.camera.lookAt(d.controls.target);
    d.frameCache.valid = false;
    shot.lastPosition.copy(d.camera.position);
    shot.lastTarget.copy(d.controls.target);
  }
}
