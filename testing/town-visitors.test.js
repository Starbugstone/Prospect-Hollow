import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { createTown } from '../src/data/town';
import { normalizeTown } from '../src/game/town/TownRules';
import { newVisits, normalizeVisitors } from '../src/data/townVisitors';
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

describe('share-link visits reaching the owner', () => {
  it('keeps older saves valid and drops malformed visit records', () => {
    expect(normalizeTown({}).visitors).toEqual({ saloonAt: 0, guest: null });
    expect(normalizeVisitors({ saloonAt: -5, guest: { name: '<script>', at: 10 } })).toEqual({
      saloonAt: 0,
      guest: null,
    });
    expect(normalizeVisitors({ saloonAt: 9, guest: { name: 'Silver Creek', at: 12 } })).toEqual({
      saloonAt: 9,
      guest: { name: 'Silver Creek', at: 12 },
    });
    expect(
      newVisits(
        { saloonAt: 9, guest: { name: 'Old Town', at: 12 } },
        { saloonAt: 9, guest: { name: 'Old Town', at: 12 } },
      ),
    ).toEqual({ saloonAt: 0, guest: null });
  });

  it('collects the reserved saloon coins once, as if the owner had tapped it', () => {
    const c = saloonTown(40);
    const received = c.receiveVisitors({ saloonAt: 2_000, guest: null }, 1_000);
    expect(received).toEqual({ coins: 40, guest: null });
    expect(c.town.coins).toBe(140);
    expect(c.town.income.stored).toBe(0);
    expect(c.town.visitors.saloonAt).toBe(2_000);
    expect(c.lastSaloonIncome).toBe(40);
    // Reconnecting again, or on another device with the synced save, applies nothing.
    expect(c.receiveVisitors({ saloonAt: 2_000, guest: null }, 1_000)).toBeNull();
    expect(c.receiveVisitors({ saloonAt: 1_500, guest: null }, 1_000)).toBeNull();
    expect(c.town.coins).toBe(140);
    expect(normalizeTown(JSON.parse(JSON.stringify(c.town))).visitors.saloonAt).toBe(2_000);
  });

  it('never creates coins beyond what the saloon had earned', () => {
    const c = saloonTown(0);
    c.town.income = { at: 1_000, stored: 0, remainder: 0 };
    const expected = c.town.coins;
    expect(c.receiveVisitors({ saloonAt: 5_000, guest: null }, 1_000)).toEqual({
      coins: 0,
      guest: null,
    });
    expect(c.town.coins).toBe(expected);
    expect(c.town.visitors.saloonAt).toBe(5_000);
  });

  it('keeps only the latest signed-in guest', () => {
    const c = saloonTown();
    const coins = c.town.coins;
    expect(c.receiveVisitors({ saloonAt: 0, guest: { name: 'Silver Creek', at: 3_000 } })).toEqual({
      coins: 0,
      guest: 'Silver Creek',
    });
    expect(c.town.coins).toBe(coins);
    expect(c.receiveVisitors({ saloonAt: 0, guest: { name: 'Old Town', at: 2_000 } })).toBeNull();
    c.receiveVisitors({ saloonAt: 0, guest: { name: 'Red Rock', at: 4_000 } });
    expect(c.town.visitors.guest).toEqual({ name: 'Red Rock', at: 4_000 });
  });

  it('sends the latest guest as the next VIP after each new visit, then ordinary VIPs', () => {
    const draw = TownDiorama.prototype.drawVip;
    const scene = { town: createTown() };
    expect(draw.call(scene, 7, 3)).toEqual(vipVisitor(7, 3));
    scene.town = { ...scene.town, visitors: { saloonAt: 0, guest: { name: 'Red Rock', at: 5 } } };
    expect(draw.call(scene, 7, 3).name).toBe('Mayor of Red Rock');
    expect(draw.call(scene, 7, 3)).toEqual(vipVisitor(7, 3));
    scene.town = { ...scene.town, visitors: { saloonAt: 0, guest: { name: 'Red Rock', at: 9 } } };
    expect(draw.call(scene, 7, 3).name).toBe('Mayor of Red Rock');
  });

  it('shows no VIPs at all in a read-only shared town', () => {
    const draw = TownDiorama.prototype.drawVip;
    const guest = { name: 'Red Rock', at: 5 };
    const scene = { vipsHidden: true, town: { ...createTown(), visitors: { saloonAt: 0, guest } } };
    for (let visit = 0; visit < 200; visit++) expect(draw.call(scene, 7, visit)).toBeNull();
  });
});
