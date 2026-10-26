import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TownScene from '../src/components/town/TownScene.vue';
import TownView from '../src/components/town/TownView.vue';
import TownBuildRow from '../src/components/town/TownBuildRow.vue';
import { BUILDING_BY_ID, createTown } from '../src/data/town';
import {
  availableParcels,
  availablePurchases,
  buildingIndicators,
} from '../src/game/town/TownRules';
import { plotInEra } from '../src/game/town/TownEras';
import { moonLotDetail } from '../src/game/town/moon/MoonLotStatus';
import { useCampaignStore } from '../src/stores/campaignStore';
import { setLocale } from '../src/i18n';
import { bound, find, renderFragment, sfc } from './helpers/componentFragments';

// Pins the exact status text the player reads for a building on the valley map's labels,
// on the Moon's lot labels and in the Build tab's lists, so moving that text into one
// shared contract cannot change a word. The valley labels and the Build lists render the
// real templates against the real component setups; only the plot or parcel varies.

const SCENE = 'src/components/town/TownScene.vue';
const VIEW = 'src/components/town/TownView.vue';
const NOW = 1_000_000_000_000;

// The valley label's contents: the plot's name and its status chain.
const sceneAst = sfc(SCENE).template.ast;
const labels = find(sceneAst, (node) =>
  node.props?.some((prop) => prop.name === 'class' && prop.value?.content === 'town-scene-labels'),
);
const labelNode = find(labels, (node) => node.tag === 'TownMapLabel');
const labelContents = `<TownMapLabel :name="${bound(labelNode, 'name')}" :status="${bound(labelNode, 'status')}" :quiet="${bound(labelNode, 'quiet')}" />`;
// The Build tab's status line in its list of purchases and in "All current-era plots".
const viewAst = sfc(VIEW).template.ast;
const listStatus = (label) => {
  const section = find(
    viewAst,
    (node) => node.tag === 'section' && bound(node, 'aria-label')?.includes(`'${label}'`),
  );
  return find(
    find(section, (node) => node.tag === 'button'),
    (node) => node.tag === 'small',
  ).loc.source;
};
// Each Build row is the shared row component (TownBuildRow); the list holds only rows.
const ROW = 'src/components/town/TownBuildRow.vue';
const buildList = find(
  viewAst,
  (node) => node.tag === 'section' && bound(node, 'aria-label') === "t('Available buildings')",
);
const buildListStatus = find(sfc(ROW).template.ast, (node) => node.tag === 'small').loc.source;
const currentEraStatus = listStatus('All current-era plots');

const render = (component, path, template, props, globals) =>
  renderFragment({ component, path, template, props, globals, pinia });

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
afterEach(() => {
  setLocale('en');
  vi.unstubAllGlobals();
});

// A town past its free first project, so an unbuilt plot is not automatically a purchase.
function played(edit = () => {}) {
  const town = createTown();
  town.buildings.well = 1;
  edit(town);
  return town;
}
const work = (id, wins) => (town) => (town.projects[id] = { id, stage: 1, wins, required: 2 });
const rich = (town) => (town.coins = 1e6);
const modernized = (level) => (town) => {
  town.era = 'river-rail';
  town.buildings.well = 3;
  town.buildingEras = { ...town.buildingEras, well: 'river-rail' };
  town.buildingEraLevels = { ...town.buildingEraLevels, well: level };
};
const SHORT_WATER = [{ stat: 'water', short: true, fixable: true, id: 'well' }];

