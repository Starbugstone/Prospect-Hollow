import { eventInsetRect, hideEventInset, drawCameraInset } from './TownInset';
export { eventInsetRect } from './TownInset';
import { PerspectiveCamera, Vector3, Vector4 } from 'three';
import { eventKind } from '../../data/townEvents';
import { PLOTS } from './TownLayout';
import { keepCameraAboveTerrain } from './TownLandscape';

const direction = new Vector3(0.28, 0.72, 0.64).normalize();
const smooth = (t) => t * t * (3 - 2 * t);
// Content selects subjects; framing, rendering and cleanup stay shared across eras.
export const INCIDENT_SHOTS = {
  bandits: { main: 'bandits', inset: 'patrol', label: 'Sheriff patrol' },
  'cargo-theft': { main: 'thieves', inset: 'responders', label: 'Town patrol' },
  'workshop-fire': { main: 'responders', inset: 'site', label: 'Workshop fire' },
  'storm-cleanup': { main: 'responders', inset: 'site', label: 'Storm cleanup' },
};
function subjectFrame(raid, subject, frame, aspect, minimum, followLeader = false) {
  const targetId = raid.target ?? raid.event.targets?.[0] ?? 'mine';
  const [x, z] = PLOTS[targetId] ?? PLOTS.mine;
  frame.focus.set(x, 1.5, z + 1.5);
  if (subject === 'site' && raid.props) frame.focus.copy(raid.props.position).y += 0.8;
  const actors = subject === 'responders' ? raid.crew : raid[subject];
  frame.min.set(Infinity, Infinity, Infinity);
  frame.max.set(-Infinity, -Infinity, -Infinity);
  let count = 0;
  const include = (root) => {
    if (!root?.visible) return;
    // A small window follows the leading responder; distant reinforcements must
    // not zoom it out to a whole-town overview during staggered departures.
    if (followLeader && count && root.position.distanceTo(frame.leader) > 3.5) return;
    if (!count) frame.leader.copy(root.position);
    frame.min.min(root.position);
    frame.max.max(root.position);
    count++;
  };
  actors?.forEach((actor) => include(actor.root));
  if (subject === 'responders') {
    include(raid.vehicle?.root);
    if (raid.props && raid.vehicle?.root?.position.distanceTo(raid.props.position) < 12)
      include(raid.props);
  }
  if (count) frame.focus.addVectors(frame.min, frame.max).multiplyScalar(0.5).y += 1.2;
  else if (subject === 'patrol' && raid.patrol?.length) {
    const station = PLOTS.sheriff;
    frame.focus.set(station[0], 1.5, station[1] + 2);
  }
  // Fit the entire squad, including split escape/escort routes and narrow screens.
  const radius = count ? frame.min.distanceTo(frame.max) / 2 + 2.2 : subject === 'site' ? 2 : 3.5;
  const halfFov = Math.atan(Math.tan((20 * Math.PI) / 180) * Math.min(1, aspect));
  frame.distance = Math.max(minimum, (radius / Math.sin(halfFov)) * 1.15);
}
const framing = () => ({
  focus: new Vector3(),
  min: new Vector3(),
  max: new Vector3(),
  leader: new Vector3(),
});
// Draw both layers with an independent camera into a small scissored window.
// The main view's scenery cache and depth attachments are never reused here.
export function renderEventInset(d) {
  const shot = d.eventCamera;
  const definition = INCIDENT_SHOTS[eventKind(d.raid?.event)];
  if (
    !shot ||
    shot.returning ||
    !d.raid ||
    !definition ||
    (d.motionEnabled === false && !d.paused)
  ) {
    if (!d.vipArrivals?.render()) hideEventInset(d);
    return;
  }
  const rect = eventInsetRect(d.canvas.clientWidth, d.canvas.clientHeight);
  if (!rect.width || !rect.height) return;
  const camera = shot.insetCamera;
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  subjectFrame(d.raid, definition.inset, shot.insetFrame, camera.aspect, 9, true);
  camera.position.copy(shot.insetFrame.focus).addScaledVector(direction, shot.insetFrame.distance);
  keepCameraAboveTerrain(camera.position, shot.insetFrame.focus);
  camera.lookAt(shot.insetFrame.focus);
  if (shot.mainFrame.focus.distanceTo(shot.insetFrame.focus) < 7) {
    hideEventInset(d);
    return;
  }

  const label =
    definition.inset === 'patrol' && !d.raid.patrol?.length ? 'Incident site' : definition.label;
  drawCameraInset(d, shot, rect, label);
}
export function beginEventCamera(d) {
  const insetCamera = new PerspectiveCamera(40, 1.5, 0.1, 400);
  insetCamera.layers.enable(2);
  d.eventCamera = {
    insetCamera,
    mainFrame: framing(),
    insetFrame: framing(),
    viewport: new Vector4(),
    scissor: new Vector4(),
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
  if (d.upgradeGlow?.root) d.upgradeGlow.root.visible = false;
}
export function restoreEventCamera(d) {
  hideEventInset(d);
  if (d.upgradeGlow?.root) d.upgradeGlow.root.visible = true;
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
  if (!shot) return false;
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
    const definition = INCIDENT_SHOTS[eventKind(d.raid.event)];
    subjectFrame(
      d.raid,
      definition?.main ?? 'site',
      shot.mainFrame,
      d.camera.aspect,
      definition?.main === 'responders' || definition?.main === 'thieves' ? 17 : 23,
    );
    const focus = shot.focus.copy(shot.mainFrame.focus);
    const distance = shot.mainFrame.distance;
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
    return true;
  }
  return false;
}
