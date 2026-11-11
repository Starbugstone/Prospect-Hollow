import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { moonRover } from '../src/game/town/buildings/moon';
import { MoonScene } from '../src/game/town/moon/MoonScene';
import { MOON_RING_ROAD } from '../src/data/moonSettlement';
import { outerRingRovers } from '../src/data/moonModernizations';
import {
  ROVER_CORRIDOR,
  ROVER_SIGHT,
  ROVER_STOP,
  moonRoverAngle,
  moonRoverStep,
  roverPace,
} from '../src/game/town/moon/MoonRovers';
import { MOON_WALK_LANE } from '../src/game/town/moon/MoonSettlers';

describe.each([-1, 1])('Moon rovers travelling in direction %s', (dir) => {
  it('points its actual cabin along the road with wheel axles across its motion', () => {
    const root = moonRover(new TownPrimitives(), new Group());
    const scene = {
      walkers: [{ root, radius: MOON_RING_ROAD, phase: 0.7, speed: 0.11, dir }],
      construction: { update() {} },
      updateLotReveals() {},
      saucer: { step() {} },
      moveTransports() {},
    };
    for (const time of [0, 3, 12, 25, 50]) {
      MoonScene.prototype.move.call(scene, time - 0.001);
      const before = root.position.clone();
      MoonScene.prototype.move.call(scene, time + 0.001);
      const motion = root.position.clone().sub(before).normalize();
      MoonScene.prototype.move.call(scene, time);
      root.updateMatrixWorld(true);
      const front = root
        .getObjectByName('Rover cabin')
        .getWorldPosition(new Vector3())
        .sub(root.position);
      front.y = 0;
      expect(front.normalize().dot(motion)).toBeGreaterThan(0.99999);
      root.traverse((part) => {
        if (part.name !== 'Rover wheel') return;
        const axle = new Vector3(0, 1, 0).transformDirection(part.matrixWorld);
        expect(Math.abs(axle.dot(motion))).toBeLessThan(0.00001);
      });
    }
  });
});

// The rover depot's last upgrade sends rovers out on the outer ring too.
it('puts rovers on the outer ring only once the rover depot is fully upgraded', () => {
  const town = (era, level) => ({
    buildings: { roverBarn: 3 },
    buildingEras: { roverBarn: era },
    buildingEraLevels: { roverBarn: level },
  });
  expect(outerRingRovers(town('twin-hollows', 3))).toBe(0);
  expect(outerRingRovers(town('hollow-rising', 2))).toBe(0);
  expect(outerRingRovers(town('hollow-rising', 3))).toBe(2);
  expect(outerRingRovers({ ...town('hollow-rising', 3), buildings: { roverBarn: 0 } })).toBe(0);
  expect(outerRingRovers(undefined)).toBe(0);
});

