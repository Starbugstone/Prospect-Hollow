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
1–12, the 20th for levels 13–36, then the 35th rising to the 55th by level 240
(and the 55th thereafter, including the appended Tomorrow City levels 325–372).
Targets round down to 200-point increments; introductory targets never exceed
their old chest targets. This accounts for each puzzle's actual layout and
scoring opportunities instead of assuming later levels always produce higher
scores. Small and simpler puzzles can have lower absolute requirements.

The deeper mines (373–402) were calibrated the same way when they were added, then
redesigned to require board bonuses, and their targets were not updated at the time.
On 2026-10-04 they were rechecked with 100 seeds (1–100, which leaves the test's
held-out seeds out) and the same 55th-percentile rule. Nine targets were above the
new value, and the worst had made three stars rare: on seeds 31–120, levels 379 and
388 reached three stars in 17% of runs and 377 in 21%. Those nine were lowered:

| Level            | 374    | 375    | 377    | 379    | 383    | 388    | 391    | 392    | 395    |
| ---------------- | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ |
| Old target       | 35,800 | 35,800 | 28,600 | 41,000 | 26,400 | 40,200 | 35,000 | 45,200 | 28,800 |
| New target       | 33,600 | 34,200 | 21,600 | 29,400 | 24,000 | 29,800 | 30,600 | 45,000 | 23,600 |
| Three stars, old | 42%    | 40%    | 21%    | 17%    | 34%    | 17%    | 28%    | 44%    | 32%    |
| Three stars, new | 46%    | 48%    | 44%    | 42%    | 47%    | 46%    | 48%    | 46%    | 52%    |

The three-star rates are measured on seeds 31–120. The other 21 targets were at or
below the new value and were kept, so no published requirement rose. Some of them are
easier than the rest of the late campaign: levels 378, 390, 400, 382 and 396 reach
three stars in 81–88% of runs. The save-rule history still accepts a board started
before the change at the old target.

Levels do not all need the same rate. A level that reaches three stars in about
25–30% of runs is an intended challenge, not a calibration fault. Levels 252, 274,
281 and 320 reach 24–32% on seeds 31–120 and keep their targets. Recalibrate a level
only when it falls clearly below that, as 377, 379 and 388 had (17–21%).

To produce a candidate table for review after changing layouts or scoring:

```sh
node scripts/measure-campaign.mjs . 30 > /tmp/campaign-scores.json
node scripts/calibrate-star-targets.mjs /tmp/campaign-scores.json > /tmp/star-targets.js
npx vitest run testing/star-ratings.test.js testing/campaign-playthrough.test.js testing/chapter-progression.test.js
```

The calibration command only prints a candidate; review it before replacing
the authored table. `measure-campaign.mjs` also reports score, best cascade,
star target and earned stars alongside completion and economy measurements.
The deeper-mine candidate came from a level range (run each command with the
Docker prefix in `AGENTS.md`):

```sh
node scripts/measure-campaign.mjs . 100 402 $(seq -s, 373 402) > /tmp/deep-mine-scores.json
node scripts/calibrate-star-targets.mjs /tmp/deep-mine-scores.json 373 402
```

`testing/star-ratings.test.js` checks exact 100%/150% and ×4 boundaries,
persistence, independent chest rewards and fallback behavior. It also plays
20 held-out refill seeds per level (101–120), checking completion on every run
and at least one three-star completion per level. The opening levels must
achieve three stars in at least 14/20 runs each. Levels with blast-only
obstacles, which need board bonuses to finish (today 373–402), must achieve it in
at least 5/20. That catches targets left stale by a change to bonus rules, as
levels 377 (2/20) and 379 (4/20) were before 2026-10-04. Aggregate guards require at
least 85% three-star attainment in the opening, a decreasing rate across later
campaign bands, and 30–65% in the final band. Score-only attainment is also
guarded at 80% for the opening and 5% for the final band. In calibration,
score-only three-star attainment was about 93% in the opening and 10% in the
final band; most later three-star runs used the ×4 cascade route.

These simulations are repeatable balancing evidence, not human success rates
or an exhaustive solvability proof. Finite simulation budgets are diagnostics,
never gameplay limits. The original completion/pacing suite uses the same
simulation helper and retains its established seeds and regression limits.
