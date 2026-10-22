import { afterEach, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { animalNavigation, animalSpace } from '../src/game/town/TownAnimalSpace';
import { TownNavigation } from '../src/game/town/TownNavigation';

const worlds = [];
const left = [-6, 0.07, 0];
const right = [6, 0.07, 0];
const radius = 0.3;

function fixture({ blockedTarget = false, impassable = false } = {}) {
  const world = new Group();
  const wall = new Mesh(new BoxGeometry(1, 3, impassable ? 20 : 6), new MeshBasicMaterial());
  wall.position.y = 1.5;
  world.add(wall);
  if (blockedTarget) {
    const blocked = new Mesh(new BoxGeometry(8, 3, 8), new MeshBasicMaterial());
    blocked.position.set(20, 1.5, 0);
    world.add(blocked);
  }
  worlds.push(world);
  const space = animalSpace({ world });
  // This real mesh has no pedestrian footprint. Animal routing must discover
  // and detour around its triangles through the production mesh-space index.
  const nav = animalNavigation(new TownNavigation(), space);
  const realSegment = space.segment;
  const clear = vi.spyOn(space, 'clear');
  const segment = vi.spyOn(space, 'segment');
  return { nav, space, clear, segment, realSegment };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const world of worlds.splice(0))
    world.traverse((part) => {
      part.geometry?.dispose();
      part.material?.dispose();
    });
});

function drain(work, f, inspect) {
  let next;
  const calls = [];
  do {
    const beforeClear = f.clear.mock.calls.length;
    const beforeSegment = f.segment.mock.calls.length;
    next = work.next();
    const row = {
      clear: f.clear.mock.calls.length - beforeClear,
      segment: f.segment.mock.calls.length - beforeSegment,
      done: next.done,
    };
    calls.push(row);
    inspect?.(row);
  } while (!next.done);
  return { path: next.value, calls };
}

function expectClearPath(f, path) {
  for (let i = 0; i < path.points.length; i++) {
    expect(f.space.clear(path.points[i], radius, 1)).toBe(true);
    if (i) expect(f.space.segment(path.points[i - 1], path.points[i], radius, 1)).toBe(true);
  }
}

it('splits a large real-mesh detour into bounded slices and returns the identical synchronous path', () => {
  const sync = fixture();
  const expected = sync.nav.plan([left, right], radius, 1);
  expect(expected.points[0]).toEqual(left);
  expect(expected.points.at(-1)).toEqual(right);
  expect(expected.total).toBeGreaterThan(12);
  const f = fixture();
  const { path, calls } = drain(f.nav.planSteps([left, right], radius, 1), f);
  expect(path).toEqual(expected);
  // The obstacle needs substantially more work than one slice. These bounds
  // constrain the externally observable collision work, not a copied batch size.
  expect(f.clear.mock.calls.length + f.segment.mock.calls.length).toBeGreaterThan(200);
  const working = calls.filter((step) => step.clear || step.segment);
  expect(working.length).toBeGreaterThan(4);
  for (const step of working) expect(step.clear + step.segment).toBeLessThanOrEqual(96);
  expectClearPath(f, path);
});

it('yields early enough to cancel an unfinished detour without doing further collision work', () => {
  const reference = fixture();
  const expected = reference.nav.plan([left, right], radius, 1);
  const completeCalls = reference.clear.mock.calls.length + reference.segment.mock.calls.length;
  const f = fixture();
  const work = f.nav.planSteps([left, right], radius, 1);
  let next;
  do next = work.next();
  while (!next.done && f.segment.mock.calls.length < 2);
  expect(next.done).toBe(false);
  const pausedCalls = f.clear.mock.calls.length + f.segment.mock.calls.length;
  expect(pausedCalls).toBeGreaterThan(2);
  expect(pausedCalls).toBeLessThan(completeCalls);
  expect(work.return().done).toBe(true);
  expect(work.next().done).toBe(true);
  expect(f.clear.mock.calls.length + f.segment.mock.calls.length).toBe(pausedCalls);
  // A new plan can reuse valid point answers from the cancelled work while
  // retaining the original ordered path and complete collision clearance.
  const retried = f.nav.plan([left, right], radius, 1);
  expect(retried).toEqual(expected);
  expectClearPath(f, retried);
});

it('also slices the closing search when a blocked later stop truncates a closed itinerary', () => {
  const f = fixture({ blockedTarget: true });
  const originalSegment = f.realSegment;
  let closing = false;
  f.segment.mockImplementation((a, b, ...args) => {
    if (a[0] === right[0] && b[0] === left[0]) closing = true;
    return originalSegment(a, b, ...args);
  });
  let closingYields = 0;
  const points = [left, right, [20, 0.07, 0], left];
  const { path, calls } = drain(f.nav.planSteps(points, radius, 1), f, (step) => {
    if (closing && !step.done && step.segment) closingYields++;
  });
  expect(closingYields).toBeGreaterThan(1);
  // The failed stop's safe-point probes are separate from the detour. Bound
  // swept collision queries through the closing search itself on every step.
  for (const step of calls) expect(step.segment).toBeLessThanOrEqual(48);
  expect(path.points[0]).toEqual(left);
  expect(path.points.at(-1)).toEqual(left);
  expect(path.points).toContainEqual(right);
  expect(path.points).not.toContainEqual([20, 0.07, 0]);
  expect(path).toEqual(fixture({ blockedTarget: true }).nav.plan(points, radius, 1));
  expectClearPath(f, path);
});

it('keeps independent suspended searches ordered and leaves an impassable route truncated safely', () => {
  const f = fixture();
  const reverse = f.nav.planSteps([right, left], radius, 1);
  const forward = f.nav.planSteps([left, right], radius, 1);
  let a, b;
  do {
    if (!a?.done) a = forward.next();
    if (!b?.done) b = reverse.next();
  } while (!a.done || !b.done);
  expect(a.value).toEqual(fixture().nav.plan([left, right], radius, 1));
  expect(b.value).toEqual(fixture().nav.plan([right, left], radius, 1));
  expectClearPath(f, a.value);
  expectClearPath(f, b.value);

  const blocked = fixture({ impassable: true });
  const { path, calls } = drain(blocked.nav.planSteps([left, right], radius, 1), blocked);
  expect(calls.filter((step) => step.segment).length).toBeGreaterThan(4);
  for (const step of calls) expect(step.clear + step.segment).toBeLessThanOrEqual(96);
  expect(path.points).toEqual([left]);
  expect(path.total).toBe(0);
  expectClearPath(blocked, path);
});
