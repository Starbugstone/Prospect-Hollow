// First Lights adds civic milestones, not a second resource economy.
export const INDUSTRIAL_BUILDINGS = [
  [
    'powerHouse',
    'Prospect power house',
    'Power house',
    'The first electric lights',
    '#aa795c',
    2400,
    2,
    [],
    'Light the square and main streets. Unlock electric modernization without fuel or upkeep.',
  ],
  [
    'fireStation',
    'Prospect fire station',
    'Fire station',
    'Neighbors looking after neighbors',
    '#b06e58',
    1800,
    1,
    [],
    'The fire brigade responds to small workshop fires. Buildings remain intact; no upkeep is required.',
  ],
  [
    'rowHouses',
    'Lantern row',
    'Row houses',
    'More neighbors on a familiar street',
    '#a38673',
    2600,
    2,
    [{ id: 'powerHouse', level: 1 }],
    'Room for sixteen residents, with spare food and water. Modernize the old town well for more water.',
  ],
  [
    'mill',
    'Riverside light mill',
    'Light mill',
    'A new craft beside the river',
    '#9b8065',
    2200,
    2,
    [
      { id: 'powerHouse', level: 1 },
      { id: 'bridge', level: 1 },
    ],
    'A working mill and loading yard complete the industrial district. No production chains.',
  ],
].map(([id, name, shortName, purpose, color, cost, runs, unlock, benefit]) => ({
  id,
  name,
  shortName,
  purpose,
  color,
  kind: id,
  introducedEra: 'industrial',
  unlock,
  stages: ['Empty plot', 'Industrial · Level 1', 'Industrial · Level 2', 'Industrial · Level 3'],
  upgrades: [1, 2, 3].map((level) => ({
    cost,
    runs: level === 1 ? runs : 2,
    title: level === 1 ? 'Build {building}' : 'Expand {building}',
    benefit:
      id === 'rowHouses'
        ? [
            'Room for six residents, with spare food and water.',
            'Room for twelve residents, with spare food and water.',
            benefit,
          ][level - 1]
        : id === 'fireStation'
          ? [
              'Protect two thirds of the coins at risk from workshop fires.',
              'Protect five sixths of the coins at risk from workshop fires.',
              'Fully protect the town from workshop fire coin losses.',
            ][level - 1]
          : benefit,
    story: benefit,
    speaker: 'Ada · the caretaker',
  })),
}));

export const INDUSTRIAL_VARIANTS = {
  home: ['Electric town house', 'Brick foundations, sheltered windows and a welcoming porch.'],
  farm: ['Industrial farmstead', 'A taller silo and equipment shelter serve the same fields.'],
  well: ['Municipal waterworks', 'A larger tank and municipal pump serve the growing town.'],
  square: [
    'Electric civic square',
    'Electric globes frame the familiar fountain and gathering place.',
  ],
  railDepot: [
    'Brick railway station',
    'A brick frontage, platform canopy and signal cabin welcome the same visitors.',
  ],
  blacksmith: [
    'Engineering workshop',
    'A brick workshop and machine bench retain the existing Forge service.',
  ],
  market: ['Covered produce market', 'A permanent roof shelters the existing food stalls.'],
  school: ['Brick public school', 'Tall windows and a brick entrance frame the school bell.'],
  doctor: ['Community clinic', 'A sheltered clinic wing welcomes the same neighbors.'],
  sheriff: [
    'Brick police station',
    'A civic brick frontage preserves the town patrol and protection.',
  ],
  saloon: [
    'The Golden Hour hotel and bar',
    'Brick columns and a broad canopy shelter the familiar gathering place.',
  ],
  stable: [
    'Town motor garage',
    'A motor garage welcomes travelers. Its second upgrade brings touring cars to the streets.',
  ],
  bank: ['Commercial town bank', 'Masonry columns surround the existing secure vault.'],
  shop: [
    'Main street department store',
    'Broad display windows and a canopy brighten the shopfront.',
  ],
  museum: ['Civic museum', 'A brick gallery preserves the frontier collection.'],
  armory: ['Industrial supply depot', 'A brick loading bay organizes the same bounded supplies.'],
  fisherman: [
    'Working fishing quay',
    'A stone quay and covered crates retain the fishing service.',
  ],
  riverPort: ['Industrial river landing', 'A stronger quay welcomes the familiar steamboat.'],
  post: [
    'Town post and dispatch office',
    'A brick entrance and dispatch counter connect the town.',
  ],
  warehouse: ['Rail and river goods hall', 'A broad loading canopy shelters the freight crates.'],
  hotel: ['Riverside brick hotel', 'Brickwork and a sheltered entrance welcome the same visitors.'],
  bridge: ['Prospect civic bridge', 'Stone approach posts mark the familiar river crossing.'],
};
export const INDUSTRIAL_LEVEL_PRICES = [1400, 1850, 2300];
export const hasElectricity = (town) =>
  ['industrial', 'motor-age', 'post-war', 'aviation', 'broadcast', 'contemporary'].includes(
    town.era,
  ) && town.buildings.powerHouse > 0;
export const ELECTRIC_LAMPS = [
  [-3, -7.5],
  [3, -7.5],
  [-3, -2.5],
  [3, -2.5],
  [-3, 7],
  [3, 15],
  [-14, -16.5],
];
