# Release A: town projects and a complete late-game puzzle journey

This release adds optional construction guidance and 84 authored puzzles, bringing
Prospect Hollow to 54 chapters / 324 unique levels. Future cinematic side quests,
horse events, dog/park events and event deadlines remain in
[issue #42](https://github.com/Starbugstone/Prospect-Hollow/issues/42), outside this release.

## Town projects

Town projects become available after the first Frontier home is finished, without
interrupting the tested opening. The first two projects group well/farm/home and
stables/shop/school. Subsequent eras each offer three themed projects, including
river trade, the industrial quarter, airport opening and the connected river district.

A project has three milestones: all its featured buildings at stage one, two and
three in the current era. Existing work counts immediately. Construction progress,
ready-to-finish work, prices and requirements are visible; selecting a building
opens the existing building dialog. Focus persists through reload and save export/import.
A choice never limits construction elsewhere, creates an extra purchase or reward,
or changes the era gate. Completed building visuals are the current payoff; future
high-quality cinematic side quests are separate work.

Both fullscreen and embedded town views expose the project panel. It is translated
into French and usable at desktop and narrow mobile sizes.

## New chapter mechanics

Three reusable mechanics combine with existing stone, chains, seals, ice and relic
routes. None anchors a gem, blocks gravity or introduces a move/time budget.

- **Ore orders:** collect the pictured gem colors. Ordinary matches, cascades,
  bonuses and inventory powers contribute. The required colors belong to that
  level's replenishing palette. Each order has a capped counter and must be filled
  before normal completion. Fusion ore uses a separate objective receipt so the
  existing mining payout ledger stays unchanged.
- **Lanterns:** light a floor marker by matching on it or an orthogonally adjacent
  cell. Blasts and powers work too. The marker remains in place while gems fall
  freely; a lit marker is visually subdued.
- **Survey trail:** light numbered floor markers in sequence using the same
  match/adjacency rule. Only the next marker responds to an individual resolution
  step; a later cascade or move can activate the following marker. A single blast
  does not skip the trail. Completed markers display a check.

The design adapts recognizable interactions from official references rather than
copying their art or layouts: [Candy Crush color orders](https://candycrush.zendesk.com/hc/en-us/articles/115004468849-Game-Modes-Collect-the-orders),
[Royal Match light bulbs](https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/378-light-bulb/)
and [Gardenscapes fireflies](https://playrix.helpshift.com/hc/en/5-gardenscapes/faq/964-fireflies/).
Prospect Hollow's implementations use its existing board-resolution and bonus rules.

Each six-level chapter has an approach, junction, delivery, linked-chamber challenge,
quieter passage and finale. Chapters declare their mechanics in one plan; new plans
reuse the generation contract rather than requiring extra chapter-index branches.
Delivery lanes use interior columns. The lowest two rows stay clear of ice, and
ice never exceeds two layers, avoiding isolated last-row cleanup.

| Levels  | Chapter             | Main mechanic / combination                       |
| ------- | ------------------- | ------------------------------------------------- |
| 241–246 | Freight crossings   | Ore orders and freight routes                     |
| 247–252 | Foundry arches      | Lanterns around stone arches                      |
| 253–258 | Reservoir links     | Two-color ore orders and channels                 |
| 259–264 | Courtyard passages  | Ordered survey trail                              |
| 265–270 | Switchyard seams    | Lanterns, with ore orders in alternate challenges |
| 271–276 | Terminal galleries  | Two-color ore orders and deliveries               |
| 277–282 | Airfield vaults     | Survey trail beside delivery lanes                |
| 283–288 | Radio relays        | Lanterns and colored seals                        |
| 289–294 | Studio crossroads   | Survey trail plus selected ore orders             |
| 295–300 | Skyline foundations | Lanterns around foundation shelves                |
| 301–306 | Promenade routes    | Survey trail and river deliveries                 |
| 307–312 | Network vaults      | Lanterns plus selected ore orders                 |
| 313–318 | Heritage loop       | Alternating lantern and survey puzzles            |
| 319–324 | Hollow homecoming   | Survey finale plus selected ore orders            |

Normal puzzles have unlimited moves and remain completable after the optional
speed threshold. There are no lives, purchased extra moves, compulsory inventory
powers or hard puzzle timers. Free dead-board reshuffling remains available.

## Playability and regressions

All original 240 generated gameplay configurations retain their layouts, seeds,
objectives, tips and reward targets. A committed digest regression excludes only
ephemeral gem IDs and the newly empty ore-order list. The baseline digest is
`cfc3e3c569d690d39e43c394aec83dce9423d0569c54255dfc6978cd8be4521f`.

| New-level sample | Completed | Median moves | P90 moves | Maximum | Free shuffles |
| ---------------- | --------- | ------------ | --------- | ------- | ------------- |
| 84 × 5 seeds     | 420/420   | 20           | 33        | 65      | 0             |
| 84 × 10 seeds    | 840/840   | 20           | 35        | 84      | 1             |

These are legal hint-driven games using earned board bonuses and no inventory
powers, not human playtime measurements or an exhaustive solvability proof. The
84-move outlier was a final relic awaiting a drop; there were no deadlocks. Test
iteration budgets are diagnostics, never player move limits. Original early-game
pacing guards remain unchanged; new chapters also have aggregate median/P90 guards.

New regressions cover concurrent survey hits, chain/ice interaction, all four
inventory-power paths, fusion ore without changed money receipts, replay reset,
project persistence/import and paid construction versus free hammers. A live
store test completes at move 10,001 after an expired speed threshold and grants
completion only once.

## Economy: actual 324-level campaign

The analysis feeds actual measured mining payouts through the campaign store,
including construction, ordinary chest rewards, chapter gifts, inventory capacity,
hammers, raids and era advancement. It visits the town after every puzzle, finishes
ready projects and starts all affordable suggested work in parallel. No passive
saloon income, shop purchases or spent inventory powers are credited.

Five deterministic seeds per strategy:

| Strategy                                 | Final era completion median | Range   | Unique content remaining |
| ---------------------------------------- | --------------------------- | ------- | ------------------------ |
| Ordinary, one chest                      | 293                         | 290–297 | 27–34 levels             |
| Targeted hammer/coin, one chest          | 263                         | 261–268 | 56–63 levels             |
| Targeted hammer/coin, two chests         | 219                         | 218–222 | 102–106 levels           |
| Ordinary with 75% measured mining payout | 329                         | 328–333 | Needs 4–9 replays        |

The targeted strategies assume successful roulette selection and spend hammers on
eligible expensive stages. The two-chest case additionally assumes both optional
score and speed chests are earned every puzzle; it is a favourable scenario, not
a casual-play guarantee or proof of mathematical optimality. The lower-payout
factor is applied only in the simulation. Past level 324, stress runs repeat that
level at its measured payout, not imaginary extra content.

| Era complete (cumulative puzzles) | Ordinary | Targeted 1 chest | Targeted 2 chests | 75% stress |
| --------------------------------- | -------- | ---------------- | ----------------- | ---------- |
| River & Rail                      | 53       | 44               | 34                | 60         |
| Industrial / Steam                | 81       | 67               | 55                | 92         |
| Post-war                          | 116      | 99               | 81                | 130        |
| Motor Age                         | 158      | 138              | 114               | 178        |
| Aviation                          | 198      | 174              | 146               | 222        |
| Broadcast                         | 241      | 216              | 180               | 271        |
| Connected City                    | 293      | 263              | 219               | 329        |

Every simulation completes all 943 construction stages. Ordinary Connected City
lasts 50–54 puzzles (median 52), with approximately 3.06 construction stages funded
per puzzle and median mining payout 22,905 coins. No simulated visit had neither
construction activity nor an active project. Players choosing one project per
visit, collecting fewer bonuses or playing different puzzle paths can take longer.

Money, bonus and hammer formulas are unchanged. The new chapters naturally use
the existing depth multiplier, so this analysis includes their actual income rather
than extending the former level-240 payout assumption. Airport and city-tower initial construction
still takes two completed puzzles and upgrades one; their agreed premium remains.
Other existing construction durations, including leisure building stages, are unchanged.

To reproduce a strategy from fresh full-campaign measurements:

```sh
node scripts/measure-campaign.mjs . 5 324 > /tmp/prospect-measurements.json
node scripts/measure-town-progression.mjs /tmp/prospect-measurements.json ordinary 1
node scripts/measure-town-progression.mjs /tmp/prospect-measurements.json optimized-one-chest 1
node scripts/measure-town-progression.mjs /tmp/prospect-measurements.json optimized-two-chests 1
node scripts/measure-town-progression.mjs /tmp/prospect-measurements.json lower-payout 1
```

Repeat the latter commands with seeds 2–5. The tracked reproduction script matches
the ordinary seed-one analysis: completion at puzzle 290, identical era milestones
and ending savings.

## Browser evidence

Production preview at `http://127.0.0.1:5175` was inspected in Chromium at
1440×900 and 390×844, using the frontend/browser skills. A fresh Frontier flow
kept projects hidden until a home existed; project selection, existing progress,
fullscreen access and focus persistence were exercised with actual UI clicks.
Narrow project panels and English/French mine interfaces showed no horizontal
overflow. The first-home construction check used a small coin fixture after the
free well; it was a UI check, separate from the measured economy runs.

A completed-240 save unlocked level 241. The first move used the actual keyboard
board controls; subsequent legal hints went through the live store and renderer.
Levels 241 (ore), 247 (lanterns) and 259 (survey) completed normally in 16, 16 and
20 moves respectively, with all goals cleared. No objectives were edited to force
these victories. French project and survey text was visually checked.

An Aviation fixture exercised the airport project panel, actual 15,000-coin
purchase, persisted 0/2 and 1/2 construction, ready-to-finish action and subsequent
one-puzzle upgrade. Those construction receipts were simulated through the
campaign action; building purchase and completion were actual browser clicks.

No application console errors or failed HTTP resources were observed. Software
WebGL emitted driver readback warnings while taking screenshots, so this browser
run is not a claim about hardware-device frame rates. Screenshots and detailed
logs are in ignored `output/playwright/`; measurement artifacts are in
`output/review/`.

Final integration verification passed **1,236 tests in 65 files**, formatting and
production build. The 13 rendering/era-extension tests were also rerun after the
last shared-profile consumer edits. Rebuilt Industrial, Aviation and Connected
City views, their completed project panels and level 260 were checked in the
production browser with zero application errors or failed HTTP responses. French
mobile controls were adjusted to keep the project and progress buttons separate.
The shared-era refactor additionally preserved all 32 before/after town snapshots;
see [the architecture guide](era-architecture.md).
