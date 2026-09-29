import { horizonMaterial } from './TownAtmosphere';
import { finishWork } from '../PresentationWork';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Render opaque scenery together with vertex colors. Keep the original plot meshes
// on the picking layer, so a draw-call reduction never changes which building is hit.
export class TownStatics {
  constructor(scene) {
    this.scene = scene;
    this.meshes = [];
    this.batches = new Map();
    // Prepared geometry per child of a `staticContainer` root (service drops), so a
    // replaced container re-merges retained children without cloning them again.
    this.pieces = new Map();
    this.material = horizonMaterial(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }),
    );
  }
  rebuild(roots) {
    this.clear();
    this.add(roots);
  }
  // Roots are immutable prepared models at fixed world transforms. A changed
  // plot/scenery root gets a new identity; retain every other GPU buffer.
  sync(roots) {
    finishWork(this.syncWork(roots));
  }
  // Prepare missing batches one source mesh per step; commit them in one step, so an
  // interrupted frame never shows a root hidden from the cache without its batch.
  *syncWork(roots) {
    const prepared = new Map();
    try {
      for (const root of roots)
        if (!this.batches.has(root)) prepared.set(root, yield* this.prepare([root]));
      this.commit(roots, prepared);
    } finally {
      for (const { geometry } of prepared.values()) geometry?.dispose();
    }
  }
  commit(roots, prepared) {
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
    for (const root of roots) {
      if (this.batches.has(root)) continue;
      const batch = prepared.get(root) ?? this.run(this.prepare([root]));
      prepared.delete(root);
      this.batches.set(root, this.place(batch));
    }
    for (const [root, mesh] of this.batches) if (mesh) mesh.visible = root.visible;
    this.mesh = this.meshes.at(-1) ?? null;
    this.prunePieces();
  }
  prunePieces() {
    const live = new Set();
    for (const root of this.batches.keys())
      if (root.userData.staticContainer) root.children.forEach((child) => live.add(child));
    for (const [child, piece] of this.pieces)
      if (!live.has(child)) {
        piece.geometry?.dispose();
        this.pieces.delete(child);
      }
  }
  add(roots) {
    return this.place(this.run(this.prepare(roots)));
  }
  run(work) {
    let next;
    do next = work.next();
    while (!next.done);
    return next.value;
  }
  // Read-only preparation: source meshes move to the picking layer only when placed.
  *prepare(roots) {
    const geometries = [],
      shared = new Set(),
      objects = [];
    try {
      for (const root of roots) {
        root.updateWorldMatrix(true, true);
        if (root.userData.staticContainer) {
          for (const child of root.children) {
            let piece = this.pieces.get(child);
            if (!piece) {
              piece = yield* this.prepare([child]);
              this.pieces.set(child, piece);
            }
            if (piece.geometry) {
              geometries.push(piece.geometry);
              shared.add(piece.geometry);
            }
            objects.push(...piece.objects);
          }
          continue;
        }
        const sources = [];
        root.traverse((object) => {
          if (object.isInstancedMesh) return;
          for (let node = object; node && node !== root; node = node.parent)
            if (node.userData.animated) return;
          if (
            !object.isMesh ||
            !object.material.isMeshStandardMaterial ||
            object.material.map ||
            object.material.transparent
          )
            return;
          sources.push(object);
        });
        for (const object of sources) {
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
          objects.push(object);
          yield;
        }
      }
      if (!geometries.length) return { geometry: null, objects, roots };
      return { geometry: mergeGeometries(geometries, false), objects, roots };
    } finally {
      geometries.forEach((geometry) => shared.has(geometry) || geometry.dispose());
    }
  }
  place({ geometry, objects, roots = [] }) {
    for (const object of objects) object.layers.set(1);
    roots.forEach(freezeStatic);
    if (!geometry) return;
    this.mesh = new THREE.Mesh(geometry, this.material);
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
    this.prunePieces();
    this.material.dispose();
  }
}
// Batched roots never move (see `sync`). Skip their per-render matrix work: three
// otherwise recomposes every static node's matrix on each render call. Animated
// subtrees keep updating from their frozen, still-correct parents.
function freezeStatic(root) {
  root.updateWorldMatrix(true, true);
  const visit = (node) => {
    if (node.userData.animated) return;
    node.matrixAutoUpdate = false;
    node.matrixWorldAutoUpdate = false;
    node.children.forEach(visit);
  };
  visit(root);
}
