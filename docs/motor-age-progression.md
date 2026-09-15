# Motor Age and the casual progression review

> Historical review. The subsequent [horse field, park and economy update](leisure-and-economy.md) adds two plots and revises later prices and chest payouts.

Develop includes the merged Electric era from PR #29. No open PRs remained when the merge request was checked. This extension adds the fourth era while preserving the earlier progression and reward work. The current campaign has **four playable village eras, 37 plots and 144 mine levels**. Post-war and Contemporary remain unavailable.

## Building a town worth returning to

Motor Age follows every completed Electric upgrade, with the same saved transition and three-stage building pattern. Existing services, electricity, fire protection, rail and river transport, inventory, chapter records and funded construction carry forward. The four new buildings are:

| Building     | Stage 1 / 2 / 3 benefit                                              |
| ------------ | -------------------------------------------------------------------- |
| Garage       | Two / four / six extra slots for each puzzle bonus                   |
| Bus station  | Two / four / six visitor places, supported by food and water         |
| Garden court | Six / twelve / eighteen resident places, supported by food and water |
| Diner        | 5% / 10% / 15% more saloon income                                    |

The Steam well's second and third improvements each add 20 water places. Electric and Motor Age each add another 20 at their final well stage, preserving previous supply. The finished eras support water demands of 100, 116 and 140 people, respectively. The main farm's final improvement adds 20 food places. These support the fully expanded town. Old plots receive cream frontage, canopies, service wings and stepped architectural details; the new plots have three distinct visual stages in both WebGL and the SVG fallback. The garage and bus station open a moving village bus route. Neighbors, hens, dog, chats and smoke continue. Modernizing the station and harbor changes their vehicles, and the second Electric garage improvement replaces visiting horses with touring cars.

New buildings cost 5,400 / 7,500 / 9,900 coins and need one / two / two completed normal puzzles. Modernization costs 3,000 / 3,800 / 4,600 coins and needs two puzzles. Every plot needs all three stages to finish Motor Age: **111 improvements**. An earned hammer still completes a stage instantly and without spending coins.

On mobile, the next-step panel opens from the Progress button and starts hidden. It prioritizes shortages and useful new buildings before cosmetic work. It counts actual era stages, displays the correct preview, and shows the brigade for workshop protection. At a wide camera view, labels focus on the mine, next useful plot, new lots and construction; zooming in reveals more names. Rewards and ready-work icons remain visible, and players can tap the buildings or use the directory.

## A gentle mine extension

Levels 121–144 add four six-puzzle chapters: Open road seams, Garden paths, Chrome galleries and Sunrise valley. Each uses a distinct backdrop and rotates existing gem finishes and color palettes. Familiar chains, seals, stone and deliveries appear in different arrangements, with open lanes and a lighter fifth puzzle before each chapter finale. Moves stay unlimited, and a dead board still shuffles for free.

Every completed normal puzzle earns at least one chest, using an existing score or speed chest when qualified. The maximum remains two. Chapter gifts arrive directly every six first completions, with no additional chest-opening step. Gifts rotate TNT, Color Wand, Clear Row and Tile Breaker; full gift storage becomes chapter coins. The illustrated six-stamp trail shows the next reward in the village and results. Each chapter also adds a jewel around the mine entrance, now arranged to fit all 24 chapters.

The existing Electric finale (120) had an occasional long cleanup. Its delivery path now has fewer conflicting objectives while keeping three relics and chains.

## Measurements

The engine sample uses 30 deterministic refill seeds for **every level: 4,320 completed runs**, legal hint-led swaps, earned board bonuses, and free dead-board shuffles. It uses no inventory powers. These are simulations, not a claim that a person manually played every board.

| Chapter                      | Levels  | Median moves | 90th percentile | Longest sample |
| ---------------------------- | ------- | -----------: | --------------: | -------------: |
| 1                            | 1–6     |            9 |              12 |             17 |
| 2                            | 7–12    |           10 |              14 |             29 |
| 20, adjusted Electric finale | 115–120 |           20 |              30 |             52 |
| 21, Open road                | 121–126 |           19 |              34 |             65 |
| 22, Gardens                  | 127–132 |           20 |              32 |             56 |
| 23, Chrome                   | 133–138 |           20 |              33 |             67 |
| 24, Sunrise                  | 139–144 |           20 |              32 |             51 |

The new chain rule requires matching through the pinned gem, with gravity flowing past it. Levels 103, 111 and 128 were eased after this change; no run in the final 4,320 sample exceeded 70 moves. Later chapters vary around an approachable baseline instead of steadily increasing every puzzle. Regression tests exercise all 24 new levels and levels 111 and 120 across 30 seeds, with a 70-move ceiling, alongside the existing campaign checks.

A conservative town simulation buys suggested projects concurrently using only the sampled mine payouts. Across 30 paths, all four eras finish by normal puzzle completion **129–139 (median 134)**. The longest interval with neither a funded project nor a new purchase is two puzzles. This model excludes chest coins, hammers, gifts, passive income and bounties.

A separate sample with one automatically awarded chest per puzzle, hammer pity, immediate use of earned hammers and chapter gifts completed around level 120 (sample range 114–126). That sample stores its mine bonuses instead of spending them, so inventory eligibility affects its chest distribution. Players earning two chests or using passive income can finish earlier. Village construction is finite; these results do not establish real-player retention. Mine chapters, rewards, the museum, shop, saloon and forge remain available after construction ends.

Reproduce the mining-only sample with `node scripts/measure-campaign.mjs . 30 144`. This takes several minutes. The fixture command `npm run demo:eras` supplies an Electric town ready to advance, a pending Motor Age transition, a new Motor Age town and a completed Motor Age town. Fixtures belong in a disposable browser profile.

## Validation

The final automated suite passed 847 tests across 51 files. Coverage includes all building tiers and era gates, saved paid work, failed-save rollback, service continuity, chapter rewards and old-save continuation, bounded events, rendering extents, bus routes, camera framing and French content. Production compilation passed; the existing bundle-size advisory remains.

Chromium at `http://127.0.0.1:5173/` has verified the saved Electric-to-Motor transition across reload, the garage purchase and real puzzle-driven completion, the completed 37-plot town, the moving bus and its reduced-motion stop, and French layouts at 390×844 and 320×740. The desktop view is 1440×900. Levels 121 and 144 are checked with real pointer swipes; the complete campaign coverage above comes from the engine sample. Disposable fixtures supply the completed earlier eras and late mine records.

See [issue #30 fixes and visual evidence](issue-30-review.md) for the board sizing, direct-match chains, shorter Steam construction, full-era water supply, evolving transport, power network, mine entrances and forecourt. Final browser and automated checks are recorded there.