// [state, plot, town, map props, { en, fr }]: `label` is the valley label's contents,
// `moon` the Moon lot detail, `build` and `plots` the Build tab's lines when listed there.
const CASES = [
  [
    'ready construction',
    'saloon',
    played(work('saloon', 2)),
    {},
    {
      en: {
        label: '<span class="plot-name">Saloon</span><small>Tap to finish</small>',
        moon: 'Tap to finish',
        build: '<small>Construction complete</small>',
        plots: '<small>Ready to finish</small>',
      },
      fr: {
        label: '<span class="plot-name">Saloon</span><small>Touchez pour terminer</small>',
        moon: 'Touchez pour terminer',
        build: '<small>Construction terminée</small>',
        plots: '<small>Prêt à terminer</small>',
      },
    },
  ],
  [
    'project in progress',
    'saloon',
    played(work('saloon', 1)),
    {},
    {
      en: {
        label:
          '<span class="plot-name">Saloon</span><small class="construction-count" title="Construction: 1 of 2 mining runs completed"><i data-icon="wall"></i>1/2</small>',
        moon: '1/2',
        plots: '<small>Under construction</small>',
      },
      fr: {
        label:
          '<span class="plot-name">Saloon</span><small class="construction-count" title="Construction : 1 expéditions minières terminées sur 2"><i data-icon="wall"></i>1/2</small>',
        moon: '1/2',
        plots: '<small>En construction</small>',
      },
    },
  ],
  [
    'coins stored',
    'saloon',
    played((town) => {
      town.buildings.saloon = 1;
      town.income.stored = 17;
    }),
    {},
    {
      en: {
        label: '<span class="plot-name">Saloon</span><small>Collect 17 coins</small>',
        moon: 'Collect 17 coins',
        plots: '<small>Level 1 / 3</small>',
      },
    },
  ],
  [
    'forge TNT',
    'blacksmith',
    played((town) => {
      town.buildings.blacksmith = 1;
      town.forge = { ...town.forge, charge: 1 };
    }),
    { forgeCollectible: true },
    {
      en: {
        label: '<span class="plot-name">Blacksmith</span><small>Collect 1 TNT</small>',
        moon: 'Collect 1 TNT',
        plots: '<small>Level 1 / 3</small>',
      },
    },
  ],
  [
    'need hint',
    'well',
    played(rich),
    { needChips: SHORT_WATER },
    {
      en: {
        label: '<span class="plot-name">Well</span><small class="need-hint">Water needed</small>',
        moon: 'Upgrade',
        build: '<small>Level 1 / 3</small>',
        plots: '<small>Level 1 / 3</small>',
      },
      fr: {
        label:
          '<span class="plot-name">Puits</span><small class="need-hint">Eau nécessaire</small>',
        moon: 'Améliorer',
        build: '<small>Niveau 1 / 3</small>',
        plots: '<small>Niveau 1 / 3</small>',
      },
    },
  ],
  [
    'available build',
    'farm',
    played(rich),
    {},
    {
      en: {
        label: '<span class="plot-name">Farm</span><small>Build</small>',
        moon: 'Build',
        build: '<small>Empty plot</small>',
        plots: '<small>Empty plot</small>',
      },
      fr: {
        label: '<span class="plot-name">Ferme</span><small>Construire</small>',
        moon: 'Construire',
        build: '<small>Parcelle vide</small>',
        plots: '<small>Parcelle vide</small>',
      },
    },
  ],
  [
    'available upgrade',
    'well',
    played(rich),
    {},
    {
      en: {
        label: '<span class="plot-name">Well</span><small>Upgrade</small>',
        moon: 'Upgrade',
        build: '<small>Level 1 / 3</small>',
        plots: '<small>Level 1 / 3</small>',
      },
    },
  ],
  [
    'built level',
    'well',
    played((town) => (town.buildings.well = 2)),
    {},
    {
      en: {
        label: '<span class="plot-name">Well</span><small>Lv. 2</small>',
        moon: 'Lv. 2',
        plots: '<small>Level 2 / 3</small>',
      },
      fr: {
        label: '<span class="plot-name">Puits</span><small>Niv. 2</small>',
        moon: 'Niv. 2',
        plots: '<small>Niveau 2 / 3</small>',
      },
    },
  ],
  [
    'empty suggested plot',
    'farm',
    played(),
    {},
    {
      en: {
        label: '<span class="plot-name">Farm</span><span aria-hidden="true">+</span>',
        moon: 'Coming soon',
        plots: '<small>Empty plot</small>',
      },
      fr: {
        label: '<span class="plot-name">Ferme</span><span aria-hidden="true">+</span>',
        moon: 'Bientôt',
        plots: '<small>Parcelle vide</small>',
      },
    },
  ],
  [
    'empty quiet plot',
    'stable',
    played(),
    {},
    {
      en: {
        label:
          '<span class="quiet-plot-plus" aria-hidden="true">+</span><span class="plot-name">Stables</span><span aria-hidden="true">+</span>',
        moon: 'Coming soon',
        plots: '<small>Empty plot</small>',
      },
    },
  ],
  [
    'mine',
    'mine',
    played(),
    { nextLevel: 7 },
    {
      en: { label: '<span class="plot-name">Mine</span><small>Level 7</small>' },
      fr: { label: '<span class="plot-name">Mine</span><small>Niveau 7</small>' },
    },
  ],
  [
    'later era level',
    'well',
    played(modernized(2)),
    {},
    {
      en: {
        label: '<span class="plot-name">Well</span><small>Lv. 2</small>',
        moon: 'Lv. 2',
        plots: '<small>Level 2 / 3</small>',
      },
    },
  ],
  [
    'later era complete',
    'well',
    played(modernized(3)),
    {},
    {
      en: {
        label: '<span class="plot-name">Well</span><small>Lv. 3</small>',
        moon: 'Lv. 3',
        plots: '<small>Current era complete</small>',
      },
      fr: {
        label: '<span class="plot-name">Puits</span><small>Niv. 3</small>',
        moon: 'Niv. 3',
        plots: '<small>Achevé pour cette ère</small>',
      },
    },
  ],
  [
    'later era purchase',
    'well',
    played((town) => {
      modernized(1)(town);
      rich(town);
    }),
    {},
    {
      en: {
        label: '<span class="plot-name">Well</span><small>Upgrade</small>',
        moon: 'Upgrade',
        build: '<small>Level 1 / 3</small>',
        plots: '<small>Level 1 / 3</small>',
      },
    },
  ],
  [
    'visitor sees a level',
    'well',
    played((town) => (town.buildings.well = 2)),
    { readOnly: true },
    { en: { label: '<span class="plot-name">Well</span><small>Lv. 2</small>', moon: 'Lv. 2' } },
  ],
  [
    'visitor sees an empty plot',
    'stable',
    played(),
    { readOnly: true },
    {
      en: {
        label:
          '<span class="quiet-plot-plus" aria-hidden="true">+</span><span class="plot-name">Stables</span>',
        moon: null,
      },
    },
  ],
  [
    'visitor sees a level, never the owner’s finish',
    'saloon',
    played((town) => {
      town.buildings.saloon = 1;
      work('saloon', 2)(town);
      rich(town);
    }),
    { readOnly: true },
    { en: { label: '<span class="plot-name">Saloon</span><small>Lv. 1</small>', moon: 'Lv. 1' } },
  ],
  [
    'visitor sees the mine',
    'mine',
    played(),
    { readOnly: true, nextLevel: 7 },
    { en: { label: '<span class="plot-name">Mine</span>' } },
  ],
];

