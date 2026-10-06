import { BonusActivator } from './BonusActivator.js';
import { applyBonuses, detectBonusFromMatches } from './MatchPatterns.js';
import { BOARD_BONUSES, canSwapCells, canSwapGem, isAdjacent } from './TileRules.js';
import { getBonusFusion } from './BonusFusion.js';
import { isPlayableCell } from './BoardTopology.js';

const bonusActivator = new BonusActivator();
const noMatch = (board, cols, rows) => ({
  matches: [],
  board,
  cols,
  rows,
  swap: null,
  bonuses: [],
});
export class MatchEngine {
  evaluateActivation(board, cols, rows, index, tiles = []) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= board.length ||
      !BOARD_BONUSES.includes(board[index]?.type) ||
      !canSwapGem(board[index], tiles[index])
    )
      return noMatch(board, cols, rows);
    const blasts = new Map();
    const indices = bonusActivator.activate(
      board,
      cols,
      rows,
      { aIndex: index, bIndex: -1 },
      null,
      null,
      tiles,
      blasts,
    );
    return {
      ...noMatch(board, cols, rows),
      matches: [{ type: 'bonus-activation', indices, blasts }],
    };
  }

  evaluateSwap(board, cols, rows, aIndex, bIndex, tiles = []) {
    if (
      !Number.isInteger(aIndex) ||
      !Number.isInteger(bIndex) ||
      aIndex < 0 ||
      bIndex < 0 ||
      aIndex >= board.length ||
      bIndex >= board.length ||
      aIndex === bIndex ||
      !isAdjacent(aIndex, bIndex, cols) ||
      !canSwapCells(board, tiles, aIndex, bIndex, cols, rows)
    )
      return noMatch(board, cols, rows);

    const nextBoard = [...board];
    [nextBoard[aIndex], nextBoard[bIndex]] = [nextBoard[bIndex], nextBoard[aIndex]];

    const swap = { aIndex, bIndex };
    const matches = this.findMatches(nextBoard, cols, rows, tiles);
    const fusion = getBonusFusion(nextBoard, cols, rows, swap);
    const swapGems = { a: nextBoard[aIndex], b: nextBoard[bIndex] };
    const usesBonus =
      bonusActivator.isBonus(swapGems.a.type) || bonusActivator.isBonus(swapGems.b.type);
    // Keep the swapped pair separate from bonuses caught in the chain reaction.
    const bonusSwap =
      bonusActivator.isBonus(swapGems.a.type) && bonusActivator.isBonus(swapGems.b.type)
        ? [aIndex, bIndex].map((index) => ({ index, type: nextBoard[index].type }))
        : null;
    // Remember the original pair before a matched jewel becomes a new bonus.
    const pendingBonus = matches.length && usesBonus ? { swap, fusion, swapGems } : null;
    const blasts = new Map();
    const bonusClear = pendingBonus
      ? []
      : bonusActivator.activate(nextBoard, cols, rows, swap, fusion, null, tiles, blasts);
    if (bonusClear.length > 0) {
      return {
        matches: [
          { type: 'bonus-activation', indices: bonusClear, blasts, ...(fusion ? { fusion } : {}) },
        ],
        board: nextBoard,
        cols,
        rows,
        swap,
        bonusSwap,
        bonuses: [],
      };
    }

    if (!matches.length) return noMatch(board, cols, rows);

    return {
      matches,
      board: nextBoard,
      cols,
      rows,
      swap,
      bonuses: applyBonuses(nextBoard, detectBonusFromMatches(matches, { swap })),
      ...(pendingBonus ? { pendingBonus, bonusSwap } : {}),
    };
  }

  findMatches(board, cols, rows, tiles = []) {
    const matches = [];
    const total = board.length;

    // Bonuses survive passive alignments; only activation can consume them.
    const typeAt = (index) =>
      isPlayableCell(tiles[index]) &&
      board[index]?.type !== 'relic' &&
      !bonusActivator.isBonus(board[index]?.type)
        ? board[index]?.type
        : null;

    for (let index = 0; index < total; index += 1) {
      const gem = board[index];
      if (!gem || !typeAt(index)) {
        continue;
      }

      const row = Math.floor(index / cols);
      const col = index % cols;

      // Horizontal run – only evaluate if this cell is the leftmost in the run
      const leftIndex = index - 1;
      const leftSame = col > 0 && typeAt(leftIndex) === gem.type;
      if (!leftSame) {
        const horizontal = [index];
        let cursor = index + 1;
        while (cursor % cols !== 0 && typeAt(cursor) === gem.type) {
          horizontal.push(cursor);
          cursor += 1;
        }
        if (horizontal.length >= 3) {
          matches.push({ type: gem.type, indices: horizontal, orientation: 'horizontal' });
        }
      }

      // Vertical run – only evaluate if this cell is the topmost in the run
      const upperIndex = index - cols;
      const upperSame = row > 0 && typeAt(upperIndex) === gem.type;
      if (!upperSame) {
        const vertical = [index];
        let cursor = index + cols;
        while (cursor < total && typeAt(cursor) === gem.type) {
          vertical.push(cursor);
          cursor += cols;
        }
        if (vertical.length >= 3) {
          matches.push({ type: gem.type, indices: vertical, orientation: 'vertical' });
        }
      }
    }

    return matches;
  }
}
