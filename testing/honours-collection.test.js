import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  HONOURS,
  awardHonour,
  createHonours,
  honourCollection,
  maxPowerCapacity,
  validShowcase,
} from '../src/data/honours';
import { elementLevels } from '../src/data/honourLevels';
import { ERA_BY_ID, ERAS } from '../src/data/eras';
import { POWERS } from '../src/data/campaign';
import { villageHonours } from '../src/services/publicVillage';
import { setLocale } from '../src/i18n';
import fr from '../src/i18n/fr.json';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import HonourCollectionList from '../src/components/honours/HonourCollectionList.vue';
import HonourDetail from '../src/components/honours/HonourDetail.vue';
import HonourGallery from '../src/components/honours/HonourGallery.vue';
import HonourShowcaseEditor from '../src/components/honours/HonourShowcaseEditor.vue';
import HonourShowcaseSlots from '../src/components/honours/HonourShowcaseSlots.vue';
import HonourAccountSection from '../src/components/honours/HonourAccountSection.vue';
import TownMoreMenu from '../src/components/town/TownMoreMenu.vue';
import {
  CATEGORY_LABELS,
  honourSummary,
  moveSlot,
  unseenIds,
} from '../src/components/honours/honourDisplay';

const OCT_2 = Date.UTC(2026, 9, 2, 12);
const render = (component, props, pinia) =>
  renderToString(
    (() => {
      const app = createSSRApp({ render: () => h(component, props) });
      if (pinia) app.use(pinia);
      return app;
    })(),
  );
// One card of the rendered collection, by honour family.
const card = (html, id) =>
  html.match(new RegExp(`<article[^>]*data-honour="${id}"[\\s\\S]*?</article>`))?.[0];
const { levels: storage } = maxPowerCapacity();
const firstLevel = (element) => elementLevels(element).levels[0];

// A Connected City town: earned (dated and backfilled), fresh, locked and medal states.
function townState() {
  let honours = createHonours();
  honours = awardHonour(honours, 'first-perfect', { backfilled: true });
  honours = awardHonour(honours, 'score-ace', {
    at: OCT_2,
    evidence: { levelId: 88, score: 61400, target: 30600 },
  });
  honours = awardHonour(honours, 'defence-frontier', { at: OCT_2 });
  honours.earned['first-perfect'].seen = true;
  honours.earned['defence-frontier'].seen = true;
  honours.fusions = ['bomb+bomb', 'bomb+cross', 'cross+cross', 'cross+rainbow'];
  honours.counts.mine = { lanterns: 52 };
  honours.counts.gems = { sapphire: 9830 };
  honours.showcase = ['score'];
  return {
    honours,
    records: { 1: { stars: 3, score: 900 } },
    town: { era: 'contemporary', buildings: { armory: storage.armory, garage: 1 } },
    powers: POWERS.map((power, index) => ({ id: power.id, quantity: index < 3 ? 26 : 4 })),
    nextLevel: firstLevel('lanterns') + 1,
  };
}
const collection = (state, props = {}) =>
  render(HonourCollectionList, {
    tabs: honourCollection(state),
    state,
    showcase: state.honours.showcase,
    fresh: ['score'],
    showNew: true,
    links: true,
    canReplay: true,
    ...props,
  });

afterEach(() => setLocale('en'));

