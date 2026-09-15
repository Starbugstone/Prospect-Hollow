import { BUILDING_BY_ID } from '../../data/town';
import { bonusCapacity } from '../../data/rewards';
import { forgeProductionRuns } from '../../data/eras';
import { eraBuildingLevel, modernization as modernizationOffer } from './TownEras';
import {
  foodCapacity,
  waterCapacity,
  housingCapacity,
  visitorCapacity,
  happiness,
  saloonIncomeRate,
  raidProtection,
  gangSize,
} from './TownRules';

// Preview real service values against the current town, without changing the save.
export function buildingBenefit(town, id, stage, modernization = false) {
  const offer = modernization
    ? typeof modernization === 'object'
      ? modernization
      : modernizationOffer(town, id)
    : null;
  const after = {
    ...town,
    buildings: { ...town.buildings, [id]: offer ? town.buildings[id] : stage },
    buildingEras: { ...town.buildingEras, [id]: offer?.targetEra ?? town.era },
    buildingEraLevels: { ...town.buildingEraLevels, [id]: offer?.eraLevel ?? stage },
  };
  const kind = BUILDING_BY_ID[id].kind;
  let icon = 'home',
    label = 'Building level',
    read = (value) => value.buildings[id],
    suffix = '';
  if (
    offer &&
    !(
      (id === 'well' && waterCapacity(after) > waterCapacity(town)) ||
      (id === 'farm' && foodCapacity(after) > foodCapacity(town))
    )
  )
    return {
      icon: 'home',
      label: 'Era improvement',
      before: eraBuildingLevel(town, id),
      after: offer.eraLevel,
      suffix: '/3',
    };
  if (kind === 'well' || id === 'waterPlant') {
    icon = 'water';
    label = 'Water capacity';
    read = waterCapacity;
  } else if (kind === 'farm' || id === 'fisherman' || id === 'market' || id === 'supermarket') {
    icon = 'food';
    label = 'Food capacity';
    read = foodCapacity;
  } else if (
    kind === 'home' ||
    ['gardenCourt', 'rowHouses', 'apartments', 'cityHomes'].includes(id)
  ) {
    icon = 'people';
    label = 'Resident capacity';
    read = housingCapacity;
  } else if (['stable', 'hotel', 'railDepot', 'busDepot', 'transitHub'].includes(id)) {
    icon = 'people';
    label = 'Visitor capacity';
    read = visitorCapacity;
  } else if (
    [
      'square',
      'museum',
      'school',
      'horseField',
      'park',
      'cityHall',
      'library',
      'crystalLab',
      'riverPark',
    ].includes(id)
  ) {
    icon = 'happiness';
    label = 'Happiness';
    read = happiness;
    suffix = '%';
  } else if (['saloon', 'diner'].includes(id)) {
    icon = 'coin';
    label = 'Coins per hour';
    read = saloonIncomeRate;
  } else if (['bank', 'sheriff', 'fireStation'].includes(id)) {
    icon = 'shield';
    label = 'Village protection';
    read = (v) => Math.round(raidProtection(v, gangSize(town)) * 100);
    suffix = '%';
  } else if (['armory', 'garage'].includes(id)) {
    icon = 'mine';
    label = 'Bonus capacity';
    read = bonusCapacity;
  } else if (id === 'blacksmith') {
    icon = 'mine';
    label = 'Puzzles per TNT';
    read = (v) => (v.buildings.blacksmith ? forgeProductionRuns(v.buildings.blacksmith) : '—');
  }
  return { icon, label, before: read(town), after: read(after), suffix };
}
