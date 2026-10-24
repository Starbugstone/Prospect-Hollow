import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TownView from '../src/components/town/TownView.vue';
import { BUILDINGS, BUILDING_BY_ID, MOON_BUILDINGS, createTown } from '../src/data/town';
import { availableParcels, upgradeOffer } from '../src/game/town/TownRules';
import { useCampaignStore } from '../src/stores/campaignStore';
import { find, renderFragment, sfc } from './helpers/componentFragments';

// The Moon's Build tab is the valley's Build tab: one list, one order and one tap that
// finishes a ready construction, buys with coins or builds with a builder hammer. The list
// shows the settlement on screen first; there is no separate Moon lot list.
const VIEW = 'src/components/town/TownView.vue';
const template = sfc(VIEW).template;

let pinia;
beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
    removeItem: (key) => saves.delete(key),
  });
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => vi.unstubAllGlobals());

// A Twin Hollows town with the elevator up: Moon lots and some valley plots for sale.
function moonEraTown(coins = 1e9) {
  const town = createTown();
  town.era = 'twin-hollows';
  town.coins = coins;
  town.tourSeen = true;
  for (const building of BUILDINGS)
    if (building.settlement !== 'moon') town.buildings[building.id] = building.upgrades.length;
  for (const id of ['saloon', 'stable', 'museum']) town.buildings[id] = 0;
  return town;
}
const settlementOf = (id) => BUILDING_BY_ID[id].settlement ?? 'valley';
async function buildList(town, settlement) {
  useCampaignStore().town = town;
  let state;
  const html = await renderFragment({
    component: TownView,
    path: VIEW,
    template: '<i v-for="place in buildList" :key="place.id" :data-id="place.id"></i>',
    pinia,
    prepare: (setup) => {
      setup.settlement.value = settlement;
      state = setup;
    },
  });
  return { ids: [...html.matchAll(/data-id="([^"]+)"/g)].map(([, id]) => id), state };
}

it('has one Build list: no separate Moon lot list, and every row buys or finishes on tap', () => {
  expect(template.content).not.toContain('town-moon-lot-list');
  expect(template.content).not.toContain('moonLots');
  const list = find(
    template.ast,
    (node) =>
      node.tag === 'section' &&
      node.props?.some((prop) => prop.exp?.content === "t('Available buildings')"),
  );
  const row = find(list, (node) => node.tag === 'button');
  const click = row.props.find((prop) => prop.name === 'on' && prop.arg?.content === 'click');
  expect(click.exp.content).toBe('selectParcel(place.id)');
});

it.each(['moon', 'valley'])('lists the %s first, in the shared order', async (settlement) => {
  const town = moonEraTown();
  const { ids } = await buildList(town, settlement);
  const shared = availableParcels(town, 0).map(({ id }) => id);
  expect([...ids].sort()).toEqual([...shared].sort());
  const here = ids.filter((id) => settlementOf(id) === settlement);
  const there = ids.filter((id) => settlementOf(id) !== settlement);
  expect(here.length).toBeGreaterThan(0);
  expect(there.length).toBeGreaterThan(0);
  expect(ids).toEqual([...here, ...there]);
  // Within each settlement the shared order is kept.
  expect(here).toEqual(shared.filter((id) => settlementOf(id) === settlement));
});

it('buys a Moon lot from its row with coins, or builds it with a hammer when coins run short', async () => {
  const id = MOON_BUILDINGS[0].id;
  const { state } = await buildList(moonEraTown(), 'moon');
  const store = useCampaignStore();
  const coins = store.town.coins;
  const offer = upgradeOffer(store.town, id);
  state.selectParcel(id);
  expect(store.town.projects[id]).toBeDefined();
  expect(store.town.coins).toBe(coins - offer.cost);
  expect(store.town.presentations ?? {}).toEqual({});

  // A builder hammer builds the lot at once, exactly as a valley row does.
  setActivePinia((pinia = createPinia()));
  const poor = await buildList(moonEraTown(0), 'moon');
  const hammered = useCampaignStore();
  hammered.builderHammers = 1;
  poor.state.selectParcel(id);
  expect(hammered.town.buildings[id]).toBe(1);
  expect(hammered.town.projects[id]).toBeUndefined();
  expect(hammered.town.coins).toBe(0);
});
