import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial, Scene, Vector3 } from 'three';
import { TOWN_EDGE, horizonMaterial, setTownAtmosphere } from '../src/game/town/TownAtmosphere';
import { landscapeGeometry } from '../src/game/town/TownMillrace';
import { RAIL_EDGE } from '../src/game/town/TownLayout';
import { RIVER, riverCenterX, riverPath } from '../src/game/town/TownRiver';
import { PERSONAL_AREAS } from '../src/data/townPersonalisation';
import {
  groundHeight,
  cameraTerrainHeight,
  keepCameraAboveTerrain,
  landscapeGroundHeight,
} from '../src/game/town/TownLandscape';
import { PLOTS } from '../src/game/town/TownDiorama';

describe('An explorable town on rolling terrain', () => {
  it('keeps foundations on level ground while hills rise outside the town', () => {
    for (const [x, z] of Object.entries(PLOTS)
      .filter(([id]) => id !== 'bridge')
      .map(([, position]) => position))
      for (const dx of [-1.5, 0, 1.5])
        for (const dz of [-1.5, 0, 1.5]) expect(groundHeight(x + dx, z + dz)).toBe(0);
    // The space elevator levels the ridge's town-facing foot; it still rises behind.
    expect(groundHeight(-38, -56)).toBeGreaterThan(1);
    expect(groundHeight(-38, -56)).toBeLessThan(5);
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

it('keeps every plot and monument site clear and reaches full fog before any terrain edge', () => {
  const scene = new Scene();
  setTownAtmosphere(scene);
  const geometry = landscapeGeometry();
  try {
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    expect(scene.fog.color.equals(scene.background)).toBe(true);
    // A wide ring keeps the fade gradual rather than a hard wall.
    expect(scene.fog.far - scene.fog.near).toBeGreaterThanOrEqual(60);
    for (const [id, [x, z]] of Object.entries(PLOTS)) {
      const halfWidth = id === 'airport' ? 10 : 6;
      const halfDepth = id === 'airport' ? 20 : 6;
      expect(
        Math.hypot(Math.abs(x) + halfWidth, Math.abs(z) + halfDepth),
        `${id} remains outside the fog`,
      ).toBeLessThan(scene.fog.near);
    }
    for (const { id, positions, radius } of PERSONAL_AREAS)
      for (const [x, z] of positions)
        expect(Math.hypot(x, z) + radius, `${id} has open prairie before the fog`).toBeLessThan(
          scene.fog.near - 40,
        );
    // The fog is round, so the square terrain only has to reach its radius on each axis.
    for (const edge of [min.x, max.x, min.z, max.z]) expect(Math.abs(edge)).toBe(TOWN_EDGE);
    expect(scene.fog.far).toBeLessThan(TOWN_EDGE);
    // The river and railway run on into full fog instead of stopping in view.
    for (const [x, z] of [riverPath()[0], riverPath().at(-1), RAIL_EDGE.from, RAIL_EDGE.to])
      expect(Math.hypot(x, z)).toBeGreaterThan(scene.fog.far);
  } finally {
    geometry.dispose();
  }
});
it('keeps the river channel and railway cutting open across the coarse far terrain', () => {
  const geometry = landscapeGeometry();
  const p = geometry.attributes.position,
    index = geometry.index.array;
  // The surface the player sees between vertices, beyond the detailed core.
  const far = [];
  for (let i = 0; i < index.length; i += 3) {
    const corners = [index[i], index[i + 1], index[i + 2]].map((v) => [
      p.getX(v),
      p.getZ(v),
      landscapeGroundHeight(p.getX(v), p.getZ(v)),
    ]);
    if (corners.some(([x, z]) => Math.max(Math.abs(x), Math.abs(z)) > 130)) far.push(corners);
  }
  const surface = (x, z) => {
    for (const [[ax, az, ay], [bx, bz, by], [cx, cz, cy]] of far) {
      const area = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
      const u = ((x - ax) * (cz - az) - (cx - ax) * (z - az)) / area,
        v = ((bx - ax) * (z - az) - (x - ax) * (bz - az)) / area;
      if (u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9) return ay + u * (by - ay) + v * (cy - ay);
    }
    throw new Error(`no far terrain at ${x}, ${z}`);
  };
  try {
    for (let d = 131; d < TOWN_EDGE; d += 3)
      for (const z of [-d, d]) {
        // Water over the bed, then dry banks: no flooded trough beside the river.
        for (const dx of [-2.5, 0, 2.5])
          expect(surface(riverCenterX(z) + dx, z), `river at z ${z}`).toBeLessThan(
            RIVER.waterHeight - 0.2,
          );
        for (const dx of [-1, 1])
          expect(
            surface(riverCenterX(z) + dx * (RIVER.bankWidth + 1), z),
            `bank at z ${z}`,
          ).toBeGreaterThan(RIVER.waterHeight + 0.2);
      }
    for (let d = 131; d < TOWN_EDGE; d += 3)
      for (const x of [-d, d])
        for (const dz of [-0.85, 0, 0.85])
          expect(surface(x, RAIL_EDGE.from[1] + dz), `rail at x ${x}`).toBeLessThanOrEqual(0.01);
  } finally {
    geometry.dispose();
  }
});
it('measures fog by horizontal distance from the town center, giving a round horizon', () => {
  const material = horizonMaterial(new MeshStandardMaterial());
  const shader = { vertexShader: '#include <fog_vertex>', fragmentShader: '' };
  material.onBeforeCompile(shader);
  expect(shader.vertexShader).toContain('vFogDepth = length(horizonPosition.xz);');
  material.dispose();
});
