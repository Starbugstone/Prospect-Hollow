import { MOON_FLOOR_RADIUS } from '../../../data/moonSettlement';
import { layoutTownLabels } from '../TownLabelLayout';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// An action icon is sized by its own place: this share of the width its pad is drawn at,
// never smaller than can be seen at a glance in a phone's overview and never larger than
// the valley's. It stands on a round badge this much wider than itself.
const MARKER_SHARE = 0.42;
const MOON_MARKER_PIXELS = Object.freeze({ min: 30, max: 50, full: 50 });
const MARKER_BADGE = 1.36;
const MARKER_CROWDING = 0.8;
/**
 * An action icon's size for a place whose pad is drawn `pad` pixels wide: a fraction of the
 * full icon, in steps, so a slow zoom redraws it only now and then.
 */
const moonMarkerSize = (pad) => {
  const { min, max, full } = MOON_MARKER_PIXELS;
  const pixels = clamp((pad ?? Infinity) * MARKER_SHARE, min, max);
  return Math.round((pixels / full) * 20) / 20;
};

// The SVG map flattens the Moon's ground: x widens and z becomes y under the crater's tilt.
export const MOON_MAP_SCALE = Object.freeze([1.3, 1.05]);
export const moonMapPoint = (x, z) => [x * MOON_MAP_SCALE[0], 6 + z * MOON_MAP_SCALE[1]];
// What a drawn lot or site covers on the map round its own point: its pad to either side,
// its building above and the pad's lip below.
const PLACE_REACH = Object.freeze({ side: 9.5, above: 13, below: 3 });
const MAP_MARGIN = 2;
/**
 * The SVG map's viewBox, `{ x, y, width, height }`: the crater floor, every lot and site
 * shown (`places`, as map points `{ x, y }`) and the level ground of each district the town
 * has opened. Nothing drawn for the town falls outside it.
 */
export function moonMapBox(districts = [], places = []) {
  const [sx, sy] = MOON_MAP_SCALE,
    [, floorY] = moonMapPoint(0, 0);
  let [left, top, right, bottom] = [
    -MOON_FLOOR_RADIUS * sx,
    floorY - MOON_FLOOR_RADIUS * sy,
    MOON_FLOOR_RADIUS * sx,
    floorY + MOON_FLOOR_RADIUS * sy,
  ];
  const hold = (x0, y0, x1, y1) => {
    left = Math.min(left, x0);
    top = Math.min(top, y0);
    right = Math.max(right, x1);
    bottom = Math.max(bottom, y1);
  };
  for (const { x, y } of places)
    hold(x - PLACE_REACH.side, y - PLACE_REACH.above, x + PLACE_REACH.side, y + PLACE_REACH.below);
  for (const { centre, floor, stone } of districts) {
    const [x, y] = moonMapPoint(...centre);
    hold(
      x - floor * sx,
      y - Math.max(floor * sy, stone?.size[1] ?? 0),
      x + floor * sx,
      y + floor * sy,
    );
  }
  return {
    x: left - MAP_MARGIN,
    y: top - MAP_MARGIN,
    width: right - left + MAP_MARGIN * 2,
    height: bottom - top + MAP_MARGIN * 2,
  };
}
/** Whether a place drawn at map point (x, y) lies wholly inside `box`. */
export const moonMapHolds = (box, { x, y }) =>
  x - PLACE_REACH.side >= box.x &&
  x + PLACE_REACH.side <= box.x + box.width &&
  y - PLACE_REACH.above >= box.y &&
  y + PLACE_REACH.below <= box.y + box.height;
// The crater with nothing built: the box a caller without a town reads.
const CRATER_BOX = Object.freeze(moonMapBox());
/** A map point as percentages of a view the box is letterboxed into. */
export function moonMapPercent([x, y], { width, height }, box = CRATER_BOX) {
  const scale = Math.min(width / box.width, height / box.height);
  return [
    width ? 50 + (((x - (box.x + box.width / 2)) * scale) / width) * 100 : 50,
    height ? 50 + (((y - (box.y + box.height / 2)) * scale) / height) * 100 : 50,
  ];
}

// The SVG viewBox is centred and letterboxed, so percentages of its drawing
// coordinates are not percentages of a tall or wide container.
export function moonMapLabel({ id, x, y }, view, box = CRATER_BOX) {
  // A name hangs a little above its place's own point.
  const [px, py] = moonMapPercent([x, y - 6], view, box);
  // Its action icon hangs over the top of its drawing, sized with the map.
  const [mx, my] = moonMapPercent([x, y - PLACE_REACH.above], view, box);
  const scale = Math.min(view.width / box.width, view.height / box.height);
  const visible = !!view.width && !!view.height;
  const pad = scale * PLACE_REACH.side * 2;
  return { id, x: px, y: py, visible, marker: { x: mx, y: my, visible, pad } };
}

// A place's action icon stays at its projected marker: over its own worksite or building
// at every zoom. Under the header or the bottom chrome it is not drawn (the pad still
// answers a tap); it is never slid somewhere else to stay on screen.
function markerPlace(label, width, height, top, bottom) {
  const marker = label.marker ?? { x: label.x, y: label.y, visible: true };
  const size = moonMarkerSize(marker.pad);
  // Its badge is what it covers on screen.
  const half = (MOON_MARKER_PIXELS.full * size * MARKER_BADGE) / 2;
  const [x, y] = [(marker.x * width) / 100, (marker.y * height) / 100];
  return {
    x: marker.x,
    y: marker.y,
    size,
    // The room it keeps from other icons: a little less than its badge, so in a crowded
    // overview neighbouring badges may touch and overlap slightly instead of being pushed
    // off their own sites.
    extent: half * 2 * MARKER_CROWDING,
    visible:
      !!width &&
      !!height &&
      marker.visible !== false &&
      (label.inView ?? label.visible) &&
      x >= half &&
      x <= width - half &&
      y >= top + half &&
      y <= bottom - half,
  };
}
// Only projection and Moon chrome bounds belong here. Label size, density,
// priority, collisions and styling follow the same contract as the valley.
// `avoid` lists what no name may cover (the Quiet Stone), as rectangles in percent of the
// view about their centres: `{ id, x, y, width, height }`.
export function layoutMoonLabels(labels, width, height, { avoid = [] } = {}) {
  const top = width < 600 ? 164 : height < 450 ? 110 : 112;
  const bottom = height - (height < 450 ? 42 : 120);
  const projected = labels.map((label) => ({
    ...label,
    offsetY: label.action ? 24 : 0,
    collection: label.action ? markerPlace(label, width, height, top, bottom) : undefined,
  }));
  return layoutTownLabels(projected, width, height, {
    top,
    bottom,
    avoid: avoid.map((box) => ({
      id: box.id,
      x: (box.x * width) / 100,
      y: (box.y * height) / 100,
      width: (box.width * width) / 100,
      height: (box.height * height) / 100,
    })),
  });
}
