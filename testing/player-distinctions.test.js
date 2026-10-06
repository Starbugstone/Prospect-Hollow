import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computed, createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import shippedDistinctions from './fixtures/shipped-player-distinctions.json';
import publicSchema from '../backend/content/public-schema.json';
import {
  DISTINCTION_KINDS,
  PLAYER_DISTINCTIONS,
  PLAYER_DISTINCTION_PREFIX,
  distinctionBadge,
  distinctionKey,
  publishedDistinction,
  receivedDistinctions,
} from '../src/data/playerDistinctions';
import {
  HONOURS,
  buildHonourCatalog,
  createHonours,
  honourFamilies,
  validShowcase,
} from '../src/data/honours';
import { villageHonours } from '../src/services/publicVillage';
import { cardHonours } from '../src/services/townDirectory';
import { setLocale } from '../src/i18n';
import fr from '../src/i18n/fr.json';
import { useCampaignStore } from '../src/stores/campaignStore';
import { usePlayerDistinctions } from '../src/composables/usePlayerDistinctions';
import HonourBadge from '../src/components/honours/HonourBadge.vue';
import HonourCardRow from '../src/components/honours/HonourCardRow.vue';
import HonourCollectionList from '../src/components/honours/HonourCollectionList.vue';
import HonourDetail from '../src/components/honours/HonourDetail.vue';
import HonourGallery from '../src/components/honours/HonourGallery.vue';
import HonourShowcaseEditor from '../src/components/honours/HonourShowcaseEditor.vue';
import HonourShowcaseSlots from '../src/components/honours/HonourShowcaseSlots.vue';
import { distinctionName, tenureLabel } from '../src/components/honours/honourDisplay';

const NOW = Date.UTC(2026, 9, 5, 12);
const ALPHA_AT = Date.UTC(2026, 9, 1, 9);
// The server's time step for an account first signed in on 1 September 2025.
const ONE_YEAR = {
  at: Date.UTC(2026, 8, 1, 9),
  tenure: { unit: 'year', count: 1, next: { unit: 'year', count: 2, at: Date.UTC(2027, 8, 1, 9) } },
};
const render = (component, props, { pinia, cloudAccount } = {}) => {
  const app = createSSRApp({ render: () => h(component, props) });
  if (pinia) app.use(pinia);
  if (cloudAccount) app.provide('cloudAccount', cloudAccount);
  return renderToString(app);
};
// The injected account as CloudRoot provides it, from the server's GET /account reply.
const accountOf = ({
  distinctions = { 'player-alpha': { at: ALPHA_AT }, 'player-time': ONE_YEAR },
} = {}) => receivedDistinctions({ id: 'p1', distinctions });
const cloudAccount = ({ accountTown = true, id = 'p1', ...account } = {}) => ({
  signedIn: computed(() => true),
  accountTown: computed(() => accountTown),
  accountId: computed(() => id),
  distinctions: computed(() => accountOf(account)),
});
// A town that earned one honour family (stars bronze) to share the showcase with.
const earnedHonours = (showcase = []) => ({
  ...createHonours(),
  earned: { 'stars-bronze': { at: NOW, version: 1, seen: true, announced: true } },
  showcase,
});

describe('The player distinction catalog', () => {
  it('keeps every shipped ID, prefixed, with a known kind, in the server catalog', () => {
    const ids = PLAYER_DISTINCTIONS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [id, shipped] of Object.entries(shippedDistinctions))
      expect(PLAYER_DISTINCTIONS.find((definition) => definition.id === id)).toMatchObject(shipped);
    for (const definition of PLAYER_DISTINCTIONS) {
      expect(definition.id.startsWith(PLAYER_DISTINCTION_PREFIX)).toBe(true);
      expect(DISTINCTION_KINDS).toContain(definition.kind);
      expect(shippedDistinctions[definition.id]).toEqual({ kind: definition.kind });
    }
    expect(publicSchema.honours.playerDistinctions).toEqual(shippedDistinctions);
  });

  it('keeps honour families out of the player distinction namespace', () => {
    const families = [...honourFamilies(), { ...honourFamilies()[0], id: 'player-stars' }];
    expect(() => buildHonourCatalog(families)).toThrow(/player distinction prefix/);
    expect(HONOURS.families.some((family) => family.id.startsWith('player-'))).toBe(false);
  });

  it('translates every name, description and time step into French', () => {
    const messages = [
      ...PLAYER_DISTINCTIONS.flatMap((definition) => [definition.name, definition.description]),
      ...['1 week', '{count} weeks', 'week', 'weeks', '1 month', '{count} months'],
      ...['month', 'months', '1 year', '{count} years', 'year', 'years'],
    ];
    expect(messages.filter((message) => !Object.hasOwn(fr, message))).toEqual([]);
    setLocale('fr');
    expect(tenureLabel({ unit: 'year', count: 2 })).toBe('2 ans');
    expect(distinctionName(distinctionBadge('player-time', accountOf()['player-time']))).toBe(
      'Prospecteur fidèle · 1 an',
    );
    setLocale('en');
  });
});

