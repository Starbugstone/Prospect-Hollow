import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as Vue from 'vue';
import { renderToString } from 'vue/server-renderer';
import { compileScript } from 'vue/compiler-sfc';
import App from '../src/App.vue';
import TownMuseum from '../src/components/town/TownMuseum.vue';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';
import { MOONSTONE_ECONOMY } from '../src/data/moonstones';
import { CONTINUOUS_COIN_CAP } from '../src/data/rewards';
import { find, sfc } from './helpers/componentFragments';

const GEM_CAP =
  MOONSTONE_ECONOMY.continuousGemsPerPuzzle * MOONSTONE_ECONOMY.continuousPuzzlesPerLevel;
const full = () => ({ coins: CONTINUOUS_COIN_CAP, moonstoneGems: GEM_CAP, score: 0 });
let pinia, campaign, game;
beforeEach(() => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  vi.stubGlobal('document', { activeElement: null });
  vi.stubGlobal('location', { pathname: '/play' });
  vi.stubGlobal('window', { scrollTo: vi.fn(), dispatchEvent: vi.fn() });
  pinia = createPinia();
  setActivePinia(pinia);
  campaign = useCampaignStore();
  game = useGameStore();
  campaign.town.buildings.museum = 1;
  campaign.records = { 1: { score: 100, stars: 1 }, 2: { score: 200, stars: 2 } };
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('shared continuous completion and navigation', () => {
  it('finishes on coins alone before the workshop is built', () => {
    campaign.continuousRecords = { 1: full(), 2: { coins: 25, score: 0 } };
    expect(campaign.unfinishedContinuousLevels).toEqual([3]);
    expect(campaign.nextContinuousLevel()).toBe(3);
  });
  it('keeps coin-complete levels unfinished until their workshop gems are credited', () => {
    campaign.town.buildings.moonstoneWorkshop = 1;
    campaign.continuousRecords = { 1: full(), 2: { coins: 25, moonstoneGems: 899, score: 0 } };
    expect(campaign.unfinishedContinuousLevels).toEqual([2, 3]);
    campaign.continuousRecords[2].moonstoneGems = GEM_CAP;
    campaign.continuousRecords[1].coins = 24;
    expect(campaign.unfinishedContinuousLevels).toEqual([1, 3]);
  });
  it('skips locked levels and requires the museum to allow replay', () => {
    expect(campaign.unfinishedContinuousLevels).toEqual([1, 2, 3]);
    campaign.town.buildings.museum = 0;
    expect(campaign.unfinishedContinuousLevels).toEqual([]);
    expect(campaign.nextContinuousLevel()).toBeNull();
  });
  it('follows level order and wraps, without offering the current level as its own next', () => {
    expect(campaign.nextContinuousLevel()).toBe(1);
    expect(campaign.nextContinuousLevel(1)).toBe(2);
    expect(campaign.nextContinuousLevel(2)).toBe(3);
    expect(campaign.nextContinuousLevel(3)).toBe(1);
    campaign.continuousRecords = { 1: full(), 2: full() };
    expect(campaign.nextContinuousLevel(1)).toBe(3);
    expect(campaign.nextContinuousLevel(3)).toBeNull();
  });
  it('returns null when every unlocked level is finished', () => {
    campaign.continuousRecords = { 1: full(), 2: full(), 3: full() };
    expect(campaign.nextContinuousLevel()).toBeNull();
    expect(campaign.nextContinuousLevel(2)).toBeNull();
  });
});

// Compile the real template to retain its click handlers in the rendered VNodes.
// SSR avoids a fake browser and runs the actual setup, getters and run lifecycle.
async function render(component, file, { fragment, prepare, onContinuous } = {}) {
  const path = new URL(file, import.meta.url).pathname;
  const descriptor = sfc(path);
  const template = fragment
    ? find(descriptor.template.ast, (node) =>
        node.props?.some((prop) => prop.name === 'class' && prop.value?.content === fragment),
      ).loc.source
    : descriptor.template.content;
  let state, instance;
  const harness = {
    ...component,
    ssrRender: undefined,
    setup(props, context) {
      state = component.setup(props, context);
      prepare?.(state);
      return state;
    },
    created() {
      instance = this.$;
    },
    render: Vue.compile(template, {
      prefixIdentifiers: true,
      bindingMetadata: compileScript(descriptor, { id: path }).bindings,
    }),
  };
  const app = Vue.createSSRApp({ render: () => Vue.h(harness, { onContinuous }) });
  app.use(pinia);
  const html = await renderToString(app);
  return { html, state, tree: instance.subTree };
}
const label = (vnode) =>
  typeof vnode.children === 'string'
    ? vnode.children
    : Array.isArray(vnode.children)
      ? vnode.children.map(label).join('')
      : '';
function button(tree, text) {
  if (tree.type === 'button' && label(tree).includes(text)) return tree;
  for (const child of Array.isArray(tree.children) ? tree.children : []) {
    const found = button(child, text);
    if (found) return found;
  }
  return null;
}
const museum = (prepare, onContinuous) =>
  render(TownMuseum, '../src/components/town/TownMuseum.vue', { prepare, onContinuous });
const banner = () => render(App, '../src/App.vue', { fragment: 'continuous-banner' });

describe('museum continuous controls', () => {
  it('starts the first unfinished level through the same continuous event as the grid', async () => {
    campaign.continuousRecords[1] = full();
    const play = vi.fn();
    const normal = await museum();
    expect(button(normal.tree, 'Next unfinished level')).toBeNull();
    button(normal.tree, 'Continuous play').props.onClick();
    expect(normal.state.mode.value).toBe('continuous');
    const continuous = await museum((state) => (state.mode.value = 'continuous'), play);
    const next = button(continuous.tree, 'Next unfinished level');
    expect(next).not.toBeNull();
    next.props.onClick();
    expect(play).toHaveBeenCalledExactlyOnceWith(2);
  });
  it('filters out finished and locked levels while retaining gem-unfinished levels', async () => {
    campaign.town.buildings.moonstoneWorkshop = 1;
    campaign.continuousRecords = { 1: full(), 2: { coins: 25, score: 0 } };
    const all = await museum((state) => (state.mode.value = 'continuous'));
    const filter = button(all.tree, 'Unfinished');
    expect(filter).not.toBeNull();
    filter.props.onClick();
    expect(all.state.visibleLevels.value).toEqual([2, 3]);
    const filtered = await museum((state) => {
      state.mode.value = 'continuous';
      state.continuousShow.value = 'unfinished';
    });
    expect(filtered.html).not.toContain('Continuous play, level 1:');
    expect(filtered.html).toContain('Continuous play, level 2:');
    expect(filtered.html).toContain('Continuous play, level 3:');
    expect(filtered.html).not.toContain('Continuous play, level 4:');
  });
  it('replaces the start button with a completion line when finished', async () => {
    campaign.continuousRecords = { 1: full(), 2: full(), 3: full() };
    const result = await museum((state) => (state.mode.value = 'continuous'));
    expect(button(result.tree, 'Next unfinished level')).toBeNull();
    expect(result.html).toContain('Every unlocked level has its continuous rewards.');
  });
});

describe('continuous banner', () => {
  beforeEach(() => {
    game.startLevel(1, 'continuous', { seed: 123 });
    game.animationInProgress = false;
  });
  it('shows workshop gems only with a workshop and reads live credited records', async () => {
    expect((await banner()).html).not.toContain('workshop gems for this level');
    campaign.town.buildings.moonstoneWorkshop = 1;
    expect((await banner()).html).toContain('0/900 workshop gems for this level');
    campaign.recordContinuous({ id: 1, runId: game.runId, jewels: 291, score: 100 });
    const result = await banner();
    expect(result.html).toContain('291/900 workshop gems for this level');
    expect(result.html).toContain('25/25 coins saved for this level');
    expect(result.html).toMatch(/role="status"[^>]*>291\/900/);
  });
  it('settles the old run before issuing exactly one new continuous run', async () => {
    const oldRun = game.runId;
    const events = [];
    campaign.$onAction(({ name }) => {
      if (['endRun', 'beginRun', 'recordContinuous'].includes(name)) events.push(name);
      if (name === 'beginRun') expect(campaign.activeRun).toBeNull();
    });
    game.score = 777;
    const result = await banner();
    const next = button(result.tree, 'Next level');
    expect(next).not.toBeNull();
    next.props.onClick();
    expect(events).toEqual(['endRun', 'recordContinuous', 'beginRun']);
    expect(campaign.continuousRecords[1].score).toBe(777);
    expect(game.currentLevelId).toBe(2);
    expect(game.playMode).toBe('continuous');
    expect(game.runId).toBe(oldRun + 1);
    next.props.onClick();
    expect(game.runId).toBe(oldRun + 1);
  });
  it('disables next during animation and guards even a direct handler invocation', async () => {
    game.animationInProgress = true;
    const oldRun = game.runId;
    const result = await banner();
    const next = button(result.tree, 'Next level');
    expect(next).not.toBeNull();
    expect(next.props.disabled).toBe(true);
    next.props.onClick();
    expect(game.runId).toBe(oldRun);
    expect(game.currentLevelId).toBe(1);
  });
  it('hides next when there is no other unfinished level', async () => {
    campaign.continuousRecords = { 2: full(), 3: full() };
    expect(button((await banner()).tree, 'Next level')).toBeNull();
  });
});
