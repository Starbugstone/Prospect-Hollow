// Town Honours (issue #60): one registry for achievements, mine mastery and era
// defence medals. Goals derive from the shared content definitions, so adding a
// gem, era, level or mine element changes them here (see AGENTS.md). Earned
// honours are permanent: they keep the requirement version they were earned
// under and are never removed by a later goal, spending or an era change.
import { GEM_TYPES } from '../game/engine/GemFactory';
import { FUSION_STYLES } from '../game/engine/BonusFusion';
import { isEraComplete } from '../game/town/TownEras';
import { LEVEL_COUNT, POWERS } from './campaign';
import { campaignCompletion } from './campaignCompletion';
import { ERAS } from './eras';
import { OBSTACLES } from './obstacles';
import { bonusCapacity } from './rewards';
import { getLevelStarTarget } from './starRating';
import { BANDIT_EVENT, BUILDING_BY_ID } from './town';
import { eraEventKind, eventKind } from './townEvents';

const HONOURS_VERSION = 1;
const HONOUR_CATEGORIES = Object.freeze(['achievement', 'mine', 'defence']);
export const SHOWCASE_SLOTS = 3;

// Calibrated in docs/honours.md. Opening star targets are deliberately low, so
// score ranks only count from the first level calibrated at the 35th percentile.
export const SCORE_FROM_LEVEL = 37;
const SCORE_RANKS = Object.freeze([
  {
    id: 'score-ace',
    name: 'Score Ace',
    multiple: 2,
    difficulty: 'medium',
    popup: 'Twice the star target',
  },
  {
    id: 'score-legend',
    name: 'Score Legend',
    multiple: 3,
    difficulty: 'hard',
    popup: 'Three times the star target',
  },
]);
// Lifetime gems collected in completed puzzles, set by palette availability.
export const GEM_GOALS = Object.freeze({
  ruby: 12000,
  sapphire: 12000,
  emerald: 12000,
  topaz: 8000,
  amethyst: 8000,
  moonstone: 8000,
});
const GEM_NAMES = Object.freeze({
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
export const FORGE_VETERAN_GOAL = 50;

// Signature mine elements. Completing a puzzle consumes every one of them (they are
// objective layers, relics or ore orders), so a completed level credits its authored
// count. Goals are about 1.5× one campaign, so replays finish them.
export const MINE_ELEMENTS = Object.freeze([
  {
    id: 'relics',
    honour: 'relic-keeper',
    name: 'Relic Keeper',
    goal: 360,
    obstacle: 'relic',
    art: '/art/relic.svg',
    label: 'Relics',
    requirement: 'Deliver {goal} relics in completed puzzles.',
    popup: '{goal} relics delivered',
    count: (config) => (config.board ?? []).filter((gem) => gem?.type === 'relic').length,
  },
  {
    id: 'lanterns',
    honour: 'lamplighter',
    name: 'Lamplighter',
    goal: 125,
    obstacle: 'lantern',
    label: 'Lanterns',
    requirement: 'Light {goal} lanterns in completed puzzles.',
    popup: '{goal} lanterns lit',
  },
  {
    id: 'surveys',
    honour: 'trail-surveyor',
    name: 'Trail Surveyor',
    goal: 60,
    obstacle: 'survey',
    label: 'Survey trails',
    requirement: 'Complete {goal} survey trails.',
    popup: '{goal} survey trails completed',
    // One numbered trail per level, however many markers it has.
    count: (config, tiles) => Number(tiles.some((tile) => obstacle('survey').present(tile))),
  },
  {
    id: 'oreOrders',
    honour: 'ore-merchant',
    name: 'Ore Merchant',
    goal: 110,
    obstacle: 'ore-orders',
    label: 'Ore orders',
    requirement: 'Fill {goal} ore orders.',
    popup: '{goal} ore orders filled',
    count: (config) => (config.oreOrders ?? []).length,
  },
  {
    id: 'cores',
    honour: 'core-engineer',
    name: 'Core Engineer',
    goal: 125,
    obstacle: 'charge-core',
    label: 'Charge cores',
    requirement: 'Release {goal} charge cores.',
    popup: '{goal} charge cores released',
  },
  {
    id: 'gates',
    honour: 'gate-breaker',
    name: 'Gate Breaker',
    goal: 130,
    obstacle: 'blast-gate',
    label: 'Blast gates',
    requirement: 'Break {goal} blast gates.',
    popup: '{goal} blast gates broken',
  },
]);
// Every other mine element is deliberately not a mastery goal: common obstacles, or
// too few levels. A new obstacle must be added to MINE_ELEMENTS or this list.
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
function obstacle(id) {
  return OBSTACLES.find((entry) => entry.id === id) ?? { present: () => false };
}
const elementArt = (element) =>
  element.art ?? obstacle(element.obstacle).art ?? '/art/obstacles/survey.svg';

export const MEDAL_NAMES = Object.freeze({
  frontier: 'Frontier Guardian',
  'river-rail': 'Keeper of the Cargo',
  industrial: 'Workshop Sentinel',
  'post-war': 'Rebuilding Guardian',
  'motor-age': 'Roadside Responder',
  aviation: 'Horizon Guardian',
  broadcast: 'City Sentinel',
  contemporary: 'River Defender',
  tomorrow: "Tomorrow's Shield",
  canopy: 'Canopy Protector',
  riverlight: 'Lantern Guardian',
});
export const INCIDENT_NAMES = Object.freeze({
  bandits: 'bandit raid',
  'cargo-theft': 'cargo theft',
  'workshop-fire': 'workshop fire',
  'storm-cleanup': 'river storm',
});

const MAX_COUNT = Number.MAX_SAFE_INTEGER;
const safeCount = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? Math.min(MAX_COUNT, value) : 0;
const quantity = (state, id) => state.powers?.find?.((power) => power.id === id)?.quantity ?? 0;
const finalEra = (eras) => eras.filter((era) => era.enabled).at(-1);

// Highest-capacity storage, from the armory and garage definitions rather than a
// copied number (26 today).
export function maxPowerCapacity(buildings = BUILDING_BY_ID) {
  const levels = Object.fromEntries(
    ['armory', 'garage'].map((id) => [id, buildings[id]?.upgrades.length ?? 0]),
  );
  return { capacity: bonusCapacity({ buildings: levels }), levels };
}

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

/**
 * Builds the honour definitions from content. Each definition:
 * { id, family, category, difficulty, rank, version, name, requirement, popup,
 *   params(state), progress(state) -> { value, goal } | null,
 *   qualifies(state) -> evidence object | null (state-derived honours only),
 *   art: { frame, image?, glyph?, ribbon? }, link? }
 * Medals and fusions are awarded by events and counts, through the same evaluator.
 */
export function createHonourCatalog({
  eras = ERAS,
  gemTypes = GEM_TYPES,
  fusionKeys = Object.keys(FUSION_STYLES),
  powers = POWERS,
  levelCount = LEVEL_COUNT,
  buildings = BUILDING_BY_ID,
  mineElements = MINE_ELEMENTS,
} = {}) {
  const storage = maxPowerCapacity(buildings);
  const last = finalEra(eras);
  const definitions = [
    {
      id: 'first-perfect',
      category: 'achievement',
      difficulty: 'easy',
      name: 'First Perfect',
      requirement: 'Earn three stars on any puzzle.',
      popup: 'Three stars, first time',
      art: { frame: 'easy', glyph: 'stars' },
      qualifies: (state) => {
        for (let id = 1; id <= levelCount; id++)
          if (state.records?.[id]?.stars === 3) return { levelId: id };
        return null;
      },
    },
    {
      id: 'first-fusion',
      category: 'achievement',
      difficulty: 'easy',
      name: 'First Fusion',
      requirement: 'Fuse two bonus gems in a puzzle you complete.',
      popup: 'Two bonuses became one blast',
      art: { frame: 'easy', image: '/art/bonuses/bomb.svg', second: '/art/bonuses/cross.svg' },
      qualifies: (state) => (state.honours?.fusions?.length ? {} : null),
    },
    {
      id: 'forge-delivers',
      category: 'achievement',
      difficulty: 'easy',
      name: 'The Forge Delivers',
      requirement: 'Collect your first TNT from the blacksmith’s forge.',
      popup: 'Fresh from the forge',
      art: { frame: 'easy', image: '/art/powers/tnt.svg' },
      link: 'blacksmith',
      qualifies: (state) => (state.honours?.counts?.forge >= 1 ? {} : null),
    },
    ...SCORE_RANKS.map((rank, index) => ({
      id: rank.id,
      family: 'score',
      rank: index + 1,
      category: 'achievement',
      difficulty: rank.difficulty,
      name: rank.name,
      requirement:
        'Complete a puzzle from level {level} onward with {multiple}× its star score target.',
      popup: rank.popup,
      params: () => ({ level: SCORE_FROM_LEVEL, multiple: rank.multiple }),
      art: { frame: rank.difficulty, glyph: 'score', ribbon: `${rank.multiple}×` },
      link: 'museum-score',
      progress: (state) => {
        const best = bestScoreRun(state.records, SCORE_FROM_LEVEL, levelCount);
        return { value: best ? Math.floor(best.ratio * 10) / 10 : 0, goal: rank.multiple };
      },
      qualifies: (state) => {
        const best = bestScoreRun(state.records, SCORE_FROM_LEVEL, levelCount);
        return best && best.ratio >= rank.multiple
          ? { levelId: best.levelId, score: best.score, target: best.target }
          : null;
      },
    })),
    {
      id: 'fusion-master',
      category: 'achievement',
      difficulty: 'medium',
      name: 'Fusion Master',
      requirement: 'Perform all {count} bonus fusions in puzzles you complete.',
      popup: 'Every fusion performed',
      params: () => ({ count: fusionKeys.length }),
      art: { frame: 'medium', image: '/art/bonuses/rainbow.svg' },
      progress: (state) => ({
        value: fusionKeys.filter((key) => state.honours?.fusions?.includes(key)).length,
        goal: fusionKeys.length,
      }),
      qualifies: (state) =>
        fusionKeys.length && fusionKeys.every((key) => state.honours?.fusions?.includes(key))
          ? {}
          : null,
    },
    {
      id: 'forge-veteran',
      category: 'achievement',
      difficulty: 'medium',
      name: 'Forge Veteran',
      requirement: 'Collect {goal} TNT from the forge.',
      popup: '{goal} TNT from the forge',
      params: () => ({ goal: FORGE_VETERAN_GOAL }),
      art: { frame: 'medium', image: '/art/powers/tnt.svg' },
      link: 'blacksmith',
      progress: (state) => ({
        value: safeCount(state.honours?.counts?.forge),
        goal: FORGE_VETERAN_GOAL,
      }),
      qualifies: (state) =>
        safeCount(state.honours?.counts?.forge) >= FORGE_VETERAN_GOAL ? {} : null,
    },
    ...gemTypes.map((gem) => {
      const [name, requirement, popup] = GEM_NAMES[gem] ?? [
        `${gem[0].toUpperCase()}${gem.slice(1)} Laureate`,
        'Collect {goal} of this gem in completed puzzles.',
        '{goal} collected',
      ];
      const goal = GEM_GOALS[gem] ?? 0;
      return {
        id: `laureate-${gem}`,
        category: 'achievement',
        difficulty: 'medium',
        name,
        requirement,
        popup,
        gem,
        params: () => ({ goal }),
        art: { frame: 'medium', image: `/art/${gem}.svg` },
        progress: (state) => ({ value: safeCount(state.honours?.counts?.gems?.[gem]), goal }),
        // A gem without a calibrated goal is listed but cannot be earned at zero.
        qualifies: (state) =>
          goal > 0 && safeCount(state.honours?.counts?.gems?.[gem]) >= goal ? {} : null,
      };
    }),
    {
      id: 'master-quartermaster',
      category: 'achievement',
      difficulty: 'hard',
      name: 'Master Quartermaster',
      requirement:
        'With the armory and garage fully upgraded, hold all {count} powers at full storage ({capacity} each) at the same time.',
      popup: 'Every supply fully stocked',
      params: () => ({ count: powers.length, capacity: storage.capacity }),
      art: { frame: 'hard', glyph: 'supplies' },
      link: 'supplies',
      progress: (state) => ({
        value: powers.filter((power) => quantity(state, power.id) >= storage.capacity).length,
        goal: powers.length,
      }),
      qualifies: (state) =>
        storage.capacity > 0 &&
        Object.entries(storage.levels).every(
          ([id, level]) => (state.town?.buildings?.[id] ?? 0) >= level,
        ) &&
        powers.every((power) => quantity(state, power.id) >= storage.capacity)
          ? { capacity: storage.capacity }
          : null,
    },
    {
      id: 'perfect-prospector',
      category: 'achievement',
      difficulty: 'hard',
      name: 'Perfect Prospector',
      requirement: 'Earn three stars on all {levels} puzzles.',
      popup: 'Three stars on every puzzle',
      params: () => ({ levels: levelCount }),
      requirementVersion: { levels: levelCount },
      art: { frame: 'hard', glyph: 'prospector' },
      link: 'museum-stars',
      progress: (state) => {
        let stars = 0;
        for (let id = 1; id <= levelCount; id++)
          stars += Math.min(3, Math.max(0, state.records?.[id]?.stars ?? 0));
        return { value: stars, goal: levelCount * 3 };
      },
      // Evaluated on every save: the last level rules most campaigns out at once.
      qualifies: (state) =>
        state.records?.[levelCount]?.stars === 3 &&
        campaignCompletion(state.records, levelCount).complete
          ? { levels: levelCount }
          : null,
    },
    {
      id: 'town-complete',
      category: 'achievement',
      difficulty: 'hard',
      name: 'Prospect Hollow Complete',
      requirement: 'Finish every required building and modernization through the {era}.',
      popup: 'Every era built and modernized',
      params: () => ({ era: last?.label ?? '' }),
      requirementVersion: { era: last?.id ?? null },
      art: { frame: 'hard', image: '/art/rewards/era-compass.svg' },
      progress: (state) => ({
        value:
          Math.max(
            0,
            eras.findIndex((era) => era.id === state.town?.era),
          ) + 1,
        goal: eras.filter((era) => era.enabled).length,
      }),
      qualifies: (state) =>
        last && state.town?.era === last.id && isEraComplete(state.town) ? { era: last.id } : null,
    },
    ...mineElements.map((element) => ({
      id: element.honour,
      category: 'mine',
      difficulty: 'medium',
      name: element.name,
      requirement: element.requirement,
      popup: element.popup,
      element: element.id,
      params: () => ({ goal: element.goal }),
      art: { frame: 'medium', image: elementArt(element) },
      link: 'museum-element',
      progress: (state) => ({
        value: safeCount(state.honours?.counts?.mine?.[element.id]),
        goal: element.goal,
      }),
      qualifies: (state) =>
        safeCount(state.honours?.counts?.mine?.[element.id]) >= element.goal ? {} : null,
    })),
    // Quiet medals: awarded by markRaidSeen, never re-derived from current buildings.
    ...eras
      .filter((era) => era.enabled)
      .map((era) => {
        const incident = eraEventKind(era.id);
        return {
          id: `defence-${era.id}`,
          category: 'defence',
          difficulty: 'medium',
          quiet: true,
          era: era.id,
          incident,
          name: MEDAL_NAMES[era.id] ?? `${era.label} Guardian`,
          requirement: 'Fully protect the town from a {incident} during the {era}.',
          popup: '',
          params: () => ({ incident: INCIDENT_NAMES[incident] ?? incident, era: era.label }),
          art: { frame: 'medal', image: '/art/rewards/town-bell.svg' },
        };
      }),
  ].map((definition) => ({
    family: definition.id,
    rank: 1,
    version: HONOURS_VERSION,
    params: () => ({}),
    progress: () => null,
    qualifies: () => null,
    ...definition,
  }));
  const families = [];
  for (const definition of definitions) {
    let family = families.find((entry) => entry.id === definition.family);
    if (!family) {
      family = { id: definition.family, category: definition.category, ranks: [] };
      families.push(family);
    }
    family.ranks.push(definition);
  }
  return {
    definitions,
    byId: Object.fromEntries(definitions.map((definition) => [definition.id, definition])),
    families,
    familyById: Object.fromEntries(families.map((family) => [family.id, family])),
    fusionKeys,
    gemTypes,
    mineElements,
  };
}
export const HONOURS = createHonourCatalog();

// ---------- Saved state ----------
// profile.honours = {
//   version, earned: { [id]: { at: ms|null, version, evidence?, seen, announced, backfilled? } },
//   counts: { gems: { [gem]: n }, forge: n, mine: { [element]: n } },
//   fusions: [key], showcase: [familyId], backfilled: version
// }
// It is presentation and history, not money: integrity replay ignores it, the server
// merges earned entries and publishes only the public projection below.
export const createHonours = () => ({
  version: HONOURS_VERSION,
  earned: {},
  counts: { gems: {}, forge: 0, mine: {} },
  fusions: [],
  showcase: [],
  backfilled: 0,
});
const countMap = (value) =>
  Object.fromEntries(
    Object.entries(value && typeof value === 'object' && !Array.isArray(value) ? value : {})
      .filter(([key, count]) => /^[a-zA-Z][\w-]{0,39}$/.test(key) && safeCount(count) > 0)
      .map(([key, count]) => [key, safeCount(count)]),
  );
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
    if (!/^[a-z][a-z0-9-]{0,47}$/.test(id)) continue;
    const earned = normalizeEarned(entry);
    if (earned) honours.earned[id] = earned;
  }
  honours.counts = {
    gems: countMap(saved.counts?.gems),
    forge: safeCount(saved.counts?.forge),
    mine: countMap(saved.counts?.mine),
  };
  honours.fusions = [
    ...new Set(
      (Array.isArray(saved.fusions) ? saved.fusions : []).filter(
        (key) => typeof key === 'string' && /^[a-z]+\+[a-z]+$/.test(key),
      ),
    ),
  ];
  honours.showcase = [
    ...new Set(
      (Array.isArray(saved.showcase) ? saved.showcase : []).filter(
        (id) => typeof id === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(id),
      ),
    ),
  ].slice(0, SHOWCASE_SLOTS);
  if (Number.isSafeInteger(saved.backfilled) && saved.backfilled >= 0)
    honours.backfilled = saved.backfilled;
  return honours;
}

