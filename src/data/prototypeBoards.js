// Boards on trial before they join the campaign. They sit outside LEVEL_COUNT and the save:
// only the debug tools (development, preprod or VITE_DEBUG_TOOLS builds) can open one, and a
// run on one records nothing. A board joins its chapter in hollowMineLevels.js once played.
import { chapterPalettes, hollowLevelSpec } from './hollowMineLevels.js';
import { prototypeLevelConfig } from '../game/engine/LevelGenerator.js';

// The chapters of NEXT_RELEASE.md step 3 that have a board on trial. `chapter` is the
// zero-based chapter and `plan` its index among the hollow-mine plans, which picks the act's
// color sets. `theme` borrows a shipped chapter's backdrop and cargo art until the chapter has
// its own.
const TRIAL_CHAPTERS = {
  // Chapter 92: lens mirrors, starglass and portals.
  'echo-gallery': {
    chapter: 91,
    plan: 24,
    name: 'Echo gallery',
    theme: 'moon-gem-freight',
    motif: 'ribbon',
    rows: 9,
  },
  // Chapter 93: moon dials, floatstones and root knots.
  'turning-orchard': {
    chapter: 92,
    plan: 25,
    name: 'Turning orchard',
    theme: 'willowkin-float-grove',
    motif: 'pocket',
    rows: 9,
  },
  // Chapter 94: breakthrough chambers, phase seals and lanterns.
  'deep-lantern': {
    chapter: 93,
    plan: 26,
    name: 'The deep lantern',
    theme: 'breakthrough',
    motif: 'arch',
    rows: 10,
  },
};

TRIAL_CHAPTERS['crystal-seams'] = {
  chapter: 91,
  plan: 24,
  name: 'Crystal seams',
  theme: 'starfall-cavern',
  motif: 'pocket',
  rows: 9,
};

const BOARDS = [
  {
    key: 'deep-lantern-routes',
    // Where the board would sit: the first level of chapter 94. It also seeds the layout,
    // so the board stays the same if it is appended there.
    id: 559,
    trial: 'deep-lantern',
    stop: 'Two ways down',
    // Two ways down to the well (columns 2–3, rows 8–9: two lanterns, two phase seals), which
    // no swap can reach while both routes are shut. The thick block above it (YY) opens a
    // drop shaft: refills fall straight in and the well lights through vertical matches. The
    // thin wall to the right (www) opens a side chamber: the well lights through horizontal
    // matches from beside it. Either opens the well; neither wall counts toward the goal.
    level: {
      board: '......./.z...z./......./......./......./__YY.../__..www/__...../__lZ.../__zl...',
      chambers: [
        { id: 'a', rows: [6, 7], cols: [2, 3], route: true },
        { id: 'b', rows: [7, 9], cols: [4, 6], route: true },
      ],
      ice: 0,
      chestTarget: 20000,
      tip: 'Two lanterns and two phase seals wait in a sealed well at the bottom. Crack the thick block above it to drop straight in, or break the thin wall on the right to reach it from the side. One way in is enough; the other wall can stay.',
    },
  },
  {
    key: 'echo-gallery-crossing',
    // The first level of chapter 92.
    id: 547,
    trial: 'echo-gallery',
    stop: 'Crossed paths',
    // Gems and beams cross the board by different routes. Two moon gems ride the siding
    // (column 0) through the portal and drop down the middle column, which two panes of
    // starglass bar (rows 3 and 5). The beams come from the right wall: the column relay's
    // burst turns at both corner mirrors and runs down each diagonal on to a pane. The thick
    // pane needs a second beam: the floor core gives crosses in line with the lower mirror.
    // No beam's path crosses a portal pad, so a beam never has to answer what a pad does to it.
    level: {
      board: 'R..p..L/......./R....../...*.../......./P..+..v/_....../_....../_..E.oL',
      lenses: ['sw', 'nw'],
      ice: 0,
      orders: [['sapphire', 40]],
      coreBonuses: ['cross'],
      coreCharges: 3,
      chestTarget: 25000,
      tip: 'Two moon gems ride the siding to the portal and drop down the middle, where two panes of starglass bar the way. Fire the mushroom on the right wall: its burst turns at both corner mirrors and crosses the board to the glass. The thick pane needs a second beam, so charge the core on the floor for a cross beside the lower mirror.',
    },
  },
  {
    key: 'turning-orchard-both-ways',
    // The first level of chapter 93.
    id: 553,
    trial: 'turning-orchard',
    stop: 'Up and down',
    // Two moored floatstones with opposite ways out: a sky hatch above the left one, a basket
    // below the right one. A floatstone moves against gravity, so one leaves as the cavern
    // stands and the other only after the moon dial (bottom-left corner) turns gravity over.
    // The knots sit beside their floatstones, clear of both ways out.
    level: {
      board: '..E..../......./......./.k5.6m./......./......./......./......./Q...E..',
      ice: 0,
      chestTarget: 30000,
      tip: 'Two floatstones are moored by root knots, and each has one way out: a hatch above the left one, a basket below the right one. Cut the knots with a match beside them. Floatstones move against gravity, so lift one to its hatch, then hit the moon dial in the corner with a bonus blast to turn gravity over and sink the other to its basket.',
    },
  },
];

