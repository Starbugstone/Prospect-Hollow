import { isAnchored } from './TileRules.js';
import { GEM_TYPES } from './GemFactory.js';
import { dominantGemType, getBonusFusion } from './BonusFusion.js';

export class BonusActivator {
  constructor() {
    this.BONUS_TYPES = new Set([
      'bomb',
      'rainbow',
      'cross',
      'clear_row',
      'transform_gems',
      'unfreeze_all',
      'tnt',
      'color_wand',
      'tile_breaker',
    ]);
  }

  isBonus(type) {
    return this.BONUS_TYPES.has(type);
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
    });
  }

  // Toolbar powers and board bonuses share the same reaction and anchor rules.
  activatePower(type, board, cols, rows, index, tiles = []) {
    if (!Number.isInteger(index) || index < 0 || index >= board.length) return [];
    const targets = this.activateBonus(type, board, cols, rows, index);
    return this.resolveChain(board, cols, rows, { targets, tiles });
  }

  resolveChain(
    board,
    cols,
    rows,
    { targets = [], seeds = [], processed = [], tiles = [], fusion = null },
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
      if (index < 0 || index >= board.length || affected.has(index)) return;
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
    targets.forEach(touch);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const { index, type, context } = queue[cursor];
      if (visited.has(index) || !canFire(index)) continue;
      visited.add(index);
      this.activateBonus(type, board, cols, rows, index, context).forEach(touch);
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
      case 'clear_row':
        return this.activateClearRow(board, cols, rows, index);
      case 'transform_gems':
        return this.activateTransformGems(board, cols, rows, index, context);
      case 'unfreeze_all':
        return this.activateUnfreezeAll(board);
      case 'tnt':
        return this.activateTNT(board, cols, rows, index);
      case 'color_wand':
        return this.activateColorWand(board, cols, rows, index);
      case 'tile_breaker':
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
    const mode = context?.mode ?? 'target';

    if (mode === 'all') {
      board.forEach((cell, i) => {
        if (cell) {
          cleared.add(i);
        }
      });
    } else {
      const targetType = context?.targetType ?? dominantGemType(board);
      board.forEach((cell, i) => {
        if (cell?.type === targetType) cleared.add(i);
      });
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

  activateTransformGems(board, cols, rows, index, context) {
    if (!board || index == null) {
      return [];
    }

    const sourceGem = board[index];
    const targetType = context?.targetType ?? sourceGem?.type;
    if (!targetType) {
      return [];
    }

    const scope = context?.scope ?? 'global';
    const radius = context?.radius ?? 1;
    const cleared = new Set();

    const withinRadius = (row, col) => {
      const centerRow = Math.floor(index / cols);
      const centerCol = index % cols;
      return Math.abs(centerRow - row) + Math.abs(centerCol - col) <= radius;
    };

    const shouldTransform = (i) => {
      const cell = board[i];
      if (!cell || cell.type !== targetType) {
        return false;
      }

      if (scope === 'global') {
        return true;
      }

      const row = Math.floor(i / cols);
      const col = i % cols;

      if (scope === 'cross') {
        const centerRow = Math.floor(index / cols);
        const centerCol = index % cols;
        return row === centerRow || col === centerCol;
      }

      if (scope === 'radius') {
        return withinRadius(row, col);
      }

      return false;
    };

    for (let i = 0; i < board.length; i++) {
      if (shouldTransform(i)) {
        cleared.add(i);
      }
    }

    return [...cleared];
  }

  activateUnfreezeAll(board) {
    const cleared = new Set();
    board.forEach((cell, i) => {
      if (cell?.state === 'FROZEN') {
        cleared.add(i);
      }
    });
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