describe('What a player received', () => {
  it('shows exactly what the server reported, never deriving one itself', () => {
    const received = accountOf();
    expect(Object.keys(received)).toEqual(['player-alpha', 'player-time']);
    expect(received['player-alpha']).toEqual({ at: ALPHA_AT });
    expect(received['player-time']).toEqual(ONE_YEAR);
    // A first sign-in date grants nothing: only the server's reply does.
    expect(receivedDistinctions({ since: NOW - 400 * 86400000, createdAt: 1 })).toEqual({});
    // Unknown future grants and malformed steps are ignored; a bad next step is dropped.
    expect(
      receivedDistinctions({
        distinctions: {
          'player-beta-2030': { at: NOW },
          'player-time': { at: NOW, tenure: { unit: 'fortnight', count: 2 } },
        },
      }),
    ).toEqual({});
    expect(
      receivedDistinctions({
        distinctions: {
          'player-time': { at: NOW, tenure: { unit: 'week', count: 2, next: { unit: 'week' } } },
        },
      }),
    ).toEqual({ 'player-time': { at: NOW, tenure: { unit: 'week', count: 2 } } });
    expect(receivedDistinctions(null)).toEqual({});
  });

  it('takes the latest distinctions from any owner reply, keeping them offline', async () => {
    const { cloud, rememberDistinctions } = await import('../src/services/cloudProfile');
    const { townStorage } = await import('../src/services/townStorage');
    const saved = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: (key) => saved.delete(key),
    });
    const written = vi.spyOn(townStorage, 'account').mockImplementation(() => {});
    cloud.account = { id: 'p1', email: 'p@example.test', distinctions: {} };
    rememberDistinctions({ 'player-time': ONE_YEAR });
    expect(cloud.account.distinctions).toEqual({ 'player-time': ONE_YEAR });
    expect(written).toHaveBeenCalledTimes(1);
    // The same reply again, or a reply without distinctions, writes nothing.
    rememberDistinctions({ 'player-time': ONE_YEAR });
    rememberDistinctions(undefined);
    rememberDistinctions([]);
    expect(written).toHaveBeenCalledTimes(1);
    // An admin removal arrives the same way.
    rememberDistinctions({});
    expect(receivedDistinctions(cloud.account)).toEqual({});
    cloud.account = null;
    rememberDistinctions({ 'player-alpha': { at: 1 } });
    expect(cloud.account).toBeNull();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('marks a new time step as new while the same step stays seen', () => {
    const week = { tenure: { unit: 'week', count: 1 } };
    expect(distinctionKey('player-time', week)).toBe('player-time@week-1');
    expect(distinctionKey('player-alpha', { at: 1 })).toBe('player-alpha');
  });

  it('parses only a known, well-formed published distinction', () => {
    expect(publishedDistinction({ id: 'player-alpha', at: ALPHA_AT })).toEqual({
      'player-alpha': { at: ALPHA_AT },
    });
    expect(
      publishedDistinction({ id: 'player-time', at: 5, tenure: { unit: 'year', count: 3 } }),
    ).toEqual({ 'player-time': { at: 5, tenure: { unit: 'year', count: 3 } } });
    for (const saved of [
      null,
      { id: 'player-unknown', at: 5 },
      { id: 'player-time', tenure: { unit: 'century', count: 1 } },
      { id: 'player-time', tenure: { unit: 'year', count: 0 } },
      { id: 'stars' },
    ])
      expect(publishedDistinction(saved)).toEqual({});
  });
});

