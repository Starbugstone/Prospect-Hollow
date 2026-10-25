import { ACESFilmicToneMapping, PCFShadowMap, SRGBColorSpace, Vector2, WebGLRenderer } from 'three';
import { TownRenderQuality } from './TownRenderQuality';

// Renderer plumbing shared by every settlement map: the valley's TownDiorama and the
// Moon's MoonScene.

/**
 * One renderer setup for every map: the measured drawing-buffer tier (TownRenderQuality),
 * soft shadows, sRGB output and filmic tone mapping at the map's own exposure.
 */
export function createTownRenderer(canvas, { exposure }) {
  const renderQuality = new TownRenderQuality(window.devicePixelRatio || 1);
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(renderQuality.ratio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  return { renderer, renderQuality };
}

/**
 * Adapts the drawing buffer and the sun's shadow map to the measured frame time, outside
 * presentations. `d` provides `renderQuality`, `renderer`, `sun` and an optional
 * `frameCache`. True when the tier changed.
 */
export function adaptRenderQuality(d, frameTime) {
  const ratio = d.renderQuality?.sample(frameTime);
  if (ratio === null || ratio === undefined) return false;
  d.renderer.setPixelRatio(ratio);
  const size = d.renderQuality.shadowSize;
  if (d.sun.shadow.mapSize.x !== size) {
    d.sun.shadow.map?.dispose();
    d.sun.shadow.map = null;
    d.sun.shadow.mapSize.set(size, size);
    d.renderer.shadowMap.needsUpdate = true;
  }
  if (d.frameCache) {
    d.frameCache.setSamples?.(d.renderQuality.cacheSamples);
    d.frameCache.valid = false;
  }
  return true;
}

/**
 * Camera, pointer and resize events can arrive faster than frames: a map draws only the
 * latest pose, once, on the next frame.
 */
export function requestTownFrame(d) {
  d.cameraFrame ||= requestAnimationFrame(() => {
    d.cameraFrame = 0;
    d.render();
  });
}

const pointer = new Vector2();
/** Points `raycaster` through a screen point on `canvas`; false while it has no size. */
export function aimAt(raycaster, camera, canvas, clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  if (!box.width || !box.height) return false;
  pointer.set(
    ((clientX - box.left) / box.width) * 2 - 1,
    -((clientY - box.top) / box.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  return true;
}

/**
 * A lost WebGL context stops the map's loop and hands recovery to its owner
 * (useGraphicsRecovery), which disposes the scene and rebuilds it on a fresh canvas.
 * No buffers or cached attachments cross graphics contexts. `d` provides `renderer`,
 * an optional `frameCache` and `onUnavailable(error, contextLost)`.
 */
export function loseContext(d, event) {
  event.preventDefault();
  d.contextUnavailable = true;
  if (d.frameCache) d.frameCache.valid = false;
  d.renderer.setAnimationLoop(null);
  d.onUnavailable?.(new Error('Town graphics context lost'), true);
}

/** Listens for `d.canvas` losing its context; returns the listener's remover. */
export function watchContextLoss(d) {
  const lost = (event) => d.handleContextLoss(event);
  d.canvas.addEventListener('webglcontextlost', lost);
  return () => d.canvas.removeEventListener('webglcontextlost', lost);
}
