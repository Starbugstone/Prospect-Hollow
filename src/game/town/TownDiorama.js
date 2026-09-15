import { isCityEra } from '../../data/city';
import { eraEvolution } from '../../data/eras';
import { TownRenderQuality } from './TownRenderQuality';
import { bridgeDeckHeight } from './TownRiver';
import { buildingServiceLevel } from '../../data/buildingProgression';
import { TownUpgradeGlow } from './TownUpgradeGlow';
import * as THREE from 'three';
import { addAviationActivity } from './TownAviation';
import { updateEventCamera, beginEventCamera, restoreEventCamera } from './TownEventCamera';
import { createTownGeometries } from './TownGeometries';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BUILDING_BY_ID } from '../../data/town';
import { TownFrameCache } from './TownFrameCache';
import { TownStatics } from './TownStatics';
import { TownActors } from './TownActors';
import { addTownLife } from './TownLife';
import { addLeisureActivity } from './TownLeisure';
import { TownConstruction } from './TownConstruction';
import { buildTownSquare } from './TownSquare';
import {
  renderBuilding,
  renderModernization,
  renderEraLandmark,
} from './buildings/BuildingRenderer';
import { addEraActivity } from './TownEraActivity';
import { addScaffolding, addImprovements } from './TownImprovements';
import { addTownVisitors, TownRaid } from './TownActivity';
import { TownEraIncident } from './TownEraIncident';
import { eventKind } from '../../data/townEvents';
import {
  constructionVisual,
  constructionReady,
  plotUnlocked,
  population,
  nextGoal,
} from './TownRules';
import { buildLandscape, keepCameraAboveTerrain } from './TownLandscape';
import { addMotorActivity } from './TownMotorActivity';
import { motorTraffic } from './TownEvolution';
import { TownScenery } from './TownScenery';
import { addMineEra } from './TownMineEvolution';

import { PLOTS, LANE_X, atPlot, SHERIFF_PATROL, visiblePlots } from './TownLayout';
import { riverCenterX } from './TownRiver';
export { PLOTS } from './TownLayout';
const colors = {
  sand: '#c8ad7a',
  wood: '#9c7048',
  dark: '#514738',
  trim: '#e8d3a7',
  roof: '#638783',
};
const point = (x, y, z) => new THREE.Vector3(x, y, z);

