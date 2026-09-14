import { eraEvolution } from '../../data/eras';
import { RIVER_RAIL_VARIANTS } from '../../data/riverRail';
import { INDUSTRIAL_VARIANTS } from '../../data/industrial';
import { MOTOR_AGE_VARIANTS } from '../../data/motorAge';
import { cityVariant, cityBuildingPrice, isMajorCityBuilding } from '../../data/city';

/** @typedef {{name: string, description: string}} ModernizationAppearance */
/** @typedef {(building: Object, era: string) => ModernizationAppearance|null} AppearanceProvider */
const fromVariants = (variants) => (building) => {
  const variant = variants[building.kind];
  return variant ? { name: variant[0], description: variant[1] } : null;
};
/** @type {Record<string, AppearanceProvider>} */
const APPEARANCES = {
  'river-rail': fromVariants(RIVER_RAIL_VARIANTS),
  industrial: fromVariants(INDUSTRIAL_VARIANTS),
  'motor-age': fromVariants(MOTOR_AGE_VARIANTS),
  city: (building, era) => {
    const description = cityVariant(building.kind, era);
    return description ? { name: building.name, description } : null;
  },
};

const benefit = (profile, building, level) => {
  if (
    level > 0 &&
    building.id === 'well' &&
    profile.waterworks[level] - profile.waterworks[level - 1] === 20
  )
    return profile.waterUpgradeBenefit;
  if (
    level > 0 &&
    building.id === 'farm' &&
    profile.farmCapacity[level] - profile.farmCapacity[level - 1] === 20
  )
    return 'Adds food for twenty people when finished. Existing harvests stay available during work.';
  return 'Visual modernization. Existing services stay unchanged.';
};

/** One offer contract for every style. Eligibility is checked by TownEras;
 * this factory only applies the selected era's appearance, prices and durations.
 */
export function createModernizationOffer(town, building, level) {
  const profile = eraEvolution(town.era);
  const appearance = APPEARANCES[profile.style]?.(building, town.era);
  if (!appearance) return null;
  const city = profile.style === 'city';
  return {
    type: 'modernization',
    targetEra: town.era,
    eraLevel: level + 1,
    stage: town.buildings[building.id] + level,
    cost: city ? cityBuildingPrice(building.id, profile.prices[level]) : profile.prices[level],
    runs: level === 0 && !(city && isMajorCityBuilding(building.id)) ? 2 : 1,
    name: appearance.name,
    description:
      level === 0 || (!city && building.id === 'horseField')
        ? appearance.description
        : profile.upgradeDescriptions[level - 1],
    title: profile.upgradeTitle,
    ...(!city ? { requiresPower: profile.requiresPower && building.id !== 'railDepot' } : {}),
    benefit: benefit(profile, building, level),
  };
}