describe('One player distinction per town', () => {
  it('fills one of the three slots, only when received and never twice', () => {
    const received = accountOf();
    const honours = earnedHonours();
    expect(
      validShowcase(['player-alpha', 'stars', 'player-time', 'score'], honours, { received }),
    ).toEqual(['player-alpha', 'stars']);
    expect(validShowcase(['player-alpha', 'stars'], honours)).toEqual(['stars']);
    expect(validShowcase(['player-unknown', 'stars'], honours, { received })).toEqual(['stars']);
  });

  it('saves the showcase with the distinction only for the account town', () => {
    const saved = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    });
    setActivePinia(createPinia());
    const campaign = useCampaignStore();
    campaign.honours = earnedHonours();
    expect(campaign.setHonourShowcase(['stars', 'player-alpha'], accountOf())).toBe(true);
    expect(campaign.honours.showcase).toEqual(['stars', 'player-alpha']);
    expect(campaign.setHonourShowcase(['stars', 'player-alpha'])).toBe(true);
    expect(campaign.honours.showcase).toEqual(['stars']);
    vi.unstubAllGlobals();
  });

  it('shows visitors and directory cards the owner’s published distinction', () => {
    const village = {
      appearance: {
        honours: {
          version: 1,
          earned: { 'stars-bronze': { at: NOW } },
          showcase: ['player-time', 'stars', 'player-alpha'],
          distinction: { id: 'player-time', at: NOW, tenure: { unit: 'month', count: 3 } },
        },
      },
    };
    const honours = villageHonours(village);
    expect(honours.showcase).toEqual(['player-time', 'stars']);
    expect(honours.received['player-time'].tenure).toEqual({ unit: 'month', count: 3 });
    const card = cardHonours({
      earned: ['stars-bronze'],
      showcase: ['player-time', 'stars', 'player-alpha'],
      distinction: village.appearance.honours.distinction,
    });
    expect(card.count).toBe(1);
    expect(card.showcase.map((definition) => definition.id)).toEqual([
      'player-time',
      'stars-bronze',
    ]);
    // A town with only a distinction on show still has a card row.
    expect(
      cardHonours({ earned: [], showcase: ['player-alpha'] }, { 'player-alpha': { at: 1 } }),
    ).toMatchObject({ count: 0, showcase: [{ id: 'player-alpha', player: true }] });
  });
});

