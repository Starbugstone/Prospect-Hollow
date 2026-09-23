import { createGem, GEM_TYPES } from './GemFactory.js';
import { MatchEngine } from './MatchEngine.js';
import { canSwapGem, isAnchored, neighborsOf } from './TileRules.js';

const engine = new MatchEngine();

// Construct a legal swap from existing pieces after random reshuffles fail.
// Relics, holes and anchors retain their positions; jewel identities are conserved.
export function recoverBoard(board, tiles, cols, rows) {
  const movable = board.flatMap((gem, i) => (canSwapGem(gem, tiles[i]) ? [i] : []));
  const movableSet = new Set(movable);
  for (const a of movable) {
    for (const b of neighborsOf(a, cols, rows).filter((i) => movableSet.has(i))) {
      for (const stride of [1, cols]) {
        for (let offset = -2; offset <= 0; offset++) {
          const line = [0, 1, 2].map((n) => a + (offset + n) * stride);
          if (
            line.includes(b) ||
            line.some((i) => i < 0 || i >= board.length || !board[i] || board[i].type === 'relic')
          )
            continue;
          if (stride === 1 && line.some((i) => Math.floor(i / cols) !== Math.floor(a / cols)))
            continue;
          const targets = [...line.filter((i) => i !== a), b];
          for (const color of GEM_TYPES) {
            const next = [...board];
            const fixed = new Set(targets.filter((i) => !movableSet.has(i)));
            if ([...fixed].some((i) => next[i].type !== color)) continue;
            let possible = true;
            for (const index of targets) {
              if (fixed.has(index)) continue;
              const donor = movable.find((i) => !fixed.has(i) && next[i].type === color);
              if (donor === undefined) {
                possible = false;
                break;
              }
              [next[index], next[donor]] = [next[donor], next[index]];
              fixed.add(index);
            }
            if (!possible) continue;
            if (next[a].type === color) {
              const donor = movable.find((i) => !fixed.has(i) && next[i].type !== color);
              if (donor === undefined) continue;
              [next[a], next[donor]] = [next[donor], next[a]];
            }
            if (
              !engine.findMatches(next, cols, rows).length &&
              engine.evaluateSwap(next, cols, rows, a, b, tiles).matches.length
            )
              return next;
          }
        }
      }
    }
  }
  // Sparse chambers may not have enough movable jewels for any match pattern.
  // A free cross provides an in-place action without moving an anchor or relic.
  const index =
    movable.find((i) => GEM_TYPES.includes(board[i].type)) ??
    board.findIndex((gem, i) => !gem && !isAnchored(tiles[i]));
  if (index >= 0) {
    const next = [...board];
    next[index] = createGem('cross');
    return next;
  }
  return null;
}
