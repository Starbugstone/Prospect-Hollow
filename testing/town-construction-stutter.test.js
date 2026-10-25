import { vi as testTiming } from 'vitest';
// Full town rebuilds may exceed the default 5s on CI.
testTiming.setConfig({ testTimeout: 20000 });
import { afterEach, expect, it, vi } from 'vitest';
import { Box3, BufferGeometry, Group, MeshBasicMaterial, Raycaster, Scene } from 'three';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownActors } from '../src/game/town/TownActors';
import { TownStatics } from '../src/game/town/TownStatics';
import { finishWork } from '../src/game/PresentationWork';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';
import { TownFrameCache } from '../src/game/town/TownFrameCache';
import { TownRenderQuality } from '../src/game/town/TownRenderQuality';
import { footprintDistance } from '../src/game/town/BuildingFootprints';
import { PLOTS } from '../src/game/town/TownLayout';
import { timedSteps, townTimings } from '../src/game/town/TownProfiler';
import { BUILDINGS, createTown } from '../src/data/town';
import {
  advanceConstruction,
  buildingIndicators,
  constructionReady,
  finishConstruction,
  purchase,
  upgradeOffer,
} from '../src/game/town/TownRules';

// Issue #54: construction and completion must not repeat synchronous work or
// hide stale scenery, and settlement must yield between geometry steps.
const views = [];
function fixture() {
  const view = Object.create(TownDiorama.prototype);
  view.scene = new Scene();
  view.geometries = createTownGeometries();
  view.materials = new Map();
  view.contactShadowMaterial = new MeshBasicMaterial();
  view.sign = () => {};
  view.elapsed = 0;
  view.controls = {};
  view.renderer = { shadowMap: {} };
  view.frameCache = { valid: false };
  view.render = () => {};
  view.actorRenderer = new TownActors(view.scene);
  view.buildingRenderer = new TownStatics(view.scene);
  view.upgradeGlow = new TownUpgradeGlow(view.scene);
  const town = createTown();
  Object.assign(town.buildings, { home: 2, farm: 3, well: 1 });
  const labels = Object.fromEntries(BUILDINGS.map(({ id, shortName }) => [id, shortName]));
  labels.mine = 'Mine';
  views.push(view);
  return { view, town, labels };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const view of views.splice(0)) {
    view.discardPlotWork();
    view.actorRenderer.dispose();
    view.buildingRenderer.dispose();
    view.upgradeGlow.dispose();
    view.staticScenery?.dispose(view);
    view.clearGroup(view.world);
    Object.values(view.geometries).forEach((geometry) => geometry.dispose());
    view.materials.forEach((material) => material.dispose());
    view.contactShadowMaterial.dispose();
  }
});
const built = (town, changes) => ({ ...town, buildings: { ...town.buildings, ...changes } });

