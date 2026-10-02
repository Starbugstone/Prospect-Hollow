import { TownItineraries } from './TownItineraries';
import { setTownAtmosphere, horizonMaterial } from './TownAtmosphere';

import { navigationScene, releaseNavigation } from './NavigationDebug';

import {
  clearFrameContext,
  frameEnd,
  frameStart,
  setFrameContext,
  watchLongTasks,
} from './TownProfiler';
import { addWorkBreak } from './TownWorkRoutine';

import { TownVipArrivals } from './TownVipArrivals';
import { TownLiveVisitors } from './TownLiveVisitors';
import { vipVisitor } from '../../data/villagers';
import { updateTownLocomotion } from './TownLocomotion';
import { MINE_SHAFT, addMineShaft } from './TownMineShaft';
import { TownPresentation } from './TownPresentation';
import { ERA_CONSTRUCTION } from '../../data/mineEvolution';

import { TownRenderQuality } from './TownRenderQuality';
import { updateTownShadowCoverage } from './TownShadows';
import { TownUpgradeGlow } from './TownUpgradeGlow';
import * as THREE from 'three';
import { addAviationActivity } from './TownAviation';
import {
  updateEventCamera,
  beginEventCamera,
  restoreEventCamera,
  renderEventInset,
} from './TownEventCamera';
import { TownPrimitives } from './TownPrimitives';
import * as plots from './TownPlots';
import { addCactus, addHomeWing, addWell, addWindow } from './buildings/frontierParts';
import { addHorse, addPerson, animatePerson, setVillagerIdentity } from './TownPeople';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { TownFrameCache } from './TownFrameCache';
import { TownStatics } from './TownStatics';
import { TownActors } from './TownActors';
import { addTownLife } from './TownLife';
import { addLeisureActivity } from './TownLeisure';

import { renderBuilding } from './buildings/BuildingRenderer';
import { addEraActivity, trackTransport } from './TownEraActivity';

import { addTownVisitors, TownRaid } from './TownActivity';
import { TownEraIncident } from './TownEraIncident';
import { eventKind } from '../../data/townEvents';
import { constructionReady, plotUnlocked, population, nextGoal } from './TownRules';
import { buildLandscape, keepCameraAboveTerrain } from './TownLandscape';
import { addMotorActivity } from './TownMotorActivity';
import { motorTraffic } from './TownEvolution';

import { overlapsEventInset } from './TownInset';

import { GARDEN_PARCELS } from '../../data/townGardenDistrict';
import { PLOTS, LANE_X, atPlot, SHERIFF_PATROL } from './TownLayout';
import { riverCenterX } from './TownRiver';
export { PLOTS } from './TownLayout';
const point = (x, y, z) => new THREE.Vector3(x, y, z);

