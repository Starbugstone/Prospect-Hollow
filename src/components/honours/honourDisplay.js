// Display models for Town Honours: the collection, details, showcase, popup, museum and
// the visitor gallery share these, so every view words metals, ranks, requirements,
// progress and dates alike. Presentation only; nothing here changes the saved honours.
import { t, number, locale } from '../../i18n';
import { ERA_BY_ID } from '../../data/eras';
import { POWERS } from '../../data/campaign';
import { HONOURS, MINE_ELEMENTS, SHOWCASE_SLOTS } from '../../data/honours';
import { elementLevels } from '../../data/honourLevels';
import { distinctionBadge, isPlayerDistinction } from '../../data/playerDistinctions';

// Each metal is named and shaped (round, hexagon, rosette, octagon), never told apart
// by colour alone. A metal added to RANK_METALS without a label shows its ID.
const METAL_LABELS = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  diamond: 'Diamond',
};
const DIFFICULTIES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
export const TAB_LABELS = { mine: 'Mine', town: 'Town', friends: 'Friends', player: 'Player' };
const BONUS_NAMES = { bomb: 'Bomb', cross: 'Cross', rainbow: 'Rainbow' };
// Where an unfinished honour advances. Museum links open the filtered museum and the
// directory link the shared-town directory, which needs a signed-in account.
const LINKS = {
  blacksmith: { label: 'Blacksmith details', building: 'blacksmith' },
  supplies: { label: 'Open supplies', building: 'armory' },
  'museum-score': { label: 'Show score levels in the museum', museum: true },
  'museum-stars': { label: 'Show levels below three stars', museum: true },
  'museum-element': { label: 'Show these levels in the museum', museum: true },
  directory: { label: 'Find villages to visit', directory: true },
};

