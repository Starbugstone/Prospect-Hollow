# Economy balance

## Combined balance check: VIP economy v2 (2026-10-24)

**Verdict: balanced within the measured patterns; no economy tuning recommended.**
Mining remains the dominant coin source. VIPs and moonstone sales together save
one or two normal puzzles toward final town completion in the three measured seeds.
Continuous mastery gains reflect substantial extra play. Both monuments remain a long optional pursuit
beyond Twin Hollows construction, including when continuous visits are deferred
until the workshop can use their gems. The approved VIP doubling is the only
reward change in this rerun: new v2 receipts pay **10 × mining depth**, while v1
retains **5 × depth** and unversioned receipts retain flat five. No further tuning
is recommended from these measured patterns.

### Method and reproduction

Board-sample base commit `9d00d5604c22c89aa994ac2842beeb0e7903822a`. The existing
[`measure-campaign.mjs`](../scripts/measure-campaign.mjs) actually plays all
**546 levels × seeds 1–3**, once to normal completion and once for a diagnostic
20-move continuous visit: **3,276 board samples**, all successful. This v2 rerun
reuses those unchanged normal/continuous board samples; it reruns the integrated and standalone VIP
probes against the new runtime VIP terms. The
[`measure-economy-balance.mjs`](../scripts/measure-economy-balance.mjs) consumes
those samples and calls the same runtime progression, production, price and
honours helpers used by the existing Moonstone/honours probes. VIP hours call
`TownVipArrivals`, production transport schedules and authored itineraries through
the valley harness it shares with `measure-vip-income.mjs`
([`vip-tour-harness.mjs`](../scripts/vip-tour-harness.mjs)), using each evolving town's actual
buildings. The standalone 96-hour VIP probe reproduced **2.5104 purchases/hour**:
**25.10 / 753.13 / 1,506.25 / 2,284.48 coins/hour** at chapters **1 / 30 / 60 / 91**.
At chapter 91 that is **17.36%** of full-town saloon income; see the per-version
[VIP table](vip-economy.md).

