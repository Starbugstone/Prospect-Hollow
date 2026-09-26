import { horizonMaterial } from './TownAtmosphere';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Vector3,
} from 'three';
import { PLOTS } from './TownLayout';

const clamp = (v) => Math.max(0, Math.min(1, v));
const COLORS = ['#ffd878', '#6fe8dc', '#f49fc3', '#b4acff', '#fff0bb'];
const SPARKS = 96;
const TRAIL = 6;

// Deterministic trajectories let the shared presentation clock own pause/resume.
// Everything is temporary; no town data or permanent material is changed.
export class TownCompletionFireworks {
  constructor(d) {
    this.d = d;
    this.root = new Group();
    this.root.name = 'Three-star town square celebration';
    d.scene.add(this.root);
    this.background = d.scene.background;
    this.fog = d.scene.fog?.color.clone();
    this.lights = [];
    d.scene.traverse((part) => {
      if (part.isLight) this.lights.push([part, part.intensity]);
    });
    this.night = new Color('#111c39');
    this.sky = this.background?.isColor ? this.background.clone() : this.night.clone();
    d.scene.background = this.sky;
    const [x, z] = PLOTS.square;
    this.origin = new Vector3(x, 0, z);
    this.bursts = Array.from({ length: 22 }, (_, i) => {
      const finale = i >= 13;
      const start = finale ? 11.3 + (i - 13) * 0.33 : 1.6 + i * 0.72;
      const angle = i * 2.39996;
      const center = new Vector3(
        x + Math.sin(angle) * 7.5,
        9 + (i % 4) * 1.7,
        z - 2 + Math.cos(angle) * 3,
      );
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new Float32BufferAttribute(new Float32Array(SPARKS * TRAIL * 3), 3),
      );
      geometry.setAttribute(
        'alpha',
        new Float32BufferAttribute(new Float32Array(SPARKS * TRAIL), 1),
      );
      const material = new ShaderMaterial({
        uniforms: { tint: { value: new Color(COLORS[i % COLORS.length]) }, size: { value: 4 } },
        vertexShader: `attribute float alpha; varying float opacity; uniform float size;
          void main() { opacity = alpha; vec4 p = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * p; gl_PointSize = size; }`,
        fragmentShader: `uniform vec3 tint; varying float opacity;
          void main() { float r = length(gl_PointCoord - 0.5) * 2.0;
            if (r > 1.0) discard;
            gl_FragColor = vec4(tint, opacity * pow(1.0 - r, 1.2)); }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      });
      const points = new Points(geometry, material);
      points.frustumCulled = false;
      this.root.add(points);
      return { start, center, points, geometry, material };
    });
    const star = new Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 0.46 : 1;
      if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    star.closePath();
    this.starGeometry = new ShapeGeometry(star);
    this.starMaterial = horizonMaterial(
      new MeshBasicMaterial({ color: '#ffda7a', toneMapped: false }),
    );
    this.stars = [-1, 0, 1].map((index) => {
      const mesh = new Mesh(this.starGeometry, this.starMaterial);
      mesh.position.set(x + index * 2.5, 6 + (index === 0 ? 0.6 : 0), z + 1);
      this.root.add(mesh);
      return mesh;
    });
    this.frame(0);
  }

  frame(time, still = false) {
    const dusk = still ? 0.7 : clamp(time / 2);
    this.sky.copy(this.background?.isColor ? this.background : this.night).lerp(this.night, dusk);
    if (this.fog) this.d.scene.fog.color.copy(this.fog).lerp(this.night, dusk);
    for (const [light, intensity] of this.lights) light.intensity = intensity * (1 - dusk * 0.9);
    for (const burst of this.bursts) {
      const age = time - burst.start;
      burst.points.visible = !still && age >= 0 && age < 3.8;
      if (!burst.points.visible) continue;
      burst.material.uniforms.size.value = Math.min(
        6,
        3.5 * (this.d.renderer.getPixelRatio?.() ?? 1),
      );
      const positions = burst.geometry.attributes.position;
      const alpha = burst.geometry.attributes.alpha;
      for (let i = 0; i < SPARKS; i++) {
        const vertical = 1 - (2 * (i + 0.5)) / SPARKS;
        const radius = Math.sqrt(1 - vertical * vertical);
        const angle = i * 2.39996;
        for (let tail = 0; tail < TRAIL; tail++) {
          const slot = i * TRAIL + tail;
          const t = Math.max(0, age - 0.85 - tail * 0.035);
          if (age < 0.85) {
            const rise = clamp((age - tail * 0.035) / 0.85);
            positions.setXYZ(
              slot,
              burst.center.x * rise,
              0.5 + (burst.center.y - 0.5) * rise,
              this.origin.z + (burst.center.z - this.origin.z) * rise,
            );
            alpha.setX(slot, i === 0 ? 1 - tail / TRAIL : 0);
          } else {
            const travel = 5 * (1 - Math.exp(-t * 0.9));
            positions.setXYZ(
              slot,
              burst.center.x + Math.cos(angle) * radius * travel,
              burst.center.y + vertical * travel - t * t * 0.8,
              burst.center.z + Math.sin(angle) * radius * travel,
            );
            const fade = clamp((3.8 - age) / 1.3);
            alpha.setX(
              slot,
              fade * (1 - tail / TRAIL) * (0.75 + 0.25 * Math.sin(i * 7 + time * 11)),
            );
          }
        }
      }
      positions.needsUpdate = true;
      alpha.needsUpdate = true;
    }
    this.stars.forEach((star, i) => {
      const reveal = still ? 1 : clamp((time - 9.5 - i * 0.55) / 0.8);
      star.visible = reveal > 0;
      star.scale.setScalar(reveal * (i === 1 ? 1.15 : 0.9));
      star.quaternion.copy(this.d.camera.quaternion);
    });
    const focus = this.origin.clone().add(new Vector3(0, 6.5, -1));
    const eye = this.origin.clone().add(new Vector3(4 - clamp(time / 18) * 3, 16, 33));
    if (this.d.camera.aspect < 1)
      eye
        .sub(focus)
        .multiplyScalar(1 / this.d.camera.aspect)
        .add(focus);
    return { eye, focus, shadowPhase: dusk };
  }

  dispose() {
    this.root.removeFromParent();
    this.d.scene.background = this.background;
    if (this.fog) this.d.scene.fog.color.copy(this.fog);
    for (const [light, intensity] of this.lights) light.intensity = intensity;
    for (const burst of this.bursts) {
      burst.geometry.dispose();
      burst.material.dispose();
    }
    this.starGeometry.dispose();
    this.starMaterial.dispose();
  }
}
