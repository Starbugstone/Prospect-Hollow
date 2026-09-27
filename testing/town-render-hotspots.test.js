import { vi as testTiming } from 'vitest';
// Full town rebuilds may exceed the default 5s on CI.
testTiming.setConfig({ testTimeout: 20000 });
import { afterEach, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Scene } from 'three';
import { TownNavigation } from '../src/game/town/TownNavigation';
import { TownStatics, freezeStatic } from '../src/game/town/TownStatics';
import { labelLayout, placeLabels, trackElement, updateLabels } from '../src/game/town/TownLabels';
import { drawCameraInset } from '../src/game/town/TownInset';
import { frameEnd, frameStart, frameValue, townFrameStats } from '../src/game/town/TownProfiler';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownActors } from '../src/game/town/TownActors';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';
import { BUILDINGS, createTown } from '../src/data/town';

// Rendering review after #54: static matrices, incremental navigation, service-drop
// batching, label updates and phone-readable frame statistics.
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const pole = (x, z, radius = 0.4, owner) => ({ x, z, y: 0, height: 3, radius, owner });
const cellsOf = (nav) =>
  [...nav.cells]
    .filter(([, list]) => list.length)
    .map(([key, list]) => [key, list.map((o) => `${o.owner}:${o.x},${o.z}`)])
    .sort(([a], [b]) => a - b);

it('keeps an incremental navigation index identical to a full rebuild', () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const nav = new TownNavigation(
    Array.from({ length: 40 }, (_, i) =>
      pole(random() * 60 - 30, random() * 60 - 30, 0.3, `o${i % 8}`),
    ),
  );
  for (let step = 0; step < 30; step++) {
    const owner = `o${Math.floor(random() * 10)}`;
    const entries = Array.from({ length: Math.floor(random() * 4) }, () =>
      pole(random() * 60 - 30, random() * 60 - 30, 0.2 + random()),
    );
    nav.replaceOwner(owner, entries, random() < 0.2 ? 'removed' : 'completed');
    const full = new TownNavigation([...nav.obstacles]);
    expect(cellsOf(nav)).toEqual(cellsOf(full));
    for (let probe = 0; probe < 5; probe++) {
      const a = [random() * 60 - 30, 0.07, random() * 60 - 30],
        b = [random() * 60 - 30, 0.07, random() * 60 - 30];
      expect(nav.segment(a, b)).toBe(full.segment(a, b));
    }
  }
});

it('re-plans only detours near a changed footprint', () => {
  const nav = new TownNavigation([pole(0, 0, 1, 'plot:near'), pole(40, 0, 1, 'plot:far')]);
  const near = [
    [-4, 0.07, 0],
    [4, 0.07, 0],
  ];
  const far = [
    [36, 0.07, 0],
    [44, 0.07, 0],
  ];
  nav.plan(near);
  nav.plan(far);
  const revision = nav.revision;
  nav.replaceOwner('plot:near', [pole(0, 0.5, 1.2)]);
  expect(nav.revision).toBe(revision + 1);
  const searches = vi.spyOn(nav, 'nearbySegment');
  nav.plan(far);
  // The far detour is still cached; only endpoint checks run.
  expect(searches).not.toHaveBeenCalled();
  const replanned = nav.plan(near);
  expect(searches).toHaveBeenCalled();
  expect(replanned.points.every((p, i) => !i || nav.segment(replanned.points[i - 1], p))).toBe(
    true,
  );
});

it('completes a reveal without re-indexing unchanged footprints', () => {
  const nav = new TownNavigation();
  const entries = [pole(2, 2, 1)];
  nav.replaceOwner('plot:home', entries, 'temporary-reveal');
  const [obstacle] = nav.obstacles;
  const revision = nav.revision;
  const index = vi.spyOn(nav, 'index');
  expect(nav.replaceOwner('plot:home', entries, 'completed')).toEqual([]);
  expect(nav.revision).toBe(revision);
  expect(index).not.toHaveBeenCalled();
  expect(nav.obstacles).toEqual([obstacle]);
  expect(obstacle.activation).toBe('completed');
  nav.replaceOwner('plot:home', [pole(2, 2, 1.5)]);
  expect(nav.revision).toBe(revision + 1);
});

it('freezes batched static roots but keeps animated parts updating', () => {
  const scene = new Scene(),
    root = new Group(),
    geometry = new BoxGeometry(),
    material = new MeshStandardMaterial();
  root.position.set(3, 0, 1);
  const wall = new Mesh(geometry, material),
    wheel = new Group(),
    spoke = new Mesh(geometry, material);
  wheel.userData.animated = true;
  wheel.add(spoke);
  root.add(wall, wheel);
  scene.add(root);
  const statics = new TownStatics(scene);
  statics.sync([root]);
  expect(root.matrixAutoUpdate).toBe(false);
  expect(wall.matrixWorldAutoUpdate).toBe(false);
  expect(wall.matrixWorld.elements[12]).toBe(3);
  expect(wheel.matrixAutoUpdate).toBe(true);
  expect(spoke.matrixAutoUpdate).toBe(true);
  wheel.position.x = 2;
  scene.updateMatrixWorld();
  expect(spoke.matrixWorld.elements[12]).toBe(5);
  expect(wall.matrixWorld.elements[12]).toBe(3);
  statics.dispose();
  geometry.dispose();
  material.dispose();
});

