import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TownPrimitives } from '../TownPrimitives';
import { TownFramePacer } from '../TownFramePacer';
import { TownRenderQuality } from '../TownRenderQuality';
import { renderMoonBuilding } from '../buildings/moon';
import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { MOON_LOTS, MOON_RING_ROAD } from '../../../data/moonSettlement';

// New Hollow on the Moon: a small scene of its own beside the valley's. One
// renderer, a crater of lots, the ribbon arriving from the valley, settlers,
// rovers and the odd meteor shower. Earth hangs over the crater rim.
const SKY = '#10162b';
const GROUND = '#aaa79f';
const TAU = Math.PI * 2;
const hash = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

function starfield() {
  const positions = [];
  for (let n = 0; n < 900; n++) {
    const a = hash(n) * TAU,
      up = 0.04 + hash(n + 3000) * 0.9;
    const r = 340;
    positions.push(
      Math.cos(a) * Math.cos(up) * r,
      Math.sin(up) * r,
      Math.sin(a) * Math.cos(up) * r,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: '#f4f1e6', size: 1.6, sizeAttenuation: false, fog: false }),
  );
  stars.name = 'Moon starfield';
  return stars;
}

// Earth is a painted, perfectly round image on a sprite, not a 3D globe: it always
// faces the camera, costs two triangles and opens the valley when tapped.
const EARTH_TEXTURE = 256;
function paintEarth() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = EARTH_TEXTURE;
  const c = canvas.getContext('2d'),
    mid = EARTH_TEXTURE / 2,
    r = mid * 0.78;
  // A soft blue glow of atmosphere around the disc.
  const glow = c.createRadialGradient(mid, mid, r * 0.92, mid, mid, mid);
  glow.addColorStop(0, '#a9d4ffaa');
  glow.addColorStop(1, '#a9d4ff00');
  c.fillStyle = glow;
  c.fillRect(0, 0, EARTH_TEXTURE, EARTH_TEXTURE);
  c.save();
  c.beginPath();
  c.arc(mid, mid, r, 0, Math.PI * 2);
  c.clip();
  const ocean = c.createRadialGradient(mid - r * 0.35, mid - r * 0.35, r * 0.1, mid, mid, r);
  ocean.addColorStop(0, '#79b7ea');
  ocean.addColorStop(1, '#2f6aa8');
  c.fillStyle = ocean;
  c.fillRect(0, 0, EARTH_TEXTURE, EARTH_TEXTURE);
  // Rounded continents and soft cloud bands.
  const blob = (x, y, w, h, color, turn = 0) => {
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(mid + x * r, mid + y * r, w * r, h * r, turn, 0, Math.PI * 2);
    c.fill();
  };
  blob(-0.3, -0.15, 0.32, 0.22, '#7fb36b', 0.5);
  blob(-0.12, 0.12, 0.18, 0.3, '#86b870', -0.3);
  blob(0.35, -0.3, 0.22, 0.14, '#9cbf78', 0.2);
  blob(0.28, 0.32, 0.2, 0.12, '#c9b98a', -0.4);
  c.globalAlpha = 0.85;
  blob(-0.05, -0.45, 0.5, 0.06, '#f6f7f4', 0.1);
  blob(0.2, 0.05, 0.42, 0.05, '#f6f7f4', -0.15);
  blob(-0.25, 0.48, 0.36, 0.05, '#f6f7f4', 0.05);
  // The night side, with a few warm valley lights.
  c.globalAlpha = 1;
  const night = c.createLinearGradient(mid - r, 0, mid + r, 0);
  night.addColorStop(0.55, '#0a122800');
  night.addColorStop(1, '#0a1228c0');
  c.fillStyle = night;
  c.fillRect(0, 0, EARTH_TEXTURE, EARTH_TEXTURE);
  c.fillStyle = '#ffd98a';
  for (const [x, y] of [
    [0.62, 0.05],
    [0.66, 0.12],
    [0.58, -0.08],
  ]) {
    c.beginPath();
    c.arc(mid + x * r, mid + y * r, 2.2, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function earth() {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: paintEarth(), fog: false, depthWrite: false }),
  );
  sprite.name = 'Earth over the crater rim';
  // Far beyond the rim, half risen over the hills from the usual view.
  sprite.scale.setScalar(50);
  sprite.position.set(52, 6, -175);
  return sprite;
}

