import buildingStyles from './cityBuildingStyles.json';
import { ERAS, ERA_BY_ID, eraEvolution } from './eras';
// City growth adds bounded capacity. Modernizing an existing service does not multiply it.
export const CITY_ERAS = ERAS.filter((era) => era.evolution.style === 'city').map((era) => era.id);
export const isCityEra = (era) => eraEvolution(era).style === 'city';
export const CITY_LEVEL_PRICES = Object.fromEntries(
  CITY_ERAS.map((era) => [era, eraEvolution(era).prices]),
);
// Large civic landmarks carry a modest premium; earnings and rewards stay unchanged.
export const isMajorCityBuilding = (id) =>
  ['airport', 'skyline', 'cityHomes', 'skyPods'].includes(id);
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
const LANDMARK_VISITORS = { airport: 4, radioTower: 2, concertHall: 4, television: 2 };
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
  // Landmarks draw visitors, who need water and food like residents do.
  effects: { ...(LANDMARK_VISITORS[id] ? { visitors: LANDMARK_VISITORS[id] } : {}), comfort: 1 },
  color: '#71938a',
  unlock: [],
}));

// The garden district uses the same bounded service and construction lifecycle
// as every city building. Content varies here; tier behavior stays shared.
const gardenBuildings = [
  {
    id: 'teaHouse',
    name: 'Clover riverside tea house',
    shortName: 'Tea house',
    purpose: 'A quiet cup and a garden veranda for neighbors',
    introducedEra: 'canopy',
    family: 'culture',
    effects: { visitors: 2, comfort: 2 },
    color: '#89a587',
  },
  {
    id: 'blossomAtelier',
    name: 'Seed & Blossom atelier',
    shortName: 'Blossom atelier',
    purpose: 'Grow seeds, share harvests and make beautiful things',
    introducedEra: 'canopy',
    family: 'farm',
    effects: { food: 4, water: 4, comfort: 1 },
    color: '#89a587',
  },
  {
    id: 'orchardCottages',
    name: 'Cloudberry orchard cottages',
    shortName: 'Orchard cottages',
    purpose: 'Cozy homes around a shared fruit garden',
    introducedEra: 'canopy',
    family: 'residence',
    effects: { housing: 4, comfort: 1 },
    color: '#89a587',
  },
  {
    id: 'glassworks',
    name: 'Hollow crystal glassworks',
    shortName: 'Glassworks',
    purpose: 'Shape mine crystals into glass that gathers daylight',
    introducedEra: 'riverlight',
    family: 'research',
    effects: { visitors: 2, comfort: 2 },
    color: '#aaa1bc',
  },
  {
    id: 'springsRetreat',
    name: 'Willow warm springs retreat',
    shortName: 'Springs retreat',
    purpose: 'Quiet pools, warm water and a sheltered lounge',
    introducedEra: 'riverlight',
    family: 'water',
    effects: { water: 4, comfort: 1 },
    color: '#aaa1bc',
  },
  {
    id: 'riverlightPavilion',
    name: 'Prospect Riverlight pavilion',
    shortName: 'Riverlight pavilion',
    purpose: 'A luminous gathering place for the whole valley',
    introducedEra: 'riverlight',
    family: 'culture',
    effects: { visitors: 4, comfort: 3 },
    color: '#aaa1bc',
  },
].map((building) => ({
  ...building,
  kind: building.id,
  unlock: [{ id: 'bridge', level: 1 }],
}));
for (const building of gardenBuildings) CITY_FAMILIES[building.kind] = building.family;

// Each level's benefit line follows the building's effects, so a balance change
// can never leave an outdated number in the text.
export function cityBenefit({ housing, visitors, food, water, comfort }, level) {
  const parts = [];
  if (housing) parts.push(`Room for ${housing * level} residents.`);
  if (visitors) parts.push(`Room for ${visitors * level} visitors.`);
  if (food && food === water) parts.push(`Adds food and water for ${food * level} people.`);
  else {
    if (food) parts.push(`Adds food for ${food * level} people.`);
    if (water) parts.push(`Adds water for ${water * level} people.`);
  }
  if (comfort) parts.push(`Adds ${comfort * level} comfort in total.`);
  return parts.join(' ');
}

export const CITY_BUILDINGS = [
  ...gardenBuildings,
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
      comfort: 2,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
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
      comfort: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
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
      food: 5,
      comfort: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
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
      water: 5,
      comfort: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
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
      comfort: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
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
      comfort: 2,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
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
      comfort: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
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
      comfort: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
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
      comfort: 2,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
  },
  {
    id: 'skyPods',
    kind: 'skyPods',
    name: 'Cloudberry sky pods',
    shortName: 'Sky pods',
    purpose: 'Round homes stacked above a garden street',
    introducedEra: 'tomorrow',
    family: 'residence',
    effects: {
      housing: 6,
      comfort: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
  },
  {
    id: 'biodome',
    kind: 'biodome',
    name: 'Prospect solar biodome',
    shortName: 'Biodome',
    purpose: 'Fresh harvests under glass all year round',
    introducedEra: 'tomorrow',
    family: 'farm',
    effects: {
      food: 5,
      comfort: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
  },
  {
    id: 'maglevStation',
    kind: 'maglevStation',
    name: 'Hollow maglev loop',
    shortName: 'Maglev loop',
    purpose: 'Quiet pods glide visitors across the valley',
    introducedEra: 'tomorrow',
    family: 'station',
    effects: {
      visitors: 2,
      comfort: 1,
    },
    color: '#71938a',
    unlock: [
      {
        id: 'bridge',
        level: 1,
      },
    ],
  },
].map((building) => ({
  ...building,
  stages: [
    'Empty plot',
    ...[1, 2, 3].map((level) => `${ERA_BY_ID[building.introducedEra].label} · Level ${level}`),
  ],
  upgrades: [1, 2, 3].map((level, index) => ({
    cost: cityBuildingPrice(
      building.id,
      eraEvolution(building.introducedEra).newBuildingPrices[index],
    ),
    runs: isMajorCityBuilding(building.id) && index === 0 ? 2 : 1,
    title: index ? 'Expand {building}' : 'Build {building}',
    benefit: cityBenefit(building.effects, level),
    story: cityBenefit(building.effects, level),
    speaker: 'Ada · the caretaker',
  })),
}));
export const cityVariant = (kind, era) =>
  ['airport', 'radio', 'concert', 'television', 'skyline'].includes(CITY_FAMILIES[kind])
    ? 'Renew the landmark with improved facilities and city lighting.'
    : (eraEvolution(era).cityDescription ?? CITY_DESCRIPTIONS[CITY_FAMILIES[kind]]?.[0]);
