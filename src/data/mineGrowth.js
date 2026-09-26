import { LEVEL_COUNT } from './campaign';
export const VEIN_CAPACITY = Object.freeze({ seams: 6, perSeam: 9 });
export const STOCKPILE_BANDS = [0, 6, 12, 24];
export const DETAIL_BANDS = { aditLights: 24, lampsAndBins: 36 };
export const EXTRA_STOCK_FROM = 12;
export const GEM_COLOURS = ['#b889ca', '#6dace5', '#6bcbae', '#e8c879', '#e495b3'];
export function mineGrowth(completedChapters, chapterCount = LEVEL_COUNT / 6) {
  chapterCount = Math.max(1, Math.floor(chapterCount) || 1);
  const n = Math.max(0, Math.min(Math.floor(completedChapters) || 0, chapterCount));
  const slots = VEIN_CAPACITY.seams * VEIN_CAPACITY.perSeam,
    grouped = chapterCount > slots;
  const lit = grouped ? Math.ceil((n * slots) / chapterCount) : n;
  const firstChapter = (i) => (grouped ? Math.floor((i * chapterCount) / slots) : i) + 1;
  const stockpile = STOCKPILE_BANDS.filter((b) => n >= b).length - 1;
  const aditLights = n >= DETAIL_BANDS.aditLights,
    lampsAndBins = n >= DETAIL_BANDS.lampsAndBins,
    plaque = n >= chapterCount;
  return {
    veins: Array.from({ length: lit }, (_, i) => ({
      segmentIndex: i,
      seamIndex: Math.floor(i / 9),
      colour: GEM_COLOURS[(firstChapter(i) - 1) % 5],
    })),
    stockpile,
    aditLights,
    lampsAndBins,
    plaque,
    extraStock: n >= EXTRA_STOCK_FROM,
    band: [stockpile, +aditLights, +lampsAndBins, +plaque].join(':'),
  };
}
