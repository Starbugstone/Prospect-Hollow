import { expect, it, vi } from 'vitest';
import { LocomotionGrid, stepLocomotion } from '../src/game/town/TownLocomotion';

const agent = (id, x, z) => ({
  id,
  root: {},
  motion: { x, z, vx: 0, vz: 0, radius: 0.29, maxSpeed: 0.55, routeDistance: 0 },
});

it('tests each candidate once however many cells it spans, and stops at the first match', () => {
  const grid = new LocomotionGrid();
  const long = { cx: 3, cz: 0, heading: 0, halfWidth: 0.4, halfLength: 6 };
  grid.rebuild([agent('a', 0, 0)], [long]);
  const seen = [];
  const area = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  expect(grid.some('vehicles', area, (v) => (seen.push(v), false))).toBe(false);
  expect(seen).toEqual([long]);
  expect(grid.some('agents', area, () => true)).toBe(true);
  expect([...grid.cells.keys()].every((key) => typeof key === 'number')).toBe(true);
});

it('reuses a frame’s grid when the caller has already indexed it', () => {
  const grid = new LocomotionGrid();
  const agents = [agent('a', 0, 0), agent('b', 5, 5)];
  grid.rebuild(agents, []);
  const rebuild = vi.spyOn(grid, 'rebuild');
  stepLocomotion(agents, null, [], grid, 1 / 60, { indexed: true });
  expect(rebuild).not.toHaveBeenCalled();
  stepLocomotion(agents, null, [], grid, 1 / 60);
  expect(rebuild).toHaveBeenCalledOnce();
});
