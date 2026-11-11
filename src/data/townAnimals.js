// Shared ambient cast and habitat content. Era behavior reads evolution capabilities;
// a successor era needs no animal-specific era-name branches or saved state.
export const TOWN_ANIMALS = {
  dog: { name: 'Village dog', speed: 0.85, radius: 0.64, rest: 5, idle: 'sniffing' },
  cat: { name: 'Village cat', speed: 0.65, radius: 0.62, rest: 8, idle: 'grooming' },
  hen: { name: 'Farmyard hen', speed: 0.42, radius: 0.47, rest: 4, idle: 'pecking' },
  pigeon: {
    name: 'Village pigeon',
    speed: 4.5,
    radius: 0.55,
    rest: 10,
    idle: 'pecking',
    flying: true,
  },
  fox: { name: 'Outskirts fox', speed: 0.9, radius: 0.98, rest: 4, idle: 'listening' },
  raccoon: { name: 'Outskirts raccoon', speed: 0.55, radius: 0.98, rest: 6, idle: 'foraging' },
  bluebird: {
    name: 'Garden bluebird',
    speed: 4.5,
    radius: 0.55,
    rest: 10,
    idle: 'pecking',
    flying: true,
  },
  otter: {
    name: 'River otter',
    speed: 0.65,
    radius: 0.82,
    height: 0.7,
    rest: 7,
    idle: 'grooming',
    model: 'garden',
    seed: 281,
    riverbank: 0,
  },
  deer: {
    name: 'Meadow deer',
    speed: 0.85,
    radius: 0.9,
    height: 1.55,
    rest: 8,
    idle: 'listening',
    model: 'garden',
    seed: 312,
    home: [-15, 27],
  },
  hedgehog: {
    name: 'Garden hedgehog',
    speed: 0.32,
    radius: 0.5,
    height: 0.45,
    rest: 6,
    idle: 'foraging',
    model: 'garden',
    seed: 343,
  },
  hare: {
    name: 'Meadow hare',
    speed: 0.95,
    radius: 0.8,
    height: 1.4,
    rest: 5,
    idle: 'listening',
    model: 'garden',
  },
  squirrel: {
    name: 'Woodland squirrel',
    speed: 0.85,
    radius: 0.65,
    height: 0.95,
    rest: 5,
    idle: 'foraging',
    model: 'garden',
  },
  badger: {
    name: 'Woodland badger',
    speed: 0.5,
    radius: 0.75,
    height: 0.85,
    rest: 7,
    idle: 'sniffing',
    model: 'garden',
  },
  // Later newcomers. `riverbank` is how far downstream of the town's edge a waterside
  // animal keeps its stretch of bank (0 to 8: the roaming band ends beyond that); `home`
  // is its patch of the southern verge.
  crow: { name: 'Rooftop crow', speed: 4.5, radius: 0.55, rest: 9, idle: 'pecking', flying: true },
  gull: { name: 'Harbour gull', speed: 4.5, radius: 0.55, rest: 8, idle: 'pecking', flying: true },
  owl: {
    name: 'Observatory owl',
    speed: 4.5,
    radius: 0.55,
    rest: 14,
    idle: 'pecking',
    flying: true,
  },
  duck: {
    name: 'Millpond duck',
    speed: 0.4,
    radius: 0.5,
    height: 0.6,
    rest: 6,
    idle: 'grooming',
    model: 'garden',
    seed: 371,
    riverbank: 3,
  },
  tortoise: {
    name: 'Garden tortoise',
    speed: 0.18,
    radius: 0.55,
    height: 0.5,
    rest: 9,
    idle: 'foraging',
    model: 'garden',
    seed: 389,
    home: [-19, 29],
  },
  heron: {
    name: 'River heron',
    speed: 0.45,
    radius: 0.6,
    height: 1.5,
    rest: 10,
    idle: 'listening',
    model: 'garden',
    seed: 397,
    riverbank: 8,
  },
  peacock: {
    name: 'Park peacock',
    speed: 0.45,
    radius: 0.8,
    height: 1.2,
    rest: 8,
    idle: 'grooming',
    model: 'garden',
    seed: 409,
    home: [-10, 29],
  },
  crane: {
    name: 'Moon crane',
    speed: 0.45,
    radius: 0.6,
    height: 1.5,
    rest: 10,
    idle: 'listening',
    model: 'garden',
    seed: 419,
    riverbank: 5,
  },
  swan: {
    name: 'Twin-water swan',
    speed: 0.4,
    radius: 0.7,
    height: 1,
    rest: 8,
    idle: 'grooming',
    model: 'garden',
    seed: 433,
    riverbank: 7,
  },
  goat: {
    name: 'Hillside goat',
    speed: 0.8,
    radius: 0.7,
    height: 1.2,
    rest: 6,
    idle: 'foraging',
    model: 'garden',
    seed: 443,
    home: [-26, 27],
  },
  lynx: {
    name: 'Quiet lynx',
    speed: 0.8,
    radius: 0.8,
    height: 1,
    rest: 7,
    idle: 'listening',
    model: 'garden',
    seed: 457,
    home: [-6, 28],
  },
  willowkin: {
    name: 'Willowkin sapling',
    speed: 0.5,
    radius: 0.88,
    height: 1.95,
    rest: 9,
    idle: 'tending',
    model: 'garden',
    companion: true,
  },
  willowkinResident: {
    name: 'Willowkin neighbor',
    speed: 0.75,
    radius: 0.65,
    height: 2.05,
    rest: 5,
    idle: 'looking around',
    model: 'garden',
    companion: true,
    resident: true,
  },
  // The wandering pair (the `wanderers` hidden find): an upright raccoon and its Willowkin,
  // one walker on the public sidewalks. Not part of any era's ambient cast.
  wanderers: {
    name: 'Wandering pair',
    speed: 0.5,
    radius: 0.8,
    height: 2.05,
    rest: 5,
    idle: 'looking around',
    model: 'wanderers',
    // Townsfolk rather than animals: no feeding, no helmet, no fleeing from people.
    townsfolk: true,
    resident: true,
  },
};

