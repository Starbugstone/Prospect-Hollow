import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, it } from 'vitest';
import { OBSTACLES } from '../src/data/obstacles';
import { GEM_TYPES } from '../src/game/engine/GemFactory';
import { useSeed } from '../src/game/engine/gameRandom';
import { HintEngine } from '../src/game/engine/HintEngine';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { replayRun, runReport } from '../src/stores/game/runLog';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';

// Levels 595–598 and 600 chain cells inside a sealed cellar. When the cellar opens,
// each of those chains holds one ordinary gem, so a normal match beside it frees it,
// as the chained gem's goal text promises.
const hints = new HintEngine();
const matches = new MatchEngine();

function fresh(level) {
  setActivePinia(createPinia());
  useCampaignStore().records = Object.fromEntries(
    Array.from({ length: level - 1 }, (_, i) => [i + 1, { score: 1, stars: 1 }]),
  );
  const game = useGameStore();
  game.bootstrap();
  return game;
}

const chainedCellar = (game) =>
  game.tiles.flatMap((tile, index) => (tile?.chamber && tile.chainHealth > 0 ? [index] : []));

// A swap of two ordinary gems whose plain match takes in a chained cellar cell.
function chainMatch(game) {
  const { board, tiles, boardCols: cols, boardRows: rows } = game;
  const chained = new Set(chainedCellar(game));
  for (let a = 0; a < board.length; a++)
    for (const b of [a + 1, a + cols]) {
      if (b >= board.length || (b === a + 1 && b % cols === 0)) continue;
      if (![a, b].every((index) => GEM_TYPES.includes(board[index]?.type))) continue;
      const result = matches.evaluateSwap(board, cols, rows, a, b, tiles);
      const hit = result.matches.find(
        (match) => GEM_TYPES.includes(match.type) && match.indices.some((i) => chained.has(i)),
      );
      if (hit) return { a, b, cell: hit.indices.find((i) => chained.has(i)) };
    }
  return null;
}

async function hintMove(game) {
  const move = hints.findBestMove(game.board, game.tiles, game.boardCols, game.boardRows, {
    oreOrders: game.oreOrders,
  });
  if (!move) return game.ensurePlayableBoard();
  await game.resolveSwap(move.swap.aIndex, move.swap.bIndex, {
    activateInPlace: !!move.activateInPlace,
  });
}

beforeEach(() => useSeed(null));

it('fills the chains of an opened cellar with gems a normal match frees (level 595)', async () => {
  const live = fresh(595);
  expect(live.startLevel(595, 'normal', { seed: 595 })).toBe(true);
  const cellar = chainedCellar(live);
  expect(cellar.length).toBe(3);
  // A diagnostic budget for the hint-led player, never a gameplay move limit.
  for (let turn = 0; turn < 200 && live.tiles.some((tile) => tile?.sealed); turn++)
    await hintMove(live);
  expect(live.tiles.some((tile) => tile?.sealed)).toBe(false);

  // Every chain still standing in the opened cellar holds an ordinary gem.
  const standing = chainedCellar(live);
  expect(standing.length).toBeGreaterThan(0);
  for (const index of standing) expect(GEM_TYPES).toContain(live.board[index]?.type);

  let freed = null;
  for (let turn = 0; turn < 200 && !freed && chainedCellar(live).length; turn++) {
    const move = chainMatch(live);
    if (!move) {
      await hintMove(live);
      continue;
    }
    await live.resolveSwap(move.a, move.b);
    freed = move.cell;
  }
  expect(freed).not.toBeNull();
  // Released by the match: the cell is an ordinary one, with nothing of the chain left.
  const tile = live.tiles[freed];
  expect(tile.chainHealth).toBe(0);
  expect(OBSTACLES.filter(({ present }) => present(tile)).map(({ id }) => id)).toEqual([]);

  const log = JSON.parse(JSON.stringify(runReport(live)));
  expect(await replayRun(fresh(595), log)).toBe(log.fingerprint);
});
