import { hasShortProgression } from './buildingProgression';
import { purchasePrice, RIVER_RAIL_LEVEL_PRICES } from './economy';
import { FRONTIER_BUILDINGS } from './frontier';
import { FRONTIER_ERA, createEraState } from './eras';
import { RIVER_RAIL_BUILDINGS } from './riverRail';
import { INDUSTRIAL_BUILDINGS, INDUSTRIAL_LEVEL_PRICES } from './industrial';
import { CITY_BUILDINGS } from './city';
import { MOTOR_AGE_BUILDINGS } from './motorAge';
import { LEISURE_BUILDINGS } from './leisure';

const ORIGINAL_BUILDINGS = [
  {
    id: 'well',
    name: 'Old town well',
    shortName: 'Well',
    purpose: 'A fresh start',
    x: 490,
    y: 385,
    color: '#679f9d',
    stages: ['Empty plot', 'Fresh water flowing'],
    upgrades: [
      {
        cost: 50,
        runs: 0,
        title: 'Let the water flow',
        benefit: 'Fresh drinking water for the town.',
        story: 'Hear that? Fresh water. This old place has a little life in it yet.',
        speaker: 'Ada · the caretaker',
      },
    ],
  },
  {
    id: 'farm',
    name: 'Clover farm',
    shortName: 'Farm',
    purpose: 'Something good growing',
    x: 725,
    y: 230,
    color: '#859753',
    stages: ['Empty plot', 'The first harvest'],
    upgrades: [
      {
        cost: 50,
        runs: 0,
        title: 'Plant the first seeds',
        benefit: 'A little harvest to feed our future neighbors.',
        story:
          'A little water, a little patience. We’ll have supper growing here before you know it.',
        speaker: 'Ruth · the farmer',
      },
    ],
  },
  {
    id: 'home',
    name: 'Juniper house',
    shortName: 'Home',
    purpose: 'Room for new beginnings',
    x: 250,
    y: 235,
    color: '#bc8067',
    stages: ['Empty plot', 'A place to call home', 'A growing household'],
    upgrades: [
      {
        cost: 50,
        runs: 0,
        title: 'Make a home for a family',
        benefit: 'Two new neighbors, once food and water are ready.',
        story:
          'The roof is mended and the kettle’s on. With food and water, this will be a lovely home for the Bell family.',
        speaker: 'Ada · the caretaker',
      },
      {
        cost: 150,
        runs: 1,
        title: 'Make a little more room',
        benefit:
          'A new wing and a garden make room for two more neighbors, once food and water are ready.',
        story:
          'A proper garden and room for cousins. It’s beginning to feel like we’ve always lived here.',
        speaker: 'June · your neighbor',
      },
    ],
  },
  {
    id: 'saloon',
    name: 'The Golden Hour',
    shortName: 'Saloon',
    purpose: 'Good company awaits',
    x: 225,
    y: 455,
    color: '#c69849',
    stages: ['Empty plot', 'The doors are open'],
    upgrades: [
      {
        cost: 100,
        runs: 1,
        title: 'Bring back the good times',
        benefit:
          'Store 2.25 coins per person each hour, plus the happiness bonus. Adds 2 happiness points.',
        story: 'First round of lemonade is on the house. Someone dust off that piano!',
        speaker: 'Nell · the saloon keeper',
      },
    ],
  },
  {
    id: 'stable',
    name: 'Dusty Spur stables',
    shortName: 'Stables',
    purpose: 'A welcome at the end of the trail',
    x: 735,
    y: 455,
    color: '#a8764a',
    stages: ['Empty plot', 'Back in the saddle'],
    upgrades: [
      {
        cost: 100,
        runs: 1,
        title: 'Welcome weary travelers',
        benefit:
          'Room for two visitors, once food and water are ready. Visitors spend coins at the saloon.',
        story: 'A dry stall and some good hay. Word of this place will travel faster than we do.',
        speaker: 'Kit · the stable keeper',
      },
    ],
  },
  {
    id: 'sheriff',
    name: 'Sheriff’s office',
    shortName: 'Sheriff',
    purpose: 'Someone looking out for us',
    x: 485,
    y: 590,
    color: '#6f8996',
    stages: ['Empty plot', 'The town is in good hands'],
    upgrades: [
      {
        cost: 100,
        runs: 1,
        title: 'Pin up the badge',
        benefit: 'A sheriff to keep an eye on town and turn bandits away.',
        story: 'No need to worry, folks. I’ll take the evening walk from here.',
        speaker: 'Sam · the sheriff',
      },
    ],
  },
  {
    id: 'museum',
    name: 'The Frontier Museum',
    shortName: 'Museum',
    purpose: 'Every gem has a story',
    x: 170,
    y: 595,
    color: '#b59b6b',
    stages: ['Empty plot', 'Your adventures on display'],
    upgrades: [
      {
        cost: 120,
        runs: 1,
        title: 'Open the museum',
        benefit: 'Replay completed levels and add 2 happiness points.',
        story:
          'Your first discoveries belong here. Come back to an old adventure and see how far you’ve come.',
        speaker: 'Ellis · the curator',
      },
    ],
  },
  {
    id: 'armory',
    name: 'Frontier armory',
    shortName: 'Armory',
    purpose: 'Ready for the next adventure',
    x: 785,
    y: 600,
    color: '#718c89',
    stages: [
      'Empty plot',
      'Shelves for your supplies',
      'A bigger storeroom',
      'Room for every adventure',
    ],
    upgrades: [
      {
        cost: 120,
        runs: 1,
        title: 'Build the armory',
        benefit: 'Carry up to 5 of each puzzle bonus.',
        story:
          'A place for every tool. You can now keep five of each puzzle bonus ready for the mine.',
        speaker: 'Kit · the quartermaster',
      },
      {
        cost: 220,
        runs: 1,
        title: 'Expand the storeroom',
        benefit: 'Carry up to 8 of each puzzle bonus.',
        story: 'New shelves, more supplies. There’s room for eight of each puzzle bonus now.',
        speaker: 'Kit · the quartermaster',
      },
      {
        cost: 350,
        runs: 1,
        title: 'Complete the supply depot',
        benefit: 'Carry up to 12 of each puzzle bonus.',
        story:
          'The depot is ready. Twelve of each puzzle bonus will see you through a long adventure.',
        speaker: 'Kit · the quartermaster',
      },
    ],
  },
];

