// A place's action icon on every settlement map (a finish hammer, a collection, a bell):
// one contract for the valley and the Moon.
//
// - It is anchored in the world, just above what stands on its place, and projected on
//   every camera change, so at every zoom it is over its own place.
// - It is sized by how wide its place is drawn, between a floor that reads at a glance in
//   a phone's overview and a cap. Its tap target never shrinks below 44 pixels (CSS).
// - A ready hammer stands on a round badge (CSS); the badge is what the icon covers.
// - Crowded icons keep a little less than a badge apart and are never moved further than
//   a short leash from their own place: neighbours overlap before one is pushed off.
// - Under the map's header or bottom bar it is left out, never slid somewhere else. The
//   place itself still answers a tap.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// The share of its place's drawn width an icon takes, and its size in pixels.
const MARKER_SHARE = 0.42;
const MARKER_PIXELS = Object.freeze({ min: 30, max: 50, full: 50 });
// The badge is this much wider than the icon on it.
const MARKER_BADGE = 1.36;
const MARKER_CROWDING = 0.8;
const MARKER_LEASH = 0.3;
// An icon hangs this far above what stands on its place, measured no higher than this:
// over a tower it sits by the first storeys instead of in the sky.
const MARKER_LIFT = 1.1;
const MARKER_CEILING = 4.5;

/** The world height an icon hangs at over something `top` high standing at `ground`. */
export const markerHeight = (top, ground = 0) =>
  ground + Math.min(MARKER_CEILING, top) + MARKER_LIFT;

/**
 * An icon's size for a place drawn `span` pixels wide: a fraction of the full icon, in
 * steps, so a slow zoom redraws it only now and then.
 */
const markerSize = (span) => {
  const { min, max, full } = MARKER_PIXELS;
  const pixels = clamp((span ?? Infinity) * MARKER_SHARE, min, max);
  return Math.round((pixels / full) * 20) / 20;
};

/**
 * Projects a place's marker. `at` is its world anchor (a Vector3, left unchanged), `width`
 * how wide the place is in world units, `scratch` a Vector3 to work in. Returns its point
 * in percent of the view and `span`, the pixels its place is drawn across.
 */
export function projectMarker(camera, at, width, viewHeight, scratch) {
  scratch.copy(at).project(camera);
  const marker = {
    x: (scratch.x + 1) * 50,
    y: (1 - scratch.y) * 50,
    visible: scratch.z > -1 && scratch.z < 1,
  };
  const y = scratch.y;
  scratch.set(at.x, at.y + 1, at.z).project(camera);
  marker.span = (Math.abs(scratch.y - y) * viewHeight * width) / 2;
  return marker;
}

/**
 * Where a projected marker's icon is drawn in a `width` by `height` view whose chrome
 * leaves `top` to `bottom` free: the `collection` both maps publish for the shared layout
 * and the icon component. `shown` is whether the map shows this place's icon at all.
 */
export function markerPlace(
  marker,
  width,
  height,
  { top = 0, bottom = height, shown = true } = {},
) {
  const size = markerSize(marker.span);
  // Its badge is what it covers on screen.
  const half = (MARKER_PIXELS.full * size * MARKER_BADGE) / 2;
  const [x, y] = [(marker.x * width) / 100, (marker.y * height) / 100];
  return {
    x: marker.x,
    y: marker.y,
    size,
    // The room it keeps from other icons, and how far keeping it may move it.
    extent: half * 2 * MARKER_CROWDING,
    leash: half * 2 * MARKER_LEASH,
    visible:
      !!width &&
      !!height &&
      !!shown &&
      marker.visible !== false &&
      x >= half &&
      x <= width - half &&
      y >= top + half &&
      y <= bottom - half,
  };
}
