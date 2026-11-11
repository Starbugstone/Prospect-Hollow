import { MOON_FLOOR_RADIUS } from '../../../data/moonSettlement';
import { layoutTownLabels } from '../TownLabelLayout';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const MOON_ACTION_OFFSET = 76;

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
  return { id, x: px, y: py, visible: !!view.width && !!view.height };
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
    collection: label.action
      ? {
          x: width ? (clamp((label.x * width) / 100, 40, width - 40) / width) * 100 : 50,
          y: height
            ? (clamp((label.y * height) / 100 - MOON_ACTION_OFFSET, top + 40, bottom - 34) /
                height) *
              100
            : 50,
          visible: !!width && !!height && (label.inView ?? label.visible),
        }
      : undefined,
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
