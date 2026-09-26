import { describe, expect, it } from 'vitest';
import { Scene, Vector3 } from 'three';
import { setTownAtmosphere } from '../src/game/town/TownAtmosphere';
import { landscapeGeometry } from '../src/game/town/TownMillrace';
import {
  groundHeight,
  cameraTerrainHeight,
  keepCameraAboveTerrain,
} from '../src/game/town/TownLandscape';
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

it('allows shallow views from clear ground even when a hill hides distant town parcels', () => {
  for (const [position, target] of [
    [new Vector3(0, 3, -60), new Vector3(0, 0.7, 0)],
    [new Vector3(28, 3, 35), new Vector3(-15, 0.7, -30)],
    [new Vector3(40, 3, 18), new Vector3(-25, 0.7, -35)],
  ]) {
    const before = position.clone();
    expect(position.y).toBeGreaterThan(cameraTerrainHeight(position.x, position.z) + 1.2);
    expect(keepCameraAboveTerrain(position, target)).toBe(false);
    expect(position.equals(before)).toBe(true);
  }
});
it('only lifts a camera that intersects the actual hillside, with no repeated upward drift', () => {
  const target = new Vector3(0, 0.7, 0);
  const position = new Vector3(0, 2, -25);
  const distance = position.distanceTo(target);
  expect(keepCameraAboveTerrain(position, target)).toBe(true);
  expect(position.y).toBeGreaterThanOrEqual(cameraTerrainHeight(position.x, position.z) + 1.2);
  expect(position.distanceTo(target)).toBeCloseTo(distance, 8);
  const corrected = position.clone();
  for (let i = 0; i < 20; i++) expect(keepCameraAboveTerrain(position, target)).toBe(false);
  expect(position.equals(corrected)).toBe(true);
});

it('keeps every village plot clear and reaches full fog before any terrain edge', () => {
  const scene = new Scene();
  setTownAtmosphere(scene);
  const geometry = landscapeGeometry();
  try {
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    expect(scene.fog.color.equals(scene.background)).toBe(true);
    expect(scene.fog.near).toBeLessThan(scene.fog.far);
    for (const [id, [x, z]] of Object.entries(PLOTS)) {
      const halfWidth = id === 'airport' ? 10 : 6;
      const halfDepth = id === 'airport' ? 20 : 6;
      expect(Math.abs(x) + halfWidth, `${id} remains outside the fog`).toBeLessThan(scene.fog.near);
      expect(Math.abs(z) + halfDepth, `${id} remains outside the fog`).toBeLessThan(scene.fog.near);
    }
    for (const edge of [min.x, max.x, min.z, max.z])
      expect(scene.fog.far).toBeLessThan(Math.abs(edge));
  } finally {
    geometry.dispose();
  }
});
