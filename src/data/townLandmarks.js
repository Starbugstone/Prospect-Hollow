import { ERAS } from './eras';

// One optional monument site per era. A site's first monument is permanent. Saved
// IDs and prices are authoritative for both clients and the server
// (export-public-content). No monument gates an era.
const option = (id, label, form, colour, price, detail) => ({
  id,
  label,
  form,
  colour,
  price,
  detail,
});
export const LANDMARK_OPTIONS = [
  option(
    'roundhouse',
    'Timber Roundhouse',
    'rotunda',
    '#b77839',
    600,
    'A broad timber hall with a crown of lanterns.',
  ),
  option(
    'windgarden',
    'Wind Garden',
    'windmill',
    '#658c68',
    800,
    'A tall wind tower surrounded by terraced gardens.',
  ),
  option(
    'longhall',
    'Founders’ Longhall',
    'hall',
    '#9f4f48',
    700,
    'Twin gables, deep porches and a welcoming courtyard.',
  ),
  option(
    'tideclock',
    'Tide Clock',
    'clock',
    '#367673',
    1600,
    'A copper clock tower with riverside arcades.',
  ),
  option(
    'exchange',
    'Merchant Exchange',
    'arcade',
    '#b77839',
    1800,
    'An open market court beneath striped vaulted roofs.',
  ),
  option(
    'beacon',
    'River Beacon',
    'beacon',
    '#41658f',
    2000,
    'A white stepped lighthouse with a brilliant lantern.',
  ),
  option(
    'founders-arch',
    'Founders’ Arch',
    'arch',
    '#ddd1b5',
    6000,
    'A monumental stone gateway and bronze sun.',
  ),
  option(
    'crystal-spire',
    'Crystal Spire',
    'crystal',
    '#9b91c4',
    8000,
    'A soaring cluster of violet and turquoise crystals.',
  ),
  option(
    'guardian',
    'Guardian of the Hollow',
    'guardian',
    '#cc954f',
    10000,
    'A great bronze owl watching over the town.',
  ),
  option(
    'world-tree',
    'World Tree',
    'tree',
    '#658c68',
    12000,
    'A sculpted copper tree on a ring of pale stone.',
  ),
  option(
    'celestial-sphere',
    'Celestial Sphere',
    'orrery',
    '#41658f',
    15000,
    'Golden orbital rings suspended above a star court.',
  ),
  option(
    'amphitheatre',
    'Sunrise Amphitheatre',
    'theatre',
    '#bd705f',
    2800,
    'Sweeping tiers around an open performance stage.',
  ),
  option(
    'conservatory',
    'Grand Conservatory',
    'glass',
    '#367673',
    3000,
    'Three glass domes connected by planted galleries.',
  ),
  option(
    'library-hall',
    'Lantern Library',
    'hall',
    '#7b6caa',
    3200,
    'A tall reading hall with luminous bay windows.',
  ),
  option(
    'starlight',
    'Starlight Rotunda',
    'rotunda',
    '#bd705f',
    4000,
    'A circular landmark with a bold tiered crown.',
  ),
  option(
    'autocourt',
    'Chrome Pavilion',
    'arcade',
    '#367673',
    4300,
    'Long streamlined canopies around a sunken court.',
  ),
  option(
    'clock-gardens',
    'Clock Gardens',
    'clock',
    '#cc954f',
    4500,
    'An elegant clock above geometric garden terraces.',
  ),
  option(
    'skyhall',
    'Sky Hall',
    'wing',
    '#41658f',
    5500,
    'A wing-shaped roof rising above an open concourse.',
  ),
  option(
    'planetarium',
    'Star Dome',
    'dome',
    '#7b6caa',
    5800,
    'A deep blue dome with a slender telescope tower.',
  ),
  option(
    'sky-beacon',
    'Sky Beacon',
    'beacon',
    '#367673',
    6000,
    'A sculptural observation tower with stacked viewing decks.',
  ),
  option(
    'music-shell',
    'Music Shell',
    'theatre',
    '#bd705f',
    7000,
    'A fan-shaped concert shell and broad audience terraces.',
  ),
  option(
    'broadcast-spire',
    'Signal Spire',
    'spire',
    '#41658f',
    7500,
    'An open lattice tower crowned with signal rings.',
  ),
  option(
    'arts-forum',
    'Arts Forum',
    'arcade',
    '#9b91c4',
    7200,
    'Colourful exhibition halls around a sculpture court.',
  ),
  option(
    'wave-centre',
    'Wave Centre',
    'wing',
    '#52948e',
    9000,
    'Overlapping wave roofs above tall glass walls.',
  ),
  option(
    'city-atrium',
    'City Atrium',
    'glass',
    '#41658f',
    9500,
    'A great glazed winter garden with three luminous domes.',
  ),
  option(
    'garden-steps',
    'Terrace House',
    'terraces',
    '#658c68',
    10000,
    'A stepped civic garden with planted roof terraces.',
  ),
  option(
    'orbit-house',
    'Orbit House',
    'dome',
    '#9b91c4',
    12000,
    'Floating circular galleries around a star dome.',
  ),
  option(
    'solar-crown',
    'Solar Crown',
    'spire',
    '#cc954f',
    12500,
    'A slender solar tower with a wide radiant crown.',
  ),
  option(
    'future-forum',
    'Horizon Forum',
    'rotunda',
    '#52948e',
    13000,
    'A circular colonnade topped by a suspended halo.',
  ),
  option(
    'living-tower',
    'Living Tower',
    'terraces',
    '#658c68',
    15000,
    'Generous garden terraces climbing towards the sky.',
  ),
  option(
    'canopy-house',
    'Canopy Hall',
    'wing',
    '#8caf80',
    16000,
    'Three leaf-shaped roofs shelter an open garden hall.',
  ),
  option(
    'seed-vault',
    'Seed Cathedral',
    'glass',
    '#b77839',
    15500,
    'A luminous glass sanctuary of domes and planted aisles.',
  ),
  option(
    'river-palace',
    'River Palace',
    'hall',
    '#367673',
    19000,
    'Copper towers and water-blue roofs above a grand entrance.',
  ),
  option(
    'light-garden',
    'Garden of Light',
    'spire',
    '#9b91c4',
    20000,
    'Crystal towers joined by floating luminous rings.',
  ),
  option(
    'lotus-forum',
    'Lotus Forum',
    'rotunda',
    '#bd705f',
    21000,
    'A petal-coloured civic rotunda with a generous open court.',
  ),
];
export const LANDMARK_BY_ID = Object.fromEntries(LANDMARK_OPTIONS.map((o) => [o.id, o]));
const plots = [
  ['meadow', 'Founders’ Meadow', [-17, 38], ['roundhouse', 'windgarden', 'longhall']],
  ['river-court', 'River Court', [4, 38], ['tideclock', 'exchange', 'beacon']],
  [
    'monument',
    'Monument Square',
    [-6, 61],
    ['founders-arch', 'crystal-spire', 'guardian', 'world-tree', 'celestial-sphere'],
  ],
  ['commons', 'Civic Commons', [45, 47], ['amphitheatre', 'conservatory', 'library-hall']],
  ['motor-court', 'Promenade', [-28, 61], ['starlight', 'autocourt', 'clock-gardens']],
  ['outlook', 'Sky Outlook', [65, 47], ['skyhall', 'planetarium', 'sky-beacon']],
  ['arts-court', 'Arts Quarter', [-28, 82], ['music-shell', 'broadcast-spire', 'arts-forum']],
  ['city-court', 'City Gardens', [-6, 84], ['wave-centre', 'city-atrium', 'garden-steps']],
  ['horizon', 'Horizon Park', [15, 84], ['orbit-house', 'solar-crown', 'future-forum']],
  ['canopy-court', 'Canopy Grove', [65, 69], ['living-tower', 'canopy-house', 'seed-vault']],
  ['light-court', 'Riverlight Court', [87, 73], ['river-palace', 'light-garden', 'lotus-forum']],
];
export const PERSONAL_AREAS = plots.map(([id, label, position, choices], index) => ({
  id,
  label,
  era: ERAS[index].id,
  positions: [position],
  choices,
  radius: id === 'monument' ? 9 : 7,
  timeless: id === 'monument',
}));
export const areaUnlocked = (town, area) =>
  ERAS.findIndex((e) => e.id === town.era) >= ERAS.findIndex((e) => e.id === area.era);
