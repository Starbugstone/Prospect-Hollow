import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';
import TownBuildingDetails from '../src/components/town/TownBuildingDetails.vue';
import { ERA_BY_ID } from '../src/data/eras';
import { BUILDINGS, BUILDING_BY_ID, createTown } from '../src/data/town';
import { finishEra, plotInEra } from '../src/game/town/TownEras';
import { setLocale, t } from '../src/i18n';

// A building card's caption under its drawing names the era and level the drawing shows,
// the same ones as its badge: a Great Telescope modernized for the Moonward Age is not
// captioned with the Stargazer Age that introduced it.
let pinia;
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => {
  setLocale('en');
  vi.unstubAllGlobals();
});

// Every plot of `era` built and finished for it, as a finished town stands.
function finishedTown(era) {
  const town = { ...createTown(), era, coins: 0, tourSeen: true };
  for (const building of BUILDINGS) {
    if (!plotInEra(town, building.id)) continue;
    town.buildings[building.id] = building.upgrades.length;
    town.buildingEras[building.id] = finishEra(building.id, era);
    town.buildingEraLevels[building.id] = 3;
  }
  return town;
}
async function card(town, id) {
  const app = createSSRApp({ render: () => h(TownBuildingDetails, { id, town, readOnly: true }) });
  app.use(pinia);
  const html = await renderToString(app);
  const caption = html.match(/<\/svg><small[^>]*>([^<]*)<\/small>/);
  const badge = html.match(/<span class="town-level-badge"[^>]*>([^<]*)<\/span>/);
  return { caption: caption?.[1], badge: badge?.[1] };
}
const decode = (text) => text.replace(/&#39;/g, "'").replace(/&amp;/g, '&');

it.each(['en', 'fr'])(
  'captions a modernized Great Telescope with its drawn era (%s)',
  async (lang) => {
    setLocale(lang);
    const town = finishedTown('moonward');
    expect(town.buildingEras.greatTelescope).toBe('moonward');
    const { caption, badge } = await card(town, 'greatTelescope');
    const era = t(ERA_BY_ID.moonward.label);
    expect(decode(caption)).toBe(t('{era} · Level {level}', { era, level: 3 }));
    expect(decode(badge)).toBe(t('{era} · Level {level} of {max}', { era, level: 3, max: 3 }));
    expect(decode(caption)).not.toContain(t(ERA_BY_ID.stargazer.label));
  },
);

it('captions a building in the era that introduced it as before', async () => {
  const town = finishedTown('stargazer');
  const { caption } = await card(town, 'greatTelescope');
  expect(caption).toBe('Stargazer Age · Level 3');
});

it('keeps the named stages of buildings that have them', async () => {
  const town = finishedTown('moonward');
  const { caption } = await card(town, 'well');
  expect(caption).toBe(BUILDING_BY_ID.well.stages[town.buildings.well]);
});

// Every building whose stages name an era and level, from the River & Rail Age on, not only
// the city's: a River & Rail depot modernized for the Moonward Age names the Moonward Age.
it('captions every modernized era-and-level building with its drawn era', async () => {
  const town = finishedTown('moonward');
  const modernized = BUILDINGS.filter(
    ({ id, introducedEra, stages }) =>
      town.buildings[id] &&
      town.buildingEras[id] !== introducedEra &&
      stages.slice(1).every((name) => / · Level \d+$/.test(name)),
  );
  expect(modernized.map(({ id }) => id)).toContain('railDepot');
  for (const { id, introducedEra } of modernized) {
    const { caption, badge } = await card(town, id);
    const drawn = t(ERA_BY_ID[town.buildingEras[id]].label);
    expect(decode(caption), id).toBe(t('{era} · Level {level}', { era: drawn, level: 3 }));
    expect(decode(badge), id).toContain(drawn);
    expect(decode(caption), id).not.toContain(t(ERA_BY_ID[introducedEra].label));
  }
});
