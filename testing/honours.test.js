import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  COUNTERS,
  FUSION_MASTER_KEYS,
  GEM_GOALS,
  HONOURS,
  HONOURS_VERSION,
  HONOUR_ID,
  HONOUR_TABS,
  LATER_FUSIONS,
  MINE_ELEMENTS,
  NON_MASTERY_ELEMENTS,
  NON_MILESTONE_ERAS,
  QUARTERMASTER,
  RANK_METALS,
  SCORE_FROM_LEVEL,
  SHOWCASE_SLOTS,
  backfillHonours,
  bestScoreRun,
  buildHonourCatalog,
  createHonours,
  createRunTally,
  creditCounter,
  creditRun,
  eraStep,
  evaluateHonours,
  honourCollection,
  honourFamilies,
  levelElements,
  mergeHonours,
  normalizeHonours,
  pendingAnnouncements,
  publicHonours,
  recordSocial,
  runClaim,
  seedCounts,
  tallySteps,
  validShowcase,
} from '../src/data/honours';
import { elementLevels, levelHonourElements } from '../src/data/honourLevels';
import honourLevels from '../src/data/honourLevels.json';
import { PERSONAL_AREAS } from '../src/data/townLandmarks';
import shippedRanks from './fixtures/shipped-honour-ranks.json';
import { GEM_TYPES } from '../src/game/engine/GemFactory';
import { FUSION_STYLES } from '../src/game/engine/BonusFusion';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { ERAS } from '../src/data/eras';
import { OBSTACLES } from '../src/data/obstacles';
import { LEVEL_COUNT, POWERS } from '../src/data/campaign';
import { bonusCapacity } from '../src/data/rewards';
import { BUILDING_BY_ID } from '../src/data/town';
import { getLevelStarTarget } from '../src/data/starRating';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { HONOUR_NOTICE_MODES, useSettingsStore } from '../src/stores/settingsStore';
import { useHonourNavigation } from '../src/composables/useHonourNavigation';
import fr from '../src/i18n/fr.json';

const target = (id) => getLevelStarTarget(id, null);
const stars = (count, value = 3) =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [i + 1, { score: 1, stars: value }]));
const powers = (quantity, count = POWERS.length) =>
  POWERS.map((power, index) => ({ id: power.id, quantity: index < count ? quantity : 0 }));
const town = (overrides = {}) => ({
  era: 'frontier',
  buildings: {},
  projects: {},
  buildingEras: {},
  buildingEraLevels: {},
  events: {},
  lastCollections: {},
  ...overrides,
});
const state = (overrides = {}) => ({
  records: {},
  powers: powers(0),
  town: town(),
  honours: createHonours(),
  ...overrides,
});
const added = (overrides) => evaluateHonours(state(overrides)).added;
const earned = (ids, at = 1) =>
  normalizeHonours({ earned: Object.fromEntries(ids.map((id) => [id, { at }])) });
const ranks = (familyId, catalog = HONOURS) =>
  catalog.familyById[familyId].ranks.map((rank) => rank.id);

