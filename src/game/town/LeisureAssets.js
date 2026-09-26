import { BufferGeometry, Float32BufferAttribute, Mesh } from 'three';
import { resolveModel } from './assets/MeshCatalog';

// Authored in Blender. Geometry belongs to the diorama's existing cache and is
// released with it; actors keep named pivots, while buildings use normal batching.
export const leisureModel = (d, parent, name) => blenderModel(d, parent, null, name, 'leisure');

export function blenderModel(d, parent, catalog, name, namespace) {
  const resolved = resolveModel(namespace, name);
  const parts = catalog?.models?.[name] ?? resolved.model;
  const footprints = catalog?.footprints?.[name] ?? resolved.footprints;
  const root = d.group(parent);
  root.name = `Blender ${name}`;
  if (!parts) {
    root.userData.substitute = true;
    d.box(root, 1.2, 0.8, 1.2, 0, 0.4, 0, '#9b967f');
    return root;
  }
  const joints = new Map();
  for (const [index, part] of parts.entries()) {
    const key = `${namespace}:${name}:${index}`;
    if (!d.geometries[key]) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(part.positions, 3));
      geometry.setAttribute('normal', new Float32BufferAttribute(part.normals, 3));
      geometry.setAttribute(
        'uv',
        new Float32BufferAttribute(new Float32Array((part.positions.length / 3) * 2), 2),
      );
      geometry.setIndex(part.indices);
      d.geometries[key] = geometry;
    }
    if (!joints.has(part.joint)) {
      const joint = d.group(root, ...part.pivot);
      joint.name = part.joint;
      const physical = footprints?.filter((f) => f.joint === part.joint);
      if (physical?.length)
        joint.userData.exportFootprints = physical.map((f) => ({
          min: [f.rect[0] - part.pivot[0], f.yMin - part.pivot[1], f.rect[1] - part.pivot[2]],
          max: [f.rect[2] - part.pivot[0], f.yMax - part.pivot[1], f.rect[3] - part.pivot[2]],
        }));
      joints.set(part.joint, joint);
    }
    const mesh = new Mesh(d.geometries[key], d.material(part.color));
    mesh.name = part.name;
    mesh.castShadow = mesh.receiveShadow = true;
    joints.get(part.joint).add(mesh);
  }
  return root;
}

export function renderLeisureBuilding(d, parent, kind, label, level, heritage = false) {
  if (!['horseField', 'park'].includes(kind)) return false;
  if (
    resolveModel('leisure', `${kind === 'horseField' ? 'field' : 'park'}${heritage ? 3 : level}`)
      .status !== 'ready'
  )
    return false;
  leisureModel(d, parent, `${kind === 'horseField' ? 'field' : 'park'}${heritage ? 3 : level}`);
  if (heritage) leisureModel(d, parent, `heritage${level}`);
  d.sign(parent, label, 2.7, 0, 1.15, 2.78);
  return true;
}
