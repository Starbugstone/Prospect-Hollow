// Town Honours (issue #60): one registry of honour families, each a ladder of metal
// ranks (bronze → silver → gold, with diamond and later metals kept for future
// content). A shipped rank's goal is fixed: new levels, eras or bonuses add ranks or
// families at the end and never move an existing goal (see AGENTS.md). Earned
// honours are permanent and keep the requirement version they were earned under.
//
// Every rank declares what it measures as data ({ kind, ... }). The game evaluates
// those measures here and the server evaluates the same exported descriptors in
// backend/src/Honours.php, so both agree on what each honour needs.
import { GEM_TYPES } from '../game/engine/GemFactory';
import { FUSION_STYLES } from '../game/engine/BonusFusion';
import { isEraComplete } from '../game/town/TownEras';
import { LEVEL_COUNT } from './campaign';
import { ERAS } from './eras';
import { OBSTACLES } from './obstacles';
import { isPlayerDistinction } from './playerDistinctions';
import { getLevelStarTarget } from './starRating';
import { BANDIT_EVENT } from './town';
import { PERSONAL_AREAS } from './townLandmarks';

// The saved block's shape and the catch-up generation: saves from an older generation
// are re-evaluated once on load. It is not a requirement version (see `version` on a
// rank) and a new rank or family raises it so existing saves earn what they prove.
export const HONOURS_VERSION = 3;
// Ranks in ladder order. A family may stop early; new ranks only ever append.
export const RANK_METALS = Object.freeze(['bronze', 'silver', 'gold', 'diamond']);
const METAL_DIFFICULTY = Object.freeze({
  bronze: 'easy',
  silver: 'medium',
  gold: 'hard',
  diamond: 'hard',
});
export const HONOUR_TABS = Object.freeze(['mine', 'town', 'friends']);
export const SHOWCASE_SLOTS = 3;
// Opening star targets are deliberately low, so score ranks count from the first level
// calibrated at the 35th percentile (docs/honours.md).
export const SCORE_FROM_LEVEL = 37;

// Lifetime counters, credited by completed puzzles and town actions. Maps count by key
// (gem type, mine element, fusion key); the server keeps its own copy of the same
// counters from the journal it replays (docs/honours.md, "Trust and offline play").
export const COUNTERS = Object.freeze({
  gems: 'map',
  mine: 'map',
  fusions: 'map',
  forge: 'number',
  guardian: 'number',
  // Social counts come from the server: different signed-in players who visited this
  // town, and different players' villages visited from it.
  visitors: 'number',
  travels: 'number',
});

// ---------- Fixed goals (calibrated in docs/honours.md) ----------
// Lifetime gems collected in completed puzzles: bronze, silver, gold.
export const GEM_GOALS = Object.freeze({
  ruby: [500, 10000, 25000],
  sapphire: [500, 10000, 25000],
  emerald: [500, 10000, 25000],
  topaz: [500, 6000, 16000],
  amethyst: [500, 6000, 16000],
  moonstone: [500, 6000, 16000],
});
const GEM_TEXT = Object.freeze({
  ruby: ['Ruby Laureate', 'Collect {goal} rubies in completed puzzles.', '{goal} rubies collected'],
  sapphire: [
    'Sapphire Laureate',
    'Collect {goal} sapphires in completed puzzles.',
    '{goal} sapphires collected',
  ],
  emerald: [
    'Emerald Laureate',
    'Collect {goal} emeralds in completed puzzles.',
    '{goal} emeralds collected',
  ],
  topaz: ['Topaz Laureate', 'Collect {goal} topaz in completed puzzles.', '{goal} topaz collected'],
  amethyst: [
    'Amethyst Laureate',
    'Collect {goal} amethysts in completed puzzles.',
    '{goal} amethysts collected',
  ],
  moonstone: [
    'Moonstone Laureate',
    'Collect {goal} moonstones in completed puzzles.',
    '{goal} moonstones collected',
  ],
});
// The bonus fusions Fusion Master asks for, fixed when it shipped. A later fusion joins a
// new rank or LATER_FUSIONS, never this list.
export const FUSION_MASTER_KEYS = Object.freeze([
  'bomb+bomb',
  'bomb+cross',
  'bomb+rainbow',
  'cross+cross',
  'cross+rainbow',
  'rainbow+rainbow',
]);
export const LATER_FUSIONS = Object.freeze([]);
// Master Quartermaster: this many different powers held at this quantity at once.
export const QUARTERMASTER = Object.freeze({ powers: 5, quantity: 26 });

