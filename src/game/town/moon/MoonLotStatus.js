import { BUILDING_BY_ID } from '../../../data/town';
import { moonParcels } from '../../../data/moonSettlement';
import { AREA_BY_ID, areaChoice, areaUnlocked, monumentWork } from '../../../data/townLandmarks';
import { collectionCooldownRemaining, plotUnlocked } from '../TownRules';
import { buildingStatusLabel } from '../TownBuildingFeedback';
import { t } from '../../../i18n';

// One status contract for New Hollow's lots, shared by the Moon map labels and the
// Build tab's Moon list, so both always describe a lot the same way.

// Every Moon building lot, then each monument site the town has opened on the Moon,
// from the one parcel contract that the scene draws, glows and taps.
export const moonLotIds = (town) =>
  moonParcels()
    .filter(({ id, kind }) => kind === 'lot' || areaUnlocked(town, AREA_BY_ID[id]))
    .map(({ id }) => id);

export const canCollectMoonstones = (town, now = Date.now()) =>
  !!town.moonstoneProduction?.stored &&
  !collectionCooldownRemaining(town, 'moonstoneWorkshop', now);

export const moonMonumentChoice = (town, id) =>
  AREA_BY_ID[id] ? areaChoice(town, AREA_BY_ID[id]) : undefined;

// 'work', 'ready', 'monument', 'built', 'open' or 'later'.
export function moonLotStatus(town, id) {
  const area = AREA_BY_ID[id];
  if (area) {
    const work = monumentWork(town, area);
    if (work?.ready) return 'ready';
    if (work) return 'work';
    return areaChoice(town, area) ? 'monument' : 'open';
  }
  if (town.projects?.[id]) return 'work';
  if (town.buildings?.[id]) return 'built';
  return plotUnlocked(town, id) ? 'open' : 'later';
}

export function moonLotStatusLabel(town, id, { collectable = false } = {}) {
  if (id === 'moonstoneWorkshop' && collectable)
    return t('Collect {count} moonstones', { count: town.moonstoneProduction.stored });
  return {
    work: t('Under construction'),
    ready: t('Ready to unveil'),
    monument: t('Monument'),
    built: t('Lv. {level}', { level: town.buildings?.[id] }),
    open: t(AREA_BY_ID[id] ? 'Choose a design' : 'Build'),
    later: t('Coming soon'),
  }[moonLotStatus(town, id)];
}

export const moonLotName = (id) => t(AREA_BY_ID[id]?.label ?? BUILDING_BY_ID[id].shortName);

// The short status under a lot's name: monument sites and collectable moonstones use
// the Moon's own wording; buildings share the valley's building feedback.
export function moonLotDetail(
  town,
  id,
  { indicators = {}, availableIds = [], collectable = false } = {},
) {
  return AREA_BY_ID[id] || (id === 'moonstoneWorkshop' && collectable)
    ? moonLotStatusLabel(town, id, { collectable })
    : buildingStatusLabel(town, id, indicators[id], availableIds.includes(id));
}

export const moonLotLabel = (town, id, options) =>
  `${moonLotName(id)} · ${moonLotDetail(town, id, options)}`;
