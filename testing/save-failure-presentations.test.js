import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createApp } from 'vue';
import TownView from '../src/components/town/TownView.vue';
import { BUILDINGS, createTown } from '../src/data/town';
import { normalizeTown } from '../src/game/town/TownRules';
import { pendingPresentation } from '../src/data/townPresentations';
import { createLocalIntegrityPlugin } from '../src/services/localIntegrity';
import { SAVE_KEY } from '../src/services/localProfile';
import { freshProfile, useCampaignStore } from '../src/stores/campaignStore';
import { renderFragment } from './helpers/componentFragments';

// A full local store (a quota error) must never trap the player in a saved event's
// cinematic or dialog: the acknowledgement that cannot be saved closes it for this session,
// warns that progress is not saving, and leaves the receipt pending for a later session.
const VIEW = 'src/components/town/TownView.vue';
let saves, full;
beforeEach(() => {
  saves = new Map();
  full = false;
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => {
      if (full) throw new DOMException('Storage is full', 'QuotaExceededError');
      saves.set(key, value);
    },
    removeItem: (key) => saves.delete(key),
  });
  vi.stubGlobal('document', {
    activeElement: null,
    hidden: false,
    body: { style: {} },
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
  });
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  setActivePinia(createPinia());
});
afterEach(() => vi.unstubAllGlobals());

// The village view over a saved town, with the storage then filling up.
// The production store, with its integrity guard (mutations only through its actions).
function guardedPinia() {
  const pinia = createPinia();
  pinia.use(createLocalIntegrityPlugin());
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return pinia;
}
async function village(town) {
  const pinia = guardedPinia();
  saves.set(SAVE_KEY, JSON.stringify({ ...freshProfile(), town: { ...town, tourSeen: true } }));
  const store = useCampaignStore();
  full = true;
  let view;
  await renderFragment({
    component: TownView,
    path: VIEW,
    template: '<b>town</b>',
    pinia,
    prepare: (state) => (view = state),
  });
  return { store, view };
}
// What the next session loads from storage.
function nextSession() {
  full = false;
  guardedPinia();
  return useCampaignStore().town;
}

it('closes the railway opening when its acknowledgement cannot be saved, keeping its receipt', async () => {
  const town = createTown();
  town.buildings.railDepot = 1;
  town.presentations = { 'railway-opening': 'pending' };
  const { store, view } = await village(town);
  expect(view.openingPresentation.value?.id).toBe('railway-opening');
  view.completePresentation();
  expect(view.openingPresentation.value).toBeFalsy();
  expect(store.saveWarning).toContain('not saving');
  expect(pendingPresentation(store.town)?.id).toBe('railway-opening');
  // Skipping again in this session changes nothing; the next session plays it again.
  view.completePresentation();
  expect(view.openingPresentation.value).toBeFalsy();
  expect(pendingPresentation(nextSession())?.id).toBe('railway-opening');
});

it('closes an era cinematic whose acknowledgement cannot be saved, keeping the era pending', async () => {
  const town = createTown();
  town.era = 'industrial';
  town.transition = {
    id: 'river-rail:industrial',
    from: 'river-rail',
    to: 'industrial',
    pending: true,
  };
  const { store, view } = await village(town);
  expect(view.eraPlaying.value).toBe(true);
  view.completeEraCinematic();
  expect(view.eraPlaying.value).toBe(false);
  expect(store.saveWarning).toContain('not saving');
  expect(store.town.transition.pending).toBe(true);
  expect(nextSession().transition.pending).toBe(true);
});

it('closes First Lights when its acknowledgement cannot be saved, keeping it unseen', async () => {
  const town = createTown();
  town.era = 'industrial';
  town.buildings.powerHouse = 1;
  const { store, view } = await village(town);
  expect(view.firstLightsOpen.value).toBe(true);
  store.acknowledgeFirstLights();
  expect(view.firstLightsOpen.value).toBe(false);
  expect(store.saveWarning).toContain('not saving');
  expect(nextSession().firstLightsSeen).toBe(false);
});

it('still saves the acknowledgement when storage works', async () => {
  const town = createTown();
  town.buildings.railDepot = 1;
  town.presentations = { 'railway-opening': 'pending' };
  const { store, view } = await village(town);
  full = false;
  view.completePresentation();
  expect(view.openingPresentation.value).toBeFalsy();
  expect(store.saveWarning).toBe('');
  expect(pendingPresentation(nextSession())).toBeUndefined();
});

// A town with every Frontier and River & Rail upgrade built: River & Rail is complete.
function completedRiverTown() {
  const town = createTown();
  town.era = 'river-rail';
  town.coins = 250000;
  town.completedRuns = 72;
  for (const b of BUILDINGS.filter((b) => ['frontier', 'river-rail'].includes(b.introducedEra))) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = 'river-rail';
    town.buildingEraLevels[b.id] = 3;
  }
  return normalizeTown(town);
}

it('saves a held era acknowledgement with the next save that works', async () => {
  const town = completedRiverTown();
  town.transition = {
    id: 'frontier:river-rail',
    from: 'frontier',
    to: 'river-rail',
    pending: true,
  };
  const { store, view } = await village(town);
  view.completeEraCinematic();
  expect(view.eraPlaying.value).toBe(false);
  expect(view.gate.value.next.enabled).toBe(true);
  // Storage recovers: the next save stores the acknowledgement, so the era can advance.
  full = false;
  expect(store.save()).toBe(true);
  expect(store.heldAcknowledgements).toEqual([]);
  expect(store.town.transition.pending).toBe(false);
  expect(JSON.parse(saves.get(SAVE_KEY)).town.transition.pending).toBe(false);
  expect(store.advanceEra('river-rail')).toBe(true);
  expect(nextSession().era).toBe('industrial');
});

it('keeps a held acknowledgement held while saves still fail', async () => {
  const town = createTown();
  town.buildings.railDepot = 1;
  town.presentations = { 'railway-opening': 'pending' };
  const { store, view } = await village(town);
  view.completePresentation();
  expect(store.save()).toBe(false);
  expect(store.heldAcknowledgements).toEqual(['presentation:railway-opening']);
  expect(pendingPresentation(store.town)?.id).toBe('railway-opening');
  full = false;
  expect(store.save()).toBe(true);
  expect(store.heldAcknowledgements).toEqual([]);
  expect(pendingPresentation(nextSession())).toBeUndefined();
});

it('keeps the Build tab open for a purchase after a held railway opening', async () => {
  const town = createTown();
  town.coins = 1e7;
  town.buildings.railDepot = 1;
  town.presentations = { 'railway-opening': 'pending' };
  const { store, view } = await village(town);
  view.completePresentation();
  expect(view.openingPresentation.value).toBeFalsy();
  full = false;
  view.dialogMode.value = 'build';
  const row = view.buildList.value.find((entry) => entry.offer?.cost > 0);
  expect(row).toBeDefined();
  const before = store.town.coins;
  view.selectParcel(row.id);
  expect(store.town.coins).toBeLessThan(before);
  expect(view.dialogMode.value).toBe('build');
});
