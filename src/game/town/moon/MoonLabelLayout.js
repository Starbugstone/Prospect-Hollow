import { labelsOverlap } from '../TownLabels';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const MOON_ACTION_OFFSET = 76;

// The SVG viewBox is centred and letterboxed, so percentages of its drawing
// coordinates are not percentages of a tall or wide container.
export function moonMapLabel({ id, x, y }, { width, height }) {
  const scale = Math.min(width / 120, height / 100);
  return {
    id,
    x: width ? 50 + ((x * scale) / width) * 100 : 50,
    y: height ? 50 + (((y - 6) * scale) / height) * 100 : 50,
    visible: !!width && !!height,
  };
}

// Preserve the projected anchor. Only collisions and screen edges move a label;
// candidates touch occupied rectangles, never an unrelated grid. Like the valley,
// overflow labels may hide; the Build tab still lists every lot.
export function layoutMoonLabels(labels, width, height) {
  if (!width || !height) return labels;
  const gap = 6,
    top = width < 600 ? 164 : height < 450 ? 110 : 112,
    bottom = height - (height < 450 ? 42 : 120),
    placed = [];
  // Reserve the enlarged finish/collection target at its building, so it cannot
  // intercept a label, including the label for its own building.
  const actions = labels
    .filter((label) => label.visible && label.action)
    .map((label) => ({
      id: label.id,
      x: clamp((label.x * width) / 100, 40, width - 40),
      y: clamp((label.y * height) / 100 - MOON_ACTION_OFFSET, top + 40, bottom - 34),
      width: 68,
      height: 68,
    }));
  // Back lots claim their nearest space first, so an appended monument does not
  // get pushed in front of the buildings nearer the camera merely by catalog order.
  const result = [...labels]
    .sort((a, b) => (a.rank ?? 5) - (b.rank ?? 5) || a.y - b.y || a.x - b.x)
    .map((label) => {
      if (!label.visible) return label;
      const w = label.width ?? (width < 1000 ? 104 : 128),
        h = label.height ?? (height < 450 ? 44 : 52);
      const anchor = { x: (label.x * width) / 100, y: (label.y * height) / 100 };
      const preferred = {
        x: clamp(anchor.x, w / 2 + gap, width - w / 2 - gap),
        y: clamp(anchor.y - h / 2, top + h / 2, bottom - h / 2),
        width: w,
        height: h,
      };
      const xs = [preferred.x],
        ys = [preferred.y];
      const occupied = [...placed, ...actions];
      for (const other of occupied) {
        xs.push(other.x - (w + other.width) / 2 - gap, other.x + (w + other.width) / 2 + gap);
        ys.push(other.y + (h + other.height) / 2 + gap, other.y - (h + other.height) / 2 - gap);
      }
      let best = null,
        distance = Infinity;
      for (const x of xs)
        for (const y of ys) {
          if (x < w / 2 + gap || x > width - w / 2 - gap || y < top + h / 2 || y > bottom - h / 2)
            continue;
          const candidate = { ...preferred, x, y };
          const next = (x - anchor.x) ** 2 + (y + h / 2 - anchor.y) ** 2;
          if (
            next >= distance ||
            occupied.some((other) => labelsOverlap(candidate, other, gap - 0.01))
          )
            continue;
          best = candidate;
          distance = next;
        }
      if (!best) return { ...label, visible: false };
      placed.push(best);
      return {
        ...label,
        x: (best.x / width) * 100,
        y: ((best.y + h / 2) / height) * 100,
        width: w,
        height: h,
        anchor: { x: label.x, y: label.y },
      };
    });
  // Reassign equally sized slots to preserve every clearance while reducing
  // the total distance to the buildings;
  // a late label must not inherit a distant slot just because earlier ones claimed
  // better space first. Strict improvements keep the small relaxation stable.
  const distance = (label, slot) =>
    (((slot.x - label.anchor.x) * width) / 100) ** 2 +
    (((slot.y - label.anchor.y) * height) / 100) ** 2;
  const shown = result.filter((label) => label.visible && label.anchor);
  for (let pass = 0; pass < shown.length; pass++) {
    let changed = false;
    for (let i = 0; i < shown.length; i++)
      for (let j = i + 1; j < shown.length; j++) {
        const a = shown[i],
          b = shown[j];
        if (a.width !== b.width || a.height !== b.height) continue;
        if (distance(a, b) + distance(b, a) >= distance(a, a) + distance(b, b) - 0.01) continue;
        [a.x, b.x] = [b.x, a.x];
        [a.y, b.y] = [b.y, a.y];
        changed = true;
      }
    if (!changed) break;
  }
  for (const label of shown) {
    const w = label.width,
      h = label.height;
    const anchor = { x: (label.anchor.x * width) / 100, y: (label.anchor.y * height) / 100 };
    const x = (label.x * width) / 100,
      y = (label.y * height) / 100;
    const edge = { x: clamp(anchor.x, x - w / 2, x + w / 2), y: clamp(anchor.y, y - h, y) };
    label.leader =
      Math.hypot(edge.x - anchor.x, edge.y - anchor.y) > 2
        ? { x1: edge.x, y1: edge.y, x2: anchor.x, y2: anchor.y }
        : null;
  }
  // Text can run out of room. The action at the projected place remains available,
  // following the same collection-anchor contract as the valley's map.
  const byId = new Map(
    result.map((label) => {
      const action = actions.find((point) => point.id === label.id);
      return [
        label.id,
        action
          ? {
              ...label,
              collection: {
                x: (action.x / width) * 100,
                y: (action.y / height) * 100,
                visible: true,
              },
            }
          : label,
      ];
    }),
  );
  return labels.map((label) => byId.get(label.id));
}
