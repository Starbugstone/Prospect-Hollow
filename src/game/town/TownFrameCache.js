import {
  AlwaysDepth,
  DepthTexture,
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from 'three';

// The town only changes when the camera or a building changes. Cache its color
// AND depth so moving people remain correctly hidden by porches, hills and walls.
export class TownFrameCache {
  constructor(renderer, samples = 2) {
    this.renderer = renderer;
    this.size = new Vector2();
    this.target = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      depthTexture: new DepthTexture(1, 1),
      samples,
    });
    this.material = new ShaderMaterial({
      uniforms: {
        townColor: { value: this.target.texture },
        townDepth: { value: this.target.depthTexture },
      },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `uniform sampler2D townColor;
        uniform sampler2D townDepth;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(townColor, vUv);
          gl_FragDepth = texture2D(townDepth, vUv).r;
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthFunc: AlwaysDepth,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.scene = new Scene();
    this.scene.add(this.quad);
    this.camera = new OrthographicCamera();
    this.valid = false;
    this.targetValidated = false;
  }
  render(scene, camera, refresh = false) {
    const renderer = this.renderer;
    renderer.getDrawingBufferSize(this.size);
    if (!this.size.x || !this.size.y || renderer.getContext?.().isContextLost()) {
      this.valid = false;
      return;
    }
    if (this.target.width !== this.size.x || this.target.height !== this.size.y) {
      this.target.setSize(this.size.x, this.size.y);
      this.targetValidated = false;
      this.valid = false;
    }
    const layers = camera.layers.mask,
      background = scene.background,
      autoClear = renderer.autoClear;
    const previousTarget = renderer.getRenderTarget?.() ?? null;
    try {
      if (refresh || !this.valid) {
        this.valid = false;
        camera.layers.set(0);
        renderer.setRenderTarget(this.target);
        const gl = renderer.getContext?.();
        if (
          !this.targetValidated &&
          gl &&
          gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE
        )
          throw new Error('Town framebuffer unavailable');
        this.targetValidated = true;
        renderer.render(scene, camera);
        this.valid = true;
      }
      renderer.setRenderTarget(previousTarget);
      renderer.render(this.scene, this.camera);
      renderer.autoClear = false;
      camera.layers.set(2);
      scene.background = null;
      renderer.render(scene, camera);
    } catch (error) {
      this.valid = false;
      throw error;
    } finally {
      renderer.setRenderTarget(previousTarget);
      scene.background = background;
      camera.layers.mask = layers;
      renderer.autoClear = autoClear;
    }
  }
  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
