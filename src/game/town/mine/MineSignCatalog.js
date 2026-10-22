import catalog from '../../../data/generated/mineSignMounts.json';

export const MINE_SIGN_BOARDS = Object.freeze({
  entrance: 'mine-entrance',
  portal: 'mine-portal',
});

export const mineSignKey = (board, era) => `${board}|${era}`;

// The small permanent-scene table is eager: mine cinematics can start before
// the next era's asynchronous plot catalogs finish loading. Labels, railway
// access and mine progress do not change these two authored requests.
export function mineSignMountFor(board, era, context) {
  // Translation preserves the camera ray direction. A custom rotated/scaled
  // scene does not, and must keep the faithful physical resolver instead.
  if (context) {
    context.updateWorldMatrix(true, false);
    if (
      context.matrixWorld.elements.some(
        (value, index) =>
          index < 12 && Math.abs(Math.round(value * 1e5) - (index % 5 === 0 ? 1e5 : 0)) > 1,
      )
    )
      return null;
  }
  const index = catalog.format === 1 && catalog.keys?.[mineSignKey(board, era)];
  return Number.isInteger(index) && index >= 0 ? (catalog.mounts?.[index] ?? null) : null;
}