describe('Player distinction badges and the Player tab', () => {
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
    campaign.honours = earnedHonours(['stars', 'player-alpha']);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('draws a glowing shield, unlike every town medal, engraved with the time step', async () => {
    const received = accountOf();
    const alpha = await render(HonourBadge, {
      definition: distinctionBadge('player-alpha', received['player-alpha']),
    });
    expect(alpha).toContain('honour-badge-player');
    expect(alpha).toContain('--player-glow:#b98cff');
    expect(alpha).toContain('α');
    expect(alpha).not.toContain('<circle');
    expect(alpha).not.toContain('<polygon');
    const medal = await render(HonourBadge, { definition: HONOURS.byId['stars-gold'] });
    expect(medal).not.toContain('honour-badge-player');
    const time = await render(HonourBadge, {
      definition: distinctionBadge('player-time', received['player-time']),
    });
    // The time step reads at a glance: a large count and its unit in capitals.
    expect(time).toMatch(/font-size="31"[^>]*>\s*1\s*<\/text>/);
    expect(time).toMatch(/>\s*YEAR\s*<\/text>/);
    const months = await render(HonourBadge, {
      definition: distinctionBadge('player-time', { tenure: { unit: 'month', count: 11 } }),
    });
    expect(months).toMatch(/>\s*11\s*<\/text>/);
    expect(months).toMatch(/textLength="44"[^>]*>\s*MONTHS\s*<\/text>/);
    // Drawn small beside a town name or on a card, the step is also written out.
    const compact = await render(HonourShowcaseSlots, {
      ids: ['player-time'],
      received: { 'player-time': { at: 1, tenure: { unit: 'week', count: 3 } } },
      compact: true,
    });
    expect(compact).toContain('class="honour-slot-time" aria-hidden="true">3 weeks</small>');
    const row = await render(HonourCardRow, {
      honours: {
        earned: [],
        showcase: ['player-time'],
        distinction: { id: 'player-time', at: 1, tenure: { unit: 'month', count: 2 } },
      },
    });
    expect(row).toContain('2 months</small>');
  });

  it('lists only received distinctions, with dates and the next time step', async () => {
    const html = await render(
      HonourCollectionList,
      {
        tabs: [{ id: 'player', families: [], earned: 2, total: null, fresh: 1 }],
        tab: 'player',
        state: campaign,
        showNew: true,
        freshDistinctions: ['player-time'],
      },
      { pinia, cloudAccount: cloudAccount() },
    );
    expect(html).toContain('Alpha Player');
    expect(html).toContain('Loyal Prospector · 1 year');
    expect(html).toContain('Next: 2 years on');
    expect(html).toContain('>2</b>');
    expect(html).not.toContain('/null');
    expect(html.match(/data-distinction="([\w-]+)"/g)).toHaveLength(2);
    // Alpha Player is on show, so the other one would replace it.
    expect(html).toContain('Remove from showcase');
    expect(html).toContain('Show this one instead');
    expect(html.match(/class="honour-new"/g)).toHaveLength(1);
  });

  it('explains how to receive one when nothing has arrived yet', async () => {
    const html = await render(
      HonourCollectionList,
      {
        tabs: [{ id: 'player', families: [], earned: 0, total: null, fresh: 0 }],
        tab: 'player',
        state: campaign,
      },
      { pinia },
    );
    expect(html).toContain('Sign in to receive player distinctions.');
  });

  it('keeps the distinction on show while other honours are edited', async () => {
    const html = await render(HonourShowcaseEditor, {}, { pinia, cloudAccount: cloudAccount() });
    expect(html).toContain('Player distinctions');
    expect(html).toContain('In the showcase');
    expect(html).toContain('Replace');
    // Removing a town honour, as the editor and an honour's detail do, keeps the
    // distinction; a town off the account cannot keep one.
    const edit = (account) =>
      render(
        defineComponent({
          setup() {
            const { showcase, saveShowcase } = usePlayerDistinctions();
            saveShowcase(showcase.value.filter((id) => id !== 'stars'));
            return () => null;
          },
        }),
        {},
        { pinia, cloudAccount: account },
      );
    await edit(cloudAccount());
    expect(campaign.honours.showcase).toEqual(['player-alpha']);
    campaign.honours = earnedHonours(['stars', 'player-alpha']);
    await edit(cloudAccount({ accountTown: false }));
    expect(campaign.honours.showcase).toEqual([]);
    expect(await render(HonourDetail, { familyId: 'stars' }, { pinia })).toContain(
      'Add to showcase',
    );
    const slots = await render(HonourShowcaseSlots, {
      ids: ['stars', 'player-alpha'],
      earned: campaign.honours.earned,
      received: accountOf(),
    });
    expect(slots).toContain('Alpha Player');
    expect(slots).toContain('Player distinction');
  });

  it('offers no distinction to a town that is not on the account', async () => {
    const html = await render(
      HonourShowcaseEditor,
      {},
      { pinia, cloudAccount: cloudAccount({ accountTown: false }) },
    );
    expect(html).toContain('Only towns on your account can show player distinctions.');
    expect(html).not.toContain('Replace');
  });

  it('shows visitors the owner’s distinction in the gallery and on cards', async () => {
    const honours = villageHonours({
      appearance: {
        honours: {
          version: 1,
          earned: {},
          showcase: ['player-alpha'],
          distinction: { id: 'player-alpha', at: ALPHA_AT },
        },
      },
    });
    const gallery = await render(HonourGallery, { honours, town: 'Alpha Ridge' });
    expect(gallery).toContain('Alpha Player');
    expect(gallery).toContain('Received');
    const row = await render(HonourCardRow, {
      honours: { earned: [], showcase: ['player-alpha'], distinction: { id: 'player-alpha' } },
    });
    expect(row).toContain('title="Alpha Player"');
    expect(row).not.toContain('honours</small>');
  });
});
