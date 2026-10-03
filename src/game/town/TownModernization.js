import { heritageDescription } from '../../data/heritageUpgrades';
import { watermillAppearance } from '../../data/watermill';
import { eraEvolution } from '../../data/eras';
import { RIVER_RAIL_VARIANTS } from '../../data/riverRail';
import { INDUSTRIAL_VARIANTS } from '../../data/industrial';
import { MOTOR_AGE_VARIANTS } from '../../data/motorAge';
import { cityVariant, cityBuildingPrice, isMajorCityBuilding } from '../../data/city';
import { townSupply } from './TownNeeds';

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

// A modernized waterworks or farm states the supply it adds; others keep services.
const SUPPLY_BENEFITS = {
  water: 'Adds water for {count} people when finished. Existing water stays available during work.',
  food: 'Adds food for {count} people when finished. Existing harvests stay available during work.',
};
const benefit = (town, building, level) => {
  const before = townSupply(town);
  const after = townSupply({
    ...town,
    buildingEras: { ...town.buildingEras, [building.id]: town.era },
    buildingEraLevels: { ...town.buildingEraLevels, [building.id]: level + 1 },
  });
  const stat = Object.keys(SUPPLY_BENEFITS).find((need) => after[need] > before[need]);
  return stat
    ? { benefit: SUPPLY_BENEFITS[stat], benefitValues: { count: after[stat] - before[stat] } }
    : { benefit: 'Visual modernization. Existing services stay unchanged.' };
};

/** One offer contract for every style. Eligibility is checked by TownEras;
 * this factory only applies the selected era's appearance, prices and durations.
 */
export function createModernizationOffer(town, building, level) {
  const profile = eraEvolution(town.era);
  const appearance =
    building.kind === 'watermill'
      ? watermillAppearance(town.era)
      : APPEARANCES[profile.style]?.(building, town.era);
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
        : level === 2 && ['river-rail', 'industrial'].includes(profile.style)
          ? heritageDescription(building.kind)
          : profile.upgradeDescriptions[level - 1],
    title: profile.upgradeTitle,
    ...(!city ? { requiresPower: profile.requiresPower && building.id !== 'railDepot' } : {}),
    ...benefit(town, building, level),
  };
}
