import { bonusCapacity } from '../../data/rewards';
import { forgeProductionRuns } from '../../data/eras';
import { serviceLevel } from '../../data/buildingProgression';
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
import { needProviders } from './TownNeeds';

const NEED_ORDER = ['water', 'food', 'housing', 'visitors', 'comfort'];
const NEED_READS = {
  water: { icon: 'water', label: 'Water capacity', read: waterCapacity },
  food: { icon: 'food', label: 'Food capacity', read: foodCapacity },
  housing: { icon: 'people', label: 'Resident capacity', read: housingCapacity },
  visitors: { icon: 'people', label: 'Visitor capacity', read: visitorCapacity },
  comfort: { icon: 'happiness', label: 'Happiness', read: happiness, suffix: '%' },
};

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
  // Water, food, homes, visitors and comfort follow the shared needs model, so
  // modernizing the waterworks or a farm previews its real capacity.
  // The saloon and diner preview their income; others the first need they change.
  const changes = (read) => read(after) !== read(town);
  const stats = ['saloon', 'diner'].includes(id)
    ? []
    : NEED_ORDER.filter((need) => needProviders(need).has(id));
  const stat = stats.find((need) => changes(NEED_READS[need].read)) ?? stats[0];
  if (offer && !(stat && stat !== 'comfort' && changes(NEED_READS[stat].read)))
    return {
      icon: 'home',
      label: 'Era improvement',
      before: eraBuildingLevel(town, id),
      after: offer.eraLevel,
      suffix: '/3',
    };
  let icon = 'home',
    label = 'Building level',
    read = (value) => value.buildings[id],
    suffix = '';
  if (stat) ({ icon, label, read, suffix = '' } = NEED_READS[stat]);
  else if (['saloon', 'diner'].includes(id)) {
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
    read = (v) =>
      v.buildings.blacksmith ? forgeProductionRuns(serviceLevel(v, 'blacksmith')) : '—';
  }
  return { icon, label, before: read(town), after: read(after), suffix };
}