// Points of a regular outline in a 100×100 box; `inner` alternates for a rosette.
export const outline = (count, outer, inner = outer, turn = -90) =>
  Array.from({ length: count }, (_, i) => {
    const radius = i % 2 ? inner : outer;
    const angle = ((turn + (i * 360) / count) * Math.PI) / 180;
    return `${(50 + radius * Math.cos(angle)).toFixed(1)},${(50 + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');

export const metalLabel = (metal) => t(METAL_LABELS[metal] ?? metal);
export const difficultyLabel = (definition) =>
  t(DIFFICULTIES[definition.difficulty] ?? DIFFICULTIES.medium);
// "Score Ace · Silver": a rank by name and metal, for the popup, showcase and gallery. A
// player distinction has no metal: "Loyal Prospector · 2 years".
export const rankName = (definition) =>
  definition.player
    ? distinctionName(definition)
    : t('{name} · {metal}', { name: t(definition.name), metal: metalLabel(definition.metal) });

// Nested English names (eras) are translated and numbers localized.
const honourParams = (definition) =>
  Object.fromEntries(
    Object.entries(definition.params()).map(([key, value]) => [
      key,
      typeof value === 'number' ? number(value) : t(value),
    ]),
  );
const requirementText = (definition) => t(definition.requirement, honourParams(definition));
export const popupText = (definition) => t(definition.popup, honourParams(definition));
const formatDate = (at) => new Date(at).toLocaleDateString(locale.value, { dateStyle: 'medium' });
export const earnedText = (entry) =>
  entry.at
    ? t('Earned {date}', { date: formatDate(entry.at) })
    : t('Earned before honours were introduced');
// Score evidence only: other ranks record no public evidence.
export const evidenceText = (evidence) =>
  evidence?.levelId && Number.isFinite(evidence.score) && Number.isFinite(evidence.target)
    ? t('{score} on level {level} (target {target})', {
        score: number(evidence.score),
        level: evidence.levelId,
        target: number(evidence.target),
      })
    : '';

/**
 * Every rank of a family as a track (filled once earned) with a summary such as
 * "Silver · 2 of 3", for any number of ranks. A single-rank family is just its metal.
 * `earned(definition)` says whether the player or visited owner holds that rank.
 */
export function rankTrack(ranks, earned) {
  const steps = ranks.map((definition) => ({
    id: definition.id,
    metal: definition.metal,
    label: metalLabel(definition.metal),
    earned: !!earned(definition),
  }));
  const top = ranks.filter(earned).at(-1);
  let text = metalLabel(ranks[0]?.metal);
  if (ranks.length > 1)
    text = top
      ? t('{metal} · {rank} of {total}', {
          metal: metalLabel(top.metal),
          rank: top.rank,
          total: ranks.length,
        })
      : t('No rank yet · 0 of {total}', { total: ranks.length });
  return { steps, text, single: ranks.length === 1 };
}

// The highest earned rank of a family, or null. Showcase slots hold family IDs, so a
// later rank upgrades the same slot.
function topEarned(familyId, earned, catalog = HONOURS) {
  const family = catalog.familyById[familyId];
  const definition = family?.ranks.filter((rank) => earned[rank.id]).at(-1);
  return definition
    ? {
        familyId,
        definition,
        entry: earned[definition.id],
        name: rankName(definition),
        track: rankTrack(family.ranks, (rank) => earned[rank.id]),
      }
    : null;
}
export const earnedFamilies = (earned, catalog = HONOURS) =>
  catalog.families.map((family) => topEarned(family.id, earned, catalog)).filter(Boolean);
// `received`: player distinctions by ID (receivedDistinctions or publishedDistinction).
export const showcaseSlots = (ids, earned, received = {}, catalog = HONOURS) =>
  Array.from({ length: SHOWCASE_SLOTS }, (_, index) => {
    const id = ids[index];
    if (!id) return null;
    return isPlayerDistinction(id) ? distinctionSlot(id, received) : topEarned(id, earned, catalog);
  });
// Moves one showcase entry; the order is what visitors see.
export function moveSlot(ids, index, offset) {
  const target = index + offset;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// Earned and fresh families for menus and summaries, without computing progress. A
// family is fresh with an unseen rank or a rank added since the player last looked.
export function honourSummary(honours, catalog = HONOURS) {
  const earned = honours?.earned ?? {};
  const seenGeneration = honours?.seenGeneration ?? 0;
  return {
    earned: earnedFamilies(earned, catalog).length,
    total: catalog.families.length,
    fresh: catalog.families.filter((family) =>
      family.ranks.some((rank) =>
        earned[rank.id] ? earned[rank.id].seen === false : rank.since > seenGeneration,
      ),
    ).length,
  };
}
// Earned honour IDs of a tab that the player has not seen yet.
export const unseenIds = (tab) =>
  tab.families.flatMap((family) =>
    family.ranks
      .filter((rank) => rank.earned && !rank.earned.seen)
      .map((rank) => rank.definition.id),
  );

// Score ranks compare a ratio, shown to one decimal and never rounded up to the goal.
export const progressValue = (definition, value) =>
  definition.measure.kind === 'score' ? Math.floor(value * 10) / 10 : value;
function eraProgress(definition, state) {
  const { era, complete } = definition.measure;
  return t(
    complete
      ? 'Now in {current} · next milestone: complete {era}'
      : 'Now in {current} · next milestone: reach {era}',
    {
      current: t(ERA_BY_ID[state.town?.era]?.label ?? ''),
      era: t(ERA_BY_ID[era]?.label ?? era),
    },
  );
}
function progressText(definition, { value, goal }, state) {
  if (definition.measure.kind === 'era') return eraProgress(definition, state);
  const values = { value: number(progressValue(definition, value)), goal: number(goal) };
  if (definition.progressText) return t(definition.progressText, values);
  // Counted goals reuse their popup wording: "{goal} lanterns lit" → "52 / 125 lanterns lit".
  if (definition.popup.includes('{goal}'))
    return t(definition.popup, { goal: `${values.value} / ${values.goal}` });
  return `${values.value} / ${values.goal}`;
}
// A "different keys" rank (Fusion Master): which of its keys are done.
const keyChips = ({ counter, keys }, state) =>
  keys.map((key) => ({
    key,
    done: state.honours?.counts?.[counter]?.[key] > 0,
    text: key
      .split('+')
      .map((bonus) => t(BONUS_NAMES[bonus] ?? bonus))
      .join(' + '),
  }));
// A "powers held" rank (Master Quartermaster): one check per power at the quantity.
const powerChecks = ({ quantity }, state) =>
  POWERS.map((power) => {
    const done =
      (state.powers?.find?.((entry) => entry.id === power.id)?.quantity ?? 0) >= quantity;
    return {
      id: power.id,
      done,
      text: t('{power} at {quantity}', { power: t(power.label), quantity: number(quantity) }),
    };
  });
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

/**
 * One family as shown on a card and in its detail, with every string translated.
 * `state` is the campaign store (records, town, powers, honours, nextLevel). Links
 * show only where they can open: museum replays need `canReplay`, the shared-town
 * directory `canTravel` (a signed-in account).
 */
export function describeFamily(family, state, { canReplay = false, canTravel = false } = {}) {
  const { definition, earned, next } = family;
  const mine = definition.element ? mineLevels(definition, state) : null;
  const target = next && LINKS[next.definition.link];
  const opens = target && (target.museum ? canReplay && (!mine || mine.reached) : true);
  const link =
    opens && (!target.directory || canTravel) ? { ...target, label: t(target.label) } : null;
  const measure = next?.definition.measure;
  return {
    id: family.id,
    tab: family.tab,
    definition,
    name: t(definition.name),
    // The frame takes the metal of the highest earned rank; locked families have none.
    metal: earned ? definition.metal : null,
    difficulty: difficultyLabel(definition),
    kicker: mine ? `${difficultyLabel(definition)} · ${mine.element}` : difficultyLabel(definition),
    requirement: requirementText(definition),
    track: rankTrack(
      family.ranks.map((rank) => rank.definition),
      (rank) => family.ranks[rank.rank - 1]?.earned,
    ),
    // Every rank, as the detail's ladder lists them.
    ranks: family.ranks.map((rank) => ({
      id: rank.definition.id,
      definition: rank.definition,
      metal: metalLabel(rank.definition.metal),
      difficulty: difficultyLabel(rank.definition),
      name: t(rank.definition.name),
      requirement: requirementText(rank.definition),
      earned: rank.earned && {
        text: earnedText(rank.earned),
        evidence: evidenceText(rank.earned.evidence),
        dated: !!rank.earned.at,
      },
      next: rank.definition === next?.definition,
    })),
    earned: earned && {
      text: earnedText(earned),
      evidence: evidenceText(earned.evidence),
      dated: !!earned.at,
    },
    // A family keeps its highest rank on show and names the next one.
    nextRank:
      earned && next
        ? t('Next rank · {metal} · {name} — {popup}', {
            metal: metalLabel(next.definition.metal),
            name: t(next.definition.name),
            popup: popupText(next.definition),
          })
        : '',
    progress:
      next && next.progress.goal > 0
        ? {
            ...next.progress,
            percent: Math.min(100, Math.max(0, (100 * next.progress.value) / next.progress.goal)),
            text: progressText(next.definition, next.progress, state),
          }
        : null,
    chips: measure?.kind === 'distinct' ? keyChips(measure, state) : null,
    checks: measure?.kind === 'powers' ? powerChecks(measure, state) : null,
    mine: next ? mine : null,
    link,
  };
}

// ---------- Player distinctions ----------
// Time steps read "1 week", "3 months", "2 years"; the badge engraves the number and unit.
const TENURE_TEXT = {
  week: ['1 week', '{count} weeks', 'week', 'weeks'],
  month: ['1 month', '{count} months', 'month', 'months'],
  year: ['1 year', '{count} years', 'year', 'years'],
};
const tenureText = (step) => TENURE_TEXT[step.unit] ?? ['', '{count}', '', ''];
export const tenureLabel = (step) =>
  step.count === 1 ? t(tenureText(step)[0]) : t(tenureText(step)[1], { count: number(step.count) });
export const tenureUnit = (step) => t(tenureText(step)[step.count === 1 ? 2 : 3]);
export const distinctionName = (badge) =>
  badge.tenure
    ? t('{name} · {time}', { name: t(badge.name), time: tenureLabel(badge.tenure) })
    : t(badge.name);
function distinctionSlot(id, received) {
  const definition = Object.hasOwn(received, id) && distinctionBadge(id, received[id]);
  return definition
    ? {
        familyId: id,
        player: true,
        definition,
        entry: received[id],
        name: distinctionName(definition),
        track: {
          text: definition.tenure ? tenureLabel(definition.tenure) : t('Player distinction'),
        },
      }
    : null;
}
// One received distinction for the Player tab: its badge, wording and dates.
export function describeDistinction(item) {
  const badge = distinctionBadge(item.id, item);
  const step = item.tenure;
  return {
    id: item.id,
    badge,
    name: t(badge.name),
    title: distinctionName(badge),
    description: t(badge.description),
    received: item.at
      ? t(step ? 'Reached {date}' : 'Received {date}', { date: formatDate(item.at) })
      : '',
    next: step?.next
      ? t('Next: {time} on {date}', {
          time: tenureLabel(step.next),
          date: formatDate(step.next.at),
        })
      : '',
  };
}
