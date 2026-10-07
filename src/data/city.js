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
  ['airport', 'skyline', 'cityHomes', 'skyPods', 'spaceElevator', 'ribbonLanding'].includes(id);
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

// Skyward quarter beyond the railway, and the space elevator beside the mine. They
// share the garden district's parcel, construction and service lifecycle.
const skywardBuildings = [
  {
    id: 'skyHarbour',
    name: 'Prospect sky harbour',
    shortName: 'Sky harbour',
    purpose: 'Airships and kite-sail gliders moor above the valley',
    introducedEra: 'skysail',
    family: 'station',
    effects: { visitors: 4, comfort: 2 },
    color: '#e8a64a',
  },
  {
    id: 'cloudOrchard',
    name: 'Drifting cloud orchard',
    shortName: 'Cloud orchard',
    purpose: 'Willowkin gardeners tend fruit trees on little floating islands',
    introducedEra: 'skysail',
    family: 'farm',
    effects: { food: 4, water: 4, comfort: 1 },
    color: '#e8a64a',
  },
  {
    id: 'windsongLofts',
    name: 'Windsong lofts',
    shortName: 'Windsong lofts',
    purpose: 'Breezy homes under sailcloth roofs',
    introducedEra: 'skysail',
    family: 'residence',
    effects: { housing: 4, comfort: 1 },
    color: '#e8a64a',
  },
  {
    id: 'greatTelescope',
    name: 'Great telescope and planetarium',
    shortName: 'Great telescope',
    purpose: 'Watch the night sky together and find our crystals on the Moon',
    introducedEra: 'stargazer',
    family: 'research',
    effects: { visitors: 4, comfort: 2 },
    color: '#3f4f84',
  },
  {
    id: 'dewlightGardens',
    name: 'Dewlight gardens',
    shortName: 'Dewlight gardens',
    purpose: 'Willowkin night gardens that gather dew and grow by starlight',
    introducedEra: 'stargazer',
    family: 'farm',
    effects: { food: 4, water: 4, comfort: 1 },
    color: '#3f4f84',
  },
  {
    id: 'starlightTerraces',
    name: 'Starlight terraces',
    shortName: 'Starlight terraces',
    purpose: 'Homes with a rooftop dome for every family',
    introducedEra: 'stargazer',
    family: 'residence',
    effects: { housing: 4, comfort: 1 },
    color: '#3f4f84',
  },
  {
    id: 'spaceElevator',
    name: 'Hollow space elevator',
    shortName: 'Space elevator',
    purpose: 'A silver ribbon carrying supplies and Willowkin seedlings to the Moon',
    introducedEra: 'moonward',
    family: 'station',
    effects: { visitors: 6, comfort: 3 },
    color: '#e8b84a',
    unlock: [{ id: 'railDepot', level: 1 }],
  },
  {
    id: 'moonpost',
    name: 'Moonpost office',
    shortName: 'Moonpost',
    purpose: 'Letters and parcels between Prospect Hollow and the Moon',
    introducedEra: 'moonward',
    family: 'civic',
    effects: { visitors: 2, comfort: 2 },
    color: '#e8b84a',
  },
  {
    id: 'missionHomesteads',
    name: 'Mission homesteads',
    shortName: 'Mission homesteads',
    purpose: 'Homes for the families of our Moon crews',
    introducedEra: 'moonward',
    family: 'residence',
    effects: { housing: 4, comfort: 1 },
    color: '#e8b84a',
  },
].map((building) => ({
  unlock: [{ id: 'bridge', level: 1 }],
  ...building,
  kind: building.id,
}));
for (const building of skywardBuildings) CITY_FAMILIES[building.kind] = building.family;

// Twin Hollows: the homecoming hall in the valley, and New Hollow on the Moon.
// Moon buildings share every lifecycle (offers, construction, needs, saves) but
// stand on the Moon map instead of a valley lot.
const twinBuildings = [
  {
    id: 'homecomingHall',
    name: 'Homecoming hall',
    shortName: 'Homecoming hall',
    purpose: 'Where families welcome their Moon crews home',
    family: 'culture',
    effects: { visitors: 4, comfort: 3 },
  },
  {
    id: 'ribbonLanding',
    name: 'Ribbon landing',
    shortName: 'Ribbon landing',
    purpose: 'The Moon end of the ribbon, where climbers unload',
    family: 'station',
    effects: { visitors: 4, comfort: 1 },
  },
  {
    id: 'settlerDomes',
    name: 'Settler domes',
    shortName: 'Settler domes',
    purpose: 'Snug glass-roofed homes for the first Moon families',
    family: 'residence',
    effects: { housing: 6, comfort: 1 },
  },
  {
    id: 'craterIceWell',
    name: 'Crater ice well',
    shortName: 'Ice well',
    purpose: 'Melts crater ice into fresh water for New Hollow',
    family: 'water',
    effects: { water: 12, comfort: 1 },
  },
  {
    id: 'earthlightGreenhouse',
    name: 'Earthlight greenhouse',
    shortName: 'Greenhouse',
    purpose: 'Valley seeds grow under the glow of Earth',
    family: 'farm',
    effects: { food: 12, comfort: 1 },
  },
  {
    id: 'willowkinDome',
    name: 'Willowkin garden dome',
    shortName: 'Willowkin dome',
    purpose: 'The first Willowkin born on the Moon grow up under glass',
    family: 'culture',
    effects: { visitors: 2, comfort: 2 },
  },
  {
    id: 'newHollowCommons',
    name: 'New Hollow commons',
    shortName: 'Commons',
    purpose: 'A meeting hall for the whole Moon settlement',
    family: 'civic',
    effects: { visitors: 2, comfort: 2 },
  },
  {
    id: 'craterHomesteads',
    name: 'Crater homesteads',
    shortName: 'Crater homesteads',
    purpose: 'Frontier homes along the crater rim',
    family: 'residence',
    effects: { housing: 6, comfort: 1 },
  },
  {
    id: 'moonstoneWorkshop',
    name: 'Moonstone workshop',
    shortName: 'Moonstone workshop',
    purpose: 'Polishes moonstone keepsakes to send home',
    family: 'research',
    effects: { visitors: 2, comfort: 1 },
  },
  {
    id: 'roverBarn',
    name: 'Rover barn',
    shortName: 'Rover barn',
    purpose: 'Friendly rovers for crater picnics and ice runs',
    family: 'depot',
    effects: { comfort: 2 },
  },
  {
    id: 'earthriseLookout',
    name: 'Earthrise lookout',
    shortName: 'Earthrise lookout',
    purpose: 'Watch the valley rise over the crater rim',
    family: 'culture',
    effects: { visitors: 2, comfort: 2 },
  },
].map(({ id, ...building }) => ({
  id,
  kind: id,
  introducedEra: 'twin-hollows',
  color: '#8fa0b8',
  ...building,
  ...(id === 'homecomingHall'
    ? { unlock: [{ id: 'bridge', level: 1 }] }
    : { settlement: 'moon', unlock: [{ id: 'spaceElevator', level: 1 }] }),
}));
for (const building of twinBuildings) CITY_FAMILIES[building.kind] = building.family;
/** Whether a building stands on the Moon map instead of a valley lot. */
export const isMoonBuilding = (id) =>
  twinBuildings.some((building) => building.id === id && building.settlement === 'moon');

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
  ...skywardBuildings,
  ...twinBuildings,
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
