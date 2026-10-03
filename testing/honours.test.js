import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  FORGE_VETERAN_GOAL,
  GEM_GOALS,
  HONOURS,
  INCIDENT_NAMES,
  MEDAL_NAMES,
  MINE_ELEMENTS,
  NON_MASTERY_ELEMENTS,
  SCORE_FROM_LEVEL,
  SHOWCASE_SLOTS,
  awardHonour,
  backfillDefenceMedal,
  bestScoreRun,
  createHonourCatalog,
  createHonours,
  createRunTally,
  creditForge,
  creditRun,
  defenceMedal,
  evaluateHonours,
  honourCollection,
  levelElements,
  maxPowerCapacity,
  recordVisitors,
  mergeHonours,
  normalizeHonours,
  pendingAnnouncements,
  publicHonours,
  tallySteps,
  validShowcase,
} from '../src/data/honours';
import { elementLevels, levelHonourElements } from '../src/data/honourLevels';
import honourLevels from '../src/data/honourLevels.json';
import { GEM_TYPES } from '../src/game/engine/GemFactory';
import { FUSION_STYLES } from '../src/game/engine/BonusFusion';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { ERAS } from '../src/data/eras';
import { OBSTACLES } from '../src/data/obstacles';
import { LEVEL_COUNT, POWERS } from '../src/data/campaign';
import { getLevelStarTarget } from '../src/data/starRating';
import { eraEventKind } from '../src/data/townEvents';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { HONOUR_NOTICE_MODES, useSettingsStore } from '../src/stores/settingsStore';
import { useHonourNavigation } from '../src/composables/useHonourNavigation';
import fr from '../src/i18n/fr.json';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import HonourBadge from '../src/components/honours/HonourBadge.vue';

const records = (entries) => Object.fromEntries(entries.map(([id, record]) => [id, record]));
const target = (id) => getLevelStarTarget(id, null);
const allStars = (count = LEVEL_COUNT) =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, { score: 1, stars: 3 }]));
const fullPowers = (quantity) => POWERS.map((power) => ({ id: power.id, quantity }));
const state = (overrides = {}) => ({
  records: {},
  powers: fullPowers(0),
  town: { era: 'frontier', buildings: {}, projects: {}, buildingEras: {}, buildingEraLevels: {} },
  honours: createHonours(),
  ...overrides,
});
const earnedIds = (honours) => Object.keys(honours.earned).sort();

describe('The honours registry follows the content definitions', () => {
  it('gives every gem type a calibrated laureate and every enabled era a named medal', () => {
    for (const gem of GEM_TYPES) {
      expect(GEM_GOALS[gem]).toBeGreaterThan(0);
      expect(HONOURS.byId[`laureate-${gem}`]).toBeTruthy();
    }
    for (const era of ERAS.filter((entry) => entry.enabled)) {
      expect(MEDAL_NAMES[era.id], era.id).toBeTruthy();
      expect(INCIDENT_NAMES[eraEventKind(era.id)], era.id).toBeTruthy();
      expect(HONOURS.byId[`defence-${era.id}`].incident).toBe(eraEventKind(era.id));
    }
  });

  it('makes an explicit mastery decision for every mine element', () => {
    const mastery = MINE_ELEMENTS.map((element) => element.obstacle).filter(Boolean);
    for (const { id } of OBSTACLES)
      expect(mastery.includes(id) || NON_MASTERY_ELEMENTS.includes(id), id).toBe(true);
  });

  it('covers every supported bonus fusion and keeps IDs unique', () => {
    expect(HONOURS.fusionKeys).toEqual(Object.keys(FUSION_STYLES));
    const ids = HONOURS.definitions.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(HONOURS.families.filter((family) => family.category === 'achievement')).toHaveLength(
      10 + GEM_TYPES.length,
    );
  });

  it('derives maximum storage from the armory and garage definitions', () => {
    // 20 from a fully upgraded armory plus 6 from a level-3 garage today.
    expect(maxPowerCapacity().capacity).toBe(26);
  });

  it('keeps the generated level element index in step with the level definitions', () => {
    const live = Object.fromEntries(
      generateLevelConfigs()
        .map((level) => [String(level.id), levelElements(level)])
        .filter(([, elements]) => Object.keys(elements).length),
    );
    expect(honourLevels).toEqual(live);
    expect(levelHonourElements(247)).toEqual({ lanterns: 2 });
    const lanterns = elementLevels('lanterns');
    expect(lanterns.pieces).toBe(84);
    expect(lanterns.chapters).toEqual([42, 62]);
  });

  it('sets each mastery goal near one and a half campaigns of its element', () => {
    for (const element of MINE_ELEMENTS) {
      const perCampaign = elementLevels(element.id).pieces;
      expect(element.goal / perCampaign, element.id).toBeGreaterThan(1.3);
      expect(element.goal / perCampaign, element.id).toBeLessThan(1.7);
    }
  });

  it('translates every honour name, requirement and popup line', () => {
    const strings = HONOURS.definitions.flatMap((definition) => [
      definition.name,
      definition.requirement,
      ...(definition.popup ? [definition.popup] : []),
    ]);
    const extra = [
      ...Object.values(INCIDENT_NAMES),
      ...MINE_ELEMENTS.map((element) => element.label),
    ];
    for (const text of [...strings, ...extra]) expect(fr[text], text).toBeTruthy();
  });
});

