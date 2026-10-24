import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createDebugTools, debugToolsAllowed } from '../src/services/debugTools';
import { useCampaignStore } from '../src/stores/campaignStore';

let saves;
beforeEach(() => {
  saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
    removeItem: (key) => saves.delete(key),
  });
  setActivePinia(createPinia());
});
afterEach(() => vi.unstubAllGlobals());

it('offers only the read-only profiling and navigation helpers', () => {
  const tools = createDebugTools();
  expect(Object.isFrozen(tools)).toBe(true);
  expect(Object.keys(tools).sort()).toEqual(['showNavigation', 'townFrameStats', 'townTimings']);
  for (const removed of ['grant', 'prepareEra', 'mineStage', 'completeMine'])
    expect(tools).not.toHaveProperty(removed);
});

it('reads town timings without touching the save or the campaign', () => {
  const campaign = useCampaignStore();
  const before = JSON.stringify([campaign.profile(), [...saves]]);
  const report = createDebugTools().townTimings();
  expect(report).toMatchObject({ summary: expect.any(Object), entries: expect.any(Array) });
  expect(JSON.stringify([campaign.profile(), [...saves]])).toBe(before);
});

it('keeps the debug helpers out of the public game', () => {
  const production = { DEV: false };
  expect(debugToolsAllowed({ DEV: true }, 'prospecthollow.starbugstone.com')).toBe(true);
  expect(debugToolsAllowed(production, 'preprod.prospecthollow.starbugstone.com')).toBe(true);
  expect(debugToolsAllowed(production, 'prospecthollow.starbugstone.com')).toBe(false);
  expect(debugToolsAllowed(production, 'localhost')).toBe(false);
  expect(debugToolsAllowed({ DEV: false, VITE_DEBUG_TOOLS: 'true' }, 'localhost')).toBe(true);
});
