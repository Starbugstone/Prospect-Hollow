import { describe, expect, it } from 'vitest';
import { PERSONAL_AREAS } from '../src/data/townLandmarks';
import { AIRPORT, RAIL_EDGE } from '../src/game/town/TownLayout';
import { groundHeight } from '../src/game/town/TownLandscape';

// The railway cutting is graded up to 6 units either side of the track.
const BEYOND_RAILWAY = RAIL_EDGE.from[1] - 6;

describe('Monument site layout', () => {
  it('keeps only the timeless Monument Square in front of the town', () => {
    for (const area of PERSONAL_AREAS) {
      const [, z] = area.positions[0];
      if (area.timeless) expect(z - area.radius).toBeGreaterThan(RAIL_EDGE.from[1]);
      else expect(z + area.radius).toBeLessThan(BEYOND_RAILWAY);
    }
  });
  it('keeps sites beyond the railway out of the airport approach', () => {
    for (const area of PERSONAL_AREAS.filter((a) => !a.timeless))
      expect(Math.abs(area.positions[0][0] - AIRPORT.runwayX)).toBeGreaterThan(area.radius + 6);
  });
  it('builds every site on level ground, off the mine ridge and river banks', () => {
    for (const area of PERSONAL_AREAS) {
      const [x, z] = area.positions[0];
      const heights = [];
      for (let dx = -area.radius; dx <= area.radius; dx += 1)
        for (let dz = -area.radius; dz <= area.radius; dz += 1)
          if (Math.hypot(dx, dz) <= area.radius) heights.push(groundHeight(x + dx, z + dz));
      expect(Math.max(...heights) - Math.min(...heights), area.id).toBeLessThan(0.05);
    }
  });
});