describe('Score ranks', () => {
  it('awards Ace at exactly twice the target from level 37, not below or before', () => {
    const id = SCORE_FROM_LEVEL;
    const below = evaluateHonours(
      state({ records: records([[id, { score: 2 * target(id) - 1, stars: 3 }]]) }),
    );
    expect(below.added).not.toContain('score-ace');
    const at = evaluateHonours(
      state({ records: records([[id, { score: 2 * target(id), stars: 3 }]]) }),
    );
    expect(at.added).toContain('score-ace');
    expect(at.honours.earned['score-ace'].evidence).toEqual({
      levelId: id,
      score: 2 * target(id),
      target: target(id),
    });
    const early = evaluateHonours(
      state({ records: records([[id - 1, { score: 10 * target(id - 1), stars: 3 }]]) }),
    );
    expect(early.added).not.toContain('score-ace');
  });

  it('promotes straight to Legend and announces only the highest new rank', () => {
    const id = 200;
    const { honours, added } = evaluateHonours(
      state({ records: records([[id, { score: 3 * target(id), stars: 3 }]]) }),
    );
    expect(added).toEqual(expect.arrayContaining(['score-ace', 'score-legend']));
    const score = pendingAnnouncements(honours).filter(
      (entry) => entry.definition.family === 'score',
    );
    expect(score.map((entry) => entry.id)).toEqual(['score-legend']);
  });

  it('never counts a level without a usable star target', () => {
    expect(bestScoreRun({ 500: { score: 1e9, stars: 3 } }, SCORE_FROM_LEVEL, 500)).toBeNull();
  });
});

describe('Run tallies and lifetime counts', () => {
  it('counts each committed gem once by type and records real fusion keys', () => {
    const tally = tallySteps(createRunTally(), [
      {
        collectedJewels: [
          { id: 'a', type: 'ruby' },
          { id: 'b', type: 'ruby' },
          { id: 'c', type: 'relic' },
        ],
        bonusFusion: { key: 'bomb+cross' },
      },
      { collectedJewels: [{ id: 'd', type: 'topaz' }], bonusFusion: { key: 'bomb+cross' } },
      { collectedJewels: [], bonusFusion: { targets: [1, 2] } },
    ]);
    expect(tally).toEqual({ gems: { ruby: 2, topaz: 1 }, fusions: ['bomb+cross'], mine: {} });
    const sweep = tallySteps(createRunTally(), [{ collectedJewels: [{ id: 'e', type: 'ruby' }] }], {
      recovery: true,
    });
    expect(sweep.gems).toEqual({});
  });

  it('unlocks laureates, fusions, mastery and the forge from saved counts', () => {
    let honours = creditRun(createHonours(), {
      gems: { ruby: GEM_GOALS.ruby },
      fusions: Object.keys(FUSION_STYLES),
      mine: { lanterns: 125 },
    });
    for (let i = 0; i < FORGE_VETERAN_GOAL; i++) honours = creditForge(honours);
    const { added } = evaluateHonours(state({ honours }));
    expect(added).toEqual(
      expect.arrayContaining([
        'laureate-ruby',
        'first-fusion',
        'fusion-master',
        'lamplighter',
        'forge-delivers',
        'forge-veteran',
      ]),
    );
    expect(added).not.toContain('laureate-sapphire');
  });
});

