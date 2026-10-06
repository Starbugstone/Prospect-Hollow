// Original, small vector emblems shared by the editor and the hill banner.
// All paths use a 24 × 24 view box. No fonts, uploads or external images.
const animals = {
  fox: ['Fox', 'M4 3 10 7H14L20 3 19 15 12 21 5 15ZM5 10 10 14M19 10 14 14M10 17H14L12 19Z'],
  wolf: [
    'Wolf',
    'M4 3 9 7 12 5 15 7 20 3 19 14 15 19 12 22 9 19 5 14ZM7 11 10 13M17 11 14 13M10 17H14',
  ],
  cat: [
    'Cat',
    'M4 4 9 8Q12 6 15 8L20 4V16Q12 23 4 16ZM8 12H9M15 12H16M10 16 12 18 14 16M2 14 7 15M17 15 22 14',
  ],
  dog: [
    'Dog',
    'M8 5Q12 3 16 5L20 4 22 12 18 14 17 19Q12 23 7 19L6 14 2 12 4 4ZM8 5 6 14M16 5 18 14M8 11H9M15 11H16M10 16H14L12 18Z',
  ],
  bear: [
    'Bear',
    'M5 8C-1 4 7-1 9 5Q12 3 15 5C17-1 25 4 19 8C24 23 0 23 5 8ZM8 11H9M15 11H16M9 16Q12 12 15 16L12 19Z',
  ],
  rabbit: [
    'Rabbit',
    'M7 10C-1-6 12-1 10 9H14C12-1 25-6 17 10C25 22-1 22 7 10ZM8 14H9M15 14H16M11 18H13',
  ],
  owl: [
    'Owl',
    'M4 3 8 7H16L20 3V14Q20 21 12 22 4 21 4 14ZM6 11A3 3 0 1 0 12 11A3 3 0 1 0 6 11M12 11A3 3 0 1 0 18 11A3 3 0 1 0 12 11M10 16 12 19 14 16',
  ],
  eagle: [
    'Eagle',
    'M2 5 10 10 12 6 14 10 22 5 19 13 15 15 14 21 12 18 10 21 9 15 5 13ZM12 6 16 7 14 9',
  ],
  swallow: ['Swallow', 'M2 3 11 10 15 7 18 9 22 8 18 12 14 14 12 21 10 16 5 19 8 13Z'],
  deer: [
    'Deer',
    'M8 9 5 6 4 1M5 6 1 4M16 9 19 6 20 1M19 6 23 4M7 8 12 10 17 8 16 17 12 22 8 17ZM9 13H10M14 13H15',
  ],
  horse: [
    'Horse',
    'M7 21 9 14 4 13 5 9 13 3 17 2 16 6Q22 12 19 21ZM13 3 10 2 9 6M10 9H11M9 14 14 12',
  ],
  squirrel: [
    'Squirrel',
    'M10 20C-2 21 0 5 6 4C13 2 14 12 7 12M8 20 8 14 11 10 11 5 15 8 19 9 20 12 16 14 17 20ZM14 11H15',
  ],
  badger: ['Badger', 'M4 5 9 7 12 5 15 7 20 5 19 15 12 21 5 15ZM7 8 10 17M17 8 14 17M10 18H14'],
  hedgehog: [
    'Hedgehog',
    'M2 17 3 11 6 12 6 6 10 8 12 3 15 7 19 5 18 11 23 16 19 20H6ZM17 14H18M7 20V22M17 20V22',
  ],
  otter: [
    'Otter',
    'M6 10C1 5 7 3 9 7H15C17 3 23 5 18 10Q23 19 12 20 1 19 6 10ZM8 12H9M15 12H16M10 16H14M2 15H6M18 15H22',
  ],
  beaver: [
    'Beaver',
    'M6 8Q3 2 8 5Q12 2 16 5Q21 2 18 8C24 21 0 21 6 8ZM8 10H9M15 10H16M9 14H15M10 14V19H14V14M12 14V19',
  ],
  raccoon: [
    'Raccoon',
    'M4 3 9 7H15L20 3 20 14 12 21 4 14ZM5 10 9 9 11 12 8 14ZM19 10 15 9 13 12 16 14ZM10 17H14',
  ],
  panda: [
    'Panda',
    'M5 8C0 6 2 1 6 2L9 5H15L18 2C22 1 24 6 19 8C24 24 0 24 5 8ZM7 10 10 11 9 15 6 14ZM17 10 14 11 15 15 18 14ZM10 17H14',
  ],
  lion: [
    'Lion',
    'M12 1 16 4 20 4 21 9 23 13 20 17 18 21 12 23 6 21 4 17 1 13 3 9 4 4 8 4ZM7 8H17L16 17 12 20 8 17ZM9 11H10M14 11H15M10 16H14',
  ],
  tiger: [
    'Tiger',
    'M4 5 8 6Q12 3 16 6L20 5 19 16 12 21 5 16ZM12 5V10M5 10 9 12M19 10 15 12M5 15 9 15M19 15 15 15M10 17H14',
  ],
  frog: [
    'Frog',
    'M4 11C0 0 12 0 10 9H14C12 0 24 0 20 11Q24 21 12 22 0 21 4 11ZM6 6V7M18 6V7M6 16Q12 20 18 16',
  ],
  turtle: [
    'Turtle',
    'M9 6C7-1 17-1 15 6M6 8 2 6M18 8 22 6M6 18 2 21M18 18 22 21M12 21V23M5 13A7 8 0 1 0 19 13A7 8 0 1 0 5 13M9 9H15L17 14 12 18 7 14Z',
  ],
  fish: ['Fish', 'M3 12Q11 1 19 10L23 6V18L19 14Q11 23 3 12ZM8 9Q11 12 8 15M6 12H7M12 6 14 3 17 8'],
  butterfly: [
    'Butterfly',
    'M12 10C0-5-2 17 10 14C0 19 11 27 12 15C13 27 24 19 14 14C26 17 24-5 12 10ZM12 7V19M12 8 9 3M12 8 15 3',
  ],
  bee: [
    'Bee',
    'M9 9C-2-2-2 16 8 13M15 9C26-2 26 16 16 13M8 12C8 2 16 2 16 12V17L12 22 8 17ZM8 12H16M8 16H16M10 6 8 2M14 6 16 2',
  ],
  dragon: [
    'Dragon',
    'M3 21Q11 20 10 13L5 15 7 8 3 4 11 7 16 2 16 6 21 8 18 12 15 11Q23 23 10 22ZM16 8H17',
  ],
  whale: [
    'Whale',
    'M2 11Q4 5 11 9 17 17 21 8L23 5V14Q20 23 7 20 0 18 2 11ZM6 12H7M10 6V2M10 4 6 2M10 4 14 2',
  ],
  penguin: [
    'Penguin',
    'M6 10Q5 1 12 2 19 1 18 10L22 17 18 16 18 21H6L6 16 2 17ZM9 9H10M14 9H15M10 12 12 14 14 12M8 21V23M16 21V23',
  ],
  rooster: [
    'Rooster',
    'M7 8 8 3 11 5 14 2 16 6 19 8 15 10Q19 20 8 20 1 18 3 10L7 13ZM11 8H12M9 20V23M14 20V23',
  ],
  bat: ['Bat', 'M2 5 9 10 10 5 12 8 14 5 15 10 22 5 21 17 17 14 14 18 12 21 10 18 7 14 3 17Z'],
};
const symbols = {
  crystal: ['Crystal', 'M8 2H16L22 9 12 22 2 9ZM2 9H22M8 2 7 9 12 22 17 9 16 2M7 9H17'],
  pickaxe: ['Pickaxe', 'M3 7Q12-1 21 7L19 9Q12 4 5 9ZM12 6 9 22H13L15 7'],
  mountain: ['Mountain', 'M1 21 9 5 13 12 17 7 23 21ZM6 11 9 13 11 10M14 12 17 14 19 11'],
  tree: ['Tree', 'M12 1 5 9H8L3 15H8L2 20H10V23H14V20H22L16 15H21L16 9H19Z'],
  oak: ['Oak', 'M10 22V15C0 18-1 8 6 7C5-2 18-1 18 7C26 8 24 18 14 15V22ZM8 22H16'],
  sun: [
    'Sun',
    'M8 12A4 4 0 1 0 16 12A4 4 0 1 0 8 12M12 1V4M12 20V23M1 12H4M20 12H23M4 4 6 6M18 18 20 20M4 20 6 18M18 6 20 4',
  ],
  moon: ['Moon', 'M18 2C2-2-3 18 11 22Q19 24 23 15C10 21 5 6 18 2Z'],
  star: ['Star', 'M12 1 15 8 23 9 17 15 19 23 12 19 5 23 7 15 1 9 9 8Z'],
  compass: [
    'Compass',
    'M2 12A10 10 0 1 0 22 12A10 10 0 1 0 2 12M17 7 14 14 7 17 10 10ZM10 10 14 14',
  ],
  hammer: ['Hammer', 'M4 3H18V8H14V22H10V8H4Z'],
  anvil: ['Anvil', 'M2 7H22L18 12H15V17L20 21H4L9 17V12L5 11Z'],
  lantern: ['Lantern', 'M8 5V3Q12-1 16 3V5M6 5H18L16 8V18L19 22H5L8 18V8ZM8 8H16M8 18H16M12 11V15'],
  key: ['Key', 'M3 7A5 5 0 1 0 13 7A5 5 0 1 0 3 7M12 11 22 21M17 16 20 13M20 19 23 16'],
  crown: ['Crown', 'M3 6 8 11 12 3 16 11 21 6 19 20H5ZM5 16H19'],
  heart: ['Heart', 'M12 21C-10 7 8-5 12 6C16-5 34 7 12 21Z'],
  leaf: ['Leaf', 'M3 21C-3 8 10 2 22 2C22 15 16 24 3 21ZM3 21 17 7M8 16V10M8 16H15'],
  flower: [
    'Flower',
    'M9 8C2-1 17-3 15 7C26 1 28 18 17 16C22 27 5 28 8 17C-4 20-2 4 9 8ZM8 12A4 4 0 1 0 16 12A4 4 0 1 0 8 12',
  ],
  acorn: ['Acorn', 'M4 10Q4 3 12 4 20 3 20 10ZM6 10V14Q6 19 12 22 18 19 18 14V10M12 4V1'],
  mushroom: ['Mushroom', 'M2 13C2-2 22-2 22 13ZM9 13 8 22H16L15 13M7 7H8M14 5H15M17 10H18'],
  wheat: [
    'Wheat',
    'M12 23V4M12 9C4 8 4 1 12 7C20 1 20 8 12 9M12 15C3 14 3 7 12 13C21 7 21 14 12 15M12 20C3 20 3 13 12 18C21 13 21 20 12 20',
  ],
  waves: ['Waves', 'M1 6Q4 1 8 6T16 6T24 6M1 12Q4 7 8 12T16 12T24 12M1 18Q4 13 8 18T16 18T24 18'],
  anchor: [
    'Anchor',
    'M9 4A3 3 0 1 0 15 4A3 3 0 1 0 9 4M12 7V22M6 10H18M2 14Q2 22 12 22 22 22 22 14M2 14 1 18M2 14 6 16M22 14 23 18M22 14 18 16',
  ],
  sailboat: ['Sailboat', 'M3 18H22L18 23H6ZM12 1V18M10 3 2 16H10ZM14 6 21 16H14Z'],
  windmill: [
    'Windmill',
    'M9 12 7 23H17L15 12M12 9 4 1 1 4 9 12 20 23 23 20 15 12 23 4 20 1 12 9 1 20 4 23 12 15',
  ],
  book: ['Book', 'M12 5Q7 1 2 3V20Q7 18 12 22 17 18 22 20V3Q17 1 12 5ZM12 5V22'],
  music: [
    'Music',
    'M9 18V4L21 1V16M9 8 21 5M9 18C9 24 0 24 2 19Q4 16 9 18ZM21 16C21 22 12 22 14 17Q16 14 21 16Z',
  ],
  lightning: ['Lightning', 'M13 1 3 14H10L8 23 21 9H13Z'],
  gear: [
    'Gear',
    'M9 2H15L16 6 20 5 23 10 20 13 21 17 16 21 12 19 8 22 3 18 4 14 1 10 4 5 8 6ZM8 12A4 4 0 1 0 16 12A4 4 0 1 0 8 12',
  ],
  bridge: ['Bridge', 'M1 8H23V12H20Q15 12 15 21H9Q9 12 4 12H1ZM3 3V8M8 3V8M16 3V8M21 3V8M1 3H23'],
  infinity: ['Infinity', 'M12 12C-4-7-4 31 12 12C28-7 28 31 12 12Z'],
};
export const CREST_EMBLEMS = Object.entries({ ...animals, ...symbols }).map(
  ([id, [label, path]]) => ({
    id,
    label,
    path,
    category: Object.hasOwn(animals, id) ? 'Animals' : 'Symbols',
  }),
);
export const CREST_EMBLEM_IDS = CREST_EMBLEMS.map(({ id }) => id);
export const CREST_BY_ID = Object.fromEntries(CREST_EMBLEMS.map((entry) => [entry.id, entry]));
export const crestOutline = (shape) =>
  ({
    shield: 'M2 2H98V70Q95 98 50 118Q5 98 2 70Z',
    swallowtail: 'M2 2H98V118L50 92 2 118Z',
    pennant: 'M2 2H98V68L50 118 2 68Z',
    square: 'M2 2H98V118H2Z',
  })[shape] ?? 'M2 2H98V118H2Z';
export const crestPattern = (pattern) =>
  ({
    plain: '',
    split: 'M50 0H100V120H50Z',
    diagonal: 'M0 0H100L0 120Z',
    quartered: 'M0 0H50V60H0ZM50 60H100V120H50Z',
    stripes: 'M0 20H100V40H0ZM0 60H100V80H0ZM0 100H100V120H0Z',
    cross: 'M40 0H60V120H40ZM0 45H100V65H0Z',
  })[pattern] ?? '';