// What each view shows for one plot, read exactly as the game reads it.
async function statusText(id, town, props) {
  const scene = {
    town,
    now: NOW,
    builderHammers: 0,
    forgeCollectible: false,
    needChips: [],
    ...props,
  };
  const shown = {
    label: await render(
      TownScene,
      SCENE,
      `<div v-for="anchor in [{ id: $plot }]" :key="anchor.id">${labelContents}</div>`,
      scene,
      { $plot: id },
    ).then((html) => html.replace(/^<div><button[^>]*>|<\/button><\/div>$/g, '')),
  };
  if (!BUILDING_BY_ID[id]) return shown;
  // The Moon lot labels, fed as TownMoonView feeds them. A read-only visitor sees levels
  // only there too.
  shown.moon = moonLotDetail(town, id, {
    indicators: buildingIndicators(town, scene.forgeCollectible, NOW, availablePurchases(town, 0)),
    availableIds: availablePurchases(town, 0).map((place) => place.id),
    readOnly: !!props.readOnly,
  });
  if (props.readOnly) return shown;
  useCampaignStore().town = town;
  const parcel = availableParcels(town, 0).find((place) => place.id === id);
  if (parcel)
    shown.build = await render(TownBuildRow, ROW, buildListStatus, { place: parcel, town });
  if (plotInEra(town, id))
    shown.plots = await render(
      TownView,
      VIEW,
      `<template v-for="place in [$place]" :key="place.id">${currentEraStatus}</template>`,
      {},
      { $place: BUILDING_BY_ID[id] },
    );
  return shown;
}

describe('Building status text reads the same on every map and in the Build tab', () => {
  it('draws every Build row with the shared row component', () => {
    expect(find(buildList, (node) => node.tag === 'TownBuildRow')).not.toBeNull();
    expect(find(buildList, (node) => node.tag === 'small')).toBeNull();
  });
  it.each(CASES)('%s', async (_state, id, town, props, expected) => {
    for (const [language, text] of Object.entries(expected)) {
      setLocale(language);
      expect(await statusText(id, structuredClone(town), props)).toEqual(text);
    }
  });
});
