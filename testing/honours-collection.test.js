import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  HONOURS,
  HONOUR_TABS,
  QUARTERMASTER,
  RANK_METALS,
  buildHonourCatalog,
  createHonours,
  honourCollection,
  honourFamilies,
  normalizeHonours,
  validShowcase,
} from '../src/data/honours';
import { elementLevels } from '../src/data/honourLevels';
import { POWERS } from '../src/data/campaign';
import { villageHonours } from '../src/services/publicVillage';
import { cardHonours } from '../src/services/townDirectory';
import { setLocale } from '../src/i18n';
import fr from '../src/i18n/fr.json';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import HonourBadge from '../src/components/honours/HonourBadge.vue';
import HonourCardRow from '../src/components/honours/HonourCardRow.vue';
import HonourCollectionList from '../src/components/honours/HonourCollectionList.vue';
import HonourDetail from '../src/components/honours/HonourDetail.vue';
import HonourGallery from '../src/components/honours/HonourGallery.vue';
import HonourShowcaseEditor from '../src/components/honours/HonourShowcaseEditor.vue';
import HonourShowcaseSlots from '../src/components/honours/HonourShowcaseSlots.vue';
import HonourAccountSection from '../src/components/honours/HonourAccountSection.vue';
import TownMoreMenu from '../src/components/town/TownMoreMenu.vue';
import {
  TAB_LABELS,
  evidenceText,
  honourSummary,
  moveSlot,
  rankTrack,
  unseenIds,
} from '../src/components/honours/honourDisplay';

const OCT_2 = Date.UTC(2026, 9, 2, 12);
const SCORE_EVIDENCE = { levelId: 88, score: 61400, target: 30600 };
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
const ids = (html) => [...html.matchAll(/data-honour="([\w-]+)"/g)].map((match) => match[1]);
const firstLevel = (element) => elementLevels(element).levels[0];
// Earned entries as the store saves them: unseen and unannounced unless stated.
function earn(honours, list, { at = OCT_2, ...flags } = {}) {
  const next = normalizeHonours(honours);
  for (const id of list)
    next.earned[id] = { at, version: 1, seen: false, announced: false, ...flags };
  return next;
}

