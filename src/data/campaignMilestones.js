import { CHAPTERS } from './campaign';

// Stable chapter IDs, not the current number of levels, own the transition gates.
const CAMPAIGN_MILESTONES = {
  'river-discovery': { chapter: 'river-discovery' },
};
export function campaignMilestoneReached(records, id) {
  const milestone = CAMPAIGN_MILESTONES[id];
  if (!milestone) return false;
  const index = CHAPTERS.findIndex((chapter) => chapter.id === milestone.chapter);
  return (
    index >= 0 &&
    Array.from({ length: 6 }, (_, i) => index * 6 + i + 1).every((level) => !!records[level])
  );
}
