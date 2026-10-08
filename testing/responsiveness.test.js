import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { isReactive } from 'vue';
import { useGameStore } from '../src/stores/gameStore';
import { BoardInput } from '../src/game/phaser/BoardInput';
import { BoardAnimator } from '../src/game/phaser/BoardAnimator';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { HintEngine } from '../src/game/engine/HintEngine';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { CHAPTERS } from '../src/data/campaign';
import { chapterSlotOf } from '../src/data/chapters';
import { createGem } from '../src/game/engine/GemFactory';
import { TileManager } from '../src/game/engine/TileManager';
import { isAdjacent } from '../src/game/engine/TileRules';

const engine = new MatchEngine();
beforeEach(() => setActivePinia(createPinia()));
afterEach(() => {
  useGameStore().cancelHint(true);
  vi.restoreAllMocks();
});

it('generates settled chapter palettes with plenty of legal opening moves', () => {
  for (const level of generateLevelConfigs()) {
    const { board, tiles, boardCols: cols, boardRows: rows } = level;
    // Only a level a chapter names in `extraColors` adds a sixth color.
    const extra = CHAPTERS[level.chapter].extraColors?.[chapterSlotOf(level.id)];
    expect(level.boardLayout.gemTypeCount).toBe((level.id <= 12 ? 4 : 5) + (extra ? 1 : 0));
    expect(
      new Set(board.filter((gem) => gem && gem.type !== 'relic').map((gem) => gem.type)),
    ).toEqual(new Set(level.boardLayout.gemTypes));
    expect(engine.findMatches(board, cols, rows, tiles)).toEqual([]);
    let moves = 0;
    for (let a = 0; a < board.length; a++) {
      for (const b of [a % cols < cols - 1 ? a + 1 : -1, a + cols]) {
        if (engine.evaluateSwap(board, cols, rows, a, b, tiles).matches.length) moves++;
      }
    }
    expect(moves).toBeGreaterThanOrEqual(level.id <= 12 ? 6 : 3);
  }
});

it('finds hints without random refills or board mutation and excludes frozen swaps', () => {
  const level = generateLevelConfigs()[0];
  const before = JSON.stringify(level);
  const random = vi.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('Hints must not consume randomness');
  });
  const hints = new HintEngine();
  const first = hints.findBestMove(level.board, level.tiles, level.boardCols, level.boardRows);
  expect(hints.findBestMove(level.board, level.tiles, level.boardCols, level.boardRows)).toEqual(
    first,
  );
  expect(random).not.toHaveBeenCalled();
  expect(JSON.stringify(level)).toBe(before);
  expect(
    hints.findBestMove(
      level.board,
      level.tiles.map(() => ({ state: 'FROZEN' })),
      level.boardCols,
      level.boardRows,
    ),
  ).toBeNull();
});

it('settles cascades even when random always produces the same gem', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const board = Array.from({ length: 9 }, () => createGem('ruby'));
  const result = new TileManager().getResolution({
    board,
    tiles: Array.from({ length: 9 }, () => ({ health: 1 })),
    matches: engine.findMatches(board, 3),
    cols: 3,
    rows: 3,
  });
  expect(result.steps.length).toBeLessThan(128);
  expect(result.board.every(Boolean)).toBe(true);
  expect(engine.findMatches(result.board, 3)).toEqual([]);
});

it('rejects out-of-range and empty-cell swaps without changing the board', () => {
  const board = [createGem('ruby'), null, createGem('ruby')];
  for (const pair of [
    [-1, 0],
    [2, 3],
    [0, 1],
    [0.5, 1.5],
  ])
    expect(engine.evaluateSwap(board, 3, 1, ...pair).matches).toEqual([]);
});

describe('responsive pointer input', () => {
  let input, store;
  beforeEach(() => {
    store = {
      sessionActive: true,
      levelCleared: false,
      notifyPlayerActivity: vi.fn(),
      resolveSwap: vi.fn(),
      clearBonusPreview: vi.fn(),
      renderer: { animator: { highlightCell: vi.fn(), clearCellHighlights: vi.fn() } },
    };
    input = new BoardInput({ scene: {}, boardContainer: { x: 0, y: 0 }, gameStore: store });
    input.setLayout({ boardCols: 3, boardRows: 3, cellSize: 60 });
  });
  it('commits once before pointer release, even for a long swipe', () => {
    input.handlePointerDown({ id: 0, x: 30, y: 30 });
    input.handlePointerMove({ id: 0, x: 120, y: 34 });
    expect(store.resolveSwap).toHaveBeenCalledWith(0, 1);
    input.handlePointerMove({ id: 0, x: 175, y: 34 });
    input.handlePointerUp({ id: 0, x: 175, y: 34 });
    expect(store.resolveSwap).toHaveBeenCalledTimes(1);
  });
  it('ignores tiny jitter, additional pointers, and a paused game', () => {
    input.handlePointerDown({ id: 0, x: 30, y: 30 });
    input.handlePointerMove({ id: 1, x: 120, y: 30 });
    input.handlePointerMove({ id: 0, x: 35, y: 32 });
    store.inputPaused = true;
    input.handlePointerMove({ id: 0, x: 120, y: 30 });
    expect(store.resolveSwap).not.toHaveBeenCalled();
  });
  it('supports taps on neighbors and changes selection for distant taps', () => {
    input.activateCell(0);
    input.activateCell(8);
    expect(store.resolveSwap).not.toHaveBeenCalled();
    input.activateCell(7);
    expect(store.resolveSwap).toHaveBeenCalledWith(8, 7);
  });
});

