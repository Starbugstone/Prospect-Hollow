import { cargoReachesExit } from '../../src/game/engine/GravityFrames';
import { bentBeams } from '../../src/game/engine/LensBeams';

// Layout rules that every hollow-mine board follows, shipped or on trial.

// Ice layers on a cell; stone, seals and fossils keep their health for themselves.
export const iceLayers = (tile) =>
  tile.type !== 'blocker' && !tile.sealColor && !tile.phaseSeal && tile.fossilGroup == null
    ? tile.health
    : 0;
// The board as it is once every sealed chamber has been broken into.
export const opened = (tiles) => tiles.map((tile) => ({ ...tile, sealed: false }));
// The board after a gravity switch turns it over.
export const flipped = (tiles) =>
  tiles.map((tile) =>
    tile.type === 'void' ? tile : { ...tile, fall: tile.fall === 'up' ? undefined : 'up' },
  );
// A level whose goal is lighting lanterns or delivering cargo carries no ice.
export const isExtraction = (level) =>
  level.board.some((gem) => gem?.type === 'relic') ||
  level.tiles.some((tile) => tile.signal === 'lantern' || tile.signal === 'survey');

// The gravity states a level can be in: either with a moon dial, flipped for good after a
// moon lock, otherwise as authored.
function gravityStates(tiles) {
  const dial = tiles.some((tile) => tile.gravitySwitch === 'dial');
  const lock = tiles.some((tile) => tile.gravitySwitch === 'lock');
  return dial ? [tiles, flipped(tiles)] : lock ? [flipped(tiles)] : [tiles];
}
// Cargo cells (relics and floatstones) with no route to an exit in any gravity the level
// can reach, once every chamber is open.
export function strandedCargo({ board, tiles, boardCols: cols, boardRows: rows }) {
  const states = gravityStates(opened(tiles));
  return board.flatMap((gem, index) =>
    gem?.type === 'relic' &&
    !states.some((state) => cargoReachesExit(board, state, index, cols, rows))
      ? [index]
      : [],
  );
}
// Every turned segment a row or column sweep can make on this board: `{ line, lens, cells }`.
export function turnedBeams({ tiles, boardCols: cols, boardRows: rows }) {
  const open = opened(tiles);
  return [
    ...Array.from({ length: rows }, (_, index) => ({ axis: 'row', index })),
    ...Array.from({ length: cols }, (_, index) => ({ axis: 'column', index })),
  ].flatMap((line) => bentBeams(open, cols, rows, [line]).beams.map((beam) => ({ line, ...beam })));
}
// Starglass cells that no row or column sweep reaches through the lenses.
export function unreachableStarglass(level) {
  const reach = new Set(turnedBeams(level).flatMap((beam) => beam.cells));
  return level.tiles.flatMap((tile, index) => (tile.lensOnly && !reach.has(index) ? [index] : []));
}
