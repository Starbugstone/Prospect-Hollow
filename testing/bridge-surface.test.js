import { expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createTown } from '../src/data/town';
import { addTownRoads } from '../src/game/town/TownActivity';
import { PLOTS } from '../src/game/town/TownLayout';
import { riverCenterX } from '../src/game/town/TownRiver';
import { renderBridge } from '../src/game/town/buildings/infrastructure';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';

it.each([1, 2, 3])('keeps level %s bridge pillars and caps below the ramp surface', (level) => {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, { geometries: createTownGeometries(), materials: new Map() });
  const bridge = new Group();
  bridge.position.set(riverCenterX(7.5), 0.08, 7.5);
  renderBridge(d, bridge, level);
  bridge.updateMatrixWorld(true);
  const deck = [],
    supports = [];
  bridge.traverse((part) => {
    const color = part.material?.color?.getHexString();
    if (color === 'a48e69') deck.push(part);
    if (['b7ae98', 'd9ccad', '8c9183'].includes(color)) supports.push(part);
  });
  expect(supports).toHaveLength(level >= 2 ? 8 : 4);
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  for (const support of supports) {
    const bounds = new Box3().setFromObject(support);
    for (const x of [
      bounds.min.x + 0.001,
      (bounds.min.x + bounds.max.x) / 2,
      bounds.max.x - 0.001,
    ]) {
      ray.ray.origin.set(x, 10, 7.5);
      const hit = ray.intersectObjects(deck, false)[0];
      expect(hit).toBeDefined();
      expect(bounds.max.y).toBeLessThan(hit.point.y - 0.02);
    }
  }
  Object.values(d.geometries).forEach((g) => g.dispose());
  d.materials.forEach((m) => m.dispose());
});

it('leaves the channel under the bridge free of ground-level roads and porch boards', () => {
  const town = createTown();
  town.era = 'river-rail';
  town.buildings.bridge = 2;
  town.buildings.square = 3;
  const material = new MeshBasicMaterial();
  const boards = [];
  const d = {
    world: new Group(),
    group(parent) {
      const group = new Group();
      parent.add(group);
      return group;
    },
    material: () => material,
    box: (parent, width, height, depth, x, y, z) => boards.push({ x, z }),
    rod() {},
    batch() {},
  };
  addTownRoads(d, town, PLOTS);
  d.world.updateMatrixWorld(true);
  const x = riverCenterX(7.5);
  const ray = new Raycaster(new Vector3(x, 1, 7.5), new Vector3(0, -1, 0));
  expect(ray.intersectObject(d.world, true)).toEqual([]);
  expect(boards.some((board) => Math.abs(board.x - x) < 3 && Math.abs(board.z - 7.5) < 3)).toBe(
    false,
  );
  d.world.traverse((object) => object.geometry?.dispose());
  material.dispose();
});