describe('The honours registry', () => {
  it('builds every rank as <family>-<metal>, in ladder order, with growing goals', () => {
    expect(new Set(HONOURS.definitions.map((rank) => rank.id)).size).toBe(
      HONOURS.definitions.length,
    );
    for (const family of HONOURS.families) {
      expect(family.id).toMatch(HONOUR_ID);
      expect(HONOUR_TABS, family.id).toContain(family.tab);
      const metals = family.ranks.map((rank) => RANK_METALS.indexOf(rank.metal));
      expect(metals, family.id).toEqual([...metals].sort((a, b) => a - b));
      for (const [index, rank] of family.ranks.entries()) {
        expect(rank.id).toBe(`${family.id}-${rank.metal}`);
        expect(rank.id).toMatch(HONOUR_ID);
        expect(rank.rank).toBe(index + 1);
        expect(rank.since, rank.id).toBeLessThanOrEqual(HONOURS_VERSION);
        if (index) expect(rank.goal, rank.id).toBeGreaterThan(family.ranks[index - 1].goal);
      }
    }
  });

  it('never moves a shipped rank: goals, measures and versions match the release record', () => {
    // A shipped rank may only change by raising its requirement version, which the record
    // must then repeat. New ranks are added to the record in the same change.
    const current = Object.fromEntries(
      HONOURS.definitions.map((rank) => [
        rank.id,
        { goal: rank.goal, measure: rank.measure, version: rank.version },
      ]),
    );
    expect(JSON.parse(JSON.stringify(current))).toEqual(shippedRanks);
  });

  it('rejects ladders out of metal order, unknown measures and unknown tabs', () => {
    const [stars] = honourFamilies();
    const build = (family) => () => buildHonourCatalog([family]);
    expect(build({ ...stars, ranks: [...stars.ranks].reverse() })).toThrow(/metal order/);
    expect(build({ ...stars, measure: { kind: 'luck' } })).toThrow(/measure/);
    expect(build({ ...stars, tab: 'secret' })).toThrow(/tab/);
    expect(build({ ...stars, ranks: [{ metal: 'bronze', goal: Infinity }] })).toThrow(/goal/);
  });

  it('gives every gem a bronze, silver and gold collection goal', () => {
    for (const gem of GEM_TYPES) {
      expect(GEM_GOALS[gem], gem).toHaveLength(3);
      expect(ranks(`gem-${gem}`)).toEqual([
        `gem-${gem}-bronze`,
        `gem-${gem}-silver`,
        `gem-${gem}-gold`,
      ]);
    }
  });

  it('makes an explicit decision for every mine element, era and bonus fusion', () => {
    const mastery = MINE_ELEMENTS.map((element) => element.obstacle);
    for (const { id } of OBSTACLES)
      expect(mastery.includes(id) !== NON_MASTERY_ELEMENTS.includes(id), id).toBe(true);
    const milestones = HONOURS.definitions
      .filter((rank) => rank.measure.kind === 'era')
      .map((rank) => rank.measure.era);
    for (const era of ERAS.filter((entry) => entry.enabled))
      expect(milestones.includes(era.id) !== NON_MILESTONE_ERAS.includes(era.id), era.id).toBe(
        true,
      );
    for (const key of Object.keys(FUSION_STYLES))
      expect(FUSION_MASTER_KEYS.includes(key) !== LATER_FUSIONS.includes(key), key).toBe(true);
    for (const key of FUSION_MASTER_KEYS) expect(FUSION_STYLES[key], key).toBeTruthy();
  });

  it('keeps Master Quartermaster within the largest storage the town can build', () => {
    const maxed = { buildings: { armory: 3, garage: BUILDING_BY_ID.garage.upgrades.length } };
    expect(QUARTERMASTER.quantity).toBeLessThanOrEqual(bonusCapacity(maxed));
    expect(QUARTERMASTER.powers).toBeLessThanOrEqual(POWERS.length);
  });

  it('keeps the generated level element index in step with the level definitions', () => {
    const live = Object.fromEntries(
      generateLevelConfigs()
        .map((level) => [String(level.id), levelElements(level)])
        .filter(([, elements]) => Object.keys(elements).length),
    );
    expect(honourLevels).toEqual(live);
    expect(levelHonourElements(247)).toEqual({ lanterns: 2 });
    expect(elementLevels('lanterns')).toMatchObject({ pieces: 84, chapters: [42, 62] });
  });

  it('sets mine silver within one campaign and gold near one and a half campaigns', () => {
    for (const element of MINE_ELEMENTS) {
      const perCampaign = elementLevels(element.id).pieces;
      const [bronze, silver, gold] = element.goals;
      expect(bronze, element.id).toBeLessThan(silver);
      expect(silver, element.id).toBeLessThanOrEqual(perCampaign);
      expect(gold / perCampaign, element.id).toBeGreaterThan(1.3);
      expect(gold / perCampaign, element.id).toBeLessThan(1.7);
    }
  });

  it('translates every honour name, requirement, popup and progress line', () => {
    const strings = HONOURS.definitions.flatMap((rank) =>
      [rank.name, rank.requirement, rank.popup, rank.progressText].filter(Boolean),
    );
    const params = HONOURS.definitions.flatMap((rank) =>
      Object.values(rank.params()).filter((value) => typeof value === 'string'),
    );
    const labels = MINE_ELEMENTS.map((element) => element.label);
    for (const text of [...strings, ...params, ...labels]) expect(fr[text], text).toBeTruthy();
  });
});

