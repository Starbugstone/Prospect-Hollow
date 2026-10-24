import { describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Raycaster,
  Scene,
  Vector3,
} from 'three';
import { TownStatics } from '../src/game/town/TownStatics';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { TownActors } from '../src/game/town/TownActors';

describe('Batching a growing village without losing color or interaction', () => {
  it('combines colored scenery while retaining original geometry for plot picking', () => {
    const scene = new Scene(),
      plot = new Group();
    plot.userData.plot = 'home';
    scene.add(plot);
    const geometry = new BoxGeometry(),
      originalDispose = vi.spyOn(geometry, 'dispose');
    const red = new MeshStandardMaterial({ color: '#c59376' }),
      green = new MeshStandardMaterial({ color: '#658580' });
    const front = new Mesh(geometry, red),
      roof = new Mesh(geometry, green);
    roof.position.y = 2;
    plot.add(front, roof);
    const renderer = new TownStatics(scene);
    renderer.rebuild([plot]);
    const colors = renderer.mesh.geometry.getAttribute('color');
    expect(colors.getX(0)).toBeCloseTo(red.color.r, 5);
    expect(colors.getX(colors.count - 1)).toBeCloseTo(green.color.r, 5);
    const raycaster = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
    raycaster.layers.enable(1);
    expect(raycaster.intersectObjects([plot], true)[0].object).toBe(front);
    const dispose = vi.spyOn(renderer.mesh.geometry, 'dispose');
    renderer.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(originalDispose).not.toHaveBeenCalled();
  });
  it('shares one actor batch across different clothing colors and keeps the visible color after repacking', () => {
    const scene = new Scene(),
      root = new Group(),
      geometry = new BoxGeometry();
    scene.add(root);
    const first = new Mesh(geometry, new MeshStandardMaterial({ color: '#cc3322' }));
    const second = new Mesh(geometry, new MeshStandardMaterial({ color: '#3366aa' }));
    root.add(first, second);
    const renderer = new TownActors(scene);
    renderer.rebuild([root]);
    expect(renderer.buckets).toHaveLength(1);
    expect(renderer.buckets[0].mesh.instanceColor.getX(0)).toBeCloseTo(first.material.color.r, 5);
    first.visible = false;
    renderer.update();
    expect(renderer.buckets[0].mesh.count).toBe(1);
    expect(renderer.buckets[0].mesh.instanceColor.getZ(0)).toBeCloseTo(second.material.color.b, 5);
    renderer.dispose();
  });
  it('settles a new plot without replacing existing buffers and releases both on rebuild', () => {
    const scene = new Scene(),
      geometry = new BoxGeometry(),
      material = new MeshStandardMaterial({ color: '#c59376' });
    const first = new Mesh(geometry, material),
      completed = new Mesh(geometry, material);
    completed.position.x = 3;
    scene.add(first, completed);
    const renderer = new TownStatics(scene);
    renderer.rebuild([first]);
    const original = renderer.mesh,
      originalDispose = vi.spyOn(original.geometry, 'dispose');
    renderer.add([completed]);
    const addition = renderer.mesh,
      additionDispose = vi.spyOn(addition.geometry, 'dispose');
    expect(renderer.meshes).toEqual([original, addition]);
    expect(original.parent).toBe(scene);
    expect(originalDispose).not.toHaveBeenCalled();
    const raycaster = new Raycaster(new Vector3(3, 0, 5), new Vector3(0, 0, -1));
    raycaster.layers.enable(1);
    expect(raycaster.intersectObject(completed)[0].object).toBe(completed);
    renderer.rebuild([first, completed]);
    expect(originalDispose).toHaveBeenCalledOnce();
    expect(additionDispose).toHaveBeenCalledOnce();
    expect(original.parent).toBeNull();
    expect(addition.parent).toBeNull();
    expect(renderer.meshes).toHaveLength(1);
    renderer.dispose();
    geometry.dispose();
    material.dispose();
  });
  it('replaces only changed root batches and releases removed and final buffers', () => {
    const scene = new Scene();
    const geometry = new BoxGeometry();
    const material = new MeshStandardMaterial({ color: '#658580' });
    const first = new Mesh(geometry, material),
      second = new Mesh(geometry, material);
    scene.add(first, second);
    const renderer = new TownStatics(scene);
    renderer.sync([first, second]);
    const firstBatch = renderer.batches.get(first),
      secondBatch = renderer.batches.get(second);
    const firstDispose = vi.spyOn(firstBatch.geometry, 'dispose');
    const secondDispose = vi.spyOn(secondBatch.geometry, 'dispose');
    const replacement = new Mesh(geometry, material);
    replacement.position.x = 3;
    scene.add(replacement);
    renderer.sync([first, replacement]);
    expect(renderer.batches.get(first) === firstBatch).toBe(true);
    expect(firstDispose).not.toHaveBeenCalled();
    expect(secondDispose).toHaveBeenCalledOnce();
    expect(secondBatch.parent).toBeNull();
    expect(renderer.meshes).toHaveLength(2);
    const replacementBatch = renderer.batches.get(replacement);
    replacementBatch.geometry.computeBoundingBox();
    expect(replacementBatch.geometry.boundingBox.min.x).toBeCloseTo(2.5);
    const replacementDispose = vi.spyOn(replacementBatch.geometry, 'dispose');
    renderer.dispose();
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(replacementDispose).toHaveBeenCalledOnce();
    expect(renderer.batches.size).toBe(0);
    geometry.dispose();
    material.dispose();
  });
  it('can switch from a combined rebuild to retained root batches without duplicate meshes', () => {
    const scene = new Scene(),
      geometry = new BoxGeometry(),
      material = new MeshStandardMaterial();
    const root = new Mesh(geometry, material);
    scene.add(root);
    const renderer = new TownStatics(scene);
    renderer.rebuild([root]);
    const combined = renderer.mesh,
      dispose = vi.spyOn(combined.geometry, 'dispose');
    renderer.sync([root]);
    expect(dispose).toHaveBeenCalledOnce();
    expect(combined.parent).toBeNull();
    expect(renderer.meshes).toHaveLength(1);
    renderer.dispose();
    geometry.dispose();
    material.dispose();
  });
  it('keeps parts marked castShadow = false out of the shadow pass in the static batch', () => {
    const scene = new Scene(),
      root = new Group(),
      geometry = new BoxGeometry(),
      material = new MeshStandardMaterial({ color: '#c59376' });
    scene.add(root);
    const wall = new Mesh(geometry, material),
      ribbon = new Mesh(geometry, material);
    wall.castShadow = true;
    ribbon.castShadow = false;
    ribbon.position.y = 3;
    // Sign faces on one atlas page split the same way.
    const atlas = new MeshBasicMaterial();
    atlas.userData.signAtlas = true;
    const signs = [true, false].map((castShadow) => {
      const face = new Mesh(geometry, atlas);
      face.castShadow = castShadow;
      return face;
    });
    root.add(wall, ribbon, ...signs);
    const statics = new TownStatics(scene);
    statics.sync([root]);
    const batch = statics.batches.get(root);
    expect(batch.castShadow).toBe(true);
    expect(batch.children).toHaveLength(1);
    const [shadowless] = batch.children;
    expect([shadowless.castShadow, shadowless.receiveShadow]).toEqual([false, true]);
    // Each merged mesh holds exactly its own part: the wall casts, the raised ribbon does not.
    for (const [mesh, y] of [
      [batch, 0],
      [shadowless, 3],
    ]) {
      expect(mesh.geometry.index.count).toBe(geometry.index.count);
      mesh.geometry.computeBoundingBox();
      expect(mesh.geometry.boundingBox.getCenter(new Vector3()).y).toBeCloseTo(y);
    }
    expect([...statics.signMeshes.values()].map((mesh) => mesh.castShadow)).toEqual([true, false]);
    // The shadowless part follows its root's visibility and is released with it.
    statics.setVisible(root, false);
    expect(batch.visible).toBe(false);
    const dispose = vi.spyOn(shadowless.geometry, 'dispose');
    statics.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(batch.parent).toBeNull();
    expect(statics.signMeshes.size).toBe(0);
    // A root with no casting parts draws one batch that casts no shadow.
    const lone = new Mesh(geometry, material);
    scene.add(lone);
    statics.sync([lone]);
    expect(statics.batches.get(lone).castShadow).toBe(false);
    expect(statics.batches.get(lone).children).toHaveLength(0);
    statics.dispose();
    geometry.dispose();
    material.dispose();
    atlas.dispose();
  });
  it('merges castShadow = false meshes apart when batching a model', () => {
    const d = new TownPrimitives(),
      group = new Group();
    d.box(group, 1, 1, 1, 0, 0, 0, '#c59376');
    d.box(group, 1, 1, 1, 2, 0, 0, '#c59376');
    d.box(group, 1, 1, 1, 0, 4, 0, '#c59376').castShadow = false;
    d.batch(group);
    const merged = group.children.filter((child) => child.isMesh);
    expect(merged.map((mesh) => mesh.castShadow)).toEqual([true, false]);
    expect(merged.map((mesh) => mesh.geometry.index.count)).toEqual([
      d.geometries.box.index.count * 2,
      d.geometries.box.index.count,
    ]);
    merged.forEach((mesh) => mesh.geometry.dispose());
    d.disposePrimitives();
  });
});
