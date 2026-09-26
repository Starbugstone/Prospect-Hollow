import { expect, it, vi } from 'vitest';
import {
  prepareBirdApproaches,
  createBirdFlight,
  birdFlightPose,
} from '../src/game/town/TownBirdFlight';

function flightFixture(segment = () => true) {
  const space = { ceiling: 9, segment: vi.fn(segment) };
  const origin = { point: [0, 0.07, 0] },
    target = { point: [18, 2, 8] };
  for (const site of [origin, target])
    site.approaches = prepareBirdApproaches(space, site.point, 0.55);
  space.segment.mockClear();
  return {
    space,
    origin,
    target,
    flight: createBirdFlight(origin.point, origin, target, space.ceiling, 4.5, 2),
  };
}
const point = (flight, time) => {
  const { x, y, z } = birdFlightPose(flight, time);
  return [x, y, z];
};

it('takes off and lands along curved forward approaches with exact endpoints', () => {
  const { flight: f, origin, target } = flightFixture();
  expect(point(f, 0)).toEqual(origin.point);
  const early = point(f, f.liftTime * 0.3),
    later = point(f, f.liftTime * 0.7);
  const horizontal = (p, site) => Math.hypot(p[0] - site.point[0], p[2] - site.point[2]);
  expect(horizontal(early, origin)).toBeGreaterThan(0.5);
  expect(later[1]).toBeGreaterThan(early[1]);
  // A changing rise/run ratio distinguishes the arc from a straight diagonal lift.
  expect((early[1] - origin.point[1]) / horizontal(early, origin)).not.toBeCloseTo(
    (later[1] - origin.point[1]) / horizontal(later, origin),
    1,
  );
  const approach = point(f, f.total - f.landTime * 0.3);
  expect(horizontal(approach, target)).toBeGreaterThan(0.5);
  expect(approach[1]).toBeGreaterThan(target.point[1]);
  expect(point(f, f.total)).toEqual(target.point);
  expect(point(f, f.total + 2)).toEqual(target.point);
});

it('keeps velocity continuous through both joins without runtime scenery queries', () => {
  const { flight: f, space } = flightFixture();
  for (const time of [f.liftTime, f.liftTime + f.travel]) {
    const before = point(f, time - 1e-5),
      at = point(f, time),
      after = point(f, time + 1e-5);
    for (let n = 0; n < 3; n++)
      expect((at[n] - before[n]) / 1e-5).toBeCloseTo((after[n] - at[n]) / 1e-5, 3);
  }
  const pose = f.pose;
  for (let time = 0; time <= f.total; time += 1 / 60) {
    expect(birdFlightPose(f, time)).toBe(pose);
    expect(Object.values(pose).every(Number.isFinite)).toBe(true);
  }
  expect(space.segment).not.toHaveBeenCalled();
});

it('chooses an open departure away from a wall and keeps a safe fallback for narrow perches', () => {
  // Wall east of the origin, extending above its flight ceiling.
  const { origin } = flightFixture((a, b, radius) => Math.max(a[0], b[0]) + radius < 1.5);
  expect(origin.approaches.some((curve) => curve[3][0] < -4)).toBe(true);
  for (const curve of origin.approaches)
    expect(Math.max(...curve.map((p) => p[0])) + 0.55).toBeLessThan(1.5);
  const point = [0, 2, 0];
  const narrow = prepareBirdApproaches({ ceiling: 9, segment: () => false }, point, 0.55);
  expect(narrow).toHaveLength(1);
  expect(narrow[0].every((p) => p[0] === 0 && p[2] === 0)).toBe(true);
});
