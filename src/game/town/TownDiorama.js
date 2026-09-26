import { TownItineraries, updateItinerary } from './TownItineraries';
import { setTownAtmosphere, horizonMaterial } from './TownAtmosphere';
import { applyRoadSetbacks } from './BuildingSetbacks';
import { addTownAnimals } from './TownAnimals';
import { footprintsFor, plotFootprintKey } from './FootprintCatalog';
import { navigationScene, drawNavigation, releaseNavigation } from './NavigationDebug';
import { hasElectricity } from '../../data/industrial';
import { mineGrowth } from '../../data/mineGrowth';
import { updateMineGrowth } from './mine/addMineSite';
import { afterPaint, performanceMark, scheduleWork } from '../PresentationWork';
import { geometryFootprints, registerFootprints, footprintDistance } from './BuildingFootprints';
import { townTracks, railEdges } from './TownLayout';
import { demote } from '../phaser/boardRetention';
import { townNavigation, prepareActorWalk, walkPose, placeSafely } from './TownNavigation';
import { addWorkBreak, updateWorkRoutine } from './TownWorkRoutine';
import { buildingWalk } from './TownPedestrians';
import { TownVipArrivals } from './TownVipArrivals';
import { hasVisitorTransport } from '../../data/visitorArrivals';
import { villagerIdentity, vipVisitor } from '../../data/villagers';
import { SIDEWALK_OFFSET } from './TownTraffic';
import { updateTownLocomotion } from './TownLocomotion';
import { townWardrobe, vipOutfit } from '../../data/townWardrobes';
import { MINE_SHAFT, addMineShaft, mineTrackHeight, mineTrackPitch } from './TownMineShaft';
import { TownPresentation } from './TownPresentation';
import { ERA_CONSTRUCTION } from '../../data/mineEvolution';
import { eraEvolution } from '../../data/eras';
import { TownRenderQuality } from './TownRenderQuality';
import { bridgeDeckHeight } from './TownRiver';
import { TownUpgradeGlow } from './TownUpgradeGlow';
import * as THREE from 'three';
import { addAviationActivity } from './TownAviation';
import {
  updateEventCamera,
  beginEventCamera,
  restoreEventCamera,
  renderEventInset,
} from './TownEventCamera';
import { createTownGeometries } from './TownGeometries';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BUILDING_BY_ID } from '../../data/town';
import { TownFrameCache } from './TownFrameCache';
import { TownStatics } from './TownStatics';
import { TownActors } from './TownActors';
import { addTownLife } from './TownLife';
import { addLeisureActivity } from './TownLeisure';
import { TownConstruction, constructionParts } from './TownConstruction';
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
  roadLevel,
} from './TownRules';
import { buildLandscape, keepCameraAboveTerrain } from './TownLandscape';
import { addMotorActivity } from './TownMotorActivity';
import { motorTraffic } from './TownEvolution';
import { TownScenery } from './TownScenery';
import { addMineEra } from './TownMineEvolution';
import { overlapsEventInset } from './TownInset';

