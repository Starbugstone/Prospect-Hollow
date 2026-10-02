// Endgame groups 63–67, levels 373–402. Broad upper crafting rooms feed
// shaped chambers, blast-only fossil beds and constrained treasure routes.
// Each fifth puzzle eases the workload while retaining a bonus-placement goal.
// Published reward/star thresholds remain compatible with queued victories.
const COLS = 7;
const ROWS = 9;
const PLANS = [
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
        board: '......./......./......./......./_.o.o._/__...__/__.B.__/___.___/___.___',
        ice: 54,
        gravity: 'funnel',
        coreCharges: 4,
        tip: 'Charge both braziers for free bombs. Guide a bonus down the chute and use it to break the dark gate; nearby ordinary matches cannot damage that rock.',
      },
      {
        board: '......./......./......./......./_o.D.o_/__...__/__D.D__/___D___/___.___',
        ice: 64,
        gravity: 'funnel',
        coreCharges: 5,
        tip: 'The copper chute has several thick gates. Charge the side braziers, then craft extra bonuses and aim them where one blast can hit several gates.',
      },
      {
        board: '......./......./......./......./_.oDD._/__...__/__D.o__/___D___/___.___',
        ice: 56,
        gravity: 'funnel',
        coreCharges: 5,
        tip: 'Thick rock narrows the hot chute. Charge the braziers and use their bombs to break the upper shelf and lower gates; each dark band needs a direct bonus hit.',
      },
      {
        board: '......./......./......./......./D.....D/..._.../.D._.D./..o_o../..._...',
        ice: 72,
        coreCharges: 5,
        tip: 'Two foundry wells demand different blast positions. Charge their braziers and open every thick basalt gate with direct bonus hits.',
      },
      {
        board: '......./......./......./......./_.o.o._/_....._/__.D.__/__...__/__...__',
        ice: 42,
        coreCharges: 4,
        tip: 'A warm hearth with one thick gate. Charge the two braziers and place their bombs where they will open the lower chamber.',
      },
      {
        board: '......./......./......./......./D.....D/..._.../.DD_DD./..o_o../..._...',
        ice: 76,
        coreCharges: 5,
        tip: 'Open the twin basalt vaults. Two braziers help, but careful bonus placement and combinations are needed to break all six thick gates.',
      },
    ],
  },
  {
    id: 'fossil-beds',
    name: 'Fossil beds',
    style: 'fossil',
    motif: 'pocket',
    fossilLayers: 1,
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
        board: '......./......./......./..o..../..11.../..11.../......./_....._/_....._',
        ice: 54,
        fossilLayers: 1,
        coreCharges: 4,
        tip: 'Charge the familiar brazier above the fossil to earn a well-placed bomb. Its blast opens the top pieces; craft another bonus to crack the rest and collect the fossil.',
      },
      {
        board: '......./......./......./......./BD...../11_..../11_..../___..../___....',
        ice: 64,
        tip: 'A fossil fills the side alcove. Use a cross along its row or drop a bomb above it. Dark banded rock needs two direct bonus hits.',
      },
      {
        board: '......./......./......./......./BD...DB/11...22/11...22/___D___/___.___',
        ice: 56,
        tip: 'Two deep alcoves need carefully placed bonuses. A cross can reach fossil pieces across the gap; ordinary matches cannot crack their casing.',
      },
      {
        board: '......./......./......./......./DD...DD/11.B.22/11...22/___.___/___.___',
        ice: 58,
        tip: 'Craft bonuses in the wide chamber, then aim them into the narrow excavation shafts. Open the central gate and both fossil beds.',
      },
      {
        board: '......./......./......./......./...B.../..11.../..11.../_....._/_....._',
        ice: 44,
        fossilLayers: 1,
        tip: 'A shorter excavation. Make a bonus to crack the little fossil and its dark rock gate; there is plenty of room to prepare it.',
      },
      {
        board: '......./......./......./......./DD.33DD/11.3322/11...22/___..__/___..__',
        ice: 60,
        tip: 'Three encased fossils guard the deep galleries. Build crosses for the long rows and bombs for the joins; every discovery needs direct bonus hits.',
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
      'Hanging chambers',
      'Deep bloom',
      'Quiet glade',
      'Forest of light',
    ],
    levels: [
      {
        board: '......./......./......./...v.../......./_..D.._/__DhD__/__...__/__...__',
        ice: 52,
        tip: 'Match beside an arrow mushroom to send spores along its whole row or column. The beam can wake another mushroom. Finish thick rock with a direct bonus hit.',
      },
      {
        board: '......./.h...v./......./......./.D.D.h./_....._/__D.D__/__v.h__/__...__',
        ice: 70,
        tip: 'Follow the arrow trail: a row beam can wake a column beam. Choose where to start the chain, then craft bonuses for rock outside the beams.',
      },
      {
        board: '......./......./......./......./D.h.Dv./..._.../.v._.h./D.._..D/..._...',
        ice: 76,
        tip: 'The forest splits into two hanging chambers. Send spores through their rows and columns, then aim bombs into the remaining dark gates.',
      },
      {
        board: '......./......./......./......./_.v.v._/__DhD__/__.B.__/__D.D__/__h.v__',
        ice: 62,
        tip: 'Column beams reach deep into the mushroom stem. A bonus must open the central gate that lies between the beam paths.',
      },
      {
        board: '......./......./......./......./_.h..D_/_....._/__...__/__.v.__/__...__',
        ice: 48,
        tip: 'A quiet glade with two arrow mushrooms. Let their spores help, then place one more bonus against the thick gate.',
      },
      {
        board: '......./......./......./......./Dv.D.vD/..._.../.h._.h./D.._..D/.v._.v.',
        ice: 78,
        tip: 'Wake the spore network in both chambers. Its beams clear long paths, but the dark corner gates need your own well-placed bonuses.',
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
        board: '......./......./......./......./_..B.._/_..K.._/_.KkK._/__.K.__/__...__',
        ice: 54,
        tip: 'Cut the knot with a nearby match to release its connected vines. The dark gate above it needs a direct bomb or cross hit.',
      },
      {
        board: '......./......./......./......./D.....D/.K._.M./KkK_MmM/.K._.M./..._...',
        ice: 72,
        tip: 'Two roots divide the hanging vaults. Cut the useful knot first, then send bonuses into the rock gates at the two entrances.',
      },
      {
        board: '......./.R...R./......./......./.D...D./.K._.M./KkK_MmM/.K._.M./.E._.E.',
        ice: 70,
        tip: 'A relic waits over each vault. Blast the entrance gates, cut the roots and clear beneath the treasures to reach their exits.',
      },
      {
        board: '......./......./......./......./DD...DD/.K._.M./KkK_MmM/.K._.M./..._...',
        ice: 60,
        knotHealth: 2,
        tip: 'The twin shafts have thick entrance gates. Aim bonuses into each entrance, then cut each knot twice to release the hanging vines.',
      },
      {
        board: '......./......./......./......./...D.../_..K.._/_.KkK._/_..K.._/_....._',
        ice: 42,
        tip: 'A sheltered garden vault. Cut one knot and craft a bonus for the thick gate above it.',
      },
      {
        board: '......./.R...R./......./......./BD...DB/.K._.M./KkK_MmM/.K._.M./.E._.E.',
        ice: 58,
        knotHealth: 2,
        tip: 'Free both narrow treasure shafts. Bonuses crack the four entrance gates; cutting each thick knot releases its whole root group.',
      },
    ],
  },
  {
    id: 'underground-reservoir',
    name: 'Underground reservoir',
    style: 'reservoir',
    motif: 'steps',
    gravity: 'funnel',
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
        board: '......./......./......./......./R.....R/_....._/__...__/___B___/___E___',
        ice: 64,
        tip: 'Both pearls flow down the V into one basket. Craft a bomb or cross to break the dark throat gate, then clear the gems beneath the pearls.',
      },
      {
        board: '......./......./......./......./.R...R./_....._/__.B.__/___D___/___E___',
        ice: 70,
        tip: 'One basket, two rock bottlenecks. A bomb beside the neck can hit both gates; the thick lower gate needs two hits.',
      },
      {
        board: '......./......./......./......./R..R..R/_.B.B._/__...__/___D___/___E___',
        ice: 72,
        tip: 'Three pearls share the narrowing bowl. Plan a bonus that opens the side gates and the single throat together.',
      },
      {
        board: '......./......./...R.../......./.R.R.R./_B...B_/__.D.__/___D___/___E___',
        ice: 68,
        tip: 'Four pearls queue for one exit. Open the side mouths with bonuses, then break both thick gates in the neck.',
      },
      {
        board: '......./......./......./......./.R...R./_....._/__...__/___B___/___E___',
        ice: 46,
        tip: 'A quieter pearl pool. One well-placed bonus opens the V-shaped channel to its single basket.',
      },
      {
        board: '......./......./R.....R/......./.R.R.R./_D...D_/__.D.__/___D___/___E___',
        ice: 70,
        tip: 'Five pearls, four thick gates and one basket. Craft crosses and bombs in the wide bowl; aim them into the neck to bring every pearl home.',
      },
    ],
  },
];

