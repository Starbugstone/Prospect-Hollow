# Later-era regression and economy check — 14 September 2026

The existing **240 unique levels do not cover ordinary completion of every era** in the measured workflows. Money gains, mining depth multipliers, chest rewards, builder-hammer behavior, and the Frontier balance were not changed. Only the requested landmark prices and construction timing were changed.

## Landmark rule

The airport, business tower (`skyline`), and residential city towers (`cityHomes`) have a **25% premium** over comparable city buildings. Their initial construction takes **two completed normal puzzles**; subsequent upgrades, including later-era modernization, take **one**. Builder hammers retain their existing free, instant-build behavior.

New-building prices are **15,000 / 18,750 / 22,500 coins**, compared with **12,000 / 15,000 / 18,000** for an ordinary building from these eras. Later modernization uses the same 25% premium over that era's quoted modernization price. Already-paid one-run landmark projects preserve their duration, wins, and wallet on reload.

## Workflow measurement

The input is the previously measured 1,200 legal, hint-driven puzzle completions: all 240 levels over five refill seeds. Their mining payouts were reused because earnings are unchanged. Town progression then uses the actual campaign store for victories, chest settlement, chapter gifts, construction, hammers, raids, saving, and era transitions. Each successful puzzle advances every active construction project.

All strategies visit town after each puzzle, finish ready projects, and start all affordable suggested projects concurrently. Ordinary play uses automatically awarded chest contents and spends earned hammers on the suggested project. This is active building; purchasing only one improvement per visit would take longer. No passive saloon collections, purchased bonuses, or inventory powers are credited. Unused inventory fills normally, so the normal automatic-reward eligibility rules and chapter-gift overflow apply.

Optimized play successfully targets the roulette's hammer or coin reward, compares the coin prize with the most expensive eligible hammer purchase, and spends hammers on that purchase. The two-chest case assumes every puzzle earns both score and speed chests and the player successfully targets the desired roulette symbol. It is a favorable scenario, **not a guaranteed casual-player result or a proof of a mathematically optimal strategy**. The one-chest optimized case separates reward targeting from consistently earning both chests.

When 240 levels are insufficient, the measurement repeats normal level 240 at that seed's observed payout until the final era completes. Counts above 240 therefore mean **replays**, not additional unique content. These are conditional workflow samples, not measured human completion times.

Median cumulative puzzle completions, with the requested landmark rule:

| Era completed      | Ordinary, one chest | Targeted rewards, one chest | Targeted rewards, two chests |
| ------------------ | ------------------: | --------------------------: | ---------------------------: |
| River & Rail       |                  53 |                          44 |                           34 |
| Industrial / Steam |                  81 |                          67 |                           55 |
| Post-war           |                 116 |                          99 |                           81 |
| Motor Age          |                 158 |                         138 |                          114 |
| Aviation & Radio   |                 198 |                         174 |                          146 |
| Broadcast          |                 241 |                         216 |                          180 |
| Connected City     |             **294** |                     **262** |                      **219** |

Across the five seeds, final completion ranged from **291–313**, **261–272**, and **218–222** respectively. Ordinary play needs **51–73 replays**; targeted one-chest play still needs **21–32**. A separate stress case with mining payouts reduced by 25% only inside the simulation—not in the game—finished in **332–367** completions.

Before the landmark change, the corresponding final medians were 293, 262, and 219. The requested premium has a modest effect compared with the existing full-town modernization requirement.

## Where the slowdown comes from

| Era                | Required building/upgrade stages | Total quoted cost before hammers | Ordinary puzzles spent in era, five-seed range | Median mining payout during that era |
| ------------------ | -------------------------------: | -------------------------------: | ---------------------------------------------: | -----------------------------------: |
| River & Rail       |                               87 |                           98,600 |                                          23–24 |                                3,384 |
| Industrial / Steam |                              102 |                          188,700 |                                          26–29 |                                5,907 |
| Post-war           |                              114 |                          367,800 |                                          34–36 |                                8,264 |
| Motor Age          |                              129 |                          638,400 |                                          40–44 |                               12,144 |
| Aviation & Radio   |                              135 |                          823,650 |                                          39–40 |                               15,921 |
| Broadcast          |                              144 |                        1,096,500 |                                          38–45 |                               18,476 |
| Connected City     |                              159 |                        1,545,750 |                                          50–70 |                               22,280 |

Connected City funds roughly **2.8 construction/upgrade stages per puzzle**, counting coin purchases and hammer builds, compared with about 3.7 in River & Rail. These runs do not show prolonged periods with no affordable work or active construction. The larger issue is the cumulative volume of mandatory modernization and the final-era workload. Continuing to fund individual upgrades is feasible; completing the whole city within the unique campaign is not reliable outside the favorable two-chest strategy.

Keeping earnings unchanged, roughly **320 unique levels** would cover these ordinary active-building samples; that would not cover the lower-payout stress case, which reaches 367. No levels were added and no broader economy adjustment was made in this change.

## Regression verification

- `npm run verify`: **1,110 tests in 62 files**, formatting, and production build pass.
- New regression cases cover the landmark premium, two-run initial construction, one-run upgrades/modernization, legacy paid projects, and unchanged regular city offers.
- The production build was exercised in Chromium at `http://127.0.0.1:5175`, including Aviation → Broadcast → Connected City, save export/import, invalid-save rejection, reload, camera controls, and a 390 × 844 layout check. These checks recorded no application errors or HTTP failures.
- The airport purchase was checked through the actual plot directory: 15,000 coins deducted and a saved 0/2 construction receipt created. After a simulated victory receipt, reload preserved 1/2 progress; a second receipt enabled UI completion. Buying its next upgrade created a one-run receipt. A separate real keyboard swap in level 240 resolved successfully.

Detailed measurement scripts, input/output JSON, browser logs, and screenshots are retained in the ignored `output/regression/` directory. Software WebGL does not establish physical-device FPS or a guarantee of zero bugs.
