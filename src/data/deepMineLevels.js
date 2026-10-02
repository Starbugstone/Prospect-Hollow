// Append-only groups 63–67, levels 373–402. These caverns introduce sediment
// fossils and linked roots, then combine familiar goals in more demanding routes.
// Five colors, open side columns and the bottom two rows remain campaign rules.
// A chapter's fifth puzzle is a breather; its sixth brings the theme together.
const COLS = 7;
const ROWS = 9;
const PLANS = [
  {
    id: 'fossil-beds',
    name: 'Fossil beds',
    style: 'fossil',
    motif: 'pocket',
    fossilLayers: 2,
    stops: [
      'First ammonite',
      'Twin discoveries',
      'Buried gallery',
      'Ancient shelves',
      'Soft sand',
      'Living history',
    ],
    levels: [
      {
        board: '......./......./......./..11.../..11.../......./......./......./.......',
        ice: 42,
        fossilLayers: 1,
        tip: 'Match over the dusty fossil pieces to brush them clean. Reveal every piece and the fossil collects itself.',
      },
      {
        board: '......./......./.11..../.11..../......./....22./....22./......./.......',
        ice: 72,
        tip: 'Two fossils hide under deeper dust. Match on each dusty piece twice; the exposed pieces stay clean.',
      },
      {
        board: '......./......./.11..#./.11..../...22../.3322../.33..#./......./.......',
        ice: 66,
        tip: 'Choose a fossil to uncover first. Open the stone shelves from the clear side lanes.',
      },
      {
        board: '......./......./.11.22./.11.22./...X.../..33.../.X33.X./......./.......',
        ice: 66,
        tip: 'Brush into the three fossil pockets. A bonus can clean several pieces and break a reinforced shelf together.',
      },
      {
        board: '......./......./......./..11.../..11.../......./......./......./.......',
        ice: 56,
        fossilLayers: 1,
        tip: 'A soft sand bed. One little fossil and room to enjoy long cascades.',
      },
      {
        board: '......./.11.22./.11.22./..#.#../...o.../.33.44./.33.44./......./.......',
        ice: 60,
        coreCharges: 4,
        tip: 'Reveal the four fossils. Nearby matches charge the brazier, whose free bomb can brush a whole pocket clean.',
      },
    ],
  },
  {
    id: 'glowshroom-grotto',
    name: 'Glowshroom grotto',
    style: 'glowshroom',
    motif: 'twins',
    fossilLayers: 2,
    stops: [
      'First glow',
      'Mushroom trails',
      'Spore fossils',
      'Deep bloom',
      'Quiet glade',
      'Forest of light',
    ],
    levels: [
      {
        board: '......./......./..#.#../.l...l./...#.../..l.l../...#.../......./.......',
        ice: 86,
        tip: 'Match on or beside each mushroom to make it glow. Lit mushrooms stay lit and gems move freely over them.',
      },
      {
        board: '......./......./.##..../.l...l./....##./.l...l./...l.../......./.......',
        ice: 88,
        tip: 'Light the mushroom trail from either side. Open the staggered shelves to reach the inner glow.',
      },
      {
        board: '......./......./.11.22./.11.22./.l...l./..#.#../.l...l./......./.......',
        ice: 74,
        tip: 'Light the four mushrooms and brush both fossils clean. Each finished discovery stays complete.',
      },
      {
        board: '......./......./.X...X./.l...l./...o.../.X...X./...X.../......./.......',
        ice: 86,
        coreCharges: 5,
        tip: 'Match beside the brazier to fill its five pips. Use the free bomb to open a shelf and light nearby mushrooms.',
      },
      {
        board: '......./......./......./.l...l./......./......./......./......./.......',
        ice: 62,
        tip: 'A quiet glade. Two friendly mushrooms leave plenty of room for combinations.',
      },
      {
        board: '......./......./.X.l.X./.l...l./..o.o../.l...l./.X.l.X./......./.......',
        ice: 88,
        coreCharges: 5,
        tip: 'Wake the whole forest. Charge both braziers and use their bombs to reach the remaining mushrooms.',
      },
    ],
  },
  {
    id: 'root-bound-vault',
    name: 'Root-bound vault',
    style: 'root',
    motif: 'arch',
    fossilLayers: 2,
    stops: [
      'First knot',
      'Twin roots',
      'Buried roots',
      'Tangled vault',
      'Garden clearing',
      'Treasures released',
    ],
    levels: [
      {
        board: '......./......./......./...K.../..KkK../...K.../......./......./.......',
        ice: 42,
        tip: 'Match beside the root knot to cut it. Every connected vine releases together; matching a vine also frees that gem.',
      },
      {
        board: '......./......./..K..../.KkK.../..K.M../...MmM./....M../......./.......',
        ice: 86,
        tip: 'Follow the visible vines to their knots. Choose which knot frees the most useful passage first.',
      },
      {
        board: '......./......./.11.22./.11.22./..K..../.KkK.../..K..../......./.......',
        ice: 76,
        tip: 'Cut the knot to release the lower gallery, then brush the two fossils clean.',
      },
      {
        board: '......./......./..K.X../.KkK.../..K.M../.X.MmM./....M../......./.......',
        ice: 86,
        knotHealth: 2,
        tip: 'Thick knots take two nearby matches. Their vines release together when the second hit cuts through.',
      },
      {
        board: '......./......./......./..K..../.KkK.../..K..../......./......./.......',
        ice: 60,
        tip: 'A garden clearing. Cut the little knot and enjoy the open gallery.',
      },
      {
        board: '......./..R.R../..K..../.KkK.../..K.M../...MmM./....M../......./..E.E..',
        ice: 84,
        knotHealth: 2,
        tip: 'Cut both thick knots to free the treasure shafts. Clear beneath each relic to drop it into its glowing exit.',
      },
    ],
  },
  {
    id: 'underground-reservoir',
    name: 'Underground reservoir',
    style: 'reservoir',
    motif: 'steps',
    stops: [
      'First pearl',
      'Twin pools',
      'Split channels',
      'Deep currents',
      'Still water',
      'Pearl harvest',
    ],
    levels: [
      {
        board: '......./...R.../..#..../....#../..#..../....#../......./......./...E...',
        ice: 88,
        tip: 'Clear beneath the pearl to drop it into its glowing basket. Pearls cannot swap or be blasted away.',
      },
      {
        board: '......./..R.R../..X..../....#../..#..../....X../......./......./..E.E..',
        ice: 86,
        tip: 'Two pearl pools. Open each staggered shelf and keep clearing beneath the pearls.',
      },
      {
        board: '......./.R.R.R./..#.#../.l...l./...X.../.l...l./..#.#../......./.E.E.E.',
        ice: 84,
        tip: 'Light the mushrooms beside the channels. Bring all three pearls down to their matching baskets.',
      },
      {
        board: '......./..R.R../..K..../.KkK.../..K.M../...MmM./....M../......./..E.E..',
        ice: 88,
        knotHealth: 2,
        tip: 'Cut the root knots guarding the channels. The released vines give both pearls a clear route down.',
      },
      {
        board: '......./..R.R../......./......./......./......./......./......./..E.E..',
        ice: 60,
        tip: 'Still water and open channels. Bring both pearls home with flowing cascades.',
      },
      {
        board: '......./.R.R.R./.X...X./..#.#../.o...o./..X.X../...#.../......./.E.E.E.',
        ice: 82,
        coreCharges: 5,
        tip: 'Charge both braziers to open the reinforced channels. Collect all three pearls and clear the remaining ice.',
      },
    ],
  },
  {
    id: 'geothermal-forge',
    name: 'Geothermal forge',
    style: 'geothermal',
    motif: 'twins',
    fossilLayers: 2,
    stops: [
      'First ember',
      'Copper chambers',
      'Ancient heat',
      'Basalt vault',
      'Warm hearth',
      'Heart of the forge',
    ],
    levels: [
      {
        board: '......./......./.X...X./..o.o../...#.../..#.#../......./......./.......',
        ice: 78,
        coreCharges: 4,
        tip: 'Match on or beside each brazier to fill its four pips. A full brazier gives you a free bomb.',
      },
      {
        board: '......./......./.XX..../...o.../....XX./.o...o./...#.../......./.......',
        ice: 86,
        coreCharges: 5,
        tip: 'Charge the braziers near the copper shelves. Place their bombs where they can break several stones together.',
      },
      {
        board: '......./......./.11.22./.11.22./..o.o../.X...X./...#.../......./.......',
        ice: 72,
        coreCharges: 5,
        tip: 'Brush the heat-baked fossils clean. Charged braziers give you bombs to reach the deepest pieces.',
      },
      {
        board: '......./......./.X...X./..K.o../.KkK.../..K.X../.o..#../......./.......',
        ice: 88,
        coreCharges: 5,
        knotHealth: 2,
        tip: 'Cut the thick root knot and charge both braziers. A well-placed bomb can open basalt and release the vines together.',
      },
      {
        board: '......./......./......./..o..../......./......./......./......./.......',
        ice: 62,
        coreCharges: 4,
        tip: 'A warm hearth. Charge one brazier and enjoy a generous open board.',
      },
      {
        board: '......./.R.R.R./.X...X./..o.o../...X.../.X.o.X./..#.#../......./.E.E.E.',
        ice: 82,
        coreCharges: 5,
        tip: 'Bring all three relics out of the forge. Charge the three braziers and use their bombs to open the final basalt shelves.',
      },
    ],
  },
];

