import { ERAS } from './eras';

// Optional monument sites open every other era, alongside the timeless Monument
// Square. Each era site offers three designs drawn from what that era brings to the
// town, and every design has its own silhouette. A site's first monument is
// permanent. Saved IDs and prices are authoritative for both clients and the server
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
  // Frontier: the mine, the first farms and the founders' settlement.
  option(
    'headframe',
    'Prospectors’ Headframe',
    'headframe',
    '#8a5a34',
    600,
    'A timber headframe and winding wheel above a cart of the first crystals.',
  ),
  option(
    'windgarden',
    'Wind Garden',
    'windpump',
    '#658c68',
    800,
    'A many-bladed windpump lifting water for the first farm gardens.',
  ),
  option(
    'longhall',
    'Founders’ Longhall',
    'hall',
    '#9f4f48',
    700,
    'Twin gables, deep porches and a welcoming courtyard.',
  ),
  // Monument Square: timeless designs for the heart of the Hollow.
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
  // Motor Age: the bus, roadside treats and the open road.
  option(
    'filling-station',
    'Sunburst Filling Station',
    'station',
    '#bd705f',
    4000,
    'Art Deco pumps beneath a canopy crowned with a golden sunburst.',
  ),
  option(
    'autocourt',
    'Chrome Diner',
    'diner',
    '#367673',
    4300,
    'A streamlined roadside diner with chrome bands and a tall neon pylon.',
  ),
  option(
    'clock-gardens',
    'Terminus Clock',
    'clock',
    '#cc954f',
    4500,
    'A stepped Art Deco clock tower where the first bus line turns for home.',
  ),
  // Music & Television: the concert hall, the studios and the bright screens.
  option(
    'music-shell',
    'Music Shell',
    'theatre',
    '#bd705f',
    7000,
    'A fan-shaped concert shell and broad audience terraces.',
  ),
  option(
    'big-screen',
    'Big Screen',
    'screen',
    '#41658f',
    7200,
    'A giant outdoor television in colour, flanked by speaker stacks.',
  ),
  option(
    'broadcast-spire',
    'Signal Spire',
    'spire',
    '#41658f',
    7500,
    'An open lattice broadcast mast crowned with signal rings.',
  ),
  // Tomorrow City: solar domes, maglev pods and garden rings.
  option(
    'orbit-house',
    'Orbit House',
    'dome',
    '#41658f',
    12000,
    'A solar dome with a slender telescope above its colonnade.',
  ),
  option(
    'solar-crown',
    'Solar Crown',
    'solar',
    '#cc954f',
    12500,
    'A slender tower opening a wide crown of solar petals over a garden ring.',
  ),
  option(
    'maglev-loop',
    'Maglev Loop',
    'loop',
    '#52948e',
    13000,
    'A glowing test loop where a quiet maglev pod is on show.',
  ),
  // Riverlight: crystal glass, warm springs and soft lanterns.
  option(
    'spring-terraces',
    'Warm Spring Terraces',
    'springs',
    '#76b0a6',
    19000,
    'Round pools of warm spring water stepping down between lanterns.',
  ),
  option(
    'light-garden',
    'Garden of Light',
    'glass',
    '#9b91c4',
    20000,
    'Lavender crystal-glass domes that gather daylight over a winter garden.',
  ),
  option(
    'lotus-forum',
    'Lotus Pavilion',
    'lotus',
    '#bd705f',
    21000,
    'Pearl petal roofs on slender columns, hung with amber lanterns.',
  ),
  // Stargazer: Stargazers' Lawn.
  option(
    'orbit-garden',
    'Orrery Garden',
    'orbits',
    '#3f4f84',
    25000,
    'A ring of hedges where brass planets circle a golden sun.',
  ),
  option(
    'comet-arch',
    'Comet Arch',
    'comet',
    '#9c86d0',
    26000,
    'A slender arch with a comet and its starry tail streaming over the lawn.',
  ),
  option(
    'aurora-dome',
    'Aurora Dome',
    'aurora',
    '#5fb8a8',
    27000,
    'A glass dome under ribbons of aurora light.',
  ),
  // Twin Hollows: Homecoming Green.
  option(
    'lantern-walk',
    'Twin-lantern Walk',
    'lantern-walk',
    '#3f8f8a',
    31000,
    'An avenue of twin lanterns, one for the valley and one for the Moon.',
  ),
  option(
    'globe-garden',
    'Earth and Moon Garden',
    'globes',
    '#4f8fc7',
    32000,
    'A fountain garden where a little Earth and Moon share one pool.',
  ),
  option(
    'welcome-arch',
    'Family Welcome Arch',
    'welcome-arch',
    '#b88757',
    33000,
    'A homecoming arch with banners and a bench for waiting families.',
  ),
];
export const LANDMARK_BY_ID = Object.fromEntries(LANDMARK_OPTIONS.map((o) => [o.id, o]));
// Only Monument Square stands before the town. Every other site lies beyond the
// railway: two rows behind the mine ridge and a column west of the airport's
// approach, clear of the space elevator. Stargazers' Lawn and Homecoming Green
// sit beyond the Skyward quarter.
const plots = [
  ['meadow', 'frontier', 'Founders’ Meadow', [-4, -60], ['headframe', 'windgarden', 'longhall']],
  [
    'monument',
    'industrial',
    'Monument Square',
    [-6, 61],
    ['founders-arch', 'crystal-spire', 'guardian', 'world-tree', 'celestial-sphere'],
  ],
  [
    'motor-court',
    'motor-age',
    'Promenade',
    [-70, -40],
    ['filling-station', 'autocourt', 'clock-gardens'],
  ],
  [
    'arts-court',
    'broadcast',
    'Arts Quarter',
    [-4, -80],
    ['music-shell', 'big-screen', 'broadcast-spire'],
  ],
  [
    'horizon',
    'tomorrow',
    'Horizon Park',
    [-39, -80],
    ['orbit-house', 'solar-crown', 'maglev-loop'],
  ],
  [
    'light-court',
    'riverlight',
    'Riverlight Court',
    [14, -80],
    ['spring-terraces', 'light-garden', 'lotus-forum'],
  ],
  [
    'stargazer-lawn',
    'stargazer',
    'Stargazers’ Lawn',
    [80, -80],
    ['orbit-garden', 'comet-arch', 'aurora-dome'],
  ],
  [
    'homecoming-green',
    'twin-hollows',
    'Homecoming Green',
    [48, -80],
    ['lantern-walk', 'globe-garden', 'welcome-arch'],
  ],
];
export const PERSONAL_AREAS = plots.map(([id, era, label, position, choices]) => ({
  id,
  label,
  era,
  positions: [position],
  choices,
  radius: id === 'monument' ? 9 : 7,
  timeless: id === 'monument',
}));
export const areaUnlocked = (town, area) =>
  ERAS.findIndex((e) => e.id === town.era) >= ERAS.findIndex((e) => e.id === area.era);
