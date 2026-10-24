import { BUILDING_BY_ID } from '../../data/town';
import { constructionReady, constructionRuns } from './TownRules';
import { ERA_BUILDING_LEVELS, eraBuildingLevel } from './TownEras';
import { t } from '../../i18n';

// One status contract for a building's short text: the valley map labels, the Moon lot
// labels (MoonLotStatus) and the Build tab's lists all describe a building here.
// Marker selection itself remains in buildingIndicators, including its priority.

// The building that would fix a shortage says so on its map label.
const NEED_HINTS = { water: 'Water needed', food: 'Food needed', comfort: 'Comfort needed' };

// The building's state, highest priority first. `indicator` is its marker from
// buildingIndicators, `available` a purchase the player can start now and `need` the
// shortage it would fix ('water', 'food' or 'comfort').
function buildingState(town, id, { indicator, available = false, need } = {}) {
  const project = town.projects?.[id];
  if (constructionReady(project)) return 'ready';
  if (project) return 'work';
  if (indicator === 'coins' || indicator === 'tnt') return indicator;
  if (NEED_HINTS[need]) return 'need';
  if (available) return 'available';
  return town.buildings?.[id] ? 'built' : 'empty';
}

const runsDone = (project) => Math.min(project.wins, constructionRuns(project));

// Map labels on every settlement. The valley marks an empty plot with a quiet '+'.
const MAP = {
  ready: () => t('Tap to finish'),
  work: (town, id) => {
    const project = town.projects[id];
    return `${runsDone(project)}/${constructionRuns(project)}`;
  },
  coins: (town) => t('Collect {coins} coins', { coins: town.income.stored }),
  tnt: () => t('Collect 1 TNT'),
  need: (town, id, need) => t(NEED_HINTS[need]),
  available: (town, id) => t(town.buildings[id] ? 'Upgrade' : 'Build'),
  built: (town, id) => t('Lv. {level}', { level: eraBuildingLevel(town, id) }),
  empty: () => t('Coming soon'),
};
// The Build tab's lists name a plot's progress through its era; other states read as on
// the map.
const LIST = {
  ready: () => t('Construction complete'),
  built: (town, id) =>
    t('Level {level} / {max}', {
      level: eraBuildingLevel(town, id),
      max: town.era !== 'frontier' ? ERA_BUILDING_LEVELS : BUILDING_BY_ID[id].upgrades.length,
    }),
  empty: () => t('Empty plot'),
};

// `{ kind, text }` for a building, or null when a read-only visitor sees nothing.
// `kind` is the state, so a view can choose its markup: the construction count also
// carries a `title`. `context: 'list'` gives the Build tab's wording. The valley's labels
// add the mine (`nextLevel`) and the visitor view (`readOnly`), which shows levels only.
export function buildingStatus(
  town,
  id,
  { context = 'map', readOnly = false, nextLevel, ...state } = {},
) {
  if (readOnly) return town.buildings?.[id] ? { kind: 'built', text: MAP.built(town, id) } : null;
  if (id === 'mine') return { kind: 'mine', text: t('Level {level}', { level: nextLevel }) };
  const kind = buildingState(town, id, state);
  const wording = (context === 'list' && LIST[kind]) || MAP[kind];
  const status = { kind, text: wording(town, id, state.need) };
  if (kind === 'work') {
    const project = town.projects[id];
    status.title = t('Construction: {wins} of {required} mining runs completed', {
      wins: runsDone(project),
      required: constructionRuns(project),
    });
  }
  return status;
}

// The map text alone, as the Moon lot labels show it.
export const buildingStatusLabel = (town, id, indicator, available = false) =>
  buildingStatus(town, id, { indicator, available }).text;
