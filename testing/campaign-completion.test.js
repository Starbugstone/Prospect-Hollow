import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { campaignCompletion } from '../src/data/campaignCompletion';
import { LEVEL_COUNT } from '../src/data/campaign';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { pendingPresentation, queueCampaignPresentations } from '../src/data/townPresentations';
import { createTown } from '../src/data/town';

const perfectRecords = () =>
  Object.fromEntries(
    Array.from({ length: LEVEL_COUNT }, (_, i) => [i + 1, { score: 50000, stars: 3 }]),
  );
beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => saves.get(k) ?? null,
    setItem: (k, v) => saves.set(k, v),
  });
  setActivePinia(createPinia());
});
afterEach(() => vi.unstubAllGlobals());

it('counts only authored normal levels and separates imperfect replays from undiscovered levels', () => {
  expect(
    campaignCompletion({ 1: { stars: 3 }, 2: { stars: 1 }, 3: { stars: 2 }, 999: { stars: 3 } }, 4),
  ).toEqual({
    perfect: 1,
    total: 4,
    remaining: 3,
    complete: false,
    replayIds: [2, 3],
    unplayed: 1,
  });
  expect(campaignCompletion({}, 0).complete).toBe(false);
  expect(campaignCompletion(perfectRecords()).complete).toBe(true);
});

it('saves the celebration with the final improved replay, resumes once, and never repeats', () => {
  const store = useCampaignStore();
  store.records = perfectRecords();
  store.records[1].stars = 2;
  store.town.buildings.museum = 1;
  expect(pendingPresentation(store.town)).toBeUndefined();
  store.recordVictory({ id: 1, score: 50000, target: 100, combo: 10 });
  expect(store.completion.complete).toBe(true);
  expect(pendingPresentation(store.town)?.id).toBe('three-star-celebration');
  setActivePinia(createPinia());
  const reloaded = useCampaignStore();
  expect(pendingPresentation(reloaded.town)?.id).toBe('three-star-celebration');
  const coins = reloaded.town.coins;
  expect(reloaded.acknowledgePresentation('three-star-celebration')).toBe(true);
  expect(reloaded.town.coins).toBe(coins);
  reloaded.recordVictory({ id: 1, score: 10, target: 100, combo: 1 });
  expect(pendingPresentation(reloaded.town)).toBeUndefined();
  setActivePinia(createPinia());
  expect(pendingPresentation(useCampaignStore().town)).toBeUndefined();
});

it('recognizes an already perfect older save but rejects partial and continuous-only collections', () => {
  const records = perfectRecords();
  localStorage.setItem(SAVE_KEY, JSON.stringify({ records, town: createTown() }));
  expect(pendingPresentation(useCampaignStore().town)?.id).toBe('three-star-celebration');
  delete records[LEVEL_COUNT];
  setActivePinia(createPinia());
  localStorage.setItem(
    SAVE_KEY,
    JSON.stringify({
      records,
      continuousRecords: { [LEVEL_COUNT]: { score: 99999, coins: 25 } },
      town: { ...createTown(), presentations: { 'three-star-celebration': 'pending' } },
    }),
  );
  expect(pendingPresentation(useCampaignStore().town)).toBeUndefined();
});

it('shares milestone receipts with future criteria and ignores incomplete definitions', () => {
  const definitions = {
    future: { id: 'future', qualifies: (records) => records[1]?.stars === 3 },
    invalid: { id: 'invalid' },
    empty: null,
  };
  const next = queueCampaignPresentations(createTown(), { 1: { stars: 3 } }, definitions);
  expect(next.presentations).toEqual({ future: 'pending' });
  expect(
    queueCampaignPresentations(
      { ...next, presentations: { future: 'seen' } },
      { 1: { stars: 3 } },
      definitions,
    ).presentations,
  ).toEqual({ future: 'seen' });
});
