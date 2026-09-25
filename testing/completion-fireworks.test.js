import { expect, it, vi } from 'vitest';
import { Color, Fog, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three';
import { TownPresentation } from '../src/game/town/TownPresentation';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TOWN_PRESENTATIONS } from '../src/data/townPresentations';

it('keeps the final cinematic image intact while waiting for Continue', () => {
  const setPixelRatio = vi.fn();
  const d = {
    lastFrame: 1,
    elapsed: 0,
    presentation: {},
    renderQuality: { sample: () => 0.6 },
    renderer: { setPixelRatio },
    frameCache: { valid: true },
  };
  // Resizing a WebGL drawing buffer clears it. The presentation owns rendering
  // and stops emitting frames at its end, so background quality tuning must wait.
  for (let i = 1; i <= 100; i++) TownDiorama.prototype.tick.call(d, i * 50);
  expect(setPixelRatio).not.toHaveBeenCalled();
  expect(d.frameCache.valid).toBe(true);
});

it('animates rockets and the finale, supports a still, and restores camera, lighting and resources', () => {
  const scene = new Scene();
  scene.background = new Color('#e9e8da');
  scene.fog = new Fog('#e9e8da', 125, 205);
  const light = new HemisphereLight('#ffffff', '#aaaaaa', 2);
  scene.add(light);
  const d = {
    scene,
    camera: new PerspectiveCamera(40, 1.6, 0.1, 400),
    controls: { target: new Vector3(), enabled: true },
    motions: [],
    motionEnabled: false,
    elapsed: 0,
    actorRenderer: { update() {} },
    renderer: { shadowMap: {} },
    frameCache: { valid: true },
    render() {},
  };
  d.camera.position.set(12, 12, 25);
  const pose = d.camera.position.clone(),
    background = scene.background,
    fog = scene.fog.color.clone();
  const presentation = new TownPresentation(d, TOWN_PRESENTATIONS['three-star-celebration']);
  const effect = presentation.effect;
  const disposed = vi.spyOn(effect.bursts[0].geometry, 'dispose');
  expect(d.controls.enabled).toBe(false);
  presentation.frame(2);
  expect(effect.bursts.some((b) => b.points.visible)).toBe(true);
  expect(light.intensity).toBeLessThan(2);
  presentation.frame(12);
  const burst = effect.bursts.find((b) => b.points.visible);
  const positions = Array.from(burst.geometry.attributes.position.array);
  presentation.frame(12);
  expect(Array.from(burst.geometry.attributes.position.array)).toEqual(positions);
  expect(effect.stars.every((s) => s.visible)).toBe(true);
  const beforeStill = d.camera.position.clone();
  presentation.frame(18, true);
  expect(effect.bursts.every((b) => !b.points.visible)).toBe(true);
  expect(effect.stars.every((s) => s.visible)).toBe(true);
  expect(d.camera.position.equals(beforeStill)).toBe(true);
  d.camera.aspect = 0.45;
  const portrait = effect.frame(12);
  expect(portrait.eye.distanceTo(portrait.focus)).toBeGreaterThan(60);
  presentation.dispose();
  expect(effect.root.parent).toBeNull();
  expect(disposed).toHaveBeenCalledOnce();
  expect(d.camera.position.equals(pose)).toBe(true);
  expect(d.controls.enabled).toBe(true);
  expect(scene.background).toBe(background);
  expect(scene.fog.color.equals(fog)).toBe(true);
  expect(light.intensity).toBe(2);
});