// A Connected City town with earned (dated and backfilled), fresh and locked families.
function townState() {
  let honours = earn(createHonours(), ['stars-bronze'], { at: null, seen: true, backfilled: true });
  honours = earn(honours, ['score-bronze', 'fusion-bronze', 'mine-lanterns-bronze'], {
    seen: true,
  });
  honours = earn(honours, ['ages-bronze', 'ages-silver'], { seen: true });
  honours = earn(honours, ['score-silver']);
  honours.earned['score-silver'].evidence = SCORE_EVIDENCE;
  honours.counts.fusions = {
    'bomb+bomb': 2,
    'bomb+cross': 1,
    'cross+cross': 3,
    'cross+rainbow': 1,
  };
  honours.counts.mine = { lanterns: 42 };
  honours.counts.gems = { sapphire: 330 };
  honours.showcase = ['score'];
  return {
    honours,
    records: { 1: { stars: 3, score: 900 } },
    town: { era: 'contemporary', buildings: {} },
    powers: POWERS.map((power, index) => ({
      id: power.id,
      quantity: index < 3 ? QUARTERMASTER.quantity : 4,
    })),
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
// The stars family with a diamond rank appended by a later update (generation 2).
function diamondCatalog() {
  const families = honourFamilies().map((family) =>
    family.id === 'stars'
      ? {
          ...family,
          ranks: [
            ...family.ranks,
            { metal: 'diamond', goal: 500, name: 'Star Sovereign', since: 2 },
          ],
        }
      : family,
  );
  return buildHonourCatalog(families);
}

afterEach(() => setLocale('en'));

describe('The honours collection', () => {
  it('frames earned families in their best metal with a rank track and their date', async () => {
    const html = await collection(townState());
    const score = card(html, 'score');
    expect(score).toContain('honour-card-silver');
    expect(score).not.toContain('honour-badge-locked');
    expect(score).toContain('Silver · 2 of 3');
    // Every rank on the track, named by metal and filled once earned.
    expect(score.match(/<li class="honour-track-\w+[^"]*"/g)).toEqual([
      '<li class="honour-track-bronze is-earned"',
      '<li class="honour-track-silver is-earned"',
      '<li class="honour-track-gold"',
    ]);
    for (const metal of ['Bronze', 'Silver', 'Gold']) expect(score).toContain(`>${metal}</span>`);
    expect(score).toContain('Earned ');
    expect(score).toContain('61,400 on level 88 (target 30,600)');
    expect(score).toContain('Next rank · Gold · Score Legend — Three times the star target');
    expect(score).toContain('Best so far');
    expect(score).toContain('honour-progress-next');
    expect(score).toContain('>New<');
    expect(card(html, 'stars')).toContain('honour-card-bronze');
    expect(card(html, 'stars')).toContain('Earned before honours were introduced');
    expect(card(html, 'stars')).not.toContain('>New<');
    // Earned families lead the grid.
    const earned = ['stars', 'score', 'fusion', 'mine-lanterns'];
    expect(ids(html).slice(0, 4).sort()).toEqual(earned.sort());
  });

  it('tells metals apart by shape and text, and words the difficulty from the rank', async () => {
    const html = await collection(townState());
    // The kicker repeats the shape of the rank's metal: round, hexagon, rosette.
    expect(card(html, 'stars')).toContain('honour-kicker-bronze');
    expect(card(html, 'stars')).toMatch(/honour-kicker-bronze[^>]*>[\s\S]*?<circle/);
    expect(card(html, 'score')).toMatch(/honour-kicker-silver[\s\S]*?Medium/);
    expect(card(html, 'stars')).toContain('Easy');
    const quartermaster = card(await collection(townState(), { tab: 'town' }), 'quartermaster');
    expect(quartermaster).toContain('Hard');
    expect(quartermaster).not.toContain('Very hard');
    // Screen readers hear each rank's state, not just a filled shape.
    expect(card(html, 'score')).toContain('Silver</span><span class="town-sr-only"> · Earned');
    expect(card(html, 'score')).toMatch(/Gold<\/span><span class="town-sr-only"> · Not yet earned/);
    expect(card(html, 'score')).toMatch(/Score Ace<span class="town-sr-only"> · Silver · 2 of 3/);
  });

  it('keeps unearned honours locked but readable, with requirement and progress', async () => {
    const html = await collection(townState());
    const fusion = card(html, 'fusion');
    expect(fusion).toContain('Next rank · Silver · Fusion Master — 6 different fusions performed');
    expect(fusion).toContain('4 / 6 different fusions');
    expect(fusion).toContain('Bomb + Rainbow');
    expect((fusion.match(/is-done/g) ?? []).length).toBe(4);
    const sapphire = card(html, 'gem-sapphire');
    expect(sapphire).toContain('is-locked');
    expect(sapphire).toContain('honour-badge-locked');
    expect(sapphire).toContain('No rank yet · 0 of 3');
    expect(sapphire).toContain('330 / 500 sapphires collected');
    expect(sapphire).toMatch(/Sapphire Laureate<span class="town-sr-only"> · Not yet earned/);
  });

  it('shows the town tab: eras, single-rank supplies and building links', async () => {
    const html = await collection(townState(), { tab: 'town' });
    const ages = card(html, 'ages');
    expect(ages).toContain('Silver · 2 of 3');
    expect(ages).toContain('On the Air');
    expect(ages).toContain('Now in Connected City · next milestone: complete Riverlight Age');
    const quartermaster = card(html, 'quartermaster');
    // One rank: just its metal, without a track of one.
    expect(quartermaster).not.toContain('honour-track-steps');
    expect(quartermaster).toContain('honour-track-single');
    expect(quartermaster).toMatch(/<\/svg>Gold<\/span>/);
    expect(quartermaster).toContain('Hold 5 different powers at 26 each at the same time.');
    expect(quartermaster).toContain('3 / 5 powers full');
    for (const power of POWERS) expect(quartermaster).toContain(`${power.label} at 26`);
    expect((quartermaster.match(/is-done/g) ?? []).length).toBe(3);
    expect(quartermaster).toContain('Open supplies');
    expect(card(html, 'forge')).toContain('Blacksmith details');
    expect(card(html, 'guardian')).toContain('0 / 5 incidents fully protected');
  });

  it('opens the directory from Village Explorer only for a signed-in player', async () => {
    const state = townState();
    const explorer = card(await collection(state, { tab: 'friends', canTravel: true }), 'explorer');
    // Locked, the family shows its first rank.
    expect(explorer).toContain('Curious Neighbour');
    expect(explorer).toContain('honour-badge-locked');
    expect(explorer).toContain('Visit 5 different players’ villages from this town.');
    expect(explorer).toContain('0 / 5 villages visited');
    expect(explorer).toContain('Find villages to visit');
    const signedOut = await collection(state, { tab: 'friends' });
    expect(card(signedOut, 'explorer')).not.toContain('Find villages to visit');
    expect(ids(signedOut).sort()).toEqual(['explorer', 'visitors']);
  });

  it('shows where mine honours are found and whether the player got there yet', async () => {
    const state = townState();
    const html = await collection(state, { tab: 'mine' });
    const lanterns = elementLevels('lanterns');
    const lamplighter = card(html, 'mine-lanterns');
    expect(lamplighter).toContain('Bronze · 1 of 3');
    expect(lamplighter).toContain('42 / 50 lanterns lit');
    expect(lamplighter).toContain(
      `${lanterns.levels.length} levels · chapters ${lanterns.chapters[0]}–${lanterns.chapters[1]}`,
    );
    expect(lamplighter).not.toContain('not reached yet');
    expect(lamplighter).toContain('Show these levels in the museum');
    const gates = card(html, 'mine-gates');
    expect(firstLevel('gates')).toBeGreaterThan(state.nextLevel);
    expect(gates).toContain('not reached yet');
    expect(gates).not.toContain('Show these levels in the museum');
    // Without a museum there is nowhere to replay.
    expect(
      card(await collection(state, { tab: 'mine', canReplay: false }), 'mine-lanterns'),
    ).not.toContain('Show these levels in the museum');
  });

  it('lists Mine, Town and Friends tabs with counts and hides New when notices are off', async () => {
    const state = townState();
    const tabs = honourCollection(state);
    const html = await collection(state);
    expect(tabs.map((tab) => tab.id)).toEqual([...HONOUR_TABS]);
    const labels = [...html.matchAll(/role="tab"[\s\S]*?<span>([^<]+)<\/span><b>([^<]+)<\/b>/g)];
    expect(labels.map((match) => [match[1], match[2]])).toEqual(
      tabs.map((tab) => [TAB_LABELS[tab.id], `${tab.earned}/${tab.total}`]),
    );
    expect(html).toContain('honour-dot');
    const quiet = await collection(state, { showNew: false });
    expect(quiet).not.toContain('honour-dot');
    expect(quiet).not.toContain('honour-new');
    // Viewing a tab marks only its unseen honours.
    expect(unseenIds(tabs[0])).toEqual(['score-silver']);
    expect(unseenIds(tabs[1])).toEqual([]);
    expect(honourSummary(state.honours)).toEqual({
      earned: 5,
      total: HONOURS.families.length,
      fresh: 1,
    });
  });

  it('extends any family with a later diamond rank, marked as a new rank', async () => {
    const catalog = diamondCatalog();
    const state = {
      ...townState(),
      honours: earn(createHonours(), ['stars-bronze', 'stars-silver', 'stars-gold'], {
        seen: true,
      }),
    };
    const tabs = honourCollection(state, catalog);
    const stars = tabs[0].families.find((family) => family.id === 'stars');
    expect(stars.newRank).toBe(true);
    expect(tabs[0].fresh).toBe(1);
    expect(honourSummary(state.honours, catalog).fresh).toBe(1);
    const html = await render(HonourCollectionList, {
      tabs,
      state,
      newRanks: ['stars'],
      showNew: true,
    });
    const view = card(html, 'stars');
    expect(view).toContain('Gold · 3 of 4');
    expect(view).toContain('honour-card-gold');
    expect(view).toContain('<li class="honour-track-diamond"');
    expect(view).toContain('>Diamond</span>');
    expect(view).toContain('>New rank<');
    expect(view).toContain('Next rank · Diamond · Star Sovereign — Three stars on 500 puzzles');
    // Once earned, the diamond frame and track.
    const top = earn(state.honours, ['stars-diamond']);
    const earned = card(
      await render(HonourCollectionList, {
        tabs: honourCollection({ ...state, honours: top }, catalog),
        state: { ...state, honours: top },
      }),
      'stars',
    );
    expect(earned).toContain('honour-card-diamond');
    expect(earned).toContain('Diamond · 4 of 4');
    expect(earned).not.toContain('New rank');
    expect(rankTrack(catalog.familyById.stars.ranks, (rank) => rank.metal === 'bronze').text).toBe(
      'Bronze · 1 of 4',
    );
  });

  it('filters to earned or not yet earned honours', async () => {
    const state = townState();
    expect(ids(await collection(state, { filter: 'earned' })).sort()).toEqual(
      ['fusion', 'mine-lanterns', 'score', 'stars'].sort(),
    );
    const open = ids(await collection(state, { filter: 'open' }));
    expect(open).toHaveLength(HONOURS.families.filter((f) => f.tab === 'mine').length - 4);
    expect(open).not.toContain('score');
    expect(await collection(state, { tab: 'friends', filter: 'earned' })).toContain(
      'Nothing earned here yet.',
    );
  });

  it('translates every collection string and the rank wording into French', async () => {
    const sources = [
      ...readdirSync('src/components/honours').map((file) => `src/components/honours/${file}`),
      'src/components/town/TownMoreMenu.vue',
      'src/components/town/TownMuseum.vue',
      'src/components/community/VillageVisit.vue',
    ];
    const missing = sources.flatMap((file) =>
      translatable(readFileSync(file, 'utf8')).filter((message) => !Object.hasOwn(fr, message)),
    );
    expect([...new Set(missing)]).toEqual([]);
    setLocale('fr');
    const html = await collection(townState());
    expect(html).toContain('Argent · 2 sur 3');
    expect(html).toContain(fr['Friends']);
    expect(card(html, 'score')).toContain(
      'Rang suivant · Or · Légende du score — Trois fois l’objectif des étoiles',
    );
    expect(card(html, 'gem-sapphire')).toContain('Aucun rang · 0 sur 3');
    const town = await collection(townState(), { tab: 'town' });
    expect(card(town, 'ages')).toContain(
      'Ère actuelle : Ville connectée · prochaine étape : terminer « L’ère des lumières douces »',
    );
    expect(card(town, 'quartermaster')).toContain(`${fr['Clear Row']} à 26`);
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
    /const (?:DIFFICULTIES|METAL_LABELS|TAB_LABELS|BONUS_NAMES|INTROS|NOTES) = \{([\s\S]*?)\};/g,
  ))
    for (const literal of match[1].matchAll(/:\s*'((?:[^'\\]|\\.)*)'/g)) messages.push(literal[1]);
  for (const literal of source.matchAll(/\blabel: '((?:[^'\\]|\\.)*)'/g)) messages.push(literal[1]);
  return messages.filter((message) => /[A-Za-z]/.test(message) && !/^[a-z-]+$/.test(message));
}

