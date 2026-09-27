import { LEVEL_COUNT } from './campaign';

// A fixed, small cargo mesh grows with completed levels. It is decoration, never
// a move allowance, reward multiplier or limit on campaign progress.
export const GEM_COLOURS = ['#b889ca', '#6dace5', '#6bcbae', '#e8c879', '#e495b3'];
export const CART_GEMS = Object.freeze(
  Array.from({ length: 12 }, (_, i) => ({
    x: i < 9 ? ((i % 3) - 1) * 0.21 : (i - 10) * 0.14,
    y: i < 9 ? 0.66 : 0.83,
    z: i < 9 ? (Math.floor(i / 3) - 1) * 0.16 : 0,
    colour: GEM_COLOURS[i % GEM_COLOURS.length],
  })),
);
export function mineGrowth(completedLevels, levelCount = LEVEL_COUNT) {
  const total = Math.max(1, Math.floor(levelCount) || 1);
  const completed = Math.max(0, Math.min(Math.floor(completedLevels) || 0, total));
  const count = 1 + Math.ceil((completed / total) * (CART_GEMS.length - 1));
  return { gems: CART_GEMS.slice(0, count) };
}
