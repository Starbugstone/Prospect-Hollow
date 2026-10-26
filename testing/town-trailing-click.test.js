import { afterEach, expect, it, vi } from 'vitest';
import { swallowTrailingClick } from '../src/game/town/TownTrailingClick';

afterEach(() => vi.useRealTimers());

// A root that runs its capture listeners the way the document does for a click or press.
function page() {
  const listeners = new Map();
  const root = {
    addEventListener: (type, listener) =>
      listeners.set(type, [...(listeners.get(type) ?? []), listener]),
    removeEventListener: (type, listener) =>
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((entry) => entry !== listener),
      ),
    count: (type) => (listeners.get(type) ?? []).length,
    dispatch(type, target, detail = 1) {
      const event = {
        type,
        target,
        detail,
        defaultPrevented: false,
        stopped: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopImmediatePropagation() {
          this.stopped = true;
        },
      };
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
      return event;
    },
  };
  return root;
}
const map = { contains: (target) => target === 'canvas' };

it('swallows the click a building tap leaves behind on the sheet it opened', () => {
  const root = page();
  swallowTrailingClick(map, { root });
  const ghost = root.dispatch('click', 'upgrade-button');
  expect(ghost.defaultPrevented).toBe(true);
  expect(ghost.stopped).toBe(true);
  // Only that one click: the player's own tap on Upgrade goes through.
  expect(root.dispatch('click', 'upgrade-button').stopped).toBe(false);
  expect(root.count('click')).toBe(0);
  expect(root.count('pointerdown')).toBe(0);
});

it('lets the trailing click through when it lands back on the map', () => {
  const root = page();
  swallowTrailingClick(map, { root });
  const click = root.dispatch('click', 'canvas');
  expect(click.stopped).toBe(false);
  expect(click.defaultPrevented).toBe(false);
  expect(root.count('click')).toBe(0);
});

it('ends the guard on the next press, so a quick real tap is never lost', () => {
  const root = page();
  swallowTrailingClick(map, { root });
  root.dispatch('pointerdown', 'upgrade-button');
  expect(root.dispatch('click', 'upgrade-button').stopped).toBe(false);
});

it('ends the guard after a short wait when the browser sends no click', () => {
  vi.useFakeTimers();
  const root = page();
  swallowTrailingClick(map, { root, wait: 500 });
  vi.advanceTimersByTime(500);
  expect(root.count('click')).toBe(0);
  expect(root.dispatch('click', 'upgrade-button').stopped).toBe(false);
});

it('never swallows keyboard or assistive activation', () => {
  const root = page();
  swallowTrailingClick(map, { root });
  expect(root.dispatch('click', 'upgrade-button', 0).stopped).toBe(false);
  // The guard still waits for the real trailing click.
  expect(root.dispatch('click', 'upgrade-button').stopped).toBe(true);
});
