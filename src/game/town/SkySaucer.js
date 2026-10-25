import { roundedAircraft } from './RoundedTransports';
import { createSaucerTrail } from './SaucerTrails';
import { saucerTrailColors, skySaucer } from '../../data/skyCraft';

/**
 * Gives `root` its own transparent copy of each material, so an aircraft fades in and
 * out of sight without fading the shared palette. Returns the copies, keyed by the
 * shared originals; they are the aircraft's to dispose (`transient`).
 */
export function fadingMaterials(root) {
  const materials = new Map();
  root.traverse((object) => {
    if (!object.isMesh) return;
    if (!materials.has(object.material)) {
      const material = object.material.clone();
      material.transparent = true;
      material.userData.transient = true;
      materials.set(object.material, material);
    }
    object.material = materials.get(object.material);
  });
  return materials;
}

/** Shared craft, paint, folding legs and wake for valley and Moon flights.
 * The caller owns its clock/path; disposal releases only this craft's resources. */
export function createSkySaucer(d, parent, { era, path, scale = 1, departure, approach, camera }) {
  const palette = skySaucer(era);
  const root = roundedAircraft(d, parent, palette);
  root.name = 'Sky saucer';
  root.rotation.order = 'YXZ';
  root.scale.setScalar(scale);
  root.userData.animated = true;
  const materials = fadingMaterials(root);
  const legs = root.getObjectByName('saucerLegs');
  const lights = root.getObjectByName('propellerLeft');
  const trail = createSaucerTrail(d, root, {
    colors: saucerTrailColors(palette),
    path,
    scale,
    departure,
    approach,
    camera,
  });
  return {
    root,
    apply(pose, { spin = 0, phase = 0, toMoon = false, reduced = false } = {}) {
      root.visible = pose.visible;
      root.userData.flightPhase = pose.phase;
      root.userData.flightToMoon = toMoon;
      for (const material of materials.values()) material.opacity = pose.opacity;
      if (!pose.visible) {
        trail.mesh.visible = false;
        return;
      }
      root.position.set(pose.x, pose.y, pose.z);
      root.rotation.set(pose.pitch ?? 0, pose.yaw ?? 0, pose.roll ?? 0);
      lights.rotation.z = spin;
      legs.visible = pose.legs > 0.02;
      legs.scale.setScalar(0.15 + 0.85 * pose.legs);
      trail.update(phase, toMoon, reduced);
    },
    dispose() {
      d.clearGroup(root);
    },
  };
}
