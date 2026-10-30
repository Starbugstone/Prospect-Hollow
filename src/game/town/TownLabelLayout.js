import { labelsOverlap } from './TownLabels';

// The shared pill has a bounded name and an inline status. Its width estimate is
// also the renderer's max-width, so translated text cannot outgrow its clearance.
export const townLabelWidth = (name) => Math.min(280, Math.max(100, name.length * 7 + 70));

// Mirrors TownMapLabel's translate(-50%, -30%) and its action/mine offsets. Reserve
// the largest responsive height; the mine includes its enlarged touch target.
function labelRect(label, width, height) {
  const h = label.height ?? 42;
  return {
    x: (label.x * width) / 100,
    y: (label.y * height) / 100 + h * 0.2 + (label.offsetY ?? 0),
    width: label.width ?? 160,
    height: h,
  };
}

// The largest rendered action icon, enlarged ready icons included.
const ACTION_TARGET = 68;
const ACTION_SEPARATION_PASSES = 60;

// A name may give way to another, but every action must stay tappable and activate its
// own place. Overlapping targets push apart along the line between them, so they stay
// beside their buildings and slide smoothly as the camera moves. A target that moved
// stays inside the map; one nothing touches keeps its projected place.
function separateActionTargets(labels, width, height, top, bottom) {
  const targets = labels
    .filter((label) => label.action && label.collection?.visible)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((label) => ({
      label,
      x: (label.collection.x * width) / 100,
      y: (label.collection.y * height) / 100,
      moved: false,
    }));
  const half = ACTION_TARGET / 2;
  const settle = (target) => {
    target.moved = true;
    target.x = Math.max(half, Math.min(width - half, target.x));
    target.y = Math.max(top + half, Math.min(bottom - half, target.y));
  };
  for (let pass = 0; pass < ACTION_SEPARATION_PASSES; pass++) {
    let touching = false;
    for (const [n, a] of targets.entries()) {
      for (const [m, b] of targets.entries()) {
        if (m <= n) continue;
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        if (distance >= ACTION_TARGET) continue;
        touching = true;
        // Exactly coincident targets fan out in id order, the first pair sideways.
        const fan = (n + m - 1) * 2.4;
        const directionX = distance ? (b.x - a.x) / distance : Math.cos(fan);
        const directionY = distance ? (b.y - a.y) / distance : Math.sin(fan);
        const push = (ACTION_TARGET - distance) / 2;
        a.x -= directionX * push;
        a.y -= directionY * push;
        b.x += directionX * push;
        b.y += directionY * push;
        settle(a);
        settle(b);
      }
    }
    if (!touching) break;
  }
  for (const { label, x, y, moved } of targets)
    if (moved)
      label.collection = { ...label.collection, x: (x / width) * 100, y: (y / height) * 100 };
}

// Every map keeps names attached to their projected places. Higher priority wins
// a collision; it never pushes another name into a new slot. Map adapters supply
// their chrome bounds and projected action points, not their own density policy.
export function layoutTownLabels(labels, width, height, { top = 0, bottom = height } = {}) {
  const result = labels.map((label) => ({ ...label }));
  if (width > 0 && height > 0) separateActionTargets(result, width, height, top, bottom);
  const occupied = result
    .filter((label) => label.action && label.collection?.visible)
    .map((label) => ({
      id: label.id,
      x: (label.collection.x * width) / 100,
      y: (label.collection.y * height) / 100,
      width: ACTION_TARGET,
      height: ACTION_TARGET,
    }));
  const ranked = [...result].sort(
    (a, b) =>
      (a.rank ?? 5) - (b.rank ?? 5) ||
      (a.depth ?? a.y) - (b.depth ?? b.y) ||
      String(a.id).localeCompare(String(b.id)),
  );
  for (const label of ranked) {
    if (!label.visible) continue;
    let rect = labelRect(label, width, height);
    const ownAction = occupied.find((other) => other.id === label.id);
    if (ownAction && labelsOverlap(rect, ownAction)) {
      // The icon and name share a place but have separate hit targets. Move the
      // pill only along its existing above/below offset, by the clearance needed
      // for this projection. The same rule covers Earth porches and Moon domes.
      const direction = (label.offsetY ?? 0) < 0 ? -1 : 1;
      label.offsetY =
        (label.offsetY ?? 0) +
        ownAction.y -
        rect.y +
        direction * ((rect.height + ownAction.height) / 2 + 5);
      rect = labelRect(label, width, height);
    }
    label.visible =
      width > 0 &&
      height > 0 &&
      rect.x - rect.width / 2 >= 8 &&
      rect.x + rect.width / 2 <= width - 8 &&
      rect.y - rect.height / 2 >= top &&
      rect.y + rect.height / 2 <= bottom &&
      !occupied.some((other) => labelsOverlap(rect, other));
    if (label.visible) occupied.push(rect);
  }
  return result;
}
