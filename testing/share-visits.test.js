import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { createTown } from '../src/data/town';
import { normalizeTown } from '../src/game/town/TownRules';
import { newerGuest, normalizeGuestVip } from '../src/data/guestVip';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownVipArrivals } from '../src/game/town/TownVipArrivals';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { visitorPopulation } from '../src/game/town/TownRules';
import { Group, MeshBasicMaterial, Scene } from 'three';

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => vi.restoreAllMocks());

function saloonTown(stored = 40) {
  const c = useCampaignStore();
  c.town = createTown();
  Object.assign(c.town.buildings, { saloon: 3, home: 3, farm: 3, well: 3 });
  c.town.coins = 100;
  c.town.income = { at: 1_000, stored, remainder: 0 };
  return c;
}
const roundTrip = (town) => normalizeTown(JSON.parse(JSON.stringify(town)));

describe('visitor saloon collection reaching the owner', () => {
  it('keeps older saves valid', () => {
    expect(normalizeTown({})).toMatchObject({ saloonVisitAt: 0, guestVip: null });
    expect(normalizeTown({ saloonVisitAt: -4 }).saloonVisitAt).toBe(0);
  });

  it('collects the reserved coins once, as if the owner had tapped the saloon', () => {
    const c = saloonTown(40);
    expect(c.collectSaloonForVisitor(2_000, 1_000)).toBe(40);
    expect(c.town).toMatchObject({ coins: 140, saloonVisitAt: 2_000, guestVip: null });
    expect(c.town.income.stored).toBe(0);
    expect(c.lastSaloonIncome).toBe(40);
    // Reconnecting again, or on another device with the synced save, applies nothing.
    expect(c.collectSaloonForVisitor(2_000, 1_000)).toBeNull();
    expect(c.collectSaloonForVisitor(1_500, 1_000)).toBeNull();
    expect(c.collectSaloonForVisitor(0, 1_000)).toBeNull();
    expect(c.town.coins).toBe(140);
    expect(roundTrip(c.town).saloonVisitAt).toBe(2_000);
  });

  it('never creates coins beyond what the saloon had earned', () => {
    const c = saloonTown(0);
    expect(c.collectSaloonForVisitor(5_000, 1_000)).toBe(0);
    expect(c.town.coins).toBe(100);
    expect(c.town.saloonVisitAt).toBe(5_000);
  });
});

describe('the latest signed-in viewer as a guest VIP', () => {
  it('accepts only sanitised names', () => {
    expect(normalizeGuestVip({ name: 'Silver Creek', at: 12 })).toEqual({
      name: 'Silver Creek',
      at: 12,
      seen: false,
    });
    for (const name of ['<script>', 'a@b.fr', 'www.example.com', "O'Hara", 'ab', 'Two  Spaces'])
      expect(normalizeGuestVip({ name, at: 12 })).toBeNull();
    expect(normalizeGuestVip({ name: 'Silver Creek', at: 0 })).toBeNull();
    expect(newerGuest({ name: 'Old Town', at: 12 }, { name: 'Old Town', at: 12 })).toBeNull();
  });

  it('keeps only the latest guest and never touches coins', () => {
    const c = saloonTown();
    expect(c.welcomeGuest({ name: 'Silver Creek', at: 3_000 })).toBe('Silver Creek');
    expect(c.welcomeGuest({ name: 'Old Town', at: 2_000 })).toBeNull();
    expect(c.welcomeGuest(null)).toBeNull();
    expect(c.welcomeGuest({ name: 'Red Rock', at: 4_000 })).toBe('Red Rock');
    expect(c.town).toMatchObject({ coins: 100, saloonVisitAt: 0 });
    expect(roundTrip(c.town).guestVip).toEqual({ name: 'Red Rock', at: 4_000, seen: false });
  });

  it('marks the guest seen once they walk in, and a newer visit arrives again', () => {
    const c = saloonTown();
    c.welcomeGuest({ name: 'Red Rock', at: 4_000 });
    expect(c.town.guestVip).toEqual({ name: 'Red Rock', at: 4_000, seen: false });
    expect(c.markGuestSeen(3_000)).toBe(false);
    expect(c.markGuestSeen(4_000)).toBe(true);
    expect(roundTrip(c.town).guestVip.seen).toBe(true);
    expect(c.welcomeGuest({ name: 'Red Rock', at: 4_000 })).toBeNull();
    c.welcomeGuest({ name: 'Blue Hill', at: 5_000 });
    expect(c.town.guestVip).toEqual({ name: 'Blue Hill', at: 5_000, seen: false });
  });
});