describe('Measures', () => {
  it('counts three-star puzzles for the stars ladder', () => {
    expect(added({ records: stars(24) })).toEqual([]);
    expect(added({ records: stars(25) })).toEqual(['stars-bronze']);
    expect(added({ records: stars(149) })).not.toContain('stars-silver');
    expect(added({ records: stars(150) })).toContain('stars-silver');
    expect(added({ records: stars(400, 2) })).toEqual([]);
  });

  it('awards score ranks from level 37 at exactly their multiple of the target', () => {
    const id = SCORE_FROM_LEVEL;
    const at = (multiple, level = id) => ({
      records: { [level]: { score: multiple * target(level), stars: 2 } },
    });
    expect(added(at(1.5))).toEqual(['score-bronze']);
    expect(added({ records: { [id]: { score: 2.5 * target(id) - 1, stars: 2 } } })).toEqual([
      'score-bronze',
    ]);
    expect(evaluateHonours(state(at(2.5))).honours.earned['score-silver'].evidence).toEqual({
      levelId: id,
      score: 2.5 * target(id),
      target: target(id),
    });
    expect(added(at(10, id - 1))).toEqual([]);
    expect(bestScoreRun({ 500: { score: 1e9, stars: 3 } }, SCORE_FROM_LEVEL, 500)).toBeNull();
  });

  it('announces only the highest new rank of a family', () => {
    const { honours, added: ids } = evaluateHonours(
      state({ records: { 200: { score: 3 * target(200), stars: 3 } } }),
    );
    expect(ids).toEqual(expect.arrayContaining(['score-bronze', 'score-silver', 'score-gold']));
    const score = pendingAnnouncements(honours).filter(
      (entry) => entry.definition.family === 'score',
    );
    expect(score.map((entry) => entry.id)).toEqual(['score-gold']);
  });

  it('counts eras in two steps each: reached, then completed', () => {
    expect(eraStep('frontier')).toBe(0);
    expect(eraStep('industrial')).toBe(4);
    expect(eraStep('industrial', true)).toBe(5);
    expect(eraStep('starlight')).toBe(-1);
    expect(added({ town: town({ era: 'frontier' }) })).toEqual([]);
    expect(added({ town: town({ era: 'river-rail' }) })).toEqual(['ages-bronze']);
    expect(added({ town: town({ era: 'contemporary' }) })).toEqual(['ages-bronze', 'ages-silver']);
    // Reaching the last era is not completing it.
    expect(added({ town: town({ era: 'riverlight' }) })).toEqual(['ages-bronze', 'ages-silver']);
  });

  it('counts fusions by kind: one, every listed kind, then a hundred', () => {
    const fused = (fusions) => added({ honours: creditRun(createHonours(), { fusions }) });
    expect(fused({ 'bomb+cross': 1 })).toEqual(['fusion-bronze']);
    const everyKind = Object.fromEntries(FUSION_MASTER_KEYS.map((key) => [key, 1]));
    expect(fused(everyKind)).toEqual(['fusion-bronze', 'fusion-silver']);
    expect(fused({ 'bomb+bomb': 299 })).toEqual(['fusion-bronze']);
    expect(fused({ 'bomb+bomb': 300 })).toEqual(['fusion-bronze', 'fusion-gold']);
  });

  it('counts gems, mine elements, forge collections and protected incidents', () => {
    let honours = creditRun(createHonours(), {
      gems: { ruby: GEM_GOALS.ruby[1] },
      mine: { lanterns: MINE_ELEMENTS.find((element) => element.id === 'lanterns').goals[0] },
    });
    for (let i = 0; i < 5; i++)
      honours = creditCounter(creditCounter(honours, 'forge'), 'guardian');
    expect(added({ honours })).toEqual([
      'gem-ruby-bronze',
      'gem-ruby-silver',
      'mine-lanterns-bronze',
      'guardian-bronze',
      'forge-bronze',
    ]);
  });

  it('needs five powers held at 26 at the same time, and spending never revokes it', () => {
    expect(added({ powers: powers(QUARTERMASTER.quantity, QUARTERMASTER.powers - 1) })).toEqual([]);
    expect(added({ powers: powers(QUARTERMASTER.quantity - 1) })).toEqual([]);
    const full = evaluateHonours(state({ powers: powers(QUARTERMASTER.quantity) }));
    expect(full.added).toEqual(['quartermaster-gold']);
    const spent = evaluateHonours(state({ powers: powers(0), honours: full.honours }));
    expect(spent.honours.earned['quartermaster-gold']).toBeTruthy();
  });

  it('ranks the server’s social counts and keeps the highest of each', () => {
    let honours = recordSocial(createHonours(), { visitors: 4, travels: 5 });
    expect(recordSocial(honours, { visitors: 3, travels: 'many' })).toBeNull();
    expect(added({ honours })).toEqual(['visitors-bronze', 'explorer-bronze']);
    honours = recordSocial(honours, { visitors: 15, travels: 30 });
    expect(added({ honours })).toEqual([
      'visitors-bronze',
      'visitors-silver',
      'visitors-gold',
      'explorer-bronze',
      'explorer-silver',
      'explorer-gold',
    ]);
    expect(
      mergeHonours(recordSocial(createHonours(), { visitors: 9 }), honours).counts,
    ).toMatchObject({ visitors: 15, travels: 30 });
  });
});

