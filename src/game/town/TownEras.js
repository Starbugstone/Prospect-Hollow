import { createModernizationOffer } from './TownModernization';
import { ERAS, ERA_BY_ID, FRONTIER_ERA, eraEvolution } from '../../data/eras';
import { BUILDINGS, BUILDING_BY_ID, BANDIT_EVENT } from '../../data/town';

export const eraIndex = (era) => ERAS.findIndex(({ id }) => id === era);
export const plotInEra = (town, id) => {
  const plot = BUILDING_BY_ID[id];
  return !!plot && eraIndex(plot.introducedEra) <= eraIndex(town.era ?? FRONTIER_ERA);
};
export const ERA_BUILDING_LEVELS = 3;
/** Whether an era modernizes this building. An era's `modernizes` list limits its
 * modernization to those ids; every other building keeps its earlier finish. */
export const modernizesInEra = (era, id) => {
  const list = eraEvolution(era).modernizes;
  return !list || list.includes(id);
};
/** The latest era up to `era` whose finish this building wears once fully modernized. */
export function finishEra(id, era) {
  const introduced = eraIndex(BUILDING_BY_ID[id]?.introducedEra ?? FRONTIER_ERA);
  for (let index = eraIndex(era); index > introduced; index--)
    if (modernizesInEra(ERAS[index].id, id)) return ERAS[index].id;
  return ERAS[Math.max(0, introduced)].id;
}
export const eraBuildingLevel = (town, id) => {
  if (town.era === 'frontier' || BUILDING_BY_ID[id]?.introducedEra === town.era)
    return town.buildings[id] ?? 0;
  // A building this era leaves alone is already finished for it.
  if (!modernizesInEra(town.era, id)) return ERA_BUILDING_LEVELS;
  return town.buildingEras[id] === town.era ? town.buildingEraLevels?.[id] || 1 : 0;
};
export function modernization(town, id) {
  const building = BUILDING_BY_ID[id],
    level = eraBuildingLevel(town, id);
  if (
    !building ||
    eraIndex(building.introducedEra) >= eraIndex(town.era) ||
    town.buildings[id] !== building.upgrades.length ||
    level >= ERA_BUILDING_LEVELS
  )
    return null;
  return createModernizationOffer(town, building, level);
}

export function isEraComplete(town) {
  return BUILDINGS.filter((b) => b.requiredForEraCompletion && plotInEra(town, b.id)).every(
    (b) =>
      town.buildings[b.id] === b.upgrades.length &&
      !town.projects[b.id] &&
      (town.era === 'frontier' || eraBuildingLevel(town, b.id) === ERA_BUILDING_LEVELS),
  );
}
export function eraGate(town) {
  const next = ERAS[eraIndex(town.era) + 1];
  const townComplete = isEraComplete(town);
  const pendingRaid = !!town.events[BANDIT_EVENT] && !town.events[BANDIT_EVENT].seen;
  return {
    next,
    townComplete,
    pendingRaid,
    available: !!next?.enabled && townComplete && !pendingRaid && !town.transition?.pending,
  };
}
export function advanceEra(town, expectedEra) {
  const gate = eraGate(town);
  if (town.era !== expectedEra || !gate.available) return null;
  return {
    ...town,
    era: gate.next.id,
    transition: {
      id: `${expectedEra}:${gate.next.id}`,
      from: expectedEra,
      to: gate.next.id,
      pending: true,
    },
  };
}
export function normalizeEraState(town, saved) {
  if (ERA_BY_ID[saved?.era]?.enabled) town.era = saved.era;
  for (const id of Object.keys(town.buildings)) {
    const era = saved?.buildingEras?.[id];
    if (ERA_BY_ID[era]?.enabled && eraIndex(era) <= eraIndex(town.era)) town.buildingEras[id] = era;
    const level = saved?.buildingEraLevels?.[id];
    town.buildingEraLevels[id] =
      town.buildingEras[id] !== 'frontier'
        ? Number.isInteger(level) && level >= 1 && level <= ERA_BUILDING_LEVELS
          ? level
          : 1
        : 0;
  }
  const receipt = saved?.transition;
  if (
    receipt &&
    receipt.id === `${receipt.from}:${receipt.to}` &&
    ERA_BY_ID[receipt.from]?.enabled &&
    (eraIndex(receipt.to) === eraIndex(receipt.from) + 1 ||
      (receipt.from === 'industrial' && receipt.to === 'motor-age') ||
      (receipt.from === 'motor-age' && receipt.to === 'contemporary')) &&
    receipt.to === town.era &&
    ERA_BY_ID[receipt.to]?.enabled
  ) {
    town.transition = {
      id: receipt.id,
      from: receipt.from,
      to: receipt.to,
      pending: receipt.pending === true,
    };
  }
  town.firstLightsSeen = saved?.firstLightsSeen === true && town.buildings.powerHouse > 0;
  return town;
}