// A lightweight scene, as in vip-arrivals.test.js, without WebGL.
function guestScene(guestVip, buildings = { home: 1, well: 1 }) {
  const d = Object.create(TownDiorama.prototype);
  const town = { ...createTown(), guestVip };
  Object.assign(town.buildings, buildings);
  Object.assign(d, {
    town,
    elapsed: 0,
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    actors: [],
    motions: [],
    visitorTransports: new Map(),
    onGuestVip: vi.fn(),
  });
  d.scene.add(d.world);
  d.vipArrivals = new TownVipArrivals(d, 11);
  return d;
}
const guestActor = (d) => d.vipArrivals.actors.find((actor) => actor.source === 'guest');

describe('the guest VIP arrival', () => {
  it('is guaranteed on connection, even in a town without visitors or transport', () => {
    const d = guestScene({ name: 'Red Rock', at: 5, seen: false });
    expect(visitorPopulation(d.town)).toBe(0);
    d.vipArrivals.attach(d.town);
    d.vipArrivals.update();
    const actor = guestActor(d);
    expect(actor.started).toBe(0);
    expect(actor.root.userData.villager.name).toBe('From Red Rock');
    expect(actor.root.userData.outfit.variant).toBe('guest');
    expect(d.onGuestVip).toHaveBeenCalledExactlyOnceWith(5);
    d.vipArrivals.update();
    expect(d.onGuestVip).toHaveBeenCalledTimes(1);
  });

  it('waits for a raid or cinematic to end instead of being lost', () => {
    const d = guestScene({ name: 'Red Rock', at: 5, seen: false });
    d.cinematic = true;
    d.vipArrivals.attach(d.town);
    d.vipArrivals.update();
    expect(guestActor(d).started).toBeUndefined();
    expect(d.onGuestVip).not.toHaveBeenCalled();
    d.cinematic = false;
    d.vipArrivals.update();
    expect(guestActor(d).started).toBe(0);
    expect(d.onGuestVip).toHaveBeenCalledOnce();
  });

  it('keeps walking when the save marks them seen, and does not return on later connections', () => {
    const d = guestScene({ name: 'Red Rock', at: 5, seen: false });
    d.vipArrivals.attach(d.town);
    d.vipArrivals.update();
    const walking = guestActor(d);
    d.town = { ...d.town, guestVip: { name: 'Red Rock', at: 5, seen: true } };
    d.retainedVipActors = new Map(d.vipArrivals.actors.map((actor) => [actor.source, actor]));
    d.vipArrivals.attach(d.town);
    expect(guestActor(d)).toBe(walking);
    const later = guestScene({ name: 'Red Rock', at: 5, seen: true });
    later.vipArrivals.attach(later.town);
    later.vipArrivals.update();
    expect(guestActor(later)).toBeUndefined();
    expect(later.onGuestVip).not.toHaveBeenCalled();
  });

  it('arrives when a guest is applied while the village is already open', () => {
    const d = guestScene(null);
    d.vipArrivals.attach(d.town);
    d.vipArrivals.update();
    expect(guestActor(d)).toBeUndefined();
    d.rebuildActors = vi.fn();
    d.town = { ...d.town, guestVip: { name: 'Blue Hill', at: 9, seen: false } };
    d.vipArrivals.update();
    expect(guestActor(d).root.userData.villager.name).toBe('From Blue Hill');
    expect(d.rebuildActors).toHaveBeenCalledOnce();
    expect(d.onGuestVip).toHaveBeenCalledExactlyOnceWith(9);
  });

  it('never appears, like any VIP, in a read-only shared town', () => {
    const d = guestScene({ name: 'Red Rock', at: 5, seen: false });
    d.vipsHidden = true;
    d.vipArrivals.attach(d.town);
    d.vipArrivals.update();
    expect(guestActor(d)).toBeUndefined();
    for (let visit = 0; visit < 200; visit++) expect(d.drawVip(7, visit)).toBeNull();
  });
});
