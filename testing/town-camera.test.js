import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { groundHeight, keepCameraAboveTerrain } from '../src/game/town/TownLandscape';
import { PLOTS } from '../src/game/town/TownDiorama';

describe('An explorable town on rolling terrain', () => {
  it('keeps foundations on level ground while hills rise outside the town', () => {
    for (const [x, z] of Object.entries(PLOTS)
      .filter(([id]) => id !== 'bridge')
      .map(([, position]) => position))
      for (const dx of [-1.5, 0, 1.5])
        for (const dz of [-1.5, 0, 1.5]) expect(groundHeight(x + dx, z + dz)).toBe(0);
    expect(groundHeight(-38, -42)).toBeGreaterThan(1);
    expect(groundHeight(-38, -42)).toBeLessThan(5);
  });
  it('keeps all permitted orbit headings above the hills without changing distance', () => {
    const target = new Vector3(0, 0.7, 0);
    for (const radius of [13, 20, 30, 40, 53, 55])
      for (const tilt of [0.5, 1.1, Math.PI / 2 - 0.24])
        for (let degrees = 0; degrees < 360; degrees += 5) {
          const angle = (degrees * Math.PI) / 180;
          const position = new Vector3(
            radius * Math.sin(tilt) * Math.cos(angle),
            radius * Math.cos(tilt),
            radius * Math.sin(tilt) * Math.sin(angle),
          ).add(target);
          keepCameraAboveTerrain(position, target);
          expect(position.y - groundHeight(position.x, position.z)).toBeGreaterThanOrEqual(1.2);
          expect(position.distanceTo(target)).toBeCloseTo(radius, 8);
        }
  });
  it('leaves a clear camera pose unchanged', () => {
    const position = new Vector3(12, 12, 25),
      before = position.clone();
    expect(keepCameraAboveTerrain(position, new Vector3(0, 0.7, 0))).toBe(false);
    expect(position.equals(before)).toBe(true);
  });
});

it('keeps foreground parcels clear of intervening ridges at maximum zoom in every era', () => {
  for (const [centerX, radius, minX, maxX, maxZ] of [
    [0, 110, -15, 15, 20],
    [13, 160, -15, 50, 20],
    [17, 180, -23, 58, 28],
  ]) {
    const target = new Vector3(centerX, 0.7, 0);
    const parcels = Object.entries(PLOTS)
      .filter(([id, [x, z]]) => id !== 'bridge' && x >= minX && x <= maxX && z <= maxZ)
      .map(([, [x, z]]) => new Vector3(x, 0.2, z));
    for (let degrees = 0; degrees < 360; degrees += 15) {
      const angle = (degrees * Math.PI) / 180;
      const position = new Vector3(
        Math.cos(angle) * radius,
        radius * 0.25,
        Math.sin(angle) * radius,
      ).add(target);
      const distance = position.distanceTo(target);
      keepCameraAboveTerrain(position, target, 0.25, parcels);
      expect(position.distanceTo(target)).toBeCloseTo(distance, 8);
      // Independently sample each sightline more finely than the camera guard.
      for (const parcel of parcels) {
        let clearance = Infinity;
        for (let step = 1; step <= 300; step++) {
          const sample = parcel.clone().lerp(position, step / 300);
          clearance = Math.min(clearance, sample.y - groundHeight(sample.x, sample.z));
        }
        expect(clearance, `heading ${degrees}, parcel ${parcel.x},${parcel.z}`).toBeGreaterThan(0);
      }
    }
  }
});