describe('State-derived honours', () => {
  const maxedTown = {
    era: 'frontier',
    buildings: { armory: 3, garage: 3 },
    projects: {},
    buildingEras: {},
    buildingEraLevels: {},
  };
  it('needs all five powers full at maximum storage at the same time', () => {
    const capacity = maxPowerCapacity().capacity;
    const lowCapacity = state({
      powers: fullPowers(capacity),
      town: { ...maxedTown, buildings: {} },
    });
    expect(evaluateHonours(lowCapacity).added).not.toContain('master-quartermaster');
    const almost = state({
      town: maxedTown,
      powers: fullPowers(capacity).map((power, i) => (i ? power : { ...power, quantity: 1 })),
    });
    expect(evaluateHonours(almost).added).not.toContain('master-quartermaster');
    const full = evaluateHonours(state({ town: maxedTown, powers: fullPowers(capacity) }));
    expect(full.added).toContain('master-quartermaster');
    // Spending later never revokes an earned honour.
    const spent = evaluateHonours(
      state({ town: maxedTown, powers: fullPowers(0), honours: full.honours }),
    );
    expect(spent.honours.earned['master-quartermaster']).toBeTruthy();
  });

  it('awards Perfect Prospector for every published level and keeps it when levels are added', () => {
    const { honours, added } = evaluateHonours(state({ records: allStars() }));
    expect(added).toContain('perfect-prospector');
    expect(honours.earned['perfect-prospector'].evidence).toEqual({ levels: LEVEL_COUNT });
    const future = createHonourCatalog({ levelCount: LEVEL_COUNT + 6 });
    const later = evaluateHonours(state({ records: allStars(), honours }), { catalog: future });
    expect(later.honours.earned['perfect-prospector']).toBeTruthy();
    const fresh = evaluateHonours(state({ records: allStars() }), { catalog: future });
    expect(fresh.added).not.toContain('perfect-prospector');
  });

  it('marks backfilled honours with an unknown date', () => {
    const { honours } = evaluateHonours(
      state({ records: records([[3, { score: 1, stars: 3 }]]) }),
      {
        backfill: true,
      },
    );
    expect(honours.earned['first-perfect']).toMatchObject({ at: null, backfilled: true });
    expect(honours.backfilled).toBeGreaterThan(0);
  });
});

describe('Era defence medals', () => {
  const event = { kind: 'workshop-fire', outcome: 'protected', loss: 0, seen: true };
  it('needs a genuinely protected outcome in the incident’s own era', () => {
    expect(defenceMedal(event, 'motor-age')).toBe('defence-motor-age');
    expect(defenceMedal({ ...event, outcome: 'harmless' }, 'motor-age')).toBeNull();
    expect(defenceMedal({ ...event, loss: 3 }, 'motor-age')).toBeNull();
    expect(defenceMedal(event, 'frontier')).toBeNull();
    expect(evaluateHonours(state()).added.some((id) => id.startsWith('defence-'))).toBe(false);
  });
  it('backfills only a receipt whose kind belongs to exactly one era', () => {
    expect(backfillDefenceMedal({ outcome: 'protected', loss: 0, seen: true })).toBe(
      'defence-frontier',
    );
    expect(backfillDefenceMedal(event)).toBeNull();
    expect(backfillDefenceMedal({ ...event, kind: 'cargo-theft', seen: false })).toBeNull();
  });
});

