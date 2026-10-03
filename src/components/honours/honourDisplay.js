// Display models for Town Honours: the collection, details, showcase and the visitor
// gallery share these, so every view words requirements, progress and dates alike.
// Presentation only; nothing here changes the saved honours.
import { t, number, locale } from '../../i18n';
import { ERA_BY_ID } from '../../data/eras';
import { POWERS } from '../../data/campaign';
import { BUILDING_BY_ID } from '../../data/town';
import { HONOURS, MINE_ELEMENTS, SHOWCASE_SLOTS, maxPowerCapacity } from '../../data/honours';
import { elementLevels } from '../../data/honourLevels';

// Difficulty is named and shaped (round, hexagon, rosette), never shown by colour alone.
const DIFFICULTIES = { easy: 'Easy', medium: 'Medium', hard: 'Very hard' };
export const CATEGORY_LABELS = {
  achievement: 'Achievements',
  mine: 'Mine mastery',
  defence: 'Era defence',
};
const BONUS_NAMES = { bomb: 'Bomb', cross: 'Cross', rainbow: 'Rainbow' };
// Where an unfinished honour advances. Museum links open the filtered museum.
const LINKS = {
  blacksmith: { label: 'Blacksmith details', building: 'blacksmith' },
  supplies: { label: 'Open supplies', building: 'armory' },
  'museum-score': { label: 'Show score levels in the museum', museum: true },
  'museum-stars': { label: 'Show levels below three stars', museum: true },
  'museum-element': { label: 'Show these levels in the museum', museum: true },
};
const COUNTERS = {
  'fusion-master': '{value} / {goal} fusions',
  'perfect-prospector': '{value} / {goal} stars',
  'master-quartermaster': '{value} / {goal} powers full',
};

// Nested English names (eras, incidents) are translated and numbers localized.
const honourParams = (definition) =>
  Object.fromEntries(
    Object.entries(definition.params()).map(([key, value]) => [
      key,
      typeof value === 'number' ? number(value) : t(value),
    ]),
  );
export const requirementText = (definition) => t(definition.requirement, honourParams(definition));
export const difficultyLabel = (definition) =>
  t(DIFFICULTIES[definition.difficulty] ?? DIFFICULTIES.medium);
const formatDate = (at) => new Date(at).toLocaleDateString(locale.value, { dateStyle: 'medium' });
export const earnedText = (entry) =>
  entry.at
    ? t('Earned {date}', { date: formatDate(entry.at) })
    : t('Earned before honours were introduced');
export const evidenceText = (evidence) =>
  evidence?.levelId
    ? t('{score} on level {level} (target {target})', {
        score: number(evidence.score),
        level: evidence.levelId,
        target: number(evidence.target),
      })
    : '';

// The highest earned rank of a family, or null. Showcase slots hold family IDs, so a
// later rank upgrades the same slot.
function topEarned(familyId, earned, catalog = HONOURS) {
  const definition = catalog.familyById[familyId]?.ranks.filter((rank) => earned[rank.id]).at(-1);
  return definition ? { familyId, definition, entry: earned[definition.id] } : null;
}
export const earnedFamilies = (earned, catalog = HONOURS) =>
  catalog.families.map((family) => topEarned(family.id, earned, catalog)).filter(Boolean);
export const showcaseSlots = (ids, earned) =>
  Array.from({ length: SHOWCASE_SLOTS }, (_, index) =>
    ids[index] ? topEarned(ids[index], earned) : null,
  );
