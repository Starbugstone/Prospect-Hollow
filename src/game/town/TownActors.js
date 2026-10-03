import { horizonMaterial } from './TownAtmosphere';
import {
  DynamicDrawUsage,
  Frustum,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Sphere,
} from 'three';
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
    this.rootOf = new Map();
    this.radius = new Map();
    this.frustums = [];
    this.material = horizonMaterial(new MeshStandardMaterial({ roughness: 0.88 }));
  }
  // Rebuilt after every construction and life change. Keep each bucket's instanced
  // mesh (and its GPU buffers) while its parts still fit, instead of reallocating all.
  rebuild(roots) {
    this.roots = roots;
    this.rootOf = new Map();
    this.radius = new Map();
    const lists = new Map();
    for (const root of roots) {
      root.updateWorldMatrix(true, true);
      this.radius.set(root, localRadius(root));
      root.traverse((object) => {
        if (!object.isMesh || object.isInstancedMesh) return;
        object.layers.set(1); // The camera draws their instances on layer two.
        this.rootOf.set(object, root);
        const key = `${object.geometry.uuid}:${object.material.isMeshStandardMaterial && !object.material.transparent ? 'colored' : object.material.uuid}`;
        if (!lists.has(key)) lists.set(key, []);
        lists.get(key).push(object);
      });
    }
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
  // only roots outside it, such as a detached staging group, update their own. With
  // `cameras`, roots outside every camera's view are left out of the instances.
  update(scene = null, cameras = null) {
    const started = frameStart();
    const shown = this.shownRoots(scene, cameras);
    for (const { mesh, objects, colored, colors } of this.buckets) {
      let count = 0,
        colorsChanged = false;
      for (const object of objects) {
        const root = this.rootOf.get(object);
        if (!shown.has(root)) continue;
        // A part detached since the last rebuild, such as the hammer and dust of a
        // finished construction, never reaches its root and is no longer drawn.
        let visible = true;
        for (let node = object; node !== root; node = node.parent) {
          if (!node?.visible) {
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
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, count * 16);
      mesh.instanceMatrix.needsUpdate = true;
      if (colorsChanged && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    frameEnd('actors', started);
  }
  // Roots whose whole chain is visible and, with cameras, inside a view frustum.
  shownRoots(scene, cameras) {
    const shown = (this.shown ??= new Set());
    shown.clear();
    const frustums = (cameras ?? []).map((camera, i) => {
      const frustum = (this.frustums[i] ??= new Frustum());
      return frustum.setFromProjectionMatrix(
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      );
    });
    for (const root of this.roots) {
      if (!scene || topOf(root) !== scene) root.updateWorldMatrix(true, true);
      let visible = true;
      for (let node = root; node; node = node.parent)
        if (!node.visible) {
          visible = false;
          break;
        }
      if (!visible) continue;
      if (frustums.length) {
        sphere.center.setFromMatrixPosition(root.matrixWorld);
        sphere.radius = (this.radius.get(root) ?? 0) * root.matrixWorld.getMaxScaleOnAxis();
        if (!frustums.some((frustum) => frustum.intersectsSphere(sphere))) continue;
      }
      shown.add(root);
    }
    return shown;
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
const sphere = new Sphere(),
  part = new Sphere(),
  projection = new Matrix4();
// The radius around a root's origin that holds all its parts, in the root's own
// units, so a root that is currently scaled down (a visitor indoors) still gets the
// sphere of its full size. Swinging limbs get a small margin.
function localRadius(root) {
  let radius = 0;
  const visit = (node, matrix) => {
    for (const child of node.children) {
      const local = new Matrix4().multiplyMatrices(matrix, child.matrix);
      if (child.isMesh && !child.isInstancedMesh) {
        if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
        part.copy(child.geometry.boundingSphere).applyMatrix4(local);
        radius = Math.max(radius, part.center.length() + part.radius);
      }
      visit(child, local);
    }
  };
  visit(root, new Matrix4());
  return radius + 0.3;
}
const sameObjects = (a, b) => a.length === b.length && a.every((object, i) => object === b[i]);
function topOf(object) {
  while (object.parent) object = object.parent;
  return object;
}
