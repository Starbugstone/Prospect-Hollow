import { MatchEngine } from '../../src/game/engine/MatchEngine';
import { HintEngine } from '../../src/game/engine/HintEngine';
import { TileManager } from '../../src/game/engine/TileManager';
import { canSwapGem, layerCount } from '../../src/game/engine/TileRules';
import { detectBonusFromMatches } from '../../src/game/engine/MatchPatterns';
import { advanceOreOrders, remainingOre } from '../../src/game/engine/ChapterMechanics';
import { clearScore, cascadeTier } from '../../src/game/engine/MatchRewards';

const engine = new MatchEngine(),
  hints = new HintEngine(),
  manager = new TileManager();

// Stop at the normal objective finish. No inventory powers or post-victory
// score farming; diagnostic budgets never become gameplay move limits.
export function simulateCampaignLevel(level, seed) {
  const originalRandom = Math.random;
  let randomState = level.id * seed * 7919;
  Math.random = () => {
    randomState = (randomState * 16807) % 2147483647;
    return (randomState - 1) / 2147483646;
  };
  try {
    const cols = level.boardCols,
      rows = level.boardRows;
    let board = level.board.map((gem) => (gem ? { ...gem } : null));
    const tiles = level.tiles.map((tile) => ({ ...tile }));
    const oreOrders = (level.oreOrders ?? []).map((order) => ({ ...order }));
    const initialLayers = tiles.reduce((sum, tile) => sum + layerCount(tile), 0);
    const initialRelics = board.filter((gem) => gem?.type === 'relic').length;
    let turns = 0,
      shuffles = 0,
      score = 0,
      maxCombo = 1,
      cleared = 0,
      collected = 0;
    const remaining = () =>
      tiles.some((tile) => layerCount(tile) > 0) ||
      board.some((gem) => gem?.type === 'relic') ||
      remainingOre(oreOrders) > 0;
    while (remaining() && turns < 400 && shuffles < 30) {
      const move = hints.findBestMove(board, tiles, cols, rows, { oreOrders });
      let evaluation;
      if (move) {
        evaluation = engine.evaluateSwap(
          board,
          cols,
          rows,
          move.swap.aIndex,
          move.swap.bIndex,
          tiles,
        );
        if (!evaluation.matches.length) throw new Error('Hint did not produce a legal match');
        turns++;
      } else {
        const indices = board.flatMap((gem, index) =>
          canSwapGem(gem, tiles[index]) ? [index] : [],
        );
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [board[indices[i]], board[indices[j]]] = [board[indices[j]], board[indices[i]]];
        }
        const matches = engine.findMatches(board, cols, rows, tiles);
        const bonuses = detectBonusFromMatches(matches);
        for (const bonus of bonuses)
          board[bonus.index] = { ...board[bonus.index], type: bonus.type };
        evaluation = {
          board,
          matches,
          bonusesCreated: bonuses.map((b) => b.type),
          bonusIndices: bonuses.map((b) => b.index),
        };
        shuffles++;
      }
      const result = manager.getResolution({
        ...evaluation,
        tiles,
        cols,
        rows,
        gemTypes: level.boardLayout.gemTypes,
      });
      board = result.board;
      advanceOreOrders(oreOrders, result.steps);
      cleared += result.layersCleared ?? 0;
      collected += result.relicsCollected ?? 0;
      if (
        cleared + tiles.reduce((sum, tile) => sum + layerCount(tile), 0) !== initialLayers ||
        collected + board.filter((gem) => gem?.type === 'relic').length !== initialRelics
      )
        throw new Error('Resolution lost or invented objectives');
      result.steps.forEach((step, index) => {
        score += clearScore(step, index);
        if (step.cleared?.length) maxCombo = Math.max(maxCombo, cascadeTier(step, index));
      });
    }
    return {
      seed,
      turns,
      shuffles,
      score,
      maxCombo,
      remaining: Boolean(remaining()),
      layers: initialLayers - cleared,
      relics: initialRelics - collected,
      ore: remainingOre(oreOrders),
    };
  } finally {
    Math.random = originalRandom;
  }
}
