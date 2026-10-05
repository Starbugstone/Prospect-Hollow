import { isAnchored } from './TileRules.js';
import { GEM_TYPES } from './GemFactory.js';
import { dominantGemType, getBonusFusion } from './BonusFusion.js';
import { isPlayableCell } from './BoardTopology.js';

// Board bonuses plus the toolbar powers that share their reaction rules.
const ACTIVATABLE = new Set([
  'bomb',
  'rainbow',
  'cross',
  'clear-row',
  'tnt',
  'color-wand',
  'tile-breaker',
]);

export class BonusActivator {
  isBonus(type) {
    return ACTIVATABLE.has(type);
  }

  previewSwap(board, cols, rows, swap, tiles = []) {
    if (!swap || swap.aIndex == null || swap.bIndex == null) {
      return [];
    }

    if (!Array.isArray(board) || !board.length) {
      return [];
    }

    const clonedBoard = board.map((cell) => (cell ? { ...cell } : null));

    const maxIndex = clonedBoard.length - 1;
    const { aIndex, bIndex } = swap;
    if (aIndex >= 0 && bIndex >= 0 && aIndex <= maxIndex && bIndex <= maxIndex) {
      [clonedBoard[aIndex], clonedBoard[bIndex]] = [clonedBoard[bIndex], clonedBoard[aIndex]];
    }

    return this.activate(clonedBoard, cols, rows, swap, undefined, null, tiles) ?? [];
  }

  activate(
    board,
    cols,
    rows,
    swap,
    fusion = getBonusFusion(board, cols, rows, swap),
    swapGems = null,
    tiles = [],
    blasts = null,
  ) {
    if (!swap) return [];
    const { a, b } = swapGems ?? { a: board[swap.aIndex], b: board[swap.bIndex] };
    const seeds = fusion
      ? []
      : [
          [swap.aIndex, a, b],
          [swap.bIndex, b, a],
        ]
          .filter(([, gem]) => this.isBonus(gem?.type))
          .map(([index, gem, counterpart]) => ({
            index,
            type: gem.type,
            context:
              gem.type === 'rainbow'
                ? {
                    randomCrates: swap.bIndex === -1,
                    targetType: GEM_TYPES.includes(counterpart?.type)
                      ? counterpart.type
                      : dominantGemType(board),
                  }
                : {},
          }));
    return this.resolveChain(board, cols, rows, {
      tiles,
      fusion,
      seeds,
      targets: fusion?.targets ?? [],
      processed: fusion ? [swap.aIndex, swap.bIndex] : [],
      blasts,
    });
  }

