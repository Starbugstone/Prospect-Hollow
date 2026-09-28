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

export function placeLabels(anchors, labels, actions) {
  for (const { id, x, y, collection } of anchors) {
    const label = labels.get(id);
    if (label) {
      label.style.left = `${x}%`;
      label.style.top = `${y}%`;
    }
    const action = actions.get(id);
    if (action && collection) {
      action.style.left = `${collection.x}%`;
      action.style.top = `${collection.y}%`;
    }
  }
}

export function trackElement(elements, id, element) {
  if (element) elements.set(id, element);
  else elements.delete(id);
}
