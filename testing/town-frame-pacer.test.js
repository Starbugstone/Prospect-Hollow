import { expect, it } from 'vitest';
import { TownFramePacer } from '../src/game/town/TownFramePacer';

// Simulate one second of display refreshes and count the frames the pacer draws.
function run(hz, seconds = 2) {
  const pacer = new TownFramePacer();
  const period = 1000 / hz;
  let drawn = 0;
  const frameTimes = [];
  for (let now = period; now <= seconds * 1000; now += period)
    if (pacer.due(now)) {
      drawn++;
      if (pacer.frameTime !== null) frameTimes.push(pacer.frameTime);
    }
  return { fps: drawn / seconds, frameTimes };
}

it.each([60, 75, 90, 120, 144, 165, 240])('draws about 60 fps on a %i Hz display', (hz) => {
  const { fps, frameTimes } = run(hz);
  expect(fps).toBeGreaterThanOrEqual(58);
  expect(fps).toBeLessThanOrEqual(61);
  // The quality sampler sees a healthy device as fast (under its 19 ms threshold).
  const sorted = [...frameTimes].sort((a, b) => a - b);
  expect(sorted[Math.floor(sorted.length * 0.75)]).toBeLessThan(19);
});

it('draws every refresh of a slower display and reports its real frame time', () => {
  const { fps, frameTimes } = run(30);
  expect(fps).toBeCloseTo(30, 0);
  expect(frameTimes.at(-1)).toBeCloseTo(1000 / 30, 1);
});

it('resynchronizes after a stall instead of drawing catch-up frames', () => {
  const pacer = new TownFramePacer();
  expect(pacer.due(16)).toBe(true);
  expect(pacer.due(1016)).toBe(true);
  expect(pacer.due(1020)).toBe(false);
  expect(pacer.due(1033)).toBe(true);
  pacer.reset();
  expect(pacer.due(1034)).toBe(true);
  expect(pacer.frameTime).toBeNull();
});

it('culls villagers outside the camera but keeps everyone while an inset shows the town', async () => {
  const { Group, Mesh, BoxGeometry, MeshStandardMaterial, PerspectiveCamera, Scene } =
    await import('three');
  const { TownActors } = await import('../src/game/town/TownActors');
  const scene = new Scene();
  const actors = new TownActors(scene);
  const geometry = new BoxGeometry(),
    material = new MeshStandardMaterial();
  const near = new Group(),
    far = new Group();
  near.add(new Mesh(geometry, material));
  far.add(new Mesh(geometry, material));
  far.position.set(0, 0, 200);
  scene.add(near, far);
  scene.updateMatrixWorld();
  actors.rebuild([near, far]);
  const camera = new PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0, -10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  actors.update(scene, [camera]);
  expect(actors.buckets[0].mesh.count).toBe(1);
  actors.update(scene, null);
  expect(actors.buckets[0].mesh.count).toBe(2);
  actors.dispose();
  geometry.dispose();
  material.dispose();
});
