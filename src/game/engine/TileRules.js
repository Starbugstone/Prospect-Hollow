import { drainsToExit, isPlayableCell } from './BoardTopology.js';

// Bonus gems a player can swap or double-tap on the board.
export const BOARD_BONUSES = Object.freeze(['bomb', 'cross', 'rainbow']);

export const isAnchored = (tile) =>
  !isPlayableCell(tile) ||
  tile?.state === 'FROZEN' ||
  (tile?.chainHealth ?? 0) > 0 ||
  (tile?.type === 'blocker' && tile.health > 0);

export const canSwapGem = (gem, tile) => !!gem && gem.type !== 'relic' && !isAnchored(tile);

// Relics never match, but a board bonus may trade places with one and fire,
// provided the relic can still fall to an exit from the bonus's cell.
export function canSwapCells(board, tiles, aIndex, bIndex, cols, rows) {
  const free = (index) => canSwapGem(board[index], tiles[index]);
  if (free(aIndex) && free(bIndex)) return true;
  const [relic, bonus] = board[aIndex]?.type === 'relic' ? [aIndex, bIndex] : [bIndex, aIndex];
  return (
    board[relic]?.type === 'relic' &&
    !isAnchored(tiles[relic]) &&
    BOARD_BONUSES.includes(board[bonus]?.type) &&
    free(bonus) &&
    drainsToExit(tiles, bonus, cols, rows)
  );
}

export const layerCount = (tile) =>
  isPlayableCell(tile)
    ? (tile?.health ?? 0) + (tile?.chainHealth ?? 0) + (tile?.signalHealth ?? 0)
    : 0;

export const neighborsOf = (index, cols, rows) =>
  [
    index % cols > 0 ? index - 1 : -1,
    index % cols < cols - 1 ? index + 1 : -1,
    index - cols,
    index + cols,
  ].filter((neighbor) => neighbor >= 0 && neighbor < cols * rows);

// Orthogonal neighbours on a board `cols` wide.
export const isAdjacent = (a, b, cols) =>
  Math.abs((a % cols) - (b % cols)) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) === 1;
