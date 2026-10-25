import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';
import TownScene from '../src/components/town/TownScene.vue';
import TownSettlementNotice from '../src/components/town/TownSettlementNotice.vue';
import TownMoonView from '../src/components/town/TownMoonView.vue';
import TownView from '../src/components/town/TownView.vue';
import { SETTLEMENTS, settlementOf } from '../src/data/settlements';
import { MOONSTONE_BUILDINGS, MOON_BUILDINGS, createTown } from '../src/data/town';
import { vipVisitBuildings } from '../src/data/vipVisits';
import { townEventStage } from '../src/game/town/TownEventSettlement';
import { useCampaignStore } from '../src/stores/campaignStore';
import { renderFragment } from './helpers/componentFragments';

// AGENTS.md (maintainable era and feature evolution): a new settlement needs only its
// registry entry. Here the game's registry gains a hypothetical Red Hollow on Mars, drawn
// with the Moon's kind of map, and an outpost with nothing but an id. Every shared reader
// (event routing, notices, the Build list order, the map on screen, moonstones and VIP
// spending) picks them up without another edit.
const ADDED = vi.hoisted(() => [
  {
    id: 'mars',
    map: 'moon',
    art: 'moon',
    moonstones: true,
    labels: {
      happening: 'Something is happening on Mars',
      waiting: 'Mars event waiting',
      monument: 'A monument for Red Hollow',
    },
    vipBuildings: ['marsMarket'],
  },
  { id: 'outpost' },
]);
vi.mock('../src/data/settlements', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ...actual.createSettlementRegistry([...actual.SETTLEMENT_DEFINITIONS, ...ADDED]),
  };
});

let pinia;
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => vi.unstubAllGlobals());

const DEFINITIONS = {
  mars: { id: 'mars-landing', settlement: 'mars' },
  outpost: { id: 'outpost-show', settlement: 'outpost' },
};
const stage = (settlement, presentations) =>
  townEventStage({
    town: { ...createTown(), presentations },
    settlement,
    definitions: DEFINITIONS,
  });

it('adds the settlement with its facts and the defaults of an incomplete entry', () => {
  expect(SETTLEMENTS.map(({ id }) => id)).toEqual(['valley', 'moon', 'mars', 'outpost']);
  expect(settlementOf({ settlement: 'mars' })).toMatchObject({ map: 'moon', moonstones: true });
  expect(settlementOf({ settlement: 'outpost' })).toMatchObject({
    map: null,
    moonstones: false,
    vipBuildings: [],
  });
  // No shipped building moves: the lists stay as they were.
  expect(MOONSTONE_BUILDINGS).toEqual(MOON_BUILDINGS.map(({ id }) => id));
  const town = { buildings: { marsMarket: 1 }, projects: {} };
  expect(vipVisitBuildings(town, 'mars')).toEqual(['marsMarket']);
  expect(vipVisitBuildings(town)).toEqual(['marsMarket']);
});

it('plays its events on its own map and invites the other settlements there', () => {
  const pending = { 'mars-landing': 'pending' };
  expect(stage('mars', pending).presentation).toBe(DEFINITIONS.mars);
  for (const elsewhere of ['valley', 'moon'])
    expect(stage(elsewhere, pending).waiting).toEqual({
      key: 'mars-mars-landing',
      settlement: 'mars',
    });
  // A settlement without a map shows its events in the valley.
  const outpost = { 'outpost-show': 'pending' };
  expect(stage('valley', outpost).presentation).toBe(DEFINITIONS.outpost);
  expect(stage('mars', outpost).waiting.settlement).toBe('valley');
});

it('names its own notice, and an unknown destination reads as the valley', async () => {
  const notice = (destination) =>
    renderToString(createSSRApp({ render: () => h(TownSettlementNotice, { destination }) }));
  expect(await notice('mars')).toContain('Something is happening on Mars');
  expect(await notice('pluto')).toContain('Something is happening in the valley');
});

it('lists its places first in the Build tab while it is on screen', async () => {
  useCampaignStore().town = createTown();
  const rows = [{ id: 'well' }, { id: 'dome', settlement: 'mars' }, { id: 'pad' }];
  const order = (settlement) =>
    renderFragment({
      component: TownView,
      path: 'src/components/town/TownView.vue',
      template: '<i v-for="row in hereFirst($rows)" :key="row.id">{{ row.id }}</i>',
      pinia,
      globals: { $rows: rows },
      prepare: (setup) => (setup.settlement.value = settlement),
    });
  expect(await order('mars')).toBe('<i>dome</i><i>well</i><i>pad</i>');
  expect(await order('valley')).toBe('<i>well</i><i>pad</i><i>dome</i>');
});

it('draws it with the map its entry names, and keeps the valley for one without a map', async () => {
  vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} });
  let state;
  await renderFragment({
    component: TownScene,
    path: 'src/components/town/TownScene.vue',
    template: '<div />',
    props: { town: { ...createTown(), era: 'twin-hollows' }, now: 0, needChips: [] },
    pinia,
    prepare(setup) {
      state = setup;
      state.scene = { setCovered: vi.fn(), setMotion: vi.fn(), projectVillager: vi.fn() };
    },
  });
  expect(state.mapOf('mars')).toBe(TownMoonView);
  expect(state.mapOf('outpost')).toBeNull();
  // Red Hollow has no plots yet, so it cannot open; the Moon still does.
  state.showSettlement('mars');
  expect(state.shown.value).toBe('valley');
  state.showSettlement('moon');
  expect(state.shown.value).toBe('moon');
  state.showSettlement('outpost');
  expect(state.shown.value).toBe('valley');
});
