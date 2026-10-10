import { describe, expect, it } from 'vitest';
import { PERSONAL_AREAS, SITE_FACINGS, siteYaw } from '../src/data/townLandmarks';
import { AIRPORT, RAIL_EDGE, segmentDistance, townTracks } from '../src/game/town/TownLayout';
import { groundHeight } from '../src/game/town/TownLandscape';
import { RIVER, riverCenterX, riverDistance } from '../src/game/town/TownRiver';
import { GARDEN_PARCELS } from '../src/data/townGardenDistrict';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { plotInEra } from '../src/game/town/TownEras';

// The railway cutting is graded up to 6 units either side of the track.
const BEYOND_RAILWAY = RAIL_EDGE.from[1] - 6;
// Where a site's front points on the ground: local +z turned by its facing.
const front = (area) => [Math.sin(siteYaw(area)), Math.cos(siteYaw(area))];
const circle = (area, step = 2) => {
  const [x, z] = area.positions[0];
  return Array.from({ length: 360 / step }, (_, n) => {
    const a = (n * step * Math.PI) / 180;
    return [x + Math.cos(a) * area.radius, z + Math.sin(a) * area.radius];
  });
};

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
      for (const [px, pz] of circle(area))
        expect(riverDistance(px, pz), `${area.id} bank`).toBeGreaterThan(RIVER.bankWidth + 1);
    }
  });
  it('keeps every site off the roads, the railway and the reserved parcels of a complete town', () => {
    const town = { ...createTown(), era: ERAS.at(-1).id };
    for (const building of BUILDINGS)
      if (plotInEra(town, building.id)) town.buildings[building.id] = building.upgrades.length;
    const tracks = [...townTracks(town), RAIL_EDGE];
    const parcels = [
      ...Object.entries(GARDEN_PARCELS).map(([id, p]) => [
        id,
        p.position,
        p.halfWidth,
        p.halfDepth,
      ]),
      ['airport', AIRPORT.center, AIRPORT.halfWidth, AIRPORT.halfDepth],
    ];
    for (const area of PERSONAL_AREAS) {
      const [x, z] = area.positions[0];
      for (const { from, to, width = 0.85 } of tracks)
        expect(segmentDistance(x, z, from, to) - width / 2, area.id).toBeGreaterThan(
          area.radius + 2,
        );
      for (const [id, [px, pz], halfWidth, halfDepth] of parcels)
        expect(
          Math.hypot(
            Math.max(0, Math.abs(x - px) - halfWidth),
            Math.max(0, Math.abs(z - pz) - halfDepth),
          ),
          `${area.id} and ${id}`,
        ).toBeGreaterThan(area.radius + 2);
    }
  });
  it('turns each site to a supported facing, south unless it declares another', () => {
    for (const area of PERSONAL_AREAS) expect(Object.keys(SITE_FACINGS)).toContain(area.facing);
    expect(siteYaw({ id: 'incomplete' })).toBe(SITE_FACINGS.south);
    expect(siteYaw({ id: 'future', facing: 'upriver' })).toBe(SITE_FACINGS.south);
    expect(siteYaw(null)).toBe(SITE_FACINGS.south);
    expect(front({ facing: 'east' })[0]).toBeCloseTo(1);
    expect(front({ facing: 'south' })[1]).toBeCloseTo(1);
  });
  it('fronts Founders’ Meadow onto the river beside it', () => {
    const meadow = PERSONAL_AREAS.find((a) => a.id === 'meadow');
    const [x, z] = meadow.positions[0];
    const [fx, fz] = front(meadow);
    // The front points straight across to the water, which starts just past the court.
    expect(Math.sign(fx)).toBe(Math.sign(riverCenterX(z) - x));
    expect(Math.abs(fz)).toBeLessThan(1e-9);
    expect(riverDistance(x, z) - meadow.radius - RIVER.bankWidth).toBeLessThan(3);
  });
});