describe('Saved honours', () => {
  it('normalizes bounded values and preserves unknown future honours', () => {
    const honours = normalizeHonours({
      earned: { 'future-honour': { at: 5, seen: true }, 'Bad Id!': {}, 'first-fusion': 7 },
      counts: { gems: { ruby: 4, sapphire: -1 }, forge: 2.5, mine: { lanterns: 3 } },
      fusions: ['bomb+cross', 'bomb+cross', 'nope'],
      showcase: ['a', 'b', 'c', 'd'],
    });
    expect(earnedIds(honours)).toEqual(['future-honour']);
    expect(honours.counts).toEqual({
      gems: { ruby: 4 },
      forge: 0,
      mine: { lanterns: 3 },
      visitors: 0,
    });
    expect(honours.fusions).toEqual(['bomb+cross']);
    expect(honours.showcase).toHaveLength(SHOWCASE_SLOTS);
  });

  it('merges two copies of a town without summing counts or losing honours', () => {
    const a = awardHonour(creditRun(createHonours(), { gems: { ruby: 10 } }), 'first-perfect', {
      at: 200,
    });
    const b = awardHonour(creditRun(createHonours(), { gems: { ruby: 7 } }), 'first-perfect', {
      at: 100,
    });
    const merged = mergeHonours(a, awardHonour(b, 'lamplighter', { at: 300 }));
    expect(merged.counts.gems.ruby).toBe(10);
    expect(merged.earned['first-perfect'].at).toBe(100);
    expect(earnedIds(merged)).toEqual(['first-perfect', 'lamplighter']);
    expect(mergeHonours(merged, merged)).toEqual(merged);
  });

  it('publishes only earned honours, dates, score evidence and the showcase', () => {
    let honours = creditRun(createHonours(), { gems: { ruby: 99 } });
    honours = awardHonour(honours, 'score-ace', {
      at: 9,
      evidence: { levelId: 40, score: 5, target: 2 },
    });
    honours = awardHonour(honours, 'from-the-future', { at: 1 });
    honours.showcase = validShowcase(['score', 'lamplighter'], honours);
    expect(publicHonours(honours)).toEqual({
      version: 1,
      earned: { 'score-ace': { at: 9, evidence: { levelId: 40, score: 5, target: 2 } } },
      showcase: ['score'],
    });
  });

  it('lists earned families first in each collection tab', () => {
    const honours = awardHonour(createHonours(), 'laureate-moonstone', { at: 1 });
    const [achievements, mine, defence] = honourCollection(state({ honours }));
    expect(achievements.families[0].id).toBe('laureate-moonstone');
    expect(achievements.earned).toBe(1);
    expect(achievements.fresh).toBe(1);
    expect(mine.total).toBe(MINE_ELEMENTS.length);
    expect(defence.families.find((family) => family.id === 'defence-frontier').status).toBe(
      'current',
    );
    expect(defence.families.find((family) => family.id === 'defence-riverlight').status).toBe(
      'future',
    );
  });
});

describe('Extending the registry', () => {
  it('names a new era, gem and level count without editing consumers, safely', () => {
    const catalog = createHonourCatalog({
      eras: [...ERAS, { id: 'starlight', label: 'Starlight Age', enabled: true }],
      gemTypes: [...GEM_TYPES, 'opal'],
      levelCount: LEVEL_COUNT + 6,
    });
    expect(catalog.byId['defence-starlight'].name).toBe('Starlight Age Guardian');
    expect(catalog.byId['laureate-opal'].name).toBe('Opal Laureate');
    const opal = creditRun(createHonours(), { gems: { opal: 1e6 } });
    expect(evaluateHonours(state({ honours: opal }), { catalog }).added).not.toContain(
      'laureate-opal',
    );
    expect(catalog.byId['perfect-prospector'].params()).toEqual({ levels: LEVEL_COUNT + 6 });
  });
});

describe('Campaign store honours state', () => {
  let saved;
  beforeEach(() => {
    saved = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    });
    setActivePinia(createPinia());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('saves honours with the profile and accepts only earned families in the showcase', () => {
    const campaign = useCampaignStore();
    campaign.honours = awardHonour(campaign.honours, 'score-ace', { at: 1 });
    expect(campaign.setHonourShowcase(['score', 'lamplighter', 'score'])).toBe(true);
    expect(campaign.honours.showcase).toEqual(['score']);
    expect(campaign.markHonoursSeen()).toBe(true);
    expect(campaign.honours.earned['score-ace'].seen).toBe(true);
    expect(campaign.markHonoursSeen()).toBe(false);
    const profile = JSON.parse(saved.get(SAVE_KEY));
    expect(profile.honours?.showcase ?? profile.data?.honours?.showcase).toBeTruthy();
    campaign.reloadLocal();
    expect(campaign.honours.showcase).toEqual(['score']);
    expect(campaign.honours.earned['score-ace'].seen).toBe(true);
  });
});

