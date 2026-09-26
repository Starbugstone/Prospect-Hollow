import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { TownConstruction } from '../src/game/town/TownConstruction';

it('assembles from the ground up over 1.8 seconds and restores meshes for static rendering', () => {
  const geometry = new BoxGeometry(),
    material = new MeshStandardMaterial();
  const view = {
    elapsed: 4,
    group(parent, x = 0, y = 0, z = 0) {
      const group = new Group();
      group.position.set(x, y, z);
      parent.add(group);
      return group;
    },
    box(parent, w, h, d, x, y, z) {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    },
    ball(parent, x, y, z) {
      return this.box(parent, 1, 1, 1, x, y, z);
    },
  };
  const group = new Group(),
    rotor = new Group();
  const foundation = view.box(group, 1, 1, 1, 0, 0, 0);
  const roof = view.box(group, 1, 1, 1, 0, 3, 0);
  const hidden = view.box(group, 1, 1, 1, 0, 1, 0);
  hidden.visible = false;
  const construction = new TownConstruction(view, group, rotor);
  expect(group.userData).toMatchObject({ animated: true, static: false });
  expect(rotor.visible).toBe(false);
  expect(roof.visible).toBe(false);
  construction.presentFirstStrike();
  construction.update(4);
  for (let t = 4.01; t < 4.7; t += 0.01) construction.update(t);
  expect(construction.update(4.7)).toBe(false);
  expect(foundation.position.y).toBe(0);
  expect(roof.visible).toBe(false);
  for (let t = 4.71; t < 5.0; t += 0.01) construction.update(t);
  expect(construction.update(5.0)).toBe(false);
  expect(roof.visible).toBe(true);
  expect(roof.position.y).toBeGreaterThan(3);
  for (let t = 5.01; t < 5.81; t += 0.01) construction.update(t);
  expect(construction.update(5.82)).toBe(true);
  construction.finish();
  expect(roof.position.y).toBe(3);
  expect(hidden.visible).toBe(false);
  expect(rotor.visible).toBe(true);
  expect(group.children).toHaveLength(3);
  expect(group.userData).toMatchObject({ animated: false, static: true });
  // A reduced-motion switch or scene rebuild can also end the effect early.
  const interrupted = new TownConstruction(view, group, rotor);
  expect(interrupted.update(12)).toBe(false);
  expect(roof.visible).toBe(false);
  interrupted.finish();
  expect(roof.position.y).toBe(3);
  expect(roof.visible).toBe(true);
  expect(group.children).toHaveLength(3);
  geometry.dispose();
  material.dispose();
});

it('uses active reveal time across slow frames and freezes while hidden', () => {
  const view = Object.create(TownDiorama.prototype),
    group = new Group();
  Object.assign(view, { geometries: createTownGeometries(), materials: new Map(), elapsed: 0 });
  view.box(group, 1, 1, 1, 0, 0.5, 0, '#aabbcc');
  const construction = new TownConstruction(view, group);
  construction.update(100);
  expect(construction.elapsed).toBeLessThan(0.1);
  construction.presentFirstStrike();
  construction.update(100);
  expect(construction.update(100.5)).toBe(false);
  expect(construction.elapsed).toBeCloseTo(0.5);
  construction.pause();
  construction.update(700);
  expect(construction.elapsed).toBeCloseTo(0.5);
  construction.resume();
  construction.update(900);
  expect(construction.elapsed).toBeCloseTo(0.5);
  expect(construction.update(901.31)).toBe(true);
  Object.values(view.geometries).forEach((g) => g.dispose());
  view.materials.forEach((m) => m.dispose());
});
