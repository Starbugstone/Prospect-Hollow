import { eraEvolution } from './eras';
// Four civic projects continue the existing three-stage village progression.
export const MOTOR_AGE_BUILDINGS = [
  [
    'garage',
    'Prospect motor garage',
    'Garage',
    'Tools for the open road',
    '#6f9d98',
    [],
    [
      'Carry two more of each puzzle bonus.',
      'Carry four more of each puzzle bonus.',
      'Carry six more of each puzzle bonus.',
    ],
  ],
  [
    'busDepot',
    'Valley bus station',
    'Bus station',
    'A warm welcome at every stop',
    '#c4aa73',
    [{ id: 'garage', level: 1 }],
    [
      'Room for two more visitors, with food and water.',
      'Room for four more visitors, with food and water.',
      'Room for six more visitors, with food and water.',
    ],
  ],
  [
    'gardenCourt',
    'Maple garden court',
    'Garden court',
    'A sunny place to settle',
    '#b8907d',
    [],
    [
      'Room for six more residents, with food and water.',
      'Room for twelve more residents, with food and water.',
      'Room for eighteen more residents, with food and water.',
    ],
  ],
  [
    'diner',
    'The Sunrise diner',
    'Diner',
    'A little treat after the journey',
    '#af746e',
    [{ id: 'busDepot', level: 1 }],
    [
      'Visitors to the diner raise saloon income by 5%.',
      'Visitors to the diner raise saloon income by 10%.',
      'Visitors to the diner raise saloon income by 15%.',
    ],
  ],
].map(([id, name, shortName, purpose, color, unlock, benefits]) => ({
  id,
  kind: id,
  name,
  shortName,
  purpose,
  color,
  unlock,
  introducedEra: 'motor-age',
  stages: ['Empty plot', 'Motor Age · Level 1', 'Motor Age · Level 2', 'Motor Age · Level 3'],
  upgrades: benefits.map((benefit, index) => ({
    cost: [4320, 6000, 7920][index],
    runs: index ? 2 : 1,
    title: index ? 'Expand {building}' : 'Build {building}',
    benefit,
    story: benefit,
    speaker: 'Ada · the caretaker',
  })),
}));
export const MOTOR_AGE_LEVEL_PRICES = eraEvolution('motor-age').prices;
export const MOTOR_AGE_VARIANTS = {
  cityHall: [
    'Prospect city hall',
    'A civic entrance canopy and stepped frontage welcome the motor-age city.',
  ],
  apartments: [
    'Cedar court apartments',
    'Sunny balconies and a sheltered entrance renew the established courtyard.',
  ],
  supermarket: [
    'Valley food hall',
    'A wide street canopy welcomes deliveries to the cooperative food hall.',
  ],
  waterPlant: [
    'Prospect water plant',
    'A sheltered service wing keeps the established water plant working.',
  ],
  horseField: [
    'Willow heritage horse field',
    'Stone planters and seasonal flowers give the horse field a Motor Age garden frontage.',
  ],
  home: ['Garden street home', 'A sheltered porch and broad windows welcome the afternoon sun.'],
  farm: [
    'Valley market farm',
    'A bright packing shed and larger greenhouse serve the growing town.',
  ],
  well: [
    'Valley water tower',
    'A broad municipal reservoir brings fresh water to the new neighborhood.',
  ],
  square: [
    'Prospect garden square',
    'An Art Deco fountain, cream stone borders and shaded benches brighten the square.',
  ],
  saloon: [
    'The Golden Hour pavilion',
    'A broad sun canopy welcomes neighbors after their journey.',
  ],
  stable: [
    'Town touring garage',
    'A shaded motor courtyard welcomes the same travelers and their touring cars.',
  ],
  sheriff: [
    'Town patrol headquarters',
    'A sheltered entrance and a taller civic sign greet the familiar patrol.',
  ],
  bank: ['Prospect savings hall', 'A cream stone frontage surrounds the trusted village vault.'],
  shop: ['Main street arcade', 'Broad display windows and striped canopies shelter the shops.'],
  museum: [
    'Prospect discovery hall',
    'A stepped entrance and sunlit gallery celebrate every discovery.',
  ],
  armory: [
    'Adventure supply hall',
    'A wide loading canopy keeps the village tools ready for the mine.',
  ],
  fisherman: ['Valley fishing wharf', 'A shaded packing shelter welcomes the daily catch.'],
  blacksmith: ['Prospect repair works', 'A bright service wing keeps the old forge working.'],
  school: ['Garden street school', 'A sunny classroom wing opens onto a sheltered playground.'],
  doctor: [
    'Valley health clinic',
    'A bright entrance and shaded waiting garden welcome every neighbor.',
  ],
  bridge: [
    'Prospect promenade bridge',
    'Cream approach posts and globe lamps welcome walkers across the river.',
  ],
  riverPort: [
    'Valley passenger landing',
    'A sheltered waiting pavilion welcomes the modern river launch.',
  ],
  railDepot: [
    'Prospect grand station',
    'A broad platform canopy and stepped clock frontage welcome the train.',
  ],
  post: ['Valley post hall', 'A sheltered dispatch counter connects the town to the open road.'],
  warehouse: [
    'Valley freight depot',
    'A wider loading bay welcomes road, rail and river deliveries.',
  ],
  hotel: ['Riverside garden hotel', 'A sunny veranda and garden wing welcome the same travelers.'],
  market: ['Prospect covered market', 'A permanent sun canopy shelters the produce stalls.'],
  powerHouse: ['Valley electric works', 'A bright service hall preserves the lights across town.'],
  fireStation: ['Valley fire brigade', 'A broad vehicle bay keeps the familiar brigade ready.'],
  rowHouses: [
    'Lantern garden terrace',
    'Sunny porches and planted borders welcome the established neighbors.',
  ],
  mill: ['Valley craft mill', 'A bright loading canopy keeps the riverside craft alive.'],
};
