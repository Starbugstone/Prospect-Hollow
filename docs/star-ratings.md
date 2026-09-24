# Star ratings

Normal puzzle completions earn one star, plus one for reaching the level's
star score target, plus one for either a ×4-or-higher cascade or 150% of that
target. These two bonus stars are independent: a ×4 cascade below the base
target earns two stars. Three stars require the base target as well.

Time and move count never affect stars or block completion. The board finishes
when its normal objectives are cleared. Continuous play does not award stars.
Previously earned best stars remain saved, including stars earned under older
rules. Replays can improve them.

`src/data/starRating.js` owns the shared rules and thresholds.
`src/data/starScoreTargets.js` contains one authored target per level, with six
levels on each chapter row. The generator exposes `starScoreTarget`; unsupported
levels fall back to their chest score target. Star targets are separate from
chest targets so balancing stars does not change chest rewards or income.
The pause panel and results' **Puzzle highlights** use a shared explanation,
including the current level's numeric requirements, in English and French.

## Calibration and regression coverage

Targets were calibrated from 30 deterministic, hint-led refill seeds per level
(1–30), using legal matches, earned board bonuses and free dead-board reshuffles,
without inventory powers. Scoring uses the live game's shared `clearScore`
helper. Measurement stops at normal objective completion, including the final
move's cascades, without playing on to accumulate stars.

For each run, the effective score is its score if it achieved a ×4 cascade,
otherwise its score divided by 1.5. Targets use the 10th percentile for levels
1–12, the 20th for levels 13–36, then the 35th rising to the 55th by level 240.
Targets round down to 200-point increments; introductory targets never exceed
their old chest targets. This accounts for each puzzle's actual layout and
scoring opportunities instead of assuming later levels always produce higher
scores. Small and simpler puzzles can have lower absolute requirements.

To produce a candidate table for review after changing layouts or scoring:

```sh
node scripts/measure-campaign.mjs . 30 > /tmp/campaign-scores.json
node scripts/calibrate-star-targets.mjs /tmp/campaign-scores.json > /tmp/star-targets.js
npx vitest run testing/star-ratings.test.js testing/campaign-playthrough.test.js testing/chapter-progression.test.js
```

The calibration command only prints a candidate; review it before replacing
the authored table. `measure-campaign.mjs` also reports score, best cascade,
star target and earned stars alongside completion and economy measurements.

`testing/star-ratings.test.js` checks exact 100%/150% and ×4 boundaries,
persistence, independent chest rewards and fallback behavior. It also plays
20 held-out refill seeds per level (101–120), checking completion on every run
and at least one three-star completion per level. The opening levels must
achieve three stars in at least 14/20 runs each. Aggregate guards require at
least 85% three-star attainment in the opening, a decreasing rate across later
campaign bands, and 30–65% in the final band. Score-only attainment is also
guarded at 80% for the opening and 5% for the final band. In calibration,
score-only three-star attainment was about 93% in the opening and 10% in the
final band; most later three-star runs used the ×4 cascade route.

These simulations are repeatable balancing evidence, not human success rates
or an exhaustive solvability proof. Finite simulation budgets are diagnostics,
never gameplay limits. The original completion/pacing suite uses the same
simulation helper and retains its established seeds and regression limits.
