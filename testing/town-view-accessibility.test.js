import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TownView from '../src/components/town/TownView.vue';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { plotInEra } from '../src/game/town/TownEras';
import { useCampaignStore } from '../src/stores/campaignStore';
import { renderFragment } from './helpers/componentFragments';

// The village panels and the counts the player reads in them, rendered from TownView's
// real template and setup.
const VIEW = 'src/components/town/TownView.vue';

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

const render = (town, template, prepare) => {
  useCampaignStore().town = town;
  return renderFragment({ component: TownView, path: VIEW, template, pinia, prepare });
};
// A second-era town: BUILDINGS also holds every later era's plots and the Moon's lots,
// while the current era lists only the plots it has opened.
function secondEraTown() {
  const town = createTown();
  town.era = ERAS[1].id;
  town.tourSeen = true;
  const plots = BUILDINGS.filter(({ id }) => plotInEra(town, id));
  for (const { id } of plots.slice(0, 5)) town.buildings[id] = 1;
  return { town, plots };
}

it('counts Story overview buildings like the Build title: the current era plots only', async () => {
  const { town, plots } = secondEraTown();
  expect(plots.length).toBeLessThan(BUILDINGS.length);
  const html = await render(
    town,
    `<i v-for="stat in villageStats" :key="stat.id" :data-id="stat.id" :data-value="stat.value"></i><b>{{ dialogTitle }}</b>`,
    (setup) => (setup.dialogMode.value = 'build'),
  );
  const built = plots.filter(({ id }) => town.buildings[id]).length;
  expect(built).toBe(5);
  expect(html).toContain(`data-id="buildings" data-value="${built}/${plots.length}"`);
  expect(html).toContain(`<b>Available plots · ${built}/${plots.length} built</b>`);
});
