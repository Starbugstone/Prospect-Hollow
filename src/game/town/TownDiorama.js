import { setTownAtmosphere, horizonMaterial } from './TownAtmosphere';

import { navigationScene, releaseNavigation } from './NavigationDebug';

import {
  clearFrameContext,
  frameEnd,
  frameStart,
  setFrameContext,
  watchLongTasks,
} from './TownProfiler';

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

import {
  updateEventCamera,
  beginEventCamera,
  restoreEventCamera,
  renderEventInset,
} from './TownEventCamera';
import { TownPrimitives } from './TownPrimitives';
import { TownFramePacer } from './TownFramePacer';
import { disposeInsetCache } from './TownInset';
import * as plots from './TownPlots';
import { populateLife } from './TownPopulation';
import {
  CAMERA_FOCUS_HEIGHT,
  CAMERA_MIN_DISTANCE,
  cameraAction,
  findVisitor,
  frameTown,
} from './TownCamera';
import {
  projectLabelPositions,
  projectVillager,
  selectVillager,
  showVillager,
} from './TownLabelProjection';
import { addHorse, addPerson, animatePerson, setVillagerIdentity } from './TownPeople';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { TownFrameCache } from './TownFrameCache';
import { TownStatics } from './TownStatics';
import { TownActors } from './TownActors';

import { renderBuilding } from './buildings/BuildingRenderer';

import { TownRaid } from './TownActivity';
import { TownEraIncident } from './TownEraIncident';
import { eventKind } from '../../data/townEvents';
import { plotUnlocked } from './TownRules';
import { buildLandscape, keepCameraAboveTerrain } from './TownLandscape';

import { PLOTS } from './TownLayout';

export { PLOTS } from './TownLayout';
const point = (x, y, z) => new THREE.Vector3(x, y, z);

// Original geometry shares static scenery batches and animated actor instances.
export class TownDiorama extends TownPrimitives {
  // `options` holds the owner's callbacks (onSelect, onLabels, onCameraDistance,
  // onUnavailable, onVillagerLabel, onEventInset, onVipSpend, onGuestVip, onFirstFrame)
  // and `vipsHidden` for a read-only shared town.
  constructor(canvas, options = {}) {
    super();
    this.deferLife = true;
    this.generation = 0;
    navigationScene(this);
    this.canvas = canvas;
    Object.assign(this, options);
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
    this.controls.target.set(0, CAMERA_FOCUS_HEIGHT, 0);
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    this.controls.enableDamping = false;
    this.controls.minDistance = CAMERA_MIN_DISTANCE;
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
      // Villagers outside the view are left out of the instances. The event inset
      // shows another part of the town, so it keeps everyone.
      const cull = this.camera && !this.eventInsetVisible;
      if (cull) this.camera.updateMatrixWorld();
      this.actorRenderer?.update(this.scene, cull ? [this.camera] : null);
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
  discardPlotWork(...args) {
    return plots.discardPlotWork(this, ...args);
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
  // Labels, the named-villager tag and camera framing live in TownLabelProjection and
  // TownCamera; the life population in TownPopulation.
  *populateLife(town) {
    yield* populateLife(this, town);
  }
  showVillager(clientX, clientY, pin) {
    return showVillager(this, clientX, clientY, pin);
  }
  // Pointer hover can fire many times per frame: evaluate only the latest position.
  hoverVillager(clientX, clientY) {
    this.hoverPoint = [clientX, clientY];
    this.hoverFrame ||= requestAnimationFrame(() => {
      this.hoverFrame = 0;
      if (!this.disposed) showVillager(this, ...this.hoverPoint);
    });
  }
  selectVillager(actor, toggle) {
    selectVillager(this, actor, toggle);
  }
  projectVillager() {
    projectVillager(this);
  }
  projectLabelPositions() {
    projectLabelPositions(this);
  }
  frameTown() {
    frameTown(this);
  }
  cameraAction(action) {
    cameraAction(this, action);
  }
  findVisitor(id) {
    return findVisitor(this, id);
  }
  building(parent, id, stage, label, framing = false) {
    renderBuilding({ town: this, parent, kind: id, level: stage, label, construction: framing });
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

  tick(now) {
    const started = frameStart();
    try {
      if (this.contextUnavailable) return;
      const pacer = (this.pacer ??= new TownFramePacer());
      if (!pacer.due(now)) return;
      const frameTime = pacer.frameTime;
      if (
        frameTime !== null &&
        !this.cameraGesture &&
        !this.presentation &&
        (!this.cinematic || this.cinematic.finished) &&
        !this.construction
      ) {
        const ratio = this.renderQuality?.sample(frameTime);
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
      this.tryActivatePlot();
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
        else this.projectVillager();
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
      this.pacer?.reset();
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
    this.pacer?.reset();
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
    cancelAnimationFrame(this.hoverFrame);
    this.frameCache.dispose();
    disposeInsetCache(this);
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
    this.discardPlotWork();
    this.clearGroup(this.world);
    this.clearGroup(this.landscape);
    this.plotCache?.clear();
    this.disposePrimitives();
    this.sun.shadow.map?.dispose();
    this.renderer.dispose();
    if (!this.renderer.getContext().isContextLost()) this.renderer.forceContextLoss();
  }
}
