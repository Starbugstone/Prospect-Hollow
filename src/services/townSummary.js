// Card data only. These summaries must never be loaded as playable saves.
const amount = (value) =>
  Number.isFinite(value) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, value)) : 0;
export function profileSummary(profile) {
  if (!profile?.town) return null;
  return {
    era: typeof profile.town.era === 'string' ? profile.town.era : '',
    coins: amount(profile.town.coins),
    buildings: Object.values(profile.town.buildings ?? {}).filter(
      (level) => Number.isFinite(level) && level > 0,
    ).length,
  };
}
export function cardSummary(town, { activeProfile, cachedProfile } = {}) {
  if (activeProfile) return profileSummary(activeProfile);
  if (town.summary)
    return {
      era: typeof town.summary.era === 'string' ? town.summary.era : '',
      coins: amount(town.summary.coins),
      buildings: amount(town.summary.buildings),
    };
  // Older servers still work; opening a town is the only full-save request.
  return profileSummary(cachedProfile);
}
