import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createGem } from '../src/game/engine/GemFactory';
import { useGameStore } from '../src/stores/gameStore';

// A board with no legal match must always get its free reshuffle, whatever the player had
// queued while the move that emptied it was still playing. Moves stay unlimited throughout.
const invalidSwapBounce = () => new Promise((resolve) => setTimeout(resolve, 5));
// The renderer as the store sees it: every animation resolves, a bounce takes a moment.
const animator = () => ({
  animateInvalidSwap: vi.fn(invalidSwapBounce),
  animateSwap: vi.fn(async () => {}),
  animateShuffle: vi.fn(async () => {}),
  playSteps: vi.fn(async () => {}),
  updateTiles: vi.fn(),
  showQueuedSwap: vi.fn(),
  clearQueuedSwapHighlight: vi.fn(),
  showQueuedBonus: vi.fn(),
  clearQueuedBonusHighlight: vi.fn(),
  showHintMove: vi.fn(),
  clearHintMove: vi.fn(),
  fadeBonusPreview: vi.fn(),
  showBonusPreview: vi.fn(),
});
const settled = async (game) => {
  for (let wait = 0; wait < 200 && game.animationInProgress; wait++)
    await new Promise((resolve) => setTimeout(resolve, 5));
  await new Promise((resolve) => setTimeout(resolve, 20));
};

// Level 1 with every gem replaced by a pattern in which no swap lines up three.
function deadBoard() {
  const game = useGameStore();
  game.bootstrap();
  expect(game.startLevel(1, 'normal', { seed: 7 })).toBe(true);
  const types = game.currentBoardLayout.gemTypes;
  expect(types.length).toBeGreaterThanOrEqual(4);
  game.board = game.board.map((gem, index) => {
    const row = Math.floor(index / game.boardCols),
      col = index % game.boardCols;
    return gem ? createGem(types[(col + 2 * row) % 4]) : null;
  });
  expect(game._hasPlayableMove()).toBe(false);
  game.renderer = { animator: animator() };
  return game;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  setActivePinia(createPinia());
});
afterEach(() => {
  useGameStore().cancelHint(true);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a board left without a legal match', () => {
  it('is reshuffled even when a swap was queued during the move that emptied it', async () => {
    const game = deadBoard();
    const shuffle = vi.spyOn(game, 'shuffleBoard');
    // The move is still playing when the player swipes two neighbouring gems.
    game.animationInProgress = true;
    expect(game.queueSwap(0, 1)).toBe(true);
    await game.settleMove(true);
    await settled(game);
    expect(shuffle).toHaveBeenCalled();
    expect(game._hasPlayableMove()).toBe(true);
    expect(game.queuedSwap).toBeNull();
    expect(game.animationInProgress).toBe(false);
  });

  it('is reshuffled after a bounced swap, which holds the board busy', async () => {
    const game = deadBoard();
    const shuffle = vi.spyOn(game, 'shuffleBoard');
    expect(await game.resolveSwap(0, 1)).toBe(false);
    await settled(game);
    expect(game.renderer.animator.animateInvalidSwap).toHaveBeenCalledOnce();
    expect(shuffle).toHaveBeenCalled();
    expect(game._hasPlayableMove()).toBe(true);
  });

  it('reshuffles before a queued power plays, as a replay does', async () => {
    const game = deadBoard();
    const order = [];
    const shuffle = game.shuffleBoard.bind(game),
      power = game.resolveBonusClick.bind(game);
    vi.spyOn(game, 'shuffleBoard').mockImplementation((options) => {
      order.push('shuffle');
      return shuffle(options);
    });
    vi.spyOn(game, 'resolveBonusClick').mockImplementation((index) => {
      order.push('power');
      return power(index);
    });
    game.animationInProgress = true;
    game.queuedBonus = { index: 0, bonusName: 'tnt' };
    await game.settleMove(true);
    await settled(game);
    expect(order[0]).toBe('shuffle');
    expect(order.at(-1)).toBe('power');
    expect(order.filter((step) => step === 'power')).toHaveLength(1);
  });
});
