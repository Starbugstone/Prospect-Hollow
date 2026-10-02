import {
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
} from 'three';
import { frameEnd, frameStart } from './TownProfiler';
// Shared secondary view for fixed incidents and passive visitor arrivals.
export function eventInsetRect(width, height) {
  const w = Math.floor(Math.min(320, Math.max(156, width * 0.4), width * 0.46, height * 0.45));
  return { x: width - w - 12, y: 16, width: w, height: Math.floor(w / 1.5) };
}
// Main-view DOM labels must not paint over the secondary WebGL viewport.
// Coordinates are CSS pixels from the top-left; the renderer's inset Y is bottom-up.
export function overlapsEventInset(d, x, y, width, height = 44) {
  if (!d.eventInsetVisible) return false;
  const rect = eventInsetRect(d.canvas.clientWidth, d.canvas.clientHeight);
  const top = d.canvas.clientHeight - rect.y - rect.height;
  return (
    x + width / 2 > rect.x - 4 &&
    x - width / 2 < rect.x + rect.width + 4 &&
    y + height / 2 > top - 26 &&
    y - height / 2 < top + rect.height + 4
  );
}
export function hideEventInset(d) {
  if (!d.eventInsetVisible) return;
  d.eventInsetVisible = false;
  d.onEventInset?.(null);
}
// On the high render tier the inset draws every frame. Lower tiers redraw the scene
// into a small offscreen image at 30 Hz and show that image on the frames between,
// so the main view keeps its full frame rate on slower devices.
const INSET_INTERVAL = 1000 / 30;
const insetCaches = new WeakMap();
function insetCache(d) {
  let cache = insetCaches.get(d);
  if (!cache) {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 2 });
    const material = new ShaderMaterial({
      uniforms: { inset: { value: target.texture } },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `uniform sampler2D inset;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(inset, vUv);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
    });
    const scene = new Scene();
    scene.add(new Mesh(new PlaneGeometry(2, 2), material));
    cache = {
      target,
      material,
      scene,
      camera: new OrthographicCamera(),
      renderedAt: -Infinity,
      shot: null,
    };
    insetCaches.set(d, cache);
  }
  return cache;
}
export function drawCameraInset(d, shot, rect, label, passive = false, details = {}) {
  // A following name tag re-renders the overlay only when it moves visibly (0.5%).
  const tag = details.nameTag;
  const signature = `${rect.width}:${rect.height}:${rect.x}:${label}:${passive}:${
    tag ? `${tag.name}:${Math.round(tag.x * 2)}:${Math.round(tag.y * 2)}` : ''
  }`;
  if (!d.eventInsetVisible || signature !== d.insetSignature) {
    d.onEventInset?.({ ...rect, label, passive, ...details });
    d.insetSignature = signature;
    d.eventInsetVisible = true;
  }
  const renderer = d.renderer;
  renderer.getViewport(shot.viewport);
  renderer.getScissor(shot.scissor);
  const scissorTest = renderer.getScissorTest();
  const autoClear = renderer.autoClear;
  const cached = d.renderQuality?.tier !== undefined && d.renderQuality.tier !== 'high';
  try {
    const started = frameStart();
    if (cached) {
      const cache = insetCache(d);
      const ratio = renderer.getPixelRatio();
      const width = Math.max(1, Math.round(rect.width * ratio)),
        height = Math.max(1, Math.round(rect.height * ratio));
      const now = performance.now();
      if (cache.target.width !== width || cache.target.height !== height) {
        cache.target.setSize(width, height);
        cache.renderedAt = -Infinity;
      }
      if (now - cache.renderedAt >= INSET_INTERVAL || cache.shot !== shot) {
        const previous = renderer.getRenderTarget();
        renderer.setRenderTarget(cache.target);
        renderer.autoClear = true;
        renderer.render(d.scene, shot.insetCamera);
        renderer.setRenderTarget(previous);
        cache.renderedAt = now;
        cache.shot = shot;
      }
      renderer.setViewport(rect.x, rect.y, rect.width, rect.height);
      renderer.setScissor(rect.x, rect.y, rect.width, rect.height);
      renderer.setScissorTest(true);
      renderer.autoClear = false;
      renderer.render(cache.scene, cache.camera);
    } else {
      renderer.setViewport(rect.x, rect.y, rect.width, rect.height);
      renderer.setScissor(rect.x, rect.y, rect.width, rect.height);
      renderer.setScissorTest(true);
      renderer.autoClear = true;
      renderer.render(d.scene, shot.insetCamera);
    }
    frameEnd('inset', started);
  } finally {
    renderer.setViewport(shot.viewport);
    renderer.setScissor(shot.scissor);
    renderer.setScissorTest(scissorTest);
    renderer.autoClear = autoClear;
  }
}