// Original geometry shares static scenery batches and animated actor instances.
export class TownDiorama {
  constructor(canvas, onSelect, onLabels, onCameraDistance, onUnavailable) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.onLabels = onLabels;
    this.onCameraDistance = onCameraDistance;
    this.onUnavailable = onUnavailable;
    this.materials = new Map();
    this.geometries = createTownGeometries();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#e9e8da');
    this.scene.fog = new THREE.Fog('#e9e8da', 125, 205);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    this.camera.position.set(12, 12, 25);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderQuality = new TownRenderQuality(window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.renderQuality.ratio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.contactShadowMaterial = new THREE.MeshBasicMaterial({
      color: '#51432d',
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene.add(new THREE.HemisphereLight('#e1eff7', '#ba9460', 2.1));
    const sun = new THREE.DirectionalLight('#ffe3ad', 3.5);
    sun.position.set(-24, 38, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -31,
      right: 31,
      top: 35,
      bottom: -35,
      near: 1,
      far: 95,
    });
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.0001;
    this.scene.add(sun);
    this.sun = sun;
    this.scene.add(new THREE.DirectionalLight('#cde5e7', 0.65));
    this.scene.children.forEach((object) => {
      if (object.isLight) object.layers.enable(2);
    });
    this.frameCache = new TownFrameCache(this.renderer);
    this.upgradeGlow = new TownUpgradeGlow(this.scene);
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.enable(1);
    this.elapsed = 0;
    this.lastFrame = 0;
    this.landscape = buildLandscape(this);
    this.scene.add(this.landscape);
    this.actorRenderer = new TownActors(this.scene);
    this.sceneryRenderer = new TownStatics(this.scene);
    this.sceneryRenderer.rebuild([this.landscape]);
    this.buildingRenderer = new TownStatics(this.scene);
    this.controls = new OrbitControls(this.camera, canvas.parentElement);
    this.controls.cursorStyle = 'grab';
    this.controls.target.set(0, 0.7, 0);
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    this.controls.enableDamping = false;
    this.controls.minDistance = 13;
    this.controls.maxDistance = 110;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.24;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.85;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.controls.update();
    this.overview = true;
    this.beginCameraGesture = () => {
      this.cameraGesture = true;
    };
    this.endCameraGesture = () => {
      this.cameraGesture = false;
    };
    this.controls.addEventListener('start', this.beginCameraGesture);
    this.controls.addEventListener('end', this.endCameraGesture);
    this.cameraChanged = () => {
      // A building tap also starts an OrbitControls gesture. Only camera movement
      // should stop framing the town when a newly unlocked parcel expands it.
      if (this.cameraGesture && !this.framingTown) this.overview = false;
      if (
        keepCameraAboveTerrain(
          this.camera.position,
          this.controls.target,
          this.controls.minPolarAngle,
          this.terrainViewTargets,
        )
      )
        this.controls.update();
      // Pointer events can arrive faster than frames. Render only the latest pose.
      if (!this.cameraFrame)
        this.cameraFrame = requestAnimationFrame(() => {
          this.cameraFrame = 0;
          this.render();
        });
    };
    this.controls.addEventListener('change', this.cameraChanged);
    this.tick = this.tick.bind(this);
    this.resize = this.resize.bind(this);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.resize();
    this.contextLost = this.handleContextLoss.bind(this);
    canvas.addEventListener('webglcontextlost', this.contextLost);
  }
  handleContextLoss(event) {
    event.preventDefault();
    this.contextUnavailable = true;
    this.frameCache.valid = false;
    this.renderer.setAnimationLoop(null);
    // The owner disposes this scene while the context is lost, then rebuilds on
    // a fresh canvas. No buffers or cached attachments cross graphics contexts.
    this.onUnavailable?.(new Error('Town graphics context lost'), true);
  }
  drawFrame(refresh = false) {
    try {
      this.frameCache.render(this.scene, this.camera, refresh);
      return true;
    } catch (error) {
      this.contextUnavailable = true;
      this.renderer.setAnimationLoop(null);
      this.onUnavailable?.(error);
      return false;
    }
  }
  material(color) {
    if (!this.materials.has(color))
      this.materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.88 }));
    return this.materials.get(color);
  }
  mesh(parent, shape, size, position, color) {
    const mesh = new THREE.Mesh(this.geometries[shape], this.material(color));
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  box(parent, w, h, d, x, y, z, color, round = false) {
    return this.mesh(parent, round ? 'rounded' : 'box', [w, h, d], [x, y, z], color);
  }
  ball(parent, x, y, z, size, color, shape = 'sphere') {
    return this.mesh(
      parent,
      shape,
      Array.isArray(size) ? size : [size, size, size],
      [x, y, z],
      color,
    );
  }
  rod(parent, a, b, radius, color) {
    const start = point(...a),
      end = point(...b),
      delta = end.clone().sub(start);
    const mesh = this.mesh(
      parent,
      'cylinder',
      [radius, delta.length(), radius],
      start.clone().add(end).multiplyScalar(0.5).toArray(),
      color,
    );
    mesh.quaternion.setFromUnitVectors(point(0, 1, 0), delta.normalize());
    return mesh;
  }
  group(parent, x = 0, y = 0, z = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  }
  sign(parent, text, width, x, y, z) {
    this.box(parent, width + 0.1, 0.43, 0.1, x, y, z, '#8c6947', true);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ecddbb';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#56472e';
    ctx.font = 'bold 48px Georgia';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 68, 480);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
    material.userData.transient = true;
    const sign = this.box(parent, width, 0.35, 0.012, x, y, z + 0.058, '#ffffff');
    sign.material = material;
  }
  batch(group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(),
      buckets = new Map(),
      meshes = [];
    group.traverse((object) => {
      if (!object.isMesh) return;
      meshes.push(object);
      const geometry = object.geometry
        .clone()
        .applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      if (!buckets.has(object.material)) buckets.set(object.material, []);
      buckets.get(object.material).push(geometry);
    });
    meshes.forEach((mesh) => mesh.removeFromParent());
    for (const [material, geometries] of buckets) {
      const geometry = mergeGeometries(geometries);
      geometries.forEach((item) => item.dispose());
      geometry.userData.owned = true;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  clearGroup(group) {
    if (!group) return;
    const geometries = new Set(),
      materials = new Set();
    group.traverse((object) => {
      if (object.geometry?.userData.owned) geometries.add(object.geometry);
      if (object.material?.userData.transient) materials.add(object.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
    group.removeFromParent();
  }
  update(town, labels, mineStage = 0, constructionId = null) {
    const interruptedGroup = this.construction?.group;
    this.construction?.finish();
    this.construction = null;
    const plots = visiblePlots(town);
    const reusable = new Map();
    const labelSignature = JSON.stringify(labels);
    const signatures = new Map(
      plots.map(({ id }) => [
        id,
        JSON.stringify([
          labelSignature,
          town.era,
          town.buildings[id],
          constructionVisual(town.projects[id]),
          town.buildingEras[id],
          town.buildingEraLevels[id],
          id === 'mine' ? mineStage : null,
        ]),
      ]),
    );
    // Keep unchanged plot meshes (and their sign textures) out of world disposal.
    // A reveal needs fresh articulated pieces, including when interrupted by a tap.
    for (const [id, cached] of this.plotCache ?? []) {
      if (
        id === constructionId ||
        cached.group === interruptedGroup ||
        cached.signature !== signatures.get(id)
      )
        continue;
      cached.group.removeFromParent();
      cached.movingPart?.rotor.removeFromParent();
      reusable.set(id, cached);
    }
    this.plotCache = new Map();
    this.actorRenderer.clear();
    this.staticScenery ??= new TownScenery();
    this.staticScenery.detach();
    this.upgradeGlow.clear();
    this.clearGroup(this.world);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.actors = [];
    this.motions = [];
    this.targets = [];
    this.anchors = [];
    this.town = town;
    // Protect actual parcel foundations; rectangle corners can lie on a hill
    // outside the irregular settlement and force a needless overhead view.
    this.terrainViewTargets = visiblePlots(town)
      .filter(({ id }) => id !== 'bridge')
      .map(({ position: [x, z] }) => point(x, 0.2, z));
    this.guidedPlot = nextGoal(town)?.id;
    this.staticScenery.update(this, town);
    this.controls.maxDistance = [
      'post-war',
      'motor-age',
      'aviation',
      'broadcast',
      'contemporary',
    ].includes(town.era)
      ? 270
      : town.era !== 'frontier'
        ? 160
        : 110;
    // Expanded towns need a farther overview on phones; keep buildings ahead of the fog.
    if (this.scene.fog) {
      this.scene.fog.near = town.era !== 'frontier' ? 325 : 125;
      this.scene.fog.far = town.era !== 'frontier' ? 390 : 205;
    }
    for (const {
      id,
      position: [x, z],
    } of plots) {
      const cached = reusable.get(id);
      const group = cached?.group ?? this.group(this.world, x, 0.08, z);
      if (cached) this.world.add(group);
      group.userData.plot = id;
      group.userData.static = true;
      this.targets.push(group);
      this.anchors.push({
        id,
        width: id === 'mine' ? 132 : Math.max(76, labels[id].length * 7 + 35),
        position: point(x, 0.2, z + (id === 'mine' ? 1.65 : 1.85)),
      });
      let movingPart = cached?.movingPart;
      if (!cached && id === 'mine') this.mine(group, labels.mine, mineStage);
      else if (!cached) {
        const stage = buildingServiceLevel(id, town.buildings[id]),
          project = town.projects[id],
          kind = BUILDING_BY_ID[id].kind;
        if (kind === 'bridge') {
          renderBuilding({ town: this, parent: group, kind, level: stage, label: labels[id] });
          if (stage)
            renderModernization(
              this,
              group,
              kind,
              town.buildingEras[id],
              town.buildingEraLevels[id] || stage,
            );
          if (project) addScaffolding(this, group, kind, stage, constructionVisual(project));
        } else if (!stage) this.plot(group, kind, project ? 2 : -1, labels[id]);
        else {
          const industrial = renderEraLandmark(
            this,
            group,
            kind,
            labels[id],
            town.buildingEraLevels[id] || 1,
            town.buildingEras[id],
            stage,
          );
          if (!industrial) {
            if (kind === 'square') buildTownSquare(this, group, stage);
            else if (kind === 'well') this.well(group);
            else this.building(group, kind, stage, labels[id]);
          }
          if (!industrial && !['fisherman', 'blacksmith', 'school', 'doctor'].includes(kind))
            movingPart = addImprovements(this, group, kind, stage);
          if (!industrial)
            renderModernization(
              this,
              group,
              kind,
              town.buildingEras[id],
              town.buildingEraLevels[id] || stage,
            );
          const wheel = group.getObjectByName('Watermill wheel');
          if (wheel)
            movingPart = {
              rotor: wheel,
              update: (time) => {
                wheel.rotation.x = time * 0.45;
              },
            };
          if (project) addScaffolding(this, group, kind, stage, constructionVisual(project));
        }
      }
      const bounds = new THREE.Box3().setFromObject(group);
      if (id !== 'mine') this.upgradeGlow.add(id, bounds);
      // Keep action icons at the front porch, below the roofline.
      this.anchors.at(-1).collection = point(x, 1, z + 2.2);
      // Keep the windmill rotor articulated while batching the rest of its building.
      if (movingPart) {
        group.updateMatrixWorld(true);
        movingPart.rotor.updateWorldMatrix(true, false);
        this.world.attach(movingPart.rotor);
        movingPart.rotor.userData.animated = true;
      }
      if (id === constructionId)
        this.construction = new TownConstruction(this, group, movingPart?.rotor);
      else if (!cached) this.batch(group);
      if (movingPart) this.motions.push(movingPart.update);
      this.plotCache.set(id, { signature: signatures.get(id), group, movingPart });
    }
    // Model preparation can be expensive. Start the reveal clock on its first visible frame.
    if (this.construction) this.lastFrame = 0;
    const household = population(town);
    addEraActivity(this, town);
    addMotorActivity(this, town);
    addTownVisitors(this, town);
    addTownLife(this, town);
    addLeisureActivity(this, town);
    addAviationActivity(this, town);
    this.person({
      color: '#738a83',
      skin: '#d5ad88',
      hat: '#b38d59',
      route: [
        [-LANE_X, -8.5],
        [-LANE_X, -0.5],
        [-LANE_X, 7.5],
        [-LANE_X, 15.5],
      ],
      seed: 1,
    });
    if (household) {
      this.person({
        color: '#aa6959',
        skin: '#d7b291',
        hat: '#846642',
        route: [
          [-7, -0.5],
          [-LANE_X, -0.5],
          [LANE_X, -0.5],
          [7, -0.5],
        ],
        seed: 4,
      });
      this.person({
        color: '#d2a56a',
        skin: '#8d6045',
        hat: '#d7bf8b',
        route: [
          [LANE_X, 15.5],
          [LANE_X, 7.5],
          [LANE_X, -0.5],
          [LANE_X, -8.5],
        ],
        seed: 9,
        dress: true,
      });
    }
    if (household > 2)
      this.person({
        color: '#879460',
        skin: '#b07c59',
        hat: '#ae814d',
        route: [
          [-15, 7.5],
          [-11, 7.5],
          [-11, -0.5],
          [-7, -0.5],
        ],
        seed: 13,
      });
    if (town.buildings.farm)
      this.person({
        color: '#809267',
        skin: '#af7b56',
        hat: '#d7b671',
        route: [atPlot('farm', 1.35, 2.1), atPlot('farm', 1.15, 1.6)],
        seed: 2,
        work: 'farm',
      });
    if (town.buildings.saloon)
      this.person({
        color: '#a47d91',
        skin: '#edc7a4',
        hat: '#b89869',
        route: [atPlot('saloon', 0.65, 1.7), atPlot('saloon', 0.95, 1.5)],
        seed: 6,
        work: 'greet',
        dress: true,
      });
    if (town.buildings.sheriff)
      this.person({
        color: '#315d83',
        skin: '#c99d74',
        hat: '#f0d390',
        route: SHERIFF_PATROL,
        seed: 0,
        sheriff: true,
        loop: true,
      });
    if (town.buildings.stable && !motorTraffic(town)) {
      this.horse(...atPlot('stable', 2.25, 0.9), 0.5);
      this.horse(...atPlot('stable', 2.65, -0.9), -0.9, 0.85);
    }
    const cart = this.group(this.world, 0.1, 0.08, PLOTS.mine[1] + 1.6);
    cart.userData.animated = true;
    this.box(cart, 0.75, 0.4, 0.55, 0, 0.45, 0, '#617d80', true);
    for (const x of [-0.32, 0.32])
      for (const z of [-0.2, 0.2])
        this.rod(cart, [x - 0.04, 0.18, z], [x + 0.04, 0.18, z], 0.15, '#554b38');
    for (let n = 0; n < 4; n++)
      this.ball(
        cart,
        (n % 2) * 0.23 - 0.12,
        0.7,
        Math.floor(n / 2) * 0.16 - 0.09,
        0.13,
        n % 2 ? '#b58ed4' : '#83b6b7',
        'rock',
      );
    this.motions.push((time) => {
      cart.position.z = PLOTS.mine[1] + 1.6 + Math.sin(time * 0.45) * 0.32;
    });
    this.actors.forEach((actor) => this.animatePerson(actor, this.elapsed));
    this.motions.forEach((motion) => motion(this.elapsed));
    this.rebuildActors();
    this.buildingRenderer.sync(this.world.children.filter((child) => child.userData.static));
    this.renderer.shadowMap.needsUpdate = true;
    if (this.overview) this.frameTown();
    this.render();
  }
  cactus(parent, x, z) {
    this.rod(parent, [x, 0, z], [x, 1.25, z], 0.11, '#7c9470');
    this.rod(parent, [x, 0.6, z], [x - 0.35, 0.6, z], 0.085, '#7c9470');
    this.rod(parent, [x - 0.35, 0.6, z], [x - 0.35, 0.95, z], 0.085, '#7c9470');
    this.rod(parent, [x, 0.8, z], [x + 0.27, 0.8, z], 0.075, '#7c9470');
    this.rod(parent, [x + 0.27, 0.8, z], [x + 0.27, 1.1, z], 0.075, '#7c9470');
  }
  plot(parent, id, wins, label) {
    const w = id === 'well' ? 2.1 : 3.05,
      d = id === 'well' ? 2.1 : 2.7;
    for (const x of [-w / 2, w / 2])
      for (const z of [-d / 2, d / 2]) this.box(parent, 0.12, 0.6, 0.12, x, 0.3, z, '#a58a57');
    for (const z of [-d / 2, d / 2])
      this.rod(parent, [-w / 2, 0.44, z], [w / 2, 0.44, z], 0.05, '#e5cf9b');
    for (const x of [-w / 2, w / 2])
      this.rod(parent, [x, 0.44, -d / 2], [x, 0.44, d / 2], 0.05, '#e5cf9b');
    if (wins < 0) {
      this.box(parent, 0.08, 0.5, 0.08, -w / 2 + 0.25, 0.2, d / 2 - 0.25, '#99805a');
      this.sign(parent, label, 1.05, -w / 2 + 0.25, 0.52, d / 2 - 0.25);
      return;
    }
    for (let n = 0; n < 5; n++)
      this.box(parent, 0.18, 0.11, 1.2, w / 2 + 0.22, 0.1 + n * 0.09, 0.1, '#bd9a67');
    if (wins === 0) return;
    if (id === 'well') {
      this.well(parent, wins === 1 ? 'foundation' : 'frame');
      return;
    }
    this.box(parent, 2.85, 0.2, 2.5, 0, 0.13, 0, '#a99579');
    if (wins === 1) {
      for (const x of [-1.3, 1.3]) this.box(parent, 0.12, 0.75, 2.3, x, 0.6, 0, '#b9a183');
      for (const z of [-1.13, 1.13]) this.box(parent, 2.6, 0.45, 0.12, 0, 0.46, z, '#b9a183');
      return;
    }
    this.building(parent, id, 0, label, true);
    for (const x of [-1.7, 1.7]) {
      for (const z of [-1.4, 1.4]) this.rod(parent, [x, 0, z], [x, 2.1, z], 0.045, '#b09771');
      this.box(parent, 0.55, 0.08, 3.0, x, 1.32, 0, '#b9a072');
      this.rod(parent, [x, 0.1, -1.4], [x, 2, 1.4], 0.035, '#b09771');
    }
  }
  building(parent, id, stage, label, framing = false) {
    renderBuilding({ town: this, parent, kind: id, level: stage, label, construction: framing });
  }
  homeWing(parent, wins) {
    const wing = this.group(parent, -1.85, 0, 0.15);
    if (wins === 0) {
      for (let n = 0; n < 5; n++)
        this.box(wing, 0.8, 0.09, 0.17, 0, 0.08 + n * 0.09, 0.3, '#bd9a67');
      return;
    }
    this.box(wing, 1.35, 0.18, 1.9, 0, 0.12, 0, '#a99579');
    if (wins === 1) return;
    for (const x of [-0.6, 0.6])
      for (const z of [-0.87, 0.87]) this.box(wing, 0.08, 1.25, 0.08, x, 0.81, z, '#b39469');
    for (let row = 0; row < (wins === 2 ? 3 : 7); row++) {
      const y = 0.32 + row * 0.16;
      for (const x of [-0.6, 0.6]) this.box(wing, 0.08, 0.145, 1.75, x, y, 0, '#d4ad89');
      for (const z of [-0.87, 0.87]) this.box(wing, 1.2, 0.145, 0.08, 0, y, z, '#d4ad89');
    }
    if (wins < 3) return;
    for (const z of [-0.9, 0, 0.9])
      this.rod(wing, [-0.7, 1.3, z], [0.7, 1.55, z], 0.045, '#9d7b50');
    if (wins < 4) return;
    const roof = this.box(wing, 1.5, 0.14, 2.0, 0, 1.43, 0, '#73928a');
    roof.rotation.z = 0.18;
    this.window(wing, 0, 0.95, 0.9);
  }
  window(parent, x, y, z) {
    this.box(parent, 0.54, 0.65, 0.06, x, y, z, '#514d37');
    this.box(parent, 0.44, 0.55, 0.06, x, y, z + 0.04, '#e1bd75');
    for (const dx of [-0.27, 0, 0.27])
      this.box(parent, 0.035, 0.68, 0.055, x + dx, y, z + 0.08, colors.trim);
    for (const dy of [-0.32, 0, 0.32])
      this.box(parent, 0.56, 0.035, 0.055, x, y + dy, z + 0.08, colors.trim);
    this.box(parent, 0.67, 0.15, 0.25, x, y - 0.43, z + 0.08, '#9b7852');
    for (let n = 0; n < 3; n++)
      this.ball(parent, x - 0.21 + n * 0.21, y - 0.34, z + 0.15, [0.14, 0.1, 0.12], '#7f9c65');
    this.ball(parent, x - 0.15, y - 0.25, z + 0.15, 0.065, '#e3a086');
  }
  well(parent, phase = 'done') {
    for (let layer = 0; layer < (phase === 'foundation' ? 1 : 3); layer++)
      for (let n = 0; n < 12; n++) {
        const angle = ((n + layer * 0.5) * Math.PI) / 6;
        const stone = this.box(
          parent,
          0.34,
          0.18,
          0.28,
          Math.cos(angle) * 0.59,
          0.17 + layer * 0.19,
          Math.sin(angle) * 0.59,
          n % 3 ? '#c8b597' : '#ad9b7e',
          true,
        );
        stone.rotation.y = -angle;
      }
    if (phase === 'foundation') return;
    this.mesh(
      parent,
      'cylinder',
      [0.48, 0.025, 0.48],
      [0, 0.2, 0],
      phase === 'done' ? '#6bacae' : '#77684d',
    );
    for (const x of [-0.86, 0.86]) this.box(parent, 0.14, 2.0, 0.14, x, 1.05, 0, '#ac8551');
    this.rod(parent, [-0.95, 1.7, 0], [0.95, 1.7, 0], 0.07, '#86613d');
    for (const side of [-1, 1]) {
      const roof = this.box(
        parent,
        1.25,
        0.12,
        1.75,
        side * 0.5,
        2.25,
        0,
        phase === 'done' ? '#5f8a89' : '#b69a6c',
      );
      roof.rotation.z = -side * 0.4;
    }
    if (phase !== 'done') return;
    this.rod(parent, [0, 1.75, 0], [0, 0.73, 0], 0.012, '#d6c298');
    this.mesh(parent, 'cone', [0.13, 0.22, 0.13], [0, 0.75, 0], '#aa7748');
  }
  mine(parent, label, stage = 0) {
    for (const [x, y, z, s] of [
      [-1.5, 1, -0.3, 1.2],
      [1.4, 1, -0.5, 1.3],
      [0, 2.1, -0.7, 1.4],
      [-0.8, 2, -0.7, 0.9],
      [1, 2, -1, 1],
    ])
      this.ball(parent, x, y, z, [s, s * 0.85, s * 0.7], x > 0 ? '#9d987b' : '#b6aa89', 'rock');
    this.box(parent, 1.75, 2.0, 0.12, 0, 1.05, 0.48, '#333b31', true);
    for (const x of [-1, 1]) this.box(parent, 0.2, 2.2, 0.25, x, 1.05, 0.67, '#ae8956');
    this.box(parent, 2.4, 0.25, 0.3, 0, 2.17, 0.68, '#997144');
    this.sign(
      parent,
      label,
      1.9,
      0,
      this.town?.era && this.town.era !== 'frontier' ? 3 : 2.36,
      1.3,
    );
    const gems = ['#b889ca', '#6dace5', '#6bcbae', '#e8c879', '#e495b3'];
    for (let n = 0; n < stage; n++) {
      const side = n % 2 ? 1 : -1;
      this.ball(
        parent,
        side * (1.35 + Math.floor(n / 12) * 0.55),
        0.35 + Math.floor((n % 12) / 2) * 0.42,
        0.62,
        [0.18, 0.3, 0.18],
        gems[n % gems.length],
        'rock',
      );
    }
    if (stage >= 1)
      for (const x of [-1, 1]) this.box(parent, 0.25, 0.18, 0.3, x, 1.45, 0.7, '#b4c2bd');
    if (stage >= 2) this.box(parent, 2.5, 0.12, 0.38, 0, 2.12, 0.73, '#b2bbb5');
    if (stage >= 3) this.box(parent, 0.8, 0.55, 0.75, -1.6, 0.4, 1.5, '#a07d57');
    if (stage >= 4) this.box(parent, 0.75, 0.6, 1, 0.1, 0.46, 1.6, '#748f95');
    if (stage >= 5) this.box(parent, 3, 0.14, 0.9, 0, 2.62, 0.7, '#658779');
    if (stage >= 6)
      for (const x of [-1.7, 1.7]) this.rod(parent, [x, 0, -0.4], [x, 3.65, -0.4], 0.1, '#a38252');
    if (stage >= 7) this.rod(parent, [-1.7, 3.65, -0.4], [1.7, 3.65, -0.4], 0.14, '#b39260');
    if (stage >= 8)
      for (const x of [-1.65, 1.65]) this.box(parent, 0.24, 0.45, 0.25, x, 2.9, 0.2, '#ffe3a0');
    if (stage >= 9) this.box(parent, 3.8, 0.15, 1.5, 0, 3.9, -0.4, '#78938a');
    if (stage >= 10) this.ball(parent, 0, 4.3, -0.4, [0.4, 0.6, 0.4], '#edcf76', 'rock');
    for (const x of [-0.38, 0.38]) this.box(parent, 0.06, 0.04, 3.1, x, 0.06, 1.15, '#737b70');
    for (let n = 0; n < 9; n++)
      this.box(parent, 1, 0.065, 0.13, 0, 0.04, -0.1 + n * 0.35, '#9f8157');
    this.box(parent, 0.16, 0.28, 0.18, -1.22, 1.63, 0.78, '#e7bd73', true);
    addMineEra(this, parent, this.town?.era);
  }
  person({
    color,
    skin,
    hat,
    route,
    seed,
    work,
    dress,
    parent = this.world,
    manual = false,
    visitor = false,
    sheriff = false,
    loop = false,
    linear = false,
    era = this.town?.era,
  }) {
    const root = this.group(parent);
    // Manual incident actors still need the animated foreground renderer.
    root.userData.animated = true;
    if (sheriff) {
      root.name = 'Village sheriff';
      root.scale.setScalar(1.3);
    }
    const body = this.group(root, 0, 0.54, 0);
    this.box(body, 0.25, 0.19, 0.16, 0, 0, 0, '#69654d', true);
    const torso = this.group(body, 0, 0.1, 0);
    this.box(torso, 0.3, 0.34, 0.18, 0, 0.13, 0, color, true);
    if (sheriff) {
      if (!this.geometries.badge) {
        const star = new THREE.Shape();
        for (let i = 0; i < 10; i++) {
          const angle = Math.PI / 2 + (i * Math.PI) / 5,
            radius = i % 2 ? 0.45 : 1;
          star[i ? 'lineTo' : 'moveTo'](Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        star.closePath();
        this.geometries.badge = new THREE.ShapeGeometry(star);
      }
      this.mesh(torso, 'badge', [0.075, 0.075, 1], [-0.065, 0.2, 0.102], '#ffd15b');
      this.box(torso, 0.31, 0.05, 0.19, 0, -0.01, 0, '#4c4338');
      this.box(torso, 0.055, 0.04, 0.02, 0, -0.01, 0.105, '#ffd15b');
    }
    this.rod(torso, [0, 0.29, 0], [0, 0.39, 0], 0.055, skin);
    const head = this.group(torso, 0, 0.46, 0);
    this.ball(head, 0, 0, 0, [0.12, 0.145, 0.115], skin);
    this.ball(head, 0, 0.045, -0.03, [0.123, 0.12, 0.097], '#73563d');
    this.ball(head, 0, -0.005, 0.111, [0.022, 0.028, 0.025], skin);
    for (const x of [-0.044, 0.044]) this.ball(head, x, 0.025, 0.105, 0.012, '#39392f');
    if (isCityEra(era)) {
      this.ball(head, 0, 0.11, -0.005, [0.135, 0.065, 0.12], hat);
      this.box(head, 0.17, 0.025, 0.11, 0, 0.11, 0.105, hat, true);
    } else {
      this.mesh(
        head,
        'cylinder',
        [eraEvolution(era).style === 'motor-age' ? 0.155 : 0.195, 0.025, 0.18],
        [0, 0.105, 0],
        hat,
      );
      this.mesh(head, 'cone', [0.12, 0.115, 0.11], [0, 0.164, 0], hat);
      this.mesh(head, 'cylinder', [0.122, 0.028, 0.112], [0, 0.129, 0], '#6a6050');
    }
    const arms = [],
      legs = [];
    for (const side of [-1, 1]) {
      const arm = this.group(torso, side * 0.18, 0.24, 0);
      this.rod(arm, [0, 0, 0], [side * 0.015, -0.2, 0], 0.05, color);
      const fore = this.group(arm, side * 0.015, -0.2, 0);
      this.rod(fore, [0, 0, 0], [0, -0.18, 0], 0.039, skin);
      this.ball(fore, 0, -0.19, 0, [0.045, 0.057, 0.04], skin);
      arms.push({ upper: arm, lower: fore });
      const thigh = this.group(body, side * 0.078, -0.065, 0);
      this.rod(thigh, [0, 0, 0], [0, -0.22, 0], 0.065, '#68674f');
      const shin = this.group(thigh, 0, -0.22, 0);
      this.rod(shin, [0, 0, 0], [0, -0.21, 0], 0.047, '#77745b');
      this.box(shin, 0.105, 0.08, 0.19, 0, -0.215, 0.035, '#5c4c39', true);
      legs.push({ upper: thigh, lower: shin });
    }
    if (dress) this.mesh(body, 'cone', [0.2, 0.29, 0.17], [0, -0.085, 0], color);
    const sampledRoute = [];
    route.forEach((p, i) => {
      const previous = route[i - 1];
      if (linear && previous?.[1] === 7.5 && p[1] === 7.5) {
        const count = Math.ceil(Math.abs(p[0] - previous[0]) * 4);
        for (let n = 1; n < count; n++)
          sampledRoute.push([previous[0] + ((p[0] - previous[0]) * n) / count, 7.5]);
      }
      sampledRoute.push(p);
    });
    const points = sampledRoute.map(([x, z]) =>
      point(x, linear && x >= 24 && x <= 38 && z === 7.5 ? bridgeDeckHeight(x) + 0.17 : 0.07, z),
    );
    const journey = loop ? points : [...points, ...points.slice(1, -1).reverse()];
    const curve = linear
      ? new THREE.CurvePath()
      : new THREE.CatmullRomCurve3(journey, true, 'catmullrom', 0.15);
    if (linear)
      for (let i = 0; i < journey.length; i++)
        curve.add(new THREE.LineCurve3(journey[i], journey[(i + 1) % journey.length]));
    const duration = curve.getLength() / (sheriff ? 0.8 : 0.55);
    const actor = { root, body, torso, head, arms, legs, curve, duration, seed, work, visitor };
    if (!manual) this.actors.push(actor);

    root.traverse((object) => {
      if (object.isMesh) object.castShadow = false;
    });
    if (!manual) this.contactShadow(root, 0.27, 0.18);
    return actor;
  }
  animatePerson(actor, time) {
    const { root, body, torso, head, arms, legs, curve, duration, seed, work } = actor;
    const cycle = (time + seed) % (duration + 4);
    let walking = !work && cycle < duration;
    const progress = work?.length ? 0.1 : Math.min(cycle / duration, 0.9999);
    root.position.copy(curve.getPointAt(progress));
    if (actor.visitor) {
      // Visit the saloon, stay inside briefly, then return along the same route.
      const phase = (time + seed) % 32;
      const routeProgress = phase < 12 ? phase / 24 : phase < 19 ? 0.5 : 0.5 + (phase - 19) / 26;
      root.position.copy(curve.getPointAt(Math.min(0.9999, routeProgress)));
      root.visible = phase < 12 || phase >= 19;
      walking = root.visible;
      const facing = curve.getTangentAt(Math.min(0.9999, routeProgress));
      root.rotation.y = Math.atan2(facing.x, facing.z);
    }
    const tangent = curve.getTangentAt(progress);
    if (!actor.visitor) root.rotation.y = Math.atan2(tangent.x, tangent.z);
    const step = (time + seed) * 6;
    body.position.y =
      0.54 + (walking ? Math.cos(step * 2) * 0.013 : Math.sin(time * 1.8 + seed) * 0.005);
    torso.rotation.z = walking ? Math.sin(step) * 0.025 : 0;
    head.rotation.y = walking
      ? Math.sin(time * 0.7 + seed) * 0.1
      : Math.sin(time * 0.8 + seed) * 0.25;
    for (let n = 0; n < 2; n++) {
      const swing = Math.sin(step + n * Math.PI);
      legs[n].upper.rotation.x = walking ? swing * 0.36 : 0;
      legs[n].lower.rotation.x = walking ? Math.max(0, -swing) * 0.6 : 0;
      arms[n].upper.rotation.x = walking ? -swing * 0.28 : -0.12;
      arms[n].lower.rotation.x = -0.16;
    }
    if (!walking) {
      if (work === 'farm') {
        torso.rotation.x = 0.22 + Math.sin(time * 1.9) * 0.12;
        arms[0].upper.rotation.x = -0.7 + Math.sin(time * 1.9) * 0.3;
      } else {
        torso.rotation.x = 0;
        arms[1].upper.rotation.z = -0.65;
        arms[1].lower.rotation.x = -1.2 + Math.sin(time * 3) * 0.2;
      }
    } else {
      torso.rotation.x = 0;
      arms[1].upper.rotation.z = 0;
    }
  }
  horse(x, z, rotation, scale = 1) {
    const root = this.group(this.world, x, 0.07, z);
    root.userData.animated = true;
    root.rotation.y = rotation;
    root.scale.setScalar(scale);
    this.ball(root, 0, 0.73, 0, [0.24, 0.31, 0.55], '#a97950');
    for (const dx of [-0.15, 0.15])
      for (const dz of [-0.33, 0.33]) {
        this.rod(root, [dx, 0.64, dz], [dx, 0.3, dz + 0.02], 0.055, '#986b46');
        this.rod(root, [dx, 0.3, dz + 0.02], [dx, 0.05, dz + 0.04], 0.04, '#b38c63');
        this.box(root, 0.1, 0.08, 0.13, dx, 0.05, dz + 0.06, '#574b36', true);
      }
    const head = this.group(root, 0, 0.84, 0.39);
    this.ball(head, 0, 0.22, 0.05, [0.13, 0.38, 0.18], '#a97950');
    this.ball(head, 0, 0.44, 0.18, [0.13, 0.14, 0.23], '#ad8158');
    for (const dx of [-0.075, 0.075]) {
      this.ball(head, dx, 0.64, 0.11, [0.035, 0.1, 0.06], '#a97950');
      this.ball(head, dx * 1.7, 0.49, 0.22, 0.018, '#393d30');
    }
    this.box(root, 0.35, 0.09, 0.28, 0, 1.04, -0.02, '#637e79', true);
    this.rod(root, [0, 0.86, -0.47], [0, 0.4, -0.66], 0.055, '#594b34');
    this.motions.push((time) => {
      head.rotation.x = 0.18 + Math.sin(time * 0.9 + rotation) * 0.14;
    });

    root.traverse((object) => {
      if (object.isMesh) object.castShadow = false;
    });
    this.contactShadow(root, 0.3, 0.63);
  }
  contactShadow(parent, width, depth) {
    const shadow = new THREE.Mesh(this.geometries.shadow, this.contactShadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(width, depth, 1);
    shadow.position.y = -0.04;
    parent.add(shadow);
  }
  setUpgradeable(ids) {
    if (this.upgradeGlow.setAvailable(ids)) this.render();
  }
  setAvailable(ids) {
    const key = ids.join(',');
    if (this.availableKey === key) return;
    this.availableKey = key;
    this.availablePlots = new Set(ids);
    this.render();
  }
  select(id) {
    if (this.selected === id && this.selection?.parent === this.world) return;
    this.selected = id;
    if (this.selection) {
      this.world.remove(this.selection);
      this.selection.geometry.dispose();
      this.selection.material.dispose();
    }
    const [x, z] = PLOTS[id] ?? [0, 0];
    this.selection = new THREE.Mesh(
      new THREE.RingGeometry(1.65, 1.71, 64),
      new THREE.MeshBasicMaterial({
        color: '#f2dda1',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.position.set(x, 0.095, z);
    this.world.add(this.selection);
    this.render();
  }
  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = this.raycaster.intersectObjects(this.targets, true)[0];
    let object = hit?.object;
    while (object && !object.userData.plot) object = object.parent;
    if (object) this.onSelect(object.userData.plot);
    else {
      const ground = this.raycaster.ray.intersectPlane(
        new THREE.Plane(point(0, 1, 0), -0.08),
        new THREE.Vector3(),
      );
      if (!ground) return;
      for (const [id, [x, z]] of Object.entries(PLOTS)) {
        if (
          id !== 'mine' &&
          plotUnlocked(this.town, id) &&
          Math.abs(ground.x - x) < 1.55 &&
          Math.abs(ground.z - z) < 1.4
        ) {
          this.onSelect(id);
          break;
        }
      }
    }
  }
  frameTown() {
    if (this.eventCamera) return;
    if (!this.anchors?.length) return;
    const bounds = new THREE.Box3();
    const corners = [];
    const intimate =
      this.camera.aspect < 0.8 &&
      this.town?.era === 'frontier' &&
      Object.values(this.town.buildings).filter(Boolean).length < 6;
    const goal = intimate ? nextGoal(this.town)?.id : null;
    const framing = intimate
      ? this.anchors.filter(
          ({ id }) =>
            id === 'mine' || id === goal || this.town.buildings[id] || this.town.projects[id],
        )
      : this.anchors;
    for (const { id } of framing) {
      const [x, z] = PLOTS[id];
      if (id === 'airport') {
        for (const dx of [-10, 10])
          for (const dz of [-20, 20]) {
            const corner = point(x + dx, 8, z + dz);
            bounds.expandByPoint(corner);
            corners.push(corner);
          }
      }
      bounds.expandByPoint(point(x - 3, 0, z - 3));
      bounds.expandByPoint(point(x + 3, 5, z + 3));
      for (const dx of [-3, 3])
        for (const y of [0, 5]) for (const dz of [-3, 3]) corners.push(point(x + dx, y, z + dz));
    }
    // Include a glimpse of the near river from the first visit, without framing future land.
    if (this.town && !this.raid && !intimate) {
      const river = point(riverCenterX(2) + 1, 0, 2);
      bounds.expandByPoint(river);
      corners.push(river);
    }
    const target = bounds.getCenter(new THREE.Vector3());
    const direction = point(0.28, 0.72, 0.64).normalize();
    const right = point(0, 1, 0).cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    const vertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 0.92;
    const horizontal = vertical * this.camera.aspect;
    let distance = this.controls.minDistance;
    for (const corner of corners) {
      const offset = corner.sub(target),
        depth = offset.dot(direction);
      distance = Math.max(
        distance,
        depth + Math.abs(offset.dot(right)) / horizontal,
        depth + Math.abs(offset.dot(up)) / vertical,
      );
    }
    this.controls.target.copy(target);
    this.camera.position
      .copy(target)
      .addScaledVector(direction, Math.min(distance, this.controls.maxDistance));
    this.framingTown = true;
    try {
      this.controls.update();
    } finally {
      this.framingTown = false;
    }
  }
  resize() {
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    if (!width || !height) {
      this.wasHidden = true;
      return;
    }
    if (width === this.width && height === this.height) {
      if (!this.wasHidden) return;
      this.wasHidden = false;
      this.render();
      return true;
    }
    this.wasHidden = false;
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.fov = width / height < 0.7 ? 62 : width / height < 1.1 ? 48 : 40;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.overview) this.frameTown();
    this.render();
    return true;
  }
  rebuildActors() {
    this.actorRenderer.rebuild(
      [...(this.world?.children ?? []), ...(this.raid?.root.children ?? [])].filter(
        (child) => child.userData.animated,
      ),
    );
  }
  render() {
    if (
      this.contextUnavailable ||
      !this.world ||
      !this.canvas.clientWidth ||
      !this.canvas.clientHeight
    )
      return;
    const cameraDistance = this.camera.position.distanceTo(this.controls.target);
    if (Math.abs(cameraDistance - (this.lastAudioDistance ?? 0)) > 0.05) {
      this.lastAudioDistance = cameraDistance;
      this.onCameraDistance?.(cameraDistance);
    }
    this.actorRenderer.update();
    if (!this.drawFrame(true)) return;
    const distant = cameraDistance > 66;
    const width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    const projected = this.anchors.map(({ id, position, width: labelWidth, collection }) => {
      const p = position.clone().project(this.camera);
      const reward = collection.clone().project(this.camera);
      return {
        id,
        x: (p.x + 1) * 50,
        y: (1 - p.y) * 50,
        collection: {
          x: (reward.x + 1) * 50,
          y: (1 - reward.y) * 50,
          visible:
            reward.z > -1 && reward.z < 1 && Math.abs(reward.x) < 0.95 && Math.abs(reward.y) < 0.9,
        },
        depth: p.z,
        inView: p.z > -1 && p.z < 1 && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.9,
        width: labelWidth,
        visible:
          (id === 'mine' ||
            this.town.buildings[id] > 0 ||
            !!this.town.projects[id] ||
            this.availablePlots?.has(id)) &&
          p.z > -1 &&
          p.z < 1 &&
          (Math.abs(p.x) * width) / 2 + labelWidth / 2 + 8 < width / 2 &&
          p.y < 0.84 &&
          p.y > (width < 600 ? -0.42 : -0.78) &&
          (!distant ||
            id === 'mine' ||
            id === this.selected ||
            id === this.guidedPlot ||
            !!this.town.projects[id] ||
            (!this.town.buildings[id] && this.availablePlots?.has(id))),
      };
    });
    const shown = [];
    const priority = (id) =>
      id === this.selected
        ? 0
        : constructionReady(this.town.projects[id])
          ? 1
          : id === 'mine'
            ? 2
            : id === this.guidedPlot
              ? 3
              : this.availablePlots?.has(id)
                ? 4
                : 5;
    for (const anchor of [...projected].sort(
      (a, b) => priority(a.id) - priority(b.id) || a.depth - b.depth,
    )) {
      if (!anchor.visible) continue;
      if (
        shown.some(
          (other) =>
            (Math.abs(anchor.x - other.x) * width) / 100 < (anchor.width + other.width) / 2 + 4 &&
            (Math.abs(anchor.y - other.y) * height) / 100 < 42,
        )
      )
        anchor.visible = false;
      else shown.push(anchor);
    }
    this.onLabels(projected);
  }

  tick(now) {
    if (this.contextUnavailable) return;
    if (this.lastFrame && now - this.lastFrame < 1000 / 60 - 1) return;
    if (
      this.lastFrame &&
      !this.cameraGesture &&
      (!this.cinematic || this.cinematic.finished) &&
      !this.construction
    ) {
      const ratio = this.renderQuality?.sample(now - this.lastFrame);
      if (ratio !== null && ratio !== undefined) {
        this.renderer.setPixelRatio(ratio);
        this.frameCache.valid = false;
      }
    }
    this.elapsed += this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.5) : 0;
    this.lastFrame = now;
    if (this.waterMaterial) this.waterMaterial.uniforms.time.value = this.elapsed;
    this.actors?.forEach((actor) => this.animatePerson(actor, this.elapsed));
    this.motions?.forEach((motion) => motion(this.elapsed));
    if (this.construction?.update(this.elapsed)) this.finishConstruction();
    if (this.raid?.update(this.elapsed)) {
      this.raid = null;
      this.rebuildActors();
      restoreEventCamera(this);
    }
    updateEventCamera(this);
    // Advance life during camera motion too; its scheduled render draws the new pose.
    if (this.cameraFrame || (this.cinematic && !this.cinematic.finished)) return;
    this.actorRenderer.update();
    this.drawFrame();
  }
  finishConstruction() {
    if (!this.construction) return;
    const { group } = this.construction;
    this.construction.finish();
    this.construction = null;
    this.batch(group);
    this.rebuildActors();
    // The rest of the village is already batched. Only settle the completed plot.
    this.buildingRenderer.sync(this.world.children.filter((child) => child.userData.static));
    this.renderer.shadowMap.needsUpdate = true;
    this.render();
  }
  playRaid(event, onPhase, onComplete, onCue) {
    this.raid?.dispose();
    beginEventCamera(this);
    const Incident = eventKind(event) === 'bandits' ? TownRaid : TownEraIncident;
    this.raid = new Incident(
      this,
      event,
      PLOTS,
      (phase) => {
        onPhase(phase);
      },
      onComplete,
      onCue,
    );
    this.rebuildActors();
    this.render();
  }
  updateRaid(event) {
    if (this.raid?.event.id !== event.id) return;
    this.raid.updateEvent(event);
    this.rebuildActors();
    this.render();
  }
  stopRaid() {
    if (!this.raid) return;
    this.raid.dispose();
    this.raid = null;
    this.rebuildActors();
    restoreEventCamera(this);
    this.render();
  }
  setCinematic(enabled) {
    if (!!this.cinematic === enabled) return;
    if (enabled) {
      this.cinematic = {
        startPosition: this.camera.position.clone(),
        startTarget: this.controls.target.clone(),
        era: this.town.era,
      };
      this.overview = false;
    } else {
      this.cinematic = null;
      this.overview = true;
      this.frameTown();
      this.render();
    }
    this.controls.enabled = !enabled;
  }
  eraFrame(progress) {
    const shot = this.cinematic;
    if (!shot) return;
    shot.finished = progress >= 1;
    const [x, z] = PLOTS.square;
    const square = point(x, 1, z);
    const distance = this.camera.aspect < 0.8 ? 38 : 26;
    const close = square
      .clone()
      .add(point(Math.sin(0.65) * distance, distance * 0.65, Math.cos(0.65) * distance));
    const smooth = (value) => value * value * (3 - 2 * value);
    if (this.town.era !== shot.era && !shot.endPosition) {
      this.frameTown();
      shot.endPosition = this.camera.position.clone();
      shot.endTarget = this.controls.target.clone();
    }
    if (progress < 6 / 14 || !shot.endPosition) {
      const amount = smooth(Math.min(1, (progress * 14) / 6));
      this.camera.position.lerpVectors(shot.startPosition, close, amount);
      this.controls.target.lerpVectors(shot.startTarget, square, amount);
    } else {
      const amount = smooth((progress * 14 - 6) / 8);
      this.camera.position.lerpVectors(close, shot.endPosition, amount);
      this.controls.target.lerpVectors(square, shot.endTarget, amount);
    }
    this.camera.lookAt(this.controls.target);
    this.render();
  }
  cameraAction(action) {
    if (!this.controls.enabled) return;
    this.overview = action === 'reset';
    if (action === 'in') this.controls.dollyIn(1 / 1.18);
    if (action === 'out') this.controls.dollyOut(1 / 1.18);
    if (action === 'left') this.controls.rotateLeft(Math.PI / 8);
    if (action === 'right') this.controls.rotateLeft(-Math.PI / 8);
    if (action === 'up') this.controls.rotateUp(Math.PI / 18);
    if (action === 'down') this.controls.rotateUp(-Math.PI / 18);
    if (action === 'reset') this.frameTown();
  }
  setPaused(paused) {
    this.paused = paused;
    this.controls.enabled = !paused && !this.cinematic && !this.eventCamera;
  }
  setMotion(enabled) {
    if (this.motionEnabled === enabled) return;
    this.motionEnabled = enabled;
    this.lastFrame = 0;
    this.renderQuality?.resetWindow();
    this.renderer.setAnimationLoop(enabled && !this.contextUnavailable ? this.tick : null);
  }
  dispose() {
    this.canvas.removeEventListener('webglcontextlost', this.contextLost);
    cancelAnimationFrame(this.cameraFrame);
    this.frameCache.dispose();
    this.upgradeGlow.dispose();
    this.actorRenderer.dispose();
    this.buildingRenderer.dispose();
    this.sceneryRenderer.dispose();
    this.raid?.dispose();
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.controls.removeEventListener('change', this.cameraChanged);
    this.controls.removeEventListener('start', this.beginCameraGesture);
    this.controls.removeEventListener('end', this.endCameraGesture);
    this.controls.dispose();
    if (this.selection) {
      this.selection.geometry.dispose();
      this.selection.material.dispose();
    }
    this.staticScenery?.dispose(this);
    this.clearGroup(this.world);
    this.clearGroup(this.landscape);
    this.plotCache?.clear();
    Object.values(this.geometries).forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.contactShadowMaterial.dispose();
    this.sun.shadow.map?.dispose();
    this.renderer.dispose();
    if (!this.renderer.getContext().isContextLost()) this.renderer.forceContextLoss();
  }
}
