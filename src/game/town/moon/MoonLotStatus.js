import { BUILDING_BY_ID } from '../../../data/town';
import { moonParcels } from '../../../data/moonSettlement';
import { AREA_BY_ID, areaChoice, areaUnlocked, monumentWork } from '../../../data/townLandmarks';
import { collectionCooldownRemaining, plotUnlocked } from '../TownRules';
import { buildingStatus, monumentStatus } from '../TownBuildingFeedback';
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

export const moonLotName = (id) => t(AREA_BY_ID[id]?.label ?? BUILDING_BY_ID[id].shortName);

/**
 * A lot's or site's status, `{ kind, text, title }` as the valley's labels read it, or
 * null for nothing to show. Buildings and monument sites use the shared contracts
 * (buildingStatus, monumentStatus); only collectable moonstones and a lot the town
 * has not opened yet have the Moon's own wording. A read-only visitor sees levels only.
 */
export function moonLotInfo(
  town,
  id,
  { indicators = {}, availableIds = [], collectable = false, readOnly = false } = {},
) {
  if (AREA_BY_ID[id]) return monumentStatus(town, id, { readOnly });
  if (readOnly) return buildingStatus(town, id, { readOnly });
  if (id === 'moonstoneWorkshop' && collectable)
    return {
      kind: 'coins',
      text: t('Collect {count} moonstones', { count: town.moonstoneProduction.stored }),
    };
  if (moonLotStatus(town, id) === 'later') return { kind: 'later', text: t('Coming soon') };
  return buildingStatus(town, id, {
    indicator: indicators[id],
    available: availableIds.includes(id),
  });
}

// The short status under a lot's name, as text.
export const moonLotDetail = (town, id, options) => moonLotInfo(town, id, options)?.text ?? null;

export const moonLotLabel = (town, id, options) =>
  [moonLotName(id), moonLotDetail(town, id, options)].filter(Boolean).join(' · ');
