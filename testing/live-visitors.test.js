import { afterEach, expect, it, vi } from 'vitest';
import { Group, Scene, PerspectiveCamera, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownLiveVisitors } from '../src/game/town/TownLiveVisitors';
import { TownVipArrivals } from '../src/game/town/TownVipArrivals';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownNavigation } from '../src/game/town/TownNavigation';
import { updateTownLocomotion } from '../src/game/town/TownLocomotion';
import { createTown } from '../src/data/town';
import { ERA_BY_ID, ERAS, eraEvolution } from '../src/data/eras';
import { liveVisitorOutfit, vipOutfit } from '../src/data/townWardrobes';
import { locale } from '../src/i18n';

const fixtures = [];
function fixture(era = 'frontier') {
  const d = Object.create(TownDiorama.prototype);
  const town = createTown();
  town.era = era;
  town.buildings.home = town.buildings.saloon = town.buildings.sheriff = 1;
  Object.assign(d, {
    town,
    elapsed: 0,
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    actors: [],
    navigation: new TownNavigation([{ x: -7, z: 0.3, radius: 0.5, y: 0, height: 5 }]),
    render: vi.fn(),
    rebuildActors: vi.fn(),
    onVipSpend: vi.fn(),
  });
  d.scene.add(d.world);
  d.liveVisitors = new TownLiveVisitors(d);
  fixtures.push(d);
  return d;
}
const visitor = (id, extra = {}) => ({
  id,
  name: 'Camille',
  townName: 'Silver Creek',
  era: 'frontier',
  ...extra,
});
afterEach(() => {
  for (const d of fixtures.splice(0)) {
    d.liveVisitors.dispose();
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((geometry) => geometry.dispose());
    d.materials.forEach((material) => material.dispose());
  }
});

it('shows concurrent live visitors once, replaces stale snapshots, and removes departures', () => {
  const d = fixture();
  const saved = JSON.stringify(d.town);
  d.setLiveVisitors([visitor('a'), visitor('b')]);
  expect(d.liveVisitors.actors).toHaveLength(2);
  const [first] = d.liveVisitors.actors;
  d.elapsed = 1;
  d.liveVisitors.update();
  expect(first.root.visible).toBe(true);
  expect(first.root.scale.x).toBe(1);
  expect(first.root.userData.villager.name).toContain('Camille');
  expect(first.root.userData.villager.name).toContain('Silver Creek');
  d.setLiveVisitors([visitor('a'), visitor('a'), visitor('b')]);
  expect(d.liveVisitors.actors[0]).toBe(first);
  expect(d.liveVisitors.actors).toHaveLength(2);
  d.setLiveVisitors([visitor('b')]);
  d.elapsed = 2;
  d.liveVisitors.update();
  expect(d.liveVisitors.actors.map((actor) => actor.liveId)).toEqual(['b']);
  expect(first.root.parent).toBe(null);
  expect(JSON.stringify(d.town)).toBe(saved);
  expect(d.actors).toHaveLength(0);
  expect(d.onVipSpend).not.toHaveBeenCalled();
});

it('keeps heartbeat-only snapshots off the render path while updating labels and origin changes', () => {
  const d = fixture();
  d.setLiveVisitors([visitor('a', { lastSeen: 10 })]);
  const actor = d.liveVisitors.actors[0];
  d.elapsed = 2;
  d.liveVisitors.update();
  updateTownLocomotion(d, 0.1);
  const motion = { ...actor.motion };
  const position = actor.root.position.clone();
  d.rebuildActors.mockClear();
  d.render.mockClear();
  d.setLiveVisitors([visitor('a', { lastSeen: 20 })]);
  expect(d.rebuildActors).not.toHaveBeenCalled();
  expect(d.render).not.toHaveBeenCalled();
  expect(actor.motion).toEqual(motion);
  expect(actor.root.position.equals(position)).toBe(true);
  expect(d.liveVisitors.entries.get('a').lastSeen).toBe(20);
  const previousLocale = locale.value;
  try {
    locale.value = previousLocale === 'en' ? 'fr' : 'en';
    d.setLiveVisitors([visitor('a')]);
    expect(d.rebuildActors).toHaveBeenCalledOnce();
  } finally {
    locale.value = previousLocale;
  }
  d.setLiveVisitors([visitor('a', { name: 'Alex', era: 'tomorrow' })]);
  expect(d.liveVisitors.actors[0].appearance.era).toBe('tomorrow');
  expect(d.liveVisitors.actors[0].root.userData.villager.name).toContain('Alex');
});