// 1–4 mark four-piece fossils. k/m/n are root knots; K/M/N are
// their visibly connected vines. l is a mushroom/lantern, o a brazier/core.
// Everything else uses the established expansion map alphabet.
export function parseDeepMineBoard(board, { fossilLayers = 2, knotHealth = 1 } = {}) {
  const rows = board.trim().split(/[\s/]+/);
  if (rows.length !== ROWS || rows.some((row) => row.length !== COLS))
    throw new Error('Deep mine boards must be 7 × 9');
  const cells = [...rows.join('')];
  const cores = [];
  const signals = [];
  const fossilGroups = new Map();
  const rootGroups = new Map();
  const map = cells.map((symbol, index) => {
    if (/[1-4]/.test(symbol)) {
      if (!fossilGroups.has(symbol)) fossilGroups.set(symbol, []);
      fossilGroups.get(symbol).push(index);
    } else if (/[kmnKMN]/.test(symbol)) {
      const group = symbol.toLowerCase();
      if (!rootGroups.has(group)) rootGroups.set(group, { id: `root-${group}`, bindings: [] });
      const root = rootGroups.get(group);
      if (symbol === group) {
        if (root.knot !== undefined) throw new Error('A root group must have one knot');
        root.knot = index;
      } else root.bindings.push(index);
    } else if (symbol === 'o') cores.push(index);
    else if (symbol === 'l') signals.push(index);
    else if (/[.#XcrbgRE]/.test(symbol)) return symbol;
    else throw new Error(`Unknown deep mine board symbol: ${symbol}`);
    return '.';
  });
  const fossils = [...fossilGroups].map(([id, footprint]) => {
    const [start] = footprint;
    if (
      footprint.length !== 4 ||
      start % COLS === COLS - 1 ||
      footprint.some((cell, part) => cell !== start + (part % 2) + Math.floor(part / 2) * COLS)
    )
      throw new Error('Fossil footprints must be connected 2 × 2 squares');
    return { id: `fossil-${id}`, cells: footprint, layers: fossilLayers };
  });
  const roots = [...rootGroups.values()].map((root) => {
    if (
      root.knot === undefined ||
      !root.bindings.length ||
      root.bindings.some(
        (cell) =>
          Math.abs((cell % COLS) - (root.knot % COLS)) +
            Math.abs(Math.floor(cell / COLS) - Math.floor(root.knot / COLS)) !==
          1,
      )
    )
      throw new Error('Every root vine must connect directly to its knot');
    return { ...root, knotHealth, bindingHealth: 1 };
  });
  return {
    map: Array.from({ length: ROWS }, (_, row) =>
      map.slice(row * COLS, row * COLS + COLS).join(''),
    ).join('/'),
    cores,
    signals,
    fossils,
    roots,
  };
}

export const DEEP_MINE_CHAPTERS = PLANS.map(({ id, name, style }) => ({
  id,
  name,
  theme: id,
  style,
  cols: COLS,
  rows: ROWS,
  gemTypeCount: 5,
}));
export const DEEP_MINE_LEVEL_NAMES = PLANS.flatMap(({ name, stops }) =>
  stops.map((stop) => `${name}: ${stop}`),
);
export const DEEP_MINE_LEVELS = PLANS.flatMap((plan) =>
  plan.levels.map(({ board, fossilLayers = plan.fossilLayers, knotHealth, ...level }) => ({
    ...parseDeepMineBoard(board, { fossilLayers, knotHealth }),
    ...level,
    openExitRows: 2,
    coreBonuses: ['bomb'],
    motif: plan.motif,
  })),
);
