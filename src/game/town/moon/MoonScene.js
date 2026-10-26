import {
  MOON_MONUMENT_AREAS,
  moonLabelAnchors,
  moonMonumentPresentation,
  syncMoonMonuments,
} from './MoonMonuments';
import { animateMoonSettler, moonSettlerPlan, moonSuitFigure } from './MoonSettlers';
import { areaUnlocked } from '../../../data/townLandmarks';
import * as THREE from 'three';
import { createTownControls } from '../TownControls';
import { createTapGesture } from '../TownTapGesture';
import { cameraAction, focusCamera } from '../TownCamera';
import { keepCameraAboveTerrain } from '../TownLandscape';
import {
  adaptRenderQuality,
  aimAt,
  createTownRenderer,
  loseContext,
  requestTownFrame,
  watchContextLoss,
} from '../TownRenderer';
import { updateEventCamera } from '../TownEventCamera';
import { parcelOutlineMesh } from '../TownParcelOutline';
import { TownPrimitives } from '../TownPrimitives';
import { smoothBetween } from '../TownMath';
import { MoonSaucer, moonSaucerArrival } from './MoonSaucer';
import { TownFramePacer } from '../TownFramePacer';
import { TownUpgradeGlow } from '../TownUpgradeGlow';
import { MoonConstruction, finishKey } from './MoonConstruction';
import { TownConstruction, constructionParts } from '../TownConstruction';
import { MOON_CLIMBER, moonRover, renderMoonBuilding } from '../buildings/moon';
import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { eraEvolution } from '../../../data/eras';
import { vipVisitor } from '../../../data/villagers';
import { hoverVillager, projectVillager, showVillager } from '../TownLabelProjection';
import {
  MoonVipArrivals,
  animateMoonVip,
  dressMoonVip,
  moonClimberArrival,
  moonClimberLift,
} from './MoonVips';
import {
  MOON_LOTS,
  MOON_PAD_TOP,
  MOON_PATH_LIFT,
  MOON_RING_ROAD,
  MOON_ROAD_LIFT,
  moonApproachHeight,
  moonApproaches,
  MOON_PARCEL_SIDES,
  moonLotPose,
  moonParcels,
  moonPathDistance,
} from '../../../data/moonSettlement';

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
    if (
      MOON_MONUMENT_AREAS.some(
        (area) =>
          Math.hypot(x - area.positions[0][0], z - area.positions[0][1]) < area.radius + 1.6 * size,
      )
    )
      continue;
    if (Math.abs(r - MOON_RING_ROAD) < 2.5 + size) continue;
    // Reserve the same authored access corridors that the road mesh draws.
    // A crater's complete lip stays outside the public path, not just its bowl.
    if (moonPathDistance(x, z) < 1.6 * size + 0.6) continue;
    list.push({ x, z, size, depth: inside ? 0.22 : 0.5 + size * 0.08 });
  }
  return list;
})();
export function moonHeight(x, z) {
  const r = Math.hypot(x, z);
  // The settlement floor is level; a soft rim rings it; hills swell beyond.
  const rim = 3.6 * Math.exp(-(((r - 53) / 6.5) ** 2));
  const hills =
    smoothBetween(62, 130, r) *
    (noise(x * 0.018, z * 0.018) * 11 + noise(x * 0.05, z * 0.05) * 3.5 - 4);
  let height = smoothBetween(41, 47, r) * (rim + Math.max(hills, -2));
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
      color.copy(base).lerp(mare, smoothBetween(0.5, 0.78, tone) * 0.85);
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

// All entrance strips share one mesh/material. The crater floor is level here;
// sampling moonHeight also keeps the contract safe if terrain evolves later.
export function moonAccessGeometry(approaches = moonApproaches()) {
  const positions = [],
    indices = [],
    uvs = [],
    colors = [];
  const padColor = new THREE.Color('#aaa99f'),
    groundColor = new THREE.Color('#cdcac1');
  for (const route of approaches) {
    const { points, width, pose, rampStart, rampEnd } = route;
    const offset = positions.length / 3;
    // The walkers' path surface (moonApproachHeight), down onto the regolith here.
    const surface = (x, z) => moonApproachHeight(route, x, z, moonHeight(x, z));
    const colorAt = (x, z) => {
      const radius = Math.hypot(x - pose.x, z - pose.z);
      const t = Math.max(0, Math.min(1, (radius - rampStart) / (rampEnd - rampStart)));
      const color = padColor.clone().lerp(groundColor, t);
      colors.push(color.r, color.g, color.b);
    };
    for (let n = 0; n < points.length; n++) {
      const p = points[n],
        prev = points[Math.max(0, n - 1)],
        next = points[Math.min(points.length - 1, n + 1)];
      const normal = (a, b) => {
        const dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz) || 1;
        return [-dz / len, dx / len];
      };
      const before = normal(n ? prev : p, n ? p : next),
        after = normal(n < points.length - 1 ? p : prev, n < points.length - 1 ? next : p);
      const nx = before[0] + after[0],
        nz = before[1] + after[1],
        len = Math.hypot(nx, nz) || 1;
      const mx = nx / len,
        mz = nz / len;
      const half = (width / 2) * Math.min(1.25, 1 / Math.max(0.2, mx * after[0] + mz * after[1]));
      for (const side of [1, -1]) {
        const x = p[0] + mx * half * side,
          z = p[1] + mz * half * side;
        positions.push(x, surface(x, z), z);
        uvs.push(side > 0 ? 0 : 1, n);
        colorAt(x, z);
      }
      if (n < points.length - 1) {
        const k = offset + n * 2;
        indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    // Fill the small pad-to-regolith ramp sides. The path is a supported solid
    // arrival at the pad edge, rather than a floating sloped decal.
    for (let n = 0; n < points.length - 1; n++) {
      const a = offset + n * 2,
        b = a + 2;
      if (Math.abs(positions[a * 3 + 1] - positions[b * 3 + 1]) < 0.03) continue;
      for (const side of [0, 1]) {
        const k = positions.length / 3,
          ia = (a + side) * 3,
          ib = (b + side) * 3;
        positions.push(
          positions[ia],
          MOON_ROAD_LIFT,
          positions[ia + 2],
          positions[ib],
          MOON_ROAD_LIFT,
          positions[ib + 2],
        );
        uvs.push(0, 0, 1, 0);
        colorAt(positions[ia], positions[ia + 2]);
        colorAt(positions[ib], positions[ib + 2]);
        if (side) indices.push(a + side, k + 1, k, a + side, b + side, k + 1);
        else indices.push(a, k, k + 1, a, k + 1, b);
      }
    }
    // A small flush landing ends exactly at the authored hatch/stair anchor.
    // Contrast on the white pad makes the continuous arrival legible from the
    // default camera, including entrances on the far side of an outer pad.
    const entry = points[0],
      next = points[1];
    const length = Math.hypot(next[0] - entry[0], next[1] - entry[1]) || 1;
    const dx = (next[0] - entry[0]) / length,
      dz = (next[1] - entry[1]) / length;
    const k = positions.length / 3;
    for (const side of [-1, 1])
      for (const distance of [0, 0.6]) {
        const x = entry[0] + dx * distance - dz * side * 0.525;
        const z = entry[1] + dz * distance + dx * side * 0.525;
        // Just above the path's own pad end, so the two never flicker.
        positions.push(x, MOON_PAD_TOP + MOON_PATH_LIFT + 0.006, z);
        uvs.push(side < 0 ? 0 : 1, distance);
        colorAt(x, z);
      }
    indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const labelPoint = new THREE.Vector3();
// Tap targets cover a lot's whole pad, up to its building's roof (this tall until the
// building is drawn).
const PICK_HEIGHT = 3;
const PICK_LAYER = 3;
const lotBounds = new THREE.Box3();
/** A lot's roof for its tap target. Sky parts (the ribbon and its halo) are left out. */
export function moonRoofHeight(lot) {
  let top = 0;
  lot.updateWorldMatrix(true, true);
  lot.traverse((mesh) => {
    if (mesh.isMesh && !mesh.userData.sky) top = Math.max(top, lotBounds.setFromObject(mesh).max.y);
  });
  return top;
}

// The Moon's scene is its own drawing kit, as the valley's diorama is: the shared
// construction reveal and presentations draw through it and read its camera, clock and
// town directly, with no adapter in between.
const NO_COMPANIONS = Object.freeze({ companions: null });
export class MoonScene extends TownPrimitives {
  constructor(
    canvas,
    {
      onLabels = () => {},
      onEarth = () => {},
      onSelect = () => {},
      onVipSpend = () => {},
      onVillagerLabel = () => {},
      onUnavailable = () => {},
      reducedMotion = false,
      vipsHidden = false,
    } = {},
  ) {
    super();
    // Moon modules draw through `scene.d`; it is the scene itself.
    this.d = this;
    this.canvas = canvas;
    this.onLabels = onLabels;
    this.onEarth = onEarth;
    this.onSelect = onSelect;
    // A lost context or a failed draw goes to the owner's shared graphics recovery.
    this.onUnavailable = onUnavailable;
    // The camera floor, focus moves and the unveiling read the Moon's own ground.
    this.terrainHeight = moonHeight;
    // The valley's VIP contract: purchases go to the shared receipt flow, and a named
    // visitor's tag goes to the valley's label. A shared town has no VIPs at all.
    this.onVipSpend = onVipSpend;
    this.onVillagerLabel = onVillagerLabel;
    this.vipsHidden = vipsHidden;
    this.reducedMotion = reducedMotion;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 150, 250);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
    this.camera.layers.enable(2);
    this.camera.position.set(0, 26, 66);
    // The valley's renderer and measured drawing-buffer tier, so the Moon costs no more
    // to fill and adapts the same way.
    Object.assign(this, createTownRenderer(canvas, { exposure: 1.05 }));
    this.scene.add(new THREE.HemisphereLight('#d6e0ff', '#5f5b53', 1.25));
    const sun = new THREE.DirectionalLight('#fff4de', 3.1);
    sun.position.set(40, 60, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.renderQuality.shadowSize, this.renderQuality.shadowSize);
    Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, far: 200 });
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.sun = sun;
    // Earthshine: a soft blue fill from the valley above the rim.
    const earthshine = new THREE.DirectionalLight('#9fc4ff', 0.6);
    earthshine.position.set(-40, 30, -80);
    this.scene.add(earthshine);
    this.scene.add(starfield());
    this.earth = earth();
    this.scene.add(this.earth);
    this.scene.add(terrain());
    this.access = new THREE.Mesh(
      moonAccessGeometry([]),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, vertexColors: true }),
    );
    this.access.name = 'Moon public entrance paths';
    this.access.receiveShadow = true;
    this.scene.add(this.access);
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
    this.saucer = new MoonSaucer(this.d, this.scene, { camera: this.camera });
    this.buildings = this.d.group(this.scene);
    this.life = this.d.group(this.scene);
    // VIP visitors live outside the settlers' group, so a rebuild never cuts a tour short.
    this.world = this.d.group(this.scene);
    this.world.name = 'New Hollow VIP visitors';
    this.visitorTransports = new Map();
    this.vipArrivals = new MoonVipArrivals(this);
    this.lots = moonLabelAnchors();
    // The valley's gestures on the valley's surface: the canvas's parent, which holds the
    // lot labels and action buttons too, so a drag that starts on a label still orbits.
    const surface = canvas.parentElement;
    this.attachCamera(surface);
    // A tap (not a drag) on a lot opens it, like a valley plot; on Earth it returns
    // to the valley. Taps never move the camera.
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(PICK_LAYER);
    this.pickTargets = this.d.group(this.scene);
    this.pickTargets.name = 'Moon lot tap targets';
    this.attachInput(surface);
    this.elapsed = 0;
    this.construction = new MoonConstruction(this);
    this.upgradeGlow = new TownUpgradeGlow(this.scene);
    this.addParcels();
    this.signature = '';
    this.pacer = new TownFramePacer();
    this.tick = this.tick.bind(this);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.unwatchContext = watchContextLoss(this);
  }
  // The valley's context-loss contract (TownRenderer): stop and hand over to the owner.
  handleContextLoss(event) {
    loseContext(this, event);
  }
  /**
   * The valley's tap gesture on the camera's surface: one still pointer with the primary
   * button, and the trailing click swallowed outside the Moon view. A press on the scene
   * or on a lot's label or action button may become a tap; a label's opens its lot, as
   * a valley label does.
   */
  attachInput(surface) {
    const canvas = this.canvas;
    this.surface = surface;
    this.tapGesture = createTapGesture({
      map: () => surface,
      onTap: (event, lot) => (lot ? this.onSelect(lot) : this.tap(event)),
    });
    this.onPointerDown = (event) => {
      const label = event.target.closest?.('[data-moon-lot], [data-moon-action]');
      if (event.target === canvas || label)
        this.tapGesture.down(event, label?.dataset.moonLot ?? label?.dataset.moonAction);
    };
    this.onPointerUp = (event) => this.tapGesture.up(event);
    this.onPointerMove = (event) => {
      this.tapGesture.move(event);
      // Hover feedback only while no button is held, so drags and pans never raycast.
      if (this.tapGesture.pressed || event.target !== canvas) return;
      // A mouse over a VIP names them, as in the valley.
      if (event.pointerType === 'mouse') hoverVillager(this, event.clientX, event.clientY);
      canvas.style.cursor = this.hitsEarth(event) || this.pick(event) ? 'pointer' : 'grab';
    };
    this.onPointerLeave = (event) => {
      if (!this.tapGesture.pressed && event.pointerType === 'mouse')
        hoverVillager(this, -Infinity, -Infinity);
    };
    this.onPointerCancel = (event) => {
      this.tapGesture.cancel(event);
      canvas.style.cursor = 'grab';
    };
    surface.addEventListener('pointerdown', this.onPointerDown);
    surface.addEventListener('pointerup', this.onPointerUp);
    surface.addEventListener('pointermove', this.onPointerMove);
    surface.addEventListener('pointerleave', this.onPointerLeave);
    surface.addEventListener('pointercancel', this.onPointerCancel);
    surface.addEventListener('lostpointercapture', this.onPointerCancel);
  }
  /** Drag to orbit, middle or right drag to pan, wheel and pinch to zoom: the valley's set. */
  attachCamera(surface) {
    this.controls = createTownControls(this.camera, surface);
    this.controls.target.set(0, 0, 4);
    this.controls.minDistance = 22;
    this.controls.maxDistance = 115;
    this.controls.minPolarAngle = 0.55;
    this.controls.maxPolarAngle = 1.38;
    this.cameraChanged = this.cameraChanged.bind(this);
    this.controls.addEventListener('change', this.cameraChanged);
    this.controls.update();
  }
  // Every camera change keeps the camera above the Moon's hills, as the valley does.
  cameraChanged() {
    if (
      keepCameraAboveTerrain(
        this.camera.position,
        this.controls.target,
        this.controls.minPolarAngle,
        this.terrainHeight,
      )
    )
      this.controls.update();
    this.requestFrame();
  }
  /** The keyboard's stepped camera moves, shared with the valley; `reset` frames New Hollow. */
  cameraAction(action) {
    cameraAction(this, action);
  }
  /** Explicit navigation (a Build row) turns the camera to a lot or site; taps never do. */
  focusPlace(id) {
    const parcel = moonParcels().find((place) => place.id === id);
    return !!parcel && focusCamera(this, [parcel.x, parcel.z], parcel.kind === 'site' ? 34 : 30);
  }
  /** Rebuild the lots when the town's Moon buildings change. */
  update(town) {
    this.town = town;
    // VIP tours read the town's finished shops and paths; a tour under way carries on.
    this.vipArrivals?.attach(town);
    syncMoonMonuments(this, town);
    // Sites record their height before their meshes merge into the monument batch.
    this.monuments?.traverse((site) => {
      if (site.userData.monumentSite)
        this.fitPickTarget(site.userData.monumentSite, site.userData.height);
    });
    // Projects can advance without a building level changing. Their sites own
    // their geometry and update independently of the merged settlement mesh.
    this.construction.sync(town);
    // A worksite's gantries and crane rise above an empty pad: they answer taps too.
    this.refitLots();
    this.saucer.update(town, this.elapsed, this.reducedMotion);
    this.requestFrame();
    // Building lots only: monument sites add labels to this.lots but draw separately.
    const levels = Object.keys(MOON_LOTS).map((id) => town?.buildings?.[id] ?? 0);
    const finishes = Object.keys(MOON_LOTS).map((id) => finishKey(town ?? {}, id));
    const signature = finishes.join('|');
    if (signature === this.signature) return;
    // A lot finished while the Moon is open settles into place with the valley's
    // construction reveal: drawn on its own until then, outside the merged settlement.
    const previous = this.finishes;
    const finished = new Set(
      previous && !this.reducedMotion
        ? Object.keys(MOON_LOTS).filter((id, n) => levels[n] > 0 && finishes[n] !== previous[n])
        : [],
    );
    this.endLotReveals();
    this.signature = signature;
    this.finishes = finishes;
    this.d.clearGroup(this.buildings);
    this.buildings = this.d.group(this.scene);
    this.buildings.name = 'New Hollow buildings';
    Object.keys(MOON_LOTS).forEach((id, n) => {
      const { x, z, rotation } = moonLotPose(id);
      const lot = this.d.group(finished.has(id) ? this.scene : this.buildings, x, 0, z);
      lot.rotation.y = rotation;
      renderMoonBuilding(this.d, lot, id, levels[n]);
      if (id === 'ribbonLanding') this.climber = lot.getObjectByName(MOON_CLIMBER) ?? null;
      // A tap over a low building reaches the lot behind it, as on screen.
      (this.roofs ??= {})[id] = moonRoofHeight(lot);
      if (finished.has(id)) this.revealLot(id, lot, this.previousLevels?.[n] ?? 0);
    });
    this.access.geometry.dispose();
    this.access.geometry = moonAccessGeometry(moonApproaches(town?.buildings ?? {}));
    this.previousLevels = levels;
    this.refitLots();
    // The whole settlement draws as one merged mesh per palette colour.
    this.d.batch(this.buildings);
    this.populate(town);
    this.requestFrame();
  }
  // The finished lot's new pieces (those its previous model lacked) settle top-down under
  // the swinging hammer, exactly as a finished valley building does.
  revealLot(id, lot, previousLevel) {
    const before = new THREE.Group();
    before.position.copy(lot.position);
    before.rotation.copy(lot.rotation);
    renderMoonBuilding(this.d, before, id, previousLevel);
    const parts = constructionParts(before);
    this.d.clearGroup(before);
    lot.userData.plot = id;
    const reveal = new TownConstruction(this, lot, null, parts);
    reveal.presentFirstStrike();
    (this.lotReveals ??= new Map()).set(id, { reveal, lot });
  }
  // Ends every lot reveal at once; the next update merges those lots with the rest.
  endLotReveals() {
    for (const { reveal, lot } of this.lotReveals?.values() ?? []) {
      reveal.finish();
      this.d.clearGroup(lot);
    }
    this.lotReveals?.clear();
  }
  updateLotReveals(time, still = false) {
    if (!this.lotReveals?.size) return;
    let settled = true;
    for (const { reveal } of this.lotReveals.values()) if (!reveal.update(time)) settled = false;
    if (!still && !settled) return;
    // Merge the settled lots back into the settlement batch.
    this.endLotReveals();
    this.signature = '';
    this.update(this.town);
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
    this.settlers = [];
    for (let n = 0; n < Math.min(10, 2 + homes * 2); n++)
      this.settlers.push({
        ...moonSuitFigure(this.d, { parent: this.life, suit: suits[n % 3] }),
        plan: moonSettlerPlan(town?.buildings ?? {}, n),
      });
    if (town?.buildings?.roverBarn) {
      for (let n = 0; n < town.buildings.roverBarn; n++) {
        const r = moonRover(this.d, this.life);
        this.walkers.push({
          root: r,
          radius: MOON_RING_ROAD,
          speed: 0.11,
          phase: n * 2.1,
          dir: 1,
        });
      }
    }
    this.move(this.elapsed);
  }
  move(time) {
    this.construction.update(time, this.reducedMotion);
    this.updateLotReveals(time, this.reducedMotion);
    this.saucer.step(time, this.reducedMotion);
    this.moveTransports(time);
    this.monuments?.userData.update(this.reducedMotion ? 0 : time);
    for (const settler of this.settlers ?? []) animateMoonSettler(settler, time);
    // Rovers circle the ring road.
    for (const w of this.walkers ?? []) {
      const a = w.phase + w.dir * time * w.speed;
      w.root.position.set(Math.cos(a) * (w.radius + 0.3), 0, Math.sin(a) * (w.radius + 0.3));
      w.root.rotation.y = -a - (w.dir > 0 ? 0 : Math.PI);
    }
  }
  /**
   * The climber rides the ribbon; the climber and the saucer publish their arrivals the
   * way the valley's transports do, for the shared VIP arrivals to read.
   */
  moveTransports(time) {
    const transports = this.visitorTransports;
    if (!transports) return;
    const climber = this.climber?.parent ? this.climber : null;
    // A landing settling under its construction reveal keeps its climber docked. The
    // climber is a vehicle: it keeps riding with reduced motion, as valley vehicles do.
    const docked = this.lotReveals?.has('ribbonLanding');
    if (climber) climber.position.y = docked ? 0 : moonClimberLift(time);
    if (climber && !docked)
      transports.set('ribbonLanding', { ...moonClimberArrival(time), root: climber });
    else transports.delete('ribbonLanding');
    const craft = this.saucer?.craft;
    if (craft) transports.set('saucerPad', { ...moonSaucerArrival(time), root: craft.root });
    else transports.delete('saucerPad');
  }
  // The shared VIP arrivals call these, as they call the valley diorama's.
  drawVip(seed, visit = 0) {
    return this.vipsHidden ? null : vipVisitor(seed, visit);
  }
  setVillagerIdentity(actor, identity, outfitSeed) {
    dressMoonVip(this.d, actor, identity, eraEvolution(this.town?.era), outfitSeed);
  }
  animatePerson(actor, time) {
    animateMoonVip(this, actor, time);
  }
  // Now and then a meteor streaks across the sky: a celebration, never a hazard.
  meteor(time) {
    // A celebration effect: reduced motion leaves it out.
    if (this.reducedMotion) {
      if (this.streak) this.streak.visible = false;
      return;
    }
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
  // The shared unveiling stands on the level crater floor and casts suited settlers;
  // the Moon has no companion animals.
  surfaceHeight() {
    return 0;
  }
  person({ parent, color }) {
    return moonSuitFigure(this.d, { parent, pack: color });
  }
  get fauna() {
    return NO_COMPANIONS;
  }
  setPresentation(definition) {
    if (this.presentation?.definition === definition) return;
    this.presentation?.dispose();
    this.presentation = null;
    // The Moon's only event is a monument unveiling on the shared timeline. Buildings
    // finish with their construction reveal, as in the valley, without a cinematic.
    if (definition?.id === 'monument-unveiling')
      this.presentation = moonMonumentPresentation(this, definition);
    this.requestFrame();
  }
  presentationFrame(time, still = false) {
    this.presentation?.frame(time, still);
  }
  setMotion(enabled) {
    this.animating = enabled;
    this.motionEnabled = enabled;
    this.pacer.reset();
    this.renderQuality?.resetWindow();
    this.renderer.setAnimationLoop(enabled && !this.contextUnavailable ? this.tick : null);
    if (!enabled) this.requestFrame();
  }
  // The valley's upgrade glow rule: the lots whose indicator is 'upgrade' (TownScene).
  setUpgradeable(ids) {
    if (this.upgradeGlow.setAvailable(ids)) this.requestFrame();
  }
  /** Every parcel's glow and tap target follow its pad, from the one parcel contract. */
  addParcels() {
    this.parcels = new Map();
    for (const parcel of moonParcels()) {
      this.parcels.set(parcel.id, parcel);
      this.upgradeGlow.addPolygon(parcel.id, { ...parcel, height: 0 });
      this.addPickTarget(parcel);
    }
  }
  // An invisible prism over a parcel's pad: taps on the pad or its building select it.
  addPickTarget({ id, x, z, radius, rotation, sides }) {
    this.pickGeometries ??= new Map();
    if (!this.pickGeometries.has(sides))
      this.pickGeometries.set(sides, new THREE.CylinderGeometry(1, 1, 1, sides));
    this.pickMaterial ??= new THREE.MeshBasicMaterial({ visible: false });
    const target = new THREE.Mesh(this.pickGeometries.get(sides), this.pickMaterial);
    target.scale.set(radius, PICK_HEIGHT, radius);
    target.position.set(x, PICK_HEIGHT / 2, z);
    target.rotation.y = rotation;
    target.layers.set(PICK_LAYER);
    target.userData.lot = id;
    target.name = `Tap target ${id}`;
    this.pickTargets.add(target);
  }
  // Each lot's tap target reaches the taller of its building and its worksite.
  refitLots() {
    for (const id of Object.keys(MOON_LOTS)) {
      const site = this.construction?.sites?.get(id)?.root;
      this.fitPickTarget(id, Math.max(this.roofs?.[id] ?? 0, site ? moonRoofHeight(site) : 0));
    }
  }
  // A parcel's tap target reaches its roof; its upgrade glow hugs the base of what stands
  // there, a faint low band (GLOW_WALL) as on every map.
  fitPickTarget(id, height) {
    const target = this.pickTargets?.children.find((mesh) => mesh.userData.lot === id);
    if (!target || !Number.isFinite(height)) return;
    const top = Math.max(1.2, height + 0.2);
    target.scale.y = top;
    target.position.y = top / 2;
    target.updateMatrixWorld();
    const parcel = this.parcels?.get(id);
    if (parcel && (this.glowHeights ??= new Map()).get(id) !== height) {
      this.glowHeights.set(id, height);
      this.upgradeGlow.addPolygon(id, { ...parcel, height });
    }
  }
  /**
   * A tap names the VIP under it, opens the parcel under it, or the valley from Earth.
   * It never moves the camera.
   */
  tap(event) {
    if (showVillager(this, event.clientX, event.clientY, true)) return null;
    if (this.hitsEarth(event)) return this.onEarth();
    const id = this.pick(event);
    if (id) this.onSelect(id);
    return id;
  }
  /** The lot or open monument site under a pointer event, nearest first. */
  pick(event) {
    if (!this.aim(event)) return null;
    for (const hit of this.raycaster.intersectObject(this.pickTargets, true)) {
      const id = hit.object.userData.lot;
      const area = MOON_MONUMENT_AREAS.find((site) => site.id === id);
      if (!area || areaUnlocked(this.town, area)) return id;
    }
    return null;
  }
  /** Outline the chosen lot's pad with the valley's shared parcel outline. */
  setSelected(id) {
    if (id === this.selected) return;
    this.selected = id;
    this.selectionRoot?.removeFromParent();
    const target = id && this.pickTargets.children.find((mesh) => mesh.userData.lot === id);
    if (target) {
      if (!this.selection) {
        // The shared parcel outline for a unit pad, scaled to each pad below.
        this.selection = parcelOutlineMesh(
          { radius: 1, sides: MOON_PARCEL_SIDES },
          { gap: 0.06, width: 0.06 },
        );
        this.selection.name = 'Selected Moon lot outline';
        this.selectionRoot = new THREE.Group();
        this.selectionRoot.add(this.selection);
      }
      const radius = target.scale.x;
      this.selection.scale.set(radius, 1, radius);
      this.selectionRoot.position.set(target.position.x, 0.07, target.position.z);
      this.selectionRoot.rotation.y = target.rotation.y;
      this.scene.add(this.selectionRoot);
    }
    this.requestFrame();
  }
  setLabelActions(ids) {
    const key = ids.join(',');
    if (key === this.labelActionKey) return;
    this.labelActionKey = key;
    this.labelActions = new Set(ids);
    this.labelKey = null;
    this.requestFrame();
  }
  /**
   * The app's reduced-motion setting, with the valley's policy
   * (docs/era-architecture.md#reduced-motion): reveals, the meteor, monument motion and
   * the saucer's wake and dust stop; settlers, rovers, the climber and the saucer move.
   */
  setReducedMotion(value) {
    this.reducedMotion = value;
    this.meteor(this.elapsed);
    this.construction.update(this.elapsed, value);
    this.updateLotReveals(this.elapsed, value);
    this.saucer.step(this.elapsed, value);
    this.moveTransports(this.elapsed);
    this.requestFrame();
  }
  // Paced like the valley: a fast display does not draw more than 60 frames a second.
  tick(now) {
    if (this.contextUnavailable || !this.pacer.due(now)) return;
    // The valley's adaptive drawing-buffer and shadow tier, outside presentations.
    const frameTime = this.pacer.frameTime;
    if (frameTime !== null && !this.presentation) adaptRenderQuality(this, frameTime);
    const delta = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 0;
    this.lastNow = now;
    this.elapsed += delta;
    this.move(this.elapsed);
    this.vipArrivals?.update();
    this.meteor(this.elapsed);
    // After an unveiling the camera flies home on the valley's event camera.
    if (updateEventCamera(this)) this.viewChanged = true;
    // A presentation draws its own frames, so the Moon is drawn once a frame, as in the
    // valley (TownDiorama.tick).
    if (!this.presentation) this.render();
  }
  // Camera, resize and lot changes come through here; only they move the lot labels.
  requestFrame() {
    this.viewChanged = true;
    // A running animation draws the latest pose on its next frame anyway.
    if (!this.animating) requestTownFrame(this);
  }
  render() {
    if (this.contextUnavailable) return;
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      // As in the valley (TownDiorama.drawFrame): stop, and let the owner fall back.
      this.contextUnavailable = true;
      this.renderer.setAnimationLoop(null);
      this.onUnavailable(error);
      return;
    }
    // A named VIP's tag follows them every frame and leaves when they go indoors.
    if (this.namedVillager) projectVillager(this);
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
        action: this.labelActions?.has(id) ?? false,
        depth: point.z,
        x: (point.x + 1) * 50,
        y: (1 - point.y) * 50,
        visible:
          point.z > -1 && point.z < 1 && Math.abs(point.x) < 1.05 && Math.abs(point.y) < 1.05,
      };
    });
    const distance =
      this.camera.position.distanceTo(this.controls.target) / (this.overviewScale ?? 1);
    const key =
      `${this.canvas.clientWidth}x${this.canvas.clientHeight}:${Math.round(distance * 10)}:` +
      labels
        .map((l) => `${l.id}${Math.round(l.x * 10)},${Math.round(l.y * 10)}${l.visible}`)
        .join();
    if (key === this.labelKey) return;
    this.labelKey = key;
    this.onLabels(labels, distance);
  }
  // Points the raycaster through a pointer event; false when the canvas has no size.
  aim(event) {
    return aimAt(this.raycaster, this.camera, this.canvas, event.clientX, event.clientY);
  }
  hitsEarth(event) {
    if (!this.aim(event)) return false;
    // Earth is on the default layer; lot targets are on their own.
    this.raycaster.layers.enable(0);
    const hit = this.raycaster.intersectObject(this.earth).length > 0;
    this.raycaster.layers.set(PICK_LAYER);
    return hit;
  }
  resize() {
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.fov = width < height ? 62 : 48;
    // Keep the outer lots on screen in portrait while retaining the player's
    // orbit angle and relative zoom when the viewport changes.
    const overviewScale = width < height ? Math.max(1, 1.05 / this.camera.aspect) : 1;
    this.camera.position
      .sub(this.controls.target)
      .multiplyScalar(overviewScale / (this.overviewScale ?? 1))
      .add(this.controls.target);
    this.overviewScale = overviewScale;
    this.controls.maxDistance = Math.max(115, overviewScale * 90);
    this.controls.update();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.requestFrame();
  }
  // New Hollow's overview: the shared cameraAction's `reset` frames it.
  frameTown() {
    const scale = this.overviewScale ?? 1;
    this.camera.position.set(0, 26 * scale, 4 + 62 * scale);
    this.controls.target.set(0, 0, 4);
    this.controls.update();
  }
  resetView() {
    this.cameraAction('reset');
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.hoverFrame);
    this.presentation?.dispose();
    this.saucer.dispose();
    this.vipArrivals?.dispose();
    this.renderer.setAnimationLoop(null);
    cancelAnimationFrame(this.cameraFrame);
    this.observer.disconnect();
    this.unwatchContext?.();
    this.controls.removeEventListener('change', this.cameraChanged);
    this.surface.removeEventListener('pointerdown', this.onPointerDown);
    this.surface.removeEventListener('pointerup', this.onPointerUp);
    this.surface.removeEventListener('pointermove', this.onPointerMove);
    this.surface.removeEventListener('pointerleave', this.onPointerLeave);
    this.surface.removeEventListener('pointercancel', this.onPointerCancel);
    this.surface.removeEventListener('lostpointercapture', this.onPointerCancel);
    this.controls.dispose();
    this.construction.dispose();
    this.endLotReveals();
    this.upgradeGlow.dispose();
    this.selectionRoot?.removeFromParent();
    this.selection?.geometry.dispose();
    this.selection?.material.dispose();
    // Shared primitives are released once below; everything else is owned here.
    const shared = new Set(Object.values(this.d.geometries)),
      geometries = new Set(),
      materials = new Set();
    this.scene.traverse((object) => {
      // three shares one sprite geometry across every renderer, the valley's sky Moon too.
      if (object.isSprite) shared.add(object.geometry);
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