it('clears the previous town immediately, including while the next scene is rebuilding', () => {
  const d = fixture();
  d.setLiveVisitors([visitor('old')], false, 'town-a');
  const previous = d.liveVisitors.actors[0];
  d.elapsed = 1;
  d.lifeReady = false;
  d.setLiveVisitors([], false, 'town-b');
  expect(d.liveVisitors.actors).toHaveLength(0);
  expect(previous.root.parent).toBe(null);
  d.setLiveVisitors([visitor('new')], false, 'town-b');
  expect(d.liveVisitors.actors).toHaveLength(0);
  d.lifeReady = true;
  d.liveVisitors.attach();
  expect(d.liveVisitors.actors.map((actor) => actor.liveId)).toEqual(['new']);
});

it('uses each registered home era and the host era for anonymous visitors, including new era fallback', () => {
  const d = fixture('aviation');
  d.setLiveVisitors([
    visitor('old'),
    visitor('future', { era: 'tomorrow' }),
    { id: 'anonymous', name: 'Visitor' },
    visitor('unsupported', { era: 'unreleased-era' }),
  ]);
  const [old, future, anonymous, fallback] = d.liveVisitors.actors;
  expect(old.appearance.era).toBe('frontier');
  expect(future.appearance.era).toBe('tomorrow');
  expect(anonymous.appearance.era).toBe('aviation');
  expect(fallback.appearance.era).toBe('frontier');
  expect(anonymous.root.userData.villager.name).toBe('Visitor');
  for (const actor of d.liveVisitors.actors) {
    expect(actor.root.userData.outfit).toEqual(
      liveVisitorOutfit(eraEvolution(actor.appearance.era)),
    );
    expect(actor.clothing.accessories.sash.visible).toBe(true);
    expect(actor.clothing.accessories.scarf.visible).toBe(false);
  }
  expect(old.clothing.headwear.children.length).toBeGreaterThan(
    future.clothing.headwear.children.length,
  );
  ERA_BY_ID['extension-test'] = { evolution: { wardrobe: 'unknown' } };
  try {
    d.setLiveVisitors([visitor('extension', { era: 'extension-test' })]);
    const added = d.liveVisitors.actors.find((actor) => actor.liveId === 'extension');
    expect(added.root.userData.outfit).toEqual(liveVisitorOutfit({ wardrobe: 'frontier' }));
  } finally {
    delete ERA_BY_ID['extension-test'];
  }
});

it('keeps every era visually distinct from ordinary VIPs through a common visitor outfit contract', () => {
  for (const era of ERAS) {
    const profile = eraEvolution(era.id);
    const outfit = liveVisitorOutfit(profile);
    for (let seed = 0; seed < 5; seed++) {
      expect(outfit.shirt).not.toBe(vipOutfit(profile, seed).shirt);
      expect(outfit.accessory).not.toBe(vipOutfit(profile, seed).accessory);
    }
  }
});

it('retains actors through rebuilds and shows reduced-motion arrivals without an animation loop', () => {
  const d = fixture();
  d.setLiveVisitors([visitor('a')], true);
  const actor = d.liveVisitors.actors[0];
  expect(actor.root.visible).toBe(true);
  expect(actor.root.scale.x).toBe(1);
  const position = actor.root.position.clone();
  d.liveVisitors.detach();
  d.clearGroup(d.world);
  d.world = new Group();
  d.liveVisitors.attach();
  expect(d.liveVisitors.actors).toEqual([actor]);
  expect(actor.root.parent).toBe(d.world);
  expect(actor.root.position.equals(position)).toBe(true);
  d.setLiveVisitors([], true);
  expect(d.liveVisitors.actors).toHaveLength(0);
});

