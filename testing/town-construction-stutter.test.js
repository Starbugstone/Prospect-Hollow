import { vi as testTiming } from 'vitest';
// Full town rebuilds may exceed the default 5s on CI.
testTiming.setConfig({ testTimeout: 20000 });
import { afterEach, expect, it, vi } from 'vitest';
import { BufferGeometry, Group, MeshBasicMaterial, Scene } from 'three';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownActors } from '../src/game/town/TownActors';
import { TownStatics } from '../src/game/town/TownStatics';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';
import { TownFrameCache } from '../src/game/town/TownFrameCache';
import { TownRenderQuality } from '../src/game/town/TownRenderQuality';
import { timedSteps, townTimings } from '../src/game/town/TownProfiler';
import { BUILDINGS, createTown } from '../src/data/town';

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
  for (const view of views.splice(0)) {
    view.discardPendingUpdate();
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
  expect(view.pendingUpdate).toBeNull();
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
  const probe = view.pendingUpdate.prepared.group;
  const geometry = new BufferGeometry();
  geometry.userData.owned = true;
  probe.children[0].geometry = geometry;
  const dispose = vi.spyOn(geometry, 'dispose');
  view.update(town, labels);
  expect(view.pendingUpdate).toBeNull();
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
  while (!work.next().done) {}
  expect(root.children.every((mesh) => mesh.layers.mask === 2)).toBe(true);
  expect(statics.batches.get(root).parent).toBe(view.scene);
  expect(statics.meshes).toHaveLength(1);
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
