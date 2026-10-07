import { TownItineraries } from './TownItineraries';

import { applyRoadSetbacks } from './BuildingSetbacks';
import { addTownAnimals, animalKey } from './TownAnimals';
import { footprintsFor, plotFootprintKey } from './FootprintCatalog';
import { drawNavigation } from './NavigationDebug';
import { hasElectricity } from '../../data/industrial';
import { mineGrowth } from '../../data/mineGrowth';
import { updateMineGrowth } from './mine/addMineSite';
import { afterPaint, finishWork, performanceMark, scheduleWork } from '../PresentationWork';
import { geometryFootprints, registerFootprints, footprintDistance } from './BuildingFootprints';
import { townTracks, railEdges } from './TownLayout';
import { NPC_MARGIN, townNavigation, sceneryObstacles } from './TownNavigation';
import { recordTownTiming, timeTown, timedSteps } from './TownProfiler';
import { updateWorkPaths } from './TownWorkRoutine';
import { buildingWalk } from './TownPedestrians';

import { eraEvolution } from '../../data/eras';

import * as THREE from 'three';

import { addConstructionPlot, addWell } from './buildings/frontierParts';
import { WATERMILL_WHEEL } from './buildings/watermill';

import { BUILDING_BY_ID } from '../../data/town';

import { walkers } from './TownWalkers';
import { TownConstruction, constructionParts } from './TownConstruction';
import { buildTownSquare } from './TownSquare';
import {
  renderBuilding,
  renderModernization,
  renderEraLandmark,
} from './buildings/BuildingRenderer';

import { refreshTransport } from './TownTransports';
import { addScaffolding, addImprovements } from './TownImprovements';

import { constructionVisual, nextGoal, roadLevel } from './TownRules';

import { addServiceDrops } from './TownEvolution';
import { TownScenery, sceneryAffectsNavigation } from './TownScenery';

import { PLOTS, visiblePlots } from './TownLayout';
import { updateTownShadowCoverage } from './TownShadows';
import { GARDEN_PARCELS } from '../../data/townGardenDistrict';

// The plot lifecycle: building a plot's model, swapping changed plots one per frame,
// holding a finished building until its site is clear, the construction reveal and
// its settling, and the full rebuild for layout or era changes. Every function takes
// the diorama; its methods of the same names delegate here.

// Village seconds a finished building waits for villagers to walk off its site.
const SITE_CLEAR_SECONDS = 2;
const point = (x, y, z) => new THREE.Vector3(x, y, z);

// Plot changes wait in one queue. The active job is prepared (its new model built
// and its footprints known) and applies once its site is clear of walkers: a
// 'swap' replaces one plot in place, a 'rebuild' adopts a prepared building into a
// full rebuild when the town's layout changes.
const plotWork = (d) => (d.plotWork ??= { queue: [], active: null });

// A rotor (windmill sails, watermill wheel) keeps turning while the rest of its plot
// is batched: it moves into the world as an animated actor with its motion, and
// animals treat its swept sphere as solid.
function attachMovingPart(d, group, { rotor, update }) {
  group.updateMatrixWorld(true);
  rotor.updateWorldMatrix(true, false);
  d.world.attach(rotor);
  rotor.userData.animated = true;
  const center = rotor.getWorldPosition(new THREE.Vector3());
  const bounds = new THREE.Box3().setFromObject(rotor);
  const radius = Math.max(center.distanceTo(bounds.min), center.distanceTo(bounds.max));
  rotor.userData.animalSolid = new THREE.Box3().setFromCenterAndSize(
    center,
    new THREE.Vector3().setScalar(radius * 2),
  );
  d.motions.push(update);
}

