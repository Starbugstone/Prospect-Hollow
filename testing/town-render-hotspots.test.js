import { vi as testTiming } from 'vitest';
// Full town rebuilds may exceed the default 5s on CI.
testTiming.setConfig({ testTimeout: 20000 });
import { afterEach, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Scene,
} from 'three';
import { MILLRACE, landscapeGeometry } from '../src/game/town/TownMillrace';
import { TOWN_EDGE } from '../src/game/town/TownAtmosphere';
import { MINE_SHAFT } from '../src/data/mineSite';
import { TownNavigation } from '../src/game/town/TownNavigation';
import { TownStatics } from '../src/game/town/TownStatics';
import {
  labelBox,
  labelLayout,
  placeLabels,
  sameIndicators,
  trackElement,
  updateLabels,
} from '../src/game/town/TownLabels';
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
    // Like the real service drops (built with d.rod), each wire casts a shadow.
    mesh.castShadow = true;
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
  const box = labelBox();
  box.measure({ clientWidth: 200, clientHeight: 100 });
  placeLabels(current, labels, actions, box);
  // Composited pixel offsets: moving a label never lays out the page.
  expect(labels.get('home').style).toEqual({ translate: '60px 10px' });
  expect(actions.get('home').style).toEqual({ translate: '62px 12px' });
  const hidden = [anchor('home', 30, false), anchor('mine', 40)];
  expect(updateLabels(current, hidden, layout)).toBe(labelLayout(hidden));
  trackElement(labels, 'home', null);
  expect(labels.has('home')).toBe(false);
});

