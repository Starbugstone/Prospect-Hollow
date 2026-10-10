import * as THREE from 'three';
import { horizonMaterial } from './TownAtmosphere';
import { createTownGeometries } from './TownGeometries';
import { TownSignAtlas } from './TownSignAtlas';
import { finishWork } from '../PresentationWork';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const point = (x, y, z) => new THREE.Vector3(x, y, z);

// The mesh vocabulary every town model is built from: shared unit geometries scaled
// into place and one material per color. Buildings, people, animals and scenery all
// receive this (as the diorama) and never allocate geometry per part.
export class TownPrimitives {
  constructor() {
    this.materials = new Map();
    this.geometries = createTownGeometries();
    this.contactShadowMaterial = horizonMaterial(
      new THREE.MeshBasicMaterial({
        color: '#51432d',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
  }
  material(color) {
    if (!this.materials.has(color))
      this.materials.set(
        color,
        horizonMaterial(new THREE.MeshStandardMaterial({ color, roughness: 0.88 })),
      );
    return this.materials.get(color);
  }
  mesh(parent, shape, size, position, color) {
    const mesh = new THREE.Mesh(this.geometries[shape], this.material(color));
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  box(parent, w, h, d, x, y, z, color, round = false) {
    return this.mesh(parent, round ? 'rounded' : 'box', [w, h, d], [x, y, z], color);
  }
  ball(parent, x, y, z, size, color, shape = 'sphere') {
    return this.mesh(
      parent,
      shape,
      Array.isArray(size) ? size : [size, size, size],
      [x, y, z],
      color,
    );
  }
  rod(parent, a, b, radius, color) {
    const start = point(...a),
      end = point(...b),
      delta = end.clone().sub(start);
    const mesh = this.mesh(
      parent,
      'cylinder',
      [radius, delta.length(), radius],
      start.clone().add(end).multiplyScalar(0.5).toArray(),
      color,
    );
    mesh.quaternion.setFromUnitVectors(point(0, 1, 0), delta.normalize());
    return mesh;
  }
  group(parent, x = 0, y = 0, z = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  }
  // A wooden board with painted lettering from the shared sign atlas.
  sign(parent, text, width, x, y, z) {
    this.box(parent, width + 0.1, 0.43, 0.1, x, y, z, '#8c6947', true);
    if (typeof document === 'undefined') return;
    this.signAtlas ??= new TownSignAtlas();
    const { geometry, material } = this.signAtlas.slot(text);
    const face = new THREE.Mesh(geometry, material);
    face.scale.set(width, 0.35, 1);
    face.position.set(x, y, z + 0.058);
    face.castShadow = face.receiveShadow = true;
    parent.add(face);
  }
  // Merges a model's meshes into one mesh per material, keeping animated subtrees
  // articulated. Used for animated assemblies (one instanced part per material) and
  // scenery that is replaced as a whole. Meshes marked `castShadow = false` merge
  // apart, so they still cast no shadow.
  batch(group) {
    finishWork(this.batchWork(group));
  }
  // Clone one mesh or merge one material per step. The group changes only in the
  // final step, so cancelled or interleaved frames still draw the original meshes.
  *batchWork(group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(),
      buckets = new Map(),
      meshes = [],
      merged = [];
    group.traverse((object) => {
      if (!object.isMesh || object.isInstancedMesh) return;
      for (let node = object; node && node !== group; node = node.parent)
        if (node.userData.animated) return;
      meshes.push(object);
    });
    let committed = false;
    try {
      for (const object of meshes) {
        const geometry = object.geometry
          .clone()
          .applyMatrix4(inverse.clone().multiply(object.matrixWorld));
        const key = `${object.material.uuid}:${object.castShadow}`;
        if (!buckets.has(key))
          buckets.set(key, { material: object.material, castShadow: object.castShadow, parts: [] });
        buckets.get(key).parts.push(geometry);
        yield;
      }
      for (const [key, { material, castShadow, parts }] of buckets) {
        const geometry = mergeGeometries(parts);
        parts.forEach((item) => item.dispose());
        buckets.delete(key);
        geometry.userData.owned = true;
        merged.push([geometry, material, castShadow]);
        yield;
      }
      meshes.forEach((mesh) => mesh.removeFromParent());
      for (const [geometry, material, castShadow] of merged) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      committed = true;
    } finally {
      for (const { parts } of buckets.values()) parts.forEach((item) => item.dispose());
      if (!committed) merged.forEach(([geometry]) => geometry.dispose());
    }
  }
  contactShadow(parent, width, depth) {
    const shadow = new THREE.Mesh(this.geometries.shadow, this.contactShadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(width, depth, 1);
    shadow.position.y = -0.04;
    parent.add(shadow);
  }
  // Releases a model's own geometry and transient materials, then detaches it.
  clearGroup(group) {
    if (!group) return;
    const geometries = new Set(),
      materials = new Set();
    group.traverse((object) => {
      if (object.geometry?.userData.owned) geometries.add(object.geometry);
      if (object.material?.userData.transient) materials.add(object.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
    group.removeFromParent();
  }
  disposePrimitives() {
    Object.values(this.geometries).forEach((geometry) => geometry.dispose());
    this.signAtlas?.dispose();
    this.materials.forEach((material) => material.dispose());
    this.contactShadowMaterial.dispose();
  }
}
