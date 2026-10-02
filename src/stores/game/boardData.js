import { markRaw, toRaw } from 'vue';

// The store replaces the board and tile arrays; it never edits them in place. Vue
// only tracks which array is current, so the match engine reads plain objects at
// full speed instead of going through a reactive proxy for every cell.
export const plain = (value) => (Array.isArray(value) ? markRaw(toRaw(value)) : value);

export const plainBoard = (board) => plain(Array.isArray(board) ? toRaw(board) : []);

export const cloneBoard = (board = []) =>
  plain(Array.isArray(board) ? toRaw(board).map((gem) => (gem ? { ...gem } : null)) : []);

// A fresh run restores every authored layer.
export const freshTiles = (tiles = []) =>
  plain(
    Array.isArray(tiles)
      ? tiles.map((tile) => {
          if (!tile) return null;
          const maxHealth = tile.maxHealth ?? tile.health ?? 0;
          return {
            ...tile,
            maxHealth,
            health: maxHealth,
            ...(tile.maxChainHealth != null ? { chainHealth: tile.maxChainHealth } : {}),
            cleared: false,
          };
        })
      : [],
  );

// One move resolves a copy: the current tiles stay on screen until it is committed.
export const workingTiles = (tiles = []) =>
  toRaw(tiles).map((tile) => (tile ? { ...toRaw(tile) } : tile));
