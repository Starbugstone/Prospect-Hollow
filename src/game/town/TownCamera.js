import { PERSONAL_AREAS, areaUnlocked } from '../../data/townPersonalisation';
import * as THREE from 'three';
import { nextGoal } from './TownRules';
import { PLOTS } from './TownLayout';
import { GARDEN_PARCELS } from '../../data/townGardenDistrict';
import { riverCenterX } from './TownRiver';
import { keepCameraAboveTerrain } from './TownLandscape';
import { selectVillager } from './TownLabelProjection';

// Camera placement: framing the whole village (or a newcomer's first few plots on a
// phone), stepped camera controls and jumping to a live visitor.
const point = (x, y, z) => new THREE.Vector3(x, y, z);

// The orbit point stays this high above the ground, so the closest zoom brings
// the street equally near in every era.
export const CAMERA_FOCUS_HEIGHT = 0.7;
export const CAMERA_MIN_DISTANCE = 7;

export function frameTown(d) {
  if (d.eventCamera) return;
  if (!d.anchors?.length) return;
  if (d.town && PERSONAL_AREAS.some((area) => areaUnlocked(d.town, area)))
    d.controls.maxDistance = Math.max(d.controls.maxDistance, 180);
  const bounds = new THREE.Box3();
  const corners = [];
  const intimate =
    d.camera.aspect < 0.8 &&
    d.town?.era === 'frontier' &&
    Object.values(d.town.buildings).filter(Boolean).length < 6;
  const goal = intimate ? nextGoal(d.town)?.id : null;
  const framing = intimate
    ? d.anchors.filter(
        ({ id }) => id === 'mine' || id === goal || d.town.buildings[id] || d.town.projects[id],
      )
    : d.anchors;
  for (const { id } of framing) {
    // Monument site labels are framed with their sites below.
    if (!PLOTS[id]) continue;
    const [x, z] = PLOTS[id];
    if (id === 'airport') {
      for (const dx of [-10, 10])
        for (const dz of [-20, 20]) {
          const corner = point(x + dx, 8, z + dz);
          bounds.expandByPoint(corner);
          corners.push(corner);
        }
    }
    const parcel = GARDEN_PARCELS[id],
      halfWidth = parcel ? parcel.halfWidth + 0.8 : 3,
      halfDepth = parcel ? parcel.halfDepth + 0.8 : 3,
      height = parcel ? 8 : 5;
    bounds.expandByPoint(point(x - halfWidth, 0, z - halfDepth));
    bounds.expandByPoint(point(x + halfWidth, height, z + halfDepth));
    for (const dx of [-halfWidth, halfWidth])
      for (const y of [0, height])
        for (const dz of [-halfDepth, halfDepth]) corners.push(point(x + dx, y, z + dz));
  }
  for (const area of PERSONAL_AREAS) {
    if (!d.town || !areaUnlocked(d.town, area)) continue;
    // Open sites are framed too: their markers invite a monument.
    area.positions.forEach(([x, z]) => {
      for (const dx of [-area.radius, area.radius])
        for (const dz of [-area.radius, area.radius]) {
          const corner = point(x + dx, 14, z + dz);
          bounds.expandByPoint(corner);
          corners.push(corner);
        }
    });
  }
  if (d.town?.personalisation?.crest) {
    const tip = point(-3.5, 13, PLOTS.mine[1] - 5);
    bounds.expandByPoint(tip);
    corners.push(tip);
  }
  // Include a glimpse of the near river from the first visit, without framing future land.
  if (d.town && !d.raid && !intimate) {
    const river = point(riverCenterX(2) + 1, 0, 2);
    bounds.expandByPoint(river);
    corners.push(river);
  }
  const target = bounds.getCenter(new THREE.Vector3());
  const direction = point(0.28, 0.72, 0.64).normalize();
  const right = point(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const vertical = Math.tan(THREE.MathUtils.degToRad(d.camera.fov / 2)) * 0.92;
  const horizontal = vertical * d.camera.aspect;
  let distance = d.controls.minDistance;
  for (const corner of corners) {
    const offset = corner.sub(target),
      depth = offset.dot(direction);
    distance = Math.max(
      distance,
      depth + Math.abs(offset.dot(right)) / horizontal,
      depth + Math.abs(offset.dot(up)) / vertical,
    );
  }
  // Taller garden parcels and the airport lift the framed box's centre off the
  // ground, and zoom stopped short of that floating point. Orbit the ground point
  // on the same sight line instead: the framed view is unchanged.
  const lift = (target.y - CAMERA_FOCUS_HEIGHT) / direction.y;
  target.addScaledVector(direction, -lift);
  d.controls.target.copy(target);
  d.camera.position
    .copy(target)
    .addScaledVector(direction, Math.min(distance + lift, d.controls.maxDistance));
  d.framingTown = true;
  try {
    d.controls.update();
  } finally {
    d.framingTown = false;
  }
}

export function cameraAction(d, action) {
  if (!d.controls.enabled) return;
  d.overview = action === 'reset';
  if (action === 'in') d.controls.dollyIn(1 / 1.18);
  if (action === 'out') d.controls.dollyOut(1 / 1.18);
  if (action === 'left') d.controls.rotateLeft(Math.PI / 8);
  if (action === 'right') d.controls.rotateLeft(-Math.PI / 8);
  if (action === 'up') d.controls.rotateUp(Math.PI / 18);
  if (action === 'down') d.controls.rotateUp(-Math.PI / 18);
  if (action === 'reset') d.frameTown();
}

export function findVisitor(d, id) {
  if (d.raid || d.cinematic || d.presentation || d.eventCamera) return false;
  const actor = d.liveVisitors?.actors.find(
    (entry) => entry.liveId === String(id) && entry.leavingAt === undefined,
  );
  if (!actor?.root.visible || actor.root.parent !== d.world) return false;
  const target = actor.root.position.clone().add(point(0, 1, 0));
  const offset = d.camera.position.clone().sub(d.controls.target).normalize().multiplyScalar(16);
  d.controls.target.copy(target);
  d.camera.position.copy(target).add(offset);
  keepCameraAboveTerrain(d.camera.position, target);
  d.overview = false;
  d.controls.update();
  selectVillager(d, actor, false);
  d.render();
  return true;
}

export function focusTownPlace(d, id) {
  if (d.raid || d.cinematic || d.presentation || d.eventCamera || !d.controls.enabled) return false;
  const area = PERSONAL_AREAS.find((a) => a.id === id);
  const position = PLOTS[id] ?? area?.positions[0];
  if (!position) return false;
  const target = point(position[0], 2, position[1]);
  const distance = area ? 32 : 19;
  const offset = d.camera.position
    .clone()
    .sub(d.controls.target)
    .normalize()
    .multiplyScalar(distance);
  d.controls.target.copy(target);
  d.camera.position.copy(target).add(offset);
  keepCameraAboveTerrain(d.camera.position, target);
  d.overview = false;
  d.controls.update();
  d.render();
  return true;
}
