// Boards on trial: only the debug tools (development, preprod or VITE_DEBUG_TOOLS builds) open
// one, from the village and without unlocking it, and a run on one records nothing.
//
// Every board that was on trial here has joined chapters 92–101 (src/data/crystalSeamLevels.js)
// at the level number it was measured with. Each entry now names that campaign level and plays
// its configuration, so a trial and its level cannot drift apart. They stay listed for the phone
// checks still open in NEXT_RELEASE.md (step 3), which a tester runs from Settings without
// reaching level 547; remove an entry once its board has been played on a phone.
import { CRYSTAL_SEAM_FIRST_LEVEL, CRYSTAL_SEAM_PLANS } from './crystalSeamLevels.js';
import { levelConfig } from '../game/engine/LevelGenerator.js';

const TRIALS = [
  ['deep-lantern-routes', 559],
  ['echo-gallery-crossing', 547],
  ['turning-orchard-both-ways', 553],
  ['shifting-survey-stars', 565],
  ['ember-sidings-gates', 571],
  ['buried-routes-bed', 577],
  ['frost-relays-grain', 583],
  ['tidal-pearls-chords', 589],
  ['rooted-vault-knots', 595],
  ['far-seam-traces', 601],
  ['trace-twins-first-impression', 548],
  ['crossgrain-narrow-neck', 554],
  ['chord-changing-colours', 560],
  ['arrowhead-inner-spring', 549],
  ['twin-windows-crafting-spine', 555],
];

const authored = CRYSTAL_SEAM_PLANS.flatMap((plan) =>
  plan.levels.map((level, slot) => ({ chapterName: plan.name, stop: plan.stops[slot], level })),
);

// `level` is the authored level of crystalSeamLevels.js, for tests that rebuild a variant of it.
export const PROTOTYPE_BOARDS = TRIALS.map(([key, id]) => ({
  key,
  id,
  ...authored[id - CRYSTAL_SEAM_FIRST_LEVEL],
}));

const find = (key) => PROTOTYPE_BOARDS.find((entry) => entry.key === key);

/** A board on trial's name, its campaign level's "Chapter: stop" name. */
export const prototypeName = (key) => {
  const board = find(key);
  return board ? `${board.chapterName}: ${board.stop}` : '';
};

/** The level configuration of a board on trial (its campaign level's), or null. */
export function prototypeConfig(key) {
  const board = find(key);
  return board ? levelConfig(board.id) : null;
}
