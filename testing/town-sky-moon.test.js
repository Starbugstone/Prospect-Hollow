import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import { SKY_MOON_ANGLE, SKY_MOON_DIRECTION, SKY_MOON_ELEVATION } from '../src/data/skyCraft';
import { moonSettlement } from '../src/data/moonSettlement';
import { createTown } from '../src/data/town';
import { SKY_MOON_DISTANCE, SKY_MOON_HEADING, TownSkyMoon } from '../src/game/town/TownSkyMoon';

// The valley's Moon hangs in one sky direction like a real moon (and like Earth over the
// Moon's crater rim): orbiting or zooming never moves it across the land, and it is drawn
// in the scene (the static layer), so hills hide it and birds and saucers fly in front.
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

it('hangs in one sky direction, about 10° above the horizon, beyond the town', () => {
  const moon = new TownSkyMoon(new Scene());
  const [x, z] = SKY_MOON_DIRECTION;
  const flat = Math.hypot(SKY_MOON_HEADING.x, SKY_MOON_HEADING.z);
  expect(SKY_MOON_HEADING.x / flat).toBeCloseTo(x / Math.hypot(x, z));
  expect(SKY_MOON_HEADING.z / flat).toBeCloseTo(z / Math.hypot(x, z));
  expect(SKY_MOON_HEADING.y / flat).toBeCloseTo(SKY_MOON_ELEVATION);
  const view = camera([0, 20, 40], [0, 0, 0]);
  moon.follow(view);
  expect(moon.sprite.position.distanceTo(view.position)).toBeCloseTo(SKY_MOON_DISTANCE);
  // Static layer: the animated foreground (birds, saucers) draws over it; hills hide it.
  expect(moon.sprite.layers.mask).toBe(1);
  expect(moon.sprite.material.depthTest).toBe(true);
  expect(moon.sprite.material.depthWrite).toBe(false);
  expect(moon.sprite.material.fog).toBe(false);
  moon.dispose();
});

it('stays put in the sky as the camera orbits or zooms, and leaves when it looks down', () => {
  const moon = new TownSkyMoon(new Scene());
  moon.show(moonSettlement({ ...createTown(), buildings: { spaceElevator: 3 } }).lights);
  const toward = (eye) => {
    const target = new Vector3(...eye).addScaledVector(SKY_MOON_HEADING, 100);
    return moon.screenPoint(camera(eye, target.toArray()));
  };
  // Two cameras far apart, both facing its direction, see it at the same spot: no parallax.
  const near = toward([0, 8, 30]);
  const far = toward([60, 40, -90]);
  expect(near.visible).toBe(true);
  expect([far.x, far.y]).toEqual([expect.closeTo(near.x, 6), expect.closeTo(near.y, 6)]);
  expect(near.x).toBeCloseTo(50, 0);
  // Its angular size is fixed: about SKY_MOON_ANGLE of a 40° view.
  expect((near.radius * 2) / 100).toBeCloseTo(
    Math.tan(SKY_MOON_ANGLE / 2) / Math.tan((20 * Math.PI) / 180),
    2,
  );
  // Looking down at the town, it is above the frame and its tap target goes with it.
  const down = moon.screenPoint(camera([10, 220, 220], [5, 0, 5]));
  expect(down.visible).toBe(false);
  expect(down.y).toBeLessThan(0);
  // Turned away, it is behind the camera.
  expect(moon.screenPoint(camera([0, 20, 40], [0, 20, 200])).visible).toBe(false);
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

it('follows the camera before each frame so it never drifts across the land', () => {
  const moon = new TownSkyMoon(new Scene());
  for (const eye of [
    [90, 5, -30],
    [-50, 200, 80],
  ]) {
    const view = camera(eye, [0, 0, 0]);
    moon.follow(view);
    const offset = moon.sprite.position.clone().sub(view.position);
    expect(offset.normalize().distanceTo(SKY_MOON_HEADING)).toBeLessThan(1e-9);
  }
  moon.dispose();
});