describe('Run tallies', () => {
  it('counts each committed gem and every real fusion, never the rescue sweep', () => {
    const tally = tallySteps(createRunTally(), [
      {
        collectedJewels: [{ type: 'ruby' }, { type: 'ruby' }, { type: 'relic' }],
        bonusFusion: { key: 'bomb+cross' },
      },
      { collectedJewels: [{ type: 'topaz' }], bonusFusion: { key: 'bomb+cross' } },
      { collectedJewels: [], bonusFusion: { targets: [1, 2] } },
    ]);
    expect(tally).toEqual({ gems: { ruby: 2, topaz: 1 }, fusions: { 'bomb+cross': 2 } });
    const sweep = tallySteps(createRunTally(), [{ collectedJewels: [{ type: 'ruby' }] }], {
      recovery: true,
    });
    expect(sweep.gems).toEqual({});
  });

  it('claims only gems and known fusions in the victory receipt; mine elements stay server-side', () => {
    expect(
      runClaim({
        gems: { ruby: 3, opal: -1 },
        fusions: { 'bomb+cross': 1, constructor: 4 },
        mine: { relics: 2 },
      }),
    ).toEqual({ gems: { ruby: 3 }, fusions: { 'bomb+cross': 1 } });
  });
});

describe('Backfill and seeds', () => {
  const protectedIncident = {
    id: 1,
    outcome: 'protected',
    loss: 0,
    seen: true,
  };

  it('seeds forge and guardian from what the save proves, nothing else', () => {
    const seeded = seedCounts(
      createHonours(),
      town({
        lastCollections: { blacksmith: 5 },
        events: { 'dusty-trail-visitors': protectedIncident },
      }),
    );
    expect(seeded.counts).toMatchObject({ forge: 1, guardian: 1, gems: {}, mine: {} });
    const unseen = town({
      events: { 'dusty-trail-visitors': { ...protectedIncident, seen: false } },
    });
    expect(seedCounts(createHonours(), unseen).counts.guardian).toBe(0);
    const harmless = town({
      events: { 'dusty-trail-visitors': { ...protectedIncident, outcome: 'harmless' } },
    });
    expect(seedCounts(createHonours(), harmless).counts.guardian).toBe(0);
    // Seeds never lower a count.
    const many = creditCounter(creditCounter(createHonours(), 'forge'), 'forge');
    expect(seedCounts(many, town({ lastCollections: { blacksmith: 5 } })).counts.forge).toBe(2);
  });

  it('earns what an older save proves with an unknown date, once per generation', () => {
    const honours = backfillHonours(
      state({
        records: stars(25),
        town: town({ era: 'industrial', lastCollections: { blacksmith: 5 } }),
        honours: { ...createHonours(), backfilled: 0 },
      }),
    );
    expect(Object.keys(honours.earned)).toEqual(['stars-bronze', 'ages-bronze']);
    expect(honours.counts.forge).toBe(1);
    expect(honours.earned['ages-bronze']).toMatchObject({ at: null, backfilled: true });
    expect(honours.backfilled).toBe(HONOURS_VERSION);
    expect(backfillHonours(state({ records: stars(3), honours }))).toEqual(honours);
  });
});