describe('The honours collection', () => {
  it('shows earned honours first in full colour with their date or an unknown date', async () => {
    const html = await collection(townState());
    const score = card(html, 'score');
    expect(score).not.toContain('honour-badge-locked');
    expect(score).toContain('is-earned');
    expect(score).toContain('Earned ');
    expect(score).toContain('61,400 on level 88 (target 30,600)');
    expect(score).toContain('Next rank · Score Legend — Three times the star target');
    expect(score).toContain('Best so far');
    expect(score).toContain('New');
    expect(card(html, 'first-perfect')).toContain('Earned before honours were introduced');
    expect(card(html, 'first-perfect')).not.toContain('>New<');
    // Earned families lead the grid.
    const order = [...html.matchAll(/data-honour="([\w-]+)"/g)].map((match) => match[1]);
    expect(order.slice(0, 2).sort()).toEqual(['first-perfect', 'score']);
  });

  it('keeps unearned honours locked but readable, with requirement, progress and status', async () => {
    const html = await collection(townState());
    const fusion = card(html, 'fusion-master');
    expect(fusion).toContain('honour-badge-locked');
    expect(fusion).toContain('Perform all 6 bonus fusions in puzzles you complete.');
    expect(fusion).toContain('4 / 6 fusions');
    expect(fusion).toContain('Bomb + Rainbow');
    expect((fusion.match(/is-done/g) ?? []).length).toBe(4);
    expect(card(html, 'laureate-sapphire')).toContain('9,830 / 12,000 sapphires collected');
    const quartermaster = card(html, 'master-quartermaster');
    expect(quartermaster).toContain('Armory fully upgraded');
    expect(quartermaster).toContain(`Garage level 1 of ${storage.garage}`);
    expect(quartermaster).toContain('All 5 powers at 26 at the same time');
    expect(quartermaster).toContain('3 / 5 powers full');
    expect(card(html, 'town-complete')).toContain('Era 8 of 11 · Connected City');
    expect(card(html, 'forge-veteran')).toContain('Blacksmith details');
    expect(card(html, 'master-quartermaster')).toContain('Open supplies');
    expect(card(html, 'perfect-prospector')).toContain('Show levels below three stars');
  });

  it('shows where mine honours are found and whether the player got there yet', async () => {
    const state = townState();
    const html = await collection(state, { tab: 'mine' });
    const lanterns = elementLevels('lanterns');
    const lamplighter = card(html, 'lamplighter');
    expect(lamplighter).toContain('52 / 125 lanterns lit');
    expect(lamplighter).toContain(
      `${lanterns.levels.length} levels · chapters ${lanterns.chapters[0]}–${lanterns.chapters[1]}`,
    );
    expect(lamplighter).not.toContain('not reached yet');
    expect(lamplighter).toContain('Show these levels in the museum');
    const gates = card(html, 'gate-breaker');
    expect(firstLevel('gates')).toBeGreaterThan(state.nextLevel);
    expect(gates).toContain('not reached yet');
    expect(gates).not.toContain('Show these levels in the museum');
    // Without a museum there is nowhere to replay.
    expect(
      card(await collection(state, { tab: 'mine', canReplay: false }), 'lamplighter'),
    ).not.toContain('Show these levels in the museum');
  });

  it('gives era medals their recorded, current and future statuses', async () => {
    const html = await collection(townState(), { tab: 'defence' });
    expect(card(html, 'defence-frontier')).toContain('Earned ');
    expect(card(html, 'defence-industrial')).toContain('No recorded defence');
    const current = card(html, 'defence-contemporary');
    expect(current).toContain('is-current');
    expect(current).toContain('Fully protect the town from a river storm in this era.');
    expect(card(html, 'defence-tomorrow')).toContain(`Reach ${ERA_BY_ID.tomorrow.label}`);
  });

  it('counts each tab and hides New indicators when notices are off', async () => {
    const state = townState();
    const tabs = honourCollection(state);
    const html = await collection(state);
    for (const tab of tabs) expect(html).toContain(`${tab.earned}/${tab.total}`);
    expect(html).toContain('honour-dot');
    const quiet = await collection(state, { showNew: false });
    expect(quiet).not.toContain('honour-dot');
    expect(quiet).not.toContain('honour-new');
    // Viewing a tab marks only its unseen honours.
    expect(unseenIds(tabs[0])).toEqual(['score-ace']);
    expect(unseenIds(tabs[2])).toEqual([]);
    expect(honourSummary(state.honours)).toEqual({
      earned: 3,
      total: HONOURS.families.length,
      fresh: 1,
    });
  });

  it('shows any ranked family at its highest rank with the next rank and its progress', async () => {
    // Shaped like a visitors family: four ranks counting distinct visitors.
    const ranks = [
      ['first-guest', 1, 'easy'],
      ['welcoming-host', 5, 'medium'],
      ['popular-destination', 15, 'medium'],
      ['celebrated-town', 30, 'hard'],
    ].map(([id, goal, difficulty], index) => ({
      id,
      family: 'visitors',
      rank: index + 1,
      category: 'achievement',
      difficulty,
      version: 1,
      name: id,
      requirement: 'Welcome {goal} different visitors.',
      popup: '{goal} visitors welcomed',
      params: () => ({ goal }),
      progress: (state) => ({ value: state.visitors, goal }),
      art: { frame: difficulty, glyph: 'guests' },
    }));
    const catalog = { families: [{ id: 'visitors', category: 'achievement', ranks }] };
    const state = {
      ...townState(),
      visitors: 3,
      honours: awardHonour(createHonours(), 'first-guest', { at: OCT_2 }),
    };
    const html = await render(HonourCollectionList, {
      tabs: honourCollection(state, catalog),
      state,
    });
    const visitors = card(html, 'visitors');
    expect(visitors).toContain('first-guest');
    expect(visitors).toContain('Welcome 1 different visitors.');
    expect(visitors).toContain('Next rank · welcoming-host — 5 visitors welcomed');
    expect(visitors).toContain('3 / 5 visitors welcomed');
    expect(visitors).toContain('aria-valuemax="5"');
    expect(visitors).not.toContain('Best so far');
    const locked = { ...state, honours: createHonours() };
    const first = card(
      await render(HonourCollectionList, {
        tabs: honourCollection(locked, catalog),
        state: locked,
      }),
      'visitors',
    );
    expect(first).toContain('honour-badge-locked');
    expect(first).toContain('3 / 1 visitors welcomed');
    expect(first).not.toContain('Next rank');
  });

  it('filters to earned or not yet earned honours', async () => {
    const ids = (html) => [...html.matchAll(/data-honour="([\w-]+)"/g)].map((match) => match[1]);
    const state = townState();
    expect(ids(await collection(state, { filter: 'earned' })).sort()).toEqual([
      'first-perfect',
      'score',
    ]);
    const open = ids(await collection(state, { filter: 'open' }));
    expect(open).toHaveLength(
      HONOURS.families.filter((f) => f.category === 'achievement').length - 2,
    );
    expect(open).not.toContain('score');
    expect(await collection(state, { tab: 'mine', filter: 'earned' })).toContain(
      'Nothing earned here yet.',
    );
  });

  it('translates nested names and every collection string into French', async () => {
    const sources = [
      ...readdirSync('src/components/honours').map((file) => `src/components/honours/${file}`),
      'src/components/town/TownMoreMenu.vue',
      'src/components/community/VillageVisit.vue',
    ];
    const missing = sources.flatMap((file) =>
      translatable(readFileSync(file, 'utf8')).filter((message) => !Object.hasOwn(fr, message)),
    );
    expect([...new Set(missing)]).toEqual([]);
    setLocale('fr');
    const html = await collection(townState(), { tab: 'defence' });
    expect(html).toContain(fr['Era defence']);
    expect(html).toContain(fr['No recorded defence']);
    expect(card(html, 'defence-contemporary')).toContain(fr['river storm']);
  });
});

