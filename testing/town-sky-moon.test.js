import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { SKY_MOON_REACH, SKY_MOON_SIZE } from '../src/data/skyCraft';
import { moonSettlement } from '../src/data/moonSettlement';
import { createTown } from '../src/data/town';
import { SAUCER_PAD, SAUCER_ROUTES, skyMoonPosition } from '../src/game/town/TownAviation';
import { TownSkyMoon } from '../src/game/town/TownSkyMoon';

// The valley's Moon hangs at one fixed point in the world: turning or tilting the camera
// moves it with the land, and it is drawn in the scene (the static layer), so birds and
// saucers in the animated foreground fly in front of it.
let painted;
beforeEach(() => {
  painted = 0;
  const context = new Proxy(
    { createRadialGradient: () => ({ addColorStop() {} }) },
    { get: (target, key) => target[key] ?? (() => key === 'fill' && painted++) },
  );
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => context }),
  });
  vi.stubGlobal('Path2D', class {});
});
afterEach(() => vi.unstubAllGlobals());

const camera = (position, target) => {
  const view = new PerspectiveCamera(40, 16 / 9, 0.1, 700);
  view.position.set(...position);
  view.lookAt(...target);
  view.updateMatrixWorld();
  return view;
};

it('hangs on the saucer’s moon route, fixed in the world', () => {
  const moon = new TownSkyMoon(new Scene());
  const anchor = skyMoonPosition();
  expect(moon.sprite.position.equals(anchor)).toBe(true);
  const { heading } = SAUCER_ROUTES.moon;
  expect(anchor.x).toBeCloseTo(SAUCER_PAD.x + heading[0] * SKY_MOON_REACH);
  expect(anchor.z).toBeCloseTo(SAUCER_PAD.z + heading[1] * SKY_MOON_REACH);
  expect(anchor.y).toBeGreaterThan(SKY_MOON_SIZE / 2);
  // Static layer: the animated foreground (birds, saucers) draws over it.
  expect(moon.sprite.layers.mask).toBe(1);
  expect(moon.sprite.material.depthWrite).toBe(false);
  expect(moon.sprite.material.fog).toBe(false);
  moon.dispose();
});

it('moves on screen with the land and leaves the frame when the camera looks down', () => {
  const moon = new TownSkyMoon(new Scene());
  moon.show(moonSettlement({ ...createTown(), buildings: { spaceElevator: 3 } }).lights);
  const anchor = skyMoonPosition();
  // Looking toward it, it is on screen, at the same world point from two cameras.
  const toward = moon.screenPoint(camera([0, 20, 40], [anchor.x, anchor.y, anchor.z]));
  expect(toward.visible).toBe(true);
  expect(toward.x).toBeCloseTo(50, 0);
  expect(toward.y).toBeCloseTo(50, 0);
  const aside = moon.screenPoint(camera([0, 20, 40], [anchor.x + 60, anchor.y, anchor.z]));
  expect(aside.visible).toBe(true);
  expect(aside.x).toBeLessThan(toward.x);
  // Tilted down at the town, it is above the frame: no clamping keeps it in view.
  const down = moon.screenPoint(camera([10, 60, 40], [5, 0, 5]));
  expect(down.visible).toBe(false);
  expect(down.y).toBeLessThan(0);
  // Turned away, it is behind the camera.
  const away = moon.screenPoint(camera([0, 20, 40], [0, 20, 200]));
  expect(away.visible).toBe(false);
  moon.dispose();
});

it('shows only with homesteads and repaints only when the lights change', () => {
  const moon = new TownSkyMoon(new Scene());
  expect(moon.sprite.visible).toBe(false);
  expect(moon.show([])).toBe(false);
  const lights = moonSettlement({ ...createTown(), buildings: { spaceElevator: 2 } }).lights;
  expect(lights.length).toBeGreaterThan(0);
  expect(moon.show(lights)).toBe(true);
  expect(moon.sprite.visible).toBe(true);
  const fills = painted;
  expect(fills).toBeGreaterThan(lights.length);
  expect(moon.show([...lights])).toBe(false);
  expect(painted).toBe(fills);
  expect(moon.show([])).toBe(true);
  expect(moon.sprite.visible).toBe(false);
  moon.dispose();
});

it('keeps its world position whatever the camera does', () => {
  const moon = new TownSkyMoon(new Scene());
  const before = moon.sprite.position.clone();
  moon.screenPoint(camera([90, 5, -30], [0, 0, 0]));
  moon.screenPoint(camera([-50, 200, 80], [0, 0, 0]));
  expect(moon.sprite.position.equals(before)).toBe(true);
  expect(before.distanceTo(new Vector3())).toBeGreaterThan(SKY_MOON_REACH / 2);
  moon.dispose();
});
