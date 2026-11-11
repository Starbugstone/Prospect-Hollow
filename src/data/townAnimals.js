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
    { coat: '#8497a7', light: '#b2bec4', size: 1 },
    { coat: '#e9e5dc', light: '#f5f2ea', size: 0.95 },
    { coat: '#9a8474', light: '#c9b8a6', size: 1 },
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

// Each profile adds to the previous cast. Stable species seeds keep existing
// visitors and birds when another era introduces a new neighbor.
const standard = {
  birds: [{ species: 'pigeon', count: 3, maxCount: 8, seed: 71 }],
  garden: [],
  companions: null,
};
const meadow = { ...standard, garden: ['deer'] };
const riverside = { ...meadow, garden: [...meadow.garden, 'otter'] };
const neighborhood = { ...riverside, garden: [...riverside.garden, 'hedgehog'] };
const songbirds = {
  ...neighborhood,
  birds: [...neighborhood.birds, { species: 'bluebird', count: 2, maxCount: 5, seed: 211 }],
};
export const TOWN_FAUNA = {
  standard,
  meadow,
  riverside,
  neighborhood,
  songbirds,
  garden: {
    ...songbirds,
    companions: { species: 'willowkin', mode: 'garden' },
  },
  'garden-town': {
    ...songbirds,
    companions: { species: 'willowkinResident', mode: 'street' },
  },
};
export const townFauna = (profile) =>
  Object.hasOwn(TOWN_FAUNA, profile?.wildlife) ? TOWN_FAUNA[profile.wildlife] : TOWN_FAUNA.standard;
export const flyingAnimal = (species) => !!TOWN_ANIMALS[species]?.flying;

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
