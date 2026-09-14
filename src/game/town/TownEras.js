import { isCityEra, CITY_LEVEL_PRICES, cityVariant } from '../../data/city';
import { RIVER_RAIL_LEVEL_PRICES } from '../../data/economy';
import { ERAS, ERA_BY_ID, FRONTIER_ERA } from '../../data/eras';
import { BUILDINGS, BUILDING_BY_ID, BANDIT_EVENT } from '../../data/town';
import { RIVER_RAIL_VARIANTS } from '../../data/riverRail';
import { INDUSTRIAL_VARIANTS, INDUSTRIAL_LEVEL_PRICES } from '../../data/industrial';
import { MOTOR_AGE_VARIANTS, MOTOR_AGE_LEVEL_PRICES } from '../../data/motorAge';

export const eraIndex = (era) => ERAS.findIndex(({ id }) => id === era);
export const plotInEra = (town, id) => {
  const plot = BUILDING_BY_ID[id];
  return !!plot && eraIndex(plot.introducedEra) <= eraIndex(town.era ?? FRONTIER_ERA);
};
const ERA_BUILDING_LEVELS = 3;
export const eraBuildingLevel = (town, id) => {
  if (town.era === 'frontier' || BUILDING_BY_ID[id]?.introducedEra === town.era)
    return town.buildings[id] ?? 0;
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
  if (isCityEra(town.era)) {
    const description = cityVariant(building.kind, town.era);
    if (!description) return null;
    return {
      type: 'modernization',
      targetEra: town.era,
      eraLevel: level + 1,
      stage: town.buildings[id] + level,
      cost: CITY_LEVEL_PRICES[town.era][level],
      runs: level === 0 ? 2 : 1,
      name: building.name,
      description:
        level === 0
          ? description
          : level === 1
            ? 'Add a sheltered side wing and a planted forecourt.'
            : 'Complete the landmark with its roof garden and civic lighting.',
      title: 'City level {level}: {name}',
      benefit: 'Visual modernization. Existing services stay unchanged.',
    };
  }
  const variant = (
    town.era === 'motor-age'
      ? MOTOR_AGE_VARIANTS
      : town.era === 'industrial'
        ? INDUSTRIAL_VARIANTS
        : RIVER_RAIL_VARIANTS
  )[building.kind];
  if (!variant) return null;
  const [name, description] = variant;
  return {
    type: 'modernization',
    targetEra: town.era,
    eraLevel: level + 1,
    stage: town.buildings[id] + level,
    cost: (town.era === 'motor-age'
      ? MOTOR_AGE_LEVEL_PRICES
      : town.era === 'industrial'
        ? INDUSTRIAL_LEVEL_PRICES
        : RIVER_RAIL_LEVEL_PRICES)[level],
    runs: level === 0 ? 2 : 1,
    name,
    description:
      level === 0 || id === 'horseField'
        ? description
        : town.era === 'motor-age'
          ? level === 1
            ? 'Add a sunny service wing and a broad street canopy.'
            : 'Complete the landmark with its stepped frontage and planted terrace.'
          : town.era === 'industrial'
            ? level === 1
              ? 'Add a substantial service wing and sheltered entrance.'
              : 'Complete the landmark with its final civic and utility structures.'
            : level === 1
              ? 'Add a substantial extension and a covered veranda.'
              : 'Complete the landmark with a clock tower and ornamental roof.',
    title:
      town.era === 'motor-age'
        ? 'Motor Age level {level}: {name}'
        : town.era === 'industrial'
          ? 'Industrial level {level}: {name}'
          : 'River & Rail level {level}: {name}',
    requiresPower: town.era === 'industrial' && id !== 'railDepot',
    benefit:
      town.era === 'river-rail' && id === 'well' && level >= 1
        ? 'Adds water for twenty people when finished. All existing water stays available during work.'
        : town.era === 'motor-age' && id === 'well' && level === 2
          ? 'Adds water for twenty people when finished. All existing water stays available during work.'
          : town.era === 'motor-age' && id === 'farm' && level === 2
            ? 'Adds food for twenty people when finished. Existing harvests stay available during work.'
            : town.era === 'industrial' && id === 'well' && level === 2
              ? 'Adds water for twenty people when finished. Existing water stays available during work.'
              : 'Visual modernization. Existing services stay unchanged.',
  };
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
  for (const era of ERAS.filter((era) => era.enabled && eraIndex(era.id) <= eraIndex(town.era)))
    if (saved?.eraTransitionSeen?.[era.id] === true) town.eraTransitionSeen[era.id] = true;
  town.firstLightsSeen = saved?.firstLightsSeen === true && town.buildings.powerHouse > 0;
  return town;
}
