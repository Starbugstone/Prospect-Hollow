import { afterEach, expect, it, vi } from 'vitest';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { HintEngine } from '../src/game/engine/HintEngine';
import { TileManager } from '../src/game/engine/TileManager';
import { canSwapGem, layerCount } from '../src/game/engine/TileRules';
import { detectBonusFromMatches } from '../src/game/engine/MatchPatterns';
import { advanceOreOrders, remainingOre } from '../src/game/engine/ChapterMechanics';

const levels = generateLevelConfigs();
const engine = new MatchEngine();
const hints = new HintEngine();
const manager = new TileManager();
const reviewedLayouts = new Set([
  34,
  38,
  52,
  60,
  111,
  120,
  ...Array.from({ length: 24 }, (_, i) => i + 121),
]);
afterEach(() => vi.restoreAllMocks());

// Cache results so the aggregate pacing regression also works when run alone.
const measuredTurns = new Map();
const playLevel = (id, level) => {
  if (measuredTurns.has(id)) return measuredTurns.get(id);
  const cols = level.boardCols;
  const rows = level.boardRows;
  const gemTypes = level.boardLayout.gemTypes;
  const turnCounts = [];
  const seeds =
    id <= 12 || reviewedLayouts.has(id) ? Array.from({ length: 30 }, (_, i) => i + 1) : [1, 19, 73];
  for (const seed of seeds) {
    let randomState = id * seed * 7919;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      randomState = (randomState * 16807) % 2147483647;
      return (randomState - 1) / 2147483646;
    });
    let board = level.board.map((gem) => (gem ? { ...gem } : null));
    const tiles = level.tiles.map((tile) => ({ ...tile }));
    const oreOrders = (level.oreOrders ?? []).map((order) => ({ ...order }));
    const initialLayers = tiles.reduce((sum, tile) => sum + layerCount(tile), 0);
    const initialRelics = board.filter((gem) => gem?.type === 'relic').length;
    let cleared = 0,
      collected = 0,
      turns = 0,
      shuffles = 0;
    const remaining = () =>
      tiles.some((tile) => layerCount(tile) > 0) ||
      board.some((gem) => gem?.type === 'relic') ||
      remainingOre(oreOrders) > 0;
    // Test-harness escape guards only; gameplay itself has no move limit.
    while (remaining() && turns < 400 && shuffles < 30) {
      const move = hints.findBestMove(board, tiles, cols, rows, { oreOrders });
      let evaluation;
      if (move) {
        const { aIndex, bIndex } = move.swap;
        evaluation = engine.evaluateSwap(board, cols, rows, aIndex, bIndex, tiles);
        expect(evaluation.matches.length).toBeGreaterThan(0);
        turns++;
      } else {
        const indices = board.flatMap((gem, index) =>
          canSwapGem(gem, tiles[index]) ? [index] : [],
        );
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const a = indices[i],
            b = indices[j];
          [board[a], board[b]] = [board[b], board[a]];
        }
        const matches = engine.findMatches(board, cols, rows, tiles);
        // Preserve earned shuffle bonuses just as the game store does.
        const bonuses = detectBonusFromMatches(matches);
        for (const bonus of bonuses)
          board[bonus.index] = { ...board[bonus.index], type: bonus.type };
        evaluation = {
          board,
          matches,
          bonusesCreated: bonuses.map((bonus) => bonus.type),
          bonusIndices: bonuses.map((bonus) => bonus.index),
        };
        shuffles++;
      }
      const result = manager.getResolution({
        ...evaluation,
        tiles,
        cols,
        rows,
        gemTypes,
      });
      board = result.board;
      advanceOreOrders(oreOrders, result.steps);
      cleared += result.layersCleared ?? 0;
      collected += result.relicsCollected ?? 0;
      expect(cleared + tiles.reduce((sum, tile) => sum + layerCount(tile), 0)).toBe(initialLayers);
      expect(collected + board.filter((gem) => gem?.type === 'relic').length).toBe(initialRelics);
    }
    // A solvable board can still be a slog. Guard the paced campaign against
    // returning to the previous 90–250 move outliers on these fixed seeds.
    // The appended late campaign permits occasional harder layouts; its
    // aggregate median/p90 are guarded below. This is diagnostic only.
    expect(turns).toBeLessThanOrEqual(
      id > 240 ? 80 : id <= 12 ? 30 : reviewedLayouts.has(id) ? 70 : 60,
    );
    turnCounts.push(turns);
    expect(shuffles).toBeLessThanOrEqual(id <= 12 ? 0 : 3);
    expect({
      seed,
      remaining: remaining(),
      layers: initialLayers - cleared,
      relics: initialRelics - collected,
      ore: remainingOre(oreOrders),
    }).toEqual({ seed, remaining: false, layers: 0, relics: 0, ore: 0 });
  }
  if (id <= 12) {
    turnCounts.sort((a, b) => a - b);
    const median = (turnCounts[14] + turnCounts[15]) / 2;
    // Guard both ends: approachable should not mean a two-move level.
    // Match-before-blast swaps can finish the early puzzles a move sooner.
    expect(median).toBeGreaterThanOrEqual(id <= 6 ? 7 : 8);
    expect(median).toBeLessThanOrEqual(id <= 6 ? 10 : 13);
  }
  measuredTurns.set(id, turnCounts);
  return turnCounts;
};

// Exercise full games using legal hints, earned board bonuses and free
// dead-board shuffles. Inventory powers are never required for completion.
it.each(levels.map((level) => [level.id, level]))(
  'can finish level %i without inventory powers',
  (id, level) => {
    playLevel(id, level);
  },
  15000,
);

it('keeps the appended campaign median and upper-decile workload below a slog', () => {
  const turns = levels
    .slice(240)
    .flatMap((level) => playLevel(level.id, level))
    .sort((a, b) => a - b);
  expect(turns).toHaveLength(84 * 3);
  // Ten independent seeds per new level measured median20/p90 31 before the
  // final edge-ice refinements. Leave room for variation without accepting a
  // campaign that is consistently slow. These are never gameplay move caps.
  expect(turns[Math.floor(turns.length / 2)]).toBeLessThanOrEqual(28);
  expect(turns[Math.ceil(turns.length * 0.9) - 1]).toBeLessThanOrEqual(42);
}, 20000);