import { PLOTS, LANE_X, atPlot, plotStreet, SHERIFF_PATROL, visiblePlots } from './TownLayout';
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
    this.deferLife = true;
    this.generation = 0;
    navigationScene(this);
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.onLabels = onLabels;
    this.onCameraDistance = onCameraDistance;
    this.onUnavailable = onUnavailable;
    this.materials = new Map();
    this.geometries = createTownGeometries();
    this.scene = new THREE.Scene();
    setTownAtmosphere(this.scene);
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
    horizonMaterial(this.contactShadowMaterial);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene.add(new THREE.HemisphereLight('#e1eff7', '#ba9460', 2.1));
    const sun = new THREE.DirectionalLight('#ffe3ad', 3.5);
    sun.position.set(-24, 38, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.renderQuality.shadowSize, this.renderQuality.shadowSize);
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
    this.frameCache = new TownFrameCache(this.renderer, this.renderQuality.cacheSamples);
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
    demote('town-context-lost', { teardownInProgress: this.disposed });
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
      renderEventInset(this);
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
      this.materials.set(
        color,
        horizonMaterial(new THREE.MeshStandardMaterial({ color, roughness: 0.88 })),
      );
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
    if (typeof document === 'undefined') return;
    this.signMaterials ??= new Map();
    let material = this.signMaterials.get(text);
    if (!material) {
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
      material = horizonMaterial(new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }));
      this.signMaterials.set(text, material);
    }
    const sign = this.box(parent, width, 0.35, 0.012, x, y, z + 0.058, '#ffffff');
    sign.geometry = this.geometries.sign ??= new THREE.PlaneGeometry(1, 1);
    sign.scale.set(width, 0.35, 1);
    sign.material = material;
  }
  batch(group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(),
      buckets = new Map(),
      meshes = [];
    group.traverse((object) => {
      if (!object.isMesh || object.isInstancedMesh) return;
      for (let node = object; node && node !== group; node = node.parent)
        if (node.userData.animated) return;
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
  buildPlot(id, group, town, labels) {
    let movingPart;
    if (id === 'mine') this.mine(group, labels.mine);
    else {
      const stage = town.buildings[id],
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
          if (kind === 'square')
            buildTownSquare(this, group, stage, town.buildingEras[id] === 'frontier');
          else if (kind === 'well') this.well(group);
          else this.building(group, kind, stage, labels[id]);
        }
        if (!industrial && !['fisherman', 'blacksmith', 'school', 'doctor'].includes(kind))
          movingPart = addImprovements(this, group, kind, stage, town.buildingEras[id]);
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
    applyRoadSetbacks(group, id, town);
    return movingPart;
  }
  plotSignatures(town, labels) {
    return new Map(
      visiblePlots(town).map(({ id }) => [
        id,
        JSON.stringify([
          labels[id],
          town.era,
          town.buildings[id],
          constructionVisual(town.projects[id]),
          town.buildingEras[id],
          town.buildingEraLevels[id],
        ]),
      ]),
    );
  }
  topologySignature(town, labels) {
    return JSON.stringify([
      town.era,
      visiblePlots(town).map(({ id }) => id),
      townTracks(town),
      railEdges(town),
      roadLevel(town),
      hasElectricity(town),
      labels,
    ]);
  }
  prepareConstructionCue() {
    if (!this.cue) {
      this.cue = this.group(this.scene);
      this.cue.userData.animated = true;
      this.box(this.cue, 0.15, 1.2, 0.15, 0, 0.6, 0, '#b88952');
      this.box(this.cue, 0.7, 0.3, 0.35, 0, 1.15, 0, '#667a7b', true);
      this.cue.traverse((o) => o.layers.set(2));
    }
    this.cue.visible = false;
  }
  beginConstructionCue(id) {
    this.prepareConstructionCue();
    const [x, z] = PLOTS[id] ?? [0, 0];
    this.cue.position.set(x + 1.4, 0.4, z + 1.8);
    this.cue.rotation.z = -0.65;
    this.cue.visible = true;
    this.drawFrame();
  }
  changeTown(town, labels, mineProgress, constructionId, reducedMotion = false) {
    this.mineProgress = mineProgress;
    const works = this.staticScenery?.entries.get('mine-works')?.group;
    if (works) updateMineGrowth(works, mineGrowth(mineProgress));
    const signatures = this.plotSignatures(town, labels);
    const changed = [...signatures].filter(
      ([id, signature]) => this.plotCache?.get(id)?.signature !== signature,
    );
    if (!changed.length && this.topology === this.topologySignature(town, labels)) {
      this.town = town;
      this.render();
      return;
    }
    if (
      changed.length === 1 &&
      this.lifeReady !== false &&
      changed[0][0] === 'mine' &&
      this.topology === this.topologySignature(town, labels)
    ) {
      this.invalidatePresentationWork();
      this.town = town;
      this.staticScenery.update(this, town);
      const works = this.staticScenery.entries.get('mine-works').group;
      this.navigation.replaceOwner('mine-site', works.userData.footprints);
      this.plotCache.get('mine').signature = signatures.get('mine');
      this.buildingRenderer.sync(this.world.children.filter((child) => child.userData.static));
      this.repairAnimalLife();
      this.render();
      return;
    }
    if (
      changed.length === 1 &&
      this.lifeReady !== false &&
      changed[0][0] !== 'mine' &&
      this.topology === this.topologySignature(town, labels)
    ) {
      try {
        this.swapPlot(changed[0][0], town, labels, {
          construction: constructionId && !reducedMotion,
        });
        return;
      } catch (error) {
        console.warn('Incremental plot preparation failed; rebuilding town.', error);
      }
    }
    if (constructionId && this.navigation && this.plotCache?.has(constructionId)) {
      const [x, z] = PLOTS[constructionId],
        probe = this.group(new THREE.Group(), x, 0.08, z);
      probe.userData.plot = constructionId;
      const oldTown = this.town;
      this.town = town;
      try {
        this.buildPlot(constructionId, probe, town, labels);
      } finally {
        this.town = oldTown;
      }
      const entries = registerFootprints(probe, geometryFootprints(probe));
      this.clearGroup(probe);
      this.pendingUpdate = {
        id: constructionId,
        entries,
        town,
        labels,
        mineProgress,
        constructionId: reducedMotion ? null : constructionId,
      };
      if (!this.tryActivatePlot()) return;
    } else this.update(town, labels, mineProgress, reducedMotion ? null : constructionId);
    if (this.cue) this.cue.visible = false;
  }
  swapPlot(id, town, labels, { construction = false } = {}) {
    this.finishConstruction();
    this.invalidatePresentationWork();
    if (this.pendingPlot) this.clearGroup(this.pendingPlot.group);
    this.pendingPlot = null;
    this.pendingUpdate = null;
    const previous = this.plotCache.get(id);
    const [x, z] = PLOTS[id];
    const group = this.group(this.world, x, 0.08, z);
    group.userData.plot = id;
    group.userData.static = true;
    this.town = town;
    const movingPart = this.buildPlot(id, group, town, labels);
    const footprint =
      id === 'mine'
        ? { solids: geometryFootprints(group), provisional: true }
        : footprintsFor(plotFootprintKey(id, town), group);
    const entries = registerFootprints(group, footprint.solids, {
      provisional: footprint.provisional,
    });
    const signature = this.plotSignatures(town, labels).get(id);
    const pending = {
      id,
      group,
      previous,
      movingPart,
      entries,
      signature,
      construction,
      parts: constructionParts(group),
    };
    group.visible = false;
    group.userData.activation = 'pending';
    this.pendingPlot = pending;
    this.tryActivatePlot();
  }
  showConstructionGate(id) {
    if (!this.constructionGate) {
      const gate = (this.constructionGate = this.group(this.scene));
      gate.name = 'Building waiting for a clear work site';
      for (const x of [-1.5, 1.5]) this.box(gate, 0.08, 0.9, 0.08, x, 0.45, 0, '#b99464');
      this.box(gate, 3, 0.14, 0.05, 0, 0.75, 0, '#dba744');
      gate.traverse((o) => o.layers.set(2));
    }
    const [x, z] = PLOTS[id];
    this.constructionGate.position.set(x, 0.08, z + 2.5);
    this.constructionGate.visible = true;
  }
  plotVacant(pending) {
    const { entries } = pending;
    const occupants = [
      ...(this.actors ?? []),
      ...(this.animals ?? []),
      ...(this.vipArrivals?.actors ?? []),
    ].filter(
      (a) =>
        a.root.visible &&
        a.species !== 'pigeon' &&
        entries.some(
          (o) =>
            a.root.position.y + 1.65 > o.y &&
            a.root.position.y + 0.08 < o.y + o.height &&
            footprintDistance(o, a.root.position.x, a.root.position.z) < (a.radius ?? 0.45),
        ),
    );
    if (occupants.length) {
      this.showConstructionGate(pending.id);
      for (const actor of occupants) {
        if (actor.motion?.exitTarget) continue;
        if (pending.retryAt && (this.elapsed ?? 0) < pending.retryAt) continue;
        const p = actor.root.position,
          candidates = [];
        for (let ring = 1; ring <= 12; ring++)
          for (let i = 0; i < 16; i++) {
            const angle = (i * Math.PI) / 8,
              q = [p.x + Math.cos(angle) * ring * 0.5, p.y, p.z + Math.sin(angle) * ring * 0.5];
            if (
              entries.every((o) => footprintDistance(o, q[0], q[2]) >= (actor.radius ?? 0.45)) &&
              this.navigation.segment(p.toArray(), q, actor.radius ?? 0.45)
            )
              candidates.push(q);
          }
        if (candidates.length) {
          actor.motion ??= {
            x: p.x,
            z: p.z,
            vx: 0,
            vz: 0,
            routeDistance: 0,
            radius: actor.radius ?? 0.45,
            maxSpeed: actor.walkSpeed ?? 0.55,
          };
          actor.motion.exitTarget = candidates[0];
        } else pending.deferredReason = 'No swept-clear exit from pending structure';
      }
      pending.retryAt = (this.elapsed ?? 0) + 0.5;
      return false;
    }
    if (this.constructionGate) this.constructionGate.visible = false;
    return true;
  }
  tryActivatePlot() {
    if (this.pendingUpdate) {
      const pending = this.pendingUpdate;
      if (!this.plotVacant(pending)) return false;
      this.pendingUpdate = null;
      this.update(pending.town, pending.labels, pending.mineProgress, pending.constructionId);
      if (this.cue) this.cue.visible = false;
      return true;
    }
    const pending = this.pendingPlot;
    if (!pending) return true;
    const { id, group, previous, movingPart, entries, signature, construction, parts } = pending;
    if (!this.plotVacant(pending)) return false;
    this.pendingPlot = null;
    previous.group.userData.activation = 'removed';
    previous.group.removeFromParent();
    if (previous.movingPart) {
      previous.movingPart.rotor.removeFromParent();
      this.motions = this.motions.filter((m) => m !== previous.movingPart.update);
    }
    group.visible = true;
    group.userData.activation = construction ? 'temporary-reveal' : 'completed';
    if (this.cue) this.cue.visible = false;
    this.targets = this.targets.map((target) => (target === previous.group ? group : target));
    this.plotCache.set(id, { signature, group, movingPart, parts });
    this.navigation.replaceOwner(
      `plot:${id}`,
      entries,
      construction ? 'temporary-reveal' : 'completed',
    );
    const actors = [
      ...(this.actors ?? []),
      ...(this.animals ?? []),
      ...(this.vipArrivals?.actors ?? []),
    ];
    const view = this,
      generation = this.generation;
    function* repairRoutes() {
      view.itineraries = new TownItineraries(view);
      for (const actor of actors) {
        const path = actor.walkPath ?? actor.path;
        if (!path?.points.length) continue;
        const intersects = path.points.some(
          (p, i) => i && !view.navigation.segment(path.points[i - 1], p, actor.radius ?? 0.45),
        );
        if (!intersects) {
          if (actor.itinerary) yield* view.itineraries.prepare(actor);
          continue;
        }
        const position = actor.root.position.toArray();
        const next = path.building
          ? buildingWalk(view, path.building, path.frontage)
          : view.navigation.plan(
              [position, ...path.points.slice(1), position],
              actor.radius ?? 0.45,
            );
        if (actor.walkPath) actor.walkPath = next;
        else actor.path = next;
        if (actor.motion) actor.motion.path = null;
        if (actor.itinerary) {
          actor.itinerary.path = next;
          actor.itinerary.anchor = next.points[0];
          actor.itinerary.stops = [];
          actor.itinerary.phase = 'finishing';
          actor.routeLimit = next.total;
          yield* view.itineraries.prepare(actor);
        }
        yield;
      }
    }
    this.cancelRouteWork?.();
    this.cancelRouteWork = scheduleWork(repairRoutes(), {
      isCurrent: () => generation === this.generation,
    });
    if (movingPart) {
      this.world.attach(movingPart.rotor);
      movingPart.rotor.userData.animated = true;
      this.motions.push(movingPart.update);
    }
    if (construction)
      this.construction = new TownConstruction(this, group, movingPart?.rotor, previous.parts);
    this.buildingRenderer.sync(this.world.children.filter((child) => child.userData.static));
    this.clearGroup(previous.group);
    this.frameCache.valid = false;
    this.rebuildActors();
    this.render();
    const reveal = this.construction;
    if (reveal)
      afterPaint(() => {
        if (this.construction === reveal) reveal.presentFirstStrike();
      });
    else this.repairAnimalLife();
    return true;
  }
  invalidatePresentationWork() {
    this.generation = (this.generation ?? 0) + 1;
    this.cancelAnimalWork?.();
    this.cancelLifeWork?.();
    this.cancelFinishWork?.();
    this.cancelRouteWork?.();
  }
  update(town, labels, mineProgress = 0, constructionId = null) {
    this.mineProgress = mineProgress;
    this.invalidatePresentationWork();
    // Store the rendered era separately: the campaign may mutate the same town
    // object before this update. Routes and work positions only survive rebuilds
    // within that era; a new layout gets a fresh ambient population.
    if (this.lifeEra !== undefined && this.lifeEra !== town.era) {
      this.vipArrivals?.reset();
      this.vipArrivals = null;
      this.actors = [];
      this.animals = [];
      this.animalFeeder = null;
      this.animalMotion = null;
      this.animalSpace = null;
      this.animalNavigation = null;
      this.animalHabitats = [];
      this.locomotionGrid = null;
      this.locomotionAgents = [];
      this.locomotionVehicles = [];
      this.manualBlockers = [];
    }
    this.lifeEra = town.era;
    this.lifeReady = false;
    if (this.pendingPlot) this.clearGroup(this.pendingPlot.group);
    this.pendingPlot = null;
    this.pendingUpdate = null;
    this.presentation?.dispose(false);
    this.presentation = null;
    const interruptedGroup = this.construction?.group;
    this.construction?.finish();
    this.construction = null;
    const previousParts = this.plotCache?.get(constructionId)?.parts;
    const plots = visiblePlots(town);
    const previousPlotIds = this.cinematic?.plotIds;
    const reusable = new Map();
    const signatures = this.plotSignatures(town, labels);
    this.topology = this.topologySignature(town, labels);
    this.labels = labels;
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
    this.retainedVipActors = new Map((this.vipArrivals?.actors ?? []).map((a) => [a.source, a]));
    for (const a of this.retainedVipActors.values()) a.root.removeFromParent();
    this.retainedAnimals = new Map((this.animals ?? []).map((a) => [`${a.species}:${a.seed}`, a]));
    for (const a of this.retainedAnimals.values()) a.root.removeFromParent();
    this.retainedActors = new Map(
      (this.actors ?? []).filter((a) => a.persistentKey).map((a) => [a.persistentKey, a]),
    );
    for (const actor of this.retainedActors.values()) actor.root.removeFromParent();
    this.actorRenderer.clear();
    this.staticScenery ??= new TownScenery();
    this.staticScenery.detach();
    this.upgradeGlow.clear();
    this.clearGroup(this.world);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.actors = [];
    for (const a of this.retainedActors.values()) this.world.add(a.root);
    for (const a of this.retainedAnimals.values()) this.world.add(a.root);
    this.trafficActors = [];
    this.motions = [];
    this.visitorTransports = new Map();
    this.targets = [];
    this.anchors = [];
    this.town = town;
    this.guidedPlot = nextGoal(town)?.id;
    this.staticScenery.update(this, town);
    const mineWorks = this.staticScenery.entries.get('mine-works')?.group;
    if (mineWorks) updateMineGrowth(mineWorks, mineGrowth(mineProgress));
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
    for (const {
      id,
      position: [x, z],
    } of plots) {
      const cached = reusable.get(id);
      const group = cached?.group ?? this.group(this.world, x, 0.08, z);
      if (cached) this.world.add(group);
      group.userData.plot = id;
      if (previousPlotIds && !previousPlotIds.has(id)) {
        group.visible = false;
        group.userData.revealAfterCinematic = true;
      }
      group.userData.static = true;
      this.targets.push(group);
      this.anchors.push({
        id,
        width: id === 'mine' ? 160 : Math.max(76, labels[id].length * 7 + 35),
        position: point(x, 0.2, z + (id === 'mine' ? 1.65 : 1.85)),
      });
      let movingPart = cached?.movingPart;
      if (!cached) movingPart = this.buildPlot(id, group, town, labels);
      const bounds = new THREE.Box3().setFromObject(group);
      if (!cached) {
        const footprint =
          id === 'mine'
            ? { solids: geometryFootprints(group), provisional: false }
            : footprintsFor(plotFootprintKey(id, town), group);
        registerFootprints(group, footprint.solids, {
          provisional: footprint.provisional,
          activation: town.projects[id]
            ? 'construction'
            : town.buildings[id] || id === 'mine'
              ? 'completed'
              : 'unbuilt',
        });
      }
      if (id !== 'mine') this.upgradeGlow.add(id, bounds);
      // Keep action icons at the front porch, below the roofline.
      this.anchors.at(-1).collection = point(x, 1, z + 2.2);
      // Keep the windmill rotor articulated while batching the rest of its building.
      if (movingPart) {
        group.updateMatrixWorld(true);
        movingPart.rotor.updateWorldMatrix(true, false);
        this.world.attach(movingPart.rotor);
        movingPart.rotor.userData.animated = true;
        const center = movingPart.rotor.getWorldPosition(new THREE.Vector3());
        const rotorBounds = new THREE.Box3().setFromObject(movingPart.rotor);
        const radius = Math.max(
          center.distanceTo(rotorBounds.min),
          center.distanceTo(rotorBounds.max),
        );
        movingPart.rotor.userData.animalSolid = new THREE.Box3().setFromCenterAndSize(
          center,
          new THREE.Vector3().setScalar(radius * 2),
        );
      }
      const parts = cached?.parts ?? constructionParts(group);
      if (id === constructionId)
        this.construction = new TownConstruction(this, group, movingPart?.rotor, previousParts);
      else if (!cached) this.batch(group);
      if (movingPart) this.motions.push(movingPart.update);
      this.plotCache.set(id, { signature: signatures.get(id), group, movingPart, parts });
    }
    // Model preparation can be expensive. Start the reveal clock on its first visible frame.
    if (this.construction) this.lastFrame = 0;
    this.navigation = townNavigation(this.world);
    this.buildingRenderer.sync(this.world.children.filter((child) => child.userData.static));
    this.renderer.shadowMap.needsUpdate = true;
    if (this.overview) this.frameTown();
    drawNavigation(this);
    performanceMark('geometry-ready');
    performanceMark('navigation-ready');
    this.render();
    const generation = this.generation;
    const populate = () => {
      if (this.disposed || generation !== this.generation) return;
      const work = this.populateLife(town);
      if (this.deferLife)
        this.cancelLifeWork = scheduleWork(work, {
          budget: 8,
          isCurrent: () => generation === this.generation && !this.disposed,
        });
      else while (!work.next().done) {}
    };
    if (!this.deferLife) populate();
    afterPaint(() => {
      if (this.disposed || generation !== this.generation) return;
      performanceMark('first-town-frame');
      if (this.deferLife) populate();
      this.construction?.presentFirstStrike();
      this.onFirstFrame?.();
    });
  }
  *populateLife(town) {
    this.itineraries = new TownItineraries(this);
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
    addAviationActivity(this, town);
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
    this.rebuildActors();
    this.renderer.shadowMap.needsUpdate = true;
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
  person({
    color,
    skin,
    hat,
    route,
    seed,
    work,
    dress,
    gender,
    parent = this.world,
    manual = false,
    visitor = false,
    sheriff = false,
    loop = false,
    linear = false,
    era = this.town?.era,
  }) {
    const persistentKey = !manual && JSON.stringify([seed, work, visitor, sheriff, route]);
    const retained = this.retainedActors?.get(persistentKey);
    if (retained && retained.appearance.era === era) {
      this.retainedActors.delete(persistentKey);
      parent.add(retained.root);
      this.actors.push(retained);
      prepareActorWalk(this, retained);
      return retained;
    }
    const firstVIP = visitor && !manual ? vipVisitor(seed, 0) : null;
    const identity = firstVIP ?? villagerIdentity(seed, gender ?? (dress ? 'female' : undefined));
    const female = identity.gender === 'female';
    const wardrobe = townWardrobe(eraEvolution(era));
    if (sheriff && wardrobe.patrol) color = '#315d83';
    const root = this.group(parent);
    root.userData.villager = { ...identity, name: firstVIP?.name ?? null };
    // Manual incident actors still need the animated foreground renderer.
    root.userData.animated = true;
    if (sheriff) {
      root.name = wardrobe.patrol ? 'Town patrol officer' : 'Village sheriff';
      root.scale.setScalar(1.05);
    }
    const body = this.group(root, 0, 0.54, 0);
    this.box(body, 0.25, 0.19, 0.16, 0, 0, 0, '#69654d', true);
    const torso = this.group(body, 0, 0.1, 0);
    const shirt = this.box(
      torso,
      female ? 0.26 : 0.32,
      wardrobe.coat,
      0.18,
      0,
      0.13,
      0,
      color,
      true,
    );
    const hips = this.mesh(body, 'cone', [0.17, 0.19, 0.13], [0, -0.015, 0], color);
    hips.visible = female;
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
    const hair = this.group(head);
    hair.name = 'Villager swept hair and bun';
    for (const x of [-0.1, 0.1])
      this.ball(hair, x, -0.015, -0.045, [0.045, 0.14, 0.085], '#73563d');
    this.ball(hair, 0, 0.015, -0.135, [0.085, 0.085, 0.07], '#73563d');
    const jaw = this.ball(head, 0, -0.06, 0.015, [0.105, 0.075, 0.095], skin);
    jaw.name = 'Villager broad jaw';
    hair.visible = female;
    jaw.visible = !female;
    this.ball(head, 0, -0.005, 0.111, [0.022, 0.028, 0.025], skin);
    for (const x of [-0.044, 0.044]) this.ball(head, x, 0.025, 0.105, 0.012, '#39392f');
    const headwear = this.group(head);
    if (wardrobe.hat === 'cap' || (sheriff && wardrobe.patrol)) {
      this.ball(headwear, 0, 0.11, -0.005, [0.135, 0.065, 0.12], hat);
      this.box(headwear, 0.17, 0.025, 0.11, 0, 0.11, 0.105, hat, true);
    } else if (wardrobe.hat !== 'none') {
      this.mesh(headwear, 'cylinder', [wardrobe.brim ?? 0.195, 0.025, 0.18], [0, 0.105, 0], hat);
      if (wardrobe.crown === 'round') this.ball(headwear, 0, 0.16, 0, [0.12, 0.11, 0.11], hat);
      else
        this.mesh(
          headwear,
          wardrobe.crown === 'flat' ? 'cylinder' : 'cone',
          [0.12, 0.115, 0.11],
          [0, 0.164, 0],
          hat,
        );
      this.mesh(headwear, 'cylinder', [0.122, 0.028, 0.112], [0, 0.129, 0], '#6a6050');
    }
    const vip = this.group(torso);
    vip.name = 'Honorary VIP visitor outfit';
    vip.visible = !!root.userData.villager.name;
    const accents = [];
    const scarf = this.group(vip),
      satchel = this.group(vip);
    scarf.visible = satchel.visible = false;
    if (visitor) {
      for (const x of [-0.065, 0.065])
        accents.push(this.box(vip, 0.035, wardrobe.coat * 0.62, 0.025, x, 0.15, 0.105, '#e9c878'));
      const badge = this.box(vip, 0.09, 0.09, 0.035, -0.1, 0.22, 0.125, '#ffd15b');
      badge.rotation.z = Math.PI / 4;
      badge.name = 'VIP gold badge';
      this.box(scarf, 0.25, 0.055, 0.025, 0, 0.305, 0.115, '#e9c878');
      this.box(scarf, 0.055, 0.19, 0.025, 0.06, 0.19, 0.115, '#e9c878');
      this.rod(satchel, [-0.1, 0.29, 0.11], [0.23, -0.14, 0.11], 0.015, '#8b674a');
      this.box(satchel, 0.15, 0.22, 0.15, 0.24, -0.15, 0.025, '#8b674a', true);
      this.box(satchel, 0.13, 0.06, 0.16, 0.24, -0.06, 0.03, '#ad8961', true);
    }
    const arms = [],
      legs = [],
      sleeves = [],
      trousers = [],
      boots = [];
    for (const side of [-1, 1]) {
      const arm = this.group(torso, side * 0.18, 0.24, 0);
      sleeves.push(this.rod(arm, [0, 0, 0], [side * 0.015, -0.2, 0], 0.05, color));
      const fore = this.group(arm, side * 0.015, -0.2, 0);
      this.rod(fore, [0, 0, 0], [0, -0.18, 0], 0.039, skin);
      this.ball(fore, 0, -0.19, 0, [0.045, 0.057, 0.04], skin);
      arms.push({ upper: arm, lower: fore });
      const thigh = this.group(body, side * 0.078, -0.065, 0);
      trousers.push(this.rod(thigh, [0, 0, 0], [0, -0.22, 0], 0.065, wardrobe.trousers));
      const shin = this.group(thigh, 0, -0.22, 0);
      trousers.push(this.rod(shin, [0, 0, 0], [0, -0.21, 0], 0.047, wardrobe.trousers));
      boots.push(this.box(shin, 0.105, 0.08, 0.19, 0, -0.215, 0.035, wardrobe.boots, true));
      legs.push({ upper: thigh, lower: shin });
    }
    const skirt = this.mesh(body, 'cone', [0.2, 0.29, 0.17], [0, -0.085, 0], color);
    skirt.visible = !!dress || (female && !sheriff && eraEvolution(era).wardrobe === 'frontier');
    const appearance = { hair, jaw, hips, skirt, dress, sheriff, era, gender: identity.gender };
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
    const actor = {
      root,
      body,
      torso,
      head,
      arms,
      legs,
      curve,
      duration,
      seed,
      work,
      visitor,
      manual,
      vip,
      shirt,
      appearance,
      clothing: {
        shirt: [shirt, hips, skirt, ...sleeves],
        trousers,
        boots,
        hat: headwear.children,
        accent: accents,
        headwear,
        accessories: { scarf, satchel },
      },
      shirtColor: color,
      distance: 0,
    };
    actor.originalClothing = [
      shirt,
      hips,
      skirt,
      ...sleeves,
      ...trousers,
      ...boots,
      ...headwear.children,
      ...accents,
    ].map((mesh) => [mesh, mesh.material]);
    if (!manual) this.actors.push(actor);

    root.traverse((object) => {
      if (object.isMesh) object.castShadow = false;
    });
    if (!manual) this.contactShadow(root, 0.27, 0.18);
    actor.persistentKey = persistentKey;
    if (retained) {
      this.retainedActors.delete(persistentKey);
      for (const key of ['id', 'motion', 'distance', 'acceptedDistance', 'visit', 'lastPoseTime'])
        if (retained[key] !== undefined) actor[key] = retained[key];
      root.position.copy(retained.root.position);
      root.rotation.copy(retained.root.rotation);
      root.scale.copy(retained.root.scale);
      this.setVillagerIdentity(actor, retained.root.userData.villager);
      this.clearGroup(retained.root);
    }
    root.userData.locomotionActor = actor;
    prepareActorWalk(this, actor);
    return actor;
  }
  setVillagerIdentity(actor, identity, outfitSeed = actor.seed ?? 0) {
    actor.root.userData.villager = identity;
    const female = identity.gender === 'female';
    const a = actor.appearance;
    a.hair.visible = a.hips.visible = female;
    a.jaw.visible = !female;
    a.skirt.visible = female && (a.dress || eraEvolution(a.era).wardrobe === 'frontier');
    actor.shirt.scale.x = female ? 0.26 : 0.32;
    actor.vip.visible = !!identity.name;
    if (identity.name) {
      const outfit = vipOutfit(eraEvolution(a.era), outfitSeed);
      actor.root.userData.outfit = outfit;
      for (const part of ['shirt', 'trousers', 'boots', 'hat', 'accent'])
        for (const mesh of actor.clothing[part]) mesh.material = this.material(outfit[part]);
      actor.shirt.scale.y = outfit.coat;
      actor.clothing.headwear.visible = outfit.hatVisible;
      a.skirt.visible = female && outfit.skirt;
      a.skirt.scale.y = outfit.skirtLength;
      a.skirt.position.y = 0.025 - outfit.skirtLength / 2;
      for (const [type, group] of Object.entries(actor.clothing.accessories))
        group.visible = outfit.accessory === type;
      actor.clothing.accent.forEach((mesh) => {
        mesh.visible = outfit.accessory === 'lapels';
      });
      actor.clothing.accessories.scarf.children.forEach((mesh) => {
        mesh.material = this.material(outfit.accent);
      });
    } else {
      delete actor.root.userData.outfit;
      actor.originalClothing.forEach(([mesh, material]) => {
        mesh.material = material;
      });
      actor.shirt.scale.y = townWardrobe(eraEvolution(a.era)).coat;
      actor.clothing.headwear.visible = true;
      a.skirt.scale.y = 0.29;
      a.skirt.position.y = -0.085;
    }
  }
  animatePerson(actor, time) {
    updateWorkRoutine(actor, time);
    updateItinerary(this, actor, time);
    time = actor.motion?.animationTime ?? time;
    const { root, body, torso, head, arms, legs, curve, duration, seed, work } = actor;
    const cycle = (time + seed) % (duration + 4);
    if (!actor.workRoutine && !actor.itinerary) actor.routeResting = !work && cycle >= duration;
    let walking = !work && cycle < duration;
    const progress = work?.length ? 0.1 : Math.min(cycle / duration, 0.9999);
    const placedWorker = work && (actor.motion || actor.workRoutine);
    if (!actor.walkPath && !placedWorker) root.position.copy(curve.getPointAt(progress));
    let routeProgress = actor.itinerary ? (actor.routeProgress ?? 0) : progress;
    if (actor.visitor && !actor.transportVisitor && !actor.itinerary) {
      const phase = (time + seed) % (duration + 7);
      actor.routeResting = phase >= duration;
      const visit = Math.floor((time + seed) / (duration + 7));
      if (actor.visit !== visit) {
        actor.visit = visit;
        const chosen = hasVisitorTransport(this.town) ? null : vipVisitor(seed, visit);
        this.setVillagerIdentity(actor, chosen ?? villagerIdentity(seed), seed + visit * 997);
      }
      const isVIP = !!root.userData.villager.name;
      actor.vip.visible = isVIP;
      routeProgress = Math.min(0.9999, phase / duration);
      if (!actor.walkPath) root.position.copy(curve.getPointAt(routeProgress));
      // Visitors leave their host building, walk the town and return through
      // the same entrance. The quiet interval is indoors between visits.
      root.scale.setScalar(Math.max(0, Math.min(1, phase / 0.8, (duration - phase) / 0.8)));
      root.visible = root.scale.x > 0;
      walking = phase < duration;
    }

    if (actor.motion && actor.walkPath?.total && (!actor.manual || actor.transportVisitor))
      routeProgress =
        actor.itinerary && actor.itinerary.phase !== 'finishing'
          ? Math.min(1, actor.motion.routeDistance / actor.walkPath.total)
          : (actor.motion.routeDistance % actor.walkPath.total) / actor.walkPath.total;
    if (!actor.workRoutine) actor.routeProgress = routeProgress;
    if (actor.walkPath && !placedWorker) {
      const pose = walkPose(actor.walkPath, routeProgress, actor.walkPose);
      root.position.set(pose.x, pose.y, pose.z);
      root.rotation.y = pose.heading;
    } else if (!placedWorker) {
      const tangent = curve.getTangentAt(Math.min(0.9999, routeProgress));
      root.rotation.y = Math.atan2(tangent.x, tangent.z);
      if (!work && (!actor.manual || actor.transportVisitor)) {
        const doorway = actor.transportVisitor
          ? Math.min(1, root.position.distanceTo(actor.door) / 2)
          : 1;
        const offset = SIDEWALK_OFFSET * (actor.visitor ? root.scale.x : 1) * doorway;
        root.position.x += tangent.z * offset;
        root.position.z -= tangent.x * offset;
      }
    }
    // Locomotion owns an established worker's position, including any accepted
    // construction exit. Do not repeat the placement search every frame.
    if (work && !actor.motion && !actor.workRoutine) placeSafely(this, root);
    if (!actor.motion && actor.lastPosition && time >= actor.lastPoseTime)
      actor.distance += root.position.distanceTo(actor.lastPosition);
    actor.lastPosition ??= new THREE.Vector3();
    actor.lastPosition.copy(root.position);
    actor.lastPoseTime = time;
    if (actor.motion) walking = actor.motion.state === 'moving';
    const step = (actor.distance / 0.58) * Math.PI * 2;
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
      const activity = actor.workRoutine && !actor.workActive ? null : work;
      if (activity === 'farm') {
        torso.rotation.x = 0.22 + Math.sin(time * 1.9) * 0.12;
        arms[0].upper.rotation.x = -0.7 + Math.sin(time * 1.9) * 0.3;
      } else if (activity === 'fishing') {
        torso.rotation.x = 0.04;
        arms[1].upper.rotation.x = -0.65 + Math.sin(time * 0.7) * 0.05;
        arms[1].lower.rotation.x = -0.5;
      } else {
        torso.rotation.x = 0;
        arms[1].upper.rotation.z = activity === 'greet' ? -0.12 : 0;
        arms[1].lower.rotation.x =
          activity === 'greet' ? -0.45 + Math.sin(time * 1.2 + seed) * 0.16 : -0.16;
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
    const tail = this.group(root, 0, 0.86, -0.47);
    this.rod(tail, [0, 0, 0], [0, -0.46, -0.19], 0.055, '#594b34');
    this.motions.push((time) => {
      head.rotation.x = 0.18 + Math.sin(time * 0.9 + rotation) * 0.14;
      tail.rotation.z = Math.sin(time * 1.5 + rotation) * 0.3;
      root.rotation.z = Math.sin(time * 0.65 + rotation) * 0.025;
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
    horizonMaterial(this.selection.material);
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.position.set(x, 0.095, z);
    this.world.add(this.selection);
    this.render();
  }
  showVillager(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    let nearest = null,
      distance = 24;
    for (const actor of [...(this.actors ?? []), ...(this.vipArrivals?.actors ?? [])]) {
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
    this.namedVillager = nearest;
    this.projectVillager();
    return !!nearest;
  }
  projectVillager() {
    const actor = this.namedVillager;
    if (
      !actor?.root.visible ||
      !actor.root.userData.villager?.name ||
      actor.root.scale.x < 0.5 ||
      !this.world?.children.includes(actor.root) ||
      this.raid ||
      this.cinematic
    ) {
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
        ? { name: actor.root.userData.villager.name, x: (p.x + 1) * 50, y: (1 - p.y) * 50 }
        : null,
    );
  }
  pick(clientX, clientY) {
    if (this.showVillager(clientX, clientY)) return;
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
    this.manualBlockers = [];
    const traffic = new Set(this.trafficActors ?? []);
    this.scene.traverse((root) => {
      const actor = root.userData.locomotionActor;
      if (!actor?.manual || actor.transportVisitor) return;
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
    this.actorRenderer.update();
    if (this.drawFrame(true)) this.projectLabels();
  }
  projectLabels() {
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
      if (!this.reducedMotion) {
        this.actors?.forEach((actor) => this.animatePerson(actor, this.elapsed));
        this.motions?.forEach((motion) => motion(this.elapsed));
        this.vipArrivals?.update();
      }
      updateTownLocomotion(this, movementDelta);
    }
    if (this.waterMaterial) this.waterMaterial.uniforms.time.value = this.elapsed;
    this.tryActivatePlot?.();
    if (this.reducedMotion && !this.pendingPlot && !this.pendingUpdate)
      this.renderer.setAnimationLoop(null);
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
    this.actorRenderer.update();
    if (this.drawFrame()) {
      if (eventCameraMoved) this.projectLabels();
      else this.projectVillager?.();
    }
  }
  repairAnimalLife() {
    this.retainedAnimals = new Map((this.animals ?? []).map((a) => [`${a.species}:${a.seed}`, a]));
    if (this.animalMotion) this.motions = this.motions.filter((m) => m !== this.animalMotion);
    addTownAnimals(this, this.town);
  }
  finishConstruction() {
    if (!this.construction) return;
    const { group } = this.construction;
    this.construction.finish();
    this.construction = null;
    delete group.userData.animalSolid;
    this.navigation?.replaceOwner(
      `plot:${group.userData.plot}`,
      group.userData.footprints ?? [],
      'completed',
    );
    group.userData.activation = 'completed';
    this.frameCache.valid = false;
    this.render();
    const generation = this.generation;
    const view = this;
    function* settle() {
      if (group.parent !== view.world) return;
      view.batch(group);
      yield;
      view.buildingRenderer.sync(view.world.children.filter((child) => child.userData.static));
      view.repairAnimalLife();
      view.rebuildActors();
      view.frameCache.valid = false;
      afterPaint(() => {
        if (generation !== view.generation) return;
        view.renderer.shadowMap.needsUpdate = true;
        view.render();
      });
    }
    this.cancelFinishWork?.();
    if (typeof requestAnimationFrame === 'undefined') {
      const work = settle();
      while (!work.next().done) {}
      return;
    }
    this.cancelFinishWork = scheduleWork(settle(), {
      isCurrent: () => generation === this.generation,
    });
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
      for (const [group, batch] of this.buildingRenderer?.batches ?? []) {
        if (batch) batch.visible = group.visible;
      }
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
  setPaused(paused) {
    if (this.paused !== paused) {
      this.lastFrame = 0;
      if (paused) this.construction?.pause();
      else this.construction?.resume();
    }
    this.paused = paused;
    this.controls.enabled = !paused && !this.cinematic && !this.eventCamera;
  }
  setMotion(enabled, reducedMotion = false) {
    const wasReduced = this.reducedMotion;
    this.reducedMotion = reducedMotion;
    enabled = enabled && (!reducedMotion || !!this.pendingPlot || !!this.pendingUpdate);
    if (this.motionEnabled === enabled && wasReduced === reducedMotion) return;
    this.motionEnabled = enabled;
    if (enabled) this.construction?.resume();
    else this.construction?.pause();
    this.lastFrame = 0;
    this.renderQuality?.resetWindow();
    this.renderer.setAnimationLoop(enabled && !this.contextUnavailable ? this.tick : null);
  }
  dispose() {
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
    this.clearGroup(this.world);
    this.clearGroup(this.landscape);
    this.plotCache?.clear();
    Object.values(this.geometries).forEach((geometry) => geometry.dispose());
    this.signMaterials?.forEach((material) => {
      material.map.dispose();
      material.dispose();
    });
    this.materials.forEach((material) => material.dispose());
    this.contactShadowMaterial.dispose();
    this.sun.shadow.map?.dispose();
    this.renderer.dispose();
    if (!this.renderer.getContext().isContextLost()) this.renderer.forceContextLoss();
  }
}