// Moves one showcase entry; the order is what visitors see.
export function moveSlot(ids, index, offset) {
  const target = index + offset;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// Earned and fresh families for menus and summaries, without computing progress.
export function honourSummary(honours, catalog = HONOURS) {
  const earned = honours?.earned ?? {};
  const families = earnedFamilies(earned, catalog);
  return {
    earned: families.length,
    total: catalog.families.length,
    fresh: catalog.definitions.filter((definition) => earned[definition.id]?.seen === false).length,
  };
}
// Earned honour IDs of a tab that the player has not seen yet.
export const unseenIds = (tab) =>
  tab.families.flatMap((family) =>
    family.ranks
      .filter((rank) => rank.earned && !rank.earned.seen)
      .map((rank) => rank.definition.id),
  );

function progressText(definition, { value, goal }, state) {
  const values = { value: number(value), goal: number(goal) };
  // Score ranks compare a ratio; every other ranked family counts toward its goal.
  if (definition.family === 'score') return t('Best so far {ratio}×', { ratio: number(value) });
  if (definition.id === 'town-complete')
    return t('Era {value} of {goal} · {era}', {
      ...values,
      era: t(ERA_BY_ID[state.town?.era]?.label ?? ''),
    });
  if (COUNTERS[definition.id]) return t(COUNTERS[definition.id], values);
  // Counted goals reuse their popup wording: "{goal} lanterns lit" → "52 / 125 lanterns lit".
  if (definition.popup.includes('{goal}'))
    return t(definition.popup, { goal: `${values.value} / ${values.goal}` });
  return `${values.value} / ${values.goal}`;
}
function quartermasterChecks(state) {
  const { capacity, levels } = maxPowerCapacity();
  const quantity = (id) => state.powers?.find?.((power) => power.id === id)?.quantity ?? 0;
  const full = POWERS.every((power) => quantity(power.id) >= capacity);
  return [
    ...Object.entries(levels).map(([id, max]) => {
      const level = Math.min(max, state.town?.buildings?.[id] ?? 0);
      return {
        id,
        done: level >= max,
        text: t(level >= max ? '{building} fully upgraded' : '{building} level {level} of {max}', {
          building: t(BUILDING_BY_ID[id]?.shortName ?? id),
          level,
          max,
        }),
      };
    }),
    {
      id: 'powers',
      done: full,
      text: t('All {count} powers at {capacity} at the same time', {
        count: POWERS.length,
        capacity,
      }),
    },
  ];
}
const fusionChips = (state) =>
  HONOURS.fusionKeys.map((key) => ({
    key,
    done: !!state.honours?.fusions?.includes(key),
    text: key
      .split('+')
      .map((bonus) => t(BONUS_NAMES[bonus] ?? bonus))
      .join(' + '),
  }));
// Where a mine honour advances: its levels, chapters and whether the player got there.
function mineLevels(definition, state) {
  const element = MINE_ELEMENTS.find((entry) => entry.id === definition.element);
  const { levels, chapters } = elementLevels(definition.element);
  if (!element || !levels.length) return null;
  const reached = levels[0] <= (state.nextLevel ?? 1);
  const completed = levels.filter((id) => state.records?.[id]).length;
  return {
    element: t(element.label),
    reached,
    summary: t('{count} levels · chapters {from}–{to}', {
      count: levels.length,
      from: chapters[0],
      to: chapters[1],
    }),
    completed: t('You have completed {done} of these {count} levels', {
      done: completed,
      count: levels.length,
    }),
  };
}
function medalStatus(family) {
  const params = honourParams(family.definition);
  if (family.status === 'current')
    return t('Fully protect the town from a {incident} in this era.', params);
  if (family.status === 'future') return t('Reach {era}', params);
  return t('No recorded defence');
}

/**
 * One family as shown on a card and in its detail, with every string translated.
 * `state` is the campaign store (records, town, powers, honours, nextLevel).
 */
export function describeFamily(family, state, { canReplay = false } = {}) {
  const { definition, earned, next } = family;
  const mine = family.category === 'mine' ? mineLevels(definition, state) : null;
  const target = next && LINKS[next.definition.link];
  const link =
    target && (!target.museum || (canReplay && (!mine || mine.reached)))
      ? { ...target, label: t(target.label) }
      : null;
  return {
    id: family.id,
    category: family.category,
    definition,
    name: t(definition.name),
    difficulty: difficultyLabel(definition),
    shape: definition.art?.frame === 'medal' ? 'medal' : (definition.difficulty ?? 'medium'),
    kicker:
      family.category === 'defence'
        ? t(ERA_BY_ID[definition.era]?.label ?? '')
        : mine
          ? `${difficultyLabel(definition)} · ${mine.element}`
          : difficultyLabel(definition),
    requirement: requirementText(definition),
    earned: earned && {
      text: earnedText(earned),
      evidence: evidenceText(earned.evidence),
      dated: !!earned.at,
    },
    // Any ranked family keeps its highest rank and names the next one.
    nextRank:
      earned && next
        ? t('Next rank · {name} — {popup}', {
            name: t(next.definition.name),
            popup: t(next.definition.popup, honourParams(next.definition)),
          })
        : '',
    progress:
      next?.progress && next.progress.goal > 0
        ? {
            ...next.progress,
            percent: Math.min(100, (100 * next.progress.value) / next.progress.goal),
            text: progressText(next.definition, next.progress, state),
          }
        : null,
    chips: definition.id === 'fusion-master' && !earned ? fusionChips(state) : null,
    checks: definition.id === 'master-quartermaster' && !earned ? quartermasterChecks(state) : null,
    mine: earned ? null : mine,
    status: family.category === 'defence' && !earned ? medalStatus(family) : '',
    current: family.status === 'current',
    link,
  };
}
