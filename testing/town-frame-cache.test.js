import { expect, it, vi } from 'vitest';
import { Color, PerspectiveCamera, Scene, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { beginEventCamera, restoreEventCamera } from '../src/game/town/TownEventCamera';
import { TownFrameCache } from '../src/game/town/TownFrameCache';

it('keeps villagers and raid time moving while the camera owns the next draw', () => {
  const actor = {},
    scene = {
      cameraFrame: 1,
      lastFrame: 1000,
      elapsed: 0,
      actors: [actor],
      animatePerson: vi.fn(),
      motions: [vi.fn()],
      actorRenderer: { update: vi.fn() },
      frameCache: { render: vi.fn() },
      drawFrame: TownDiorama.prototype.drawFrame,
    };
  TownDiorama.prototype.tick.call(scene, 1017);
  expect(scene.elapsed).toBeCloseTo(0.017);
  expect(scene.animatePerson).toHaveBeenCalledWith(actor, scene.elapsed);
  expect(scene.motions[0]).toHaveBeenCalledWith(scene.elapsed);
  expect(scene.frameCache.render).not.toHaveBeenCalled();
  scene.cameraFrame = 0;
  TownDiorama.prototype.tick.call(scene, 1034);
  expect(scene.frameCache.render).toHaveBeenCalledOnce();
});

it('reuses scenery between animation frames, refreshing after camera/building changes or resize', () => {
  let width = 390;
  const renders = [],
    renderer = {
      autoClear: true,
      getDrawingBufferSize: (size) => size.set(width, 480),
      setRenderTarget: vi.fn(),
      render(scene, camera) {
        renders.push({ scene, layers: camera.layers.mask, clear: this.autoClear });
      },
    };
  const town = new Scene(),
    camera = new PerspectiveCamera();
  town.background = new Color('#e9e8da');
  const background = town.background,
    layers = camera.layers.mask;
  const cache = new TownFrameCache(renderer);
  cache.render(town, camera);
  cache.render(town, camera);
  expect(renders.filter((r) => r.scene === town && r.layers === 1)).toHaveLength(1);
  expect(renders.filter((r) => r.scene === town && r.layers === 4)).toHaveLength(2);
  expect(renders.filter((r) => r.layers === 4).every((r) => !r.clear)).toBe(true);
  expect(camera.layers.mask).toBe(layers);
  expect(town.background).toBe(background);
  expect(renderer.autoClear).toBe(true);
  cache.render(town, camera, true);
  width = 844;
  cache.render(town, camera);
  expect(renders.filter((r) => r.scene === town && r.layers === 1)).toHaveLength(3);
  expect(cache.target.width).toBe(844);
  expect(cache.material.uniforms.townDepth.value).toBe(cache.target.depthTexture);
  const dispose = vi.spyOn(cache.target, 'dispose');
  cache.dispose();
  expect(dispose).toHaveBeenCalledOnce();
});

it('refreshes a village returning at the same size without reallocating its drawing buffer', () => {
  const scene = {
    canvas: { clientWidth: 390, clientHeight: 844 },
    width: 390,
    height: 844,
    renderer: { setSize: vi.fn() },
    render: vi.fn(),
  };
  const resize = () => TownDiorama.prototype.resize.call(scene);
  resize();
  expect(scene.render).not.toHaveBeenCalled();
  scene.canvas.clientWidth = scene.canvas.clientHeight = 0;
  resize();
  expect(scene.render).not.toHaveBeenCalled();
  Object.assign(scene.canvas, { clientWidth: 390, clientHeight: 844 });
  resize();
  expect(scene.render).toHaveBeenCalledOnce();
  expect(scene.renderer.setSize).not.toHaveBeenCalled();
  resize();
  expect(scene.render).toHaveBeenCalledOnce();
});

it('restores renderer state after an interrupted frame so later renders can recover', () => {
  let fail = true;
  const renderer = {
    autoClear: true,
    getDrawingBufferSize: (size) => size.set(390, 844),
    setRenderTarget: vi.fn(),
    render: vi.fn(() => {
      if (fail) throw new Error('GPU allocation failed');
    }),
  };
  const cache = new TownFrameCache(renderer);
  const town = new Scene(),
    camera = new PerspectiveCamera();
  town.background = new Color('#e9e8da');
  camera.layers.enable(2);
  const background = town.background,
    layers = camera.layers.mask;
  expect(() => cache.render(town, camera)).toThrow('GPU allocation failed');
  expect(cache.valid).toBe(false);
  expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null);
  expect(town.background).toBe(background);
  expect(camera.layers.mask).toBe(layers);
  expect(renderer.autoClear).toBe(true);
  fail = false;
  cache.render(town, camera);
  expect(cache.valid).toBe(true);
  cache.dispose();
});

