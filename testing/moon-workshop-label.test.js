import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TownView from '../src/components/town/TownView.vue';
import { createTown } from '../src/data/town';
import { buildingIndicators } from '../src/game/town/TownRules';
import { canCollectMoonstones, moonLotInfo } from '../src/game/town/moon/MoonLotStatus';
import { useCampaignStore } from '../src/stores/campaignStore';
import { renderFragment } from './helpers/componentFragments';

// The Moonstone Workshop's label promises what a tap on it does: a ready upgrade finishes
// first, as the tap handler (TownView's selectBuilding) does, and the stock is offered after.
let pinia, view;
beforeEach(async () => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
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
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => vi.unstubAllGlobals());

async function workshop(wins) {
  const town = { ...createTown(), era: 'twin-hollows', tourSeen: true };
  town.buildings.moonstoneWorkshop = 1;
  town.projects.moonstoneWorkshop = { id: 'moonstoneWorkshop', stage: 2, required: 2, wins };
  town.moonstoneProduction.stored = 3;
  const store = useCampaignStore();
  store.town = town;
  await renderFragment({
    component: TownView,
    path: 'src/components/town/TownView.vue',
    template: '<b>town</b>',
    pinia,
    prepare: (state) => (view = state),
  });
  return store;
}
const label = (town) =>
  moonLotInfo(town, 'moonstoneWorkshop', {
    indicators: buildingIndicators(town),
    collectable: canCollectMoonstones(town),
  }).text;

it('offers to finish a ready upgrade before the stock, then the stock', async () => {
  const store = await workshop(2);
  expect(label(store.town)).toBe('Tap to finish');
  await view.selectBuilding('moonstoneWorkshop', false);
  expect(store.town.buildings.moonstoneWorkshop).toBe(2);
  expect(store.town.moonstoneProduction.stored).toBe(3);
  expect(label(store.town)).toBe('Collect 3 moonstones');
  await view.selectBuilding('moonstoneWorkshop', false);
  expect(store.town.moonstoneProduction.stored).toBe(0);
});

it('offers the stock while an upgrade is still being built', async () => {
  const store = await workshop(1);
  expect(label(store.town)).toBe('Collect 3 moonstones');
  await view.selectBuilding('moonstoneWorkshop', false);
  expect(store.town.moonstoneProduction.stored).toBe(0);
  expect(store.town.buildings.moonstoneWorkshop).toBe(1);
});
