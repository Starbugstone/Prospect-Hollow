import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { createTestingTools } from '../src/services/testingTools';
import { SAVE_KEY } from '../src/services/localProfile';

let pinia, saves;
beforeEach(() => {
  pinia = createPinia();
  saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

it('adds test resources, caps hammers, and persists without changing buildings or records', () => {
  const campaign = useCampaignStore(pinia);
  const before = JSON.stringify([campaign.town.buildings, campaign.records]);
  expect(createTestingTools(pinia).grant()).toEqual({ coins: 100000, builderHammers: 5 });
  expect(createTestingTools(pinia).grant({ coins: 500, hammers: 100 })).toEqual({
    coins: 100500,
    builderHammers: 5,
  });
  expect(JSON.stringify([campaign.town.buildings, campaign.records])).toBe(before);
  const loaded = useCampaignStore(createPinia());
  expect(loaded.town.coins).toBe(100500);
  expect(loaded.builderHammers).toBe(5);
});
it('rejects invalid amounts before changing the save', () => {
  const grant = createTestingTools(pinia).grant;
  for (const value of [-1, 1.5, Infinity, NaN, '5', Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => grant({ coins: value })).toThrow(TypeError);
    expect(() => grant({ hammers: value })).toThrow(TypeError);
  }
  expect(saves.has(SAVE_KEY)).toBe(false);
});
it('restores balances when storage is unavailable', () => {
  const campaign = useCampaignStore(pinia);
  campaign.town.coins = 25;
  campaign.builderHammers = 1;
  localStorage.setItem = () => {
    throw new Error('Storage full');
  };
  expect(() => createTestingTools(pinia).grant()).toThrow('Balances were restored');
  expect(campaign.town.coins).toBe(25);
  expect(campaign.builderHammers).toBe(1);
});
it('preserves an incompatible save', () => {
  saves.set(SAVE_KEY, JSON.stringify({ schemaVersion: 999 }));
  const saved = saves.get(SAVE_KEY);
  expect(() => createTestingTools(pinia).grant()).toThrow();
  expect(saves.get(SAVE_KEY)).toBe(saved);
});
