import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { CHAPTERS } from '../src/data/campaign';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore } from '../src/stores/campaignStore';
import { TileManager } from '../src/game/engine/TileManager';
import { HintEngine } from '../src/game/engine/HintEngine';
import { createGem } from '../src/game/engine/GemFactory';

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
});

it('allows players to keep matching beyond pacing targets and finish without score or speed rewards', async () => {
  const game = useGameStore();
  game.bootstrap();
  game.startLevel(1);
  game.moves = 100;
  game.elapsedMs = game.speedTargetMs + 60000;
  const hint = new HintEngine().findBestMove(
    game.board,
    game.tiles,
    game.boardCols,
    game.boardRows,
  );
  await game.resolveSwap(hint.swap.aIndex, hint.swap.bIndex);
  expect(game.moves).toBe(101);
  expect(game.sessionActive).toBe(true);
  game.score = 0;
  game.remainingLayers = 0;
  game.completeLevel();
  expect(game.levelCleared).toBe(true);
  expect(useCampaignStore().nextLevel).toBe(2);
});

it('changes dimensions and color count only at chapter boundaries and rotates two-level seams', () => {
  const levels = generateLevelConfigs();
  expect(new Set(CHAPTERS.map((chapter) => chapter.theme)).size).toBe(CHAPTERS.length);
  for (const [index, level] of levels.entries()) {
    const chapter = CHAPTERS[level.chapter];
    expect([level.boardCols, level.boardRows, level.boardLayout.gemTypeCount]).toEqual([
      chapter.cols,
      chapter.rows,
      chapter.gemTypeCount,
    ]);
    expect(new Set(level.boardLayout.gemTypes).size).toBe(chapter.gemTypeCount);
    if (index % 6) expect(level.theme).toBe(levels[index - 1].theme);
    if (index % 2)
      expect(level.boardLayout.gemTypes).toEqual(levels[index - 1].boardLayout.gemTypes);
    else if (index % 6)
      expect(level.boardLayout.gemTypes).not.toEqual(levels[index - 1].boardLayout.gemTypes);
    if (index && level.boardLayout.gemTypeCount !== levels[index - 1].boardLayout.gemTypeCount) {
      expect(index % 6).toBe(0);
      expect(level.boardCols * level.boardRows).toBeGreaterThan(levels[index - 1].board.length);
    }
    for (const tile of level.tiles)
      if (tile.sealColor) expect(level.boardLayout.gemTypes).toContain(tile.sealColor);
  }
});

// A non-prefix palette catches the old slice(0, count) refill bug. Exercise each
// store entry point, including cascades produced by a shuffle or inventory power.
it.each(['swap', 'targeted power', 'row power', 'shuffle'])(
  'keeps the selected jewel identities during a %s refill',
  async (action) => {
    const game = useGameStore();
    useCampaignStore().records = Object.fromEntries(
      Array.from({ length: 4 }, (_, i) => [i + 1, { stars: 1, score: 0 }]),
    );
    game.bootstrap();
    game.startLevel(5);
    const palette = [...game.currentBoardLayout.gemTypes];
    const resolve = vi.spyOn(TileManager.prototype, 'getResolution');
    vi.spyOn(game, 'ensurePlayableBoard').mockImplementation(() => {});
    if (action === 'swap') {
      const hint = new HintEngine().findBestMove(
        game.board,
        game.tiles,
        game.boardCols,
        game.boardRows,
      );
      await game.resolveSwap(hint.swap.aIndex, hint.swap.bIndex);
    } else if (action === 'targeted power') {
      game.setBonusMode('tnt');
      await game.resolveBonusClick(14);
    } else if (action === 'row power') {
      await game.activateOneTimeBonus('clear_row');
    } else {
      const board = [...game.board];
      for (const index of [0, 1, 2]) board[index] = createGem(palette[0]);
      await game._resolveBoardAfterShuffle(board, { cols: game.boardCols, rows: game.boardRows });
    }
    expect(resolve).toHaveBeenCalled();
    expect(
      resolve.mock.calls.every(
        ([options]) => JSON.stringify(options.gemTypes) === JSON.stringify(palette),
      ),
    ).toBe(true);
    expect(
      resolve.mock.results.some(({ value }) => value.steps.some((step) => step.spawns.length)),
    ).toBe(true);
    expect(
      game.board
        .filter(Boolean)
        .every((gem) => [...palette, 'bomb', 'rainbow', 'cross'].includes(gem.type)),
    ).toBe(true);
  },
);
