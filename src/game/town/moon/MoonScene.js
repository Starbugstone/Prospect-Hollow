import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TownPrimitives } from '../TownPrimitives';
import { renderMoonBuilding } from '../buildings/moon';
import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { MOON_CRATER_RADIUS, MOON_LOTS, MOON_RING_ROAD } from '../../../data/moonSettlement';

// New Hollow on the Moon: a small scene of its own beside the valley's. One
// renderer, a crater of lots, the ribbon arriving from the valley, settlers,
// rovers and the odd meteor shower. Earth hangs over the crater rim.
const SKY = '#10162b';
const GROUND = '#a7a49b';
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

function earth(d) {
  const g = new THREE.Group();
  g.name = 'Earth over the crater rim';
  const basic = (color) => new THREE.MeshBasicMaterial({ color, fog: false });
  const globe = new THREE.Mesh(d.geometries.sphere, basic('#4f8fc7'));
  globe.scale.setScalar(19);
  g.add(globe);
  // Continents and clouds sit just outside the ocean.
  for (let n = 0; n < 9; n++) {
    const a = hash(n + 50) * TAU,
      b = (hash(n + 90) - 0.5) * 2.2;
    const land = new THREE.Mesh(d.geometries.rock, basic(n % 3 ? '#79b06a' : '#f3f4f2'));
    land.scale.set(4 + hash(n) * 4, 3 + hash(n + 7) * 3, 2);
    land.position.set(
      Math.cos(a) * Math.cos(b) * 17.4,
      Math.sin(b) * 17.4,
      Math.sin(a) * Math.cos(b) * 17.4,
    );
    land.lookAt(0, 0, 0);
    g.add(land);
  }
  const glow = new THREE.Mesh(
    d.geometries.sphere,
    new THREE.MeshBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.18, fog: false }),
  );
  glow.scale.setScalar(22);
  g.add(glow);
  g.position.set(-44, 12, -175);
  g.userData.materials = g.children.map((m) => m.material);
  return g;
}

function terrain(d) {
  const g = new THREE.Group();
  g.name = 'Moon crater';
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(260, 64),
    new THREE.MeshStandardMaterial({ color: GROUND, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.owned = true;
  g.add(ground);
  // The crater rim rings the settlement; little craters dot the floor.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(MOON_CRATER_RADIUS + 6, 4.5, 6, 48),
    new THREE.MeshStandardMaterial({ color: '#a9a59b', roughness: 1, flatShading: true }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.scale.z = 0.55;
  rim.receiveShadow = rim.castShadow = true;
  g.add(rim);
  for (let n = 0; n < 26; n++) {
    const a = hash(n + 200) * TAU,
      r = 12 + hash(n + 300) * 32,
      size = 0.8 + hash(n + 400) * 2.2;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (Object.values(MOON_LOTS).some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 6.5)) continue;
    const crater = d.mesh(g, 'ring', [size, size, size * 0.7], [x, 0.02, z], '#a39f95');
    crater.rotation.x = Math.PI / 2;
  }
  // Distant hills beyond the rim frame the horizon.
  for (let n = 0; n < 22; n++) {
    const a = (n / 22) * TAU + hash(n) * 0.2,
      r = 110 + hash(n + 9) * 50;
    const hill = d.ball(
      g,
      Math.cos(a) * r,
      0,
      Math.sin(a) * r,
      [14 + hash(n + 5) * 18, 6 + hash(n + 6) * 12, 12 + hash(n + 8) * 14],
      '#a8a49a',
      'rock',
    );
    hill.castShadow = false;
  }
  // A ring road joins the lots around the landing.
  const road = new THREE.Mesh(
    new THREE.RingGeometry(MOON_RING_ROAD - 0.8, MOON_RING_ROAD + 0.8, 64),
    new THREE.MeshStandardMaterial({ color: '#cfccc3', roughness: 1 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.03;
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

export class MoonScene {
  constructor(canvas, { onLabels = () => {}, reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.onLabels = onLabels;
    this.reducedMotion = reducedMotion;
    this.d = new TownPrimitives();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 150, 250);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
    this.camera.position.set(0, 26, 66);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
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
    this.earth = earth(this.d);
    this.scene.add(this.earth);
    this.scene.add(terrain(this.d));
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
    this.elapsed = 0;
    this.signature = '';
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
      this.d.batch(lot);
    });
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
    this.renderer.setAnimationLoop(enabled ? (now) => this.tick(now) : null);
    if (!enabled) this.requestFrame();
  }
  tick(now) {
    const delta = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 0;
    this.lastNow = now;
    if (!this.reducedMotion) {
      this.elapsed += delta;
      this.move(this.elapsed);
      this.meteor(this.elapsed);
      this.earth.rotation.y = this.elapsed * 0.02;
    }
    this.render();
  }
  requestFrame() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.render();
    });
  }
  render() {
    this.renderer.render(this.scene, this.camera);
    this.projectLabels();
  }
  projectLabels() {
    const point = new THREE.Vector3();
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
    materials.forEach((material) => material.dispose());
    this.d.disposePrimitives();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}
