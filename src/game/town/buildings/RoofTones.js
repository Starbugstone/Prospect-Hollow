import { eraEvolution } from '../../../data/eras';
import { roofTone } from '../../../data/roofTones';

const hex = (color) => `#${color.getHexString()}`;
/**
 * Repaints a finished plot's roof in the tone of its purpose (data/roofTones.js). Only
 * colours change: the geometry, footprint, sign mount and setbacks are the renderer's.
 * `era` is the era whose finish the building wears.
 */
export function toneRoof(d, group, id, kind, era) {
  const tone = roofTone(eraEvolution(era), id, kind);
  if (!tone) return null;
  const paint = d.material(tone.to);
  group.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.material?.isMeshStandardMaterial || mesh.material.map) return;
    if (mesh.material !== paint && tone.from.includes(hex(mesh.material.color)))
      mesh.material = paint;
  });
  group.userData.roofTone = tone;
  return tone;
}