// Two copies of the same town: earned entries are unioned (permanent), lifetime counts
// take the larger value, never a sum, so retries and restores cannot double-count.
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
    merged.earned[id] = {
      ...first,
      seen: x.seen || y.seen,
      announced: x.announced || y.announced,
    };
  }
  const maxMap = (p, q) =>
    Object.fromEntries(
      [...new Set([...Object.keys(p), ...Object.keys(q)])].map((key) => [
        key,
        Math.max(p[key] ?? 0, q[key] ?? 0),
      ]),
    );
  merged.counts = {
    gems: maxMap(a.counts.gems, b.counts.gems),
    forge: Math.max(a.counts.forge, b.counts.forge),
    mine: maxMap(a.counts.mine, b.counts.mine),
  };
  merged.fusions = [...new Set([...a.fusions, ...b.fusions])];
  merged.showcase = a.showcase.length ? a.showcase : b.showcase;
  merged.backfilled = Math.max(a.backfilled, b.backfilled);
  return merged;
}

// A copy of the same town replacing the live one (backup import, cloud pull, restore)
// keeps every earned honour and the larger counts; the incoming showcase wins when set.
// Returns `profile` itself when the live copy adds nothing.
export function keepHonours(profile, live) {
  if (!live?.honours || !profile || typeof profile !== 'object') return profile;
  const honours = mergeHonours(profile.honours, live.honours);
  return JSON.stringify(honours) === JSON.stringify(normalizeHonours(profile.honours))
    ? profile
    : { ...profile, honours };
}

