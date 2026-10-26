import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { moonRover } from '../src/game/town/buildings/moon';
import { MoonScene } from '../src/game/town/moon/MoonScene';
import { MOON_RING_ROAD } from '../src/data/moonSettlement';

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
