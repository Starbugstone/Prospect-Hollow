import { LATE_CHAPTERS } from './lateLevels.js';
import { TOMORROW_CHAPTERS } from './tomorrowLevels.js';
import { DEEP_MINE_CHAPTERS } from './deepMineLevels.js';
import { HOLLOW_MINE_CHAPTERS } from './hollowMineLevels.js';
// A chapter owns its board dimensions and active jewel count. Two-level seams
// rotate identities only; larger boards introduce the fifth color at level 13.
import { CITY_CHAPTERS } from './cityLevels.js';
import { LEVELS_PER_CHAPTER, chapterIndexOf, chapterSlotOf } from './chapters.js';
// From Crystal depths onward every chapter plays on a 7 × 9 board with five jewel types.
// Defaults follow a chapter's own fields, keeping the saved key order stable.
const withBoardDefaults = (chapter) => ({
  ...chapter,
  cols: chapter.cols ?? 7,
  rows: chapter.rows ?? 9,
  gemTypeCount: chapter.gemTypeCount ?? 5,
});
export const CHAPTERS = [
  {
    name: 'First light',
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
    theme: 'frost',
    cols: 7,
    rows: 8,
    gemTypeCount: 5,
  },
  {
    name: 'Golden vaults',
    theme: 'amber',
    cols: 7,
    rows: 8,
    gemTypeCount: 5,
  },
  {
    name: 'Prismatic paths',
    theme: 'prism',
    cols: 7,
    rows: 8,
    gemTypeCount: 5,
  },
  {
    name: 'Celestial summit',
    theme: 'moonlit',
    cols: 7,
    rows: 8,
    gemTypeCount: 5,
  },
  {
    name: 'Crystal depths',
    theme: 'depths',
  },
  {
    name: 'Chained treasures',
    theme: 'forge',
  },
  {
    name: 'Prismatic locks',
    theme: 'opal',
  },
  {
    name: 'Lost relics',
    theme: 'relic',
  },
  {
    id: 'river-discovery',
    name: 'River discoveries',
    theme: 'river',
  },
  {
    id: 'rail-connections',
    name: 'Rail connections',
    theme: 'rail',
  },
  {
    id: 'lantern-works',
    name: 'Lantern works',
    theme: 'workshop',
  },
  {
    id: 'copper-galleries',
    name: 'Copper galleries',
    theme: 'copper',
  },
  {
    id: 'crystal-powerhouse',
    name: 'Crystal powerhouse',
    theme: 'electric',
  },
  {
    id: 'signal-galleries',
    name: 'Signal galleries',
    theme: 'signals',
  },
  {
    id: 'brickworks',
    name: 'Brickworks below',
    theme: 'brickworks',
  },
  {
    id: 'waterworks',
    name: 'Waterworks depths',
    theme: 'waterworks',
  },
  {
    id: 'dynamo-halls',
    name: 'Dynamo halls',
    theme: 'dynamo',
  },
  {
    id: 'illuminated-vaults',
    name: 'Illuminated vaults',
    theme: 'illuminated',
  },
  {
    id: 'open-road',
    name: 'Open road seams',
    theme: 'road',
  },
  {
    id: 'garden-paths',
    name: 'Garden paths',
    theme: 'garden',
  },
  {
    id: 'chrome-galleries',
    name: 'Chrome galleries',
    theme: 'chrome',
  },
  {
    id: 'sunrise-valley',
    name: 'Sunrise valley',
    theme: 'sunrise',
  },
  ...CITY_CHAPTERS,
  ...LATE_CHAPTERS,
  ...TOMORROW_CHAPTERS,
  ...DEEP_MINE_CHAPTERS,
  ...HOLLOW_MINE_CHAPTERS,
].map(withBoardDefaults);
export const LEVEL_COUNT = CHAPTERS.length * LEVELS_PER_CHAPTER;

const FIVE_COLOR_SEAMS = [
  ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'],
  ['ruby', 'sapphire', 'emerald', 'amethyst', 'moonstone'],
  ['ruby', 'sapphire', 'emerald', 'topaz', 'moonstone'],
];
export const getLevelGemTypes = (id) => {
  const chapterIndex = chapterIndexOf(id);
  const chapter = CHAPTERS[chapterIndex];
  const seam = Math.floor(chapterSlotOf(id) / 2);
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
// One chest per goal met. Chests have no tiers for now; see issue #57 for tier ideas.
export const CHEST_LABELS = Object.freeze({
  completion: 'Completion chest',
  score: 'Score chest',
  speed: 'Speed chest',
});
export const scoreChestEarned = (score, target) => target > 0 && score >= target;
export const speedChestEarned = (elapsedMs, targetMs) =>
  Number.isFinite(elapsedMs) &&
  elapsedMs > 0 &&
  Number.isFinite(targetMs) &&
  targetMs > 0 &&
  elapsedMs <= targetMs;
// The chests a finished run earns: a score chest (or the completion chest when no
// other chest is earned) plus a speed chest. Shared by rewards and the live meter.
export const runChests = (score, target, elapsedMs, targetMs) => {
  const scored = scoreChestEarned(score, target);
  const fast = speedChestEarned(elapsedMs, targetMs);
  return [scored ? 'score' : fast ? null : 'completion', fast ? 'speed' : null]
    .filter(Boolean)
    .map((source) => ({ source, label: CHEST_LABELS[source] }));
};
export const formatTime = (ms) => {
  const seconds = Math.floor(Math.max(0, ms ?? 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
export { getStars } from './starRating.js';