// ---------- Crediting and evaluation (pure; the campaign store persists results) ----------
// The run tally lives in the game store and travels with the town handoff. Mine
// elements are added from the level configuration at completion.
export const createRunTally = () => ({ gems: {}, fusions: [], mine: {} });
// A tally restored from a handoff snapshot; snapshots older than honours have none.
export const normalizeRunTally = (saved) => ({
  gems: countMap(saved?.gems),
  fusions: [
    ...new Set(
      (Array.isArray(saved?.fusions) ? saved.fusions : []).filter((key) =>
        Object.hasOwn(FUSION_STYLES, key),
      ),
    ),
  ],
  mine: {},
});
// Committed resolution steps only: collectedJewels already counts each removed gem once
// and excludes refills, previews, bonuses and relics. Real swap fusions carry a key;
// the free recovery sweep's technical fusion does not, and the sweep is excluded.
export function tallySteps(tally, steps, { recovery = false } = {}) {
  if (recovery || !Array.isArray(steps)) return tally;
  for (const step of steps) {
    for (const jewel of step?.collectedJewels ?? [])
      if (GEM_TYPES.includes(jewel?.type))
        tally.gems[jewel.type] = Math.min(MAX_COUNT, (tally.gems[jewel.type] ?? 0) + 1);
    const key = step?.bonusFusion?.key;
    if (key && FUSION_STYLES[key] && !tally.fusions.includes(key)) tally.fusions.push(key);
  }
  return tally;
}
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
export function creditRun(honours, { gems = {}, fusions = [], mine = {} } = {}) {
  const next = normalizeHonours(honours);
  for (const [gem, count] of Object.entries(countMap(gems)))
    next.counts.gems[gem] = Math.min(MAX_COUNT, (next.counts.gems[gem] ?? 0) + count);
  for (const [element, count] of Object.entries(countMap(mine)))
    next.counts.mine[element] = Math.min(MAX_COUNT, (next.counts.mine[element] ?? 0) + count);
  next.fusions = [...new Set([...next.fusions, ...fusions.filter((key) => FUSION_STYLES[key])])];
  return next;
}
export function creditForge(honours) {
  const next = normalizeHonours(honours);
  next.counts.forge = Math.min(MAX_COUNT, next.counts.forge + 1);
  return next;
}
// The medal for a finalized incident: protected with no loss, attributed to the era
// it happened in. The era gate keeps an unseen incident from crossing an era change.
export function defenceMedal(event, era, catalog = HONOURS) {
  if (!event || event.outcome !== 'protected' || event.loss !== 0) return null;
  const definition = catalog.byId[`defence-${era}`];
  return definition && definition.incident === eventKind(event) ? definition.id : null;
}
// Legacy backfill: only the single stored receipt, and only when its kind belongs to
// exactly one era. Ambiguous history stays "No recorded defence".
export function backfillDefenceMedal(event, catalog = HONOURS) {
  if (!event?.seen || event.outcome !== 'protected' || event.loss !== 0) return null;
  const medals = catalog.definitions.filter(
    (definition) => definition.category === 'defence' && definition.incident === eventKind(event),
  );
  return medals.length === 1 ? medals[0].id : null;
}
export function awardHonour(honours, id, { at = null, evidence, backfilled = false } = {}) {
  const next = normalizeHonours(honours);
  if (next.earned[id]) return next;
  next.earned[id] = normalizeEarned({ at, version: HONOURS_VERSION, evidence, backfilled });
  return next;
}
// Evaluates every not-yet-earned, non-quiet honour against the saved state and returns
// a normalized copy plus the newly earned IDs. Backfill records an unknown date.
export function evaluateHonours(
  state,
  { at = Date.now(), backfill = false, catalog = HONOURS } = {},
) {
  const honours = normalizeHonours(state.honours);
  const view = { ...state, honours };
  const added = [];
  for (const definition of catalog.definitions) {
    if (definition.quiet || honours.earned[definition.id]) continue;
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
// Saves from before this honours version earn what their state already proves, with
// an unknown date, plus the one attributable defence medal. Counts are never inferred.
export function backfillHonours(state, catalog = HONOURS) {
  const current = normalizeHonours(state.honours);
  if (current.backfilled >= HONOURS_VERSION) return current;
  const { honours } = evaluateHonours({ ...state, honours: current }, { backfill: true, catalog });
  const medal = backfillDefenceMedal(state.town?.events?.[BANDIT_EVENT], catalog);
  return medal ? awardHonour(honours, medal, { backfilled: true }) : honours;
}

// ---------- Presentation helpers ----------
// One announcement per family (the highest new rank), quiet honours excluded.
export function pendingAnnouncements(honours, catalog = HONOURS) {
  const saved = normalizeHonours(honours);
  const byFamily = new Map();
  for (const [id, entry] of Object.entries(saved.earned)) {
    const definition = catalog.byId[id];
    if (!definition || definition.quiet || entry.announced) continue;
    const current = byFamily.get(definition.family);
    if (!current || definition.rank > current.definition.rank)
      byFamily.set(definition.family, { id, definition, entry });
  }
  return [...byFamily.values()];
}
function familyView(family, state, catalog = HONOURS) {
  const honours = normalizeHonours(state.honours);
  const earned = family.ranks.filter((definition) => honours.earned[definition.id]);
  const top = earned.at(-1) ?? null;
  const next = family.ranks.find((definition) => !honours.earned[definition.id]) ?? null;
  const shown = top ?? next;
  let status = top ? 'earned' : 'progress';
  if (family.category === 'defence' && !top) {
    const index = (id) => ERAS.findIndex((era) => era.id === id);
    const era = index(shown.era),
      current = index(state.town?.era);
    status = era > current ? 'future' : era === current ? 'current' : 'none';
  }
  return {
    id: family.id,
    category: family.category,
    definition: shown,
    earned: top ? { id: top.id, ...honours.earned[top.id] } : null,
    ranks: family.ranks.map((definition) => ({
      definition,
      earned: honours.earned[definition.id] ?? null,
    })),
    next: next && { definition: next, progress: next.progress({ ...state, honours }) },
    status,
    fresh: earned.some((definition) => !honours.earned[definition.id].seen),
    showcased: honours.showcase.includes(family.id),
  };
}
// Collection tabs: earned families first, then goals still to reach, in catalog order.
export function honourCollection(state, catalog = HONOURS) {
  return HONOUR_CATEGORIES.map((category) => {
    const families = catalog.families
      .filter((family) => family.category === category)
      .map((family) => familyView(family, state, catalog));
    const ordered = [
      ...families.filter((family) => family.earned),
      ...families.filter((family) => !family.earned),
    ];
    return {
      id: category,
      families: ordered,
      earned: families.filter((family) => family.earned).length,
      total: families.length,
      fresh: families.filter((family) => family.fresh).length,
    };
  });
}
// Showcase slots hold earned families only; a later rank upgrades the same slot.
export function validShowcase(ids, honours, catalog = HONOURS) {
  const saved = normalizeHonours(honours);
  return [...new Set(ids)]
    .filter((id) => catalog.familyById[id]?.ranks.some((definition) => saved.earned[definition.id]))
    .slice(0, SHOWCASE_SLOTS);
}
// The only honours data a visitor receives: earned IDs, dates, the public part of the
// score evidence and the showcase order. Never counts, progress or the private save.
export function publicHonours(honours, catalog = HONOURS) {
  const saved = normalizeHonours(honours);
  const earned = {};
  for (const [id, entry] of Object.entries(saved.earned)) {
    if (!catalog.byId[id]) continue;
    earned[id] = { at: entry.at };
    if (catalog.byId[id].family === 'score' && entry.evidence?.levelId)
      earned[id].evidence = {
        levelId: entry.evidence.levelId,
        score: entry.evidence.score,
        target: entry.evidence.target,
      };
  }
  return {
    version: HONOURS_VERSION,
    earned,
    showcase: validShowcase(saved.showcase, saved, catalog),
  };
}