// Each animal is drawn from one of its species' coats and builds, chosen by its own seed
// and the era's generation: the village dog of 1958 is not the dog of 1865. Colours are
// coat, light markings and dark markings; `form` picks a build where a species has more
// than one, and `size` scales the animal within its navigation envelope.
export const ANIMAL_LOOKS = {
  dog: [
    { form: 'hound', coat: '#c69b6b', light: '#e4c99e', dark: '#96724f', size: 1 },
    { form: 'terrier', coat: '#eee5d2', light: '#f6f0e2', dark: '#9a6b45', size: 0.82 },
    { form: 'collie', coat: '#4a4640', light: '#efe9dc', dark: '#35322e', size: 0.96 },
    { form: 'hound', coat: '#8b6748', light: '#d9c09a', dark: '#5f4633', size: 0.9 },
  ],
  cat: [
    { coat: '#b77e4e', light: '#f0e3cc', dark: '#76543e', size: 1 },
    { coat: '#8f8d86', light: '#e6e2d8', dark: '#5d5b57', size: 0.94 },
    { coat: '#3b3936', light: '#f1ede4', dark: '#2a2927', size: 1 },
    { coat: '#e6d8bd', light: '#f4ecda', dark: '#7a5d49', size: 0.9 },
  ],
  hen: [
    { coat: '#efe2c3', light: '#efe2c3', size: 1 },
    { coat: '#c89560', light: '#efe2c3', size: 1 },
    { coat: '#6d5646', light: '#cdb898', size: 0.94 },
    { form: 'rooster', coat: '#9c5a36', light: '#3f5a55', size: 1 },
  ],
  fox: [
    { coat: '#bd6f3c', light: '#f0dfbb', size: 1 },
    { coat: '#d18a4c', light: '#f5e8cc', size: 0.9 },
    { coat: '#7d7b80', light: '#e3e0da', size: 0.96 },
  ],
  raccoon: [
    { coat: '#908b7d', light: '#d8d2bc', size: 1 },
    { coat: '#a39a85', light: '#e4dcc4', size: 0.9 },
    { coat: '#7c7870', light: '#cfc9b6', size: 0.95 },
  ],
  pigeon: [
    { coat: '#8497a7', light: '#b2bec4', neck: '#649b91', bars: '#526471', size: 1 },
    { coat: '#e9e5dc', light: '#f5f2ea', neck: '#649b91', bars: '#526471', size: 0.95 },
    { coat: '#9a8474', light: '#c9b8a6', neck: '#649b91', bars: '#526471', size: 1 },
  ],
  crow: [
    { coat: '#34363b', light: '#26282c', neck: '#3d4450', size: 1 },
    { coat: '#4a4d52', light: '#2f3136', neck: '#5d6168', size: 0.94 },
  ],
  gull: [
    { coat: '#f3f1ea', light: '#9aa4ad', neck: '#f3f1ea', bars: '#3b3f45', size: 1 },
    { coat: '#ece7da', light: '#b9b3a6', neck: '#ece7da', size: 0.92 },
  ],
  owl: [
    { form: 'owl', coat: '#a9855c', light: '#7d6040', neck: '#ecdcc0', size: 1 },
    { form: 'owl', coat: '#e9e2d2', light: '#c9b592', neck: '#f6f1e6', size: 0.96 },
  ],
  duck: [
    { coat: '#a98863', light: '#e3d5b8', dark: '#3f7358', size: 1 },
    { coat: '#b89a72', light: '#e8dcc2', dark: '#8f7353', size: 0.94 },
    { coat: '#f0ebdc', light: '#f7f3e8', dark: '#f0ebdc', size: 1 },
  ],
  swan: [
    { coat: '#f4f1e8', light: '#fbf9f2', bill: '#d9783c', size: 1 },
    { coat: '#3d3d42', light: '#55555b', bill: '#c9463f', size: 0.96 },
  ],
  heron: [
    { form: 'heron', coat: '#8f9ba3', light: '#e7e6df', dark: '#4d5761', size: 1 },
    { form: 'heron', coat: '#f1eee4', light: '#f8f6ee', dark: '#dcd6c6', size: 0.94 },
  ],
  crane: [
    { form: 'crane', coat: '#eeece4', light: '#f7f5ee', dark: '#3f4247', bill: '#8c8c7a', size: 1 },
    {
      form: 'crane',
      coat: '#b9bcc0',
      light: '#dcdcd6',
      dark: '#55585d',
      bill: '#8c8c7a',
      size: 0.95,
    },
  ],
  tortoise: [
    { coat: '#7c7a4c', light: '#c9b983', dark: '#5d5b3a', size: 1 },
    { coat: '#9a7d52', light: '#d8c79c', dark: '#6f573a', size: 0.84 },
  ],
  peacock: [
    { form: 'train', coat: '#2f6f9c', light: '#4f9a78', dark: '#2c5f6a', size: 1 },
    { form: 'fan', coat: '#2f6f9c', light: '#4f9a78', dark: '#27506e', size: 1 },
    { form: 'train', coat: '#efece2', light: '#f6f3ea', dark: '#d8d2c2', size: 0.95 },
  ],
  goat: [
    { coat: '#e8e0cc', light: '#f4eedf', dark: '#6b5a48', size: 1 },
    { coat: '#8c6a4c', light: '#d6c3a0', dark: '#4e3d30', size: 0.92 },
    { coat: '#55504a', light: '#cfc8b8', dark: '#35322e', size: 0.96 },
  ],
  lynx: [
    { coat: '#c2a47c', light: '#efe4cc', dark: '#5a4636', size: 1 },
    { coat: '#a9a69c', light: '#ecebe4', dark: '#4b4a46', size: 0.94 },
  ],
  bluebird: [
    { coat: '#7296ad', light: '#e8dfc8', size: 1 },
    { coat: '#5d87b5', light: '#e9c9a4', size: 0.95 },
    { coat: '#86a9b3', light: '#f0e6d0', size: 1 },
  ],
  deer: [
    { form: 'doe', coat: '#c79768', light: '#ead6b3', size: 1 },
    { form: 'stag', coat: '#b08257', light: '#e6d2ae', size: 1 },
    { form: 'fawn', coat: '#d0a374', light: '#f1e2c4', size: 0.66 },
  ],
  otter: [
    { coat: '#9c7558', light: '#e6d6b9', size: 1 },
    { coat: '#7f6450', light: '#d9c8ab', size: 0.9 },
  ],
  hedgehog: [
    { coat: '#9a826a', light: '#dfc8a0', dark: '#806953', size: 1 },
    { coat: '#b39b80', light: '#eadbbb', dark: '#8f775f', size: 0.86 },
  ],
  hare: [
    { coat: '#ae9273', light: '#e9ddc6', size: 1 },
    { coat: '#9a9388', light: '#ebe6da', size: 0.92 },
  ],
  squirrel: [
    { coat: '#b77442', light: '#e8cfaa', size: 1 },
    { coat: '#8d8a84', light: '#e6e1d6', size: 0.94 },
  ],
  badger: [
    { coat: '#87867d', light: '#eee4ce', dark: '#454740', size: 1 },
    { coat: '#9a9486', light: '#f1e9d6', dark: '#514f47', size: 0.9 },
  ],
};
const PLAIN_LOOK = Object.freeze({ size: 1 });
/**
 * The look of one animal. A new generation is born every second era, so the cast changes
 * over the centuries while each animal stays itself within an era. An unknown species, or
 * one without looks, keeps its single authored model.
 */
