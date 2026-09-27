// Optional advertising benefits never change normal puzzle rewards or move rules.
export const AD_POLICY = Object.freeze({
  minimumChapter: 1,
  chestsPerDay: 3,
  shufflesPerRun: 1,
  chestCoins: 25,
});

export const localAdDay = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export function normalizeAdvertising(saved, issuedRun = 0, levelCount = Infinity) {
  const run = (value) =>
    Number.isSafeInteger(value) && value >= 0 && value <= issuedRun ? value : 0;
  const next = saved?.pendingChapterAd?.nextLevelId;
  return {
    lastChestRun: run(saved?.lastChestRun),
    lastShuffleRun: run(saved?.lastShuffleRun),
    shuffleCount: Number.isSafeInteger(saved?.shuffleCount)
      ? Math.max(0, Math.min(AD_POLICY.shufflesPerRun, saved.shuffleCount))
      : run(saved?.lastShuffleRun)
        ? 1
        : 0,
    chestDay: /^\d{4}-\d{2}-\d{2}$/.test(saved?.chestDay) ? saved.chestDay : '',
    chestCount: Number.isSafeInteger(saved?.chestCount)
      ? Math.max(0, Math.min(AD_POLICY.chestsPerDay, saved.chestCount))
      : 0,
    pendingChapterAd:
      Number.isInteger(next) && next > 6 && next <= levelCount && next % 6 === 1
        ? { completedChapter: (next - 1) / 6, nextLevelId: next }
        : null,
  };
}
