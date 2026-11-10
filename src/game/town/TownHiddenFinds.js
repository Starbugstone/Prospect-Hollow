import { Vector3 } from 'three';

// The tap test every hidden find shares, on every settlement map. Screen pixels a world
// unit must span at a target before it can be found: farther out everything is a speck,
// and tapping across the town would make a find by chance. A find is an easter egg, so a
// far-off target answers nothing; only just short of the find zoom (`FIND_HINT_SCALE`)
// may a tap ask to zoom in.
export const FIND_SCALE = 40,
  FIND_HINT_SCALE = 30;

const feet = new Vector3(),
  head = new Vector3(),
  view = new Vector3();
// A target's middle on the screen and how far the tap is from it, or null when hidden or
// off screen. `scale` is the pixels per world unit at its feet.
function onScreen(camera, { root, height = 1 }, rect, clientX, clientY) {
  if (!root?.visible || root.scale.x < 0.5) return null;
  const toScreen = (p) => [
    rect.left + ((p.x + 1) * rect.width) / 2,
    rect.top + ((1 - p.y) * rect.height) / 2,
  ];
  root.getWorldPosition(feet);
  head.copy(feet);
  head.y += height * root.scale.y;
  view.copy(feet).applyMatrix4(camera.matrixWorldInverse);
  feet.project(camera);
  head.project(camera);
  if (feet.z < -1 || feet.z > 1) return null;
  const [fx, fy] = toScreen(feet),
    [hx, hy] = toScreen(head);
  const x = (fx + hx) / 2,
    y = (fy + hy) / 2;
  return {
    x,
    y,
    size: Math.hypot(hx - fx, hy - fy),
    gap: Math.hypot(clientX - x, clientY - y),
    scale: (rect.height / 2) * (camera.projectionMatrix.elements[5] / -view.z),
  };
}

/**
 * What a click means for the hidden finds, or null when it is not for them. `targets`
 * are `{ root, height, find, hint }`: the things on the map a find can be mistaken for.
 * `find` names the hidden find a target is right now, or is null for a look-alike.
 *
 * Close enough (`FIND_SCALE`), a click on a find gives `{ find, x, y }` with its place
 * on the canvas in percent; the hit area reaches past the body because targets are small
 * and keep moving. Just short of that zoom, a click on the body of any target, find or
 * look-alike, gives `{ find: hint, zoom: true }`, so taps cannot tell them apart; the
 * caller shows it only when nothing else answers the click. Farther out it gives nothing.
 * A tap never moves the camera.
 */
export function hiddenFindTap({ camera, canvas }, targets, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  let near = null;
  for (const target of targets) {
    const spot = onScreen(camera, target, rect, clientX, clientY);
    if (!spot || spot.scale < FIND_HINT_SCALE) continue;
    if (spot.scale < FIND_SCALE) {
      if (spot.gap <= Math.max(12, spot.size / 2 + 6)) near ??= target.hint;
      continue;
    }
    if (target.find && spot.gap <= Math.max(28, spot.size / 2 + 14))
      return {
        find: target.find,
        x: ((spot.x - rect.left) / rect.width) * 100,
        y: ((spot.y - rect.top) / rect.height) * 100,
      };
  }
  return near ? { find: near, zoom: true } : null;
}
