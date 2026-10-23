// A screen-space grid keeps every visible lot reachable, including the narrow
// fallback map. Each label takes the nearest free position to its own lot.
export function layoutMoonLabels(labels, width, height) {
  if (!width || !height) return labels;
  const w = width < 600 ? 100 : 144,
    h = 58,
    gap = 6;
  // The phone header wraps onto two rows; reserve it and the letters control.
  const top = width < 600 ? 166 : 110;
  const columns = Math.max(1, Math.floor((width - gap) / (w + gap)));
  const slots = [];
  for (let y = top + h; y <= height - 126; y += h + gap)
    for (let column = 0; column < columns; column++)
      slots.push({ x: width / 2 + (column - (columns - 1) / 2) * (w + gap), y });
  return labels.map((label) => {
    if (!label.visible) return label;
    const px = (label.x * width) / 100,
      py = (label.y * height) / 100;
    let best = -1,
      distance = Infinity;
    for (const [index, slot] of slots.entries()) {
      const next = (slot.x - px) ** 2 + (slot.y - py) ** 2;
      if (next < distance) {
        best = index;
        distance = next;
      }
    }
    if (best < 0) return { ...label, visible: false };
    const [chosen] = slots.splice(best, 1);
    return { ...label, x: (chosen.x / width) * 100, y: (chosen.y / height) * 100, width: w };
  });
}