export function animalLook(species, seed = 0, generation = 0) {
  const looks = Object.hasOwn(ANIMAL_LOOKS, species) ? ANIMAL_LOOKS[species] : null;
  if (!looks?.length) return PLAIN_LOOK;
  const index = Math.abs(Math.trunc(seed)) + Math.max(0, Math.trunc(generation));
  return looks[index % looks.length];
}

// The Willowkin grow up with the town. A crown and a leaf colour belong to each one;
// elders appear once saplings planted in the Canopy Age have had a century to grow.
export const WILLOWKIN_CROWNS = ['umbrella', 'blossom', 'plume'];
export const WILLOWKIN_LEAVES = ['era', '#a9b86a', '#c9a24e'];
export const WILLOWKIN_ELDERS_FROM = 'stargazer';
// What a Willowkin neighbor carries in each period, by the era's wardrobe.
export const WILLOWKIN_KEEPSAKES = {
  skysail: 'sail',
  stargazer: 'lantern',
  moonward: 'visor',
  twin: 'twinLights',
  tramline: 'cap',
  listening: 'longScarf',
};

// The space-helmet easter egg debuts on the village dog in Tomorrow City and moves
// to the next wearer in each later era, so players have to find its new animal.
// Every wearer is a ground species the era casts keep; the list wraps around.
export const SPACE_HELMET = {
  debut: 'tomorrow',
  wearers: [
    'dog',
    'cat',
    'fox',
    'raccoon',
    'hedgehog',
    'otter',
    'deer',
    'hen',
    'hare',
    'squirrel',
    'badger',
  ],
  // Suit colors for wearers whose own coat would hide the white suit.
  suits: { hen: '#e5873a' },
  // Finding the wearer pays this share of an hour of saloon takings: a full hour in the
  // owner's own town, half an hour to a visitor's own town.
  rewardHours: { owner: 1, visitor: 0.5 },
};