ORIGINAL_BUILDINGS.push({
  id: 'bank',
  name: 'Prospect bank',
  shortName: 'Bank',
  purpose: 'A safe place for your savings',
  x: 340,
  y: 115,
  color: '#b3a47b',
  stages: ['Empty plot', 'The vault is open', 'A reinforced vault', 'The frontier reserve'],
  upgrades: [
    {
      cost: 100,
      title: 'Open the bank',
      benefit: 'Protect half the coins at risk from two riders.',
    },
    {
      cost: 230,
      title: 'Reinforce the vault',
      benefit: 'Protect half the coins at risk from four riders.',
    },
    {
      cost: 360,
      title: 'Complete the frontier reserve',
      benefit: 'Protect half the coins at risk from six riders.',
    },
  ].map((upgrade) => ({
    ...upgrade,
    runs: 1,
    story: upgrade.benefit,
    speaker: 'Morgan · the banker',
  })),
});

ORIGINAL_BUILDINGS.push({
  id: 'shop',
  name: 'Prairie trading post',
  shortName: 'Shop',
  purpose: 'Supplies for your next descent',
  x: 650,
  y: 115,
  color: '#b08b6c',
  stages: ['Empty plot', 'Open for trade', 'A wider selection', 'The grand trading post'],
  upgrades: [
    {
      cost: 100,
      title: 'Open the shop',
      benefit: 'Buy a random puzzle power. New stock after each completed mine run.',
    },
    {
      cost: 220,
      title: 'Expand the shop',
      benefit: 'Choose from two random bonuses after each completed mine run.',
    },
    {
      cost: 350,
      title: 'Complete the trading post',
      benefit: 'Choose from three random bonuses after each completed mine run.',
    },
  ].map((upgrade) => ({
    ...upgrade,
    runs: 1,
    story: upgrade.benefit,
    speaker: 'Robin · the shopkeeper',
  })),
});

