import { CHAPTERS } from './campaign';
import { chapterLevelIds } from './chapters';
import { bonusCapacity, chestReward, grantReward } from './rewards';

const GIFTS = ['tnt', 'color-wand', 'clear-row', 'tile-breaker'];
export const chapterGift = (chapter) => chestReward(GIFTS[(chapter - 1) % GIFTS.length]);

export function journeyProgress(records) {
  const chapterIndex = CHAPTERS.findIndex((_, index) =>
    chapterLevelIds(index).some((id) => !records[id]),
  );
  if (chapterIndex < 0) return null;
  const levels = chapterLevelIds(chapterIndex).map((id) => ({ id, complete: !!records[id] }));
  return {
    chapter: chapterIndex + 1,
    name: CHAPTERS[chapterIndex].name,
    levels,
    remaining: levels.filter((level) => !level.complete).length,
    gift: chapterGift(chapterIndex + 1),
  };
}

export function grantChapterGift(state, chapter) {
  const gift = chapterGift(chapter);
  const slot = state.powers.find((power) => power.id === gift.id);
  // A full bag still gets a meaningful chapter gift; ordinary overflow stays compatible.
  return grantReward(
    state,
    slot.quantity >= bonusCapacity(state.town)
      ? {
          id: 'coins',
          kind: 'coins',
          label: 'Coins',
          quantity: chapter * 100,
          convertedFrom: gift.label,
        }
      : gift,
  );
}
