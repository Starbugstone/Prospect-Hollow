import { LATE_CHAPTERS } from './lateLevels.js';
// A chapter owns its board dimensions and active jewel count. Two-level seams
// rotate identities only; larger boards introduce the fifth color at level 13.
import { CITY_CHAPTERS } from './cityLevels.js';
export const CHAPTERS = [
  {
    name: 'First light',
    description: 'Four jewel colors. Follow the ice seams and find your rhythm.',
    theme: 'lantern',
    cols: 6,
    rows: 7,
    gemTypeCount: 4,
    palettes: [
      ['ruby', 'sapphire', 'emerald', 'topaz'],
      ['ruby', 'sapphire', 'emerald', 'amethyst'],
      ['ruby', 'sapphire', 'topaz', 'amethyst'],
    ],
  },
  {
    name: 'Stone gardens',
    description: 'Open small stone shelves in the mossy mine.',
    theme: 'moss',
    cols: 6,
    rows: 7,
    gemTypeCount: 4,
    palettes: [
      ['ruby', 'sapphire', 'emerald', 'topaz'],
      ['ruby', 'sapphire', 'emerald', 'moonstone'],
      ['ruby', 'emerald', 'topaz', 'moonstone'],
    ],
  },
  {
    name: 'Deep frost',
    description: 'A larger chamber, a fifth jewel, and a little double ice.',
    theme: 'frost',
    cols: 7,
    rows: 8,
    gemTypeCount: 5,
  },
  {
    name: 'Golden vaults',
    description: 'Open golden arches. Banded stone takes two hits.',
    theme: 'amber',
    cols: 7,
    rows: 8,
    gemTypeCount: 5,
  },
  {
    name: 'Prismatic paths',
    description: 'Follow crystal seams and open winding passages.',
    theme: 'prism',
    cols: 7,
    rows: 8,
    gemTypeCount: 5,
  },
  {
    name: 'Celestial summit',
    description: 'Thaw a few frozen gems beneath a starry cavern roof.',
    theme: 'moonlit',
    cols: 7,
    rows: 8,
    gemTypeCount: 5,
  },
  {
    name: 'Crystal depths',
    description: 'One more row, with room to explore the deep mine.',
    theme: 'depths',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    name: 'Chained treasures',
    description: 'Match the chained gems to break their links.',
    theme: 'forge',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    name: 'Prismatic locks',
    description: 'Match the marked color on each seal to open it.',
    theme: 'opal',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    name: 'Lost relics',
    description: 'Clear a path. Drop golden relics through the exits.',
    theme: 'relic',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'river-discovery',
    name: 'River discoveries',
    description: 'Follow the underground river to a new chapter for Prospect Hollow.',
    theme: 'river',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'rail-connections',
    name: 'Rail connections',
    description: 'Open connected galleries while the town builds its river and rail links.',
    theme: 'rail',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'lantern-works',
    name: 'Lantern works',
    description: 'Open the lamp-lit workshop galleries with familiar chains and ice.',
    theme: 'workshop',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'copper-galleries',
    name: 'Copper galleries',
    description: 'Follow copper seams, open colored seals and recover workshop treasures.',
    theme: 'copper',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'crystal-powerhouse',
    name: 'Crystal powerhouse',
    description: 'Bring the final discoveries home to a town full of light.',
    theme: 'electric',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'signal-galleries',
    name: 'Signal galleries',
    description: 'Open the signals and reconnect the underground passages.',
    theme: 'signals',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'brickworks',
    name: 'Brickworks below',
    description: 'Clear the masonry shelves and recover the buried relics.',
    theme: 'brickworks',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'waterworks',
    name: 'Waterworks depths',
    description: 'Follow the water channels through chains and colored seals.',
    theme: 'waterworks',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'dynamo-halls',
    name: 'Dynamo halls',
    description: 'Connect the final galleries beneath the electric town.',
    theme: 'dynamo',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'illuminated-vaults',
    name: 'Illuminated vaults',
    description: 'Bring the last treasures into the light of Prospect Hollow.',
    theme: 'illuminated',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'open-road',
    name: 'Open road seams',
    description: 'Follow open lanes and deliver little treasures for the growing town.',
    theme: 'road',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'garden-paths',
    name: 'Garden paths',
    description: 'Emerald seals and sheltered pockets bloom beneath the garden streets.',
    theme: 'garden',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'chrome-galleries',
    name: 'Chrome galleries',
    description: 'Open workshop shelves and reconnect the bright crystal lanes.',
    theme: 'chrome',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  {
    id: 'sunrise-valley',
    name: 'Sunrise valley',
    description: 'Bring the valley treasures home through sunlit crystal passages.',
    theme: 'sunrise',
    cols: 7,
    rows: 9,
    gemTypeCount: 5,
  },
  ...CITY_CHAPTERS,
  ...LATE_CHAPTERS,
];
export const LEVEL_COUNT = CHAPTERS.length * 6;

const FIVE_COLOR_SEAMS = [
  ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'],
  ['ruby', 'sapphire', 'emerald', 'amethyst', 'moonstone'],
  ['ruby', 'sapphire', 'emerald', 'topaz', 'moonstone'],
];
export const getLevelGemTypes = (id) => {
  const chapterIndex = Math.floor((id - 1) / 6);
  const chapter = CHAPTERS[chapterIndex];
  const seam = Math.floor(((id - 1) % 6) / 2);
  const palettes = chapter.palettes ?? FIVE_COLOR_SEAMS;
  return [...palettes[(seam + (chapter.palettes ? 0 : chapterIndex)) % palettes.length]];
};

export const POWERS = [
  { id: 'clear-row', label: 'Clear Row', dropWeight: 30 },
  { id: 'tnt', label: 'TNT', dropWeight: 25 },
  { id: 'color-wand', label: 'Color Wand', dropWeight: 20 },
  { id: 'shuffle', label: 'Shuffle', dropWeight: 10 },
  { id: 'tile-breaker', label: 'Tile Breaker', dropWeight: 15 },
];
export const CHEST_TIERS = [
  { id: 'crystal', label: 'Crystal chest', multiplier: 1, count: 1 },
  { id: 'radiant', label: 'Radiant chest', multiplier: 1.5, count: 1 },
  { id: 'celestial', label: 'Celestial chest', multiplier: 2, count: 1 },
];
export const getChestTier = (score, target) =>
  target > 0 ? [...CHEST_TIERS].reverse().find((tier) => score >= target * tier.multiplier) : null;
export const SPEED_CHEST_TIERS = CHEST_TIERS.map((tier, index) => ({
  ...tier,
  timeMultiplier: [1, 0.75, 0.5][index],
}));
export const getSpeedChestTier = (elapsedMs, targetMs) =>
  Number.isFinite(elapsedMs) && elapsedMs > 0 && Number.isFinite(targetMs) && targetMs > 0
    ? ([...SPEED_CHEST_TIERS]
        .reverse()
        .find((tier) => elapsedMs <= targetMs * tier.timeMultiplier) ?? null)
    : null;
export const formatTime = (ms) => {
  const seconds = Math.floor(Math.max(0, ms ?? 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
export { getStars } from './starRating.js';