// Every literal inside t(…) plus the label tables the components translate later.
function translatable(source) {
  const messages = [];
  for (const match of source.matchAll(/\bt\(/g)) {
    let depth = 0,
      end = match.index + 1;
    for (; end < source.length; end++) {
      if (source[end] === '(') depth++;
      else if (source[end] === ')' && --depth === 0) break;
    }
    const call = source.slice(match.index + 2, end);
    // Only the message argument: stop at the values object.
    const message = call.split(/,\s*\{/)[0];
    for (const literal of message.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g))
      messages.push(literal[1] ?? literal[2]);
  }
  for (const match of source.matchAll(
    /const (?:DIFFICULTIES|CATEGORY_LABELS|BONUS_NAMES|COUNTERS|INTROS|NOTES) = \{([\s\S]*?)\n\};/g,
  ))
    for (const literal of match[1].matchAll(/:\s*'((?:[^'\\]|\\.)*)'/g)) messages.push(literal[1]);
  for (const literal of source.matchAll(/\blabel: '((?:[^'\\]|\\.)*)'/g)) messages.push(literal[1]);
  return messages.filter((message) => /[A-Za-z]/.test(message) && !/^[a-z-]+$/.test(message));
}

describe('The showcase', () => {
  beforeEach(() => {
    const saved = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('offers three empty slots before anything is shown', async () => {
    const html = await render(HonourShowcaseSlots, { ids: [], earned: {}, addable: true });
    expect((html.match(/is-empty/g) ?? []).length).toBe(3);
    expect((html.match(/Add an earned honour/g) ?? []).length).toBe(3);
    expect(await render(HonourShowcaseSlots, { ids: [], earned: {} })).toContain('Empty slot');
    expect(await render(HonourShowcaseSlots, { ids: [], earned: {}, compact: true })).not.toContain(
      '<li',
    );
  });

  it('accepts only earned families and shows each slot at its highest rank', async () => {
    const { honours } = townState();
    expect(
      validShowcase(['score', 'lamplighter', 'score', 'nope', 'first-perfect'], honours),
    ).toEqual(['score', 'first-perfect']);
    const upgraded = awardHonour(honours, 'score-legend', { at: OCT_2 });
    const html = await render(HonourShowcaseSlots, { ids: ['score'], earned: upgraded.earned });
    expect(html).toContain('Score Legend');
    expect(html).toContain('3×');
    expect(moveSlot(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveSlot(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });

  it('manages the order with labelled move and remove controls', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const campaign = useCampaignStore();
    campaign.honours = { ...townState().honours, showcase: ['score', 'first-perfect'] };
    const html = await render(HonourShowcaseEditor, {}, pinia);
    expect(html).toContain('aria-label="Move Score Ace earlier"');
    expect(html).toMatch(/data-action="earlier" aria-disabled="true"/);
    expect(html).toContain('Remove First Perfect from the showcase');
    // Earned but not shown: offered for an empty slot.
    expect(html).toContain('Frontier Guardian');
    expect(campaign.setHonourShowcase(['first-perfect', 'score'])).toBe(true);
    expect(campaign.honours.showcase).toEqual(['first-perfect', 'score']);
  });

  it('shows a locked detail with where to progress and no showcase choice', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const campaign = useCampaignStore();
    const state = townState();
    campaign.honours = state.honours;
    const html = await render(HonourDetail, { familyId: 'lamplighter', links: true }, pinia);
    expect(html).toContain('honour-badge-locked');
    expect(html).toContain('Light 125 lanterns in completed puzzles.');
    expect(html).toContain('52 / 125 lanterns lit');
    expect(html).toContain('Where to make progress');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Add to showcase/);
    expect(html).toContain('Earn this honour to show it to visitors.');
    const score = await render(HonourDetail, { familyId: 'score' }, pinia);
    expect(score).toContain('61,400 on level 88 (target 30,600)');
    // Every rank's requirement, then the next rank and its progress.
    expect(score).toContain(
      'Complete a puzzle from level 37 onward with 2× its star score target.',
    );
    expect(score).toContain(
      'Complete a puzzle from level 37 onward with 3× its star score target.',
    );
    expect(score).toContain('Next rank · Score Legend');
    expect(score).toContain('Remove from showcase');
  });

  it('summarizes honours in town management with what visitors see', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useCampaignStore().honours = townState().honours;
    const html = await render(HonourAccountSection, { town: 'Willowbrook', shared: true }, pinia);
    expect(html).toContain(`3 of ${HONOURS.families.length} honours earned`);
    expect(html).toContain('1 new');
    expect(html).toContain('What visitors see');
    expect(html).toContain('Willowbrook');
    expect(html).toContain('Open collection');
    useSettingsStore().setHonourNotices('off');
    expect(await render(HonourAccountSection, { town: 'Willowbrook' }, pinia)).not.toContain(
      '1 new',
    );
  });

  it('adds Honours to the More menu for every player', async () => {
    const html = await render(TownMoreMenu, { honours: { earned: 3, total: 32, fresh: 1 } });
    expect(html).toContain('Honours');
    expect(html).toContain('3/32 earned');
    expect(html).toContain('town-more-new');
  });
});

describe('Visiting a town’s honours', () => {
  const village = (honours) => ({ appearance: { era: 'frontier', honours } });

  it('treats a missing field as unknown and an empty one as nothing earned yet', async () => {
    expect(villageHonours(village(undefined))).toBeNull();
    expect(villageHonours(village([]))).toBeNull();
    const empty = villageHonours(village({ version: 1, earned: {}, showcase: [] }));
    expect(empty).toEqual({ version: 1, earned: {}, showcase: [] });
    const html = await render(HonourGallery, { honours: empty, town: 'Willowbrook' });
    expect(html).toContain('No honours earned yet');
    expect(html).not.toContain('honour-gallery-group');
  });

  it('keeps known earned honours, public score evidence and an earned showcase only', async () => {
    const normalized = villageHonours(
      village({
        version: 1,
        earned: {
          'score-ace': { at: OCT_2, evidence: { levelId: 88, score: 61400, target: 30600 } },
          'first-perfect': { at: null, evidence: { levelId: 3, score: 1, target: 1 } },
          'defence-frontier': { at: 'yesterday' },
          'from-the-future': { at: OCT_2 },
          constructor: { at: OCT_2 },
        },
        showcase: ['lamplighter', 'score', 'score', 7, 'first-perfect', 'defence-frontier'],
      }),
    );
    expect(Object.keys(normalized.earned).sort()).toEqual([
      'defence-frontier',
      'first-perfect',
      'score-ace',
    ]);
    expect(normalized.earned['first-perfect']).toEqual({ at: null });
    expect(normalized.earned['defence-frontier']).toEqual({ at: null });
    expect(normalized.earned['score-ace'].evidence).toEqual({
      levelId: 88,
      score: 61400,
      target: 30600,
    });
    expect(normalized.showcase).toEqual(['score', 'first-perfect', 'defence-frontier']);
    const html = await render(HonourGallery, { honours: normalized, town: 'Willowbrook' });
    expect(html).toContain('3 honours earned');
    expect(html).toContain('Score Ace');
    expect(html).toContain('61,400 on level 88 (target 30,600)');
    expect(html).toContain('Earned before honours were introduced');
    expect(html).toContain(ERAS[0].label);
    // Earned only: no locked badges, progress or goals a visitor cannot see.
    expect(html).not.toContain('honour-badge-locked');
    expect(html).not.toContain('Lamplighter');
    expect(html).not.toContain('progressbar');
    for (const id of Object.keys(CATEGORY_LABELS))
      expect(html.includes(CATEGORY_LABELS[id])).toBe(id !== 'mine');
  });
});
