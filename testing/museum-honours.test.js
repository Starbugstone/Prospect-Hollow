import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import TownMuseum from '../src/components/town/TownMuseum.vue';
import MuseumLevelGrid from '../src/components/town/MuseumLevelGrid.vue';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useHonourNavigation } from '../src/composables/useHonourNavigation';
import { HONOURS, MINE_ELEMENTS, SCORE_FROM_LEVEL, normalizeHonours } from '../src/data/honours';
import { elementLevels, levelHonourElements } from '../src/data/honourLevels';
import { getLevelStarTarget } from '../src/data/starRating';
import { LEVEL_COUNT } from '../src/data/campaign';
import { number, setLocale, t } from '../src/i18n';
import fr from '../src/i18n/fr.json';

// The museum's Show filter, honour picker, element icons and honour tags (issue #60).
// Rendered on the server; a test sets the component's own filter state where a player
// would press a button.
const lanterns = elementLevels('lanterns').levels;
const RECORDS = {
  1: { score: 900, stars: 3 },
  2: { score: 700, stars: 2 },
  36: { score: 40_000, stars: 3 },
  37: { score: 41_000, stars: 1 },
  38: { score: 52_000, stars: 3 },
  [lanterns[0]]: { score: 52_800, stars: 3 },
  [lanterns[1]]: { score: 41_900, stars: 2 },
};
const count = (html, pattern) => html.match(pattern)?.length ?? 0;
// The mine mastery family of an element, and earning ranks as the store saves them.
const familyOf = (element) =>
  HONOURS.families.find((family) => family.ranks[0].element === element).id;
function earn(honours, ids) {
  const next = normalizeHonours(honours);
  for (const id of ids) next.earned[id] = { at: 1, version: 1, seen: true, announced: true };
  return next;
}
const scoreTarget = (id, multiple) => number(Math.ceil(multiple * getLevelStarTarget(id, null)));
const cards = (html) => count(html, /class="museum-level"/g);
const text = (html) => html.replace(/<!--[^>]*-->/g, '');

let pinia;
let campaign;
beforeEach(() => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  vi.stubGlobal('document', { activeElement: null });
  pinia = createPinia();
  setActivePinia(pinia);
  campaign = useCampaignStore();
  campaign.records = structuredClone(RECORDS);
});
afterEach(() => {
  useHonourNavigation().clearMuseumRequest();
  setLocale('en');
  vi.unstubAllGlobals();
});

function museum(state = {}) {
  const app = createSSRApp({ render: () => h(TownMuseum) });
  app.use(pinia);
  app.mixin({
    created() {
      if (this.$.type === TownMuseum) Object.assign(this.$.setupState, state);
    },
  });
  return renderToString(app).then(text);
}
const openFor = (familyId) => {
  useHonourNavigation().openMuseumFor(familyId);
  return museum();
};
const options = (html) => [...html.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]);
const notes = (html) => html.match(/class="museum-honour-note"[^>]*>(.*?)<\/p>/s)?.[1] ?? '';
const tagsOf = (html, id) => {
  const number = `class="museum-level-number">${String(id).padStart(2, '0')}<`;
  const card = html.split('class="museum-level"').find((part) => part.includes(number)) ?? '';
  return [
    ...card.matchAll(/class="museum-tag[^"]*"><span aria-hidden="true">[^<]*<\/span>([^<]*)/g),
  ].map((match) => match[1]);
};

describe('Museum Show filter', () => {
  it('counts every completed level and those below three stars', async () => {
    const html = await museum();
    const completed = Object.keys(RECORDS).length;
    expect(html).toContain(`All completed <b>${completed}</b>`);
    expect(html).toContain('aria-label="Below three stars, 3 levels"');
    expect(html).toContain('Below ✦✦✦ <b>3</b>');
    expect(html).toMatch(/aria-pressed="true"[^>]*>\s*All completed/);
    expect(cards(html)).toBe(completed);
    expect(html).not.toContain('museum-honour-picker');
    expect(html).not.toContain('first completion at the mine');
  });

  it('lists only completed levels below three stars, with the unplayed note', async () => {
    const html = await museum({ show: 'below' });
    expect(cards(html)).toBe(3);
    for (const id of [2, 37, lanterns[1]]) expect(html).toContain(`Replay level ${id}:`);
    expect(html).toContain(
      `${LEVEL_COUNT - Object.keys(RECORDS).length} levels still await their first completion at the mine.`,
    );
  });

  it('keeps the perfect-collection message when nothing is below three stars', async () => {
    campaign.records = { 1: { score: 1, stars: 3 } };
    const html = await museum({ show: 'below' });
    expect(cards(html)).toBe(0);
    expect(html).toContain('Every completed level has three stars.');
  });

  it('leaves continuous play, its coin allowance and replays unchanged', async () => {
    const html = await museum({ mode: 'continuous' });
    expect(html).not.toContain('museum-show');
    expect(html).toContain(`0/25 coins collected`);
    expect(html).toContain('Keep matching');
    expect(cards(html)).toBe(campaign.nextLevel);
  });
});