it('keeps unchanged building indicators as the same object', () => {
  expect(
    sameIndicators({ home: 'upgrade', saloon: 'coins' }, { saloon: 'coins', home: 'upgrade' }),
  ).toBe(true);
  expect(sameIndicators({ home: 'upgrade' }, { home: 'ready' })).toBe(false);
  expect(sameIndicators({ home: 'upgrade' }, { home: 'upgrade', mine: 'era' })).toBe(false);
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

it('redraws the inset scene at 30 Hz below the high render tier and every frame on it', () => {
  const renders = [];
  const renderer = {
    getViewport: () => {},
    getScissor: () => {},
    getScissorTest: () => false,
    setViewport: () => {},
    setScissor: () => {},
    setScissorTest: () => {},
    getPixelRatio: () => 1,
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    render: (scene) => renders.push(scene),
  };
  const scene = new Scene();
  const d = { renderer, scene, onEventInset: vi.fn(), renderQuality: { tier: 'medium' } };
  const shot = { insetCamera: {}, viewport: {}, scissor: {} };
  const rect = { x: 0, y: 0, width: 100, height: 80 };
  let now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  for (let frame = 0; frame < 4; frame++, now += 1000 / 60)
    drawCameraInset(d, shot, rect, 'Incident site');
  // Two scene renders (frames 0 and 2), and the cached image shown on all four frames.
  expect(renders.filter((drawn) => drawn === scene)).toHaveLength(2);
  expect(renders.filter((drawn) => drawn !== scene)).toHaveLength(4);
  const other = { insetCamera: {}, viewport: {}, scissor: {} };
  drawCameraInset(d, other, rect, 'VIP visitor arriving', true);
  expect(renders.filter((drawn) => drawn === scene)).toHaveLength(3);
  d.renderQuality.tier = 'high';
  renders.length = 0;
  drawCameraInset(d, shot, rect, 'Incident site');
  drawCameraInset(d, shot, rect, 'Incident site');
  expect(renders).toEqual([scene, scene]);
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

it('keeps instanced actor buffers across rebuilds while their parts fit', () => {
  const scene = new Scene(),
    renderer = new TownActors(scene),
    geometry = new BoxGeometry(),
    material = new MeshStandardMaterial();
  const actor = (count) => {
    const root = new Group();
    for (let i = 0; i < count; i++) root.add(new Mesh(geometry, material));
    scene.add(root);
    return root;
  };
  const first = actor(4);
  renderer.rebuild([first]);
  const [bucket] = renderer.buckets;
  const mesh = bucket.mesh,
    dispose = vi.spyOn(mesh, 'dispose');
  renderer.rebuild([first]);
  expect(renderer.buckets[0].mesh).toBe(mesh);
  const second = actor(2);
  renderer.rebuild([first, second]);
  expect(renderer.buckets[0].mesh).toBe(mesh);
  expect(mesh.count).toBe(6);
  expect(dispose).not.toHaveBeenCalled();
  const crowd = actor(20);
  renderer.rebuild([first, second, crowd]);
  expect(dispose).toHaveBeenCalledOnce();
  expect(renderer.buckets[0].mesh).not.toBe(mesh);
  expect(renderer.buckets[0].mesh.count).toBe(26);
  const grown = renderer.buckets[0].mesh,
    released = vi.spyOn(grown, 'dispose');
  renderer.rebuild([]);
  expect(released).toHaveBeenCalledOnce();
  expect(renderer.buckets).toHaveLength(0);
  renderer.dispose();
  geometry.dispose();
  material.dispose();
});

it('updates world matrices once per drawn frame and still places detached actors', () => {
  const scene = new Scene();
  scene.matrixWorldAutoUpdate = false;
  const renderer = new TownActors(scene),
    geometry = new BoxGeometry(),
    material = new MeshStandardMaterial();
  const inScene = new Group(),
    detached = new Group();
  inScene.add(new Mesh(geometry, material));
  detached.add(new Mesh(geometry, material));
  scene.add(inScene);
  renderer.rebuild([inScene, detached]);
  const own = vi.spyOn(inScene, 'updateWorldMatrix'),
    staged = vi.spyOn(detached, 'updateWorldMatrix');
  const view = Object.assign(Object.create(TownDiorama.prototype), {
    scene,
    actorRenderer: renderer,
    frameCache: { render: vi.fn() },
  });
  const update = vi.spyOn(scene, 'updateMatrixWorld');
  inScene.position.x = 4;
  detached.position.x = 7;
  expect(view.drawFrame()).toBe(true);
  expect(update).toHaveBeenCalledOnce();
  expect(own).not.toHaveBeenCalled();
  expect(staged).toHaveBeenCalled();
  const matrix = new Matrix4();
  renderer.buckets[0].mesh.getMatrixAt(0, matrix);
  expect(matrix.elements[12]).toBe(4);
  renderer.buckets[0].mesh.getMatrixAt(1, matrix);
  expect(matrix.elements[12]).toBe(7);
  renderer.dispose();
  geometry.dispose();
  material.dispose();
});

it('keeps the terrain crack-free and complete with local millrace refinement', () => {
  const geometry = landscapeGeometry();
  const p = geometry.attributes.position,
    index = geometry.index.array;
  expect(index.length / 3).toBeLessThan(50000);
  const edges = new Map();
  let area = 0;
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i], index[i + 1], index[i + 2]];
    const cross =
      (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a)) -
      (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a));
    expect(cross).toBeGreaterThan(0);
    area += cross / 2;
    for (const [u, w] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = u < w ? `${u},${w}` : `${w},${u}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const hole = 2 * MINE_SHAFT.bankWidth * (MINE_SHAFT.rampStartZ - MINE_SHAFT.portalZ);
  expect(area).toBeCloseTo((2 * TOWN_EDGE) ** 2 - hole, 3);
  // Open edges exist only on the map border and around the shaft opening.
  for (const [key, uses] of edges) {
    expect(uses).toBeLessThanOrEqual(2);
    if (uses === 2) continue;
    const [u, w] = key.split(',').map(Number);
    const onBorder = [u, w].every(
      (i) => Math.max(Math.abs(p.getX(i)), Math.abs(p.getZ(i))) === TOWN_EDGE,
    );
    // Positions are float32, so compare the shaft limits with a small tolerance.
    const onShaft = [u, w].every(
      (i) =>
        Math.abs(p.getX(i)) <= MINE_SHAFT.bankWidth + 1e-5 &&
        p.getZ(i) >= MINE_SHAFT.portalZ - 1e-5 &&
        p.getZ(i) <= MINE_SHAFT.rampStartZ + 1e-5,
    );
    expect(onBorder || onShaft, key).toBe(true);
  }
  // The millrace keeps its 0.2-unit channel detail; the town keeps 1.25-unit cells.
  const xs = new Set();
  for (let i = 0; i < p.count; i++)
    if (Math.abs(p.getZ(i) - (MILLRACE.minZ + MILLRACE.maxZ) / 2) < 0.2) xs.add(p.getX(i));
  const channel = [...xs].filter((x) => x > MILLRACE.minX && x < MILLRACE.maxX);
  expect(channel.length).toBeGreaterThanOrEqual((MILLRACE.maxX - MILLRACE.minX) / 0.2 - 2);
  geometry.dispose();
});
