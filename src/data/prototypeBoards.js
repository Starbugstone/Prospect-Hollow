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
  // Chapter 95: survey markers and phase seals.
  'shifting-survey': {
    chapter: 94,
    plan: 27,
    name: 'Shifting survey',
    theme: 'starlit-survey',
    motif: 'steps',
    rows: 9,
  },
  // Chapter 96: charge cores, portals and moon gems.
  'ember-sidings': {
    chapter: 95,
    plan: 28,
    name: 'Ember sidings',
    theme: 'portal-sidings',
    motif: 'pocket',
    rows: 9,
  },
  // Chapter 97: fossils and route chambers.
  'buried-routes': {
    chapter: 96,
    plan: 29,
    name: 'Buried routes',
    theme: 'moondust-beds',
    motif: 'arch',
    rows: 10,
  },
  // Chapter 98 opens act VI, whose color sets start at plan 30: frozen gems and spore
  // relays. Lanterns were proposed too, but a frozen gem sits on ice and a lantern board
  // carries none, so this board leaves them out (see docs/hollow-mine-levels.md).
  'frost-relays': {
    chapter: 97,
    plan: 30,
    name: 'Frost relays',
    theme: 'comet-frost',
    motif: 'ribbon',
    rows: 9,
  },
  // Chapter 99: twin gravity, pearls and one ore order.
  'tidal-pearls': {
    chapter: 98,
    plan: 31,
    name: 'Tidal pearls',
    theme: 'twin-gravity',
    motif: 'twins',
    rows: 9,
  },
  // Chapter 100: root knots, a breakthrough chamber and chains.
  'rooted-vault': {
    chapter: 99,
    plan: 32,
    name: 'Rooted vault',
    theme: 'elevator-foundations',
    motif: 'twins',
    rows: 10,
  },
  // Chapter 101, the pack's finale: lenses, a moon dial and route chambers.
  'far-seam': {
    chapter: 100,
    plan: 33,
    name: 'The far seam',
    theme: 'starfall-cavern',
    motif: 'pool',
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
  {
    key: 'shifting-survey-stars',
    // The first level of chapter 95.
    id: 565,
    trial: 'shifting-survey',
    stop: 'Shifting stars',
    // A trail of eight survey markers, each beside a double phase seal (Z). A marker lights
    // from a match on or beside it, so most matches that light one run through its seal,
    // whose gem changes color after every move. A change that lines up a match beside the
    // next marker lights it for free; beside a later marker it lights nothing yet. The
    // trail runs up the left side from the bottom corner, across the top and down the right.
    level: {
      board: 'lZ...Zl/......./..ZlZ../......./lZ...Zl/......./..ZlZ../......./lZ...Zl',
      survey: true,
      surveyOrder: [5, 6, 4, 3, 7, 2, 1, 8],
      ice: 0,
      orders: [['sapphire', 40]],
      chestTarget: 28500,
      tip: 'Eight survey markers make a trail, starting in the bottom left corner, and a double phase seal sits beside each one. Light the markers in numbered order with a match on or beside them. Each seal changes its gem to the color in its corner after every move, so line up the match it will finish. Fill the sapphire order as you go.',
    },
  },
  {
    key: 'ember-sidings-gates',
    // The first level of chapter 96.
    id: 571,
    trial: 'ember-sidings',
    stop: 'Banked fires',
    // Two moon gems ride the siding (column 0) through the portal and drop down the middle
    // column, where two thick gates (D) stand between the exit pad and the basket. A brazier
    // sits either side of the column, between the gates: its bomb lands on its own cell and
    // its blast reaches both gates. Both bombs break both gates. No blast from either
    // brazier's cell covers a portal pad.
    level: {
      board: 'R..p.../......./R....../......./...D.../..o.o../P..D.../_....../_..E...',
      ice: 0,
      orders: [['sapphire', 40]],
      chestTarget: 26000,
      tip: 'Two moon gems ride the siding to the portal and drop down the middle, where two thick gates bar the way to the basket. Charge the braziers either side of the column with matches on or beside them: each one gives a bomb that reaches both gates. Fill the sapphire order as you go.',
    },
  },
  {
    key: 'buried-routes-bed',
    // The first level of chapter 97.
    id: 577,
    trial: 'buried-routes',
    stop: 'Shaft or gallery',
    // Two fossils under moon dust (rows 8–9, columns 1–2 and 4–5), either side of a sealed
    // shaft (column 3, chamber a) and below a sealed gallery (rows 6–7, chamber b). No swap
    // reaches the bed while both are shut. The single thick block (Y) opens the shaft, where
    // matches across its foot brush both fossils from the side. The four thin walls (w) open
    // the gallery, where matches brush them from above. Either route reaches both fossils.
    level: {
      board: '......./......./......./......./......./.wwYww./_....._/_....._/_11.22_/_11.22_',
      chambers: [
        { id: 'b', rows: [6, 7], cols: [1, 5], route: true },
        // Listed second, so the shaft's cells in rows 6–7 belong to it, not to the gallery.
        { id: 'a', rows: [6, 9], cols: [3, 3], route: true },
      ],
      dust: true,
      fossilLayers: 1,
      ice: 0,
      chestTarget: 30000,
      tip: 'Two fossils lie under moon dust in a sealed bed, either side of a narrow shaft. Crack the thick block in the middle to open the shaft and brush both from the side, or break the four thin walls to open the gallery above them. One way in is enough; match on the dust to brush it away.',
    },
  },
  {
    key: 'frost-relays-chain',
    // The first level of chapter 98.
    id: 583,
    trial: 'frost-relays',
    stop: 'Relay chain',
    // Four bands of frozen gems (rows 1, 3, 5 and 7). The column relay in the middle (v)
    // bursts down column 3, through both row relays (h), which burst along rows 2 and 6.
    // Every cleared cell thaws the frozen gems beside it, so one chain thaws all four bands.
    // A burst never breaks the ice under a frozen gem: that still takes a match once thawed.
    level: {
      board: '......./.fffff./...h.../.fffff./...v.../.fffff./...h.../.fffff./.......',
      ice: 40,
      chestTarget: 23500,
      tip: 'Four bands of frozen gems, and three mushrooms between them. Match beside the mushroom in the middle: its burst runs down the column and wakes the other two, and every burst thaws the gems beside it. A thawed gem still sits on ice, so match on it to clear it.',
    },
  },
  {
    key: 'tidal-pearls-pairs',
    // The first level of chapter 99.
    id: 589,
    trial: 'tidal-pearls',
    stop: 'Ebb and flow',
    // Two pairs of pearls meet at the seam (rows 3 and 4, columns 1 and 5). The top half
    // falls up and the bottom half falls down, so each pair parts: the upper pearl rises to
    // a hatch, the lower one sinks to a basket. Refills pour out of the seam between them.
    level: {
      board: '.E...E./......./......./.R...R./.R...R./......./......./......./.E...E.',
      gravity: 'split',
      ice: 0,
      orders: [['emerald', 40]],
      chestTarget: 24000,
      tip: 'Two pairs of pearls meet at the seam. The top half falls up and the bottom half falls down, so each pair parts: the upper pearl rises to a hatch and the lower one sinks to a basket. Clear between each pearl and its rim, and fill the emerald order as you go.',
    },
  },
  {
    key: 'rooted-vault-knots',
    // The first level of chapter 100.
    id: 595,
    trial: 'rooted-vault',
    stop: 'Bound shut',
    // Three root knots and their vines fill the row above the cracked wall (row 5), so no
    // gem there can be swapped until its knot is cut. A match beside a knot cuts it; a vine
    // also breaks on its own when matched. Behind the wall, the chamber holds three chained
    // gems.
    level: {
      board: '......./......./......./......./.M.K.N./MmKkKnN/__WWW__/......./.c.c.c./.......',
      chambers: [{ rows: [7, 9] }],
      ice: 0,
      chestTarget: 34500,
      tip: 'Roots grip the row above the cracked wall of a sealed chamber, pinning every gem there. Cut the three knots with matches beside them, then blast the wall with bonuses to break in and free the chained gems below.',
    },
  },
  {
    key: 'far-seam-either-way',
    // The first level of chapter 101.
    id: 601,
    trial: 'far-seam',
    stop: 'Either way out',
    // A floatstone (column 3, row 4) between two sealed shafts: a thick wall above leads to
    // the hatch, a thin wall below to the basket. A floatstone moves against gravity, so the
    // way up works as the cavern stands and the way down only once the moon dial (bottom-left
    // corner) turns gravity over. Gold prisms in the four corners turn row beams diagonally
    // on to the walls: the top pair on to the thick one, the bottom pair on to the thin one,
    // and the floor brazier gives crosses along the bottom pair's row. No turned beam crosses
    // the dial or a sealed shaft cell, so a beam never has to answer what either does to it.
    level: {
      board: 'L..E..L/......./......./...Y.../...F.../...w.../......./......./L.o...L/Q..E...',
      lenses: ['se', 'sw', 'ne', 'nw'],
      chambers: [
        { id: 'a', rows: [1, 2], cols: [3, 3], route: true },
        { id: 'b', rows: [6, 8], cols: [3, 3], route: true },
      ],
      coreBonuses: ['cross'],
      ice: 0,
      chestTarget: 11000,
      tip: 'A floatstone waits between two sealed shafts: a thick wall above leads to the hatch, a thin wall below to the basket. Floatstones rise, so break in above and lift it out, or break in below and blast the moon dial in the corner to turn gravity over and sink it. The gold prisms in the corners turn beams on to the walls; the brazier on the floor gives crosses along their row.',
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

BOARDS.push(
  {
    key: 'arrowhead-inner-spring',
    id: 549,
    trial: 'crystal-seams',
    stop: 'The inner spring',
    level: {
      board: '...____/.....__/......./__...../____.../__...../......./.....__/...____',
      ice: 26,
      chestTarget: 10480,
      tip: 'The cavern points like a crystal arrowhead. Clear the ice on both wings and the point. The lower-left wing refills from its own spring inside the cavern; gems never cross the missing cells. Craft in the broad shelves to reach the narrow ends.',
    },
  },
  {
    key: 'twin-windows-crafting-spine',
    id: 555,
    trial: 'crystal-seams',
    stop: 'Between two windows',
    level: {
      board: '......./......./......./._..._./._..._./......./......./......./.......',
      ice: 30,
      chestTarget: 14240,
      tip: 'Two short windows leave a three-cell-wide crystal spine. Craft matches in the spine or the broad chambers above and below. Each column below a window refills on its own; use the open sides to reach the remaining ice.',
    },
  },
);

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
