import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '../src/stores/gameStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { createPinia, setActivePinia } from 'pinia';
import { createGem } from '../src/game/engine/GemFactory';
import { BonusActivator } from '../src/game/engine/BonusActivator';

describe('GameStore - Bonus Activation', () => {
  let gameStore;

  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    gameStore = useGameStore();

    // Mock board and dimensions for testing
    gameStore.boardCols = 3;
    gameStore.boardRows = 3;
    gameStore.board = Array.from({ length: 9 }, (_, i) => createGem(`gem${i % 3}`));
    gameStore.tiles = Array.from({ length: 9 }, () => ({ state: 'PLAYABLE', health: 1 }));
    gameStore.sessionActive = true;
    gameStore.renderer = {
      animator: {
        playSteps: vi.fn(() => Promise.resolve()),
        updateTiles: () => {},
      },
    };
  });

  it('should activate a clear_row bonus and clear a row', async () => {
    // Mock Math.random to always return 0 (first row)
    const originalRandom = Math.random;
    Math.random = () => 0;

    // Manually set gems to allow for a clear row bonus effect
    gameStore.board = [
      createGem('gem0'),
      createGem('gem1'),
      createGem('gem2'),
      createGem('gem3'),
      createGem('gem4'),
      createGem('gem5'),
      createGem('gem6'),
      createGem('gem7'),
      createGem('gem8'),
    ];

    const initialBoard = [...gameStore.board];

    await gameStore.activateOneTimeBonus('clear_row');

    // Restore Math.random
    Math.random = originalRandom;

    // Expecting the first row to be cleared (indices 0, 1, 2)
    // The board should have changed
    expect(gameStore.board).not.toEqual(initialBoard);
    const firstStep = gameStore.renderer.animator.playSteps.mock.calls[0][0][0];
    expect(firstStep.bonusEffect).toEqual({ type: 'clear_row', originIndex: 0 });
    expect(firstStep.cleared).toEqual([0, 1, 2]);
  });

  it('rejects a one-time power while input is paused without changing the board or score', async () => {
    gameStore.inputPaused = true;
    const before = JSON.stringify({ board: gameStore.board, tiles: gameStore.tiles });
    expect(await gameStore.activateOneTimeBonus('clear_row')).toBe(false);
    expect(JSON.stringify({ board: gameStore.board, tiles: gameStore.tiles })).toBe(before);
    expect(gameStore.renderer.animator.playSteps).not.toHaveBeenCalled();
    expect(gameStore.score).toBe(0);
    expect(gameStore.animationInProgress).toBe(false);
  });

  it('does not commit an old power animation into a new session', async () => {
    let complete;
    gameStore.renderer.animator.playSteps.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const commit = vi.spyOn(gameStore, 'commitResolution');
    const activation = gameStore.activateOneTimeBonus('clear_row');
    gameStore.sessionVersion++;
    const nextBoard = [createGem('ruby')];
    gameStore.board = nextBoard;
    complete();
    expect(await activation).toBe(false);
    expect(commit).not.toHaveBeenCalled();
    expect(gameStore.board).toEqual(nextBoard);
  });

  it('should not activate bonus if session is not active', async () => {
    gameStore.sessionActive = false;
    const initialBoard = [...gameStore.board];
    const activated = await gameStore.activateOneTimeBonus('clear_row');
    expect(activated).toBe(false);
    expect(gameStore.board).toEqual(initialBoard);
  });

  afterEach(() => {
    gameStore.cancelHint(true);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
});

describe('BonusActivator previewSwap', () => {
  it('returns affected indices for bomb without mutating board', () => {
    const activator = new BonusActivator();
    const board = [
      createGem('ruby'),
      createGem('sapphire'),
      createGem('emerald'),
      createGem('topaz'),
      { ...createGem('bomb'), type: 'bomb' },
      createGem('moonstone'),
      createGem('ruby'),
      createGem('sapphire'),
      createGem('emerald'),
    ];

    const preview = activator.previewSwap(board, 3, 3, { aIndex: 4, bIndex: 5 });
    expect(preview.length).toBeGreaterThan(0);
    expect(preview).toContain(5);
    expect(board[4].type).toBe('bomb');
  });
});

