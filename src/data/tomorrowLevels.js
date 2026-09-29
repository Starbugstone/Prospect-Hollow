// Append-only chapters 55–62 (levels 325–372) for the Tomorrow City era.
// Existing levels, seeds, rewards and star targets stay untouched.
//
// Each board is a 7 × 9 grid, row 0 at the top:
//   .  open cell (ice is seeded around the authored structures)
//   #  stone          X  reinforced stone     c  chained gem
//   r/b/g  ruby/sapphire/emerald seal        R  relic   E  bottom exit
//   o  charge core (new): a floor marker that gains one charge per nearby
//      move and releases a free bonus gem when full; gems fall through it.
//      Chapter 55 teaches three-charge cores; later chapters use four.
//   l  lantern        1–4  numbered survey markers
// Guardrails (tested): clear corners, stone-free side columns, open bottom
// rows, at most two ice layers, cores never on stone, chains or relics.
// Chapter rhythm: introduction, practice, delivery, stretch, rest, finale.
// Moves are unlimited; difficulty comes only from these layouts and goals.
const CHAPTER_PLANS = [
  {
    id: 'dome-gardens',
    coreBonuses: ['bomb'],
    name: 'Dome gardens',
    motif: 'dome',
    stops: ['First core', 'Glasshouse rows', 'Seed pods', 'Terrace domes', 'Quiet canopy', 'Bloom'],
    levels: [
      {
        board: `
          .......
          .......
          .......
          .......
          ...o...
          .......
          .......
          .......
          .......`,
        ice: 42,
        coreBonuses: ['cross'],
        tip: 'Match on or beside the charge core three times. When it is full, it gives you a free bonus gem.',
      },
      {
        board: `
          .......
          .......
          ..#.#..
          .......
          .o...o.
          .......
          ..#.#..
          .......
          .......`,
        ice: 76,
        tip: 'Two cores to charge. Their bonuses can reach the stones for you.',
      },
      {
        board: `
          .......
          ..R.R..
          .......
          .c...c.
          ...o...
          .#...#.
          .......
          .......
          ..E.E..`,
        ice: 66,
        tip: 'Charge the core, then use its bonus to open a path for the seed pods.',
      },
      {
        board: `
          .......
          .......
          .X...X.
          ...#...
          .......
          .o...o.
          .c...c.
          .......
          .......`,
        ice: 76,
        tip: 'Save a core bonus for the reinforced shelves.',
      },
      {
        board: `
          .......
          .......
          .......
          ..o....
          .......
          .......
          .......
          .......
          .......`,
        ice: 62,
        tip: 'A quiet canopy. Enjoy the open board and flowing cascades.',
      },
      {
        board: `
          .......
          .R...R.
          .......
          ..#.#..
          ...X...
          .o...o.
          .c...c.
          .......
          .E...E.`,
        ice: 76,
        tip: 'Bring both seed pods home, then finish charging the garden cores.',
      },
    ],
  },
  {
    id: 'maglev-loops',
    coreCharges: 4,
    coreBonuses: ['bomb'],
    name: 'Maglev loops',
    motif: 'orbit',
    stops: ['Platform', 'Switch loop', 'Express pods', 'Crossover', 'Night service', 'Grand loop'],
    levels: [
      {
        board: `
          .......
          .......
          ..c.c..
          .......
          ...o...
          .......
          ..c.c..
          .......
          .......`,
        ice: 66,
        tip: 'Match through each chained gem. Every nearby match also charges the core.',
      },
      {
        board: `
          .......
          .......
          .c...c.
          ...#...
          .o...o.
          ...#...
          .c...c.
          .......
          .......`,
        ice: 72,
        tip: 'Follow the loop from both sides and charge the cores as you go.',
      },
      {
        board: `
          .......
          .R...R.
          .......
          .c.o.c.
          .......
          ..#.#..
          ..c.c..
          .......
          .E...E.`,
        ice: 74,
        tip: 'Release the chains beneath the express pods so they can glide to the exits.',
      },
      {
        board: `
          .......
          .......
          .cXoXc.
          .......
          ...c...
          .......
          ...o...
          .......
          .......`,
        ice: 78,
        tip: 'Charge the upper core between the reinforced shelves to break them open.',
      },
      {
        board: `
          .......
          .......
          .......
          ..c.c..
          ...o...
          .......
          .......
          .......
          .......`,
        ice: 50,
        tip: 'Night service. A gentle loop with room for combinations.',
      },
      {
        board: `
          .......
          ..R.R..
          .......
          .c...c.
          .......
          .o.#.o.
          .......
          .......
          ..E.E..`,
        ice: 72,
        tip: 'Send both pods around the grand loop, then finish the remaining ice.',
      },
    ],
  },
  {
    id: 'solar-terraces',
    coreCharges: 4,
    coreBonuses: ['bomb'],
    name: 'Solar terraces',
    motif: 'steps',
    stops: ['Sunrise', 'Panel rows', 'Harvest lift', 'High terrace', 'Shade garden', 'Solar noon'],
    levels: [
      {
        board: `
          .......
          .......
          .#.....
          ....#..
          ...o...
          .......
          .....#.
          .......
          .......`,
        ice: 70,
        orders: [['emerald', 18]],
        tip: 'Collect the pictured ore while you charge the core. Every match counts.',
      },
      {
        board: `
          .......
          .##....
          .......
          ..o....
          ....##.
          .......
          ....o..
          .......
          .......`,
        ice: 76,
        orders: [['ruby', 20]],
        tip: 'Work down the terraces. Core bonuses collect ore too.',
      },
      {
        board: `
          .......
          .R...R.
          .......
          .##....
          ...o...
          ....##.
          .......
          .......
          .E...E.`,
        ice: 66,
        orders: [['sapphire', 18]],
        tip: 'Guide the harvest down the open side of each terrace.',
      },
      {
        board: `
          .......
          .......
          .XX....
          ...o...
          ....XX.
          .o.....
          .......
          .......
          .......`,
        ice: 76,
        orders: [
          ['emerald', 16],
          ['sapphire', 16],
        ],
        tip: 'Two orders on the high terrace. Charge a core beside each reinforced shelf.',
      },
      {
        board: `
          .......
          .......
          .......
          ....o..
          .......
          .#.....
          .......
          .......
          .......`,
        ice: 52,
        orders: [['ruby', 12]],
        tip: 'Rest in the shade garden. A small order and plenty of room.',
      },
      {
        board: `
          .......
          ..R.R..
          .#.....
          .......
          .....#.
          .o...o.
          ..c.c..
          .......
          ..E.E..`,
        ice: 78,
        orders: [['emerald', 20]],
        tip: 'Solar noon: fill the order, charge every core and bring the relics home.',
      },
    ],
  },
  {
    id: 'hover-lanes',
    coreCharges: 4,
    coreBonuses: ['bomb'],
    name: 'Hover lanes',
    motif: 'ribbon',
    stops: ['On-ramp', 'Lane markers', 'Cargo run', 'Rush hour', 'Scenic route', 'Skyway'],
    levels: [
      {
        board: `
          .......
          ...R...
          .......
          .o.c.o.
          .......
          ..#.#..
          .......
          .......
          ...E...`,
        ice: 76,
        tip: 'Open the central lane below the cargo pod. The side cores keep bonuses coming.',
      },
      {
        board: `
          .......
          ..R.R..
          .......
          .c...c.
          .......
          .#.o.#.
          .......
          .......
          ..E.E..`,
        ice: 80,
        tip: 'Clear both lanes. A charged core can open a lane in one move.',
      },
      {
        board: `
          .......
          .R.R.R.
          .......
          .......
          .o.#.o.
          .......
          .......
          .......
          .E.E.E.`,
        ice: 64,
        tip: 'Three pods, three docks. Work the open lanes beside the central stone.',
      },
      {
        board: `
          .......
          ..R.R..
          .X...X.
          .......
          .c.o.c.
          .......
          .......
          .......
          ..E.E..`,
        ice: 80,
        tip: 'Rush hour: break the reinforced shelves, then send the pods through.',
      },
      {
        board: `
          .......
          ...R...
          .......
          .......
          ...o...
          .......
          .......
          .......
          ...E...`,
        ice: 56,
        tip: 'The scenic route. One pod and an open skyway.',
      },
      {
        board: `
          .......
          .R.R.R.
          .......
          .c...c.
          .......
          .o.#.o.
          .......
          .......
          .E.E.E.`,
        ice: 68,
        orders: [['sapphire', 16]],
        tip: 'Bring every cargo pod down the skyway, then clear the remaining ice.',
      },
    ],
  },
  {
    id: 'orbital-observatory',
    coreCharges: 4,
    coreBonuses: ['bomb'],
    name: 'Orbital observatory',
    motif: 'orbit',
    stops: [
      'Launch window',
      'First orbit',
      'Starlight cargo',
      'Eclipse',
      'Low orbit',
      'Full circle',
    ],
    levels: [
      {
        board: `
          .......
          .......
          ..1.2..
          .c...c.
          ...o...
          .#...#.
          ..3.4..
          .......
          .......`,
        ice: 62,
        orders: [['emerald', 20]],
        tip: 'Light the numbered markers in order. The core in the middle helps with every step.',
      },
      {
        board: `
          .......
          ...R...
          ..1....
          .c...2.
          ...o...
          .4.....
          .#..3..
          .......
          ...E...`,
        ice: 80,
        orders: [['ruby', 20]],
        tip: 'Follow the orbit from one to four while the relic drops to its exit.',
      },
      {
        board: `
          .......
          ..R.R..
          .......
          .1...2.
          ...o...
          .#...#.
          .3.#.4.
          .......
          ..E.E..`,
        ice: 62,
        tip: 'Light the survey trail on the way while the relics fall to the exits.',
      },
      {
        board: `
          .......
          .R...R.
          .1X.X2.
          ...o...
          ...c...
          ...X...
          ..4.3..
          .......
          .E...E.`,
        ice: 78,
        orders: [['sapphire', 18]],
        tip: 'An eclipse of reinforced stone. Light the next number while the relics fall to the exits.',
      },
      {
        board: `
          .......
          .......
          ...1...
          .......
          ..o....
          .....2.
          .......
          .......
          .......`,
        ice: 58,
        tip: 'Low orbit. Two markers and plenty of room to rest.',
      },
      {
        board: `
          .......
          .R...R.
          ...1...
          .4...2.
          ..#.#..
          .c...c.
          .o.3.o.
          .......
          .E...E.`,
        ice: 80,
        tip: 'Complete the full circle, charge every core and bring both relics home.',
      },
    ],
  },
  {
    id: 'capsule-commons',
    coreCharges: 4,
    coreBonuses: ['bomb'],
    name: 'Capsule commons',
    motif: 'pool',
    stops: [
      'Welcome pod',
      'Color keys',
      'Parcel chute',
      'Sealed wing',
      'Reading pod',
      'Open house',
    ],
    levels: [
      {
        board: `
          .......
          .......
          .r...r.
          .......
          ...o...
          .......
          ..#.#..
          .......
          .......`,
        ice: 76,
        orders: [['emerald', 18]],
        tip: 'Match rubies on the R seals. A core bonus opens a seal of any color.',
      },
      {
        board: `
          .......
          .......
          .r...b.
          ..#.#..
          .o.#.o.
          .......
          .b...r.
          .......
          .......`,
        ice: 78,
        orders: [['ruby', 20]],
        tip: 'Two seal colors. Charge the cores to open whichever seal is hardest to reach.',
      },
      {
        board: `
          .......
          ..R.R..
          .......
          .g...g.
          ...o...
          .#...#.
          .......
          .......
          ..E.E..`,
        ice: 54,
        tip: 'Open the emerald seals and send the parcels down the chutes.',
      },
      {
        board: `
          .......
          .......
          .rXoXb.
          .......
          .c...c.
          .......
          ...#...
          .......
          .......`,
        ice: 76,
        orders: [['ruby', 16]],
        tip: 'The sealed wing: break the reinforced stone beside the upper core.',
      },
      {
        board: `
          .......
          .......
          .......
          ..g....
          ....o..
          .......
          .......
          .......
          .......`,
        ice: 52,
        tip: 'A quiet reading pod with a single seal.',
      },
      {
        board: `
          .......
          .R...R.
          .......
          .r...b.
          .......
          .o.#.o.
          ..g.g..
          .......
          .E...E.`,
        ice: 76,
        orders: [['sapphire', 16]],
        tip: 'Open house: unlock every seal and deliver both relics.',
      },
    ],
  },
  {
    id: 'fusion-sphere',
    coreCharges: 5,
    coreBonuses: ['bomb'],
    name: 'Fusion sphere',
    motif: 'pocket',
    stops: ['Ignition', 'Magnet ring', 'Plasma lift', 'Containment', 'Cooling loop', 'Full power'],
    levels: [
      {
        board: `
          .......
          ...R...
          ..X.X..
          .c...c.
          .X.o.X.
          .......
          ..X.X..
          .......
          ...E...`,
        ice: 64,
        orders: [['ruby', 20]],
        tip: 'Charge the core inside the sphere, then guide the relic down through the opened ring.',
      },
      {
        board: `
          .......
          .R...R.
          ..X.X..
          ...X...
          .o...o.
          ...X...
          ..X.X..
          .......
          .E...E.`,
        ice: 64,
        orders: [['sapphire', 20]],
        tip: 'Two cores in the magnet ring. Collect sapphires and bring both relics down the outer lanes.',
      },
      {
        board: `
          .......
          ..R.R..
          .......
          .#.o.#.
          .......
          .X...X.
          .......
          .......
          ..E.E..`,
        ice: 72,
        tip: 'Lift the relics past the reinforced ring on either side.',
      },
      {
        board: `
          .......
          .......
          .cX.Xc.
          .X.o.X.
          .......
          .o...o.
          ...X...
          .......
          .......`,
        ice: 80,
        orders: [
          ['ruby', 20],
          ['sapphire', 16],
        ],
        tip: 'Containment: open the ring from below, then charge the central core.',
      },
      {
        board: `
          .......
          .......
          .......
          ..#.#..
          ...o...
          .......
          .......
          .......
          .......`,
        ice: 62,
        tip: 'A cooling loop. An open chamber for a calm puzzle.',
      },
      {
        board: `
          .......
          .R...R.
          ..X.X..
          .#...#.
          .......
          .o...o.
          ..c.c..
          .......
          .E...E.`,
        ice: 80,
        orders: [['emerald', 20]],
        tip: 'Full power: charge every core, fill the order and deliver the relics.',
      },
    ],
  },
  {
    id: 'tomorrow-skyline',
    coreCharges: 5,
    coreBonuses: ['bomb'],
    name: 'Skyline of tomorrow',
    motif: 'arch',
    stops: ['Sky bridge', 'Beacon lights', 'Rooftop parcels', 'Spire', 'Garden deck', 'Tomorrow'],
    levels: [
      {
        board: `
          .......
          ...R...
          .l...l.
          ..X.X..
          ...o...
          .#...#.
          .c...c.
          .......
          ...E...`,
        ice: 72,
        orders: [['sapphire', 20]],
        tip: 'Light the lanterns, charge the core and send the relic across the sky bridge.',
      },
      {
        board: `
          .......
          .R...R.
          .l.#.l.
          ..X.X..
          .o.c.o.
          .g.#.b.
          .l.r.l.
          .......
          .E...E.`,
        ice: 56,
        orders: [
          ['emerald', 20],
          ['sapphire', 14],
        ],
        tip: 'Beacon lights: light all four lanterns and guide both relics down the outer lanes.',
      },
      {
        board: `
          .......
          .R.R.R.
          .......
          ..l.l..
          .o...o.
          ..#.#..
          .......
          .......
          .E.E.E.`,
        ice: 72,
        tip: 'Send the rooftop parcels down between the stones, lighting lanterns on the way.',
      },
      {
        board: `
          .......
          ..R.R..
          .X.o.X.
          .c...c.
          ..g.b..
          .o...o.
          .#.#.#.
          .......
          ..E.E..`,
        ice: 70,
        orders: [['ruby', 20]],
        tip: 'The spire mixes every rule you know. Use core bonuses where they help most.',
      },
      {
        board: `
          .......
          .......
          .......
          ...o...
          .l...l.
          .......
          .......
          .......
          .......`,
        ice: 62,
        tip: 'The garden deck. Take a breath before the final puzzle.',
      },
      {
        board: `
          .......
          .R...R.
          ..r.b..
          .l...l.
          ..c.c..
          .o.#.o.
          .......
          .......
          .E...E.`,
        ice: 66,
        orders: [['emerald', 12]],
        tip: 'Welcome to tomorrow: charge the cores, light the lanterns and bring both relics home.',
      },
    ],
  },
];