// Signature mine elements. Completing a puzzle consumes every one of them (objective
// layers, relics or ore orders), so a completed level credits its authored count.
export const MINE_ELEMENTS = Object.freeze([
  {
    id: 'relics',
    name: 'Relic Keeper',
    goals: [10, 125, 360],
    obstacle: 'relic',
    art: '/art/relic.svg',
    label: 'Relics',
    requirement: 'Deliver {goal} relics in completed puzzles.',
    popup: '{goal} relics delivered',
    count: (config) => (config.board ?? []).filter((gem) => gem?.type === 'relic').length,
  },
  {
    id: 'lanterns',
    name: 'Lamplighter',
    goals: [10, 50, 125],
    obstacle: 'lantern',
    label: 'Lanterns',
    requirement: 'Light {goal} lanterns in completed puzzles.',
    popup: '{goal} lanterns lit',
  },
  {
    id: 'surveys',
    name: 'Trail Surveyor',
    goals: [5, 20, 60],
    obstacle: 'survey',
    label: 'Survey trails',
    requirement: 'Complete {goal} survey trails.',
    popup: '{goal} survey trails completed',
    // One numbered trail per level, however many markers it has.
    count: (config, tiles) => Number(tiles.some((tile) => obstacle('survey').present(tile))),
  },
  {
    id: 'oreOrders',
    name: 'Ore Merchant',
    goals: [10, 40, 110],
    obstacle: 'ore-orders',
    label: 'Ore orders',
    requirement: 'Fill {goal} ore orders.',
    popup: '{goal} ore orders filled',
    count: (config) => (config.oreOrders ?? []).length,
  },
  {
    id: 'cores',
    name: 'Core Engineer',
    goals: [10, 50, 125],
    obstacle: 'charge-core',
    label: 'Charge cores',
    requirement: 'Release {goal} charge cores.',
    popup: '{goal} charge cores released',
  },
  {
    id: 'gates',
    name: 'Gate Breaker',
    goals: [10, 50, 130],
    obstacle: 'blast-gate',
    label: 'Blast gates',
    requirement: 'Break {goal} blast gates.',
    popup: '{goal} blast gates broken',
  },
]);
// Every other mine element is deliberately not a mastery family: common obstacles, or
// too few levels. A new obstacle must join MINE_ELEMENTS or this list.
export const NON_MASTERY_ELEMENTS = Object.freeze([
  'encased-fossil',
  'fossil',
  'spore',
  'root-knot',
  'ice',
  'stone',
  'double-ice',
  'reinforced',
  'frozen',
  'chain',
  'seal-ruby',
  'seal-sapphire',
  'seal-emerald',
]);
// Through the Ages names its eras. Every other enabled era is listed here, so a new era
// is a deliberate decision: a new rank (diamond and beyond) or an entry in this list.
export const NON_MILESTONE_ERAS = Object.freeze([
  'frontier',
  'industrial',
  'post-war',
  'motor-age',
  'aviation',
  'contemporary',
  'tomorrow',
  'canopy',
  'skysail',
  'stargazer',
  'moonward',
]);
function obstacle(id) {
  return OBSTACLES.find((entry) => entry.id === id) ?? { present: () => false };
}
export const elementArt = (element) =>
  element.art ?? obstacle(element.obstacle).art ?? '/art/obstacles/survey.svg';

// ---------- Measures ----------
const MAX_COUNT = Number.MAX_SAFE_INTEGER;
const safeCount = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? Math.min(MAX_COUNT, value) : 0;
const sum = (map) => Object.values(map ?? {}).reduce((total, count) => total + safeCount(count), 0);

// The best single completed normal puzzle for the score family. Continuous records
// are stored separately and never count; a missing or nonpositive target never does.
export function bestScoreRun(records, fromLevel = SCORE_FROM_LEVEL, levelCount = LEVEL_COUNT) {
  let best = null;
  for (let id = fromLevel; id <= levelCount; id++) {
    const record = records?.[id];
    const target = getLevelStarTarget(id, null);
    if (!record || !(target > 0) || !Number.isFinite(record.score)) continue;
    const ratio = record.score / target;
    if (!best || ratio > best.ratio) best = { levelId: id, score: record.score, target, ratio };
  }
  return best;
}
// Era progress as one number: two steps per era, the second once it is complete, so
// "reach an era" and "complete an era" compare like every other goal.
export const eraStep = (eraId, complete = false, eras = ERAS) => {
  const index = eras.findIndex((era) => era.id === eraId);
  return index < 0 ? -1 : index * 2 + (complete ? 1 : 0);
};
const townEraStep = (town, eras) =>
  town?.era ? Math.max(0, eraStep(town.era, isEraComplete(town), eras)) : 0;

/**
 * What a rank measures, by kind. `value(state, measure)` is compared with the rank's
 * goal; `evidence` is kept with the earned honour. backend/src/Honours.php implements
 * the same kinds over the server's records, town, powers and counters.
 */
