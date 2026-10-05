import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useGameStore } from '../src/stores/gameStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { usePowerDrag } from '../src/composables/usePowerDrag';
import { BoardInput } from '../src/game/phaser/BoardInput';
import { createGem, GEM_TYPES } from '../src/game/engine/GemFactory';
import { MatchEngine } from '../src/game/engine/MatchEngine';

// The 6 by 6 board is drawn at half size: 150px on the page for a 300px canvas.
const RECT = { left: 100, top: 50, width: 150, height: 150 };
let game, inventory, scope, drag, finishes, button;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', new EventTarget());
  setActivePinia(createPinia());
  game = useGameStore();
  inventory = useInventoryStore();
  game.boardCols = game.boardRows = 6;
  game.board = Array.from({ length: 36 }, (_, i) =>
    createGem(GEM_TYPES[((i % 6) + 2 * Math.floor(i / 6)) % 6]),
  );
  game.tiles = game.board.map(() => ({ type: 'standard', health: 2, maxHealth: 2 }));
  game.sessionActive = true;
  game.remainingLayers = 72;
  vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
  vi.spyOn(game, 'ensurePlayableBoard').mockResolvedValue(true);
  finishes = [];
  const playSteps = vi.fn(() => new Promise((resolve) => finishes.push(resolve)));
  const input = new BoardInput({
    scene: {
      game: { canvas: { getBoundingClientRect: () => RECT } },
      scale: { width: 300, height: 300 },
    },
    boardContainer: { x: 0, y: 0 },
    gameStore: game,
  });
  input.setLayout({ boardCols: 6, boardRows: 6, cellSize: 50 });
  game.renderer = {
    input,
    animator: {
      playSteps,
      updateTiles: vi.fn(),
      clear: vi.fn(),
      showBonusPreview: vi.fn(),
      clearBonusPreview: vi.fn(),
    },
  };
  scope = effectScope();
  drag = scope.run(usePowerDrag);
  button = { disabled: false, setPointerCapture: vi.fn() };
});
afterEach(() => {
  scope.stop();
  game.cancelHint();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const stock = (id, n) => {
  inventory.quickAccessSlots.find((s) => s.id === id).quantity = n;
};
// Page coordinates of the centre of a board cell.
const cellPoint = (col, row) => ({
  clientX: RECT.left + col * 25 + 12,
  clientY: RECT.top + row * 25 + 12,
});
const pointer = (type, point, pointerId = 1) =>
  window.dispatchEvent(
    Object.assign(new Event(type, { cancelable: true }), {
      pointerId,
      pointerType: 'touch',
      ...point,
    }),
  );
const press = (id, point = { clientX: 160, clientY: 260 }) =>
  drag.start(
    { pointerId: 1, pointerType: 'touch', button: 0, currentTarget: button, ...point },
    id,
  );

it('maps a page point to the board cell under it, whatever the canvas display size', () => {
  expect(
    game.renderer.input.cellAtClientPoint(cellPoint(2, 3).clientX, cellPoint(2, 3).clientY),
  ).toBe(20);
  expect(game.renderer.input.cellAtClientPoint(RECT.left - 1, RECT.top)).toBeNull();
  expect(game.renderer.input.cellAtClientPoint(RECT.left, RECT.top + RECT.height)).toBeNull();
});

it.each(['tnt', 'color-wand', 'tile-breaker'])(
  'drags %s onto the board and uses it on the cell under the release point',
  async (id) => {
    stock(id, 1);
    const resolve = vi.spyOn(game, 'resolveBonusClick');
    press(id);
    pointer('pointermove', cellPoint(4, 1));
    expect(game.activeBonusMode).toBe(id);
    expect(drag.ghost.id).toBe(id);
    expect(button.setPointerCapture).toHaveBeenCalledWith(1);
    expect(game.bonusPreview.indices).toContain(10);
    pointer('pointermove', cellPoint(2, 3));
    expect(game.bonusPreview.indices).toContain(20);
    pointer('pointerup', cellPoint(2, 3));
    expect(resolve).toHaveBeenCalledExactlyOnceWith(20);
    expect(drag.ghost.id).toBeNull();
    expect(game.activeBonusMode).toBeNull();
    expect(inventory.availableQuantity(id)).toBe(0);
    finishes[0]();
    await vi.runAllTimersAsync();
    expect(inventory.quickAccessSlots.find((s) => s.id === id).quantity).toBe(0);
  },
);

it('cancels the power without spending it when released off the board', () => {
  stock('tnt', 1);
  const resolve = vi.spyOn(game, 'resolveBonusClick');
  press('tnt');
  pointer('pointermove', cellPoint(1, 1));
  expect(game.bonusPreview.indices.length).toBeGreaterThan(0);
  pointer('pointermove', { clientX: 160, clientY: 240 });
  expect(game.bonusPreview.indices).toEqual([]);
  pointer('pointerup', { clientX: 160, clientY: 240 });
  expect(resolve).not.toHaveBeenCalled();
  expect(game.activeBonusMode).toBeNull();
  expect(drag.ghost.id).toBeNull();
  expect(inventory.availableQuantity('tnt')).toBe(1);
});

it('cancels a drag the browser interrupts', () => {
  stock('tnt', 1);
  press('tnt');
  pointer('pointermove', cellPoint(1, 1));
  pointer('pointercancel', cellPoint(1, 1));
  expect(game.activeBonusMode).toBeNull();
  expect(drag.ghost.id).toBeNull();
  // Later pointer events belong to no drag.
  pointer('pointerup', cellPoint(1, 1));
  expect(inventory.availableQuantity('tnt')).toBe(1);
});

it('keeps tap to arm and tap to place, and ignores the click that ends a drag', () => {
  stock('tnt', 2);
  press('tnt');
  pointer('pointermove', { clientX: 163, clientY: 262 });
  pointer('pointerup', { clientX: 163, clientY: 262 });
  expect(game.activeBonusMode).toBeNull();
  drag.click('tnt');
  expect(game.activeBonusMode).toBe('tnt');
  // Dragging from an armed button keeps it armed rather than toggling it off.
  press('tnt');
  pointer('pointermove', cellPoint(0, 0));
  expect(game.activeBonusMode).toBe('tnt');
  pointer('pointerup', cellPoint(0, 0));
  expect(inventory.availableQuantity('tnt')).toBe(1);
  drag.click('tnt');
  expect(game.activeBonusMode).toBeNull();
  vi.advanceTimersByTime(500);
  drag.click('tnt');
  expect(game.activeBonusMode).toBe('tnt');
});

it('does not drag a power that is out of stock, untargeted, disabled or paused', () => {
  stock('tnt', 0);
  stock('shuffle', 1);
  press('tnt');
  pointer('pointermove', cellPoint(1, 1));
  expect(game.activeBonusMode).toBeNull();
  expect(drag.ghost.id).toBeNull();
  press('shuffle');
  pointer('pointermove', cellPoint(1, 1));
  expect(drag.ghost.id).toBeNull();
  stock('tnt', 1);
  button.disabled = true;
  press('tnt');
  pointer('pointermove', cellPoint(1, 1));
  expect(drag.ghost.id).toBeNull();
  button.disabled = false;
  game.inputPaused = true;
  press('tnt');
  pointer('pointermove', cellPoint(1, 1));
  expect(game.activeBonusMode).toBeNull();
  expect(drag.ghost.id).toBeNull();
});

it('only follows the pointer that started the drag', () => {
  stock('tnt', 1);
  press('tnt');
  pointer('pointermove', cellPoint(1, 1));
  pointer('pointerup', cellPoint(2, 2), 2);
  expect(drag.ghost.id).toBe('tnt');
  expect(game.activeBonusMode).toBe('tnt');
  scope.stop();
  pointer('pointerup', cellPoint(2, 2));
  expect(inventory.availableQuantity('tnt')).toBe(1);
});