// Smooth value noise for the regolith: gentle swells, never boulders.
function noise(x, z) {
  const ix = Math.floor(x),
    iz = Math.floor(z),
    fx = x - ix,
    fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx),
    sz = fz * fz * (3 - 2 * fz);
  const at = (a, b) => hash(a * 157 + b * 311);
  const top = at(ix, iz) + (at(ix + 1, iz) - at(ix, iz)) * sx,
    bottom = at(ix, iz + 1) + (at(ix + 1, iz + 1) - at(ix, iz + 1)) * sx;
  return top + (bottom - top) * sz;
}
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Soft craters: a shallow bowl with a raised lip. The settlement keeps only small
// ones, clear of every lot and the ring road.
const CRATERS = (() => {
  const list = [];
  for (let n = 0; list.length < 46 && n < 400; n++) {
    const a = hash(n + 200) * TAU,
      r = 8 + hash(n + 300) * 190;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    const inside = r < 44;
    const size = inside ? 1.4 + hash(n + 400) * 1.6 : 3 + hash(n + 400) * (r / 22);
    if (Object.values(MOON_LOTS).some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 7 + size))
      continue;
    if (Math.abs(r - MOON_RING_ROAD) < 2.5 + size) continue;
    list.push({ x, z, size, depth: inside ? 0.22 : 0.5 + size * 0.08 });
  }
  return list;
})();
export function moonHeight(x, z) {
  const r = Math.hypot(x, z);
  // The settlement floor is level; a soft rim rings it; hills swell beyond.
  const rim = 3.6 * Math.exp(-(((r - 53) / 6.5) ** 2));
  const hills =
    smooth(62, 130, r) * (noise(x * 0.018, z * 0.018) * 11 + noise(x * 0.05, z * 0.05) * 3.5 - 4);
  let height = smooth(41, 47, r) * (rim + Math.max(hills, -2));
  for (const { x: cx, z: cz, size, depth } of CRATERS) {
    const d = Math.hypot(x - cx, z - cz) / size;
    if (d > 1.6) continue;
    height += d < 1 ? -depth * (1 - d * d) : 0;
    height += depth * 0.45 * Math.exp(-(((d - 1) / 0.22) ** 2));
  }
  return height;
}
function terrain() {
  const g = new THREE.Group();
  g.name = 'Moon crater';
  // A polar grid: fine near the settlement, coarser toward the horizon.
  const rings = 130,
    segments = 180,
    positions = [],
    colors = [],
    indices = [];
  const base = new THREE.Color(GROUND),
    mare = new THREE.Color('#8f8c86'),
    bright = new THREE.Color('#c4c0b6'),
    color = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    const r = 260 * (i / rings) ** 1.7;
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * TAU,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r,
        y = moonHeight(x, z);
      positions.push(x, y, z);
      // Darker maria and crater floors, lighter rims and ridges.
      const tone = noise(x * 0.012 + 40, z * 0.012 - 17);
      color.copy(base).lerp(mare, smooth(0.5, 0.78, tone) * 0.85);
      color.lerp(bright, Math.min(0.6, Math.max(0, y * 0.12)));
      if (y < -0.05) color.lerp(mare, Math.min(0.7, -y * 1.8));
      color.multiplyScalar(0.97 + noise(x * 0.4, z * 0.4) * 0.06);
      colors.push(color.r, color.g, color.b);
      if (i < rings) {
        const k = i * segments + j,
          next = i * segments + ((j + 1) % segments);
        // Counter-clockwise seen from above, so the ground faces the sky.
        indices.push(k, next, k + segments, next, next + segments, k + segments);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
  ground.receiveShadow = true;
  g.add(ground);
  // A pale ring road joins the lots around the landing.
  const road = new THREE.Mesh(
    new THREE.RingGeometry(MOON_RING_ROAD - 0.8, MOON_RING_ROAD + 0.8, 96),
    new THREE.MeshStandardMaterial({ color: '#cdcac1', roughness: 1 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.04;
  road.receiveShadow = true;
  g.add(road);
  return g;
}

// A settler in a moon-white suit with a gold visor; Willowkin keep to the dome.
function settler(d, parent, suit) {
  const g = d.group(parent);
  d.box(g, 0.34, 0.5, 0.24, 0, 0.62, 0, suit, true);
  d.ball(g, 0, 1.05, 0, 0.2, p.shell);
  d.box(g, 0.22, 0.1, 0.06, 0, 1.06, 0.17, p.light);
  d.box(g, 0.24, 0.32, 0.12, 0, 0.68, -0.17, p.roof);
  for (const x of [-0.09, 0.09]) d.box(g, 0.1, 0.38, 0.12, x, 0.19, 0, p.deep);
  return g;
}
function rover(d, parent) {
  const g = d.group(parent);
  d.box(g, 1.2, 0.36, 0.7, 0, 0.5, 0, p.shell, true);
  d.box(g, 0.5, 0.26, 0.6, 0.18, 0.78, 0, p.glass);
  for (const dx of [-0.42, 0.42])
    for (const dz of [-0.4, 0.4]) {
      const wheel = d.mesh(g, 'cylinder', [0.18, 0.1, 0.18], [dx, 0.2, dz], p.deep);
      wheel.rotation.x = Math.PI / 2;
    }
  d.ball(g, -0.45, 1.05, -0.2, 0.06, p.flower, 'rock');
  return g;
}

const labelPoint = new THREE.Vector3();

export class MoonScene {
  constructor(canvas, { onLabels = () => {}, onEarth = () => {}, reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.onLabels = onLabels;
    this.onEarth = onEarth;
    this.reducedMotion = reducedMotion;
    this.d = new TownPrimitives();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 150, 250);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
    this.camera.position.set(0, 26, 66);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    // The valley's measured drawing-buffer tier, so the Moon costs no more to fill.
    this.renderer.setPixelRatio(new TownRenderQuality(window.devicePixelRatio || 1).ratio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.add(new THREE.HemisphereLight('#d6e0ff', '#5f5b53', 1.25));
    const sun = new THREE.DirectionalLight('#fff4de', 3.1);
    sun.position.set(40, 60, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, far: 200 });
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    // Earthshine: a soft blue fill from the valley above the rim.
    const earthshine = new THREE.DirectionalLight('#9fc4ff', 0.6);
    earthshine.position.set(-40, 30, -80);
    this.scene.add(earthshine);
    this.scene.add(starfield());
    this.earth = earth();
    this.scene.add(this.earth);
    this.scene.add(terrain());
    // The ribbon always arrives from the valley, even before the landing is built.
    const ribbon = this.d.mesh(
      this.scene,
      'cylinder',
      [0.08, 200, 0.08],
      [0, 100, MOON_LOTS.ribbonLanding[1]],
      p.glass,
    );
    ribbon.castShadow = false;
    ribbon.name = 'Ribbon from the valley';
    this.buildings = this.d.group(this.scene);
    this.life = this.d.group(this.scene);
    this.lots = Object.entries(MOON_LOTS).map(([id, [x, z]]) => ({
      id,
      position: new THREE.Vector3(x, 3.4, z),
    }));
    this.controls = new OrbitControls(this.camera, canvas.parentElement);
    this.controls.target.set(0, 0, 4);
    this.controls.minDistance = 22;
    this.controls.maxDistance = 115;
    this.controls.minPolarAngle = 0.55;
    this.controls.maxPolarAngle = 1.38;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.85;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.controls.addEventListener('change', () => this.requestFrame());
    this.controls.update();
    // A tap on Earth (not a drag) returns to the valley.
    this.raycaster = new THREE.Raycaster();
    this.pointer = null;
    // OrbitControls captures the pointer on the canvas's parent, so listen there.
    const surface = canvas.parentElement;
    this.surface = surface;
    this.onPointerDown = (event) => {
      this.pointer =
        event.target === canvas || event.target === surface ? [event.clientX, event.clientY] : null;
    };
    this.onPointerUp = (event) => {
      const start = this.pointer;
      this.pointer = null;
      if (
        start &&
        Math.hypot(event.clientX - start[0], event.clientY - start[1]) < 6 &&
        this.hitsEarth(event)
      )
        this.onEarth();
    };
    this.onPointerMove = (event) => {
      if (!this.pointer) canvas.style.cursor = this.hitsEarth(event) ? 'pointer' : '';
    };
    surface.addEventListener('pointerdown', this.onPointerDown);
    surface.addEventListener('pointerup', this.onPointerUp);
    surface.addEventListener('pointermove', this.onPointerMove);
    this.elapsed = 0;
    this.signature = '';
    this.pacer = new TownFramePacer();
    this.tick = this.tick.bind(this);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }
  /** Rebuild the lots when the town's Moon buildings change. */
  update(town) {
    const levels = this.lots.map(({ id }) => town?.buildings?.[id] ?? 0);
    const signature = levels.join();
    if (signature === this.signature) return;
    this.signature = signature;
    this.d.clearGroup(this.buildings);
    this.buildings = this.d.group(this.scene);
    this.buildings.name = 'New Hollow buildings';
    this.lots.forEach(({ id }, n) => {
      const [x, z] = MOON_LOTS[id];
      const lot = this.d.group(this.buildings, x, 0, z);
      // Every lot faces the landing, so its door greets the ribbon.
      lot.rotation.y = Math.atan2(-x, -(z - MOON_LOTS.ribbonLanding[1])) + Math.PI;
      if (id === 'ribbonLanding') lot.rotation.y = 0;
      renderMoonBuilding(this.d, lot, id, levels[n]);
    });
    // The whole settlement draws as one merged mesh per palette colour.
    this.d.batch(this.buildings);
    this.populate(town);
    this.requestFrame();
  }
  /** Settlers walk the ring road and rovers circle it; more homes, more neighbors. */
  populate(town) {
    this.d.clearGroup(this.life);
    this.life = this.d.group(this.scene);
    this.walkers = [];
    const homes = ['settlerDomes', 'craterHomesteads'].reduce(
      (sum, id) => sum + (town?.buildings?.[id] ?? 0),
      0,
    );
    const suits = [p.shell, '#d9dde6', '#e8e1cf'];
    for (let n = 0; n < Math.min(10, 2 + homes * 2); n++) {
      const figure = settler(this.d, this.life, suits[n % 3]);
      this.walkers.push({
        root: figure,
        radius: MOON_RING_ROAD,
        speed: 0.06 + hash(n) * 0.04,
        phase: hash(n + 70) * TAU,
        dir: n % 2 ? 1 : -1,
      });
    }
    if (town?.buildings?.roverBarn) {
      for (let n = 0; n < town.buildings.roverBarn; n++) {
        const r = rover(this.d, this.life);
        this.walkers.push({
          root: r,
          radius: MOON_RING_ROAD,
          speed: 0.11,
          phase: n * 2.1,
          dir: 1,
          vehicle: true,
        });
      }
    }
    this.move(this.elapsed);
  }
  move(time) {
    for (const w of this.walkers ?? []) {
      const a = w.phase + w.dir * time * w.speed;
      const offset = w.vehicle ? 0.3 : -0.4 + (w.dir > 0 ? 0 : 0.8);
      w.root.position.set(Math.cos(a) * (w.radius + offset), 0, Math.sin(a) * (w.radius + offset));
      w.root.rotation.y = -a - (w.dir > 0 ? 0 : Math.PI);
      if (!w.vehicle) w.root.position.y = Math.abs(Math.sin(time * 3 + w.phase)) * 0.12;
    }
  }
  // Now and then a meteor streaks across the sky: a celebration, never a hazard.
  meteor(time) {
    if (this.reducedMotion) return;
    if (!this.streak) {
      const material = new THREE.MeshBasicMaterial({
        color: '#fff3c8',
        transparent: true,
        fog: false,
      });
      this.streak = new THREE.Mesh(this.d.geometries.cylinder, material);
      this.streak.scale.set(0.25, 18, 0.25);
      this.streak.name = 'Meteor';
      this.scene.add(this.streak);
    }
    const cycle = 7,
      phase = (time % cycle) / cycle,
      seed = Math.floor(time / cycle);
    const visible = phase < 0.22;
    this.streak.visible = visible;
    if (!visible) return;
    const x0 = (hash(seed) - 0.5) * 240,
      y0 = 90 + hash(seed + 1) * 50;
    this.streak.position.set(x0 + phase * 300, y0 - phase * 160, -150);
    this.streak.rotation.z = 1.05;
    this.streak.material.opacity = 1 - phase / 0.22;
  }
  setMotion(enabled) {
    this.animating = enabled;
    this.pacer.reset();
    this.renderer.setAnimationLoop(enabled ? this.tick : null);
    if (!enabled) this.requestFrame();
  }
  // Paced like the valley: a fast display does not draw more than 60 frames a second.
  tick(now) {
    if (!this.pacer.due(now)) return;
    const delta = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 0;
    this.lastNow = now;
    // Nothing moves: camera, resize and lot changes request their own frames.
    if (this.reducedMotion) return;
    this.elapsed += delta;
    this.move(this.elapsed);
    this.meteor(this.elapsed);
    this.render();
  }
  // Camera, resize and lot changes come through here; only they move the lot labels.
  requestFrame() {
    this.viewChanged = true;
    // A running animation draws the latest pose on its next frame anyway.
    if (this.frame || (this.animating && !this.reducedMotion)) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.render();
    });
  }
  render() {
    this.renderer.render(this.scene, this.camera);
    if (!this.viewChanged) return;
    this.viewChanged = false;
    this.projectLabels();
  }
  projectLabels() {
    const point = labelPoint;
    const labels = this.lots.map(({ id, position }) => {
      point.copy(position).project(this.camera);
      return {
        id,
        x: (point.x + 1) * 50,
        y: (1 - point.y) * 50,
        visible:
          point.z > -1 && point.z < 1 && Math.abs(point.x) < 1.05 && Math.abs(point.y) < 1.05,
      };
    });
    const key = labels
      .map((l) => `${l.id}${Math.round(l.x * 10)},${Math.round(l.y * 10)}${l.visible}`)
      .join();
    if (key === this.labelKey) return;
    this.labelKey = key;
    this.onLabels(labels);
  }
  hitsEarth(event) {
    const box = this.canvas.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        -((event.clientY - box.top) / box.height) * 2 + 1,
      ),
      this.camera,
    );
    return this.raycaster.intersectObject(this.earth).length > 0;
  }
  resize() {
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.fov = width < height ? 62 : 48;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.requestFrame();
  }
  resetView() {
    this.camera.position.set(0, 26, 66);
    this.controls.target.set(0, 0, 4);
    this.controls.update();
  }
  dispose() {
    this.renderer.setAnimationLoop(null);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.surface.removeEventListener('pointerdown', this.onPointerDown);
    this.surface.removeEventListener('pointerup', this.onPointerUp);
    this.surface.removeEventListener('pointermove', this.onPointerMove);
    this.controls.dispose();
    // Shared primitives are released once below; everything else is owned here.
    const shared = new Set(Object.values(this.d.geometries)),
      geometries = new Set(),
      materials = new Set();
    this.scene.traverse((object) => {
      if (object.geometry && !shared.has(object.geometry)) geometries.add(object.geometry);
      if (object.material) materials.add(object.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
    this.d.disposePrimitives();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}
