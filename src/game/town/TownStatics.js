import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Render opaque scenery together with vertex colors. Keep the original plot meshes
// on the picking layer, so a draw-call reduction never changes which building is hit.
export class TownStatics {
  constructor(scene) {
    this.scene = scene;
    this.meshes = [];
    this.batches = new Map();
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  }
  rebuild(roots) {
    this.clear();
    this.add(roots);
  }
  // Roots are immutable prepared models at fixed world transforms. A changed
  // plot/scenery root gets a new identity; retain every other GPU buffer.
  sync(roots) {
    const tracked = new Set(this.batches.values());
    if (this.meshes.some((mesh) => !tracked.has(mesh))) this.clear();
    const retained = new Set(roots);
    for (const [root, mesh] of this.batches) {
      if (retained.has(root)) continue;
      if (mesh) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        this.meshes.splice(this.meshes.indexOf(mesh), 1);
      }
      this.batches.delete(root);
    }
    for (const root of roots) if (!this.batches.has(root)) this.batches.set(root, this.add([root]));
    for (const [root, mesh] of this.batches) if (mesh) mesh.visible = root.visible;
    this.mesh = this.meshes.at(-1) ?? null;
  }
  add(roots) {
    const geometries = [];
    for (const root of roots) {
      root.updateWorldMatrix(true, true);
      root.traverse((object) => {
        if (
          !object.isMesh ||
          !object.material.isMeshStandardMaterial ||
          object.material.map ||
          object.material.transparent
        )
          return;
        const geometry = object.geometry.clone();
        geometry.applyMatrix4(object.matrixWorld);
        geometry.deleteAttribute('uv');
        const oldColors = geometry.getAttribute('color');
        const colors = new Float32Array(geometry.getAttribute('position').count * 3),
          color = object.material.color;
        for (let i = 0; i < colors.length / 3; i++) {
          colors[i * 3] = color.r * (oldColors?.getX(i) ?? 1);
          colors[i * 3 + 1] = color.g * (oldColors?.getY(i) ?? 1);
          colors[i * 3 + 2] = color.b * (oldColors?.getZ(i) ?? 1);
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        if (geometry.index) geometries.push(geometry);
        else {
          geometries.push(mergeVertices(geometry));
          geometry.dispose();
        }
        object.layers.set(1);
      });
    }
    if (!geometries.length) return;
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    this.mesh = new THREE.Mesh(merged, this.material);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
    this.meshes.push(this.mesh);
    return this.mesh;
  }
  clear() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    this.meshes = [];
    this.batches.clear();
    this.mesh = null;
  }
  dispose() {
    this.clear();
    this.material.dispose();
  }
}