describe('For an honour', () => {
  it('offers only unfinished level-linked families, mine mastery first, at their next rank', async () => {
    const lanterns = HONOURS.familyById['mine-lanterns'].ranks.map((rank) => rank.id);
    campaign.honours = earn(campaign.honours, [...lanterns, 'score-bronze', 'score-silver']);
    campaign.honours.counts.mine.relics = 7;
    const html = await museum({ show: 'honour' });
    const mine = MINE_ELEMENTS.map((element) => familyOf(element.id)).filter(
      (id) => id !== 'mine-lanterns',
    );
    expect(options(html)).toEqual([...mine, 'stars', 'score']);
    // Each option names the next rank and its metal, with progress toward it.
    expect(html).toContain('Relic Keeper · Bronze · 7/10');
    expect(html).toContain('Rising Star · Bronze · 4/25');
    expect(html).toContain('Score Legend · Gold · ');
    expect(html).not.toContain('Score Ace ·');
    expect(html).not.toMatch(/value="(?:gem-|fusion|forge|ages|guardian)/);
    // The first unfinished honour is selected and drawn with the shared badge.
    expect(html).toMatch(/<option value="mine-relics" selected/);
    expect(html).toContain('<select aria-label="Honour">');
    expect(html).toContain('honour-badge');
  });

  it('drops a fully earned family and hides the mode once none remain', async () => {
    const linked = HONOURS.definitions.filter((entry) => entry.link?.startsWith('museum-'));
    campaign.honours = earn(
      campaign.honours,
      linked.map((definition) => definition.id),
    );
    const html = await museum();
    expect(html).not.toContain('For an honour');
    expect(options(html)).toEqual([]);
  });

  it('tags mine levels with the honour and element count, and counts levels still ahead', async () => {
    const html = await openFor('mine-lanterns');
    expect(options(html)[0]).toBe('mine-relics');
    expect(html).toMatch(/<option value="mine-lanterns" selected/);
    expect(cards(html)).toBe(2);
    expect(html).not.toContain('Replay level 1:');
    expect(tagsOf(html, lanterns[0])).toEqual([
      `Lamplighter · ${levelHonourElements(lanterns[0]).lanterns} lanterns`,
    ]);
    // A level below three stars also shows it advances the next star rank.
    expect(tagsOf(html, lanterns[1])).toEqual([
      `Lamplighter · ${levelHonourElements(lanterns[1]).lanterns} lanterns`,
      'Rising Star · needs 3 stars',
    ]);
    expect(html).toContain('museum-tag museum-tag-secondary');
    expect(notes(html)).toContain(`Lamplighter: 2 of ${lanterns.length} levels completed.`);
    expect(notes(html)).toContain('Each replay you complete counts again.');
    expect(notes(html)).toContain(
      `${lanterns.length - 2} more levels are still ahead at the mine.`,
    );
  });

  it('names every mine element in its tags, singular and plural', async () => {
    for (const element of MINE_ELEMENTS) {
      const [id] = elementLevels(element.id).levels;
      campaign.records = { [id]: { score: 1, stars: 3 } };
      const amount = levelHonourElements(id)[element.id];
      const [tag] = tagsOf(await openFor(familyOf(element.id)), id);
      expect(tag, element.id).toMatch(new RegExp(`^${element.name} · ${amount} [a-z]`));
      expect(tag, element.id).not.toContain(`${element.label}:`);
      setLocale('fr');
      const [french] = tagsOf(await openFor(familyOf(element.id)), id);
      setLocale('en');
      expect(french, element.id).toContain(`${fr[element.name]} · ${amount} `);
      expect(french, element.id).not.toBe(tag);
    }
  });

  it('shows the score target from level 37 using the star target and rank multiple', async () => {
    const html = await openFor('score');
    expect(html).not.toContain('Replay level 36:');
    expect(cards(html)).toBe(Object.keys(RECORDS).filter((id) => id >= SCORE_FROM_LEVEL).length);
    expect(tagsOf(html, 37)).toEqual([
      `Score Hunter at ${scoreTarget(37, 1.5)} · your best 41,000`,
      'Rising Star · needs 3 stars',
    ]);
    const qualifying = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).filter(
      (id) => id >= SCORE_FROM_LEVEL && getLevelStarTarget(id, null) > 0,
    ).length;
    expect(notes(html)).toContain(`Score Hunter: 4 of ${qualifying} levels completed.`);
    expect(notes(html)).toContain('Levels from 37 onward count.');
    campaign.honours = earn(campaign.honours, ['score-bronze']);
    expect(tagsOf(await openFor('score'), 38)).toEqual([
      `Score Ace at ${scoreTarget(38, 2.5)} · your best 52,000`,
    ]);
  });

  it('lists levels below three stars for the next star rank with the main tag', async () => {
    const html = await openFor('stars');
    expect(cards(html)).toBe(3);
    expect(tagsOf(html, 2)).toEqual(['Rising Star · needs 3 stars']);
    expect(html).not.toContain('museum-tag-secondary');
    expect(notes(html)).toContain(`Rising Star: 7 of ${LEVEL_COUNT} levels completed.`);
  });
});

