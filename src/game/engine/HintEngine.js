import { MatchEngine } from './MatchEngine.js';
import { BonusActivator } from './BonusActivator.js';
import { BOARD_BONUSES, canSwapGem, neighborsOf } from './TileRules.js';
import { detectBonusFromMatches } from './MatchPatterns.js';
import { signalTargets } from './ChapterMechanics.js';
import { isPlayableCell, isRoutedBoard } from './BoardTopology.js';
import { cargoPath, flipGain, isGravitySwitch, usesGravityFrames } from './GravityFrames.js';
const bonusActivator = new BonusActivator();

const SPECIAL = new Set(BOARD_BONUSES);

export class HintEngine {
  constructor() {
    this.matchEngine = new MatchEngine();
  }

  findBestMove(board, tiles, cols, rows, { first = false, oreOrders = [] } = {}) {
    if (!board?.length || !cols || !rows) return null;
    let best = null;
    const hasSignals = tiles.some((tile) => tile.signalHealth > 0);
    const hasBlastTargets = tiles.some((tile) => tile?.bonusOnly && tile.health > 0);
    const routed = isRoutedBoard(tiles) || usesGravityFrames(board, tiles);
    // Clearing a cell on a relic's route (or above a floatstone) moves it on.
    const relicRoutes = routed
      ? board.flatMap((gem, origin) =>
          gem?.type === 'relic'
            ? [new Set(cargoPath(board, tiles, origin, cols, rows).slice(1))]
            : [],
        )
      : [];
    // A bonus that reaches a gravity switch is worth what the flip frees or strands.
    const switches = tiles.some(isGravitySwitch);
    const flipValue = switches ? flipGain(board, tiles, cols, rows) * 700 : 0;
    const requested = new Set(
      oreOrders.filter((order) => order.progress < order.target).map((order) => order.color),
    );
    const scoreImpact = (
      indices,
      {
        usesBonus = false,
        usesFusion = false,
        createsBonus = false,
        ordinaryMatches = [],
        evaluation = null,
        swap = null,
        bent = null,
      } = {},
    ) => {
      const nearbyBlocks = new Set();
      for (const index of new Set(ordinaryMatches.flatMap((match) => match.indices))) {
        if (tiles[index]?.state === 'FROZEN') continue;
        for (const neighbor of neighborsOf(index, cols, rows))
          if (
            tiles[neighbor]?.type === 'blocker' &&
            tiles[neighbor].health > 0 &&
            !tiles[neighbor].bonusOnly
          )
            nearbyBlocks.add(neighbor);
      }
      const damage = indices.reduce(
        (sum, index) =>
          sum +
          Number(
            (tiles[index]?.health ?? 0) > 0 &&
              (!tiles[index]?.bonusOnly || usesBonus) &&
              (!tiles[index]?.lensOnly || !!bent?.has(index)) &&
              (!tiles[index]?.sealColor ||
                usesBonus ||
                evaluation?.matches.some(
                  (match) => match.type === tiles[index].sealColor && match.indices.includes(index),
                )),
          ),
        0,
      );
      const blastHits = usesBonus
        ? indices.filter(
            (index) =>
              tiles[index]?.bonusOnly &&
              tiles[index].health > 0 &&
              (!tiles[index].lensOnly || !!bent?.has(index)),
          ).length
        : 0;
      // Sealed beds and throat gates need deliberately aimed bonuses. Reward
      // a useful earned bonus too, rather than firing every blast at easy dust.
      const planned = { bent: new Set(), beams: [] };
      const plannedBlastHits =
        hasBlastTargets && evaluation?.bonuses.length
          ? new Set(
              evaluation.bonuses
                .flatMap(({ type, index }) =>
                  bonusActivator.activateBonus(type, evaluation.board, cols, rows, index, {
                    tiles,
                    lenses: planned,
                  }),
                )
                .filter(
                  (index) =>
                    tiles[index]?.bonusOnly &&
                    tiles[index].health > 0 &&
                    (!tiles[index].lensOnly || planned.bent.has(index)),
                ),
            ).size
          : 0;
      const relicPaths = indices.filter((index) =>
        routed
          ? relicRoutes.some((route) => route.has(index))
          : board.some(
              (gem, origin) =>
                gem?.type === 'relic' && origin < index && origin % cols === index % cols,
            ),
      ).length;
      const flips =
        switches && usesBonus && indices.some((index) => isGravitySwitch(tiles[index]))
          ? flipValue
          : 0;
      return (
        flips +
        Number(usesBonus) * 50 +
        Number(usesFusion) * 150 +
        Number(createsBonus) * (hasBlastTargets ? 600 : 100) +
        damage * 120 +
        blastHits * 1000 +
        plannedBlastHits * 500 +
        indices.filter((index) => tiles[index]?.chainHealth > 0).length * 180 +
        nearbyBlocks.size * 180 +
        relicPaths * 90 +
        indices.length +
        (hasSignals
          ? signalTargets(
              tiles,
              indices,
              cols,
              rows,
              ordinaryMatches.flatMap((match) => match.indices),
            ).length * 190
          : 0) +
        (requested.size
          ? indices.filter((index) =>
              requested.has(
                (swap
                  ? index === swap.aIndex
                    ? board[swap.bIndex]
                    : index === swap.bIndex
                      ? board[swap.aIndex]
                      : board[index]
                  : board[index]
                )?.type,
              ),
            ).length * 90
          : 0)
      );
    };
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
        let createsBonus = !!evaluation?.bonuses.length;
        let ordinaryMatches = evaluation?.matches ?? [];
        let indices = [...new Set(evaluation?.matches.flatMap((match) => match.indices) ?? [a, b])];
        const usesFusion = SPECIAL.has(board[a].type) && SPECIAL.has(board[b].type);
        const lenses = { bent: new Set(), beams: [] };
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
                .activateBonus(type, swapped, cols, rows, index, { tiles, lenses })
                .forEach((i) => affected.add(i));
            } else if (type === 'rainbow' && !SPECIAL.has(swapped[counterpart].type)) {
              bonusActivator
                .activateBonus(type, swapped, cols, rows, index, {
                  tiles,
                  targetType: swapped[counterpart].type,
                })
                .forEach((i) => affected.add(i));
            }
          }
          indices = [...affected];
        }
        indices = indices.filter((index) => isPlayableCell(tiles[index]));
        const heuristicScore = scoreImpact(indices, {
          usesBonus,
          usesFusion,
          createsBonus,
          ordinaryMatches,
          evaluation,
          swap: { aIndex: a, bIndex: b },
          bent: lenses.bent,
        });
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
    if (routed || hasBlastTargets || tiles.some((tile) => tile?.signal === 'spore')) {
      for (let index = 0; index < board.length; index++) {
        if (!SPECIAL.has(board[index]?.type) || !canSwapGem(board[index], tiles[index])) continue;
        // Preview the guaranteed hit without rolling the double-tap's extra crates.
        const lenses = { bent: new Set(), beams: [] };
        const indices = bonusActivator.previewBonus(
          board[index].type,
          board,
          cols,
          rows,
          index,
          tiles,
          lenses,
        );
        if (!indices.length) continue;
        const candidate = {
          swap: { aIndex: index, bIndex: index },
          indices: [index],
          activateInPlace: true,
          usesBonus: true,
          createsBonus: false,
          totalCleared: indices.length,
          heuristicScore: scoreImpact(indices, { usesBonus: true, bent: lenses.bent }),
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
          totalCleared: bonusActivator.previewBonus(
            board[index].type,
            board,
            cols,
            rows,
            index,
            tiles,
          ).length,
        };
    }
    return best;
  }
}