it('re-merges a replaced drop container without preparing retained drops again', () => {
  const scene = new Scene(),
    geometry = new BoxGeometry(),
    material = new MeshStandardMaterial();
  const drop = (x) => {
    const group = new Group();
    const mesh = new Mesh(geometry, material);
    mesh.position.x = x;
    group.add(mesh);
    return group;
  };
  const container = () => {
    const root = new Group();
    root.userData.static = root.userData.staticContainer = true;
    scene.add(root);
    return root;
  };
  const first = container(),
    kept = drop(0),
    replaced = drop(2);
  first.add(kept, replaced);
  const statics = new TownStatics(scene);
  statics.sync([first]);
  const keptPiece = statics.pieces.get(kept),
    replacedPiece = statics.pieces.get(replaced);
  const released = vi.spyOn(replacedPiece.geometry, 'dispose');
  const second = container(),
    added = drop(4);
  second.add(kept, added);
  first.removeFromParent();
  const clone = vi.spyOn(BoxGeometry.prototype, 'clone');
  statics.sync([second]);
  expect(clone).toHaveBeenCalledOnce();
  expect(statics.pieces.get(kept)).toBe(keptPiece);
  expect(statics.pieces.has(replaced)).toBe(false);
  expect(released).toHaveBeenCalledOnce();
  const batch = statics.batches.get(second);
  expect(batch.geometry.getAttribute('position').count).toBe(
    2 * geometry.getAttribute('position').count,
  );
  statics.dispose();
  expect(statics.pieces.size).toBe(0);
  geometry.dispose();
  material.dispose();
});

it('moves labels in place and re-renders only when their layout changes', () => {
  const anchor = (id, x, visible = true) => ({
    id,
    x,
    y: 10,
    visible,
    collection: { x: x + 1, y: 12, visible: false },
  });
  const current = [anchor('home', 10), anchor('mine', 20)];
  const layout = labelLayout(current);
  const style = () => ({ style: {} });
  const labels = new Map(),
    actions = new Map();
  trackElement(labels, 'home', style());
  trackElement(actions, 'home', style());
  expect(updateLabels(current, [anchor('home', 30), anchor('mine', 40)], layout)).toBeNull();
  expect(current[0].x).toBe(30);
  placeLabels(current, labels, actions);
  expect(labels.get('home').style).toEqual({ left: '30%', top: '10%' });
  expect(actions.get('home').style).toEqual({ left: '31%', top: '12%' });
  const hidden = [anchor('home', 30, false), anchor('mine', 40)];
  expect(updateLabels(current, hidden, layout)).toBe(labelLayout(hidden));
  trackElement(labels, 'home', null);
  expect(labels.has('home')).toBe(false);
});

it('updates a following VIP name tag only when it visibly moves', () => {
  const renderer = {
    getViewport: () => {},
    getScissor: () => {},
    getScissorTest: () => false,
    setViewport: () => {},
    setScissor: () => {},
    setScissorTest: () => {},
    render: () => {},
  };
  const d = { renderer, scene: new Scene(), onEventInset: vi.fn() };
  const shot = { insetCamera: {}, viewport: {}, scissor: {} };
  const rect = { x: 0, y: 0, width: 100, height: 80 };
  const draw = (x) =>
    drawCameraInset(d, shot, rect, 'VIP visitor arriving', true, {
      nameTag: { name: 'Ada', x, y: 40 },
    });
  draw(50);
  draw(50.1);
  draw(50.2);
  expect(d.onEventInset).toHaveBeenCalledOnce();
  draw(51);
  expect(d.onEventInset).toHaveBeenCalledTimes(2);
});

it('reports per-frame phases, values and context only while collecting', async () => {
  vi.useFakeTimers();
  frameEnd('tick', frameStart());
  const stats = townFrameStats(1);
  for (let frame = 0; frame < 10; frame++) {
    const started = frameStart();
    expect(started).not.toBeNull();
    vi.advanceTimersByTime(16);
    frameEnd('tick', started);
    frameValue('static-draw-calls', 100 + frame);
  }
  await expect(townFrameStats(1)).rejects.toThrow('already collecting');
  vi.advanceTimersByTime(1000);
  const result = await stats;
  expect(result.phases.tick.count).toBe(10);
  expect(result.phases.tick.mean).toBeGreaterThanOrEqual(16);
  expect(result.values['static-draw-calls']).toMatchObject({ max: 109, last: 109 });
  expect(result.frames.count).toBeGreaterThan(0);
  expect(frameStart()).toBeNull();
});

it('freezes a whole town, keeps every plot pickable and updates only live actors', () => {
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
  town.era = 'industrial';
  Object.assign(town.buildings, { home: 2, farm: 3, well: 1, powerHouse: 1, saloon: 1 });
  const labels = Object.fromEntries(BUILDINGS.map(({ id, shortName }) => [id, shortName]));
  labels.mine = 'Mine';
  try {
    view.update(town, labels);
    let frozen = 0,
      live = 0;
    view.world.traverse((node) => {
      let animated = false;
      for (let p = node; p; p = p.parent) if (p.userData.animated) animated = true;
      if (animated) expect(node.matrixAutoUpdate).toBe(true);
      else if (!node.matrixAutoUpdate) frozen++;
      else live++;
    });
    expect(frozen).toBeGreaterThan(live);
    // Every plot keeps its world placement for tap picking after freezing.
    for (const [id, { group }] of view.plotCache) {
      const placed = group.matrixWorld.elements;
      expect([placed[12], placed[14]], id).toEqual([group.position.x, group.position.z]);
    }
  } finally {
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
