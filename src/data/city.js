import buildingStyles from './cityBuildingStyles.json';
import { ERAS, ERA_BY_ID, eraEvolution } from './eras';
// City growth adds bounded capacity. Modernizing an existing service does not multiply it.
export const CITY_ERAS = ERAS.filter((era) => era.evolution.style === 'city').map((era) => era.id);
export const isCityEra = (era) => eraEvolution(era).style === 'city';
export const CITY_LEVEL_PRICES = Object.fromEntries(
  CITY_ERAS.map((era) => [era, eraEvolution(era).prices]),
);
// Large civic landmarks carry a modest premium; earnings and rewards stay unchanged.
export const isMajorCityBuilding = (id) => ['airport', 'skyline', 'cityHomes'].includes(id);
export const cityBuildingPrice = (id, price) =>
  Math.ceil(price * (isMajorCityBuilding(id) ? 1.25 : 1));
export const CITY_FAMILIES = {
  ...Object.fromEntries(
    Object.entries(buildingStyles).map(([kind, appearance]) => [kind, appearance.family]),
  ),
  airport: 'airport',
  radioTower: 'radio',
  concertHall: 'concert',
  television: 'television',
  skyline: 'skyline',
  square: 'square',
  bridge: 'bridge',
  horseField: 'field',
  park: 'park',
  riverPark: 'park',
};
export const CITY_DESCRIPTIONS = {
  civic: [
    'A brick civic hall, sheltered entrance and tall windows welcome the rebuilding neighborhood.',
    'A bright public atrium and planted roof renew the familiar civic landmark.',
  ],
  residence: [
    'Brick courtyard housing and sheltered balconies make room for neighborhood life.',
    'Timber screens, glass balconies and roof gardens frame the familiar homes.',
  ],
  retail: [
    'Wide shop windows and a striped canopy open onto the old shopping street.',
    'A timber market arcade and planted terrace welcome shoppers on foot.',
  ],
  depot: [
    'A broad vehicle bay and a sawtooth workshop roof keep the established service working.',
    'The familiar workshop gains roof panels, glazed doors and a sheltered service court.',
  ],
  farm: [
    'A low packing barn and grain silos serve the growing cooperative farm.',
    'Greenhouse roofs and planted growing beds renew the old farm.',
  ],
  water: [
    'A clean-lined utility hall and round reservoir preserve the city water and power services.',
    'A landscaped utility landmark pairs a glass control room with roof panels.',
  ],
  river: [
    'A sheltered marina landing keeps the working riverfront connected to town.',
    'Timber decking and a glazed pavilion open the historic landing to the promenade.',
  ],
  station: [
    'A rebuilt brick concourse and long platform canopy welcome the motor railcar.',
    'A glazed transit entrance, roof panels and cycle stands serve the electric railway.',
  ],
  culture: [
    'A low gallery wing and shaded reading terrace celebrate the city history.',
    'A glazed reading hall and sculpted roof connect culture with the old town.',
  ],
  research: [
    'A public discovery hall shares the story of the mine.',
    'A faceted crystal atrium and rooftop observatory link the city to its mining roots.',
  ],
  square: [
    'Stone seating and a fountain in the style of the day renew the civic square.',
    'A planted pedestrian plaza frames the new fountain.',
  ],
  bridge: [
    'Broad approach rails and paired lamps frame the familiar river crossing.',
    'A light pedestrian canopy and cycle rails renew the historic bridge approaches.',
  ],
  field: [
    'A shaded viewing pavilion and new seating welcome visitors to the horse field.',
    'A solar shade canopy and planted borders preserve the horses in the modern city.',
  ],
  park: [
    'A shaded garden pavilion and new benches frame the playground.',
    'A planted promenade, solar shade and cycle stands welcome families by the river.',
  ],
};
const newLandmarks = [
  [
    'airport',
    'Prospect regional airport',
    'Airport',
    'aviation',
    'airport',
    'A western gateway with a runway across several parcels',
  ],
  [
    'radioTower',
    'Valley radio station',
    'Radio tower',
    'aviation',
    'radio',
    'Radio brings news and music to the valley',
  ],
  [
    'concertHall',
    'Prospect live concert hall',
    'Concert hall',
    'broadcast',
    'concert',
    'A stage for the music of a growing city',
  ],
  [
    'television',
    'Valley television studios',
    'TV studios',
    'broadcast',
    'television',
    'Local television puts Prospect Hollow on screen',
  ],
  [
    'skyline',
    'Prospect business tower',
    'Business tower',
    'broadcast',
    'skyline',
    'A new skyline above the old streets',
  ],
].map(([id, name, shortName, introducedEra, family, purpose]) => ({
  id,
  kind: id,
  name,
  shortName,
  introducedEra,
  family,
  purpose,
  effects: { happiness: 1 },
  color: '#71938a',
  unlock: [],
  benefits: [
    'Adds 1 happiness in total.',
    'Adds 2 happiness in total.',
    'Adds 3 happiness in total.',
  ],
}));
export const CITY_BUILDINGS = [
  ...newLandmarks,
  {
    id: 'cityHall',
    kind: 'cityHall',
    name: 'Prospect city hall',
    shortName: 'City hall',
    purpose: 'A meeting place for a growing city',
    introducedEra: 'post-war',
    family: 'civic',
    effects: {
      happiness: 2,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
    benefits: [
      'Adds 2 happiness in total.',
      'Adds 4 happiness in total.',
      'Adds 6 happiness in total.',
    ],
  },
  {
    id: 'apartments',
    kind: 'apartments',
    name: 'Cedar court apartments',
    shortName: 'Apartments',
    purpose: 'More neighbors around a shared courtyard',
    introducedEra: 'post-war',
    family: 'residence',
    effects: {
      housing: 8,
      happiness: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
    benefits: [
      'Room for 8 residents, with food and water. Adds 1 happiness in total.',
      'Room for 16 residents, with food and water. Adds 2 happiness in total.',
      'Room for 24 residents, with food and water. Adds 3 happiness in total.',
    ],
  },
  {
    id: 'supermarket',
    kind: 'supermarket',
    name: 'Valley food hall',
    shortName: 'Food hall',
    purpose: 'Fresh produce for the whole city',
    introducedEra: 'post-war',
    family: 'retail',
    effects: {
      food: 18,
      happiness: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
    benefits: [
      'Adds food for 18 people. Adds 1 happiness in total.',
      'Adds food for 36 people. Adds 2 happiness in total.',
      'Adds food for 54 people. Adds 3 happiness in total.',
    ],
  },
  {
    id: 'waterPlant',
    kind: 'waterPlant',
    name: 'Prospect water plant',
    shortName: 'Water plant',
    purpose: 'Clean water for the new neighborhoods',
    introducedEra: 'post-war',
    family: 'water',
    effects: {
      water: 18,
      happiness: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
    benefits: [
      'Adds water for 18 people. Adds 1 happiness in total.',
      'Adds water for 36 people. Adds 2 happiness in total.',
      'Adds water for 54 people. Adds 3 happiness in total.',
    ],
  },
  {
    id: 'transitHub',
    kind: 'transitHub',
    name: 'Prospect transit interchange',
    shortName: 'Transit hub',
    purpose: 'A shared journey through the city',
    introducedEra: 'contemporary',
    family: 'station',
    effects: {
      visitors: 2,
      happiness: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
    benefits: [
      'Room for 2 visitors, with food and water. Adds 1 happiness in total.',
      'Room for 4 visitors, with food and water. Adds 2 happiness in total.',
      'Room for 6 visitors, with food and water. Adds 3 happiness in total.',
    ],
  },
  {
    id: 'library',
    kind: 'library',
    name: 'Riverlight internet café',
    shortName: 'Internet café',
    purpose: 'Computers and internet access for everyone',
    introducedEra: 'contemporary',
    family: 'culture',
    effects: {
      happiness: 2,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
    benefits: [
      'Adds 2 happiness in total.',
      'Adds 4 happiness in total.',
      'Adds 6 happiness in total.',
    ],
  },
  {
    id: 'crystalLab',
    kind: 'crystalLab',
    name: 'Prospect technology campus',
    shortName: 'Technology campus',
    purpose: 'Servers and software connect the city to the world',
    introducedEra: 'contemporary',
    family: 'research',
    effects: {
      happiness: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
    benefits: [
      'Adds 1 happiness in total.',
      'Adds 2 happiness in total.',
      'Adds 3 happiness in total.',
    ],
  },
  {
    id: 'cityHomes',
    kind: 'cityHomes',
    name: 'Willow city towers',
    shortName: 'City towers',
    purpose: 'Homes above familiar neighborhood shops',
    introducedEra: 'contemporary',
    family: 'residence',
    effects: {
      housing: 6,
      happiness: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
    benefits: [
      'Room for 6 residents, with food and water. Adds 1 happiness in total.',
      'Room for 12 residents, with food and water. Adds 2 happiness in total.',
      'Room for 18 residents, with food and water. Adds 3 happiness in total.',
    ],
  },
  {
    id: 'riverPark',
    kind: 'riverPark',
    name: 'Prospect river promenade',
    shortName: 'River promenade',
    purpose: 'The river belongs to everyone',
    introducedEra: 'contemporary',
    family: 'park',
    effects: {
      happiness: 2,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
    benefits: [
      'Adds 2 happiness in total.',
      'Adds 4 happiness in total.',
      'Adds 6 happiness in total.',
    ],
  },
].map(({ benefits, ...building }) => ({
  ...building,
  stages: [
    'Empty plot',
    ...[1, 2, 3].map((level) => `${ERA_BY_ID[building.introducedEra].label} · Level ${level}`),
  ],
  upgrades: benefits.map((benefit, index) => ({
    cost: cityBuildingPrice(
      building.id,
      eraEvolution(building.introducedEra).newBuildingPrices[index],
    ),
    runs: isMajorCityBuilding(building.id) && index === 0 ? 2 : 1,
    title: index ? 'Expand {building}' : 'Build {building}',
    benefit,
    story: benefit,
    speaker: 'Ada · the caretaker',
  })),
}));
export const cityCapacity = (town, stat) =>
  CITY_BUILDINGS.reduce((sum, b) => sum + (b.effects[stat] ?? 0) * (town.buildings[b.id] ?? 0), 0);
export const cityVariant = (kind, era) =>
  ['airport', 'radio', 'concert', 'television', 'skyline'].includes(CITY_FAMILIES[kind])
    ? 'Renew the landmark with improved facilities and city lighting.'
    : (eraEvolution(era).cityDescription ?? CITY_DESCRIPTIONS[CITY_FAMILIES[kind]]?.[0]);
