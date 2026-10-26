import { layoutTownLabels } from '../TownLabelLayout';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const MOON_ACTION_OFFSET = 76;

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