ORIGINAL_BUILDINGS.push({
  id: 'square',
  name: 'Prospect town square',
  shortName: 'Town square',
  purpose: 'A place to gather',
  x: 500,
  y: 280,
  color: '#b3a878',
  stages: ['Empty plot', 'A meeting place', 'Benches in the sunshine', 'A welcoming town square'],
  upgrades: [
    [80, 'Lay out the town square', 'A paved square with a fountain adds 8 happiness points.'],
    [
      160,
      'Set out the benches',
      'Benches and flower beds raise the square to 16 happiness points.',
    ],
    [
      320,
      'Finish the gathering place',
      'A tiered fountain raises the square to 24 happiness points.',
    ],
  ].map(([cost, title, benefit], index) => ({
    cost,
    title,
    benefit,
    runs: index ? 1 : 0,
    story: benefit,
    speaker: 'June · your neighbor',
  })),
});

// Completed levels are permanent; improvements keep the previous service open.
const IMPROVEMENTS = {
  well: [
    [
      140,
      1,
      'A reliable town pump',
      'Install the town pump',
      'Water for twelve neighbors. Unlock a second well plot.',
    ],
    [
      260,
      1,
      'Water above the rooftops',
      'Raise the water tower',
      'Water for eighteen neighbors, with a tank above the town.',
    ],
  ],
  farm: [
    [
      170,
      1,
      'A barn full of promise',
      'Expand the barn',
      'Food for twelve neighbors. Unlock Farm II; upgrade it to level 2 to reveal Farm III.',
    ],
    [
      300,
      1,
      'Fields of plenty',
      'Build the farm windmill',
      'Food for eighteen neighbors and a working windmill.',
    ],
  ],
  home: [
    [
      280,
      1,
      'A home for generations',
      'Add a second floor',
      'Room for six neighbors, with a balcony overlooking the street.',
    ],
  ],
  saloon: [
    [
      220,
      1,
      'Room for the evening crowd',
      'Open the upstairs lounge',
      'Store 4.5 coins per person each hour, plus the happiness bonus. Adds 4 happiness points.',
    ],
    [
      350,
      1,
      'The heart of the frontier',
      'Complete the grand saloon',
      'Store 6.75 coins per person each hour, plus the happiness bonus. Adds 6 happiness points.',
    ],
  ],
  stable: [
    [
      210,
      1,
      'More saddles on the trail',
      'Add covered stalls',
      'Room for four visitors, once food and water are ready.',
    ],
    [
      330,
      1,
      'A busy frontier stop',
      'Open the carriage yard',
      'Room for six visitors, once food and water are ready.',
    ],
  ],
  sheriff: [
    [
      230,
      1,
      'A deputy on duty',
      'Make room for a deputy',
      'Protect half the coins at risk from four riders.',
    ],
    [
      360,
      1,
      'Watch over the whole town',
      'Build the frontier watchtower',
      'Protect half the coins at risk from six riders.',
    ],
  ],
  museum: [
    [
      210,
      1,
      'The discovery gallery',
      'Add the discovery gallery',
      'Attract two visitors and add 4 happiness points.',
    ],
    [
      330,
      1,
      'A frontier landmark',
      'Complete the museum tower',
      'Attract four visitors and add 6 happiness points.',
    ],
  ],
};
for (const building of ORIGINAL_BUILDINGS) {
  building.kind = building.id;
  for (const [cost, runs, stage, title, benefit] of IMPROVEMENTS[building.id] ?? []) {
    building.stages.push(stage);
    building.upgrades.push({
      cost,
      runs,
      title,
      benefit,
      story: benefit,
      speaker: building.upgrades[0].speaker,
    });
  }
}
ORIGINAL_BUILDINGS.find(({ id }) => id === 'home').upgrades[1].benefit =
  'Room for four neighbors. Unlock House II; upgrade each extra house to level 2 to reveal the next.';
