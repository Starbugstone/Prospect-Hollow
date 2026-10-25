import { swallowTrailingClick } from './TownTrailingClick';

// One tap vocabulary for every settlement map, the valley and the Moon alike. A press
// is a tap only when it lifts within TAP_SLOP pixels, as the only pointer, with the
// primary button and no modifier key; anything else is a camera gesture. After a tap
// the browser's trailing click is swallowed outside the map, so it cannot land on the
// card the tap just opened.
export const TAP_SLOP = 6;

export function createTapGesture({ map, onTap, root }) {
  const pointers = new Map();
  let dragged = false;
  const move = (event) => {
    const start = pointers.get(event.pointerId);
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP)
      dragged = true;
  };
  return {
    // A pointer is down: hover feedback waits until it lifts.
    get pressed() {
      return pointers.size > 0;
    },
    // `target` is whatever the press began on (a label's plot id), handed to onTap.
    down(event, target) {
      pointers.delete(event.pointerId);
      if (!pointers.size) dragged = false;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, target });
      if (
        pointers.size > 1 ||
        event.button !== 0 ||
        event.shiftKey ||
        event.ctrlKey ||
        event.metaKey
      )
        dragged = true;
    },
    move,
    up(event) {
      move(event);
      const start = pointers.get(event.pointerId);
      const tap = !!start && !dragged;
      pointers.delete(event.pointerId);
      if (!tap) return false;
      onTap(event, start.target);
      swallowTrailingClick(typeof map === 'function' ? map() : map, { root });
      return true;
    },
    cancel(event) {
      if (!pointers.has(event.pointerId)) return;
      dragged = true;
      pointers.delete(event.pointerId);
    },
  };
}

// Pointer taps on a map's labels and action buttons settle through the tap gesture on
// pointerup, so their native click is ignored; keyboard and assistive activation
// (detail 0) still opens them.
export const keyboardActivation = (event) => event.detail === 0;
