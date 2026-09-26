import { MatchEngine } from './MatchEngine.js';
import { BonusActivator } from './BonusActivator.js';
import { canSwapGem, neighborsOf } from './TileRules.js';
import { detectBonusFromMatches } from './MatchPatterns.js';
import { signalTargets } from './ChapterMechanics.js';
const bonusActivator = new BonusActivator();

const SPECIAL = new Set(['bomb', 'cross', 'rainbow']);

export class HintEngine {
  constructor() {
    this.matchEngine = new MatchEngine();
  }

  findBestMove(board, tiles, cols, rows, { first = false, oreOrders = [] } = {}) {
    if (!board?.length || !cols || !rows) return null;
    let best = null;
    const hasSignals = tiles.some((tile) => tile.signalHealth > 0);
    const requested = new Set(
      oreOrders.filter((order) => order.progress < order.target).map((order) => order.color),
    );
    for (let a = 0; a < board.length; a++) {
      for (const b of [a % cols < cols - 1 ? a + 1 : -1, a + cols]) {
        if (
          b < 0 ||
          b >= board.length ||
          !canSwapGem(board[a], tiles[a]) ||
          !canSwapGem(board[b], tiles[b])
        )
          continue;
        const usesBonus = SPECIAL.has(board[a].type) || SPECIAL.has(board[b].type);
        // Bonus swaps are always legal. Never simulate their random clears or refills to suggest a move.
        const evaluation = usesBonus
          ? null
          : this.matchEngine.evaluateSwap(board, cols, rows, a, b, tiles);
        if (!usesBonus && !evaluation.matches.length) continue;
        let createsBonus = !!evaluation?.bonusesCreated.length;
        let ordinaryMatches = evaluation?.matches ?? [];
        let indices = [...new Set(evaluation?.matches.flatMap((match) => match.indices) ?? [a, b])];
        const usesFusion = SPECIAL.has(board[a].type) && SPECIAL.has(board[b].type);
        if (usesFusion) {
          indices = bonusActivator.previewSwap(board, cols, rows, { aIndex: a, bIndex: b }, tiles);
        } else if (usesBonus) {
          const swapped = [...board];
          [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
          const matches = this.matchEngine.findMatches(swapped, cols, rows, tiles);
          ordinaryMatches = matches;
          createsBonus =
            detectBonusFromMatches(matches, { swap: { aIndex: a, bIndex: b } }).length > 0;
          const affected = new Set([a, b, ...matches.flatMap((match) => match.indices)]);
          for (const [index, counterpart] of [
            [a, b],
            [b, a],
          ]) {
            const type = swapped[index].type;
            // Only deterministic geometry/color previews: hints never roll randomness.
            if (type === 'bomb' || type === 'cross') {
              bonusActivator
                .activateBonus(type, swapped, cols, rows, index)
                .forEach((i) => affected.add(i));
            } else if (type === 'rainbow' && !SPECIAL.has(swapped[counterpart].type)) {
              swapped.forEach((gem, i) => {
                if (gem?.type === swapped[counterpart].type) affected.add(i);
              });
            }
          }
          indices = [...affected];
        }
        const nearbyBlocks = new Set();
        for (const index of new Set(ordinaryMatches.flatMap((match) => match.indices))) {
          if (tiles[index]?.state === 'FROZEN') continue;
          for (const neighbor of neighborsOf(index, cols, rows)) {
            if (tiles[neighbor]?.type === 'blocker' && tiles[neighbor].health > 0)
              nearbyBlocks.add(neighbor);
          }
        }
        const damage = indices.reduce(
          (sum, index) =>
            sum +
            Number(
              (tiles[index]?.health ?? 0) > 0 &&
                (!tiles[index]?.sealColor ||
                  usesBonus ||
                  evaluation?.matches.some(
                    (match) =>
                      match.type === tiles[index].sealColor && match.indices.includes(index),
                  )),
            ),
          0,
        );
        const relicPaths = indices.filter((index) =>
          board.some(
            (gem, origin) =>
              gem?.type === 'relic' && origin < index && origin % cols === index % cols,
          ),
        ).length;
        const heuristicScore =
          Number(usesBonus) * 50 +
          Number(usesFusion) * 150 +
          Number(createsBonus) * 100 +
          damage * 120 +
          indices.filter((index) => tiles[index]?.chainHealth > 0).length * 180 +
          nearbyBlocks.size * 180 +
          relicPaths * 90 +
          indices.length +
          (hasSignals ? signalTargets(tiles, indices, cols, rows).length * 190 : 0) +
          (requested.size
            ? indices.filter((index) =>
                requested.has(
                  (index === a ? board[b] : index === b ? board[a] : board[index])?.type,
                ),
              ).length * 90
            : 0);
        const candidate = {
          swap: { aIndex: a, bIndex: b },
          indices: [a, b],
          usesBonus,
          createsBonus,
          totalCleared: indices.length,
          heuristicScore,
        };
        if (first) return candidate;
        if (!best || candidate.heuristicScore > best.heuristicScore) best = candidate;
      }
    }
    if (!best) {
      const index = board.findIndex(
        (gem, i) => SPECIAL.has(gem?.type) && canSwapGem(gem, tiles[i]),
      );
      if (index >= 0)
        return {
          swap: { aIndex: index, bIndex: index },
          indices: [index],
          activateInPlace: true,
          usesBonus: true,
          createsBonus: false,
          totalCleared: this.matchEngine.evaluateActivation(board, cols, rows, index, tiles)
            .matches[0].indices.length,
        };
    }
    return best;
  }
}