// Rovers and people share the ring roads: nobody is driven through.
describe('Moon rovers and people on foot', () => {
  const person = (radius, angle, visible = true) => ({
    root: {
      visible,
      position: { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius },
    },
  });
  const rover = (dir = 1) => {
    const self = { radius: MOON_RING_ROAD, speed: 0.11, phase: 0.4, dir, root: { position: {} } };
    return self;
  };
  // Drives for `seconds` at 60 fps and reports the closest it came to `people`.
  function drive(self, people, seconds, rovers = [self]) {
    let closest = Infinity,
      last;
    for (let frame = 0; frame <= seconds * 60; frame++) {
      const time = frame / 60;
      for (const each of rovers) {
        const a = moonRoverAngle(each, time, moonRoverStep(time, last), people, rovers);
        Object.assign(each.root.position, {
          x: Math.cos(a) * each.radius,
          z: Math.sin(a) * each.radius,
        });
      }
      last = time;
      for (const { root } of people)
        closest = Math.min(
          closest,
          Math.hypot(
            root.position.x - self.root.position.x,
            root.position.z - self.root.position.z,
          ),
        );
    }
    return closest;
  }

  it('keeps the walking lanes outside the strip a rover sweeps', () => {
    expect(MOON_WALK_LANE).toBeGreaterThan(ROVER_CORRIDOR);
    expect(roverPace(ROVER_SIGHT)).toBe(1);
    expect(roverPace(ROVER_STOP)).toBe(0);
    expect(roverPace(0)).toBe(0);
    expect(roverPace((ROVER_SIGHT + ROVER_STOP) / 2)).toBeCloseTo(0.5);
    expect(roverPace(Infinity)).toBe(1);
  });

  it.each([1, -1])('stops short of someone standing in the road (direction %s)', (dir) => {
    const self = rover(dir);
    const ahead = person(MOON_RING_ROAD, self.phase + dir * 0.3);
    // Unhindered it would be well past them by now.
    expect(drive(self, [ahead], 40)).toBeGreaterThan(1);
    expect(self.pace).toBe(0);
    // Once they step aside into the walking lane, it pulls away again.
    Object.assign(
      ahead.root.position,
      person(MOON_RING_ROAD + MOON_WALK_LANE, self.phase).root.position,
    );
    const stopped = { ...self.root.position };
    drive(self, [ahead], 3);
    expect(self.pace).toBe(1);
    expect(
      Math.hypot(self.root.position.x - stopped.x, self.root.position.z - stopped.z),
    ).toBeGreaterThan(1);
  });

  it('passes people in the walking lanes, hidden people and people behind it', () => {
    const free = rover();
    drive(free, [], 20);
    const self = rover();
    const closest = drive(
      self,
      [
        person(MOON_RING_ROAD + MOON_WALK_LANE, 0.7),
        person(MOON_RING_ROAD - MOON_WALK_LANE, 1.1),
        person(MOON_RING_ROAD, 0.9, false),
        person(MOON_RING_ROAD, 0.3),
      ],
      20,
    );
    expect(self.held ?? 0).toBe(0);
    expect(self.root.position).toEqual(free.root.position);
    expect(closest).toBeGreaterThan(0);
  });

  it('queues behind a rover that is waiting instead of driving into it', () => {
    const front = rover(),
      behind = { ...rover(), phase: 0.25, root: { position: {} } };
    const blocker = person(MOON_RING_ROAD, front.phase + 0.3);
    drive(front, [blocker], 60, [front, behind]);
    const gap = Math.hypot(
      front.root.position.x - behind.root.position.x,
      front.root.position.z - behind.root.position.z,
    );
    expect(front.pace).toBe(0);
    expect(behind.pace).toBeCloseTo(0, 6);
    expect(gap).toBeGreaterThan(1.2);
  });

  it('keeps to its timetable until it has had to wait, and ignores a rewound clock', () => {
    const self = rover();
    expect(moonRoverStep(5, undefined)).toBe(0);
    expect(moonRoverStep(5, 6)).toBe(0);
    expect(moonRoverStep(5, 4.99)).toBeCloseTo(0.01);
    expect(moonRoverStep(50, 1)).toBe(0.1);
    expect(moonRoverAngle(self, 12, 0)).toBeCloseTo(self.phase + 0.11 * 12);
    expect(moonRoverAngle(self, 12, 0.016, [], [self])).toBeCloseTo(self.phase + 0.11 * 12);
  });

  it('stops before a settler about to step into the road, and drives on when it will be clear', () => {
    // The settler stands at the roadside and steps into the middle one second from now.
    const walker = person(MOON_RING_ROAD + 1.4, 0.4 + 0.2);
    const plan = (enterAt) => (who, time, out) =>
      Object.assign(out, {
        visible: true,
        x: Math.cos(0.6) * (time >= enterAt ? MOON_RING_ROAD : MOON_RING_ROAD + 1.4),
        z: Math.sin(0.6) * (time >= enterAt ? MOON_RING_ROAD : MOON_RING_ROAD + 1.4),
      });
    const waiting = rover();
    let last;
    for (let frame = 0; frame <= 45; frame++) {
      const time = frame / 60;
      moonRoverAngle(waiting, time, moonRoverStep(time, last), [walker], [waiting], plan(1));
      last = time;
    }
    // 0.2 rad is about four units ahead: too far to pass in a second, so it brakes early.
    expect(waiting.pace).toBeLessThan(1);
    expect(waiting.held).toBeGreaterThan(0);
    // Someone it is already level with, who steps out in two seconds, is not waited for.
    const passing = rover();
    const beside = person(MOON_RING_ROAD + 1.4, passing.phase);
    const besidePlan = (who, time, out) =>
      Object.assign(out, {
        visible: true,
        x: Math.cos(passing.phase) * (time >= 2 ? MOON_RING_ROAD : MOON_RING_ROAD + 1.4),
        z: Math.sin(passing.phase) * (time >= 2 ? MOON_RING_ROAD : MOON_RING_ROAD + 1.4),
      });
    moonRoverAngle(passing, 0.016, 0.016, [beside], [passing], besidePlan);
    expect(passing.held ?? 0).toBe(0);
    // A walker with no plan (a visitor) is simply not predicted.
    moonRoverAngle(passing, 0.032, 0.016, [beside], [passing], () => null);
    expect(passing.held ?? 0).toBe(0);
  });
});