it('walks without a VIP shopping itinerary or random name replacement, and resumes after a scene', () => {
  const d = fixture();
  d.setLiveVisitors([visitor('walking')]);
  const actor = d.liveVisitors.actors[0];
  const name = actor.root.userData.villager.name;
  expect(actor.walkPath.points.length).toBeGreaterThan(1);
  expect(d.navigation.clear(actor.root.position.toArray())).toBe(true);
  d.elapsed = 1;
  d.liveVisitors.update();
  const initial = actor.root.position.clone();
  for (let step = 0; step < 80; step++) {
    d.elapsed += 0.1;
    d.liveVisitors.update();
    updateTownLocomotion(d, 0.1);
    expect(d.navigation.clear(actor.root.position.toArray(), actor.radius)).toBe(true);
  }
  expect(actor.root.position.distanceTo(initial)).toBeGreaterThan(0.1);
  expect(actor.root.userData.villager.name).toBe(name);
  expect(actor.itinerary).toBeUndefined();
  expect(d.onVipSpend).not.toHaveBeenCalled();
  d.raid = {};
  d.liveVisitors.update();
  expect(actor.root.visible).toBe(false);
  d.raid = null;
  d.liveVisitors.update();
  expect(actor.root.visible).toBe(true);
});

it('shows the complete live crowd without dropping visitors beyond the first 24', () => {
  const d = fixture();
  const visits = Array.from({ length: 29 }, (_, id) => visitor(id));
  d.setLiveVisitors(visits, true);
  expect(d.liveVisitors.actors).toHaveLength(visits.length);
  d.setLiveVisitors(visits.slice(1), true);
  expect(d.liveVisitors.actors).toHaveLength(visits.length - 1);
});

it('finds and pins a named live guest independently of ordinary town actors', () => {
  const d = fixture();
  d.camera = new PerspectiveCamera(45, 1.5, 0.1, 300);
  d.camera.position.set(30, 25, 40);
  d.canvas = { clientWidth: 960, clientHeight: 600 };
  d.controls = {
    target: new Vector3(),
    update: () => {
      d.camera.lookAt(d.controls.target);
      d.camera.updateMatrixWorld();
    },
  };
  d.onVillagerLabel = vi.fn();
  const saved = JSON.stringify(d.town);
  d.setLiveVisitors([visitor('self', { self: true }), visitor('matt', { name: 'Matt' })], true);
  expect(d.findVisitor('matt')).toBe(true);
  expect(d.namedVillager.liveId).toBe('matt');
  expect(d.villagerLabelPinned).toBe(true);
  expect(d.onVillagerLabel).toHaveBeenLastCalledWith(
    expect.objectContaining({ name: expect.stringContaining('Matt'), live: true }),
  );
  expect(d.findVisitor('self')).toBe(true);
  expect(d.namedVillager.root.userData.villager.name).toContain('You ·');
  expect(d.findVisitor('missing')).toBe(false);
  d.raid = {};
  expect(d.findVisitor('matt')).toBe(false);
  d.raid = null;
  d.setLiveVisitors([], true);
  expect(d.findVisitor('matt')).toBe(false);
  expect(JSON.stringify(d.town)).toBe(saved);
});

it('shows public live guests while suppressing ordinary VIPs and legacy guests', () => {
  const d = fixture();
  d.town.guestVip = { name: 'Old Guest', at: 123, seen: false };
  d.setLiveVisitors([]);
  const arrivals = new TownVipArrivals(d);
  arrivals.syncGuest(d.town);
  expect(arrivals.actors).toHaveLength(0);
  expect(d.drawVip).toBe(TownDiorama.prototype.drawVip);
  d.vipsHidden = true;
  d.setLiveVisitors([visitor('a', { self: true }), visitor('b', { name: 'Matt' })]);
  expect(d.liveVisitors.actors).toHaveLength(2);
  expect(d.drawVip(1, 1)).toBeNull();
});
