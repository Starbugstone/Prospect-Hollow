import { buildingPaintRole } from '../../data/buildingPaint';
import { validPaint } from '../../data/townPersonalisation';

// Swap material references, never mutate a cached material: painting one house
// must not recolour its neighbours, skin, terrain or the next town visited.
export function paintBuilding(d, root, paint, era) {
  if (!paint || !Object.keys(paint).length) return;
  root.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.material?.color || mesh.material.map || mesh.material.transparent)
      return;
    const role =
      mesh.userData.paintRole ??
      buildingPaintRole(`#${mesh.material.color.getHexString()}`, mesh.name, era);
    if (role) mesh.userData.paintRole = role;
    if (validPaint(paint[role])) mesh.material = d.material(paint[role]);
  });
}