const COLS = 7;
const ROWS = 9;
// Translate an authored grid into the shared expansion spec used by the generator.
export const parseTomorrowBoard = (board) => {
  const rows = board.trim().split(/\s+/);
  if (rows.length !== ROWS || rows.some((row) => row.length !== COLS))
    throw new Error('Tomorrow boards must be 7 × 9');
  const cells = [...rows.join('')];
  const cores = [];
  const lanterns = [];
  const survey = [];
  const map = cells.map((symbol, index) => {
    if (symbol === 'o') cores.push(index);
    else if (symbol === 'l') lanterns.push(index);
    else if (/[1-4]/.test(symbol)) survey[Number(symbol) - 1] = index;
    else return symbol;
    return '.';
  });
  return {
    map: Array.from({ length: ROWS }, (_, row) =>
      map.slice(row * COLS, row * COLS + COLS).join(''),
    ).join('/'),
    cores,
    signals: survey.length ? survey : lanterns,
    survey: survey.length > 0,
  };
};

export const TOMORROW_CHAPTERS = CHAPTER_PLANS.map(({ id, name }) => ({
  id,
  name,
  theme: id,
  style: 'tomorrow',
  cols: COLS,
  rows: ROWS,
  gemTypeCount: 5,
}));
export const TOMORROW_LEVEL_NAMES = CHAPTER_PLANS.flatMap(({ name, stops }) =>
  stops.map((stop) => `${name}: ${stop}`),
);
export const TOMORROW_LEVELS = CHAPTER_PLANS.flatMap((plan) =>
  plan.levels.map(
    ({
      board,
      ice,
      orders = [],
      coreCharges = plan.coreCharges,
      coreBonuses = plan.coreBonuses,
      tip,
    }) => ({
      ...parseTomorrowBoard(board),
      openExitRows: 2,
      orders,
      ice,
      coreCharges: coreCharges ?? 3,
      ...(coreBonuses ? { coreBonuses } : {}),
      motif: plan.motif,
      tip,
    }),
  ),
);
