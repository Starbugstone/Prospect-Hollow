import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import TownView from '../src/components/town/TownView.vue';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { plotInEra } from '../src/game/town/TownEras';
import { useCampaignStore } from '../src/stores/campaignStore';
import french from '../src/i18n/fr.json';
import { bound, find, renderFragment, sfc } from './helpers/componentFragments';

// The village panels and the counts the player reads in them, rendered from TownView's
// real template and setup.
const VIEW = 'src/components/town/TownView.vue';
const viewAst = sfc(VIEW).template.ast;

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

const PANELS = ['build', 'projects', 'story', 'personalise', 'monument', 'more'];
it('names the panel each village sheet close button closes, in both languages', async () => {
  const dialog = find(viewAst, (node) => node.tag === 'TownDialog');
  expect(bound(dialog, 'close-label')).toBe('dialogCloseLabel');
  const labels = {};
  for (const mode of ['building', ...PANELS]) {
    const html = await render(
      createTown(),
      '<i :data-close="dialogCloseLabel"></i>',
      (setup) => (setup.dialogMode.value = mode),
    );
    labels[mode] = html.match(/data-close="([^"]+)"/)[1];
  }
  expect(labels.building).toBe('Close building details');
  for (const mode of PANELS) expect(labels[mode]).not.toBe('Close building details');
  expect(new Set(Object.values(labels)).size).toBe(PANELS.length + 1);
  for (const label of Object.values(labels)) expect(french[label]).toMatch(/^Fermer /);
});

it('reads a Build row price and its builder hammer as words, not a bare number', async () => {
  const town = createTown();
  town.buildings.well = 1;
  town.tourSeen = true;
  // Short of coins, a plot is offered for a builder hammer.
  useCampaignStore().builderHammers = 1;
  const section = find(
    viewAst,
    (node) => node.tag === 'section' && bound(node, 'aria-label') === "t('Available buildings')",
  );
  const html = await render(town, section.loc.source);
  expect(html).toMatch(/<span class="town-sr-only">Build: [\d,]+ coins<\/span>/);
  expect(html).toContain(
    '<span aria-hidden="true">1</span><span class="town-sr-only">1 builder hammer</span>',
  );
  // Screen readers ignore aria-label on a plain span.
  expect(html).not.toMatch(/<span[^>]*aria-label/);
});

// aria-label names an element only when it has a role. A plain span or div is generic,
// so screen readers skip its label: it needs role="img" or role="group", or visible or
// visually hidden text instead.
const GENERIC = new Set(['span', 'div', 'b', 'i', 'strong', 'small', 'em', 'p']);
const attribute = (node, name) =>
  node.props?.some(
    (prop) => (prop.type === 6 && prop.name === name) || bound(node, name) !== undefined,
  );
function unnamed(node, found = []) {
  if (node.type === 1 && GENERIC.has(node.tag) && attribute(node, 'aria-label'))
    if (!attribute(node, 'role')) found.push(node.loc.source.split('\n')[0].trim());
  for (const child of node.children ?? []) if (typeof child === 'object') unnamed(child, found);
  return found;
}
it.each([
  VIEW,
  'src/components/town/TownMoonstoneBalance.vue',
  'src/components/town/TownNextStep.vue',
  'src/components/town/TownBuildRow.vue',
  'src/components/MineGoals.vue',
  'src/components/town/TownPersonalise.vue',
])('gives every labelled generic element in %s a role', (path) => {
  expect(unnamed(sfc(path).template.ast)).toEqual([]);
});