describe('Saved honours', () => {
  it('normalizes bounded values and preserves unknown future honours', () => {
    const honours = normalizeHonours({
      earned: { 'future-honour': { at: 5, seen: true }, 'Bad Id!': {}, 'stars-bronze': 7 },
      counts: {
        gems: { ruby: 4, sapphire: -1 },
        fusions: { 'bomb+cross': 2, 'no way': 1 },
        forge: 2.5,
        mine: { lanterns: 3 },
        guardian: 1,
      },
      showcase: ['a', 'b', 'c', 'd'],
      seenGeneration: -2,
    });
    expect(Object.keys(honours.earned)).toEqual(['future-honour']);
    expect(honours.counts).toEqual({
      gems: { ruby: 4 },
      mine: { lanterns: 3 },
      fusions: { 'bomb+cross': 2 },
      forge: 0,
      guardian: 1,
      visitors: 0,
      travels: 0,
    });
    expect(Object.keys(honours.counts)).toEqual(Object.keys(COUNTERS));
    expect(honours.showcase).toHaveLength(SHOWCASE_SLOTS);
    expect(honours.seenGeneration).toBe(0);
  });

  it('merges two copies of a town without summing counts or losing honours', () => {
    const a = creditRun(earned(['stars-bronze'], 200), {
      gems: { ruby: 10 },
      fusions: { 'bomb+bomb': 1 },
    });
    const b = creditRun(earned(['stars-bronze', 'mine-lanterns-bronze'], 100), {
      gems: { ruby: 7 },
      fusions: { 'cross+cross': 2 },
    });
    const merged = mergeHonours(a, b);
    expect(merged.counts.gems.ruby).toBe(10);
    expect(merged.counts.fusions).toEqual({ 'bomb+bomb': 1, 'cross+cross': 2 });
    expect(merged.earned['stars-bronze'].at).toBe(100);
    expect(Object.keys(merged.earned).sort()).toEqual(['mine-lanterns-bronze', 'stars-bronze']);
    expect(mergeHonours(merged, merged)).toEqual(merged);
  });

  it('keeps a cleared showcase and falls back only when a copy has none', () => {
    const chosen = { ...createHonours(), showcase: ['stars'] };
    expect(mergeHonours({ ...createHonours(), showcase: [] }, chosen).showcase).toEqual([]);
    const { showcase, ...older } = createHonours();
    expect(showcase).toEqual([]);
    expect(mergeHonours(older, chosen).showcase).toEqual(['stars']);
    expect(mergeHonours(undefined, chosen).showcase).toEqual(['stars']);
  });

  it('publishes only earned honours, dates, score evidence and the showcase', () => {
    const honours = normalizeHonours({
      earned: {
        'score-silver': { at: 9, evidence: { levelId: 40, score: 5, target: 2 } },
        'ages-bronze': { at: 3, evidence: { era: 'industrial' } },
        'from-the-future': { at: 1 },
      },
      counts: { gems: { ruby: 99 } },
    });
    honours.showcase = validShowcase(['score', 'mine-lanterns', 'ages'], honours);
    expect(publicHonours(honours)).toEqual({
      version: HONOURS_VERSION,
      earned: {
        'score-silver': { at: 9, evidence: { levelId: 40, score: 5, target: 2 } },
        'ages-bronze': { at: 3 },
      },
      showcase: ['score', 'ages'],
    });
  });

  it('shows Mine, Town and Friends tabs with earned families first', () => {
    const [mine, townTab, friends] = honourCollection(
      state({ honours: earned(['gem-moonstone-silver']) }),
    );
    expect([mine.id, townTab.id, friends.id]).toEqual(['mine', 'town', 'friends']);
    expect(mine.families[0]).toMatchObject({
      id: 'gem-moonstone',
      earned: { id: 'gem-moonstone-silver' },
      next: { definition: { id: 'gem-moonstone-gold' } },
    });
    expect(mine).toMatchObject({ earned: 1, fresh: 1 });
    expect(townTab.families.map((family) => family.id)).toEqual([
      'ages',
      'guardian',
      'forge',
      'quartermaster',
      'monument',
    ]);
    expect(friends.families.map((family) => family.id)).toEqual(['visitors', 'explorer']);
  });
});