const MEASURES = Object.freeze({
  stars: {
    value: (state) =>
      Object.values(state.records ?? {}).filter((record) => record?.stars === 3).length,
  },
  score: {
    value: (state, measure, content) =>
      bestScoreRun(state.records, measure.fromLevel, content.levelCount)?.ratio ?? 0,
    evidence: (state, measure, content) => {
      const best = bestScoreRun(state.records, measure.fromLevel, content.levelCount);
      return best && { levelId: best.levelId, score: best.score, target: best.target };
    },
  },
  era: { value: (state, measure, content) => townEraStep(state.town, content.eras) },
  landmark: {
    value: (state, measure) => {
      const area = PERSONAL_AREAS.find((area) => area.id === measure.area);
      const slots = state.town?.personalisation?.areas?.[measure.area];
      return Number(!!area && Array.isArray(slots) && area.choices.includes(slots[0]));
    },
  },
  // One counter, or the total of a counter map when no key is named.
  count: {
    value: (state, measure) => {
      const counter = state.honours?.counts?.[measure.counter];
      if (COUNTERS[measure.counter] !== 'map') return safeCount(counter);
      return measure.key ? safeCount(counter?.[measure.key]) : sum(counter);
    },
  },
  // How many of the listed keys of a counter map have been reached at least once.
  distinct: {
    value: (state, measure) =>
      measure.keys.filter((key) => state.honours?.counts?.[measure.counter]?.[key] > 0).length,
  },
  powers: {
    value: (state, measure) =>
      (state.powers ?? []).filter((power) => power?.quantity >= measure.quantity).length,
  },
  // Counted by the server from visits (visitors or travels); the game keeps the highest.
  social: { value: (state, measure) => safeCount(state.honours?.counts?.[measure.counter]) },
});