it('builds a topology-changing reveal once and adopts it in the full rebuild', () => {
  const { view, town, labels } = fixture();
  town.buildings.home = 1;
  view.update(town, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  const build = vi.spyOn(view, 'buildPlot');
  const footprints = vi.spyOn(view, 'plotFootprints');
  const updated = built(town, { home: 2 });
  // Home II unlocks new plots, so this completion cannot use the one-plot swap.
  expect(view.topologySignature(updated, labels)).not.toBe(view.topology);
  view.changeTown(updated, labels, 0, 'home');
  const homeBuilds = build.mock.calls.filter(([id]) => id === 'home');
  expect(homeBuilds).toHaveLength(1);
  const prepared = homeBuilds[0][1];
  expect(view.plotCache.get('home').group).toBe(prepared);
  expect(prepared.parent).toBe(view.world);
  expect(view.construction.group).toBe(prepared);
  expect(footprints.mock.calls.filter(([id]) => id === 'home')).toHaveLength(1);
  expect(view.plotWork.active).toBeNull();
  expect(view.plotCache.has('home2')).toBe(true);
  const change = townTimings().entries.findLast(({ name }) => name === 'town-change');
  expect(change.detail).toMatchObject({ path: 'prepared-update', building: 'home' });
  expect(change.detail.topology).toContain('plots');
  view.finishConstruction();
});

it('releases a prepared building when another rebuild supersedes its occupied site', () => {
  const { view, town, labels } = fixture();
  town.buildings.home = 1;
  view.update(town, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(false);
  view.changeTown(built(town, { home: 2 }), labels, 0, 'home');
  const probe = view.plotWork.active.prepared.group;
  const geometry = new BufferGeometry();
  geometry.userData.owned = true;
  probe.children[0].geometry = geometry;
  const dispose = vi.spyOn(geometry, 'dispose');
  view.update(town, labels);
  expect(view.plotWork.active).toBeNull();
  expect(dispose).toHaveBeenCalledOnce();
  expect(probe.parent).toBeNull();
});

it('settles a finished building in steps and changes the scene only when committing', () => {
  const { view } = fixture();
  const group = new Group();
  view.box(group, 1, 1, 1, 0, 0.5, 0, '#aa8855');
  view.box(group, 1, 1, 1, 1, 0.5, 0, '#aa8855');
  view.box(group, 1, 1, 1, 0, 1.5, 0, '#335577');
  const originals = [...group.children];
  const work = view.batchWork(group);
  let steps = 0;
  while (!work.next().done) {
    steps++;
    expect(group.children).toEqual(originals);
  }
  // Three clones and two material merges each yield before the final commit.
  expect(steps).toBe(5);
  expect(group.children).toHaveLength(2);
  expect(group.children.every((mesh) => mesh.geometry.userData.owned)).toBe(true);
  view.clearGroup(group);

  const interrupted = new Group();
  view.box(interrupted, 1, 1, 1, 0, 0.5, 0, '#aa8855');
  view.box(interrupted, 1, 1, 1, 1, 0.5, 0, '#aa8855');
  const kept = [...interrupted.children];
  const dispose = vi.spyOn(BufferGeometry.prototype, 'dispose');
  const cancelled = view.batchWork(interrupted);
  cancelled.next();
  cancelled.next();
  cancelled.return();
  expect(interrupted.children).toEqual(kept);
  expect(dispose).toHaveBeenCalledTimes(2);
});

it('prepares static batches without moving source meshes until the batch is placed', () => {
  const { view } = fixture();
  const statics = view.buildingRenderer;
  const root = new Group();
  view.box(root, 1, 1, 1, 0, 0.5, 0, '#aa8855');
  view.box(root, 1, 1, 1, 1, 0.5, 0, '#335577');
  const work = statics.syncWork([root]);
  work.next();
  expect(root.children.every((mesh) => mesh.layers.mask === 1)).toBe(true);
  expect(statics.batches.size).toBe(0);
  const cancelled = statics.syncWork([root]);
  cancelled.next();
  cancelled.return();
  expect(statics.meshes).toHaveLength(0);
  finishWork(work);
  // Placed sources move to the picking layer inside one hidden group the renderer skips.
  const hidden = root.userData.batchedSources;
  expect(root.children).toEqual([hidden]);
  expect(hidden.visible).toBe(false);
  expect(hidden.children.every((mesh) => mesh.layers.mask === 2)).toBe(true);
  expect(statics.batches.get(root).parent).toBe(view.scene);
  expect(statics.meshes).toHaveLength(1);
});

// A villager boxed in on a finished building's site (or held by a crowd) used to
// hold its swap forever. Every later build queued behind it, so no reveal played,
// scaffolding stayed up and the construction cue hammer never went away.
it('moves a villager who cannot leave a finished building site so the reveal still plays', () => {
  const { view, town, labels } = fixture();
  view.update(town, labels);
  const [x, z] = PLOTS.home;
  const stuck = { root: new Group(), radius: 0.45 };
  stuck.root.position.set(x, 0.08, z);
  Object.assign(view, { actors: [stuck], animals: [], vipArrivals: null });
  view.drawFrame = () => true;
  view.beginConstructionCue('home');
  view.changeTown(built(town, { home: 3 }), labels, 0, 'home');
  expect(view.plotWork.active?.id).toBe('home');
  expect(view.cue.visible).toBe(true);
  // Locomotion never runs here, so the villager stays put, as when blocked.
  view.elapsed = 1;
  expect(view.tryActivatePlot()).toBe(false);
  expect(view.construction).toBeFalsy();
  view.elapsed = 2.5;
  expect(view.tryActivatePlot()).toBe(true);
  expect(view.plotWork.active).toBeNull();
  expect(view.construction.group.userData.plot).toBe('home');
  expect(view.cue.visible).toBe(false);
  expect(view.constructionGate.visible).toBe(false);
  const { x: px, z: pz } = stuck.root.position;
  const site = view.construction.group.userData.footprints;
  expect(site.length).toBeGreaterThan(0);
  expect(site.every((o) => footprintDistance(o, px, pz) >= stuck.radius - 1e-6)).toBe(true);
  view.finishConstruction();
});

// The build list stays open over a paused town: its builds must not wait on the
// site or play a reveal, they swap the building straight away.
it('swaps a build from the list at once, moving anyone on the site and skipping the reveal', () => {
  const { view, town, labels } = fixture();
  view.update(town, labels);
  const [x, z] = PLOTS.home;
  const stuck = { root: new Group(), radius: 0.45 };
  stuck.root.position.set(x, 0.08, z);
  Object.assign(view, { actors: [stuck], animals: [], vipArrivals: null });
  const updated = built(town, { home: 3 });
  view.changeTown(updated, labels, 0, 'home', { instant: true });
  expect(view.plotsPending()).toBe(false);
  expect(view.construction).toBeFalsy();
  expect(view.constructionGate?.visible).toBeFalsy();
  const group = view.plotCache.get('home').group;
  expect(group.visible).toBe(true);
  expect(group.userData.activation).toBe('completed');
  expect(changedPlots(view, updated, labels)).toEqual([]);
  const { x: px, z: pz } = stuck.root.position;
  const site = group.userData.footprints;
  expect(site.length).toBeGreaterThan(0);
  expect(site.every((o) => footprintDistance(o, px, pz) >= stuck.radius - 1e-6)).toBe(true);
});

it('rebuilds a topology-changing build from the list at once without a reveal', () => {
  const { view, town, labels } = fixture();
  town.buildings.home = 1;
  view.update(town, labels);
  const updated = built(town, { home: 2 });
  expect(view.topologySignature(updated, labels)).not.toBe(view.topology);
  view.changeTown(updated, labels, 0, 'home', { instant: true });
  expect(view.plotWork.active).toBeNull();
  expect(view.construction).toBeFalsy();
  expect(view.plotCache.has('home2')).toBe(true);
  expect(view.topology).toBe(view.topologySignature(updated, labels));
});

it('retires the construction cue when the finished building is already shown', () => {
  const { view, town, labels } = fixture();
  view.update(town, labels);
  view.drawFrame = () => true;
  view.beginConstructionCue('home');
  view.changeTown(town, labels, 0, 'home');
  expect(view.cue.visible).toBe(false);
});

it('skips the immediate completion render when a camera frame will draw it', () => {
  const { view, town, labels } = fixture();
  view.update(town, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  view.changeTown(built(town, { home: 3 }), labels, 0, 'home');
  const group = view.construction.group;
  const render = vi.spyOn(view, 'render');
  view.cameraFrame = 1;
  view.finishConstruction();
  expect(render).not.toHaveBeenCalled();
  expect(view.buildingRenderer.batches.get(group)).toBeTruthy();
  view.changeTown(built(town, { home: 4 }), labels, 0, 'home');
  render.mockClear();
  view.cameraFrame = 0;
  view.finishConstruction();
  expect(render).toHaveBeenCalledOnce();
});

it('refreshes frontage roads when a first opening keeps the town layout', () => {
  const { view, town, labels } = fixture();
  // Development 12 reaches road level 2, where every built plot gets frontage paving.
  Object.assign(town.buildings, { saloon: 3, blacksmith: 3 });
  view.update(town, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  const roads = view.staticScenery.entries.get('roads').group;
  const update = vi.spyOn(view, 'update');
  view.changeTown(built(town, { sheriff: 1 }), labels, 0, 'sheriff');
  expect(update).not.toHaveBeenCalled();
  const refreshed = view.staticScenery.entries.get('roads').group;
  expect(refreshed).not.toBe(roads);
  expect(roads.parent).toBeNull();
  expect(refreshed.parent).toBe(view.world);
  expect(view.buildingRenderer.batches.has(refreshed)).toBe(true);
  expect(view.buildingRenderer.batches.has(roads)).toBe(false);
  view.finishConstruction();
});

it('keeps early roads when a first opening does not change them', () => {
  const { view, town, labels } = fixture();
  view.update(town, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  const roads = view.staticScenery.entries.get('roads').group;
  view.changeTown(built(town, { sheriff: 1 }), labels, 0, 'sheriff');
  expect(view.staticScenery.entries.get('roads').group).toBe(roads);
  view.finishConstruction();
});

it('extends overhead wires, their navigation and every service drop on a first opening', () => {
  const { view, town, labels } = fixture();
  town.era = 'industrial';
  Object.assign(town.buildings, { powerHouse: 1, saloon: 1 });
  view.update(town, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  const power = view.staticScenery.entries.get('power').group;
  const drops = view.serviceDrops;
  expect(view.navigation.obstacles.some((o) => o.owner === 'scenery:power')).toBe(true);
  view.changeTown(built(town, { sheriff: 1 }), labels, 0, 'sheriff');
  const extended = view.staticScenery.entries.get('power').group;
  expect(extended).not.toBe(power);
  expect(view.serviceDrops).not.toBe(drops);
  expect(view.serviceDrops.getObjectByName('Service drop sheriff')).toBeTruthy();
  const poles = view.navigation.obstacles.filter((o) => o.owner === 'scenery:power');
  expect(poles.length).toBe(extended.userData.walkObstacles.length);
  const connected = new Set(extended.userData.connections.map(({ id }) => id));
  expect(connected.has('sheriff')).toBe(true);
  view.finishConstruction();
});

it('lowers cached-frame MSAA with the render tier and recreates the target', () => {
  const quality = new TownRenderQuality(2, 'high');
  expect(quality.cacheSamples).toBe(4);
  for (let i = 0; i < 400; i++) quality.sample(80);
  expect(quality.tier).toBe('low');
  expect(quality.cacheSamples).toBe(0);
  const cache = new TownFrameCache({}, 4);
  const dispose = vi.spyOn(cache.target, 'dispose');
  cache.valid = cache.targetValidated = true;
  cache.setSamples(4);
  expect(dispose).not.toHaveBeenCalled();
  cache.setSamples(quality.cacheSamples);
  expect(cache.target.samples).toBe(0);
  expect(dispose).toHaveBeenCalledOnce();
  expect(cache.valid).toBe(false);
  expect(cache.targetValidated).toBe(false);
  cache.dispose();
});

it('records scheduled work as one entry with its longest step, even when cancelled', () => {
  townTimings({ clear: true });
  function* work() {
    yield;
    yield;
  }
  const steps = timedSteps('example', work());
  steps.next();
  steps.next();
  steps.return();
  const [entry] = townTimings({ clear: true }).entries;
  expect(entry).toMatchObject({ name: 'example', detail: { steps: 2 } });
  expect(entry.detail.longest).toBeLessThanOrEqual(entry.ms);
});

// Returning from the mine advances every project at once. Several changed plots used
// to force a full rebuild (all villagers and animals re-planned); they now swap one
// per frame through the incremental path.
function withProjects(town) {
  town.coins = 1e6;
  let next = town;
  for (const { id } of BUILDINGS) {
    if (Object.keys(next.projects).length >= 3) break;
    if (upgradeOffer(next, id)?.available) next = purchase(next, id, next.buildings[id]) ?? next;
  }
  return next;
}
const changedPlots = (view, town, labels) =>
  [...view.plotSignatures(town, labels)]
    .filter(([id, signature]) => view.plotCache.get(id)?.signature !== signature)
    .map(([id]) => id);

it('swaps every advancing project one per frame instead of rebuilding the town', () => {
  const { view, town, labels } = fixture();
  const started = withProjects(town);
  view.update(started, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  const update = vi.spyOn(view, 'update');
  const returned = advanceConstruction(started);
  const changed = changedPlots(view, returned, labels);
  expect(changed.length).toBeGreaterThan(1);
  view.changeTown(returned, labels, 0);
  // Nothing is rebuilt during the return itself; the current town stays on screen.
  expect(view.plotWork.queue.map(({ id }) => id)).toEqual(changed);
  expect(view.plotsPending()).toBe(true);
  for (let frame = 0; frame < changed.length; frame++) view.tryActivatePlot();
  expect(view.plotsPending()).toBe(false);
  expect(update).not.toHaveBeenCalled();
  expect(changedPlots(view, returned, labels)).toEqual([]);
  const change = townTimings().entries.findLast(({ name }) => name === 'town-change');
  expect(change.detail).toMatchObject({ path: 'swap', plots: changed });
});

it('reveals the finished building after the other changed plots swap silently', () => {
  const { view, town, labels } = fixture();
  const started = withProjects(town);
  // Every project is ready; the player finishes one whose opening keeps the layout.
  const ready = {
    ...started,
    projects: Object.fromEntries(
      Object.entries(started.projects).map(([id, project]) => [id, { ...project, wins: 1 }]),
    ),
  };
  view.update(ready, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  const choices = Object.keys(ready.projects).map((id) => [
    id,
    finishConstruction(ready, id, ready.projects[id].stage),
  ]);
  const [readyId, finished] = choices.find(
    ([, next]) => next && view.topologySignature(next, labels) === view.topology,
  );
  expect(constructionReady(ready.projects[readyId])).toBe(true);
  // Another plot changes at the same moment as the finished building.
  const other = Object.keys(ready.projects).find((id) => id !== readyId);
  const both = { ...finished, projects: { ...finished.projects } };
  delete both.projects[other];
  const changed = changedPlots(view, both, labels);
  expect(changed).toEqual(expect.arrayContaining([readyId, other]));
  view.changeTown(both, labels, 0, readyId);
  expect(view.plotWork.queue.at(-1)).toMatchObject({ id: readyId, construction: true });
  expect(view.plotWork.queue.slice(0, -1).every(({ construction }) => !construction)).toBe(true);
  for (let frame = 0; frame < changed.length; frame++) view.tryActivatePlot();
  expect(view.construction.group).toBe(view.plotCache.get(readyId).group);
  view.finishConstruction();
});

it('swaps every changed plot at once for a build from the list', () => {
  const { view, town, labels } = fixture();
  const started = withProjects(town);
  view.update(started, labels);
  const update = vi.spyOn(view, 'update');
  const returned = advanceConstruction(started);
  expect(changedPlots(view, returned, labels).length).toBeGreaterThan(1);
  view.changeTown(returned, labels, 0, null, { instant: true });
  expect(view.plotsPending()).toBe(false);
  expect(update).not.toHaveBeenCalled();
  expect(changedPlots(view, returned, labels)).toEqual([]);
});

it('lets a newer town change replace plots still waiting from the previous one', () => {
  const { view, town, labels } = fixture();
  const started = withProjects(town);
  view.update(started, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  view.changeTown(advanceConstruction(started), labels, 0);
  expect(view.plotWork.queue.length).toBeGreaterThan(1);
  view.update(started, labels);
  expect(view.plotsPending()).toBe(false);
});

it('checks building purchases once per town, not on every collection-clock tick', () => {
  const town = withProjects(createTown());
  const indicators = buildingIndicators(town, true, 0);
  expect(buildingIndicators(town, true, 0, [])).not.toHaveProperty(
    Object.keys(indicators).find((id) => indicators[id] === 'upgrade') ?? 'none',
  );
  expect(buildingIndicators(town, true, 0, undefined)).toEqual(indicators);
});

// The full rebuild and the in-place swap share one rotor attachment. The swap used to
// skip the rotor's animal bounds, so birds could fly through windmill sails after an
// upgrade until the next full rebuild.
it('gives a swapped plot the same rotor attachment as a full rebuild', () => {
  const { view, town, labels } = fixture();
  town.coins = 1e6;
  view.update(town, labels);
  const original = view.plotCache.get('farm').movingPart.rotor;
  expect(original.userData.animalSolid).toBeTruthy();
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  const update = vi.spyOn(view, 'update');
  // Same layout, different farm model: the farm alone swaps in place.
  const modernized = { ...town, buildingEraLevels: { ...town.buildingEraLevels, farm: 2 } };
  view.changeTown(modernized, labels, 0);
  view.tryActivatePlot();
  expect(update).not.toHaveBeenCalled();
  const { movingPart } = view.plotCache.get('farm');
  expect(movingPart.rotor).not.toBe(original);
  expect(movingPart.rotor.parent).toBe(view.world);
  expect(movingPart.rotor.userData.animated).toBe(true);
  expect(movingPart.rotor.userData.animalSolid?.isBox3).toBe(true);
  expect(view.motions).toContain(movingPart.update);
  expect(view.motions.filter((motion) => motion === movingPart.update)).toHaveLength(1);
});

// A layout-changing completion builds its new roads, wires and lamps ahead in idle
// slices; the full rebuild adopts those roots instead of building them in its frame.
it('adopts layout scenery prepared ahead, the same as building it in the rebuild', () => {
  const { view, town, labels } = fixture();
  view.update(town, labels);
  // Development 12 raises the road level: frontage paving follows every built plot.
  const next = built(town, { home: 3, farm: 3, well: 3, saloon: 3, shop: 2 });
  const fresh = fixture();
  fresh.view.update(next, fresh.labels);
  const prepared = new Map();
  finishWork(view.staticScenery.prepare(view, next, prepared));
  expect(prepared.has('roads')).toBe(true);
  const roads = prepared.get('roads').group;
  expect(roads.parent).toBeNull();
  expect(view.town).toBe(town);
  const build = vi.spyOn(view, 'batch');
  view.update(next, labels, 0, null, { scenery: prepared });
  expect(view.staticScenery.entries.get('roads').group).toBe(roads);
  expect(roads.parent).toBe(view.world);
  expect(prepared.size).toBe(0);
  const vertices = (group) => {
    let count = 0;
    group.traverse((object) => (count += object.geometry?.attributes.position.count ?? 0));
    return count;
  };
  expect(vertices(roads)).toBe(vertices(fresh.view.staticScenery.entries.get('roads').group));
  // The rebuild drew no second road root of its own.
  expect(build.mock.calls.some(([group]) => group.name === roads.name)).toBe(false);
});

// In a browser the preparation runs in idle slices (here the scheduler's fallback).
const browserFrames = () =>
  vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(() => callback(0), 0));
it('waits for prepared scenery before a layout-changing reveal rebuilds the town', async () => {
  browserFrames();
  const { view, town, labels } = fixture();
  town.buildings.home = 1;
  view.update(town, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  const updated = built(town, { home: 2 });
  view.changeTown(updated, labels, 0, 'home');
  const pending = view.plotWork.active;
  expect(pending.kind).toBe('rebuild');
  expect(view.tryActivatePlot()).toBe(false);
  await vi.waitFor(() => expect(pending.preparing).toBe(false));
  const prepared = [...pending.prepared.scenery.values()].map(({ group }) => group);
  expect(view.tryActivatePlot()).toBe(true);
  for (const group of prepared.filter(Boolean)) expect(group.parent).toBe(view.world);
  expect(view.plotCache.get('home').group).toBe(pending.prepared.group);
  view.finishConstruction();
});

it('releases scenery prepared for a superseded layout change', async () => {
  browserFrames();
  const { view, town, labels } = fixture();
  town.buildings.home = 1;
  view.update(town, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  view.changeTown(built(town, { home: 2 }), labels, 0, 'home');
  const pending = view.plotWork.active;
  await vi.waitFor(() => expect(pending.preparing).toBe(false));
  const groups = [...pending.prepared.scenery.values()].map(({ group }) => group).filter(Boolean);
  view.update(town, labels);
  expect(pending.prepared.scenery.size).toBe(0);
  for (const group of groups) expect(group.parent).toBeNull();
});

// Plays one layout-changing completion under overhead wires, optionally without the
// service drops prepared ahead.
async function wiredCompletion({ unprepared = false } = {}) {
  browserFrames();
  const { view, town, labels } = fixture();
  town.era = 'industrial';
  Object.assign(town.buildings, { powerHouse: 1, saloon: 1, home: 1 });
  view.update(town, labels);
  vi.spyOn(view, 'plotVacant').mockReturnValue(true);
  // Home II unlocks more plots: a layout change with a full rebuild.
  view.changeTown(built(town, { home: 2 }), labels, 0, 'home');
  const pending = view.plotWork.active;
  expect(pending.kind).toBe('rebuild');
  await vi.waitFor(() => expect(pending.preparing).toBe(false));
  const prepared = pending.prepared.drops;
  // A grid the rebuild does not show makes it probe every drop, as before.
  if (unprepared) prepared.grid = new Group();
  return { view, pending, prepared };
}
const dropBounds = (drops) =>
  drops.children.map((drop) => {
    const box = new Box3().setFromObject(drop, true);
    return [drop.name, [...box.min.toArray(), ...box.max.toArray()]];
  });
it('keeps service drops prepared ahead for the same grid and plots, and probes the rest', async () => {
  const expected = await wiredCompletion({ unprepared: true });
  expect(expected.view.tryActivatePlot()).toBe(true);
  expected.view.finishConstruction();
  vi.restoreAllMocks();
  const { view, pending, prepared } = await wiredCompletion();
  expect(prepared.groups.has('home')).toBe(false);
  const drops = new Map(prepared.root.children.map((drop) => [drop.name, drop]));
  expect(drops.size).toBeGreaterThan(1);
  const rays = vi.spyOn(Raycaster.prototype, 'intersectObject');
  expect(view.tryActivatePlot()).toBe(true);
  const home = view.plotCache.get('home').group;
  // Kept plots keep their prepared drops; only the revealed building is probed again.
  for (const [name, drop] of drops) expect(view.serviceDrops.getObjectByName(name)).toBe(drop);
  expect(view.serviceDrops.getObjectByName('Service drop home')).toBeTruthy();
  expect(rays.mock.calls.every(([target]) => target === home)).toBe(true);
  expect(pending.prepared.drops).toBeNull();
  // The same drops, in the same order, as a rebuild that probes them all.
  expect(dropBounds(view.serviceDrops)).toEqual(dropBounds(expected.view.serviceDrops));
  view.finishConstruction();
});
