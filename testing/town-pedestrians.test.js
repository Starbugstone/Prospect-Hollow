import { expect, it } from 'vitest';
import { createTown } from '../src/data/town';
import { PLOTS, segmentDistance, townTracks } from '../src/game/town/TownLayout';
import { TownNavigation, routeStepPose } from '../src/game/town/TownNavigation';
import { buildingWalk } from '../src/game/town/TownPedestrians';

it.each(['frontier', 'motor-age', 'future-unknown'])(
  'keeps a blocked %s shopfront walk parallel to the street and out of traffic',
  (era) => {
    const town = createTown();
    town.era = era;
    town.buildings.saloon = 3;
    const [x, z] = PLOTS.saloon;
    const navigation = new TownNavigation([{ x, z: z + 2, y: 0, radius: 0.8, height: 2 }]);
    const path = buildingWalk({ town, navigation }, 'saloon', { station: [x, 0.07, z + 3.5] });
    expect(path.total).toBeGreaterThanOrEqual(1.5);
    expect(path.building).toBe('saloon');
    expect(path.points[0][2]).toBe(path.points[1][2]);
    const roads = townTracks(town).filter((road) => road.width >= 0.85);
    for (let distance = 0; distance <= path.total * 2; distance += 0.05) {
      const pose = routeStepPose(path, distance);
      expect(navigation.clear([pose.x, pose.y, pose.z], 0.29)).toBe(true);
      expect(Math.hypot(pose.x - x, pose.z - z)).toBeLessThan(6);
      for (const road of roads)
        expect(segmentDistance(pose.x, pose.z, road.from, road.to)).toBeGreaterThan(0.98);
    }
    expect(navigation.plans).toBe(0);
  },
);

it('does not fall back to a traffic lane when a building has no clear outdoor space', () => {
  const town = createTown();
  const path = buildingWalk({ town, navigation: { segment: () => false } }, 'farm');
  expect(path.points).toEqual([]);
});