export function buildPlot(d, id, group, town, labels) {
  let movingPart;
  if (id === 'mine') d.mine(group, labels.mine);
  else {
    const stage = town.buildings[id],
      project = town.projects[id],
      kind = BUILDING_BY_ID[id].kind;
    if (kind === 'bridge') {
      renderBuilding({ town: d, parent: group, kind, level: stage, label: labels[id] });
      if (stage)
        renderModernization(
          d,
          group,
          kind,
          town.buildingEras[id],
          town.buildingEraLevels[id] || stage,
        );
      if (project) addScaffolding(d, group, kind, stage, constructionVisual(project));
    } else if (!stage) addConstructionPlot(d, group, kind, project ? 2 : -1, labels[id]);
    else {
      const industrial = renderEraLandmark(
        d,
        group,
        kind,
        labels[id],
        town.buildingEraLevels[id] || 1,
        town.buildingEras[id],
        stage,
      );
      if (!industrial) {
        if (kind === 'square')
          buildTownSquare(
            d,
            group,
            stage,
            town.buildingEras[id] === 'frontier',
            town.buildingEras[id],
          );
        else if (kind === 'well') addWell(d, group);
        else d.building(group, kind, stage, labels[id]);
      }
      if (!industrial) movingPart = addImprovements(d, group, kind, stage, town.buildingEras[id]);
      if (!industrial)
        renderModernization(
          d,
          group,
          kind,
          town.buildingEras[id],
          town.buildingEraLevels[id] || stage,
        );
      const wheel = group.getObjectByName(WATERMILL_WHEEL);
      if (wheel)
        movingPart = {
          rotor: wheel,
          update: (time) => {
            wheel.rotation.x = time * 0.45;
          },
        };
      if (project) addScaffolding(d, group, kind, stage, constructionVisual(project));
    }
  }
  applyRoadSetbacks(group, id, town);
  return movingPart;
}

