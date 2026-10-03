// Label positions change on every camera frame; which labels exist and show does
// not. Vue renders only layout changes; positions go straight to the elements.
export const labelLayout = (anchors) =>
  anchors
    .map(({ id, visible, collection }) => `${id}:${+!!visible}${+!!collection?.visible}`)
    .join('|');

// Returns true when Vue must re-render. Otherwise the current (non-reactive) anchor
// objects receive the new values, so any later render or reader sees them too.
export function updateLabels(current, positions, previousLayout) {
  const layout = labelLayout(positions);
  if (layout !== previousLayout || current.length !== positions.length) return layout;
  current.forEach((anchor, i) => Object.assign(anchor, positions[i]));
  return null;
}

// The scene's size in CSS pixels. Labels are placed with the `translate` property in
// pixels: unlike left/top it is composited, so camera frames never lay out the page.
export function labelBox() {
  let observer;
  const box = {
    width: 0,
    height: 0,
    measure(element) {
      box.width = element?.clientWidth ?? 0;
      box.height = element?.clientHeight ?? 0;
    },
    observe(element) {
      box.measure(element);
      observer = new ResizeObserver(() => box.measure(element));
      observer.observe(element);
    },
    disconnect: () => observer?.disconnect(),
    translate: (point) => `${(point.x * box.width) / 100}px ${(point.y * box.height) / 100}px`,
  };
  return box;
}

export function placeLabels(anchors, labels, actions, box) {
  for (const { id, x, y, collection } of anchors) {
    const label = labels.get(id);
    if (label) label.style.translate = box.translate({ x, y });
    const action = actions.get(id);
    if (action && collection) action.style.translate = box.translate(collection);
  }
}

export const sameIndicators = (a, b) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

export function trackElement(elements, id, element) {
  if (element) elements.set(id, element);
  else elements.delete(id);
}
