import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { createTown } from '../src/data/town';
import {
  advanceForge,
  buildingIndicators,
  collectionCooldownRemaining,
  normalizeTown,
} from '../src/game/town/TownRules';

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => vi.restoreAllMocks());
function readyTown() {
  const c = useCampaignStore();
  c.town = createTown();
  Object.assign(c.town.buildings, { saloon: 3, blacksmith: 3, home: 3, farm: 3, well: 3 });
  c.town.income = { at: 1000, stored: 10, remainder: 0 };
  c.town.forge = { charge: 1, progress: 0 };
  return c;
}
it('keeps accumulating during collection cooldown and permits collection exactly 30 seconds later', () => {
  const c = readyTown();
  expect(c.collectSaloonIncome(1000)).toBe(10);
  const coins = c.town.coins;
  expect(c.collectSaloonIncome(30999)).toBe(0);
  expect(c.town.income.stored).toBeGreaterThan(0);
  expect(c.town.coins).toBe(coins);
  expect(c.town.lastCollections.saloon).toBe(1000);
  expect(buildingIndicators(c.town, true, 30999).saloon).not.toBe('coins');
  expect(buildingIndicators(c.town, true, 31000).saloon).toBe('coins');
  expect(c.collectSaloonIncome(31000)).toBeGreaterThan(0);
});
it('has independent building timers, saves them, and keeps forge production running', () => {
  let c = readyTown();
  expect(c.collectSaloonIncome(1000)).toBe(10);
  expect(c.collectForgeTNT(1000)).toBe(true);
  for (let i = 0; i < 5; i++) c.town = advanceForge(c.town);
  expect(c.town.forge.charge).toBe(1);
  expect(c.collectForgeTNT(30999)).toBe(false);
  expect(c.town.forge.charge).toBe(1);
  c.save();
  setActivePinia(createPinia());
  c = useCampaignStore();
  expect(c.canCollectForge(30999)).toBe(false);
  expect(c.canCollectForge(31000)).toBe(true);
  expect(c.collectForgeTNT(31000)).toBe(true);
  expect(c.town.lastCollections.saloon).toBe(1000);
  expect(c.town.forge).toEqual({ charge: 0, progress: 0 });
});
it('does not start a cooldown for empty collections or failed saves', () => {
  const c = readyTown();
  c.town.income.stored = 0;
  expect(c.collectSaloonIncome(1000)).toBe(0);
  expect(c.town.lastCollections.saloon).toBeNull();
  c.town.income.stored = 10;
  const coins = c.town.coins;
  const quantity = c.powers.find((p) => p.id === 'tnt').quantity;
  vi.spyOn(c, 'save').mockReturnValue(false);
  expect(c.collectSaloonIncome(1000)).toBe(0);
  expect(c.collectForgeTNT(1000)).toBe(false);
  expect(c.town.lastCollections).toEqual({ saloon: null, blacksmith: null });
  expect(c.town.coins).toBe(coins);
  expect(c.town.income.stored).toBe(10);
  expect(c.town.forge.charge).toBe(1);
  expect(c.powers.find((p) => p.id === 'tnt').quantity).toBe(quantity);
});
it('normalizes old saves and rejects invalid collection timestamps while accepting zero', () => {
  expect(normalizeTown(createTown()).lastCollections).toEqual({ saloon: null, blacksmith: null });
  const town = createTown();
  town.lastCollections = { saloon: 0, blacksmith: -1 };
  expect(normalizeTown(town).lastCollections).toEqual({ saloon: 0, blacksmith: null });
  expect(collectionCooldownRemaining(town, 'saloon', 29999)).toBe(1);
  expect(collectionCooldownRemaining(town, 'saloon', 30000)).toBe(0);
  expect(collectionCooldownRemaining(town, 'saloon', -1000)).toBe(30000);
});
