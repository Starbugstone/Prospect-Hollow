import { horizonMaterial } from './TownAtmosphere';
import { finishWork } from '../PresentationWork';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Render opaque scenery together with vertex colors, and every sign on an atlas page
// together. Once batched, a root's source meshes move into one hidden group: the
// renderer skips them with a single check, while picking, bounds, wire probing and
// the animal planner still use the real meshes (raycasts and traversals ignore
// visibility), so a draw-call reduction never changes which building is hit.
export class TownStatics {
  constructor(scene) {
    this.scene = scene;
    this.meshes = [];
    this.batches = new Map();
    // Prepared geometry per child of a `staticContainer` root (service drops), so a
    // replaced container re-merges retained children without cloning them again.
    this.pieces = new Map();
    // Sign faces per root and atlas page, drawn as one mesh per page (see composeSigns).
    this.signParts = new Map();
    this.signMeshes = new Map();
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
      for (const batch of prepared.values()) disposeBatch(batch);
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
      this.dropSigns(root);
    }
    for (const root of roots) {
      if (this.batches.has(root)) continue;
      const batch = prepared.get(root) ?? finishWork(this.prepare([root]));
      prepared.delete(root);
      this.batches.set(root, this.place(batch));
    }
    this.mesh = this.meshes.at(-1) ?? null;
    this.prunePieces();
    this.refreshVisibility();
  }
  // Shows or hides a batched root, e.g. scenery a presentation temporarily replaces.
  setVisible(root, visible) {
    if (!root || root.visible === visible) return;
    root.visible = visible;
    this.refreshVisibility();
  }
  // Batches follow their root's visibility, e.g. plots hidden until a cinematic ends.
  refreshVisibility() {
    for (const [root, mesh] of this.batches) if (mesh) mesh.visible = root.visible;
    this.composeSigns();
  }
  prunePieces() {
    const live = new Set();
    for (const root of this.batches.keys())
      if (root.userData.staticContainer) root.children.forEach((child) => live.add(child));
    for (const [child, piece] of this.pieces)
      if (!live.has(child)) {
        disposeBatch(piece);
        this.pieces.delete(child);
      }
  }
  add(roots) {
    const mesh = this.place(finishWork(this.prepare(roots)));
    this.composeSigns();
    return mesh;
  }
  // Read-only preparation: source meshes move to the picking layer only when placed.
  *prepare(roots) {
    const geometries = [],
      signs = new Map(),
      shared = new Set(),
      objects = [],
      owned = [];
    const addSign = (material, geometry) => {
      if (!signs.has(material)) signs.set(material, []);
      signs.get(material).push(geometry);
    };
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
            for (const [material, geometry] of piece.signs) {
              addSign(material, geometry);
              shared.add(geometry);
            }
            objects.push(...piece.objects);
            owned.push(...piece.owned);
          }
          continue;
        }
        const sources = [];
        root.traverse((object) => {
          if (object.isInstancedMesh || !object.isMesh) return;
          for (let node = object; node && node !== root; node = node.parent)
            if (node.userData.animated) return;
          if (object.material.userData.signAtlas) sources.push(object);
          else if (
            object.material.isMeshStandardMaterial &&
            !object.material.map &&
            !object.material.transparent
          )
            sources.push(object);
        });
        for (const object of sources) {
          const geometry = object.geometry.clone();
          geometry.applyMatrix4(object.matrixWorld);
          if (object.material.userData.signAtlas) addSign(object.material, geometry);
          else geometries.push(colored(geometry, object.material.color));
          objects.push(object);
          yield;
        }
        owned.push([root, sources]);
      }
      // Merged copies: each batch owns its sign geometry, pieces keep their own.
      const merged = new Map();
      for (const [material, parts] of signs) merged.set(material, mergeGeometries(parts, false));
      const geometry = geometries.length ? mergeGeometries(geometries, false) : null;
      return { geometry, signs: merged, objects, owned, roots };
    } finally {
      geometries.forEach((geometry) => shared.has(geometry) || geometry.dispose());
      for (const parts of signs.values())
        parts.forEach((geometry) => shared.has(geometry) || geometry.dispose());
    }
  }
  place({ geometry, signs, objects, owned, roots = [] }) {
    for (const object of objects) object.layers.set(1);
    for (const [owner, sources] of owned) hideSources(owner, sources);
    roots.forEach(freezeStatic);
    if (signs.size) this.signParts.set(roots[0], signs);
    if (!geometry) return;
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
    this.meshes.push(this.mesh);
    return this.mesh;
  }
  dropSigns(root) {
    this.signParts.get(root)?.forEach((geometry) => geometry.dispose());
    this.signParts.delete(root);
  }
  // One mesh per atlas page holds every visible root's sign faces.
  composeSigns() {
    const parts = new Map();
    for (const [root, signs] of this.signParts) {
      if (!root.visible) continue;
      for (const [material, geometry] of signs) {
        if (!parts.has(material)) parts.set(material, []);
        parts.get(material).push(geometry);
      }
    }
    for (const [material, mesh] of this.signMeshes)
      if (!parts.has(material)) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        this.signMeshes.delete(material);
      }
    for (const [material, geometries] of parts) {
      const geometry = mergeGeometries(geometries, false);
      let mesh = this.signMeshes.get(material);
      if (mesh) {
        mesh.geometry.dispose();
        mesh.geometry = geometry;
      } else {
        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        this.scene.add(mesh);
        this.signMeshes.set(material, mesh);
      }
    }
  }
  clear() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    for (const root of [...this.signParts.keys()]) this.dropSigns(root);
    this.composeSigns();
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
// Vertex colors carry each source's material color into the shared batch material.
function colored(geometry, color) {
  geometry.deleteAttribute('uv');
  const oldColors = geometry.getAttribute('color');
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length / 3; i++) {
    colors[i * 3] = color.r * (oldColors?.getX(i) ?? 1);
    colors[i * 3 + 1] = color.g * (oldColors?.getY(i) ?? 1);
    colors[i * 3 + 2] = color.b * (oldColors?.getZ(i) ?? 1);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (geometry.index) return geometry;
  const indexed = mergeVertices(geometry);
  geometry.dispose();
  return indexed;
}
function disposeBatch(batch) {
  batch?.geometry?.dispose();
  batch?.signs?.forEach((geometry) => geometry.dispose());
}
// Batched source meshes leave the drawn scene graph but stay in the model.
function hideSources(owner, sources) {
  // A root that is itself a mesh stays where it is.
  sources = sources.filter((object) => object !== owner);
  if (!sources.length) return;
  let hidden = owner.userData.batchedSources;
  if (!hidden) {
    hidden = new THREE.Group();
    hidden.name = 'Batched source meshes';
    hidden.visible = false;
    owner.add(hidden);
    hidden.updateMatrixWorld(true);
    owner.userData.batchedSources = hidden;
  }
  for (const object of sources) if (object.parent !== hidden) hidden.attach(object);
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
