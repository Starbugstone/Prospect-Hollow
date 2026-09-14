import { expect, it } from 'vitest';
import { Group, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createTown } from '../src/data/town';
import { addTownRoads } from '../src/game/town/TownActivity';
import { PLOTS } from '../src/game/town/TownLayout';
import { riverCenterX } from '../src/game/town/TownRiver';

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
