import { layoutTownLabels } from '../TownLabelLayout';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const MOON_ACTION_OFFSET = 76;

// The SVG map flattens the Moon's ground: x widens and z becomes y under the crater's tilt.
export const MOON_MAP_SCALE = Object.freeze([1.3, 1.05]);
export const moonMapPoint = (x, z) => [x * MOON_MAP_SCALE[0], 6 + z * MOON_MAP_SCALE[1]];
// The crater alone fills this box.
const CRATER_BOX = Object.freeze({ x: -60, y: -50, width: 120, height: 100 });
/**
 * The SVG map's viewBox, `{ x, y, width, height }`: the crater, widened to hold the level
 * ground of each district the town has opened.
 */
export function moonMapBox(districts = []) {
  let [left, top, right, bottom] = [
    CRATER_BOX.x,
    CRATER_BOX.y,
    CRATER_BOX.x + CRATER_BOX.width,
    CRATER_BOX.y + CRATER_BOX.height,
  ];
  for (const { centre, floor } of districts) {
    const [x, y] = moonMapPoint(...centre),
      reach = floor + 4;
    left = Math.min(left, x - reach * MOON_MAP_SCALE[0]);
    right = Math.max(right, x + reach * MOON_MAP_SCALE[0]);
    top = Math.min(top, y - reach * MOON_MAP_SCALE[1]);
    bottom = Math.max(bottom, y + reach * MOON_MAP_SCALE[1]);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// The SVG viewBox is centred and letterboxed, so percentages of its drawing
// coordinates are not percentages of a tall or wide container.
export function moonMapLabel({ id, x, y }, { width, height }, box = CRATER_BOX) {
  const scale = Math.min(width / box.width, height / box.height);
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  return {
    id,
    x: width ? 50 + (((x - cx) * scale) / width) * 100 : 50,
    y: height ? 50 + (((y - 6 - cy) * scale) / height) * 100 : 50,
    visible: !!width && !!height,
  };
}

// Only projection and Moon chrome bounds belong here. Label size, density,
// priority, collisions and styling follow the same contract as the valley.
export function layoutMoonLabels(labels, width, height) {
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
  return layoutTownLabels(projected, width, height, { top, bottom });
}