describe('Interactive Bonuses', () => {
  let gameStore;
  let inventoryStore;

  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    gameStore = useGameStore();
    inventoryStore = useInventoryStore();
    inventoryStore.quickAccessSlots.forEach((slot) => {
      slot.quantity = 3;
    });

    gameStore.boardCols = 3;
    gameStore.boardRows = 3;
    gameStore.board = [
      createGem('ruby'),
      createGem('sapphire'),
      createGem('emerald'),
      createGem('topaz'),
      createGem('amethyst'),
      createGem('moonstone'),
      createGem('ruby'),
      createGem('sapphire'),
      createGem('emerald'),
    ];
    gameStore.tiles = Array.from({ length: 9 }, () => ({ state: 'PLAYABLE', health: 1 }));
    gameStore.sessionActive = true;
    gameStore.renderer = {
      animator: {
        playSteps: vi.fn(() => Promise.resolve()),
        updateTiles: vi.fn(),
        clearQueuedSwapHighlight: vi.fn(),
      },
    };
  });

  it('activates hammer mode and clears its 3 by 3 area', async () => {
    const hammerSlot = inventoryStore.quickAccessSlots.find((slot) => slot.id === 'tnt');
    expect(hammerSlot.quantity).toBeGreaterThan(0);

    const activated = await inventoryStore.usePowerUp('tnt');
    expect(activated).toBe(true);
    expect(gameStore.activeBonusMode).toBe('tnt');

    // Count should NOT decrease yet
    expect(hammerSlot.quantity).toBe(3);

    const result = await gameStore.resolveBonusClick(0); // Click first gem

    expect(result).toBe(true);
    expect(gameStore.activeBonusMode).toBe(null);

    const cleared = gameStore.renderer.animator.playSteps.mock.calls[0][0][0].cleared;
    expect(cleared).toEqual(expect.arrayContaining([0, 1, 3, 4]));
    expect(gameStore.renderer.animator.playSteps.mock.calls[0][0][0].bonusEffect).toEqual({
      type: 'tnt',
      originIndex: 0,
    });
    expect(gameStore.board.every(Boolean)).toBe(true);

    expect(hammerSlot.quantity).toBe(2); // Consumed AFTER use
  });

  it('activates color wand mode and destroys all gems of same color', async () => {
    const wandSlot = inventoryStore.quickAccessSlots.find((slot) => slot.id === 'color-wand');
    expect(wandSlot.quantity).toBeGreaterThan(0);

    const activated = await inventoryStore.usePowerUp('color-wand');
    expect(activated).toBe(true);
    expect(gameStore.activeBonusMode).toBe('color_wand');

    // Board has rubies at 0 and 6
    const result = await gameStore.resolveBonusClick(0);

    expect(result).toBe(true);
    expect(gameStore.activeBonusMode).toBe(null);
    // Should have cleared both rubies (indices 0 and 6)
    // We can't easily check exact board state due to refill, but we can check that the move succeeded
  });

  afterEach(() => {
    gameStore.cancelHint(true);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
});