it('requests a clean rebuild on context loss and stops drawing invalid buffers', () => {
  const view = {
    frameCache: { valid: true },
    renderer: { setAnimationLoop: vi.fn() },
    onUnavailable: vi.fn(),
  };
  const event = { preventDefault: vi.fn() };
  TownDiorama.prototype.handleContextLoss.call(view, event);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(view.contextUnavailable).toBe(true);
  expect(view.frameCache.valid).toBe(false);
  expect(view.renderer.setAnimationLoop).toHaveBeenCalledWith(null);
  expect(view.onUnavailable).toHaveBeenCalledWith(expect.any(Error), true);
});

it('stops animation and requests the playable fallback when drawing fails', () => {
  const error = new Error('Town framebuffer unavailable');
  const view = {
    frameCache: {
      render: () => {
        throw error;
      },
    },
    renderer: { setAnimationLoop: vi.fn() },
    onUnavailable: vi.fn(),
  };
  expect(TownDiorama.prototype.drawFrame.call(view, true)).toBe(false);
  expect(view.contextUnavailable).toBe(true);
  expect(view.renderer.setAnimationLoop).toHaveBeenCalledWith(null);
  expect(view.onUnavailable).toHaveBeenCalledWith(error);
});

it('validates GPU attachments on allocation and resize, without synchronizing every camera frame', () => {
  let width = 390;
  const gl = {
    FRAMEBUFFER: 1,
    FRAMEBUFFER_COMPLETE: 2,
    isContextLost: () => false,
    checkFramebufferStatus: vi.fn(() => 2),
  };
  const renderer = {
    autoClear: true,
    getContext: () => gl,
    getDrawingBufferSize: (size) => size.set(width, 480),
    setRenderTarget: vi.fn(),
    render: vi.fn(),
  };
  const cache = new TownFrameCache(renderer),
    scene = new Scene(),
    camera = new PerspectiveCamera();
  for (let i = 0; i < 120; i++) {
    cache.valid = false;
    cache.render(scene, camera);
  }
  expect(gl.checkFramebufferStatus).toHaveBeenCalledTimes(1);
  width = 844;
  cache.render(scene, camera);
  expect(gl.checkFramebufferStatus).toHaveBeenCalledTimes(2);
  cache.dispose();
});

it('reprojects action anchors during event zoom and return, then stops updating the settled overlay', () => {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    camera: new PerspectiveCamera(40, 1.6, 0.1, 400),
    controls: { target: new Vector3(0, 1, 0), enabled: true },
    elapsed: 0,
    canvas: { clientWidth: 1280, clientHeight: 800 },
    town: { buildings: { bank: 1 }, projects: {} },
    anchors: [
      {
        id: 'bank',
        position: new Vector3(-7, 2, -12),
        collection: new Vector3(-7, 4, -12),
        width: 90,
      },
    ],
    actorRenderer: { update: vi.fn() },
    frameCache: { valid: true },
    onLabels: vi.fn(),
    drawFrame: () => {
      d.camera.updateMatrixWorld();
      return true;
    },
    raid: { target: 'bank', event: { targets: ['bank'] }, update: () => false },
  });
  d.camera.position.set(40, 30, 50);
  d.camera.lookAt(d.controls.target);
  d.camera.updateMatrixWorld();
  d.projectLabels();
  const original = d.onLabels.mock.lastCall[0][0].collection;
  beginEventCamera(d);
  for (let i = 0; i <= 180; i++) d.tick(1000 + i * 20);
  const zoomed = d.onLabels.mock.lastCall[0][0].collection;
  const projected = d.anchors[0].collection.clone().project(d.camera);
  expect(zoomed.x).toBeCloseTo((projected.x + 1) * 50, 6);
  expect(zoomed.y).toBeCloseTo((1 - projected.y) * 50, 6);
  expect(Math.hypot(zoomed.x - original.x, zoomed.y - original.y)).toBeGreaterThan(1);
  restoreEventCamera(d);
  d.raid = null;
  for (let i = 181; i <= 250; i++) d.tick(1000 + i * 20);
  expect(d.eventCamera).toBeNull();
  const restored = d.onLabels.mock.lastCall[0][0].collection;
  expect(restored.x).toBeCloseTo(original.x, 6);
  expect(restored.y).toBeCloseTo(original.y, 6);
  const calls = d.onLabels.mock.calls.length;
  for (let i = 251; i <= 270; i++) d.tick(1000 + i * 20);
  expect(d.onLabels).toHaveBeenCalledTimes(calls);
});