  // Toolbar powers and board bonuses share the same reaction and anchor rules.
  activatePower(type, board, cols, rows, index, tiles = [], blasts = null) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= board.length ||
      !isPlayableCell(tiles[index])
    )
      return [];
    const targets = this.activateBonus(type, board, cols, rows, index, { tiles });
    return this.resolveChain(board, cols, rows, { targets, tiles, blasts });
  }

  // `blasts`, when given, is a Map that counts how many separate blasts reach each
  // affected cell: the initial targets count as one, then one per bonus fired.
  resolveChain(
    board,
    cols,
    rows,
    { targets = [], seeds = [], processed = [], tiles = [], fusion = null, blasts = null },
  ) {
    const affected = new Set();
    const visited = new Set(processed);
    const queue = [...seeds];
    const fusionTargets = new Set(fusion?.targets ?? []);
    const canFire = (index) => {
      const tile = tiles[index];
      if (!isAnchored(tile)) return true;
      // A fusion thaws first and spends its two hits on chains before the gem.
      const hits = 2 - (tile?.chainHealth ?? 0);
      return (
        fusionTargets.has(index) && hits > 0 && (tile?.type !== 'blocker' || tile.health <= hits)
      );
    };
    const touch = (index) => {
      if (
        index < 0 ||
        index >= board.length ||
        affected.has(index) ||
        !isPlayableCell(tiles[index])
      )
        return;
      affected.add(index);
      const gem = board[index];
      if (this.isBonus(gem?.type) && !visited.has(index)) {
        queue.push({
          index,
          type: gem.type,
          context: { targetType: fusion?.targetType ?? dominantGemType(board) },
        });
      }
    };
    const blast = (indices) => {
      indices.forEach(touch);
      if (blasts)
        for (const index of new Set(indices))
          if (affected.has(index)) blasts.set(index, (blasts.get(index) ?? 0) + 1);
    };
    blast(targets);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const { index, type, context } = queue[cursor];
      if (visited.has(index) || !canFire(index)) continue;
      visited.add(index);
      blast(this.activateBonus(type, board, cols, rows, index, { ...context, tiles }));
    }
    return [...affected];
  }

  activateBonus(type, board, cols, rows, index, context = {}) {
    switch (type) {
      case 'bomb':
        return this.activateBomb(board, cols, rows, index);
      case 'cross':
        return this.activateCross(board, cols, rows, index);
      case 'rainbow':
        return this.activateRainbow(board, cols, rows, index, context);
      case 'clear-row':
        return this.activateClearRow(board, cols, rows, index);
      case 'tnt':
        return this.activateTNT(board, cols, rows, index);
      case 'color-wand':
        return this.activateColorWand(board, cols, rows, index);
      case 'tile-breaker':
        return this.activateTileBreaker(board, cols, rows, index);
      default:
        return [index];
    }
  }

  previewBonus(type, board, cols, rows, index, tiles = []) {
    if (!Array.isArray(board)) return [];
    return this.activatePower(type, board, cols, rows, index, tiles);
  }

  activateBomb(board, cols, rows, index) {
    const cleared = new Set();
    const row = Math.floor(index / cols);
    const col = index % cols;
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          cleared.add(r * cols + c);
        }
      }
    }
    return [...cleared];
  }

  activateRainbow(board, cols, rows, index, context) {
    const cleared = new Set();
    const targetType = context?.targetType ?? dominantGemType(board);
    board.forEach((cell, i) => {
      if (cell?.type === targetType) cleared.add(i);
    });
    // Blast-only crates have no gem colour. Every rainbow reaches one;
    // a double-tap rolls a nonempty subset of the remaining crates.
    const crates = (context?.tiles ?? []).flatMap((tile, i) =>
      i < board.length &&
      isPlayableCell(tile) &&
      tile.type === 'blocker' &&
      tile.bonusOnly &&
      tile.health > 0 &&
      tile.state !== 'FROZEN'
        ? [i]
        : [],
    );
    if (crates.length) {
      const count = context?.randomCrates ? 1 + Math.floor(Math.random() * crates.length) : 1;
      for (let n = 0; n < count; n++) {
        const pick = context?.randomCrates ? Math.floor(Math.random() * crates.length) : 0;
        cleared.add(crates.splice(pick, 1)[0]);
      }
    }
    cleared.add(index);
    return [...cleared];
  }

  activateCross(board, cols, rows, index) {
    const cleared = new Set();
    const row = Math.floor(index / cols);
    const col = index % cols;
    for (let i = 0; i < cols; i++) {
      cleared.add(row * cols + i);
    }
    for (let i = 0; i < rows; i++) {
      cleared.add(i * cols + col);
    }
    cleared.add(index);
    return [...cleared];
  }

  activateClearRow(board, cols, rows, index) {
    const cleared = new Set();
    const row = Math.floor(index / cols);
    for (let i = 0; i < cols; i++) {
      cleared.add(row * cols + i);
    }
    return [...cleared];
  }

  activateTNT(board, cols, rows, index) {
    return this.activateBomb(board, cols, rows, index);
  }

  activateColorWand(board, cols, rows, index) {
    const targetGem = board[index];
    if (!GEM_TYPES.includes(targetGem?.type)) return [];

    const cleared = new Set();
    board.forEach((gem, i) => {
      if (gem && gem.type === targetGem.type) {
        cleared.add(i);
      }
    });
    return [...cleared];
  }

  activateTileBreaker(board, cols, rows, index) {
    return this.activateCross(board, cols, rows, index);
  }
}
