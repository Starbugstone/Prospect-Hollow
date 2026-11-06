// Boards on trial before they join the campaign. They sit outside LEVEL_COUNT and the save:
// only the debug tools (development, preprod or VITE_DEBUG_TOOLS builds) can open one, and a
// run on one records nothing. A board joins its chapter in hollowMineLevels.js once played.
import { chapterPalettes, hollowLevelSpec } from './hollowMineLevels.js';
import { prototypeLevelConfig } from '../game/engine/LevelGenerator.js';

// Chapter 94, "The deep lantern" (NEXT_RELEASE.md step 3): breakthrough chambers, phase seals
// and lanterns. Its index among the hollow-mine plans picks the act's color sets.
const DEEP_LANTERN = { chapter: 93, plan: 26, theme: 'breakthrough', motif: 'arch' };

export const PROTOTYPE_BOARDS = [
  {
    key: 'deep-lantern-routes',
    // Where the board would sit: the first level of chapter 94. It also seeds the layout,
    // so the board stays the same if it is appended there.
    id: 559,
    chapterName: 'The deep lantern',
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
];

const ROWS = 10;
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
  const plan = { cols: COLS, rows: ROWS, motif: DEEP_LANTERN.motif };
  return prototypeLevelConfig({
    id: board.id,
    spec: hollowLevelSpec(plan, board.level),
    trial: {
      chapter: DEEP_LANTERN.chapter,
      chapterName: board.chapterName,
      theme: DEEP_LANTERN.theme,
      pace: 'explore',
      cols: COLS,
      rows: ROWS,
      gemTypes: chapterPalettes(DEEP_LANTERN.plan)[0],
    },
  });
}
