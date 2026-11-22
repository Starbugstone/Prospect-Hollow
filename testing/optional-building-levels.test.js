import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';
import TownBuildingDetails from '../src/components/town/TownBuildingDetails.vue';
import { BUILDINGS, createTown } from '../src/data/town';
import { buildingStatus } from '../src/game/town/TownBuildingFeedback';
import { eraBuildingLevel, modernizesInEra } from '../src/game/town/TownEras';
import { townProjects } from '../src/game/town/TownProjects';

// An optional building (the Saucer Pad) an era leaves alone is not finished for it: unbuilt
// it reads as unbuilt, and built to a level it shows that level, on its map label and card.
let pinia;
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => vi.unstubAllGlobals());

const LATER_ERAS = ['hollow-rising', 'quiet-signal'];
function town(era, saucerPad) {
  const next = { ...createTown(), era };
  next.buildings.ribbonLanding = next.buildings.roverBarn = 3;
  if (saucerPad) {
    next.buildings.saucerPad = next.buildingEraLevels.saucerPad = saucerPad;
    next.buildingEras.saucerPad = 'twin-hollows';
  }
  return next;
}
async function badge(shown, id = 'saucerPad', readOnly = false) {
  const app = createSSRApp({
    render: () => h(TownBuildingDetails, { id, town: shown, readOnly }),
  });
  app.use(pinia);
  const html = await renderToString(app);
  return html.match(/<span class="town-level-badge"[^>]*>([^<]*)<\/span>/)[1];
}

describe.each(LATER_ERAS)('the Saucer Pad in %s', (era) => {
  it('reads as unbuilt before it is built', async () => {
    const shown = town(era, 0);
    expect(eraBuildingLevel(shown, 'saucerPad')).toBe(0);
    expect(await badge(shown)).toBe('Unbuilt');
    expect(await badge(shown, 'saucerPad', true)).toBe('Unbuilt');
    expect(buildingStatus(shown, 'saucerPad', { readOnly: true })).toBeNull();
  });

  it('shows the level it was built to, on the map and its card', async () => {
    const shown = town(era, 1);
    expect(eraBuildingLevel(shown, 'saucerPad')).toBe(1);
    expect(buildingStatus(shown, 'saucerPad', { readOnly: true }).text).toBe('Lv. 1');
    expect(await badge(shown)).toBe('Twin Hollows · Level 1 of 3');
    // A save whose era level is missing keeps the built level.
    delete shown.buildingEraLevels.saucerPad;
    expect(eraBuildingLevel(shown, 'saucerPad')).toBe(1);
  });

  it('still shows a pad finished in Twin Hollows as finished', async () => {
    const shown = town(era, 3);
    expect(eraBuildingLevel(shown, 'saucerPad')).toBe(3);
    expect(buildingStatus(shown, 'saucerPad', { readOnly: true }).text).toBe('Lv. 3');
  });
});

// Required buildings an era leaves alone were finished before the era opened, as the server
// also counts them (SaveIntegrity::eraLevel), even when an older save normalized their era
// level to 1; their projects and badges are unchanged.
it.each(LATER_ERAS)('keeps required buildings %s leaves alone finished', async (era) => {
  const shown = town(era, 0);
  const required = BUILDINGS.filter(
    ({ id, introducedEra, requiredForEraCompletion }) =>
      requiredForEraCompletion !== false && introducedEra !== era && !modernizesInEra(era, id),
  );
  expect(required.length).toBeGreaterThan(0);
  for (const { id } of required) {
    shown.buildingEraLevels[id] = 1;
    expect(eraBuildingLevel(shown, id), id).toBe(3);
  }
  for (const project of townProjects(shown))
    for (const building of project.buildings)
      if (required.some(({ id }) => id === building.id)) expect(building.level).toBe(3);
});

it('keeps the level count of an empty plot in the era on screen', async () => {
  expect(await badge(town('hollow-rising', 0), 'moonballField')).toBe(
    'New Hollow Rising · Level 0 of 3',
  );
});