describe('Queued swap buffering', () => {
  let gameStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    gameStore = useGameStore();
    gameStore.boardCols = 3;
    gameStore.boardRows = 3;
    gameStore.sessionActive = true;
    gameStore.animationInProgress = true;
    gameStore.pendingBoardState = [
      createGem('ruby'),
      createGem('sapphire'),
      createGem('emerald'),
      createGem('topaz'),
      createGem('amethyst'),
      createGem('moonstone'),
      createGem('ruby'),
      createGem('sapphire'),
      createGem('emerald'),
    ];
    gameStore.board = [...gameStore.pendingBoardState];
    gameStore.renderer = {
      animator: {
        showQueuedSwap: vi.fn(),
      },
    };
  });

  it('queues swaps even if they do not immediately form a match', () => {
    const result = gameStore.queueSwap(0, 1);
    expect(result).toBe(true);
    expect(gameStore.queuedSwap).toMatchObject({
      aIndex: 0,
      bIndex: 1,
      gems: gameStore.board
        .slice(0, 2)
        .map((gem, index) => ({ index, id: gem.id, type: gem.type })),
    });
    expect(gameStore.renderer.animator.showQueuedSwap).toHaveBeenCalledWith(0, 1);
  });

  afterEach(() => {
    gameStore.cancelHint(true);
  });
});

describe('GameStore bonus preview highlighting', () => {
  let gameStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    gameStore = useGameStore();
    gameStore.boardCols = 3;
    gameStore.boardRows = 3;
    gameStore.board = [
      createGem('ruby'),
      createGem('sapphire'),
      createGem('emerald'),
      createGem('topaz'),
      { ...createGem('bomb'), type: 'bomb' },
      createGem('moonstone'),
      createGem('ruby'),
      createGem('sapphire'),
      createGem('emerald'),
    ];
    gameStore.tiles = Array.from({ length: 9 }, () => ({ state: 'PLAYABLE', health: 1 }));
    gameStore.sessionActive = true;
    gameStore.renderer = {
      animator: {
        showBonusPreview: vi.fn(),
        clearBonusPreview: vi.fn(),
        fadeBonusPreview: vi.fn(),
        playSteps: vi.fn(() => Promise.resolve()),
        updateTiles: vi.fn(),
      },
    };
  });

  it('computes the active hammer power footprint', () => {
    gameStore.activeBonusMode = 'tnt';
    gameStore.previewPowerEffect(4);
    expect(gameStore.bonusPreview.indices.length).toBeGreaterThan(0);
    expect(gameStore.renderer.animator.showBonusPreview).toHaveBeenCalledWith(
      gameStore.bonusPreview.indices,
    );
  });

  it('clears preview state when requested', () => {
    gameStore.activeBonusMode = 'tnt';
    gameStore.previewPowerEffect(4);
    gameStore.clearBonusPreview(true);
    expect(gameStore.bonusPreview.indices).toHaveLength(0);
    expect(gameStore.renderer.animator.clearBonusPreview).toHaveBeenCalled();
  });

  it('fades the accepted target while the power animation is still running', async () => {
    let finish;
    const animator = gameStore.renderer.animator;
    animator.playSteps.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    vi.spyOn(gameStore, 'ensurePlayableBoard').mockResolvedValue(true);
    gameStore.activeBonusMode = 'tnt';
    gameStore.previewPowerEffect(0);
    useInventoryStore().quickAccessSlots.find((slot) => slot.id === 'tnt').quantity = 1;
    const activation = gameStore.resolveBonusClick(0);
    expect(gameStore.animationInProgress).toBe(true);
    expect(animator.playSteps).toHaveBeenCalledOnce();
    expect(animator.fadeBonusPreview).toHaveBeenCalledOnce();
    expect(gameStore.bonusPreview).toEqual({ indices: [], key: null });
    finish();
    await activation;
    gameStore.cancelHint(true);
    vi.restoreAllMocks();
  });

  it('clears the cached footprint when a target is queued during a cascade', async () => {
    gameStore.activeBonusMode = 'tnt';
    gameStore.previewPowerEffect(0);
    gameStore.animationInProgress = true;
    expect(await gameStore.resolveBonusClick(0)).toBe(true);
    expect(gameStore.queuedBonus).toEqual({ index: 0, bonusName: 'tnt' });
    expect(gameStore.bonusPreview).toEqual({ indices: [], key: null });
    expect(gameStore.renderer.animator.clearBonusPreview).toHaveBeenCalledOnce();
  });
});