export function plotSignatures(d, town, labels) {
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

// Named parts show which layout change forced a full rebuild in town timings.
function topologyParts(d, town, labels) {
  return Object.fromEntries(
    Object.entries({
      era: town.era,
      plots: visiblePlots(town).map(({ id }) => id),
      tracks: townTracks(town),
      rails: railEdges(town),
      roads: roadLevel(town),
      electricity: hasElectricity(town),
      labels,
    }).map(([key, value]) => [key, JSON.stringify(value ?? null)]),
  );
}

export function topologySignature(d, town, labels) {
  return JSON.stringify(topologyParts(d, town, labels));
}

export function prepareConstructionCue(d) {
  if (!d.cue) {
    d.cue = d.group(d.scene);
    d.cue.userData.animated = true;
    d.box(d.cue, 0.15, 1.2, 0.15, 0, 0.6, 0, '#b88952');
    d.box(d.cue, 0.7, 0.3, 0.35, 0, 1.15, 0, '#667a7b', true);
    d.cue.traverse((o) => o.layers.set(2));
  }
  d.cue.visible = false;
}

export function beginConstructionCue(d, id) {
  d.prepareConstructionCue();
  const [x, z] = PLOTS[id] ?? [0, 0];
  d.cue.position.set(x + 1.4, 0.4, z + 1.8);
  d.cue.rotation.z = -0.65;
  d.cue.visible = true;
  d.drawFrame();
}

export function changeTown(d, town, labels, mineProgress, constructionId, reducedMotion = false) {
  const started = performance.now();
  d.mineProgress = mineProgress;
  const works = d.staticScenery?.entries.get('mine-works')?.group;
  if (works) updateMineGrowth(works, mineGrowth(mineProgress));
  const signatures = d.plotSignatures(town, labels);
  const changed = [...signatures].filter(
    ([id, signature]) => d.plotCache?.get(id)?.signature !== signature,
  );
  const parts = topologyParts(d, town, labels);
  const sameTopology = d.topology === JSON.stringify(parts);
  const record = (path) =>
    recordTownTiming('town-change', started, {
      path,
      building: constructionId ?? null,
      plots: changed.map(([id]) => id),
      topology: Object.keys(parts).filter((key) => parts[key] !== d.topologyState?.[key]),
    });
  // A newer town supersedes plots still waiting from an earlier change.
  const work = plotWork(d);
  work.queue = [];
  if (!changed.length && sameTopology) {
    const expanded =
      JSON.stringify(d.town?.personalisation?.areas) !==
      JSON.stringify(town.personalisation?.areas);
    d.town = town;
    const sceneryChanges = refreshScenery(d);
    if (sceneryChanges.length) {
      d.buildingRenderer.sync(d.world.children.filter((child) => child.userData.static));
      if (sceneryChanges.some(sceneryAffectsNavigation)) d.repairAnimalLife();
    }
    if (expanded && d.overview) d.frameTown();
    // No plot will activate to retire a construction cue shown for this change.
    if (d.cue) d.cue.visible = false;
    d.render();
    return;
  }
  if (changed.length === 1 && d.lifeReady !== false && changed[0][0] === 'mine' && sameTopology) {
    invalidatePresentationWork(d);
    d.town = town;
    d.staticScenery.update(d, town);
    const works = d.staticScenery.entries.get('mine-works').group;
    d.navigation.replaceOwner('mine-site', works.userData.footprints);
    d.plotCache.get('mine').signature = signatures.get('mine');
    d.buildingRenderer.sync(d.world.children.filter((child) => child.userData.static));
    d.repairAnimalLife();
    d.render();
    record('mine');
    return;
  }
  if (
    changed.length &&
    d.lifeReady !== false &&
    changed.every(([id]) => id !== 'mine') &&
    sameTopology
  ) {
    // Several plots can change at once, e.g. every project advancing after a mine
    // run. Swap them one per frame instead of rebuilding the town and all its life,
    // starting after the current town is back on screen. The player's finished
    // building goes last so no later swap cuts its reveal short.
    const ids = changed.map(([id]) => id);
    const queue = [
      ...ids.filter((id) => id !== constructionId),
      ...ids.filter((id) => id === constructionId),
    ].map((id) => ({ id, town, labels, construction: id === constructionId && !reducedMotion }));
    try {
      if (queue.length > 1) work.queue = queue;
      else swapPlot(d, queue[0].id, town, labels, { construction: queue[0].construction });
      record('swap');
      return;
    } catch (error) {
      work.queue = [];
      console.warn('Incremental plot preparation failed; rebuilding town.', error);
    }
  }
  if (constructionId && d.navigation && d.plotCache?.has(constructionId)) {
    // Prepare the finished building once: its footprints decide when the site is
    // clear, then the full rebuild adopts this group instead of building it again.
    const [x, z] = PLOTS[constructionId],
      probe = d.group(new THREE.Group(), x, 0.08, z);
    probe.userData.plot = constructionId;
    const oldTown = d.town;
    d.town = town;
    let movingPart;
    try {
      movingPart = timeTown('prepare-build', () =>
        d.buildPlot(constructionId, probe, town, labels),
      );
    } catch (error) {
      d.clearGroup(probe);
      throw error;
    } finally {
      d.town = oldTown;
    }
    const footprint = timeTown('prepare-footprints', () =>
      d.plotFootprints(constructionId, town, probe, false),
    );
    const entries = registerFootprints(probe, footprint.solids, {
      provisional: footprint.provisional,
    });
    d.discardPlotWork();
    work.active = {
      kind: 'rebuild',
      id: constructionId,
      entries,
      town,
      labels,
      mineProgress,
      constructionId: reducedMotion ? null : constructionId,
      prepared: { id: constructionId, group: probe, movingPart, footprint },
    };
    record('prepared-update');
    if (!d.tryActivatePlot()) return;
  } else {
    d.update(town, labels, mineProgress, reducedMotion ? null : constructionId);
    record('update');
  }
  if (d.cue) d.cue.visible = false;
}

export function plotFootprints(d, id, town, group, provisionalMine = true) {
  return id === 'mine'
    ? { solids: geometryFootprints(group), provisional: provisionalMine }
    : footprintsFor(plotFootprintKey(id, town), group);
}

// Drops the active job: a prepared rebuild's building (and any rotor in it) never
// joined the world, and a waiting swap's hidden group leaves it.
export function discardPlotWork(d) {
  const { active } = plotWork(d);
  d.clearGroup(active?.kind === 'rebuild' ? active.prepared?.group : active?.group);
  plotWork(d).active = null;
}

function swapPlot(d, id, town, labels, { construction = false } = {}) {
  d.finishConstruction();
  invalidatePresentationWork(d);
  d.discardPlotWork();
  const previous = d.plotCache.get(id);
  const [x, z] = PLOTS[id];
  const group = d.group(d.world, x, 0.08, z);
  group.userData.plot = id;
  group.userData.static = true;
  d.town = town;
  const movingPart = timeTown('prepare-build', () => d.buildPlot(id, group, town, labels));
  const footprint = timeTown('prepare-footprints', () => d.plotFootprints(id, town, group));
  const entries = registerFootprints(group, footprint.solids, {
    provisional: footprint.provisional,
  });
  const signature = d.plotSignatures(town, labels).get(id);
  const partKeys = new Map();
  const pending = {
    kind: 'swap',
    id,
    group,
    previous,
    movingPart,
    entries,
    signature,
    construction,
    parts: timeTown('construction-parts', () => constructionParts(group, partKeys)),
    partKeys,
  };
  group.visible = false;
  group.userData.activation = 'pending';
  plotWork(d).active = pending;
  d.tryActivatePlot();
}

function showConstructionGate(d, id) {
  if (!d.constructionGate) {
    const gate = (d.constructionGate = d.group(d.scene));
    gate.name = 'Building waiting for a clear work site';
    for (const x of [-1.5, 1.5]) d.box(gate, 0.08, 0.9, 0.08, x, 0.45, 0, '#b99464');
    d.box(gate, 3, 0.14, 0.05, 0, 0.75, 0, '#dba744');
    gate.traverse((o) => o.layers.set(2));
  }
  const [x, z] = PLOTS[id];
  d.constructionGate.position.set(x, 0.08, z + 2.5);
  d.constructionGate.visible = true;
}

export function plotVacant(d, pending) {
  const { entries } = pending;
  const occupants = walkers(d).filter(
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
  const now = d.elapsed ?? 0;
  if (occupants.length) pending.waitStarted ??= now;
  // Anyone still on the site after the grace period, boxed in or held by a
  // crowd, steps off it. The build must not wait on them, or every later
  // build queued behind it keeps its scaffolding and never plays its reveal.
  if (occupants.length && now - pending.waitStarted < SITE_CLEAR_SECONDS) {
    showConstructionGate(d, pending.id);
    for (const actor of occupants) {
      if (actor.motion?.exitTarget) continue;
      if (pending.retryAt && now < pending.retryAt) continue;
      const exit = siteExit(d, actor, entries, true);
      if (exit) {
        const p = actor.root.position;
        actor.motion ??= {
          x: p.x,
          z: p.z,
          vx: 0,
          vz: 0,
          routeDistance: 0,
          radius: actor.radius ?? 0.45,
          maxSpeed: actor.walkSpeed ?? 0.55,
        };
        actor.motion.exitTarget = exit;
      } else pending.deferredReason = 'No swept-clear exit from pending structure';
    }
    pending.retryAt = now + 0.5;
    return false;
  }
  for (const actor of occupants) {
    const exit =
      actor.motion?.exitTarget ??
      siteExit(d, actor, entries, true) ??
      siteExit(d, actor, entries, false);
    if (!exit) continue;
    actor.root.position.set(exit[0], actor.root.position.y, exit[2]);
    if (actor.motion) {
      actor.motion.x = exit[0];
      actor.motion.z = exit[2];
      actor.motion.vx = actor.motion.vz = 0;
      actor.motion.exitTarget = null;
      actor.motion.path = null;
    }
  }
  if (d.constructionGate) d.constructionGate.visible = false;
  return true;
}

// Nearest point clear of the new footprint. A swept exit is reachable in a
// straight walk; otherwise any point open in the navigation grid will do.
function siteExit(d, actor, entries, swept) {
  const p = actor.root.position,
    radius = actor.radius ?? 0.45;
  for (let ring = 1; ring <= 12; ring++)
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8,
        q = [p.x + Math.cos(angle) * ring * 0.5, p.y, p.z + Math.sin(angle) * ring * 0.5];
      if (
        entries.every((o) => footprintDistance(o, q[0], q[2]) >= radius) &&
        (swept ? d.navigation.segment(p.toArray(), q, radius) : d.navigation.clear(q, radius))
      )
        return q;
    }
  return null;
}

// Advances the plot queue by at most one step per call (one per frame from tick):
// prepare the next swap, or apply the active job once its site is clear.
export function tryActivatePlot(d) {
  const work = plotWork(d);
  if (work.active?.kind === 'rebuild') {
    const pending = work.active;
    if (!d.plotVacant(pending)) return false;
    work.active = null;
    timeTown('full-update', () =>
      d.update(
        pending.town,
        pending.labels,
        pending.mineProgress,
        pending.constructionId,
        pending.prepared,
      ),
    );
    if (d.cue) d.cue.visible = false;
    return true;
  }
  const pending = work.active;
  if (!pending) {
    const next = work.queue.shift();
    if (next) {
      try {
        swapPlot(d, next.id, next.town, next.labels, { construction: next.construction });
      } catch (error) {
        console.warn('Incremental plot preparation failed; rebuilding town.', error);
        work.queue = [];
        d.update(next.town, next.labels, d.mineProgress);
      }
    }
    return true;
  }
  const { id, group, previous, movingPart, entries, signature, construction, parts, partKeys } =
    pending;
  if (!d.plotVacant(pending)) return false;
  const started = performance.now();
  work.active = null;
  previous.group.userData.activation = 'removed';
  previous.group.removeFromParent();
  if (previous.movingPart) {
    previous.movingPart.rotor.removeFromParent();
    d.motions = d.motions.filter((m) => m !== previous.movingPart.update);
  }
  group.visible = true;
  group.userData.activation = construction ? 'temporary-reveal' : 'completed';
  if (d.cue) d.cue.visible = false;
  d.targets = d.targets.map((target) => (target === previous.group ? group : target));
  d.plotCache.set(id, { signature, group, movingPart, parts });
  d.navigation.replaceOwner(`plot:${id}`, entries, construction ? 'temporary-reveal' : 'completed');
  // A first opening can extend frontage paving or overhead service wires. Refresh
  // only those scenery roots here instead of leaving them stale until a full rebuild.
  const scenery = refreshScenery(d);
  const actors = walkers(d);
  const view = d,
    generation = d.generation;
  function* repairRoutes() {
    view.itineraries = new TownItineraries(view);
    for (const actor of actors) yield* repairRoute(view, actor);
  }
  d.cancelRouteWork?.();
  d.cancelRouteWork = scheduleWork(repairRoutes(), {
    isCurrent: () => generation === d.generation,
  });
  if (movingPart) attachMovingPart(d, group, movingPart);
  if (construction)
    d.construction = new TownConstruction(d, group, movingPart?.rotor, previous.parts, partKeys);
  // New overhead wires replace every plot's service drop, not just this one.
  d.refreshServiceDrops(scenery.includes('power') ? undefined : id);
  // A finished airport, port or station modernization restyles its vehicle too.
  refreshTransport(d, id, d.town);
  timeTown('activate-statics', () =>
    d.buildingRenderer.sync(d.world.children.filter((child) => child.userData.static)),
  );
  d.clearGroup(previous.group);
  d.frameCache.valid = false;
  timeTown('activate-actors', () => d.rebuildActors());
  d.render();
  recordTownTiming('activate', started, { building: id, construction: !!construction, scenery });
  const reveal = d.construction;
  if (reveal)
    afterPaint(() => {
      if (d.construction === reveal) reveal.presentFirstStrike();
    });
  else d.repairAnimalLife();
  return true;
}

// Replan one walker after a footprint change, if its route now crosses it. People
// keep the clearance their route was planned with: a wider margin rejects the
// narrow bridge lane, and the replan would join its ramps across the water.
// They replan the same route and step back onto it from where they stand, since a
// straight cut from there to the route's second point could also cross the river.
export function* repairRoute(d, actor) {
  // The active break may be a short variant. Repair the full work route
  // so later visits cannot restore a path through the changed footprint.
  const path = actor.workRoutine?.paths[0] ?? actor.walkPath ?? actor.path;
  if (!path?.points.length) return;
  const margin = actor.species
    ? (actor.radius ?? NPC_MARGIN)
    : (path.clearance?.margin ?? actor.radius ?? NPC_MARGIN);
  const intersects = path.points.some(
    (p, i) => i && !d.navigation.segment(path.points[i - 1], p, margin),
  );
  if (!intersects) {
    if (actor.itinerary) yield* d.itineraries.prepare(actor);
    return;
  }
  const position = actor.root.position.toArray();
  const next = path.building
    ? buildingWalk(d, path.building, path.frontage)
    : d.navigation.plan(
        actor.workRoutine || !actor.species
          ? path.points
          : [position, ...path.points.slice(1), position],
        margin,
      );
  if (actor.workRoutine) {
    updateWorkPaths(actor, next);
    actor.routeLimit = actor.direction < 0 ? 0 : next.total;
  } else if (actor.walkPath) actor.walkPath = next;
  else actor.path = next;
  if (actor.motion) actor.motion.path = null;
  if (actor.itinerary) {
    actor.itinerary.anchor = next.points.at(-1);
    d.itineraries.finish(actor, next, next.total);
    yield* d.itineraries.prepare(actor);
  }
  yield;
}

export function plotsPending(d) {
  const work = plotWork(d);
  return !!work.active || work.queue.length > 0;
}

function refreshScenery(d) {
  if (!d.staticScenery) return [];
  const changed = d.staticScenery.update(d, d.town);
  for (const id of changed) {
    if (!sceneryAffectsNavigation(id)) continue;
    const group = d.staticScenery.entries.get(id).group;
    d.navigation?.replaceOwner(`scenery:${id}`, group ? sceneryObstacles(group) : []);
  }
  return changed;
}

export function refreshServiceDrops(d, changedId) {
  const previous = d.serviceDrops;
  d.serviceDrops = addServiceDrops(
    d,
    d.staticScenery?.entries.get('power')?.group,
    new Map(
      [...d.plotCache]
        .filter(([id]) => changedId === undefined || id === changedId)
        .map(([id, { group }]) => [id, group]),
    ),
    changedId === undefined ? null : previous,
  );
  if (previous?.parent) d.clearGroup(previous);
}

function invalidatePresentationWork(d) {
  d.generation = (d.generation ?? 0) + 1;
  d.cancelAnimalWork?.();
  d.cancelLifeWork?.();
  d.cancelFinishWork?.();
  d.cancelRouteWork?.();
}

export function rebuildTown(
  d,
  town,
  labels,
  mineProgress = 0,
  constructionId = null,
  prepared = null,
) {
  d.mineProgress = mineProgress;
  invalidatePresentationWork(d);
  // Store the rendered era separately: the campaign may mutate the same town
  // object before this update. Routes and work positions only survive rebuilds
  // within that era; a new layout gets a fresh ambient population.
  if (d.lifeEra !== undefined && d.lifeEra !== town.era) {
    d.vipArrivals?.reset();
    d.vipArrivals = null;
    d.actors = [];
    d.animals = [];
    d.animalFeeder = null;
    d.animalMotion = null;
    d.animalBehavior = null;
    d.animalSpace = null;
    d.animalNavigation = null;
    d.animalRoutes = null;
    d.animalHabitats = [];
    d.locomotionGrid = null;
    d.locomotionAgents = [];
    d.locomotionVehicles = [];
    d.manualBlockers = [];
  }
  d.lifeEra = town.era;
  d.lifeReady = false;
  // Activation clears its own job first; anything still waiting is superseded.
  plotWork(d).queue = [];
  d.discardPlotWork();
  let adopted = null;
  d.presentation?.dispose(false);
  d.presentation = null;
  const interruptedGroup = d.construction?.group;
  d.construction?.finish();
  d.construction = null;
  const previousParts = d.plotCache?.get(constructionId)?.parts;
  const plots = visiblePlots(town);
  updateTownShadowCoverage(d, plots);
  const previousPlotIds = d.cinematic?.plotIds;
  const reusable = new Map();
  const signatures = d.plotSignatures(town, labels);
  d.topologyState = topologyParts(d, town, labels);
  d.topology = JSON.stringify(d.topologyState);
  d.labels = labels;
  // Keep unchanged plot meshes (and their sign textures) out of world disposal.
  // A reveal needs fresh articulated pieces, including when interrupted by a tap.
  for (const [id, cached] of d.plotCache ?? []) {
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
  d.plotCache = new Map();
  d.retainedVipActors = new Map((d.vipArrivals?.actors ?? []).map((a) => [a.source, a]));
  for (const a of d.retainedVipActors.values()) a.root.removeFromParent();
  d.liveVisitors?.detach();
  d.retainedAnimals = new Map((d.animals ?? []).map((a) => [animalKey(a), a]));
  for (const a of d.retainedAnimals.values()) a.root.removeFromParent();
  d.retainedActors = new Map(
    (d.actors ?? []).filter((a) => a.persistentKey).map((a) => [a.persistentKey, a]),
  );
  for (const actor of d.retainedActors.values()) actor.root.removeFromParent();
  d.actorRenderer.clear();
  d.staticScenery ??= new TownScenery();
  d.staticScenery.detach();
  d.upgradeGlow.clear();
  d.clearGroup(d.world);
  d.world = new THREE.Group();
  d.scene.add(d.world);
  d.actors = [];
  for (const a of d.retainedActors.values()) d.world.add(a.root);
  for (const a of d.retainedAnimals.values()) d.world.add(a.root);
  d.trafficActors = [];
  d.motions = [];
  d.visitorTransports = new Map();
  d.targets = [];
  d.anchors = [];
  d.town = town;
  d.guidedPlot = nextGoal(town)?.id;
  d.staticScenery.update(d, town);
  const mineWorks = d.staticScenery.entries.get('mine-works')?.group;
  if (mineWorks) updateMineGrowth(mineWorks, mineGrowth(mineProgress));
  // City-scale eras (and Motor Age, built on a city shell) need the wider orbit.
  d.controls.maxDistance = plots.some(({ id }) => GARDEN_PARCELS[id])
    ? 360
    : ['city', 'motor-age'].includes(eraEvolution(town.era).style)
      ? 270
      : town.era !== 'frontier'
        ? 160
        : 110;
  for (const {
    id,
    position: [x, z],
  } of plots) {
    const cached = reusable.get(id);
    // A topology-changing reveal already built this plot to check its site.
    const ready = !cached && prepared?.id === id ? prepared : null;
    if (ready) adopted = ready;
    const group = cached?.group ?? ready?.group ?? d.group(d.world, x, 0.08, z);
    if (cached || ready) d.world.add(group);
    group.userData.plot = id;
    if (previousPlotIds && !previousPlotIds.has(id)) {
      group.visible = false;
      group.userData.revealAfterCinematic = true;
    }
    group.userData.static = true;
    d.targets.push(group);
    d.anchors.push({
      id,
      width: id === 'mine' ? 160 : Math.max(76, labels[id].length * 7 + 35),
      position: point(x, 0.2, z + (id === 'mine' ? 1.65 : 1.85)),
    });
    let movingPart = cached?.movingPart ?? ready?.movingPart;
    if (!cached && !ready) movingPart = d.buildPlot(id, group, town, labels);
    const bounds = new THREE.Box3().setFromObject(group);
    if (!cached) {
      const footprint = ready?.footprint ?? d.plotFootprints(id, town, group, false);
      registerFootprints(group, footprint.solids, {
        provisional: footprint.provisional,
        activation: town.projects[id]
          ? 'construction'
          : town.buildings[id] || id === 'mine'
            ? 'completed'
            : 'unbuilt',
      });
    }
    if (id !== 'mine') d.upgradeGlow.add(id, bounds);
    // Keep action icons at the front porch, below the roofline.
    d.anchors.at(-1).collection = point(x, 1, z + 2.2);
    // Keep the windmill rotor articulated while batching the rest of its building.
    if (movingPart) attachMovingPart(d, group, movingPart);
    const partKeys = new Map();
    const parts = cached?.parts ?? constructionParts(group, partKeys);
    if (id === constructionId)
      d.construction = new TownConstruction(d, group, movingPart?.rotor, previousParts, partKeys);
    d.plotCache.set(id, { signature: signatures.get(id), group, movingPart, parts });
  }
  if (prepared && prepared !== adopted) d.clearGroup(prepared.group);
  // Model preparation can be expensive. Start the reveal clock on its first visible frame.
  if (d.construction) {
    d.lastFrame = 0;
    d.pacer?.reset();
  }
  d.refreshServiceDrops();
  d.navigation = townNavigation(d.world);
  d.buildingRenderer.sync(d.world.children.filter((child) => child.userData.static));
  d.renderer.shadowMap.needsUpdate = true;
  if (d.overview) d.frameTown();
  drawNavigation(d);
  performanceMark('geometry-ready');
  performanceMark('navigation-ready');
  d.render();
  const generation = d.generation;
  const populate = () => {
    if (d.disposed || generation !== d.generation) return;
    const work = d.populateLife(town);
    if (d.deferLife)
      d.cancelLifeWork = scheduleWork(work, {
        budget: 8,
        isCurrent: () => generation === d.generation && !d.disposed,
      });
    else finishWork(work);
  };
  if (!d.deferLife) populate();
  afterPaint(() => {
    if (d.disposed || generation !== d.generation) return;
    performanceMark('first-town-frame');
    if (d.deferLife) populate();
    d.construction?.presentFirstStrike();
    d.onFirstFrame?.();
  });
}

export function repairAnimalLife(d) {
  d.retainedAnimals = new Map((d.animals ?? []).map((a) => [animalKey(a), a]));
  if (d.animalMotion) d.motions = d.motions.filter((m) => m !== d.animalMotion);
  addTownAnimals(d, d.town);
}

export function finishConstruction(d) {
  if (!d.construction) return;
  const { group } = d.construction;
  d.construction.finish();
  d.construction = null;
  delete group.userData.animalSolid;
  d.navigation?.replaceOwner(
    `plot:${group.userData.plot}`,
    group.userData.footprints ?? [],
    'completed',
  );
  group.userData.activation = 'completed';
  d.frameCache.valid = false;
  // A pending camera frame already redraws the town this frame; do not render twice.
  if (!d.cameraFrame) timeTown('finish-render', () => d.render());
  const generation = d.generation;
  const view = d;
  // Each yield lets input and frames through. Until the actor rebuild, the finished
  // pieces still draw as instances, so the partial batches are never visible alone.
  function* settle() {
    if (group.parent !== view.world) return;
    yield* timedSteps(
      'settle-statics',
      view.buildingRenderer.syncWork(view.world.children.filter((child) => child.userData.static)),
    );
    yield;
    timeTown('settle-animals', () => view.repairAnimalLife());
    yield;
    timeTown('settle-actors', () => view.rebuildActors());
    view.frameCache.valid = false;
    afterPaint(() => {
      if (generation !== view.generation) return;
      view.renderer.shadowMap.needsUpdate = true;
      timeTown('settle-shadow-render', () => view.render());
    });
  }
  d.cancelFinishWork?.();
  if (typeof requestAnimationFrame === 'undefined') {
    finishWork(settle());
    return;
  }
  d.cancelFinishWork = scheduleWork(settle(), {
    isCurrent: () => generation === d.generation,
  });
}