it('keeps renderer instances outside Vue reactivity', () => {
  const store = useGameStore();
  store.attachRenderer({ scene: {}, boardContainer: {} });
  expect(isReactive(store.renderer)).toBe(false);
  expect(isReactive(store.renderer.animator)).toBe(false);
});

it('settles animation promises when the renderer is cleared', async () => {
  const remove = vi.fn();
  const animator = new BoardAnimator({ scene: { tweens: { add: () => ({ remove }) } } });
  const pending = animator.tween({}, { duration: 100 });
  animator.clear();
  await pending;
  expect(remove).toHaveBeenCalledOnce();
  expect(animator.pending.size).toBe(0);
});

it('cannot commit an old swap or unlock a new level after cancellation', async () => {
  const store = useGameStore();
  store.bootstrap();
  store.startLevel(1);
  const hint = new HintEngine().findBestMove(
    store.board,
    store.tiles,
    store.boardCols,
    store.boardRows,
  );
  let finish;
  store.renderer = {
    animator: {
      animateSwap: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      clearQueuedSwapHighlight: vi.fn(),
      clear: vi.fn(),
    },
  };
  const pending = store.resolveSwap(...hint.indices);
  store.exitLevel();
  store.sessionActive = true;
  store.animationInProgress = true;
  store.board = [createGem('topaz')];
  finish();
  expect(await pending).toBe(false);
  expect(store.board).toHaveLength(1);
  expect(store.animationInProgress).toBe(true);
});

it('buffers input during a rejected swap and drains it after the bounce', async () => {
  const store = useGameStore();
  store.bootstrap();
  store.startLevel(1);
  let invalid;
  for (let a = 0; a < store.board.length - 1; a++)
    if (
      isAdjacent(a, a + 1, store.boardCols) &&
      !engine.evaluateSwap(store.board, store.boardCols, store.boardRows, a, a + 1).matches.length
    ) {
      invalid = [a, a + 1];
      break;
    }
  let finish;
  store.renderer = {
    animator: {
      animateInvalidSwap: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      showQueuedSwap: vi.fn(),
    },
  };
  const drain = vi.spyOn(store, 'processQueuedInput').mockImplementation(() => {});
  const pending = store.resolveSwap(...invalid);
  expect(store.animationInProgress).toBe(true);
  expect(store.queueSwap(3, 4)).toBe(true);
  finish();
  await pending;
  expect(store.animationInProgress).toBe(false);
  expect(drain).toHaveBeenCalledOnce();
});

it('holds buffered moves through a pause and resumes them only when play resumes', () => {
  const game = useGameStore();
  game.sessionActive = true;
  game.queuedSwap = { aIndex: 0, bIndex: 1 };
  game.inputPaused = true;
  const swap = vi.spyOn(game, 'resolveSwap').mockResolvedValue(true);
  game.processQueuedInput();
  expect(swap).not.toHaveBeenCalled();
  expect(game.queuedSwap).toEqual({ aIndex: 0, bIndex: 1 });
  game.inputPaused = false;
  game.processQueuedInput();
  expect(swap).toHaveBeenCalledExactlyOnceWith(0, 1);
  expect(game.queuedSwap).toBeNull();
});

it('keeps keyboard focus usable when replaying a smaller board', () => {
  const input = new BoardInput({
    scene: {},
    gameStore: { sessionActive: true, notifyPlayerActivity: vi.fn() },
  });
  input.setLayout({ boardCols: 7, boardRows: 9, cellSize: 40 });
  input.focusIndex = 62;
  input.setLayout({ boardCols: 6, boardRows: 7, cellSize: 40 });
  expect(input.focusIndex).toBe(41);
  input.handleKey({ key: 'ArrowLeft', preventDefault: vi.fn() });
  expect(input.focusIndex).toBe(40);
});

it.each(['replaced', 'transformed'])(
  'does not redirect a queued swipe onto a %s bomb after a cascade',
  (change) => {
    const game = useGameStore();
    const ruby = createGem('ruby'),
      sapphire = createGem('sapphire');
    game.sessionActive = true;
    game.animationInProgress = true;
    game.boardCols = 3;
    game.board = [ruby, sapphire, createGem('emerald')];
    const bomb = change === 'transformed' ? { ...ruby, type: 'bomb' } : createGem('bomb');
    game.pendingBoardState = [bomb, sapphire, game.board[2]];
    expect(game.queueSwap(0, 1)).toBe(true);
    game.board = game.pendingBoardState;
    game.pendingBoardState = null;
    game.animationInProgress = false;
    const swap = vi.spyOn(game, 'resolveSwap').mockResolvedValue(true);
    game.processQueuedInput();
    expect(swap).not.toHaveBeenCalled();
    expect(game.board[0]).toEqual(bomb);
    expect(game.queuedSwap).toBeNull();
  },
);

it('executes a queued swipe when both visible pieces survive in their cells', () => {
  const game = useGameStore();
  game.sessionActive = true;
  game.animationInProgress = true;
  game.boardCols = 3;
  game.board = [createGem('bomb'), createGem('ruby'), createGem('emerald')];
  expect(game.queueSwap(0, 1)).toBe(true);
  game.animationInProgress = false;
  const swap = vi.spyOn(game, 'resolveSwap').mockResolvedValue(true);
  game.processQueuedInput();
  expect(swap).toHaveBeenCalledExactlyOnceWith(0, 1);
});