// Five permanent milestones; era growth never adds another bill.
export const LANDMARK_PROGRESSION = Object.freeze({
  version: 2,
  animationLevel: 3,
  // Preserve historical paid levels in saves/receipts, while displaying at most five.
  legacyLimit: 45,
  levels: [
    { label: 'Foundation', multiplier: 1, detail: 'Establish the monument on its stone court.' },
    {
      label: 'Grand court',
      multiplier: 4,
      detail: 'Raise the main structure and build its flanking pavilions.',
    },
    {
      label: 'Living landmark',
      multiplier: 10,
      detail: 'Unveil the working centerpiece and ceremonial lamps.',
    },
    {
      label: 'Great monument',
      multiplier: 20,
      detail: 'Add a monumental colonnade and a taller silhouette.',
    },
    {
      label: 'Town wonder',
      multiplier: 35,
      detail: 'Complete the grand entrance, golden finials and fountain court.',
    },
  ],
});
export const landmarkLevel = (stage) =>
  LANDMARK_PROGRESSION.levels[
    Math.max(0, Math.min(LANDMARK_PROGRESSION.levels.length - 1, stage - 1))
  ];
// A monument is built once and retains its selected design.
export const areaMaximum = (town, area) => (areaUnlocked(town, area) ? areaCapacity(area) : 0);
const areaCapacity = (area) => (area.timeless ? 1 : LANDMARK_PROGRESSION.levels.length);
// Historical paid stages remain saved; their visible model caps at the final milestone.
export const areaStage = (town, area) =>
  areaUnlocked(town, area) && town.personalisation?.areas?.[area.id]?.[0]
    ? Math.min(town.personalisation.areaLevels?.[area.id] || 1, areaMaximum(town, area))
    : 0;
export const AREA_BY_ID = Object.fromEntries(PERSONAL_AREAS.map((a) => [a.id, a]));
// The monument standing on a site, or null while the site waits for one.
export const areaChoice = (town, area) => {
  const choice = town.personalisation?.areas?.[area.id]?.[0];
  return area.choices.includes(choice) ? choice : null;
};
// Each site keeps its first choice. Timeless masterpieces are complete on purchase.
export function landmarkOffer(town, area, choice) {
  if (!area || !areaUnlocked(town, area) || !area.choices.includes(choice)) return null;
  const current = town.personalisation?.areas?.[area.id]?.[0];
  const stage = areaStage(town, area);
  if (current && (area.timeless || current !== choice || stage >= areaMaximum(town, area)))
    return null;
  const level = area.timeless ? 1 : stage + 1;
  const price =
    LANDMARK_BY_ID[choice].price * (area.timeless ? 1 : landmarkLevel(level).multiplier);
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
