import { Box3, Vector3 } from 'three';
import { GARDEN_PARCELS, PARCEL_CLEARINGS } from '../../data/townGardenDistrict';
import { AIRPORT, PLOTS } from './TownLayout';

const SUN_OFFSET = new Vector3(-24, 38, 18);
const ORIGINAL_CAMERA = { left: -31, right: 31, top: 35, bottom: -35, near: 1, far: 95 };
const SHADOW_MARGIN = 4;

// Fit once per set of visible clearings to reserved land, rather than to changing
// meshes or the moving camera. Include the existing mine hillside and airport
// alongside the original town lots.
function gardenCoverage(clearings) {
  const bounds = new Box3();
  for (const [id, [x, z]] of Object.entries(PLOTS)) {
    if (GARDEN_PARCELS[id]) continue;
    const halfWidth = id === 'airport' ? AIRPORT.halfWidth : 3.8;
    const halfDepth = id === 'airport' ? AIRPORT.halfDepth : id === 'mine' ? 15 : 3.8;
    bounds.expandByPoint(new Vector3(x - halfWidth, -3, z - halfDepth));
    bounds.expandByPoint(new Vector3(x + halfWidth, 20, z + halfDepth));
  }
  for (const { minX, maxX, minZ, maxZ } of clearings) {
    bounds.expandByPoint(new Vector3(minX, 0, minZ));
    bounds.expandByPoint(new Vector3(maxX, 8, maxZ));
  }
  const target = bounds.getCenter(new Vector3());
  const direction = SUN_OFFSET.clone().normalize();
  const right = new Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const projected = new Box3();
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const offset = new Vector3(x, y, z).sub(target);
        projected.expandByPoint(
          new Vector3(offset.dot(right), offset.dot(up), offset.dot(direction)),
        );
      }
  // Directional lighting is unchanged by distance. Keep every caster in front
  // of the shadow camera while retaining the original sun direction exactly.
  const distance = Math.max(SUN_OFFSET.length(), projected.max.z + SHADOW_MARGIN + 1);
  return {
    target,
    position: target.clone().addScaledVector(direction, distance),
    camera: {
      left: projected.min.x - SHADOW_MARGIN,
      right: projected.max.x + SHADOW_MARGIN,
      bottom: projected.min.y - SHADOW_MARGIN,
      top: projected.max.y + SHADOW_MARGIN,
      near: Math.max(1, distance - projected.max.z - SHADOW_MARGIN),
      far: distance - projected.min.z + SHADOW_MARGIN,
    },
  };
}
const coverages = new Map();
const inClearing = ([x, z], { minX, maxX, minZ, maxZ }) =>
  x >= minX && x <= maxX && z >= minZ && z <= maxZ;
// The clearings holding a visible parcel; the garden clearing always comes first.
function visibleClearings(plots) {
  const parcels = plots.filter(({ id }) => GARDEN_PARCELS[id]);
  if (!parcels.length) return null;
  return PARCEL_CLEARINGS.filter(
    (clearing, index) =>
      !index || parcels.some(({ id }) => inClearing(GARDEN_PARCELS[id].position, clearing)),
  );
}

export function updateTownShadowCoverage(view, plots) {
  if (!view.sun) return false;
  const clearings = visibleClearings(plots);
  const expanded = clearings ? clearings.map((c) => PARCEL_CLEARINGS.indexOf(c)).join() : false;
  if (view.shadowCoverageExpanded === expanded) return false;
  if (expanded !== false && !coverages.has(expanded))
    coverages.set(expanded, gardenCoverage(clearings));
  const coverage = expanded === false ? null : coverages.get(expanded);
  const { sun } = view;
  sun.position.copy(coverage ? coverage.position : SUN_OFFSET);
  sun.target.position.copy(coverage ? coverage.target : new Vector3());
  if (coverage && sun.target.parent !== view.scene) view.scene.add(sun.target);
  sun.target.updateMatrixWorld(true);
  sun.updateMatrixWorld(true);
  Object.assign(sun.shadow.camera, coverage ? coverage.camera : ORIGINAL_CAMERA);
  sun.shadow.camera.updateProjectionMatrix();
  view.renderer.shadowMap.needsUpdate = true;
  view.shadowCoverageExpanded = expanded;
  return true;
}
