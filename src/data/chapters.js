// Every mine chapter holds six levels; level ids start at 1.
export const LEVELS_PER_CHAPTER = 6;
// Zero-based chapter of a level, and the level's position inside that chapter.
export const chapterIndexOf = (levelId) => Math.floor((levelId - 1) / LEVELS_PER_CHAPTER);
export const chapterSlotOf = (levelId) => (levelId - 1) % LEVELS_PER_CHAPTER;
export const chapterLevelIds = (chapterIndex) =>
  Array.from(
    { length: LEVELS_PER_CHAPTER },
    (_, slot) => chapterIndex * LEVELS_PER_CHAPTER + slot + 1,
  );