describe('The honour detail', () => {
  let pinia, campaign;
  beforeEach(() => {
    const saved = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    });
    pinia = createPinia();
    setActivePinia(pinia);
    campaign = useCampaignStore();
    const state = townState();
    campaign.honours = state.honours;
    campaign.powers = state.powers;
    campaign.town = { ...campaign.town, era: state.town.era };
  });
  afterEach(() => vi.unstubAllGlobals());
  const detail = (familyId, props = {}) =>
    render(HonourDetail, { familyId, links: true, ...props }, pinia);
  const rungs = (html) =>
    html
      .match(/<ol class="honour-detail-ranks"[\s\S]*?<\/ol>/)[0]
      .split(/(?=<li[^>]*data-rank=)/)
      .slice(1);

  it('lays out every rank as a ladder with its metal, date and progress on the next', async () => {
    const html = await detail('mine-lanterns');
    const [bronze, silver, gold] = rungs(html);
    expect(rungs(html)).toHaveLength(3);
    expect(bronze).toContain('is-earned');
    expect(bronze).toContain('Bronze · Easy');
    expect(bronze).toContain('Light 10 lanterns in completed puzzles.');
    expect(bronze).toContain('Earned ');
    expect(silver).toContain('is-next');
    expect(silver).toContain('Silver · Medium');
    expect(silver).toContain('Next rank');
    expect(silver).toContain('42 / 50 lanterns lit');
    expect(silver).toContain('role="progressbar"');
    expect(gold).toContain('Gold · Hard');
    expect(gold).toContain('Light 125 lanterns in completed puzzles.');
    expect(gold).toContain('Not yet earned');
    expect(gold).not.toContain('progressbar');
    expect(html).toContain('Bronze · 1 of 3');
    expect(html).toContain('Where to make progress');
    expect(html).toMatch(/<button[^>]*>\s*Add to showcase/);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>\s*Add to showcase/);
  });

  it('keeps score evidence and the best run on the score ladder', async () => {
    const html = await detail('score');
    const [, silver, gold] = rungs(html);
    expect(silver).toContain('61,400 on level 88 (target 30,600)');
    expect(rungs(html)[0]).toContain(
      'Complete a puzzle from level 37 onward with 1.5× its star score target.',
    );
    expect(gold).toContain('Complete a puzzle from level 37 onward with 3× its star score target.');
    expect(gold).toContain('Best so far');
    expect(html).toContain('Remove from showcase');
  });

  it('shows fusion chips, supply checks and the next era milestone on their ranks', async () => {
    const fusion = rungs(await detail('fusion'))[1];
    expect(fusion).toContain('aria-label="Bonus fusions"');
    expect((fusion.match(/is-done/g) ?? []).length).toBe(4);
    expect(fusion).toMatch(/Bomb \+ Rainbow<span class="town-sr-only"> · Not yet/);
    const [supplies] = rungs(await detail('quartermaster'));
    expect(supplies).toContain('aria-label="Powers"');
    expect(supplies).toMatch(/TNT at 26<span class="town-sr-only"> · Done/);
    expect(supplies).toMatch(/Shuffle at 26<span class="town-sr-only"> · Not yet/);
    const ages = await detail('ages');
    expect(rungs(ages)[2]).toContain(
      'Now in Connected City · next milestone: complete Riverlight Age',
    );
    expect(rungs(ages)[0]).toContain('Reach River &amp; Rail Boom.');
  });

  it('keeps a locked honour off the showcase', async () => {
    const html = await detail('gem-sapphire');
    expect(html).toContain('honour-badge-locked');
    expect(html).toContain('No rank yet · 0 of 3');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\s*Add to showcase/);
    expect(html).toContain('Earn this honour to show it to visitors.');
  });

  it('links Village Explorer to the directory only when the player can travel', async () => {
    expect(await detail('explorer', { canTravel: true })).toContain('Find villages to visit');
    expect(await detail('explorer')).not.toContain('Find villages to visit');
  });
});

