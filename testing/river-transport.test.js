import { describe, expect, it } from 'vitest';
import { RAIL_JOINTED, railHeight, trainJourney } from '../src/game/town/TownEraActivity';
import { PLOTS, RAIL_EDGE } from '../src/game/town/TownLayout';
import { RIVER, riverCenterX, bridgeDeckHeight } from '../src/game/town/TownRiver';
import { groundHeight } from '../src/game/town/TownLandscape';
import { TOWN_EDGE } from '../src/game/town/TownAtmosphere';

describe('through traffic with room above and beside it', () => {
  it('keeps a full train above the terrain across both map edges and the river', () => {
    expect(RAIL_EDGE.from[0]).toBeLessThanOrEqual(-TOWN_EDGE);
    expect(RAIL_EDGE.to[0]).toBeGreaterThanOrEqual(TOWN_EDGE);
    for (let x = RAIL_EDGE.from[0]; x <= RAIL_EDGE.to[0]; x += 0.5)
      for (const wheelOffset of [-4.5, -3.5, -2.7, -1.7, -0.6, 0.6])
        for (const side of [-0.6, 0.6])
          expect(
            railHeight(x + wheelOffset) - groundHeight(x + wheelOffset, RAIL_EDGE.from[1] + side),
          ).toBeGreaterThan(0.1);
  });
  it('lays one welded length only where the line is level', () => {
    const [west, east] = RAIL_JOINTED;
    for (let x = RAIL_EDGE.from[0]; x <= west; x += 0.5)
      expect(railHeight(x)).toBe(railHeight(west));
    for (let x = east; x <= RAIL_EDGE.to[0]; x += 0.5) expect(railHeight(x)).toBe(railHeight(east));
    // The bridge grade needs its one-unit lengths.
    expect(Math.abs(riverCenterX(RAIL_EDGE.from[1]) - west)).toBeGreaterThan(16);
    expect(Math.abs(riverCenterX(RAIL_EDGE.from[1]) - east)).toBeGreaterThan(16);
  });
  it('stops at the station and then continues east without reversing on screen', () => {
    let previous;
    let paused = 0,
      crossedRiver = false,
      exitedEast = false;
    // One full run from the west edge, the station stop and out past the east edge.
    const run = (RAIL_EDGE.to[0] - RAIL_EDGE.from[0] + 14) / 4 + 9;
    for (let t = 0; t < run; t += 0.1) {
      const pose = trainJourney(t);
      if (pose.visible && previous?.visible) expect(pose.x).toBeGreaterThanOrEqual(previous.x);
      if (pose.visible && !pose.moving) {
        expect(pose.x).toBe(-16);
        paused++;
      }
      crossedRiver ||= pose.visible && pose.x > riverCenterX(-23);
      exitedEast ||= pose.x > RAIL_EDGE.to[0];
      previous = pose;
    }
    expect(paused).toBeGreaterThan(80);
    expect(crossedRiver && exitedEast).toBe(true);
  });
  it('clears the full boat stack under both bridges and keeps docks out of its channel', () => {
    const stackTop = RIVER.waterHeight + 0.12 + 1.65 + 0.55;
    for (const z of [-23, 7.5]) {
      const center = riverCenterX(z);
      for (const dx of [-1.2, 0, 1.2]) {
        const underside =
          z === -23 ? railHeight(center + dx) - 0.275 : bridgeDeckHeight(center + dx) - 0.09;
        expect(underside - stackTop).toBeGreaterThan(0.4);
      }
    }
    for (const id of ['fisherman', 'riverPort']) {
      const [x, z] = PLOTS[id];
      const dockEnd = riverCenterX(z) - RIVER.halfWidth + 0.3;
      expect(dockEnd).toBeGreaterThan(x + 1);
      expect(riverCenterX(z) - 1.2 - dockEnd).toBeGreaterThan(1);
    }
    for (let z = -65; z <= 65; z += 0.5)
      for (const dx of [-1.2, 1.2])
        for (const dz of [-2.7, 2.7])
          expect(groundHeight(riverCenterX(z) + dx, z + dz)).toBeLessThan(RIVER.waterHeight);
  });
});
