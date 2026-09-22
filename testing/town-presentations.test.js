import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createTown } from '../src/data/town';
import {
  acknowledgePresentation,
  normalizePresentations,
  pendingPresentation,
  queueBuildingPresentations,
} from '../src/data/townPresentations';
import { normalizeTown } from '../src/game/town/TownRules';
import { railEdges } from '../src/game/town/TownLayout';
import { useCampaignStore } from '../src/stores/campaignStore';

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => saves.get(k) ?? null,
    setItem: (k, v) => saves.set(k, v),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function readyStation() {
  const town = createTown();
  town.era = 'river-rail';
  town.coins = 50000;
  Object.assign(town.buildings, { well: 3, farm: 3, home: 3, bridge: 1 });
  town.projects.railDepot = { id: 'railDepot', stage: 1, required: 2, wins: 2 };
  return town;
}
it('queues one saved opening only after the ready station and its rails are completed', () => {
  const store = useCampaignStore();
  store.town = readyStation();
  expect(railEdges(store.town)).toEqual([]);
  expect(pendingPresentation(store.town)).toBeUndefined();
  expect(store.finishConstruction('railDepot', 1)).toBe(true);
  expect(store.town.infrastructure.rail).toBe(1);
  expect(railEdges(store.town)).toHaveLength(1);
  expect(pendingPresentation(store.town)?.id).toBe('railway-opening');
  expect(store.finishConstruction('railDepot', 1)).toBe(false);
  setActivePinia(createPinia());
  const reloaded = useCampaignStore();
  expect(pendingPresentation(reloaded.town)?.id).toBe('railway-opening');
  const coins = reloaded.town.coins;
  expect(reloaded.acknowledgePresentation('railway-opening')).toBe(true);
  expect(reloaded.acknowledgePresentation('railway-opening')).toBe(false);
  expect(reloaded.town.coins).toBe(coins);
  expect(normalizeTown(reloaded.town).presentations).toEqual({ 'railway-opening': 'seen' });
  reloaded.town.projects.railDepot = { id: 'railDepot', stage: 2, required: 2, wins: 2 };
  expect(reloaded.finishConstruction('railDepot', 2)).toBe(true);
  expect(pendingPresentation(reloaded.town)).toBeUndefined();
});
it('rolls back construction and opening receipts together on failed storage', () => {
  const store = useCampaignStore();
  store.town = readyStation();
  vi.spyOn(store, 'save').mockReturnValue(false);
  expect(store.finishConstruction('railDepot', 1)).toBe(false);
  expect(store.town.buildings.railDepot).toBe(0);
  expect(pendingPresentation(store.town)).toBeUndefined();
});
it('queues the same opening when a builder hammer completes the first station', () => {
  const store = useCampaignStore();
  store.town = readyStation();
  delete store.town.projects.railDepot;
  store.builderHammers = 1;
  expect(store.useBuilderHammer('railDepot', 0)).toBe(true);
  expect(store.town.infrastructure.rail).toBe(1);
  expect(pendingPresentation(store.town)?.id).toBe('railway-opening');
});
it('never retroactively opens a cinematic for an old save or an invalid receipt', () => {
  const town = readyStation();
  town.buildings.railDepot = 1;
  expect(normalizeTown(town).presentations).toEqual({});
  expect(
    normalizePresentations({ 'railway-opening': 'garbage', unknown: 'pending' }, town),
  ).toEqual({});
  expect(normalizePresentations({ 'railway-opening': 'pending' }, createTown())).toEqual({});
  expect(acknowledgePresentation(town, 'unknown')).toBeNull();
});
it('shares the completion contract with a future building without accepting incomplete definitions', () => {
  const before = createTown(),
    after = { ...before, buildings: { ...before.buildings, library: 1 } };
  const definitions = {
    future: { id: 'library-opening', building: 'library' },
    incomplete: { id: 'bad' },
    empty: null,
  };
  const next = queueBuildingPresentations(before, after, definitions);
  expect(next.presentations).toEqual({ 'library-opening': 'pending' });
  expect(normalizePresentations(next.presentations, next, definitions)).toEqual(next.presentations);
  expect(queueBuildingPresentations(next, next, definitions).presentations).toEqual(
    next.presentations,
  );
});
