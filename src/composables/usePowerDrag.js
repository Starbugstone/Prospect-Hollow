import { onScopeDispose, reactive } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { TARGETED_POWERS, useInventoryStore } from '../stores/inventoryStore';

// A press that travels this far becomes a drag rather than a tap.
const DRAG_THRESHOLD = 10;
// The click a browser may send after a drag ends on the button.
const CLICK_AFTER_DRAG_MS = 400;

// Targeted powers can be tapped, then placed with a tap on the board, or dragged from
// the bar with touch or mouse and used on the cell under the pointer on release.
export function usePowerDrag() {
  const game = useGameStore();
  const inventory = useInventoryStore();
  const ghost = reactive({ id: null, x: 0, y: 0, touch: false });
  let press = null;
  let ignoreClickUntil = 0;

  const cellAt = (event) =>
    game.renderer?.input?.cellAtClientPoint?.(event.clientX, event.clientY) ?? null;

  function stop() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', cancel);
    press = null;
    ghost.id = null;
  }
  function start(event, id) {
    if (press || !TARGETED_POWERS.has(id) || event.currentTarget?.disabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    press = {
      id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      target: event.currentTarget,
      dragging: false,
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', cancel);
  }
  function move(event) {
    if (event.pointerId !== press?.pointerId) return;
    if (!press.dragging) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) return;
      // Arm the power unless a tap already did; usePowerUp checks stock and the board.
      if (game.activeBonusMode !== press.id) inventory.usePowerUp(press.id);
      if (game.activeBonusMode !== press.id) {
        stop();
        return;
      }
      press.dragging = true;
      // Keep the drag away from the board's own swipe and hover handling.
      try {
        press.target?.setPointerCapture?.(event.pointerId);
      } catch {
        // The pointer may already be gone; the window listeners still finish the drag.
      }
    }
    if (event.cancelable) event.preventDefault();
    Object.assign(ghost, {
      id: press.id,
      x: event.clientX,
      y: event.clientY,
      touch: event.pointerType !== 'mouse',
    });
    const cell = cellAt(event);
    if (cell === null) game.clearBonusPreview();
    else game.previewPowerEffect(cell);
  }
  function release(event) {
    if (event.pointerId !== press?.pointerId) return;
    const { dragging, id } = press;
    stop();
    if (!dragging) return; // A tap: the button's click arms the power as before.
    ignoreClickUntil = Date.now() + CLICK_AFTER_DRAG_MS;
    const cell = cellAt(event);
    if (cell !== null && game.activeBonusMode === id) game.resolveBonusClick(cell);
    else if (game.activeBonusMode === id) game.setBonusMode(null);
  }
  function cancel(event) {
    if (event.pointerId !== press?.pointerId) return;
    const { dragging, id } = press;
    stop();
    if (dragging && game.activeBonusMode === id) game.setBonusMode(null);
  }
  function click(id) {
    if (Date.now() < ignoreClickUntil) return;
    inventory.usePowerUp(id);
  }
  onScopeDispose(stop);
  return { ghost, start, click };
}