ORIGINAL_BUILDINGS.find(({ id }) => id === 'sheriff').upgrades[0].benefit =
  'Protect half the coins at risk from two riders.';

const LATE_IMPROVEMENTS = {
  well: [
    ['A dependable waterworks', 'Improve the waterworks', 'Water for twenty-four people.'],
    ['Water for the frontier', 'Complete the waterworks', 'Water for thirty people.'],
  ],
  farm: [
    ['An abundant harvest', 'Expand the irrigated fields', 'Food for twenty-four people.'],
    ['A thriving farmstead', 'Complete the farmstead', 'Food for thirty people.'],
  ],
  home: [
    ['A welcoming household', 'Furnish the guest rooms', 'Room for eight residents.'],
    ['A home full of life', 'Complete the family home', 'Room for ten residents.'],
  ],
  saloon: [
    [
      'Music on the terrace',
      'Open the garden terrace',
      'Store 9 coins per person each hour, plus the happiness bonus.',
    ],
    [
      'The frontier gathering place',
      'Complete the grand terrace',
      'Store 11.25 coins per person each hour, plus the happiness bonus.',
    ],
  ],
  stable: [
    [
      'The stagecoach stop',
      'Open the stagecoach stop',
      'Room for eight visitors, once food and water are ready.',
    ],
    [
      'A crossroads for travelers',
      'Complete the coaching yard',
      'Room for ten visitors, once food and water are ready.',
    ],
  ],
  sheriff: [
    [
      'A frontier patrol',
      'Organize the frontier patrol',
      'Protect half the coins at risk from eight riders.',
    ],
    [
      'A watchful frontier',
      'Complete the patrol headquarters',
      'Protect half the coins at risk from ten riders.',
    ],
  ],
  museum: [
    [
      'The traveling exhibition',
      'Welcome the traveling exhibition',
      'Attract six visitors and add 8 happiness points.',
    ],
    [
      'A celebrated collection',
      'Complete the frontier collection',
      'Attract eight visitors and add 10 happiness points.',
    ],
  ],
  armory: [
    [
      'Supplies for an expedition',
      'Equip the expedition depot',
      'Carry up to 16 of each puzzle bonus.',
    ],
    [
      'Ready for any adventure',
      'Complete the expedition depot',
      'Carry up to 20 of each puzzle bonus.',
    ],
  ],
  bank: [
    [
      'A secure frontier treasury',
      'Expand the treasury',
      'Protect half the coins at risk from eight riders.',
    ],
    [
      'The town treasury',
      'Complete the treasury',
      'Protect half the coins at risk from ten riders.',
    ],
  ],
  shop: [
    [
      'The frontier market',
      'Expand the market shelves',
      'Choose from four random bonuses after each completed mine run.',
    ],
    [
      'Every tool within reach',
      'Complete the frontier market',
      'Choose from all five puzzle powers after each completed mine run.',
    ],
  ],
  square: [
    [
      'Flowers around the square',
      'Plant the border gardens',
      'Low flower beds raise the square to 32 happiness points. A warning bell halves the remaining coin loss once per raid.',
    ],
    [
      'The pride of Prospect Hollow',
      'Complete the town square',
      'An open gathering place with 40 happiness points and a warning bell that halves the remaining coin loss once per raid.',
    ],
  ],
};
for (const building of ORIGINAL_BUILDINGS) {
  const cost = building.upgrades.at(-1).cost;
  for (const [index, [stage, title, benefit]] of LATE_IMPROVEMENTS[building.id].entries()) {
    building.stages.push(stage);
    building.upgrades.push({
      cost: Math.ceil((cost * (index ? 5 : 2)) / 10) * 10,
      runs: 1,
      title,
      benefit,
      story: benefit,
      speaker: building.upgrades[0].speaker,
    });
  }
}
export const BUILDINGS = [
  ...ORIGINAL_BUILDINGS,
  ...FRONTIER_BUILDINGS,
  ...RIVER_RAIL_BUILDINGS,
  ...INDUSTRIAL_BUILDINGS,
  ...MOTOR_AGE_BUILDINGS,
  ...CITY_BUILDINGS,
  ...LEISURE_BUILDINGS,
  ...[
    ['home2', 'home', 'Willow house', 'Home II', 95, 320],
    ['home3', 'home', 'Sagebrush house', 'Home III', 90, 465, 'home2'],
    ['home4', 'home', 'Cottonwood house', 'Home IV', 300, 665, 'home3'],
    ['well2', 'well', 'Prairie well', 'Well II', 640, 675],
    ['farm2', 'farm', 'Sunrise farm', 'Farm II', 900, 295],
    ['farm3', 'farm', 'Meadow farm', 'Farm III', 900, 465, 'farm2'],
  ].map(([id, kind, name, shortName, x, y, previous]) => ({
    ...ORIGINAL_BUILDINGS.find((building) => building.id === kind),
    id,
    kind,
    costMultiplier: 1 + (Number(id.slice(kind.length)) - 1) * 0.5,
    name,
    shortName,
    x,
    y,
    unlock: [{ id: kind, level: 2 }, ...(previous ? [{ id: previous, level: 2 }] : [])],
    upgrades: ORIGINAL_BUILDINGS.find((building) => building.id === kind).upgrades.map(
      (upgrade) => ({
        ...upgrade,
        benefit: upgrade.benefit.split(' Unlock')[0],
        story: upgrade.story.split(' Unlock')[0],
      }),
    ),
  })),
].map((building) => {
  const upgrades = building.upgrades.map((upgrade, index) => ({
    ...upgrade,
    cost:
      building.introducedEra === 'river-rail'
        ? RIVER_RAIL_LEVEL_PRICES[index]
        : building.introducedEra === 'industrial'
          ? INDUSTRIAL_LEVEL_PRICES[index]
          : purchasePrice(upgrade.cost),
  }));
  const short = hasShortProgression(building.id);
  return {
    ...building,
    introducedEra: building.introducedEra ?? FRONTIER_ERA,
    requiredForEraCompletion: true,
    legacyUpgradeCosts: short ? upgrades.map((upgrade) => upgrade.cost) : undefined,
    stages: short ? [...building.stages.slice(0, 3), building.stages.at(-1)] : building.stages,
    upgrades: (short
      ? [upgrades[0], upgrades[1], { ...upgrades.at(-1), cost: upgrades[2].cost }]
      : upgrades
    ).map((upgrade) => ({
      ...upgrade,
      cost: Math.ceil(upgrade.cost * (building.costMultiplier ?? 1)),
    })),
  };
});

export const BUILDING_BY_ID = Object.fromEntries(
  BUILDINGS.map((building) => [building.id, building]),
);
export const INTRO_ORDER = ['well', 'farm', 'home'];
export const BANDIT_EVENT = 'dusty-trail-visitors';
export const INITIAL_STORY = {
  speaker: 'Ada · the caretaker',
  title: 'A town starts with your first choice.',
  text: 'Choose any empty plot. The first building’s materials are on us. Small buildings open immediately. Larger buildings and improvements need one completed puzzle, then a tap to finish.',
};

export const createTown = () => ({
  ...createEraState(BUILDINGS.map(({ id }) => id)),
  coins: 0,
  tourSeen: false,
  constructionTipSeen: false,
  buildings: Object.fromEntries(BUILDINGS.map(({ id }) => [id, 0])),
  events: {},
  presentations: {},
  projects: {},
  completedRuns: 0,
  nextRaidRun: null,
  income: { at: null, remainder: 0, stored: 0 },
  lastCollections: { saloon: null, blacksmith: null },
  progressionVersion: 1,
});
