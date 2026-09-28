import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { createTown } from '../src/data/town';
import { normalizeTown } from '../src/game/town/TownRules';
import { newerGuest, normalizeGuestVip } from '../src/data/guestVip';
import { vipVisitor } from '../src/data/villagers';
import { TownDiorama } from '../src/game/town/TownDiorama';

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
    expect(roundTrip(c.town).guestVip).toEqual({ name: 'Red Rock', at: 4_000 });
  });

  it('sends the latest guest as the next VIP after each new visit, then ordinary VIPs', () => {
    const draw = TownDiorama.prototype.drawVip;
    const scene = { town: createTown() };
    expect(draw.call(scene, 7, 3)).toEqual(vipVisitor(7, 3));
    scene.town = { ...scene.town, guestVip: { name: 'Red Rock', at: 5 } };
    expect(draw.call(scene, 7, 3).name).toBe('Mayor of Red Rock');
    expect(draw.call(scene, 7, 3)).toEqual(vipVisitor(7, 3));
    scene.town = { ...scene.town, guestVip: { name: 'Red Rock', at: 9 } };
    expect(draw.call(scene, 7, 3).name).toBe('Mayor of Red Rock');
  });

  it('shows no VIPs at all in a read-only shared town', () => {
    const draw = TownDiorama.prototype.drawVip;
    const scene = {
      vipsHidden: true,
      town: { ...createTown(), guestVip: { name: 'Red Rock', at: 5 } },
    };
    for (let visit = 0; visit < 200; visit++) expect(draw.call(scene, 7, visit)).toBeNull();
  });
});
