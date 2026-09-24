import { LEVEL_COUNT } from './campaign';

// Count authored levels only: continuous scores and unknown saved IDs never count.
export function campaignCompletion(records, levelCount = LEVEL_COUNT) {
  const levels = Array.from({ length: levelCount }, (_, i) => i + 1);
  const perfect = levels.filter((id) => records[id]?.stars === 3).length;
  return {
    perfect,
    total: levelCount,
    remaining: levelCount - perfect,
    complete: levelCount > 0 && perfect === levelCount,
    replayIds: levels.filter((id) => records[id] && records[id].stars < 3),
    unplayed: levels.filter((id) => !records[id]).length,
  };
}