Town and mine progression are independent. Each run first clears levels 1–546,
then cycles the six measured final-chapter boards through **2,184 normal puzzles**.
This fixed diagnostic horizon is not a gameplay limit. It differs from the
[honours audit](honours.md#moon-and-continuous-play-audit--honours-generation-5-2026-10-24),
which replays the whole campaign; its later town dates cannot be compared directly.

- **A:** normal only; collect workshop stock every puzzle.
- **B:** A plus one 20-move continuous visit per newly unlocked level; collect every
  tenth normal puzzle. Catch up levels 1–2 when the museum opens.
- **C:** three such visits per level; collect every tenth normal puzzle; one
  uninterrupted active valley-town hour every ten normal puzzles, collecting saloon
  takings and actual VIP purchases; sell half of lifetime collected/gift moonstones,
  rounded down. Reserve the unsold half for monuments.

Visits in B/C are **546/1,638 total**, not fresh allowances on normal replays.
A/B specify no elapsed-town income. All patterns buy guided projects concurrently,
finish ready construction promptly, and buy the first design's optional coin
foundations after progression purchases, as in the honours probe. Moon sites share
one wallet, with lower-level sites considered first; upgrades wait for their actual
construction and unveiling. **Zero hammers.**

Reproduce from the repository root; all execution is in Node 24 Docker:

```sh
mkdir -p /tmp/ph-vip10/balance
ph_node() {
  ph_balance_name="$1"; shift
  docker run --rm --name "ph-vip10-$ph_balance_name" \
    --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$PWD":/app -v /tmp/ph-vip10/balance:/measure -w /app \
    node:24-bookworm-slim "$@"
}
ph_node install npm ci
ph_node meshes node scripts/split-mesh-catalogs.mjs
ph_node normal node scripts/measure-campaign.mjs . 3 546 \
  > /tmp/ph-vip10/balance/campaign.json
ph_node continuous env CONTINUOUS_VISIT_MOVES=20 \
  node scripts/measure-campaign.mjs . 3 546 \
  > /tmp/ph-vip10/balance/continuous.json
ph_node integrated node scripts/measure-economy-balance.mjs \
  /measure/campaign.json /measure/continuous.json \
  > /tmp/ph-vip10/balance/integrated.json
ph_node vip node scripts/measure-vip-income.mjs \
  > /tmp/ph-vip10/balance/vip.json
```

Raw v2 results, counterfactuals and `summary.txt` are retained under
`/tmp/ph-vip10/balance/`, with check logs in `/tmp/ph-vip10/`, as disposable review
evidence. Historical base-five results remain under `/tmp/moon-shots/balance/`.

### Income and progression

Income below is the mean of the three seeds' coins per **normal** puzzle; parentheses
are each source's share of the row total. Extra continuous moves and town hours
are additional effort, not included in that denominator. “Late campaign” is levels
403–546; “Twin construction” is the normal puzzles after that era opens through
required town completion. Rows may not sum exactly because of rounding.

| Window / pattern    |  Total |          Mining |        Saloon |         VIP | Moonstone sales | Continuous coins |
| ------------------- | -----: | --------------: | ------------: | ----------: | --------------: | ---------------: |
| Late campaign A     | 61,488 |   61,488 (100%) |             0 |           0 |               0 |                0 |
| Late campaign B     | 61,513 | 61,488 (99.96%) |             0 |           0 |               0 |       25 (0.04%) |
| Late campaign C     | 62,556 | 61,488 (98.29%) |   827 (1.32%) | 216 (0.35%) |               0 |       25 (0.04%) |
| Twin construction A | 74,448 |   74,448 (100%) |             0 |           0 |               0 |                0 |
| Twin construction B | 74,421 |   74,421 (100%) |             0 |           0 |               0 |                0 |
| Twin construction C | 77,042 | 75,268 (97.70%) | 1,332 (1.73%) | 229 (0.30%) |     214 (0.28%) |                0 |

Dates below are **normal puzzle counts: median [minimum–maximum]**. Values above
546 require replays. Monuments include their final construction/unveiling puzzle.

| Milestone                                         | A                   | B                   | C                   |
| ------------------------------------------------- | ------------------- | ------------------- | ------------------- |
| Twin Hollows opens                                | 645 [629–667]       | 644 [629–667]       | 637 [623–659]       |
| Required town complete                            | 668 [650–698]       | 668 [650–697]       | 660 [644–688]       |
| Both monuments complete                           | 1,022 [1,004–1,047] | 1,021 [1,011–1,051] | 1,421 [1,401–1,441] |
| Stones earned / sold at puzzle 546                | 0 / 0               | 0 / 0               | 0 / 0               |
| Stones earned at puzzle 2,184                     | 1,562 [1,538–1,579] | 1,558 [1,536–1,576] | 1,568 [1,542–1,583] |
| Stones sold at puzzle 2,184                       | 0                   | 0                   | 784 [771–791]       |
| Stones earned / sold when both monuments complete | 401 / 0             | 405 / 0             | 804 / 402           |

Primary B/C visits happen before the workshop opens, so they contribute **zero
workshop credits**, while still counting for honours and their lifetime coin
allowances. This is timing, not allowance consumption: gems observed without an
eligible workshop do not use its allowance. C's median workshop levels finish at
641/646/651; A's at 649/653/659.

Each level's first affordability/purchase under the shared-wallet strategy:

| Site / paid level (stone price) | A                   | B                   | C                   |
| ------------------------------- | ------------------- | ------------------- | ------------------- |
| Moonstone Garden 1 (20)         | 655 [637–680]       | 656 [639–680]       | 660 [640–682]       |
| Garden 2 (30)                   | 691 [673–716]       | 690 [680–720]       | 760 [740–780]       |
| Garden 3 (40)                   | 760 [745–785]       | 770 [750–790]       | 900 [880–920]       |
| Garden 4 (50)                   | 850 [835–875]       | 860 [840–880]       | 1,080 [1,060–1,100] |
| Garden 5 (60)                   | 961 [943–986]       | 960 [950–990]       | 1,300 [1,280–1,320] |
| Moonrock Court 1 (20)           | 664 [646–691]       | 665 [650–690]       | 700 [680–720]       |
| Court 2 (30)                    | 721 [703–746]       | 720 [710–750]       | 820 [800–840]       |
| Court 3 (40)                    | 802 [784–827]       | 810 [790–830]       | 980 [960–1,000]     |
| Court 4 (50)                    | 901 [883–926]       | 900 [890–930]       | 1,180 [1,160–1,200] |
| Court 5 (60)                    | 1,021 [1,003–1,046] | 1,020 [1,010–1,050] | 1,420 [1,400–1,440] |

### Honours

Each cell gives median normal puzzle counts for **bronze / silver / gold**.
A dash means unavailable in this pattern, not a completion restriction.

| Family                                          | A               | B               | C               |
| ----------------------------------------------- | --------------- | --------------- | --------------- |
| New Hollow Pioneer (1 / 15 / 30 levels)         | 646 / 653 / 663 | 645 / 653 / 663 | 639 / 645 / 655 |
| Lunar Keepsake Collector (10 / 60 / 180 stones) | 650 / 682 / 802 | 650 / 690 / 810 | 643 / 680 / 800 |
| Landmark Patron (1 / 5 / 9 sites)               | 26 / 331 / 655  | 25 / 331 / 650  | 25 / 324 / 650  |
| Endless Seam (2,500 / 25,000 / 100,000 gems)    | — / — / —       | 8 / 115 / 472   | 3 / 36 / 150    |
| Ruby gold (25,000 gems)                         | 514 [508–520]   | 286 [286–291]   | 142 [140–143]   |
| Fusion gold (300 fusions)                       | 565 [546–567]   | 304 [286–316]   | 133 [133–136]   |

Ruby gold takes approximately **12.1–12.5k legal moves** in A, **11.3–11.9k** in B
and **11.1–11.4k** in C, counting normal moves plus the scheduled continuous moves
through that puzzle (the last visit may finish the rank earlier). Earlier campaign
positions therefore do not make these golds trivial. Pioneer and Patron still
require late town access; Keepsake gold remains a repeated-collection goal even
when stones are sold or spent. No shipped honour requirement should be changed.

### Counterfactuals, flags and ranked proposals

- Removing **VIP only** from C delays Twin Hollows by **0–2 puzzles** and final town
  completion by **0–2**. Intermediate era dates move by at most two puzzles in
  either direction under the greedy shared-wallet purchase strategy.
- Removing **sales only** leaves every era opening unchanged and final completion
  unchanged in two seeds; it finishes one puzzle earlier in the third because
  construction/purchase ordering changes. Keeping those stones instead finishes
  both monuments **400 puzzles sooner in every seed**.
- Removing **both** delays final town completion by **1–2 puzzles**. Removing saloon
  income as well delays it **6–9 puzzles**. Most acceleration comes from the saloon.
  C's Twin-construction VIP income is **17.16% of saloon income**; it does not
  overtake it. B's extra continuous coins move Twin opening by only 0–1 puzzle
  versus A; continuous play adds no normal victories or construction steps.
- Omitting optional coin foundations from A advances Twin opening by **1–2 puzzles**
  and required completion by **2–3**. Optional sponsorship is not the main bottleneck
  in this late-chapter replay model.
- **Deferred continuous sensitivity:** postpone C's visits until workshop level 3,
  then visit one old level three times per normal puzzle, keeping the same lifetime
  visit count, collection cadence and half-sales rule. Both monuments finish at
  **941 [931–971]**, versus town completion **660 [642–688]**. Accepted continuous
  credits total **874 [865–877]**; earned/sold stones at 2,184 are
  **2,432 [2,400–2,456] / 1,216 [1,200–1,228]**. Even the deferred pattern's
  Twin-construction sales supply only **0.39%** of coins. There is no early-completion
  or coin-source inversion flag.

Historical v1 comparison (same board samples and patterns): C opened Twin Hollows
at **638 [623–659]** and completed town at **661 [644–688]**. Its VIP income was
**110 / 114 coins per normal puzzle** in the late-campaign / Twin-construction
windows. New v2 pays **216 / 229** in those windows and advances those town dates
by **0–1 additional puzzles per seed**; the windows and purchasing order also shift,
so aggregate rows need not exactly double. A/B and all primary monument completion
dates remain unchanged. This replaces the earlier recommendation to keep VIP base five.

Ranked recommendations after the approved v2 change:

1. **Keep the measured terms:** 300 gems/credit, 3 lifetime credits/level, 250 coins
   per stone, VIP base 10 for new receipts, monument prices 20/30/40/50/60. No balance
   break warrants reducing these rewards or raising the prices.
2. **Watch the optional endgame tail before tuning.** Monuments take another
   349–761 normal puzzles after required town completion in A/B/C. If player data
   finds that too long, trial **20/30/40/50/50** (380 stones for both), saving roughly
   20 normal puzzles without sales or 40 when selling half at full workshop rate.
   This would be a separate pacing decision, not an exploit fix.
3. **Keep shipped honour goals fixed.** If more continuous mastery pursuit is
   wanted, measure a future Endless Seam diamond at **250,000 gems** rather than
   moving the shipped 100,000-gem gold. This needs its own calibration and generation.

### Limits and validation

This is a deterministic hint-led model, not player telemetry. Three visits reuse
one seed's 20-move sample per level; VIP hours restart authored schedules and the
same seed, omit crowd/building collisions and interruptions, and do not simulate
transport continuity between sessions. A/B omit real elapsed-time saloon income;
C models only the specified town hours, with no mine-time or offline saloon accrual.
No chests, incidental rewards, quests/events, raid losses, tool use, hammers or
player purchase/collection mistakes are included. Replays reuse observed payouts
rather than freshly randomized boards. Hoarding and dumping all continuous visits
within a single normal-puzzle interval, very long visits, and visits repeated
indefinitely are not simulated. Their coin/workshop lifetime caps still apply;
honours intentionally keep counting. The model does not measure calendar pacing
or prove balance under those excluded reward systems.

Current v2 Docker validation: the standalone VIP probe reproduced 96 active-town
hours, and all **27 integrated trajectories** completed both monuments. The
**3,276 board samples were reused**, not rerun; A/B results were identical to v1.
Focused VIP/integrity/unlimited-move coverage passed **8 files / 138 tests**.
The full `npm test` passed **216 files / 4,158 tests** in one run, with no timeout
failures or serial reruns. Build and bundle budgets, `npm run lint`, changed-file
Prettier, `check:save-rules` and `check:integrity-fixtures` passed. PHP validation
passed `save-integrity.php` (**442 assertions**), `saves.php` (**282 assertions**),
`concurrency.php`, `honours.php` (**167 assertions**) and PHPStan; database checks
used a throwaway PostgreSQL on port 55487.

Historical base-five Docker validation: all 1,638 normal victories and 1,638
continuous samples passed; all 27 integrated trajectories completed both monuments. Focused economy,
honours, VIP and unlimited-move progression coverage passed **6 files / 140 tests**.
Production build (including bundle budgets), `npm run lint` and changed-file
Prettier checks passed. Initial `npm test` had **4,122 passes / 30 timeout failures**
across 13 files under concurrent load. Rerunning those files with
`npx vitest run --fileParallelism=false --maxWorkers=1` passed **13 files / 532 tests**,
without changing tests or timeouts. All **216 files / 4,152 tests** therefore passed
across the original run and serial rerun; the original full run was not entirely green.