describe('Honour badge artwork', () => {
  const badge = (props) => render(HonourBadge, props);
  // The first outline's point count: the frame shape of each metal.
  const corners = (html) => html.match(/<polygon points="([^"]+)"/)?.[1].split(' ').length;

  it('draws every catalog rank with artwork in the frame of its metal', async () => {
    const shapes = { silver: 6, gold: 32, diamond: 8 };
    for (const definition of HONOURS.definitions) {
      const html = await badge({ definition, size: 48 });
      expect(html, definition.id).toContain('<svg');
      expect(html, definition.id).toMatch(/<image|<g[ >]/);
      if (definition.metal === 'bronze') expect(html, definition.id).toContain('<circle');
      else expect(corners(html), definition.id).toBe(shapes[definition.metal]);
    }
  });

  it('cuts a diamond frame and falls back to bronze for a metal without a frame', async () => {
    const stars = diamondCatalog().byId['stars-diamond'];
    const diamond = await badge({ definition: stars });
    expect(corners(diamond)).toBe(8);
    expect(diamond).toMatch(/<path d="M[\d.,]+L/);
    expect(RANK_METALS).toContain('diamond');
    const future = await badge({ definition: { ...stars, metal: 'platinum' } });
    expect(future).toContain('<circle');
  });

  it('greys out and locks an unearned rank and engraves score multiples', async () => {
    const html = await badge({ definition: HONOURS.byId['score-gold'], locked: true });
    expect(html).toContain('honour-badge-locked');
    expect(html).toContain('honour-badge-lock');
    expect(html).toContain('3×');
    expect(await badge({ definition: HONOURS.byId['score-bronze'] })).toContain('1.5×');
    expect(await badge({ definition: HONOURS.byId['explorer-bronze'] })).toContain(
      'M47.5 27h5v47h-5Z',
    );
  });
});

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

  it('accepts only earned families and shows each slot at its top metal', async () => {
    const { honours } = townState();
    expect(validShowcase(['score', 'nope', 'score', 'mine-lanterns', 'stars'], honours)).toEqual([
      'score',
      'mine-lanterns',
      'stars',
    ]);
    const upgraded = earn(honours, ['score-gold']);
    const html = await render(HonourShowcaseSlots, { ids: ['score'], earned: upgraded.earned });
    expect(html).toContain('Score Legend');
    expect(html).toContain('Gold · 3 of 3');
    expect(html).toContain('3×');
    const compact = await render(HonourShowcaseSlots, {
      ids: ['score'],
      earned: upgraded.earned,
      compact: true,
    });
    expect(compact).toContain('title="Score Legend · Gold"');
    expect(compact).toContain('<span class="town-sr-only">Score Legend · Gold</span>');
    expect(moveSlot(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveSlot(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });

  it('manages the order with labelled move and remove controls', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const campaign = useCampaignStore();
    campaign.honours = { ...townState().honours, showcase: ['score', 'stars'] };
    const html = await render(HonourShowcaseEditor, {}, pinia);
    expect(html).toContain('aria-label="Move Score Ace earlier"');
    expect(html).toMatch(/data-action="earlier" aria-disabled="true"/);
    expect(html).toContain('Remove Rising Star from the showcase');
    expect(html).toContain('Score Ace · Silver');
    // Earned but not shown: offered for an empty slot with its metal.
    expect(html).toContain('First Fusion · Bronze');
    expect(campaign.setHonourShowcase(['stars', 'score'])).toBe(true);
    expect(campaign.honours.showcase).toEqual(['stars', 'score']);
  });

  it('summarizes honours in town management with what visitors see', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useCampaignStore().honours = townState().honours;
    const html = await render(HonourAccountSection, { town: 'Willowbrook', shared: true }, pinia);
    expect(html).toContain(`5 of ${HONOURS.families.length} honours earned`);
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

  it('shows known families at their best metal, score evidence and an earned showcase', async () => {
    const normalized = villageHonours(
      village({
        version: 1,
        earned: {
          'score-bronze': { at: OCT_2 },
          'score-silver': { at: OCT_2, evidence: SCORE_EVIDENCE },
          'stars-bronze': { at: null, evidence: { levelId: 3, score: 1, target: 1 } },
          'ages-bronze': { at: 'yesterday' },
          'from-the-future': { at: OCT_2 },
          constructor: { at: OCT_2 },
        },
        showcase: ['mine-lanterns', 'score', 'score', 7, 'stars', 'ages'],
      }),
    );
    expect(Object.keys(normalized.earned).sort()).toEqual([
      'ages-bronze',
      'score-bronze',
      'score-silver',
      'stars-bronze',
    ]);
    expect(normalized.earned['stars-bronze']).toEqual({ at: null });
    expect(normalized.earned['ages-bronze']).toEqual({ at: null });
    expect(normalized.earned['score-silver'].evidence).toEqual(SCORE_EVIDENCE);
    expect(normalized.showcase).toEqual(['score', 'stars', 'ages']);
    const html = await render(HonourGallery, { honours: normalized, town: 'Willowbrook' });
    expect(html).toContain('3 honours earned');
    expect(html).toContain('Score Ace');
    expect(html).not.toContain('Score Hunter');
    expect(html).toContain('Silver · 2 of 3');
    expect(html).toContain('honour-kicker-silver');
    expect(html).toContain('61,400 on level 88 (target 30,600)');
    expect(html).toContain('Earned before honours were introduced');
    // Earned only: no locked badges, progress or goals a visitor cannot see.
    expect(html).not.toContain('honour-badge-locked');
    expect(html).not.toContain('Lamplighter');
    expect(html).not.toContain('progressbar');
    const headings = [...html.matchAll(/<h3>\s*([^<]+?)\s*<span>/g)].map((match) => match[1]);
    expect(headings).toEqual(['Mine', 'Town']);
  });

  it('shows a shared town card with the best rank of each showcased family', async () => {
    const honours = {
      earned: ['score-bronze', 'score-silver', 'stars-bronze', 'from-the-future'],
      showcase: ['score', 'from-the-future'],
    };
    expect(cardHonours(honours).count).toBe(3);
    expect(cardHonours(honours).showcase.map((definition) => definition.id)).toEqual([
      'score-silver',
    ]);
    const html = await render(HonourCardRow, { honours });
    expect(html).toContain('aria-label="Showcase: Score Ace · Silver"');
    expect(html).toContain('3 honours');
  });
});

describe('Honour evidence text', () => {
  it('formats score evidence and leaves level-only evidence blank', () => {
    expect(evidenceText({ levelId: 121 })).toBe('');
    expect(evidenceText({ levelId: 88, score: 63360, target: 26400 })).toContain('88');
    expect(evidenceText({ levelId: 88, score: 63360, target: 26400 })).not.toContain('NaN');
  });
});