describe('Museum deep links', () => {
  it('opens Replay on the requested honour and clears the request', async () => {
    const navigation = useHonourNavigation();
    navigation.openMuseumFor('mine-surveys');
    const html = await museum();
    expect(navigation.requests.museum).toBeNull();
    expect(html).toMatch(/aria-pressed="true"[^>]*>\s*Replay levels/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>\s*For an honour/);
    expect(html).toMatch(/<option value="mine-surveys" selected/);
  });

  it('keeps a fully earned family selectable at its top rank, marked as earned', async () => {
    const lanterns = HONOURS.familyById['mine-lanterns'].ranks.map((rank) => rank.id);
    campaign.honours = earn(campaign.honours, lanterns);
    const html = await openFor('mine-lanterns');
    expect(html).toMatch(
      /<option value="mine-lanterns" selected[^>]*>\s*Lamplighter · Diamond · earned/,
    );
    expect(cards(html)).toBe(2);
  });

  it('ignores and clears a request for an honour the museum cannot advance', async () => {
    const html = await openFor('forge');
    expect(useHonourNavigation().requests.museum).toBeNull();
    expect(html).toMatch(/aria-pressed="true"[^>]*>\s*All completed/);
    expect(html).not.toContain('museum-honour-picker');
  });
});

describe('Element icons on level cards', () => {
  const grid = (props) => renderToString(createSSRApp(MuseumLevelGrid, props)).then(text);
  // A level with three or more mastery elements.
  const mixed = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).find(
    (id) => Object.keys(levelHonourElements(id)).length >= 3,
  );

  it('names each element on the card and lists the visible ones in a legend', async () => {
    const present = MINE_ELEMENTS.filter((element) => levelHonourElements(mixed)[element.id]);
    const html = await grid({ levelIds: [1, mixed], records: { [mixed]: { stars: 2 } } });
    for (const element of present) {
      expect(html).toContain(`alt="${element.label}"`);
      expect(html).toContain(`alt="">${element.label}</span>`);
    }
    expect(count(html, /class="museum-level-elements"/g)).toBe(1);
    const legend = html.match(/class="museum-legend">(.*?)<\/p>/s)[1];
    expect([...legend.matchAll(/alt="">([^<]+)/g)].map((match) => match[1])).toEqual(
      present.map((element) => element.label),
    );
    // A button's content is not read out, so the stars, elements and details describe it.
    const described = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((match) => match[1]);
    expect(described).toHaveLength(2);
    expect(described[1].split(' ')).toHaveLength(3);
    for (const id of described.join(' ').split(' ')) expect(html).toContain(`id="${id}"`);
  });

  it('keeps the visitor grid read-only, with translated element names', async () => {
    setLocale('fr');
    const html = await grid({ levelIds: [mixed], records: {}, readOnly: true });
    expect(html).toContain('<article');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('aria-describedby');
    expect(html).not.toContain(t('Play again'));
    for (const element of MINE_ELEMENTS.filter((entry) => levelHonourElements(mixed)[entry.id]))
      expect(html).toContain(`alt="${fr[element.label]}"`);
    expect(html).toContain(fr['Elements:']);
  });

  it('shows no legend when no visible level has a mastery element', async () => {
    const html = await grid({ levelIds: [1, 2], records: {} });
    expect(html).not.toContain('museum-legend');
    expect(html).not.toContain('museum-level-elements');
  });
});

it('translates the museum filter, notes and tags into French', async () => {
  setLocale('fr');
  campaign.honours = earn(campaign.honours, ['mine-lanterns-bronze']);
  campaign.honours.counts.mine.lanterns = 42;
  const html = await openFor('mine-lanterns');
  for (const english of [
    'All completed',
    'For an honour',
    'Below three stars',
    'levels completed',
    'still ahead',
    'needs 3 stars',
    'counts again',
    ' lanterns',
  ])
    expect(html, english).not.toContain(english);
  expect(html).toContain(`${fr.Lamplighter} · ${fr.Silver} · 42/50`);
  expect(notes(html)).toContain(`${fr.Lamplighter} : 2 niveaux terminés sur ${lanterns.length}.`);
  expect(html).toContain(fr['needs 3 stars']);
  const score = await openFor('score');
  expect(score).toContain(
    `${fr['Score Hunter']} à ${scoreTarget(37, 1.5)} · votre record ${number(41_000)}`,
  );
});
