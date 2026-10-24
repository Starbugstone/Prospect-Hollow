import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { markRaw } from 'vue';
import { LEVEL_COUNT } from '../../src/data/campaign';
import { HintEngine } from '../../src/game/engine/HintEngine';
import { PlayClock } from '../../src/game/engine/PlayClock';
import { layerCount } from '../../src/game/engine/TileRules';
import { useGameStore } from '../../src/stores/gameStore';
import { useCampaignStore } from '../../src/stores/campaignStore';

// Every floating-seam level (403 onwards) finished through the real game store: swaps,
// gravity switches, portals, breakthroughs and the free dead-board recovery, after more
// than 100 recorded moves and once the optional speed target has passed. The turn budget
// is a diagnostic cap, never a gameplay move limit.
const hints = new HintEngine();
const ids = Array.from({ length: LEVEL_COUNT - 402 }, (_, i) => 403 + i);

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
});

it.each(ids)(
  'finishes level %i in the game store beyond 100 moves after its speed target',
  async (id) => {
    let random = id * 7919;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      random = (random * 16807) % 2147483647;
      return (random - 1) / 2147483646;
    });
    const campaign = useCampaignStore();
    campaign.records = Object.fromEntries(
      Array.from({ length: id - 1 }, (_, i) => [i + 1, { score: 1, stars: 1 }]),
    );
    const game = useGameStore();
    let now = 0;
    game.playClock = markRaw(new PlayClock(() => now));
    game.bootstrap();
    game.startLevel(id);
    expect(game.currentLevelId).toBe(id);
    game.moves = 100;
    game.syncRunClock(true);
    now = game.speedTargetMs + 60000;
    for (let turn = 0; turn < 600 && !game.levelCleared; turn++) {
      const move = hints.findBestMove(game.board, game.tiles, game.boardCols, game.boardRows, {
        oreOrders: game.oreOrders,
      });
      if (!move) {
        expect(await game.ensurePlayableBoard(), `level ${id} recovers a dead board`).toBe(true);
        continue;
      }
      expect(
        await game.resolveSwap(move.swap.aIndex, move.swap.bIndex, {
          activateInPlace: !!move.activateInPlace,
        }),
      ).toBe(true);
    }
    expect(game.levelCleared, `level ${id} cleared`).toBe(true);
    expect(game.moves).toBeGreaterThan(100);
    expect(game.elapsedMs).toBeGreaterThan(game.speedTargetMs);
    expect(game.tiles.every((tile) => layerCount(tile) === 0)).toBe(true);
    expect(game.board.some((gem) => gem?.type === 'relic')).toBe(false);
    expect(game.remainingOre).toBe(0);
    expect(game.levelRewards.length).toBeGreaterThan(0);
    expect(campaign.records[id]).toBeTruthy();
  },
  60000,
);
