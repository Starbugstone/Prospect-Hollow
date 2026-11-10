import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { PERSONAL_AREAS, siteYaw } from '../src/data/townLandmarks';
import { monumentPresentation } from '../src/data/townPresentations';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { monumentModel } from '../src/game/town/TownMonumentWorks';
import { TownMonumentUnveiling } from '../src/game/town/TownMonumentUnveiling';
import { TownPresentation } from '../src/game/town/TownPresentation';
import {
  cameraTerrainHeight,
  groundHeight,
  keepCameraAboveTerrain,
  clearCinematicTerrain,
} from '../src/game/town/TownLandscape';
import { moonHeight } from '../src/game/town/moon/MoonScene';
import {
  beginEventCamera,
  restoreEventCamera,
  updateEventCamera,
} from '../src/game/town/TownEventCamera';

function clearance(eye, focus, height) {
  const base = Math.min(focus.y, height(focus.x, focus.z) + 0.25);
  const steps = Math.ceil(Math.hypot(eye.x - focus.x, eye.z - focus.z) / 0.2);
  let minimum = Infinity;
  for (let n = 1; n <= steps; n++) {
    const t = n / steps;
    const x = focus.x + (eye.x - focus.x) * t;
    const z = focus.z + (eye.z - focus.z) * t;
    minimum = Math.min(minimum, base + (eye.y - base) * t - height(x, z));
  }
  return minimum;
}

describe('Cinematic subjects stay visible over settlement terrain', () => {
  it('clears an intervening ridge without changing heading, drifting or moving a clear shot', () => {
    const height = (x) => 6 * Math.exp(-((x - 5) ** 2));
    const target = new Vector3(0, 2, 0);
    const eye = new Vector3(10, 2, 0);
    expect(clearance(eye, target, height)).toBeLessThan(0);
    expect(clearCinematicTerrain(eye, target, height)).toBe(true);
    expect(clearance(eye, target, height)).toBeGreaterThan(0);
    expect([eye.x, eye.z]).toEqual([10, 0]);
    const held = eye.clone();
    for (let n = 0; n < 60; n++) expect(clearCinematicTerrain(eye, target, height)).toBe(false);
    expect(eye.equals(held)).toBe(true);
    const clear = new Vector3(10, 20, 0);
    expect(clearCinematicTerrain(clear, target, height)).toBe(false);
    expect(clear.toArray()).toEqual([10, 20, 0]);
  });

  it('keeps the return flight above each map’s terrain and restores the exact player pose', () => {
    for (const height of [cameraTerrainHeight, moonHeight]) {
      const d = {
        camera: new PerspectiveCamera(45, 1.6, 0.1, 500),
        controls: { target: new Vector3(0, 0.7, 0), enabled: true },
        terrainHeight: height,
        elapsed: 0,
      };
      d.camera.position.set(0, 4, 90);
      keepCameraAboveTerrain(d.camera.position, d.controls.target, undefined, height);
      const saved = d.camera.position.clone();
      beginEventCamera(d);
      d.camera.position.set(0, 4, -90);
      keepCameraAboveTerrain(d.camera.position, d.controls.target, undefined, height);
      restoreEventCamera(d);
      for (let n = 1; n <= 72; n++) {
        d.elapsed = n / 60;
        updateEventCamera(d);
        expect(
          d.camera.position.y - height(d.camera.position.x, d.camera.position.z),
        ).toBeGreaterThanOrEqual(1.2 - 1e-6);
      }
      expect(d.camera.position.distanceTo(saved)).toBeLessThan(1e-9);
      expect(d.controls.target.toArray()).toEqual([0, 0.7, 0]);
      expect(d.eventCamera).toBeNull();
      expect(d.controls.enabled).toBe(true);
    }
  });

  it.each(PERSONAL_AREAS.map((area) => [area.id, area]))(
    '%s keeps its monument court visible throughout portrait and landscape shots',
    (id, area) => {
      const primitives = new TownPrimitives();
      const height = area.settlement === 'moon' ? moonHeight : cameraTerrainHeight;
      const surface = area.settlement === 'moon' ? moonHeight : groundHeight;
      const [x, z] = area.positions[0];
      try {
        for (const choice of area.choices)
          for (const level of area.timeless ? [1] : [1, 3, 5]) {
            const definition = monumentPresentation(id, choice, level);
            const { model, extent } = monumentModel(primitives, choice, level, area.timeless);
            primitives.clearGroup(model.parent);
            for (const aspect of [390 / 844, 1.6]) {
              for (const start of [
                [0, 26, 66],
                [0, 4, 90],
              ]) {
                const d = {
                  camera: new PerspectiveCamera(45, aspect, 0.1, 500),
                  controls: { target: new Vector3(0, 0.7, 0) },
                  renderer: { shadowMap: {} },
                  terrainHeight: height,
                  render() {},
                };
                d.camera.position.fromArray(start);
                keepCameraAboveTerrain(d.camera.position, d.controls.target, undefined, height);
                d.eventCamera = {
                  position: d.camera.position.clone(),
                  target: d.controls.target.clone(),
                };
                const shot = Object.assign(Object.create(TownMonumentUnveiling.prototype), {
                  d,
                  definition,
                  area,
                  origin: new Vector3(x, surface(x, z), z),
                  yaw: siteYaw(area),
                  height: extent.max.y,
                });
                const presentation = Object.assign(Object.create(TownPresentation.prototype), {
                  d,
                  effect: { frame: (time) => shot.shot(time) },
                });
                let worst = { clearance: Infinity };
                for (let time = 0; time <= definition.duration; time += 0.25) {
                  presentation.frame(time);
                  const gap = clearance(d.camera.position, d.controls.target, height);
                  if (gap < worst.clearance) worst = { clearance: gap, time };
                }
                expect(
                  worst.clearance,
                  `${id}/${choice}/${level}, aspect ${aspect}, start ${start}: ${JSON.stringify(worst)}`,
                ).toBeGreaterThan(0);
              }
            }
          }
      } finally {
        primitives.disposePrimitives();
      }
    },
    60000,
  );
});