export const flyingAnimal = (species) => !!TOWN_ANIMALS[species]?.flying;

// Each profile adds to the previous cast. Stable species seeds keep existing
// visitors and birds when another era introduces a new neighbor.
const standard = {
  birds: [{ species: 'pigeon', count: 3, maxCount: 8, seed: 71 }],
  garden: [],
  companions: null,
};
const meadow = { ...standard, garden: ['deer'] };
const riverside = { ...meadow, garden: [...meadow.garden, 'otter'] };
// A newcomer joins the cast it follows as one more bird species or one more wild neighbor.
// The valley only has room for so many: an era keeps the newest `PASSING_NEIGHBORS` of
// them on the ground and the newest in the air, and earlier newcomers move on. Animals
// cast without `joinedBy` (the deer, the otter, the hedgehog, the bluebirds) always stay.
export const PASSING_NEIGHBORS = 3;
const joinedBy = (cast, species, seed) => {
  const passing = cast.passing ?? [];
  if (flyingAnimal(species))
    return {
      ...cast,
      birds: [
        ...cast.birds.filter((bird) => !bird.passing),
        { species, count: 1, maxCount: 2, seed, passing: true },
      ],
    };
  const kept = [...passing, species].slice(-PASSING_NEIGHBORS);
  return {
    ...cast,
    garden: [...cast.garden.filter((neighbor) => !passing.includes(neighbor)), ...kept],
    passing: kept,
  };
};
const rooftops = joinedBy(riverside, 'crow', 233);
const millpond = joinedBy(rooftops, 'duck');
const neighborhood = { ...millpond, garden: [...millpond.garden, 'hedgehog'] };
const songbirds = {
  ...neighborhood,
  birds: [...neighborhood.birds, { species: 'bluebird', count: 2, maxCount: 5, seed: 211 }],
};
const backyards = joinedBy(songbirds, 'tortoise');
const wetland = joinedBy(backyards, 'heron');
const parkland = joinedBy(wetland, 'peacock');
const gardenTown = { ...parkland, companions: { species: 'willowkinResident', mode: 'street' } };
const sailTown = joinedBy(gardenTown, 'gull', 251);
const starTown = joinedBy(sailTown, 'owl', 263);
const moonTown = joinedBy(starTown, 'crane');
const twinTown = joinedBy(moonTown, 'swan');
const tramTown = joinedBy(twinTown, 'goat');
const signalTown = joinedBy(tramTown, 'lynx');
export const TOWN_FAUNA = {
  standard,
  meadow,
  riverside,
  rooftops,
  millpond,
  neighborhood,
  songbirds,
  backyards,
  wetland,
  parkland,
  garden: { ...parkland, companions: { species: 'willowkin', mode: 'garden' } },
  'garden-town': gardenTown,
  'sail-town': sailTown,
  'star-town': starTown,
  'moon-town': moonTown,
  'twin-town': twinTown,
  'tram-town': tramTown,
  'signal-town': signalTown,
};
export const townFauna = (profile) =>
  Object.hasOwn(TOWN_FAUNA, profile?.wildlife) ? TOWN_FAUNA[profile.wildlife] : TOWN_FAUNA.standard;