export const areaMaximum = (town, area) =>
  areaUnlocked(town, area)
    ? area.timeless
      ? 1
      : 3 *
        (1 + ERAS.findIndex((e) => e.id === town.era) - ERAS.findIndex((e) => e.id === area.era))
    : 0;
export const areaCapacity = (area) => areaMaximum({ era: ERAS.at(-1)?.id }, area);
export const areaStage = (town, area) =>
  areaUnlocked(town, area) && town.personalisation?.areas?.[area.id]?.[0]
    ? town.personalisation.areaLevels?.[area.id] || 1
    : 0;
export const AREA_BY_ID = Object.fromEntries(PERSONAL_AREAS.map((a) => [a.id, a]));
// The monument standing on a site, or null while the site waits for one.
export const areaChoice = (town, area) => {
  const choice = town.personalisation?.areas?.[area.id]?.[0];
  return area.choices.includes(choice) ? choice : null;
};
// Every site keeps the monument first built there. Timeless monuments never grow;
// the others take three stages per era without ever becoming another design.
export function landmarkOffer(town, area, choice) {
  if (!area || !areaUnlocked(town, area) || !area.choices.includes(choice)) return null;
  const current = town.personalisation?.areas?.[area.id]?.[0];
  const stage = areaStage(town, area);
  if (current && (area.timeless || current !== choice || stage >= areaMaximum(town, area)))
    return null;
  const level = area.timeless ? 1 : stage + 1;
  const price = LANDMARK_BY_ID[choice].price * (current ? 1 + Math.floor((level - 1) / 3) : 1);
  return { choice, level, price, expectedChoice: current || null, expectedLevel: stage };
}
export function purchaseLandmark(town, command) {
  const area = PERSONAL_AREAS.find((a) => a.id === command.id);
  const offer = landmarkOffer(town, area, command.value);
  if (
    !offer ||
    command.slot !== 0 ||
    command.expectedChoice !== offer.expectedChoice ||
    command.expectedLevel !== offer.expectedLevel ||
    town.coins < offer.price
  )
    return null;
  return {
    ...town,
    coins: town.coins - offer.price,
    personalisation: {
      ...town.personalisation,
      areas: { ...town.personalisation?.areas, [area.id]: [offer.choice] },
      areaLevels: { ...town.personalisation?.areaLevels, [area.id]: offer.level },
    },
  };
}
