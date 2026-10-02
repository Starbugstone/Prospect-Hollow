import { afterEach, expect, it, vi } from 'vitest';
import { Group, Raycaster, Scene, Vector3 } from 'three';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { TownStatics } from '../src/game/town/TownStatics';

// A canvas stand-in: the atlas only fills rectangles and writes text.
const context = () => ({ fillRect: vi.fn(), fillText: vi.fn() });
afterEach(() => vi.unstubAllGlobals());
function primitives() {
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: context }),
  });
  return new TownPrimitives();
}
const faces = (root) => {
  const found = [];
  root.traverse((object) => object.material?.userData.signAtlas && found.push(object));
  return found;
};

it('paints each sign once into a shared page with its own texture area', () => {
  const d = primitives();
  const root = new Group();
  d.sign(root, 'Saloon', 2, 0, 1, 0);
  d.sign(root, 'Bank', 2, 3, 1, 0);
  d.sign(root, 'Saloon', 1.5, 6, 1, 0);
  const [saloon, bank, again] = faces(root);
  expect(saloon.material).toBe(bank.material);
  expect(again.geometry).toBe(saloon.geometry);
  expect(d.signAtlas.pages[0].used).toBe(2);
  const u = (face) => face.geometry.getAttribute('uv').getX(0);
  expect(u(bank)).not.toBe(u(saloon));
  for (const face of [saloon, bank])
    for (const value of face.geometry.getAttribute('uv').array) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  d.disposePrimitives();
});

it('draws every visible plot sign in one batch and keeps hidden source meshes pickable', () => {
  const d = primitives();
  const scene = new Scene();
  const plots = ['Home', 'Farm', 'Shop'].map((name, i) => {
    const plot = d.group(scene, i * 5, 0, 0);
    d.box(plot, 2, 2, 2, 0, 1, 0, '#aa8855');
    d.sign(plot, name, 2, 0, 2.5, 1.1);
    return plot;
  });
  const statics = new TownStatics(scene);
  statics.sync(plots);
  expect(statics.signMeshes.size).toBe(1);
  const [batch] = statics.signMeshes.values();
  expect(batch.geometry.getAttribute('position').count).toBe(12);
  for (const plot of plots) {
    expect(plot.children).toEqual([plot.userData.batchedSources]);
    expect(plot.userData.batchedSources.visible).toBe(false);
  }
  // Picking still hits the real building meshes on the picking layer.
  const ray = new Raycaster(new Vector3(5, 1, 10), new Vector3(0, 0, -1));
  ray.layers.enable(1);
  const hit = ray.intersectObjects(plots, true)[0];
  expect(hit.object.parent.parent).toBe(plots[1]);
  statics.setVisible(plots[2], false);
  expect([...statics.signMeshes.values()][0].geometry.getAttribute('position').count).toBe(8);
  expect(statics.batches.get(plots[2]).visible).toBe(false);
  statics.setVisible(plots[2], true);
  expect([...statics.signMeshes.values()][0].geometry.getAttribute('position').count).toBe(12);
  statics.sync(plots.slice(0, 1));
  expect([...statics.signMeshes.values()][0].geometry.getAttribute('position').count).toBe(4);
  statics.dispose();
  expect(statics.signMeshes.size).toBe(0);
  d.disposePrimitives();
});