// ---------- Families ----------
// Every family's ranks from the content. Ranks list `metal`, `goal` and, when they
// differ from the family, `measure`, `name`, `requirement` and `popup`.
export function honourFamilies({
  eras = ERAS,
  gemTypes = GEM_TYPES,
  mineElements = MINE_ELEMENTS,
} = {}) {
  const eraLabel = (id) => eras.find((era) => era.id === id)?.label ?? id;
  const era = (metal, id, complete, name, requirement, popup) => ({
    metal,
    name,
    requirement,
    popup,
    goal: eraStep(id, complete, eras),
    measure: { kind: 'era', era: id, complete },
    params: { era: eraLabel(id) },
  });
  const fusionCount = { kind: 'count', counter: 'fusions' };
  return [
    {
      id: 'stars',
      tab: 'mine',
      name: 'Perfect Prospector',
      art: { glyph: 'stars' },
      link: 'museum-stars',
      measure: { kind: 'stars' },
      progress: '{value} / {goal} three-star puzzles',
      requirement: 'Earn three stars on {goal} puzzles.',
      popup: 'Three stars on {goal} puzzles',
      ranks: [
        { metal: 'bronze', goal: 25, name: 'Rising Star' },
        { metal: 'silver', goal: 150, name: 'Star Collector' },
        { metal: 'gold', goal: 300 },
      ],
    },
    {
      id: 'score',
      tab: 'mine',
      name: 'Score Legend',
      art: { glyph: 'score' },
      link: 'museum-score',
      measure: { kind: 'score', fromLevel: SCORE_FROM_LEVEL },
      progress: 'Best so far {value}×',
      requirement:
        'Complete a puzzle from level {level} onward with {goal}× its star score target.',
      params: { level: SCORE_FROM_LEVEL },
      ranks: [
        {
          metal: 'bronze',
          goal: 1.5,
          name: 'Score Hunter',
          popup: 'One and a half times the star target',
        },
        {
          metal: 'silver',
          goal: 2.5,
          name: 'Score Ace',
          popup: 'Two and a half times the star target',
        },
        { metal: 'gold', goal: 3, popup: 'Three times the star target' },
      ],
    },
    {
      id: 'fusion',
      tab: 'mine',
      name: 'Fusion Virtuoso',
      art: { image: '/art/bonuses/rainbow.svg' },
      measure: fusionCount,
      progress: '{value} / {goal} fusions',
      requirement: 'Perform {goal} bonus fusions in puzzles you complete.',
      popup: '{goal} bonus fusions',
      ranks: [
        {
          metal: 'bronze',
          goal: 1,
          name: 'First Fusion',
          requirement: 'Fuse two bonus gems in a puzzle you complete.',
          popup: 'Two bonuses became one blast',
        },
        {
          metal: 'silver',
          goal: FUSION_MASTER_KEYS.length,
          name: 'Fusion Master',
          measure: { kind: 'distinct', counter: 'fusions', keys: FUSION_MASTER_KEYS },
          requirement: 'Perform {goal} different bonus fusions in puzzles you complete.',
          popup: '{goal} different fusions performed',
          progress: '{value} / {goal} different fusions',
        },
        { metal: 'gold', goal: 300 },
      ],
    },
    ...gemTypes.map((gem) => {
      const [name, requirement, popup] = GEM_TEXT[gem] ?? [
        `${gem[0].toUpperCase()}${gem.slice(1)} Laureate`,
        'Collect {goal} of this gem in completed puzzles.',
        '{goal} collected',
      ];
      return {
        id: `gem-${gem}`,
        tab: 'mine',
        name,
        gem,
        art: { image: `/art/${gem}.svg` },
        measure: { kind: 'count', counter: 'gems', key: gem },
        requirement,
        popup,
        // A gem without calibrated goals is listed with no ranks, so it cannot be earned.
        ranks: (GEM_GOALS[gem] ?? []).map((goal, index) => ({ metal: RANK_METALS[index], goal })),
      };
    }),
    ...mineElements.map((element) => ({
      // Saved IDs are lower case: oreOrders → mine-ore-orders.
      id: `mine-${element.id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      tab: 'mine',
      name: element.name,
      element: element.id,
      art: { image: elementArt(element) },
      link: 'museum-element',
      measure: { kind: 'count', counter: 'mine', key: element.id },
      requirement: element.requirement,
      popup: element.popup,
      ranks: element.goals.map((goal, index) => ({ metal: RANK_METALS[index], goal })),
    })),
    {
      id: 'ages',
      tab: 'town',
      name: 'Through the Ages',
      art: { image: '/art/rewards/era-compass.svg' },
      ranks: [
        era(
          'bronze',
          'river-rail',
          false,
          'Full Steam Ahead',
          'Reach {era}.',
          'A new era begins: {era}',
        ),
        era('silver', 'broadcast', false, 'On the Air', 'Reach {era}.', 'A new era begins: {era}'),
        era(
          'gold',
          'riverlight',
          true,
          'Lantern-lit Hollow',
          'Finish every required building and modernization in {era}.',
          '{era} complete',
        ),
        {
          ...era(
            'diamond',
            'twin-hollows',
            true,
            'Two Towns, One Sky',
            'Finish {era} in the valley and on the Moon.',
            'Two towns, one sky',
          ),
          since: 3,
        },
      ],
    },
    {
      id: 'guardian',
      tab: 'town',
      name: 'Town Guardian',
      art: { image: '/art/rewards/town-bell.svg' },
      measure: { kind: 'count', counter: 'guardian' },
      progress: '{value} / {goal} incidents fully protected',
      requirement: 'Fully protect the town from {goal} incidents, in any era.',
      popup: '{goal} incidents fully protected',
      ranks: [
        { metal: 'bronze', goal: 5, name: 'Watchful Town' },
        { metal: 'silver', goal: 25 },
        { metal: 'gold', goal: 60, name: 'Hollow Sentinel' },
      ],
    },
    {
      id: 'forge',
      tab: 'town',
      name: 'Forge Veteran',
      art: { image: '/art/powers/tnt.svg' },
      link: 'blacksmith',
      measure: { kind: 'count', counter: 'forge' },
      progress: '{value} / {goal} TNT from the forge',
      requirement: 'Collect {goal} TNT from the forge.',
      popup: '{goal} TNT from the forge',
      ranks: [
        { metal: 'bronze', goal: 5, name: 'The Forge Delivers' },
        { metal: 'silver', goal: 100 },
        { metal: 'gold', goal: 250, name: 'Forge Master' },
      ],
    },
    {
      id: 'quartermaster',
      tab: 'town',
      name: 'Master Quartermaster',
      art: { glyph: 'supplies' },
      link: 'supplies',
      measure: { kind: 'powers', quantity: QUARTERMASTER.quantity },
      progress: '{value} / {goal} powers full',
      requirement: 'Hold {goal} different powers at {quantity} each at the same time.',
      popup: '{goal} powers fully stocked',
      params: { quantity: QUARTERMASTER.quantity },
      ranks: [{ metal: 'gold', goal: QUARTERMASTER.powers }],
    },
    {
      id: 'visitors',
      tab: 'friends',
      name: 'Celebrated Town',
      art: { glyph: 'guests' },
      link: 'sharing',
      measure: { kind: 'social', counter: 'visitors' },
      requirement: 'Have {goal} different players visit your shared town.',
      popup: '{goal} different players visited',
      ranks: [
        {
          metal: 'bronze',
          goal: 1,
          name: 'First Guest',
          requirement: 'Have another player visit your shared town.',
          popup: 'Your first visitor came by',
        },
        { metal: 'silver', goal: 5, name: 'Welcoming Host' },
        { metal: 'gold', goal: 15 },
      ],
    },
    {
      id: 'explorer',
      tab: 'friends',
      name: 'Village Explorer',
      art: { glyph: 'travels' },
      link: 'directory',
      measure: { kind: 'social', counter: 'travels' },
      requirement: 'Visit {goal} different players’ villages from this town.',
      popup: '{goal} villages visited',
      ranks: [
        { metal: 'bronze', goal: 5, name: 'Curious Neighbour' },
        { metal: 'silver', goal: 15, name: 'Seasoned Traveller' },
        { metal: 'gold', goal: 30 },
      ],
    },
    {
      id: 'monument',
      tab: 'town',
      name: 'A Lasting Legacy',
      art: { image: '/art/rewards/monument.svg' },
      measure: { kind: 'landmark', area: 'monument' },
      progress: '{value} / {goal} monument built',
      requirement: 'Build your first monument.',
      popup: 'Your first monument stands in the Hollow',
      ranks: [{ metal: 'gold', goal: 1, since: 2 }],
    },
  ];
}

// One rank definition, with the family's defaults. An invalid ladder throws, so a
// broken content change fails its tests instead of shipping an unreachable honour.
function defineRank(family, rank, index, content) {
  const metalIndex = RANK_METALS.indexOf(rank.metal);
  const previous = family.ranks[index - 1];
  if (metalIndex < 0 || (previous && RANK_METALS.indexOf(previous.metal) >= metalIndex))
    throw new Error(`${family.id} lists its ranks out of metal order.`);
  const measure = rank.measure ?? family.measure;
  if (!MEASURES[measure?.kind]) throw new Error(`${family.id} has no known measure.`);
  if (!(rank.goal >= 0) || !Number.isFinite(rank.goal))
    throw new Error(`${family.id}-${rank.metal} needs a finite goal.`);
  const params = { ...family.params, ...rank.params, goal: rank.goal };
  const { value, evidence } = MEASURES[measure.kind];
  return {
    id: `${family.id}-${rank.metal}`,
    family: family.id,
    tab: family.tab,
    rank: index + 1,
    metal: rank.metal,
    difficulty: METAL_DIFFICULTY[rank.metal],
    // The requirement version: raise it when a shipped goal must change (it should not).
    version: rank.version ?? 1,
    // The catch-up generation (HONOURS_VERSION) that added this rank, for the "New
    // rank" marker. A rank added later sets it to the raised HONOURS_VERSION.
    since: rank.since ?? 1,
    name: rank.name ?? family.name,
    requirement: rank.requirement ?? family.requirement,
    popup: rank.popup ?? family.popup,
    progressText: rank.progress ?? family.progress ?? null,
    goal: rank.goal,
    measure,
    art: family.art,
    link: family.link ?? null,
    gem: family.gem,
    element: family.element,
    params: () => params,
    progress: (state) => ({ value: value(state, measure, content), goal: rank.goal }),
    qualifies: (state) =>
      value(state, measure, content) >= rank.goal
        ? (evidence?.(state, measure, content) ?? {})
        : null,
  };
}

/**
 * The catalog: `definitions` (one per rank, in family and ladder order), `byId`,
 * `families` ({ id, tab, name, ranks }) and `familyById`. Tests build catalogs from
 * edited family lists to prove that new ranks and eras extend it safely.
 */
export function buildHonourCatalog(
  families = honourFamilies(),
  content = { eras: ERAS, levelCount: LEVEL_COUNT },
) {
  const built = families.map((family) => {
    if (!HONOUR_TABS.includes(family.tab)) throw new Error(`${family.id} has no known tab.`);
    // Showcases hold family and player distinction IDs side by side.
    if (isPlayerDistinction(family.id))
      throw new Error(`${family.id} uses the player distinction prefix.`);
    return {
      id: family.id,
      tab: family.tab,
      name: family.name,
      ranks: family.ranks.map((rank, index) => defineRank(family, rank, index, content)),
    };
  });
  const definitions = built.flatMap((family) => family.ranks);
  const byId = Object.fromEntries(definitions.map((definition) => [definition.id, definition]));
  if (Object.keys(byId).length !== definitions.length)
    throw new Error('Honour IDs must be unique.');
  return {
    definitions,
    byId,
    families: built,
    familyById: Object.fromEntries(built.map((family) => [family.id, family])),
  };
}
export const HONOURS = buildHonourCatalog();

// ---------- Saved state ----------
// profile.honours = {
//   version, earned: { [id]: { at: ms|null, version, evidence?, seen, announced, backfilled? } },
//   counts: { gems: { [gem]: n }, mine: { [element]: n }, fusions: { [key]: n },
//             forge: n, guardian: n, visitors: n },
//   showcase: [familyId], backfilled: generation, seenGeneration: generation
// }
// `backfilled` is the last catch-up generation run on this save and `seenGeneration`
// the last one whose new ranks the player has looked at in the collection.
// It is presentation and history, not money. The server keeps its own counters from the
// receipts it replays (a first cloud enrollment starts from these counts) and publishes
// only the honours it can prove.
const emptyCounts = () =>
  Object.fromEntries(
    Object.entries(COUNTERS).map(([name, shape]) => [name, shape === 'map' ? {} : 0]),
  );
export const createHonours = () => ({
  version: HONOURS_VERSION,
  earned: {},
  counts: emptyCounts(),
  showcase: [],
  backfilled: 0,
  seenGeneration: HONOURS_VERSION,
});
const KEY = /^[a-zA-Z][\w+-]{0,39}$/;
export const HONOUR_ID = /^[a-z][a-z0-9-]{0,47}$/;
const ID = HONOUR_ID;
const countMap = (value) =>
  Object.fromEntries(
    Object.entries(value && typeof value === 'object' && !Array.isArray(value) ? value : {})
      .filter(([key, count]) => KEY.test(key) && safeCount(count) > 0)
      .map(([key, count]) => [key, safeCount(count)]),
  );
const normalizeCounts = (counts) =>
  Object.fromEntries(
    Object.entries(COUNTERS).map(([name, shape]) => [
      name,
      shape === 'map' ? countMap(counts?.[name]) : safeCount(counts?.[name]),
    ]),
  );
// Two copies of the same counters: the larger of each, never the sum, so retries,
// restores and two tabs cannot double-count.
const maxCounts = (a, b) =>
  Object.fromEntries(
    Object.entries(COUNTERS).map(([name, shape]) => {
      if (shape !== 'map') return [name, Math.max(a[name], b[name])];
      const keys = new Set([...Object.keys(a[name]), ...Object.keys(b[name])]);
      return [
        name,
        Object.fromEntries(
          [...keys].map((key) => [key, Math.max(a[name][key] ?? 0, b[name][key] ?? 0)]),
        ),
      ];
    }),
  );
const generation = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);

function normalizeEarned(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const at = Number.isSafeInteger(entry.at) && entry.at > 0 ? entry.at : null;
  const version = Number.isSafeInteger(entry.version) && entry.version > 0 ? entry.version : 1;
  const evidence =
    entry.evidence && typeof entry.evidence === 'object' && !Array.isArray(entry.evidence)
      ? Object.fromEntries(
          Object.entries(entry.evidence).filter(
            ([key, value]) =>
              /^\w{1,24}$/.test(key) &&
              (Number.isFinite(value) || (typeof value === 'string' && value.length <= 40)),
          ),
        )
      : undefined;
  return {
    at,
    version,
    ...(evidence && Object.keys(evidence).length ? { evidence } : {}),
    seen: entry.seen === true,
    announced: entry.announced === true,
    ...(entry.backfilled === true ? { backfilled: true } : {}),
  };
}
// Unknown honour IDs from a newer version are preserved, not dropped or displayed.
export function normalizeHonours(saved) {
  const honours = createHonours();
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return honours;
  if (Number.isSafeInteger(saved.version) && saved.version > 0) honours.version = saved.version;
  for (const [id, entry] of Object.entries(saved.earned ?? {})) {
    if (!ID.test(id)) continue;
    const earned = normalizeEarned(entry);
    if (earned) honours.earned[id] = earned;
  }
  honours.counts = normalizeCounts(saved.counts);
  honours.showcase = [
    ...new Set(
      (Array.isArray(saved.showcase) ? saved.showcase : []).filter(
        (id) => typeof id === 'string' && ID.test(id),
      ),
    ),
  ].slice(0, SHOWCASE_SLOTS);
  honours.backfilled = generation(saved.backfilled);
  if (saved.seenGeneration !== undefined) honours.seenGeneration = generation(saved.seenGeneration);
  return honours;
}

// Two copies of the same town: earned entries are unioned (permanent, earliest date
// wins) and counts take the larger value. The first copy's showcase wins when it has
// one, including an empty one: clearing the showcase is a choice, not a missing value.
export function mergeHonours(local, incoming) {
  const a = normalizeHonours(local);
  const b = normalizeHonours(incoming);
  const merged = createHonours();
  merged.version = Math.max(a.version, b.version);
  for (const id of new Set([...Object.keys(a.earned), ...Object.keys(b.earned)])) {
    const [x, y] = [a.earned[id], b.earned[id]];
    if (!x || !y) {
      merged.earned[id] = { ...(x ?? y) };
      continue;
    }
    const first = x.at !== null && (y.at === null || x.at <= y.at) ? x : y;
    merged.earned[id] = { ...first, seen: x.seen || y.seen, announced: x.announced || y.announced };
  }
  merged.counts = maxCounts(a.counts, b.counts);
  merged.showcase = Array.isArray(local?.showcase) ? a.showcase : b.showcase;
  merged.backfilled = Math.max(a.backfilled, b.backfilled);
  merged.seenGeneration = Math.max(a.seenGeneration, b.seenGeneration);
  return merged;
}

// A copy of the same town replacing the live one (backup import, cloud pull, restore)
// keeps every earned honour and the larger counts; the incoming showcase wins when saved.
// Returns `profile` itself when the live copy adds nothing.
export function keepHonours(profile, live) {
  if (!live?.honours || !profile || typeof profile !== 'object') return profile;
  const honours = mergeHonours(profile.honours, live.honours);
  return JSON.stringify(honours) === JSON.stringify(normalizeHonours(profile.honours))
    ? profile
    : { ...profile, honours };
}

// ---------- Crediting (pure; the campaign store persists results) ----------
// The run tally lives in the game store and travels with the town handoff. Mine
// elements are added from the level configuration at completion.
export const createRunTally = () => ({ gems: {}, fusions: {} });
// A tally restored from a handoff snapshot; snapshots older than honours have none.
export const normalizeRunTally = (saved) => ({
  gems: countMap(saved?.gems),
  fusions: Object.fromEntries(
    Object.entries(countMap(saved?.fusions)).filter(([key]) => Object.hasOwn(FUSION_STYLES, key)),
  ),
});
const add = (map, key, count = 1) => {
  map[key] = Math.min(MAX_COUNT, (map[key] ?? 0) + count);
};
// Committed resolution steps only: collectedJewels already counts each removed gem once
// and excludes refills, previews, bonuses and relics. Real swap fusions carry a key;
// the free recovery sweep's technical fusion does not, and the sweep is excluded.
export function tallySteps(tally, steps, { recovery = false } = {}) {
  if (recovery || !Array.isArray(steps)) return tally;
  for (const step of steps) {
    for (const jewel of step?.collectedJewels ?? [])
      if (GEM_TYPES.includes(jewel?.type)) add(tally.gems, jewel.type);
    const key = step?.bonusFusion?.key;
    if (key && FUSION_STYLES[key]) add(tally.fusions, key);
  }
  return tally;
}
// The run's claim in its victory receipt, which the server credits to its own counters.
export const runClaim = (tally) => ({
  gems: countMap(tally?.gems),
  fusions: normalizeRunTally(tally).fusions,
});
// Mine elements a completed level consumes, from its authored configuration.
export function levelElements(config, elements = MINE_ELEMENTS) {
  if (!config) return {};
  const tiles = (config.tiles ?? []).filter(Boolean);
  return Object.fromEntries(
    elements
      .map((element) => [
        element.id,
        element.count
          ? element.count(config, tiles)
          : tiles.filter((tile) => obstacle(element.obstacle).present(tile)).length,
      ])
      .filter(([, count]) => count > 0),
  );
}
// Credit one completed normal puzzle (or replay). Called once per settled run.
export function creditRun(honours, { gems = {}, fusions = {}, mine = {} } = {}) {
  const next = normalizeHonours(honours);
  for (const [name, map] of Object.entries({ gems, fusions, mine }))
    for (const [key, count] of Object.entries(countMap(map))) add(next.counts[name], key, count);
  return next;
}
// One forge collection or fully protected incident.
export function creditCounter(honours, counter) {
  const next = normalizeHonours(honours);
  next.counts[counter] = Math.min(MAX_COUNT, next.counts[counter] + 1);
  return next;
}
// The owner's guestbook reports the server's social counts ({ visitors, travels });
// keep the highest of each. Null when nothing grew.
export function recordSocial(honours, reported) {
  const next = normalizeHonours(honours);
  let grew = false;
  for (const counter of ['visitors', 'travels']) {
    const count = safeCount(reported?.[counter]);
    if (count > next.counts[counter]) {
      next.counts[counter] = count;
      grew = true;
    }
  }
  return grew ? next : null;
}
// A finalized incident the town came through completely: protected with no loss. A
// harmless zero-loss raid on an empty purse is not protection.
export const protectedIncident = (event) =>
  !!event && event.outcome === 'protected' && event.loss === 0;

// ---------- Evaluation ----------
// Evaluates every not-yet-earned honour against the saved state and returns a
// normalized copy plus the newly earned IDs. Backfill records an unknown date.
export function evaluateHonours(
  state,
  { at = Date.now(), backfill = false, catalog = HONOURS } = {},
) {
  const honours = normalizeHonours(state.honours);
  const view = { ...state, honours };
  const added = [];
  for (const definition of catalog.definitions) {
    if (honours.earned[definition.id]) continue;
    const evidence = definition.qualifies(view);
    if (!evidence) continue;
    honours.earned[definition.id] = normalizeEarned({
      at: backfill ? null : at,
      version: definition.version,
      evidence,
      backfilled: backfill,
    });
    added.push(definition.id);
  }
  if (backfill) honours.backfilled = HONOURS_VERSION;
  return { honours, added };
}
// Counters a save already proves without its history: a saved forge collection time
// is at least one collection, and a seen, fully protected incident is at least one.
// The server seeds its counters with the same rule (Honours::seed).
export function seedCounts(honours, town) {
  const next = normalizeHonours(honours);
  if (Number.isSafeInteger(town?.lastCollections?.blacksmith))
    next.counts.forge = Math.max(next.counts.forge, 1);
  const incident = town?.events?.[BANDIT_EVENT];
  if (incident?.seen && protectedIncident(incident))
    next.counts.guardian = Math.max(next.counts.guardian, 1);
  return next;
}
// Saves from an older generation earn what their state already proves, with an unknown
// date. Other counts are never inferred: they start when honours arrive.
export function backfillHonours(state, catalog = HONOURS) {
  const current = normalizeHonours(state.honours);
  if (current.backfilled >= HONOURS_VERSION) return current;
  return evaluateHonours(
    { ...state, honours: seedCounts(current, state.town) },
    { backfill: true, catalog },
  ).honours;
}

// ---------- Presentation helpers ----------
// One announcement per family (the highest new rank).
export function pendingAnnouncements(honours, catalog = HONOURS) {
  const saved = normalizeHonours(honours);
  const byFamily = new Map();
  for (const [id, entry] of Object.entries(saved.earned)) {
    const definition = catalog.byId[id];
    if (!definition || entry.announced) continue;
    const current = byFamily.get(definition.family);
    if (!current || definition.rank > current.definition.rank)
      byFamily.set(definition.family, { id, definition, entry });
  }
  return [...byFamily.values()];
}
function familyView(family, state, honours) {
  const earned = family.ranks.filter((definition) => honours.earned[definition.id]);
  const top = earned.at(-1) ?? null;
  const next =
    family.ranks.slice(top?.rank ?? 0).find((definition) => !honours.earned[definition.id]) ?? null;
  return {
    id: family.id,
    tab: family.tab,
    definition: top ?? next,
    earned: top ? { id: top.id, ...honours.earned[top.id] } : null,
    ranks: family.ranks.map((definition) => ({
      definition,
      earned: honours.earned[definition.id] ?? null,
    })),
    next: next && { definition: next, progress: next.progress({ ...state, honours }) },
    fresh: earned.some((definition) => !honours.earned[definition.id].seen),
    // A rank added by a later update that the player has not looked at yet.
    newRank: family.ranks.some(
      (definition) => !honours.earned[definition.id] && definition.since > honours.seenGeneration,
    ),
    showcased: honours.showcase.includes(family.id),
  };
}
// Collection tabs: earned families first, then goals still to reach, in catalog order.
export function honourCollection(state, catalog = HONOURS) {
  const honours = normalizeHonours(state.honours);
  return HONOUR_TABS.map((tab) => {
    const families = catalog.families
      .filter((family) => family.tab === tab)
      .map((family) => familyView(family, state, honours));
    return {
      id: tab,
      families: [
        ...families.filter((family) => family.earned),
        ...families.filter((family) => !family.earned),
      ],
      earned: families.filter((family) => family.earned).length,
      total: families.length,
      fresh: families.filter((family) => family.fresh || family.newRank).length,
    };
  });
}
// Showcase slots hold earned families, so a later rank upgrades the same slot, and at
// most one player distinction the player received (`received`, keyed by ID: see
// src/data/playerDistinctions.js).
export function validShowcase(ids, honours, { catalog = HONOURS, received = {} } = {}) {
  const saved = normalizeHonours(honours);
  let distinction = false;
  return [...new Set(ids)]
    .filter((id) => {
      if (isPlayerDistinction(id)) {
        if (distinction || !Object.hasOwn(received, id)) return false;
        return (distinction = true);
      }
      return catalog.familyById[id]?.ranks.some((definition) => saved.earned[definition.id]);
    })
    .slice(0, SHOWCASE_SLOTS);
}
// The only honours data a visitor receives: earned IDs, dates, the public part of the
// score evidence and the showcase order. Never counts, progress or the private save.
export function publicHonours(honours, catalog = HONOURS) {
  const saved = normalizeHonours(honours);
  const earned = {};
  for (const [id, entry] of Object.entries(saved.earned)) {
    const definition = catalog.byId[id];
    if (!definition) continue;
    earned[id] = { at: entry.at };
    if (definition.measure.kind === 'score' && entry.evidence?.levelId)
      earned[id].evidence = {
        levelId: entry.evidence.levelId,
        score: entry.evidence.score,
        target: entry.evidence.target,
      };
  }
  return {
    version: HONOURS_VERSION,
    earned,
    showcase: validShowcase(saved.showcase, saved, { catalog }),
  };
}
