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
};

// The space-helmet easter egg debuts on the village dog in Tomorrow City and moves
// to the next wearer in each later era, so players have to find its new animal.
// Every wearer is a ground species the era casts keep; the list wraps around.
export const SPACE_HELMET = {
  debut: 'tomorrow',
  wearers: ['dog', 'cat', 'fox', 'raccoon', 'hedgehog', 'otter', 'deer', 'hen'],
  // Suit colors for wearers whose own coat would hide the white suit.
  suits: { hen: '#e5873a' },
  // Finding the wearer pays this share of an hour of saloon takings: a full hour in the
  // owner's own town, half an hour to a visitor's own town.
  rewardHours: { owner: 1, visitor: 0.5 },
};

// Each profile adds to the previous cast. Stable species seeds keep existing
// visitors and birds when another era introduces a new neighbor.
const standard = {
  birds: [{ species: 'pigeon', count: 3, seed: 71 }],
  garden: [],
  companions: null,
};
const meadow = { ...standard, garden: ['deer'] };
const riverside = { ...meadow, garden: [...meadow.garden, 'otter'] };
const neighborhood = { ...riverside, garden: [...riverside.garden, 'hedgehog'] };
const songbirds = {
  ...neighborhood,
  birds: [...neighborhood.birds, { species: 'bluebird', count: 2, seed: 211 }],
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