BOARDS.push({
  key: 'trace-twins-first-impression',
  id: 548,
  trial: 'crystal-seams',
  stop: 'First impression',
  level: {
    board: '......./......./...t.../......./......./......./..BtB../......./.......',
    ice: 0,
    chestTarget: 7760,
    tip: 'Two matching diamond facets link the stamps. Make a horizontal match on the upper stamp: its copy lands across the lower stamp and the two dark gates beside it. Only your swap fires a stamp; cascades leave it waiting. A vertical match sends a column instead.',
  },
});

BOARDS.push({
  key: 'crossgrain-narrow-neck',
  id: 554,
  trial: 'crystal-seams',
  stop: 'Across the grain',
  level: {
    board: '......./......./...i.../___i___/___i___/_....._/......./......./.......',
    ice: 0,
    chestTarget: 10720,
    tip: 'The crystal neck has no room for horizontal matches. Match down its spine to seal vertical cracks, then aim a bonus at the remaining cracks. In the wide chamber either direction can be matched. Each blast seals only one crack per move.',
  },
});

BOARDS.push({
  key: 'chord-changing-colours',
  id: 560,
  trial: 'crystal-seams',
  stop: 'A changing chord',
  level: {
    board: '......./......./......./..szs../......./......./......./......./.......',
    ice: 0,
    chestTarget: 8000,
    tip: 'Fill each crystal’s three sockets with different colours by matching on it. A repeated colour does nothing. The phase seal between them changes its gem after each move: watch its next colour to prepare a new chord. A direct blast adds one white wildcard socket, once per move.',
  },
});

export const PROTOTYPE_BOARDS = BOARDS.map((board) => ({
  ...board,
  chapterName: TRIAL_CHAPTERS[board.trial].name,
}));

const COLS = 7;

const generated = new Map();

/** A prototype board's name, in the "Chapter: stop" form of LEVEL_NAMES. */
export const prototypeName = (key) => {
  const board = PROTOTYPE_BOARDS.find((entry) => entry.key === key);
  return board ? `${board.chapterName}: ${board.stop}` : '';
};

/** The level configuration of a prototype board, or null for an unknown key. */
export function prototypeConfig(key) {
  const board = PROTOTYPE_BOARDS.find((entry) => entry.key === key);
  if (!board) return null;
  if (!generated.has(key)) generated.set(key, buildPrototype(board));
  return generated.get(key);
}

function buildPrototype(board) {
  const { chapter, plan, name, theme, motif, rows } = TRIAL_CHAPTERS[board.trial];
  return prototypeLevelConfig({
    id: board.id,
    spec: hollowLevelSpec({ cols: COLS, rows, motif }, board.level),
    trial: {
      chapter,
      chapterName: name,
      theme,
      pace: 'explore',
      cols: COLS,
      rows,
      gemTypes: chapterPalettes(plan)[0],
    },
  });
}
