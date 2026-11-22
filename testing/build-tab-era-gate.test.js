import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TownView from '../src/components/town/TownView.vue';
import { BUILDINGS, createTown } from '../src/data/town';
import { eraGate, finishEra, plotInEra } from '../src/game/town/TownEras';
import { useCampaignStore } from '../src/stores/campaignStore';
import { find, renderFragment, sfc } from './helpers/componentFragments';

// With every building of the era built and the next era open, the Build tab does not tell
// the player to earn coins or finish a construction: its Next era control says what to do.
const VIEW = 'src/components/town/TownView.vue';
const empty = find(sfc(VIEW).template.ast, (node) =>
  node.props?.some((prop) => prop.name === 'class' && prop.value?.content === 'town-build-empty'),
).loc.source;
const NO_PURCHASES =
  'No purchases available. Earn coins in the mine or finish your current construction.';

let pinia;
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => vi.unstubAllGlobals());

// Every plot of `era` built to its last level and finished in the era.
function builtTown(era, coins = 0) {
  const town = { ...createTown(), era, coins, tourSeen: true, completedRuns: 9999 };
  for (const building of BUILDINGS) {
    if (!plotInEra(town, building.id)) continue;
    town.buildings[building.id] = building.upgrades.length;
    town.buildingEras[building.id] = finishEra(building.id, era);
    town.buildingEraLevels[building.id] = 3;
  }
  return town;
}
async function buildTab(town) {
  useCampaignStore().town = town;
  let state;
  const html = await renderFragment({
    component: TownView,
    path: VIEW,
    template: `<div>${empty}</div>`,
    pinia,
    prepare: (setup) => (state = setup),
  });
  return { html, plots: state.directoryPlots.value.length };
}

it.each(['riverlight', 'twin-hollows', 'hollow-rising'])(
  'gives no shopping advice when %s is built and the next era is open',
  async (era) => {
    const town = builtTown(era);
    expect(eraGate(town).available).toBe(true);
    const { html, plots } = await buildTab(town);
    expect(plots).toBe(0);
    expect(html).not.toContain(NO_PURCHASES);
    expect(html).not.toContain('town-build-empty');
  },
);

it('still explains an empty list while the era waits on a construction', async () => {
  const town = builtTown('riverlight');
  const { id, upgrades } = BUILDINGS.find(
    (building) => building.requiredForEraCompletion && plotInEra(town, building.id),
  );
  town.buildings[id] = upgrades.length - 1;
  town.projects[id] = { id, stage: upgrades.length, wins: 0, required: 2 };
  expect(eraGate(town).available).toBe(false);
  const { html, plots } = await buildTab(town);
  expect(plots).toBe(0);
  expect(html).toContain(NO_PURCHASES);
});
