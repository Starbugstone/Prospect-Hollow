import { horizonMaterial } from './TownAtmosphere';
import { Group, InstancedMesh, MeshStandardMaterial, DynamicDrawUsage } from 'three';
import { frameEnd, frameStart } from './TownProfiler';

// Keep articulated joints in the scene graph, but draw matching parts together.
// This lets a busy town share one draw call for all matching boots, hats or limbs.
export class TownActors {
  constructor(scene) {
    this.group = new Group();
    this.group.name = 'Instanced townspeople';
    scene.add(this.group);
    this.buckets = [];
    this.roots = [];
    this.material = horizonMaterial(new MeshStandardMaterial({ roughness: 0.88 }));
  }
  // Rebuilt after every construction and life change. Keep each bucket's instanced
  // mesh (and its GPU buffers) while its parts still fit, instead of reallocating all.
  rebuild(roots) {
    this.roots = roots;
    const lists = new Map();
    for (const root of roots)
      root.traverse((object) => {
        if (!object.isMesh || object.isInstancedMesh) return;
        object.layers.set(1); // The camera draws their instances on layer two.
        const key = `${object.geometry.uuid}:${object.material.isMeshStandardMaterial && !object.material.transparent ? 'colored' : object.material.uuid}`;
        if (!lists.has(key)) lists.set(key, []);
        lists.get(key).push(object);
      });
    const previous = new Map(this.buckets.map((bucket) => [bucket.key, bucket]));
    this.buckets = [];
    for (const [key, objects] of lists) {
      let bucket = previous.get(key);
      previous.delete(key);
      if (bucket && bucket.capacity >= objects.length) {
        if (!sameObjects(bucket.objects, objects)) {
          bucket.objects = objects;
          // Unknown colors force every instance color to be written again.
          bucket.colors = new Float64Array(bucket.capacity * 3).fill(NaN);
        }
      } else {
        if (bucket) release(bucket);
        bucket = this.bucket(key, objects);
      }
      this.buckets.push(bucket);
    }
    previous.forEach(release);
    this.update();
  }
  bucket(key, objects) {
    const first = objects[0];
    const colored = first.material.isMeshStandardMaterial && !first.material.transparent;
    // Headroom lets a growing crowd or construction reuse the buffers next time.
    const capacity = Math.ceil(objects.length * 1.25) + 2;
    const mesh = new InstancedMesh(
      first.geometry,
      colored ? this.material : horizonMaterial(first.material),
      capacity,
    );
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.layers.set(2); // Animated foreground, over the cached town color/depth.
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return {
      key,
      mesh,
      objects,
      colored,
      capacity,
      colors: new Float64Array(capacity * 3).fill(NaN),
    };
  }
  // `scene` has just updated its world matrices this frame (see TownDiorama.drawFrame);
  // only roots outside it, such as a detached staging group, update their own.
  update(scene = null) {
    const started = frameStart();
    for (const root of this.roots)
      if (!scene || topOf(root) !== scene) root.updateWorldMatrix(true, true);
    for (const { mesh, objects, colored, colors } of this.buckets) {
      let count = 0,
        colorsChanged = false;
      for (const object of objects) {
        let visible = true;
        for (let ancestor = object; ancestor; ancestor = ancestor.parent) {
          if (!ancestor.visible) {
            visible = false;
            break;
          }
        }
        if (visible) {
          mesh.setMatrixAt(count, object.matrixWorld);
          if (colored) {
            const color = object.material.color;
            const offset = count * 3;
            if (
              colors[offset] !== color.r ||
              colors[offset + 1] !== color.g ||
              colors[offset + 2] !== color.b
            ) {
              mesh.setColorAt(count, color);
              colors[offset] = color.r;
              colors[offset + 1] = color.g;
              colors[offset + 2] = color.b;
              colorsChanged = true;
            }
          }
          count++;
        }
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (colorsChanged && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    frameEnd('actors', started);
  }
  clear() {
    this.buckets.forEach(release);
    this.buckets = [];
    this.roots = [];
  }
  dispose() {
    this.clear();
    this.group.removeFromParent();
    this.material.dispose();
  }
}
function release({ mesh }) {
  mesh.removeFromParent();
  mesh.dispose();
}
const sameObjects = (a, b) => a.length === b.length && a.every((object, i) => object === b[i]);
function topOf(object) {
  while (object.parent) object = object.parent;
  return object;
}
