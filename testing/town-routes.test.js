import { expect, it } from 'vitest';
import { prepareRoute, routePose } from '../src/game/town/TownRoutes';
it('turns smoothly at a right-angle road junction while positions stay on the graph', () => {
  const route = [
    [0, 0],
    [0, 5],
    [5, 5],
  ];
  const path = prepareRoute(route);
  let last = routePose(path, 0);
  for (let distance = 0.05; distance <= 10; distance += 0.05) {
    const pose = routePose(path, distance);
    expect(Math.hypot(pose.x - last.x, pose.z - last.z)).toBeLessThanOrEqual(0.051);
    expect(Math.abs(pose.heading - last.heading)).toBeLessThan(0.15);
    expect(pose.x === 0 || pose.z === 5).toBe(true);
    expect(routePose(route, distance)).toEqual(pose);
    last = pose;
  }
  expect(routePose(route, 11)).toMatchObject({ x: 5, z: 5, moving: false });
});

it('handles empty routes, repeated waypoints, and distances outside the route', () => {
  expect(routePose(prepareRoute([]), 5)).toEqual({ x: 0, z: 0, heading: 0, moving: false });
  expect(routePose(prepareRoute([[2, 3]]), 5)).toEqual({ x: 2, z: 3, heading: 0, moving: false });
  const route = prepareRoute([
    [0, 0],
    [0, 0],
    [0, 5],
    [5, 5],
  ]);
  expect(route.total).toBe(10);
  expect(routePose(route, -1)).toMatchObject({ x: 0, z: 0 });
  expect(routePose(route, 3)).toMatchObject({ x: 0, z: 3, moving: true });
  expect(routePose(route, 12)).toMatchObject({ x: 5, z: 5, heading: Math.PI / 2, moving: false });
});
