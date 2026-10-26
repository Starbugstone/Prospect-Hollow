import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';

// Two simple surfaces per plot, cached with the town. Normal depth testing lets
// walls and neighboring buildings hide the glow; no overlay particles or bloom.
// The fading wall is a faint band around the base: a tall building or a tower
// never raises it into a pillar.
export const GLOW_WALL = Object.freeze({ share: 0.45, min: 0.6, max: 1.2 });
const wallHeight = (height) =>
  Math.min(GLOW_WALL.max, Math.max(GLOW_WALL.min, height * GLOW_WALL.share));
export class TownUpgradeGlow {
  constructor(scene) {
    this.root = new Group();
    scene.add(this.root);
    this.box = new BoxGeometry(1, 1, 1);
    // Keep only vertical faces and merge them into one draw call.
    const sides = this.box.groups.filter(({ materialIndex }) => ![2, 3].includes(materialIndex));
    this.box.setIndex(
      sides.flatMap(({ start, count }) =>
        Array.from(this.box.index.array.slice(start, start + count)),
      ),
    );
    this.box.clearGroups();
    this.plane = new PlaneGeometry(1, 1);
    const vertexShader = `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
    this.halo = new ShaderMaterial({
      vertexShader,
      fragmentShader: `varying vec2 vUv;
        void main() {
          float edge = max(abs(vUv.x - .5), abs(vUv.y - .5)) * 2.0;
          float alpha = (1.0 - smoothstep(.55, 1.0, edge)) * .95;
          gl_FragColor = vec4(.10, 1.0, .18, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.aura = new ShaderMaterial({
      vertexShader,
      fragmentShader: `varying vec2 vUv;
        void main() {
          float alpha = pow(1.0 - vUv.y, 2.0) * .6;
          gl_FragColor = vec4(.15, 1.0, .25, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.plots = new Map();
    // Round pads (the Moon's octagons) get a glow of their own shape, keyed by side count.
    this.polygons = new Map();
  }
  polygon(sides) {
    if (!this.polygons.has(sides)) {
      const sector = (Math.PI * 2) / sides;
      const halo = this.halo.clone();
      // Distance to the polygon's edge, 1 on its outline: the square glow's rule for any pad.
      halo.fragmentShader = `varying vec2 vUv;
        void main() {
          vec2 p = (vUv - .5) * 2.0;
          float a = mod(atan(p.y, p.x), ${sector.toFixed(6)});
          float edge = length(p) * cos(a - ${(sector / 2).toFixed(6)}) / ${Math.cos(sector / 2).toFixed(6)};
          float alpha = (1.0 - smoothstep(.55, 1.0, edge)) * .95;
          gl_FragColor = vec4(.10, 1.0, .18, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`;
      this.polygons.set(sides, {
        halo,
        plane: new CircleGeometry(1, sides),
        // Open-ended, so only the fading sides surround the building like the box.
        wall: new CylinderGeometry(1, 1, 1, sides, 1, true),
      });
    }
    return this.polygons.get(sides);
  }
  clear() {
    this.root.clear();
    this.plots.clear();
  }
  add(id, bounds) {
    const group = new Group();
    const width = bounds.max.x - bounds.min.x;
    const depth = bounds.max.z - bounds.min.z;
    const height = wallHeight(bounds.max.y - bounds.min.y);
    group.position.set(
      (bounds.min.x + bounds.max.x) / 2,
      bounds.min.y + 0.15,
      (bounds.min.z + bounds.max.z) / 2,
    );
    const halo = new Mesh(this.plane, this.halo);
    halo.rotation.x = -Math.PI / 2;
    halo.scale.set(width + 1.8, depth + 1.8, 1);
    const aura = new Mesh(this.box, this.aura);
    // Hide horizontal faces: only the fading sides surround the lower building.
    aura.scale.set(width + 0.25, height, depth + 0.25);
    aura.position.y = height / 2;
    group.add(halo, aura);
    this.place(id, group);
  }
  // A plot redrawn in place replaces its glow and keeps whether it was showing.
  place(id, group) {
    const previous = this.plots.get(id);
    group.visible = previous?.visible ?? false;
    previous?.removeFromParent();
    this.root.add(group);
    this.plots.set(id, group);
  }
  /** A glow that follows a regular polygonal pad, aligned like CylinderGeometry(sides). */
  addPolygon(id, { x, z, y = 0, radius, sides, rotation = 0, height = 3.6 }) {
    const shape = this.polygon(sides);
    const group = new Group();
    group.position.set(x, y + 0.08, z);
    group.rotation.y = rotation;
    const halo = new Mesh(shape.plane, shape.halo);
    // CircleGeometry puts a corner on +x, CylinderGeometry on +z: a quarter turn apart.
    halo.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    halo.scale.set(radius + 1.1, radius + 1.1, 1);
    const aura = new Mesh(shape.wall, this.aura);
    const wall = wallHeight(height);
    aura.scale.set(radius + 0.12, wall, radius + 0.12);
    aura.position.y = wall / 2;
    group.add(halo, aura);
    this.place(id, group);
  }
  setAvailable(ids) {
    const active = new Set(ids);
    let changed = false;
    for (const [id, group] of this.plots) {
      const visible = active.has(id);
      changed ||= group.visible !== visible;
      group.visible = visible;
    }
    return changed;
  }
  dispose() {
    this.clear();
    this.root.removeFromParent();
    this.box.dispose();
    this.plane.dispose();
    this.halo.dispose();
    this.aura.dispose();
    for (const { halo, plane, wall } of this.polygons.values()) {
      halo.dispose();
      plane.dispose();
      wall.dispose();
    }
    this.polygons.clear();
  }
}