// Original geometry shares static scenery batches and animated actor instances.
export class TownDiorama extends TownPrimitives {
  constructor(canvas, onSelect, onLabels, onCameraDistance, onUnavailable) {
    super();
    this.deferLife = true;
    this.generation = 0;
    navigationScene(this);
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.onLabels = onLabels;
    this.onCameraDistance = onCameraDistance;
    this.onUnavailable = onUnavailable;
    this.scene = new THREE.Scene();
    // drawFrame() updates world matrices once for all of a frame's render calls.
    this.scene.matrixWorldAutoUpdate = false;
    setTownAtmosphere(this.scene);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    this.camera.position.set(12, 12, 25);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderQuality = new TownRenderQuality(window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.renderQuality.ratio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene.add(new THREE.HemisphereLight('#e1eff7', '#ba9460', 2.1));
    const sun = new THREE.DirectionalLight('#ffe3ad', 3.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.renderQuality.shadowSize, this.renderQuality.shadowSize);
    sun.shadow.normalBias = 0.025;
    sun.shadow.bias = -0.0001;
    this.scene.add(sun);
    this.sun = sun;
    updateTownShadowCoverage(this, []);
    this.scene.add(new THREE.DirectionalLight('#cde5e7', 0.65));
    this.scene.children.forEach((object) => {
      if (object.isLight) object.layers.enable(2);
    });
    this.frameCache = new TownFrameCache(this.renderer, this.renderQuality.cacheSamples);
    watchLongTasks();
    setFrameContext(this, () => {
      let objects = 0,
        frozen = 0;
      this.scene.traverse((object) => {
        objects++;
        if (!object.matrixAutoUpdate) frozen++;
      });
      return {
        dpr: this.renderer.getPixelRatio(),
        tier: this.renderQuality.tier,
        cacheSamples: this.frameCache.target.samples,
        shadowMap: this.sun.shadow.mapSize.x,
        drawingBuffer: [this.canvas.width, this.canvas.height],
        sceneObjects: objects,
        frozenObjects: frozen,
        staticBatches: this.buildingRenderer.meshes.length + this.sceneryRenderer.meshes.length,
      };
    });
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
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
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
    this.prepareConstructionCue();
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
  // three would otherwise update every world matrix again inside each render call
  // (static cache, foreground, inset). Update once per drawn frame instead.
  drawFrame(refresh = false) {
    try {
      this.scene?.updateMatrixWorld();
      this.actorRenderer?.update(this.scene);
      this.frameCache.render(this.scene, this.camera, refresh);
      renderEventInset(this);
      return true;
    } catch (error) {
      this.contextUnavailable = true;
      this.renderer.setAnimationLoop(null);
      this.onUnavailable?.(error);
      return false;
    }
  }
  // Named parts show which layout change forced a full rebuild in town timings.
  // Nearest point clear of the new footprint. A swept exit is reachable in a
  // straight walk; otherwise any point open in the navigation grid will do.
  // The plot lifecycle (building, swapping, construction reveals and full rebuilds)
  // lives in TownPlots; these methods keep the diorama's API for callers and tests.
  buildPlot(...args) {
    return plots.buildPlot(this, ...args);
  }
  plotSignatures(...args) {
    return plots.plotSignatures(this, ...args);
  }
  topologySignature(...args) {
    return plots.topologySignature(this, ...args);
  }
  prepareConstructionCue(...args) {
    return plots.prepareConstructionCue(this, ...args);
  }
  beginConstructionCue(...args) {
    return plots.beginConstructionCue(this, ...args);
  }
  changeTown(...args) {
    return plots.changeTown(this, ...args);
  }
  plotFootprints(...args) {
    return plots.plotFootprints(this, ...args);
  }
  discardPendingUpdate(...args) {
    return plots.discardPendingUpdate(this, ...args);
  }
  plotVacant(...args) {
    return plots.plotVacant(this, ...args);
  }
  tryActivatePlot(...args) {
    return plots.tryActivatePlot(this, ...args);
  }
  plotsPending(...args) {
    return plots.plotsPending(this, ...args);
  }
  refreshServiceDrops(...args) {
    return plots.refreshServiceDrops(this, ...args);
  }
  update(...args) {
    return plots.rebuildTown(this, ...args);
  }
  repairAnimalLife(...args) {
    return plots.repairAnimalLife(this, ...args);
  }
  finishConstruction(...args) {
    return plots.finishConstruction(this, ...args);
  }
  *populateLife(town) {
    this.itineraries = new TownItineraries(this);
    this.transports = new Map();
    const household = population(town);
    addEraActivity(this, town);
    yield;
    addMotorActivity(this, town);
    yield;
    addTownVisitors(this, town);
    yield;
    addTownLife(this, town);
    yield;
    addLeisureActivity(this, town);
    yield;
    trackTransport(this, 'airport', town, addAviationActivity(this, town));
    yield;
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
    if (town.buildings.farm) {
      const farmer = this.person({
        color: '#809267',
        skin: '#af7b56',
        hat: '#d7b671',
        route: [atPlot('farm', 1.35, 2.1), atPlot('farm', 1.15, 1.6)],
        seed: 2,
        work: 'farm',
      });
      farmer.root.name = 'Farmer tending crops';
      addWorkBreak(this, farmer, 'farm', { work: 18, rest: 4 });
    }
    if (town.buildings.saloon) {
      const host = this.person({
        color: '#a47d91',
        skin: '#edc7a4',
        hat: '#b89869',
        route: [atPlot('saloon', 0.65, 1.7), atPlot('saloon', 0.95, 1.5)],
        seed: 6,
        work: 'greet',
        dress: true,
      });
      host.root.name = 'Saloon host';
      addWorkBreak(this, host, 'saloon', { work: 14, rest: 4 });
    }
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
    this.vipArrivals ??= new TownVipArrivals(this);
    this.vipArrivals.attach(town);
    for (const actor of [...this.actors, ...this.vipArrivals.actors])
      yield* this.itineraries.prepare(actor);

    this.actors.forEach((actor) => {
      if (!actor.motion) this.animatePerson(actor, this.elapsed);
    });
    this.motions.forEach((motion) => motion(this.elapsed));
    this.vipArrivals.update();
    for (const actor of this.retainedActors?.values() ?? []) this.clearGroup(actor.root);
    this.retainedActors?.clear();
    this.lifeReady = true;
    this.liveVisitors?.attach();
    this.rebuildActors();
    this.renderer.shadowMap.needsUpdate = true;
    this.render();
  }
  building(parent, id, stage, label, framing = false) {
    renderBuilding({ town: this, parent, kind: id, level: stage, label, construction: framing });
  }
  // Frontier parts live in buildings/frontierParts; these keep the diorama's API.
  cactus(parent, x, z) {
    addCactus(this, parent, x, z);
  }
  window(parent, x, y, z) {
    addWindow(this, parent, x, y, z);
  }
  well(parent, phase) {
    addWell(this, parent, phase);
  }
  homeWing(parent, wins) {
    addHomeWing(this, parent, wins);
  }
  mine(parent, label) {
    addMineShaft(this, parent);
    const entry = this.group(
      parent,
      0,
      MINE_SHAFT.portalFloor - parent.position.y,
      MINE_SHAFT.portalZ - PLOTS.mine[1],
    );
    entry.name = 'Sunken mine entrance';
    this.sign(entry, label, 1.8, 0, 2.38, 0.4);
  }
  drawVip(seed, visit = 0) {
    return this.vipsHidden ? null : vipVisitor(seed, visit);
  }
  // Villagers are built and animated in TownPeople; these keep the diorama's API.
  person(options) {
    return addPerson(this, options);
  }
  setVillagerIdentity(actor, identity, outfitSeed) {
    setVillagerIdentity(this, actor, identity, outfitSeed);
  }
  animatePerson(actor, time) {
    animatePerson(this, actor, time);
  }
  horse(x, z, rotation, scale) {
    addHorse(this, x, z, rotation, scale);
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
    horizonMaterial(this.selection.material);
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.position.set(x, 0.095, z);
    this.world.add(this.selection);
    this.render();
  }
  showVillager(clientX, clientY, pin = false) {
    // Only clicking the selected visitor again dismisses a pinned name.
    // Hovering, empty-ground clicks and leaving the canvas preserve it.
    if (!pin && this.villagerLabelPinned && this.namedVillager) return true;
    const rect = this.canvas.getBoundingClientRect();
    let nearest = null,
      distance = 24;
    for (const actor of [
      ...(this.actors ?? []),
      ...(this.vipArrivals?.actors ?? []),
      ...(this.liveVisitors?.actors ?? []),
    ]) {
      if (!actor.root.userData.villager?.name || !actor.root.visible || actor.root.scale.x < 0.5)
        continue;
      const p = actor.root.position
        .clone()
        .add(point(0, 1, 0))
        .project(this.camera);
      if (p.z < -1 || p.z > 1) continue;
      const delta = Math.hypot(
        rect.left + ((p.x + 1) * rect.width) / 2 - clientX,
        rect.top + ((1 - p.y) * rect.height) / 2 - clientY,
      );
      if (delta < distance) {
        nearest = actor;
        distance = delta;
      }
    }
    if (pin && nearest) {
      this.selectVillager(nearest);
    } else if (!this.villagerLabelPinned || !this.namedVillager) {
      // A second click stays dismissed until the pointer leaves this visitor.
      if (nearest !== this.dismissedVillager) this.dismissedVillager = null;
      this.namedVillager = nearest === this.dismissedVillager ? null : nearest;
      this.villagerLabelPinned = false;
    }
    this.projectVillager();
    return !!nearest;
  }
  selectVillager(actor, toggle = true) {
    const dismiss = toggle && this.villagerLabelPinned && this.namedVillager === actor;
    this.namedVillager = dismiss ? null : actor;
    this.villagerLabelPinned = !dismiss;
    this.dismissedVillager = dismiss ? actor : null;
    this.projectVillager();
  }
  selectInsetVisitor() {
    const actor = this.vipArrivals?.active?.actor;
    if (
      !this.eventInsetVisible ||
      !actor ||
      this.raid ||
      this.cinematic ||
      this.presentation ||
      this.eventCamera
    )
      return;
    this.selectVillager(actor);
    this.render();
  }
  findVisitor(id) {
    if (this.raid || this.cinematic || this.presentation || this.eventCamera) return false;
    const actor = this.liveVisitors?.actors.find(
      (entry) => entry.liveId === String(id) && entry.leavingAt === undefined,
    );
    if (!actor?.root.visible || !this.world.children.includes(actor.root)) return false;
    const target = actor.root.position.clone().add(point(0, 1, 0));
    const offset = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize()
      .multiplyScalar(16);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offset);
    keepCameraAboveTerrain(this.camera.position, target);
    this.overview = false;
    this.controls.update();
    this.selectVillager(actor, false);
    this.render();
    return true;
  }
  projectVillager() {
    const actor = this.namedVillager;
    if (
      !actor?.root.visible ||
      !actor.root.userData.villager?.name ||
      !this.world?.children.includes(actor.root)
    ) {
      this.namedVillager = null;
      this.villagerLabelPinned = false;
      this.onVillagerLabel?.(null);
      return;
    }
    if (actor.root.scale.x < 0.5 || this.raid || this.cinematic) {
      this.onVillagerLabel?.(null);
      return;
    }
    const p = actor.root.position
      .clone()
      .add(point(0, 1.5, 0))
      .project(this.camera);
    this.onVillagerLabel?.(
      Math.abs(p.x) <= 1 &&
        Math.abs(p.y) <= 1 &&
        p.z >= -1 &&
        p.z <= 1 &&
        !overlapsEventInset(
          this,
          ((p.x + 1) * this.canvas.clientWidth) / 2,
          ((1 - p.y) * this.canvas.clientHeight) / 2,
          180,
        )
        ? {
            name: actor.root.userData.villager.name,
            live: !!actor.root.userData.villager.live,
            x: (p.x + 1) * 50,
            y: (1 - p.y) * 50,
          }
        : null,
    );
  }
  pick(clientX, clientY) {
    if (this.showVillager(clientX, clientY, true)) return;
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
      const parcel = GARDEN_PARCELS[id],
        halfWidth = parcel ? parcel.halfWidth + 0.8 : 3,
        halfDepth = parcel ? parcel.halfDepth + 0.8 : 3,
        height = parcel ? 8 : 5;
      bounds.expandByPoint(point(x - halfWidth, 0, z - halfDepth));
      bounds.expandByPoint(point(x + halfWidth, height, z + halfDepth));
      for (const dx of [-halfWidth, halfWidth])
        for (const y of [0, height])
          for (const dz of [-halfDepth, halfDepth]) corners.push(point(x + dx, y, z + dz));
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
    this.manualBlockers = [];
    const traffic = new Set(this.trafficActors ?? []);
    this.scene.traverse((root) => {
      const actor = root.userData.locomotionActor;
      if (!actor?.manual || actor.transportVisitor || actor.liveVisitor) return;
      // A mounted rider shares the carrier's traffic footprint. Registering a
      // second pedestrian footprint makes the horse yield to its own rider.
      for (let parent = root.parent; parent; parent = parent.parent)
        if (traffic.has(parent)) return;
      this.manualBlockers.push(actor);
    });
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
    const started = frameStart();
    if (this.drawFrame(true)) this.projectLabels();
    frameEnd('render', started);
  }
  projectLabels() {
    const started = frameStart();
    this.projectLabelPositions();
    frameEnd('labels', started);
  }
  projectLabelPositions() {
    const cameraDistance = this.camera.position.distanceTo(this.controls.target);
    if (Math.abs(cameraDistance - (this.lastAudioDistance ?? 0)) > 0.05) {
      this.lastAudioDistance = cameraDistance;
      this.onCameraDistance?.(cameraDistance);
    }
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
            reward.z > -1 &&
            reward.z < 1 &&
            Math.abs(reward.x) < 0.95 &&
            Math.abs(reward.y) < 0.9 &&
            !overlapsEventInset(
              this,
              ((reward.x + 1) * width) / 2,
              ((1 - reward.y) * height) / 2,
              48,
            ),
        },
        depth: p.z,
        inView: p.z > -1 && p.z < 1 && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.9,
        width: labelWidth,
        visible:
          !overlapsEventInset(
            this,
            ((p.x + 1) * width) / 2,
            ((1 - p.y) * height) / 2,
            labelWidth,
          ) &&
          this.plotCache?.get(id)?.group.visible !== false &&
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
      id === 'mine'
        ? 0
        : id === this.selected
          ? 1
          : constructionReady(this.town.projects[id])
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
            (Math.abs(anchor.y - other.y) * height) / 100 <
              (anchor.id === 'mine' || other.id === 'mine' ? 72 : 42),
        )
      )
        anchor.visible = false;
      else shown.push(anchor);
    }
    this.onLabels(projected);
    this.projectVillager?.();
  }

  tick(now) {
    const started = frameStart();
    try {
      if (this.contextUnavailable) return;
      if (this.lastFrame && now - this.lastFrame < 1000 / 60 - 1) return;
      if (
        this.lastFrame &&
        !this.cameraGesture &&
        !this.presentation &&
        (!this.cinematic || this.cinematic.finished) &&
        !this.construction
      ) {
        const ratio = this.renderQuality?.sample(now - this.lastFrame);
        if (ratio !== null && ratio !== undefined) {
          this.renderer.setPixelRatio(ratio);
          const size = this.renderQuality.shadowSize;
          if (this.sun.shadow.mapSize.x !== size) {
            this.sun.shadow.map?.dispose();
            this.sun.shadow.map = null;
            this.sun.shadow.mapSize.set(size, size);
            this.renderer.shadowMap.needsUpdate = true;
          }
          this.frameCache.setSamples?.(this.renderQuality.cacheSamples);
          this.frameCache.valid = false;
        }
      }
      const activeDelta = this.lastFrame ? Math.max(0, (now - this.lastFrame) / 1000) : 0;
      this.activeElapsed = (this.activeElapsed ?? 0) + activeDelta;
      this.lastFrame = now;
      // Prepared routes need one sample per displayed frame, not repeated physics
      // catch-up steps. Preserve real-time speed down to 4 FPS; bound long stalls.
      const movementDelta = Math.min(activeDelta, 0.25);
      if (movementDelta > 0) {
        this.elapsed += movementDelta;
        this.actors?.forEach((actor) => this.animatePerson(actor, this.elapsed));
        this.motions?.forEach((motion) => motion(this.elapsed));
        this.vipArrivals?.update();
        this.liveVisitors?.update();
        updateTownLocomotion(this, movementDelta);
      }
      if (this.waterMaterial) this.waterMaterial.uniforms.time.value = this.elapsed;
      this.tryActivatePlot?.();
      if (this.construction?.update(this.activeElapsed)) this.finishConstruction();
      if (this.raid?.update(this.elapsed)) {
        this.raid = null;
        this.rebuildActors();
        restoreEventCamera(this);
      }
      const eventCameraMoved = updateEventCamera(this);
      // Advance life during camera motion too; its scheduled render draws the new pose.
      if (this.cameraFrame || this.presentation || (this.cinematic && !this.cinematic.finished))
        return;
      if (this.drawFrame()) {
        if (eventCameraMoved) this.projectLabels();
        else this.projectVillager?.();
      }
    } finally {
      frameEnd('tick', started);
    }
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
  setPresentation(definition) {
    if (this.presentation?.definition.id === definition?.id) return;
    this.presentation?.dispose();
    this.presentation = null;
    if (definition && TownPresentation.supports(definition.id))
      this.presentation = new TownPresentation(this, definition);
    this.render();
  }
  presentationFrame(time, still = false) {
    this.presentation?.frame(time, still);
  }
  setCinematic(enabled, transition = this.town.transition) {
    if (!!this.cinematic === enabled) return;
    if (enabled) {
      if (!transition) return;
      this.cinematic = {
        plotIds: new Set(this.plotCache?.keys()),
        presentation: new TownPresentation(this, {
          id: 'era-mine',
          from: transition.from,
          to: transition.to,
        }),
        finished: false,
      };
      this.overview = false;
    } else {
      const presentation = this.cinematic?.presentation;
      this.cinematic = null;
      for (const { group } of this.plotCache?.values() ?? []) {
        if (group.userData.revealAfterCinematic) {
          group.visible = true;
          delete group.userData.revealAfterCinematic;
        }
      }
      this.buildingRenderer?.refreshVisibility();
      if (this.frameCache) this.frameCache.valid = false;
      presentation?.dispose();
      this.render();
    }
    this.controls.enabled = !enabled && !this.paused && !this.eventCamera;
  }
  eraFrame(progress, still = false) {
    if (!this.cinematic) return;
    this.cinematic.finished = progress >= 1;
    this.cinematic.presentation.frame(progress * ERA_CONSTRUCTION.duration, still);
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
  setLiveVisitors(visitors, reducedMotion = false, townKey = null) {
    this.livePresenceEnabled = true;
    this.liveVisitorsReducedMotion = reducedMotion;
    // Existing saves may still contain the obsolete queued guest. Presence owns
    // only that guest slot; ordinary transport and random VIPs remain intact.
    if (this.vipArrivals?.guest) {
      const actor = this.vipArrivals.guest.actor;
      this.vipArrivals.actors = this.vipArrivals.actors.filter((item) => item !== actor);
      this.clearGroup(actor.root);
      this.vipArrivals.guest = null;
    }
    this.liveVisitors ??= new TownLiveVisitors(this);
    this.liveVisitors.sync(visitors, townKey);
  }
  setPaused(paused) {
    if (this.paused !== paused) {
      this.lastFrame = 0;
      if (paused) this.construction?.pause();
      else this.construction?.resume();
    }
    this.paused = paused;
    this.controls.enabled = !paused && !this.cinematic && !this.eventCamera;
  }
  // The village always lives while it is shown; only a hidden or paused view stops.
  setMotion(enabled) {
    if (this.motionEnabled === enabled) return;
    this.motionEnabled = enabled;
    if (enabled) this.construction?.resume();
    else this.construction?.pause();
    this.lastFrame = 0;
    this.renderQuality?.resetWindow();
    this.renderer.setAnimationLoop(enabled && !this.contextUnavailable ? this.tick : null);
  }
  dispose() {
    clearFrameContext(this);
    this.generation++;
    this.cancelAnimalWork?.();
    this.cancelLifeWork?.();
    this.cancelFinishWork?.();
    this.cancelRouteWork?.();
    this.disposed = true;
    releaseNavigation(this);
    this.cinematic?.presentation.dispose(false);
    this.presentation?.dispose(false);
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
    this.liveVisitors?.dispose();
    this.discardPendingUpdate();
    this.clearGroup(this.world);
    this.clearGroup(this.landscape);
    this.plotCache?.clear();
    this.disposePrimitives();
    this.sun.shadow.map?.dispose();
    this.renderer.dispose();
    if (!this.renderer.getContext().isContextLost()) this.renderer.forceContextLoss();
  }
}
