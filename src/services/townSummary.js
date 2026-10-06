// Card data only. These summaries must never be loaded as playable saves.
const amount = (value) =>
  Number.isFinite(value) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, value)) : 0;
// The shape the town directory publishes: earned honour IDs and the showcase order.
const cardHonourData = (honours) =>
  honours && typeof honours === 'object' && !Array.isArray(honours)
    ? {
        earned: Array.isArray(honours.earned)
          ? honours.earned
          : Object.keys(honours.earned && typeof honours.earned === 'object' ? honours.earned : {}),
        showcase: Array.isArray(honours.showcase) ? honours.showcase : [],
      }
    : null;
export function profileSummary(profile) {
  if (!profile?.town) return null;
  return {
    era: typeof profile.town.era === 'string' ? profile.town.era : '',
    coins: amount(profile.town.coins),
    buildings: Object.values(profile.town.buildings ?? {}).filter(
      (level) => Number.isFinite(level) && level > 0,
    ).length,
    honours: cardHonourData(profile.honours),
  };
}
export function cardSummary(town, { activeProfile, cachedProfile } = {}) {
  if (activeProfile) return profileSummary(activeProfile);
  if (town.summary)
    return {
      era: typeof town.summary.era === 'string' ? town.summary.era : '',
      coins: amount(town.summary.coins),
      buildings: amount(town.summary.buildings),
      honours: cardHonourData(town.summary.honours),
    };
  // Older servers still work; opening a town is the only full-save request.
  return profileSummary(cachedProfile);
}
