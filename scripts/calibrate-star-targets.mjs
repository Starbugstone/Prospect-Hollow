// node scripts/measure-campaign.mjs . 30 > /tmp/campaign-scores.json
// node scripts/calibrate-star-targets.mjs /tmp/campaign-scores.json
// Outputs a reviewable candidate table; does not overwrite authored targets.
import { readFile } from 'node:fs/promises';
import { LEVEL_COUNT } from '../src/data/campaign.js';
import { STAR_CASCADE_TARGET, STAR_SCORE_MULTIPLIER } from '../src/data/starRating.js';

const { results } = JSON.parse(await readFile(process.argv[2], 'utf8'));
const targets = Array.from({ length: LEVEL_COUNT }, (_, index) => {
  const id = index + 1;
  const runs = results.filter((run) => run.id === id);
  if (
    runs.length < 30 ||
    runs.some(
      (run) => !run.complete || !Number.isFinite(run.score) || !Number.isFinite(run.maxCombo),
    )
  )
    throw new Error(`Level ${id} needs at least 30 complete, scored calibration runs`);
  // A ×4 chain needs the base target; otherwise three stars need 150%.
  const effective = runs
    .map((run) => run.score / (run.maxCombo >= STAR_CASCADE_TARGET ? 1 : STAR_SCORE_MULTIPLIER))
    .sort((a, b) => a - b);
  // Opening p10, next four chapters p20, then p35 rising to p55 by level 240.
  // Use actual score distributions, so small/easy layouts get smaller targets.
  const percentile =
    id <= 12 ? 0.1 : id <= 36 ? 0.2 : 0.35 + ((Math.min(id, 240) - 37) / 203) * 0.2;
  let target = Math.max(
    200,
    Math.floor(effective[Math.floor((runs.length - 1) * percentile)] / 200) * 200,
  );
  if (id <= 12) target = Math.min(target, runs[0].chestTarget);
  return target;
});
console.log('// Per-level star score targets, one chapter per row (six puzzles).');
console.log('// Calibrated from 30 hint-led refill seeds per level; see docs/star-ratings.md.');
console.log('// Independent of chest rewards. Three stars use 150% or target + a ×4 cascade.');
console.log('// prettier-ignore');
console.log('export const STAR_SCORE_TARGETS = Object.freeze([');
for (let i = 0; i < targets.length; i += 6) console.log(`  ${targets.slice(i, i + 6).join(', ')},`);
console.log(']);');