describe('Extending the registry with later content', () => {
  // A later update: Diamond for the stars ladder and a new era for Through the Ages.
  const starlight = { id: 'starlight', label: 'Starlight Age', enabled: true };
  const eras = [...ERAS, starlight];
  const later = buildHonourCatalog(
    honourFamilies({ eras }).map((family) => {
      if (family.id === 'stars')
        return { ...family, ranks: [...family.ranks, { metal: 'diamond', goal: 500, since: 2 }] };
      // Through the Ages shipped its diamond with Twin Hollows; a ladder without one
      // still shows how a later era rank joins it.
      if (family.id === 'ages' && !family.ranks.some((rank) => rank.metal === 'diamond'))
        return {
          ...family,
          ranks: [
            ...family.ranks,
            {
              metal: 'diamond',
              goal: eraStep('starlight', true, eras),
              measure: { kind: 'era', era: 'starlight', complete: true },
              params: { era: starlight.label },
              since: 2,
            },
          ],
        };
      return family;
    }),
    { eras, levelCount: LEVEL_COUNT + 120 },
  );

  it('keeps every shipped rank and its goal exactly as it was', () => {
    for (const rank of HONOURS.definitions)
      expect(later.byId[rank.id], rank.id).toMatchObject({
        goal: rank.goal,
        measure: rank.measure,
        metal: rank.metal,
        rank: rank.rank,
      });
    expect(ranks('stars', later).at(-1)).toBe('stars-diamond');
  });

  it('keeps earned honours and marks the new rank until the player has looked', () => {
    const goldHolder = evaluateHonours(state({ records: stars(350) })).honours;
    expect(goldHolder.earned['stars-gold']).toBeTruthy();
    const view = (seenGeneration) =>
      honourCollection(
        state({ records: stars(350), honours: { ...goldHolder, seenGeneration } }),
        later,
      )[0].families.find((family) => family.id === 'stars');
    expect(view(1)).toMatchObject({
      earned: { id: 'stars-gold' },
      newRank: true,
      next: { definition: { id: 'stars-diamond' }, progress: { value: 350, goal: 500 } },
    });
    expect(view(2).newRank).toBe(false);
    const diamond = evaluateHonours(state({ records: stars(500), honours: goldHolder }), {
      catalog: later,
    });
    expect(diamond.added).toEqual(['stars-diamond']);
    expect(diamond.honours.earned['stars-gold']).toEqual(goldHolder.earned['stars-gold']);
  });

  it('leaves a gem without calibrated goals listed but impossible to earn', () => {
    const opal = buildHonourCatalog(honourFamilies({ gemTypes: [...GEM_TYPES, 'opal'] }));
    expect(opal.familyById['gem-opal'].ranks).toEqual([]);
    const honours = creditRun(createHonours(), { gems: { opal: 1e6 } });
    expect(evaluateHonours(state({ honours }), { catalog: opal }).added).toEqual([]);
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
    campaign.honours = { ...earned(['score-silver']), seenGeneration: 0 };
    expect(campaign.setHonourShowcase(['score', 'mine-lanterns', 'score'])).toBe(true);
    expect(campaign.honours.showcase).toEqual(['score']);
    expect(campaign.markHonoursSeen()).toBe(true);
    expect(campaign.honours.earned['score-silver'].seen).toBe(true);
    expect(campaign.honours.seenGeneration).toBe(HONOURS_VERSION);
    expect(campaign.markHonoursSeen()).toBe(false);
    expect(JSON.parse(saved.get(SAVE_KEY)).honours.showcase).toEqual(['score']);
    campaign.reloadLocal();
    expect(campaign.honours.showcase).toEqual(['score']);
    expect(campaign.honours.earned['score-silver'].seen).toBe(true);
  });

  it('records the guestbook’s social counts', () => {
    const campaign = useCampaignStore();
    expect(campaign.recordTownSocial({ visitors: 5, travels: 2 })).toBe(true);
    expect(campaign.recordTownSocial({ visitors: 2 })).toBe(false);
    expect(campaign.honours.counts).toMatchObject({ visitors: 5, travels: 2 });
    expect(Object.keys(campaign.honours.earned)).toEqual(['visitors-bronze', 'visitors-silver']);
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
    navigation.openCollection('mine-lanterns');
    navigation.openMuseumFor('mine-lanterns');
    expect(useHonourNavigation().requests).toEqual({
      collection: { familyId: 'mine-lanterns' },
      museum: { familyId: 'mine-lanterns' },
    });
    navigation.closeCollection();
    navigation.clearMuseumRequest();
    expect(navigation.requests).toEqual({ collection: null, museum: null });
  });
});

