// One upper-gallery contract serves the actual model and its accessible drawing.
// Mature gallery floors and brackets survive a new era's first finish; later
// finishes reglaze the same gallery and unfold its existing hinged shades.
export const TOWER_GALLERIES = Object.freeze({
  skyline: Object.freeze({ floor: 0.64 }),
  apartments: Object.freeze({ floor: 0.64 }),
  hotel: Object.freeze({ floor: 0.63 }),
  cityHomes: Object.freeze({ floor: 0.67 }),
});
export const TOWER_SHADE_FOLD = 0.08;
const STYLES = Object.freeze({
  canopy: Object.freeze({ shade: 'green', edge: 'timber', first: 1, storey: 1.2 }),
  riverlight: Object.freeze({ shade: 'roof', edge: 'timber', first: 1, storey: 1.2 }),
  sail: Object.freeze({ shade: 'roof', edge: 'timber', first: 1.3, storey: 1.1 }),
  observatory: Object.freeze({ shade: 'shell', edge: 'timber', first: 1.2, storey: 1.15 }),
  homestead: Object.freeze({
    shade: 'roof',
    edge: 'light',
    first: 1.1,
    floorOffset: -0.32,
    storey: 1.1,
  }),
  twin: Object.freeze({
    shade: 'roof',
    edge: 'light',
    first: 1.1,
    floorOffset: -0.32,
    storey: 1.1,
  }),
});
// A style without a gallery definition (a future era) keeps its renderer's own spacing.
export const towerStoreys = (style, fallback = null) =>
  Object.hasOwn(STYLES, style) ? STYLES[style] : fallback;

export function towerGallery(s, { r, h }) {
  const definition = Object.hasOwn(TOWER_GALLERIES, s.kind) ? TOWER_GALLERIES[s.kind] : null,
    roles = Object.hasOwn(STYLES, s.style) ? STYLES[s.style] : null;
  if (
    !definition ||
    !roles ||
    !(s.structureLevel >= 2) ||
    !Number.isFinite(r) ||
    !Number.isFinite(h) ||
    r <= 0
  )
    return null;
  // Small rear annexes remain ordinary rooms, not another upper gallery.
  if (h < 2.25 * (s.drawingScale ?? 1)) return null;
  const finish = Math.min(3, Math.max(1, s.finishLevel ?? 1)),
    height = Math.min(h * 0.22, r * 0.72),
    unit = s.drawingScale ?? 1,
    storey = roles.storey * unit,
    first = (roles.first + (roles.floorOffset ?? 0)) * unit,
    aligned = first + Math.round((h * definition.floor - first) / storey) * storey;
  return {
    floor: Math.max(h * definition.floor, Math.min(aligned, h - height - r * 0.28)),
    height,
    radius: r * 1.16,
    windowRadius: r * (finish >= 2 ? 1.045 : 1.01),
    windowHeight: height * (finish >= 2 ? 0.78 : 0.36),
    bladeWidth: r * (finish >= 2 ? 1.08 : 0.72),
    bladeDepth: r * (finish >= 3 ? 0.4 : finish >= 2 ? 0.32 : 0.18),
    pitch: finish >= 3 ? 0.34 : 0,
    foldRise: r * TOWER_SHADE_FOLD,
    finish,
    roles,
  };
}

/** Replace the old window row within the mature gallery, at every finish tier. */
export const galleryOverlaps = (gallery, bottom, top) =>
  !!gallery &&
  top > gallery.floor - gallery.height * 0.1 &&
  bottom < gallery.floor + gallery.height;