describe('Honour presentation preferences and navigation', () => {
  let saved;
  beforeEach(() => {
    saved = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    });
    setActivePinia(createPinia());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the Full, Quiet or Off notice choice on this device only', () => {
    expect(useSettingsStore().honourNotices).toBe('full');
    useSettingsStore().setHonourNotices('quiet');
    useSettingsStore().setHonourNotices('loud');
    expect(HONOUR_NOTICE_MODES).toEqual(['full', 'quiet', 'off']);
    setActivePinia(createPinia());
    expect(useSettingsStore().honourNotices).toBe('quiet');
  });

  it('lets the popup open the collection and a detail open a filtered museum', () => {
    const navigation = useHonourNavigation();
    navigation.openCollection('lamplighter');
    navigation.openMuseumFor('lamplighter');
    expect(useHonourNavigation().requests).toEqual({
      collection: { familyId: 'lamplighter' },
      museum: { familyId: 'lamplighter' },
    });
    navigation.closeCollection();
    navigation.clearMuseumRequest();
    expect(navigation.requests).toEqual({ collection: null, museum: null });
  });
});

describe('Honour badge artwork', () => {
  const render = (props) => renderToString(createSSRApp({ render: () => h(HonourBadge, props) }));

  it('draws every catalog honour with a frame for its difficulty', async () => {
    for (const definition of HONOURS.definitions) {
      const html = await render({ definition, size: 48 });
      expect(html, definition.id).toContain('<svg');
      const frame = definition.art.frame;
      expect(html, definition.id).toContain(
        frame === 'easy' ? '<circle' : frame === 'medal' ? 'M50 4 88 15' : '<polygon',
      );
    }
  });

  it('greys out and locks an unearned honour and engraves score ranks', async () => {
    const html = await render({ definition: HONOURS.byId['score-legend'], locked: true });
    expect(html).toContain('honour-badge-locked');
    expect(html).toContain('honour-badge-lock');
    expect(html).toContain('3×');
  });
});

describe('Visitor ranks', () => {
  it('ranks the server count of different players and keeps the highest count', () => {
    let honours = recordVisitors(createHonours(), 4);
    expect(recordVisitors(honours, 3)).toBeNull();
    expect(recordVisitors(honours, 'many')).toBeNull();
    const four = evaluateHonours(state({ honours }));
    expect(four.added).toContain('first-guest');
    expect(four.added).not.toContain('welcoming-host');
    honours = recordVisitors(four.honours, 15);
    const fifteen = evaluateHonours(state({ honours }));
    expect(fifteen.added).toEqual(['welcoming-host', 'popular-destination']);
    const visitors = pendingAnnouncements(fifteen.honours).filter(
      (entry) => entry.definition.family === 'visitors',
    );
    expect(visitors.map((entry) => entry.id)).toEqual(['popular-destination']);
    expect(mergeHonours(recordVisitors(createHonours(), 9), honours).counts.visitors).toBe(15);
  });

  it('backfills the first rank from a saved signed-in guest', () => {
    const town = { ...state().town, guestVip: { name: 'Dustwater', at: 5, seen: true } };
    const { honours } = evaluateHonours(state({ town }), { backfill: true });
    expect(honours.earned['first-guest']).toMatchObject({ at: null, backfilled: true });
    expect(honours.earned['welcoming-host']).toBeUndefined();
  });

  it('records the guestbook count through the campaign store', () => {
    const saved = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    });
    setActivePinia(createPinia());
    try {
      const campaign = useCampaignStore();
      expect(campaign.recordTownVisitors(5)).toBe(true);
      expect(campaign.recordTownVisitors(2)).toBe(false);
      expect(campaign.honours.counts.visitors).toBe(5);
      expect(Object.keys(campaign.honours.earned)).toEqual(
        expect.arrayContaining(['first-guest', 'welcoming-host']),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