describe('First monument: one permanent distinction', () => {
  const monumentTown = (choice) =>
    town({ era: 'industrial', personalisation: { areas: { monument: [choice] } } });
  it('has exactly one rank and awards any of the five monuments', () => {
    expect(ranks('monument')).toEqual(['monument-gold']);
    for (const choice of PERSONAL_AREAS.find((area) => area.id === 'monument').choices) {
      expect(added({ town: monumentTown(choice) })).toContain('monument-gold');
    }
    for (const choice of [null, 'unknown', 'headframe']) {
      expect(added({ town: monumentTown(choice) })).not.toContain('monument-gold');
    }
    expect(added({ town: town() })).not.toContain('monument-gold');
  });
  it('keeps the original award when replaced or restored and never adds another tier', () => {
    const first = evaluateHonours(state({ town: monumentTown('founders-arch') }), { at: 123 });
    for (const choice of ['guardian', null]) {
      const next = evaluateHonours(state({ town: monumentTown(choice), honours: first.honours }), {
        at: 456,
      });
      expect(next.added).not.toContain('monument-gold');
      expect(next.honours.earned['monument-gold']).toEqual(first.honours.earned['monument-gold']);
    }
  });
  it('treats an unknown landmark parcel as zero progress', () => {
    const catalog = buildHonourCatalog(
      honourFamilies().map((family) =>
        family.id === 'monument'
          ? { ...family, measure: { kind: 'landmark', area: 'unknown' } }
          : family,
      ),
    );
    const view = state({ town: town({ personalisation: { areas: { unknown: ['guardian'] } } }) });
    expect(catalog.byId['monument-gold'].progress(view).value).toBe(0);
    expect(evaluateHonours(view, { catalog }).added).not.toContain('monument-gold');
  });
  it('catches up saves from the previous honour generation once', () => {
    const old = state({
      town: monumentTown('world-tree'),
      honours: { ...createHonours(), version: 1, backfilled: 1, seenGeneration: 1 },
    });
    const honours = backfillHonours(old);
    expect(honours.earned['monument-gold']).toMatchObject({
      at: null,
      backfilled: true,
      version: 1,
    });
    expect(honours.backfilled).toBe(HONOURS_VERSION);
    expect(backfillHonours({ ...old, honours })).toEqual(honours);
  });
});
