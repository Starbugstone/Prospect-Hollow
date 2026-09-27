export const AD_PLACEMENTS = Object.freeze({
  CHAPTER_TRANSITION: 'chapter-transition',
  BONUS_CHEST: 'bonus-chest',
  MANUAL_SHUFFLE: 'manual-shuffle',
});

export function isValidPlacement(format, placement) {
  return format === 'interstitial'
    ? placement === AD_PLACEMENTS.CHAPTER_TRANSITION
    : format === 'rewarded' &&
        [AD_PLACEMENTS.BONUS_CHEST, AD_PLACEMENTS.MANUAL_SHUFFLE].includes(placement);
}
