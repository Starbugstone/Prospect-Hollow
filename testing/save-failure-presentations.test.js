import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TownView from '../src/components/town/TownView.vue';
import { createTown } from '../src/data/town';
import { pendingPresentation } from '../src/data/townPresentations';
import { useCampaignStore } from '../src/stores/campaignStore';
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
async function village(town) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useCampaignStore();
  store.town = { ...town, tourSeen: true };
  expect(store.save()).toBe(true);
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
  setActivePinia(createPinia());
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
