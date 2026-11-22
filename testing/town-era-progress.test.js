import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TownNextStep from '../src/components/town/TownNextStep.vue';
import { ERAS } from '../src/data/eras';
import { BUILDINGS, createTown } from '../src/data/town';
import { eraIndex, isEraComplete, plotInEra } from '../src/game/town/TownEras';
import { normalizeTown } from '../src/game/town/TownRules';
import { renderFragment } from './helpers/componentFragments';

// The village's "Town upgrades done/total" bar fills when the era is complete. Optional
// buildings (the Saucer Pad, the Moonball Field, the Crater Pond Garden…) never hold an
// era back, so leaving one unbuilt still lets the bar reach its total.
const PATH = 'src/components/town/TownNextStep.vue';
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
});
afterEach(() => vi.unstubAllGlobals());

const OPTIONAL = BUILDINGS.filter((b) => b.requiredForEraCompletion === false);
// A town whose every required building is finished in `era`, with the optional ones unbuilt.
function completeTown(era) {
  const town = createTown();
  town.era = era;
  for (const b of BUILDINGS.filter((b) => plotInEra(town, b.id))) {
    if (!b.requiredForEraCompletion) continue;
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = era;
    town.buildingEraLevels[b.id] = 3;
  }
  return normalizeTown(town);
}
async function eraProgress(town) {
  const pinia = createPinia();
  setActivePinia(pinia);
  let state;
  await renderFragment({
    component: TownNextStep,
    path: PATH,
    template: '<b>next</b>',
    props: { town, hammers: 0 },
    pinia,
    prepare: (setup) => (state = setup),
  });
  return state.eraProgress.value;
}
const optionalEras = ERAS.filter(
  (era) => era.enabled && OPTIONAL.some((b) => eraIndex(b.introducedEra) <= eraIndex(era.id)),
).map((era) => era.id);

it('has optional buildings to leave unbuilt', () => {
  expect(OPTIONAL.length).toBeGreaterThan(0);
  expect(optionalEras.length).toBeGreaterThan(1);
});

it.each(optionalEras)(
  'fills the upgrade bar in a complete %s town with optional buildings unbuilt',
  async (era) => {
    const town = completeTown(era);
    expect(isEraComplete(town)).toBe(true);
    const progress = await eraProgress(town);
    expect(progress.total).toBeGreaterThan(0);
    expect(progress.done).toBe(progress.total);
  },
);