// Brief ambient encounters, shared by every era that includes these species.
// They never remove an animal or affect the player's town state.
export const ANIMAL_CHASES = [
  { predator: 'dog', prey: ['cat'], range: 3.4, duration: 2.2 },
  { predator: 'fox', prey: ['deer'], range: 4.2, duration: 2.6 },
  { predator: 'cat', prey: ['pigeon', 'bluebird'], range: 3, duration: 1.6 },
];

// Local coordinates of open ground, outside enclosed building shells. More
// habitats can be added here without changing the shared flight/feeding lifecycle.
export const ANIMAL_HABITATS = [
  { building: 'square', point: [0, 0.25, 1.85], feeding: true },
  { building: 'park', point: [0, 0.18, 1.65], feeding: true },
  { building: 'gardenCourt', point: [0, 0.07, 3.2] },
  { building: 'riverPark', point: [0, 0.07, 3.2] },
  { building: 'farm', point: [-0.8, 0.07, 3.1], feeding: true },
  { building: 'home', point: [0.7, 0.07, 3.2], feeding: true },
];

// Wild species living on the quiet verges around monument courts.
export const MONUMENT_WILDLIFE = ['hare', 'squirrel', 'badger'];

// Original wildlife also explores separate outer habitats, not a shared southern lane.
export const EXTERIOR_HABITATS = {
  fox: { id: 'western-verge', positions: [[-63, 14]], radius: 3 },
  raccoon: { id: 'eastern-verge', positions: [[76, 17]], radius: 3 },
  hedgehog: { id: 'northern-verge', positions: [[-25, -24]], radius: 3 },
};