// 1–4 mark solid four-piece fossils. k/m/n are root knots; K/M/N are
// their connected vines. h/v are row/column spore relays, o is a brazier.
// _ is permanent void; B/D are one/two-hit blast-only rock gates.
export function parseDeepMineBoard(board, { fossilLayers = 2, knotHealth = 1 } = {}) {
  const rows = board.trim().split(/[\s/]+/);
  if (rows.length !== ROWS || rows.some((row) => row.length !== COLS))
    throw new Error('Deep mine boards must be 7 × 9');
  const cells = [...rows.join('')];
  const cores = [];
  const signals = [];
  const spores = [];
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
    else if (symbol === 'h' || symbol === 'v')
      spores.push({ index, axis: symbol === 'h' ? 'row' : 'column' });
    else if (/[.#XcrbgRE_BD]/.test(symbol)) return symbol;
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
    return { id: `fossil-${id}`, cells: footprint, layers: fossilLayers, encased: true };
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
    spores,
    fossils,
    roots,
  };
}

// Preserve the first published accounting rules for queued/offline victories.
// Layout difficulty is independent of these chest and optional speed targets.
const PUBLISHED_REWARD_TARGETS = [
  [17500, 121000],
  [33500, 163000],
  [35000, 167000],
  [36000, 169000],
  [23000, 135000],
  [36500, 171000],
  [36000, 169000],
  [36500, 170000],
  [36500, 171000],
  [38500, 176000],
  [24500, 139000],
  [42000, 185000],
  [18000, 122000],
  [36500, 171000],
  [37000, 172000],
  [39000, 177000],
  [25000, 140000],
  [39500, 211000],
  [35000, 183000],
  [36500, 203000],
  [38000, 223000],
  [40500, 213000],
  [26000, 175000],
  [41000, 230000],
  [35500, 168000],
  [41500, 183000],
  [39500, 178000],
  [41000, 182000],
  [25500, 141000],
  [43000, 236000],
];

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
export const DEEP_MINE_LEVELS = PLANS.flatMap((plan, chapter) =>
  plan.levels.map(({ board, fossilLayers = plan.fossilLayers, knotHealth, ...level }, phase) => ({
    ...parseDeepMineBoard(board, { fossilLayers, knotHealth }),
    ...level,
    openExitRows: 0,
    maxIceLayers: 2,
    chestTarget: PUBLISHED_REWARD_TARGETS[chapter * 6 + phase][0],
    speedTargetMs: PUBLISHED_REWARD_TARGETS[chapter * 6 + phase][1],
    ...((level.gravity ?? plan.gravity) ? { gravity: level.gravity ?? plan.gravity } : {}),
    coreBonuses: ['bomb'],
    motif: plan.motif,
  })),
);
