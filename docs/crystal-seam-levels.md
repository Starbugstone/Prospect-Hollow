# Crystal seams: levels 547–606

Ten chapters below the floating seam, the 60 new boards of the release plan (owner,
10 November 2026). They finish act V (chapters 92–97) and open act VI (chapters 98–101),
so the color sets rotate at chapter 98 as they do every six chapters. Moves stay unlimited,
there is no puzzle timer, and a board with no legal match still reshuffles for free. The
text never names a town building: the mine is not gated by the town era.

The board grammar, rules and engine modules are those of
[the floating seam](hollow-mine-levels.md); the three crystal mechanics are described in
[the new mechanics record](new-mechanics.md).

| Chapter | Levels  | Name             | Mechanics                                                          | Median moves | Three stars (held out) |
| ------- | ------- | ---------------- | ------------------------------------------------------------------ | -----------: | ---------------------: |
| 92      | 547–552 | Echo gallery     | Lens mirrors, starglass, portals; Trace twins and Arrowhead taught |           20 |                    55% |
| 93      | 553–558 | Turning orchard  | Moon dials, floatstones, root knots; Crossgrain and Twin windows   |           21 |                    49% |
| 94      | 559–564 | The deep lantern | Route and breakthrough chambers, phase seals, lanterns; Chord      |           21 |                    50% |
| 95      | 565–570 | Shifting survey  | Survey markers, phase seals                                        |           22 |                    52% |
| 96      | 571–576 | Ember sidings    | Charge braziers, portals, moon gems                                |           26 |                    53% |
| 97      | 577–582 | Buried routes    | Dust and encased fossils, route chambers (act V finale)            |           24 |                    53% |
| 98      | 583–588 | Frost relays     | Frozen gems, spore relays, Crossgrain crystals                     |           22 |                    53% |
| 99      | 589–594 | Tidal pearls     | Pearls, ore orders, Chord crystals                                 |           23 |                    49% |
| 100     | 595–600 | Rooted vault     | Root knots, breakthrough chambers, chains                          |           25 |                    43% |
| 101     | 601–606 | The far seam     | Route chambers, Trace twins, moon dials (the pack's finale)        |           27 |                    51% |

Median moves are over 30 hint-led seeds per level (180 runs per chapter); three stars are
the share of 20 held-out runs per level (seeds 101–120) that earned them.

## Chapter rhythm

Every chapter keeps the rhythm of the campaign: introduce, practice, deliver, stretch,
rest, finale. Slot medians over the ten chapters are 20, 19, 24, 31, 12 and 41 moves, and each
chapter's finale is its longest board.

- **Each chapter opens on the board that proved its pairing** while it was on trial
  (547, 553, 559, 565, 571, 577, 583, 589, 595 and 601), with the same layout and level
  number, so it plays the board that was measured.
- **The three crystal mechanics are taught on their own** before any chapter pairs them:
  Trace twins at 548, Crossgrain at 554 and Chord at 560. The first board that shows an
  obstacle opens its guide ("New in this mine"), with its art and French text. They return
  in pairings at 551–552 (Trace twins between gates), 556 and 558 (Crossgrain in the
  orchard), 561–564 (Chord with lanterns), 583–588, 589–594 and 601–606.
- **The two new shapes** follow the lessons they were tried with: Arrowhead at 549 and
  Twin windows at 555. Both are clearing boards; their tips explain the shape.

### Changes from the boards on trial

- **548** gained two gates, one above the upper stamp and one at the foot of the lower
  stamp's column, and ice. On the trial board the hint-led player fired the lower stamp with
  a column whose copy landed on plain gems (0 of 60 runs hit a gate, median 2 moves).
  Now every line through either stamp copies on to a gate, as on 601: the copy breaks a gate
  in the median run, and the board takes 16 moves.
- **560** gained a tenth row, to match its chapter, and ice.

## Calibration

Measured with `node scripts/measure-campaign.mjs . 30 606 547,…,606` in Docker, which plays
the same seeds as `testing/helpers/campaignSimulation.js`. Raw results are local, under
`output/next-release/` (git-ignored).

- **Chest targets** are 80% of each level's median score over seeds 1–30, to the nearest
  500, as for the floating seam. `testing/levels/crystal-seam-calibration.test.js` replays
  the 30 seeds and holds every target to this.
- **Star targets** came from `node scripts/calibrate-star-targets.mjs <file> 547 606`.
- **Held-out seeds 101–120:** all 1,200 runs finish. Three stars came in 611 of them (51%),
  within the late-campaign band. Four levels left fewer than a third of their runs with
  three stars. 560 (a lesson), 593 (a rest board) and 597 (bonus-only, on the 5-of-20 test
  floor) were lowered from 6, 5 and 5 runs to 8 (targets 23,600, 20,200 and 36,400). 570,
  the survey finale, keeps 6 of 20 (30%) as the act's three-star challenge, which the plan
  allows for about a quarter of levels.
- **Moves:** median 23, 90th percentile 48, maximum 118; 3 of 1,800 calibration runs went
  beyond 100 moves (two on 606, the pack's finale, and one on 604). Free reshuffles: 46
  in 1,800 runs, most of them on Ember sidings (22) and Frost relays (12).

Boards that failed on the first drafts were changed rather than accepted:

- **550 and 552** used thick starglass in a drop column reached only by one row of beams.
  Moon gems stacked above the panes, the board went dead, and 552 hit the simulator's
  diagnostic reshuffle limit on one seed. Single panes, with a relay and a core on the beam
  row of 552, finish all 30 seeds with no reshuffle.
- **576** put its chained moon gems out of every brazier's reach (90th percentile 101
  moves). A brazier beside each chain, single upper gates and thick lower ones bring it to
  41 moves (90th percentile 74).
- **580** first had three encased fossils and ran longer than the act V finale; it keeps
  the two in the sealed bed.

## What else changed with the append

- A player who finished level 546 is offered level 547, not the museum
  (`testing/hollow-mine-levels.test.js`). A perfect 546-level campaign is no longer
  complete: the museum counts 546 of 606 at three stars, and the 100% celebration waits
  for level 606. A celebration that was still pending on a 546-level save is dropped,
  since its text ("Three stars on every level!") is no longer true.
- The mine cart outside the town filled over `LEVEL_COUNT`, so every player's cart would
  have lost gems. It now fills over a fixed 546 levels (`CART_FULL_LEVELS` in
  `src/data/mineGrowth.js`), and a test keeps a filled cart full as the campaign grows.
- Honours are unchanged. The three crystal elements stay in `NON_MASTERY_ELEMENTS`; only
  the level element index (`src/data/honourLevels.json`) was regenerated. Seam Explorer
  still lists levels 1–546 by name, and new levels earn it nothing.
- The server catalogs (`backend/content/save-rules.json`, its history and the public
  schema) were regenerated. Three new integrity fixtures replay in `save-integrity.php`: a
  first victory and coin chest on 547 after a finished campaign, a victory and coin chest
  on 606 (33,492 coins in all) and a VIP purchase at chapter 101 (1,010 coins, against 910
  at chapter 91).
- **Moonstones.** Each level allows three continuous-play workshop credits, so the 60
  levels add up to 180 continuous credits and 60 normal ones: up to 240 more workshop
  credits for a player who replays every level three times (a level-3 workshop turns three
  credits into three moonstones). That is about 11% more than levels 1–546 allow.

## Boards on trial

The fifteen boards on trial are now these levels. `src/data/prototypeBoards.js` keeps them
listed under Boards on trial in Settings, but each entry plays its campaign level's own
configuration, so a trial cannot drift from its level. They stay listed because the phone
checks in the release plan are still open, and the debug tools let a tester open level 583
without reaching it. Remove an entry once its board has been played on a phone.

## Checks

- `testing/hollow-mine-levels.test.js`: the append (chapter ids, names and stops, 606
  levels), the act VI color rotation at chapter 98, each crystal mechanic taught with its
  guide at 548, 554 and 560, no town names in the text, every turned beam clear of the
  portal pads (547, 550 and 552), the route chamber levels, completion of every level on
  seeds 101–103, store completion beyond 100 moves after the speed target on 548, 554, 560,
  577 and 601, and the player who finished 546.
- `testing/levels/crystal-seam-calibration.test.js` and the shared level simulations
  (`npm run test:levels`), including three-star attainment on seeds 101–120.
- The board motion check (`testing/browser/board-motion.cjs`, see the
  [deep mine guide](deep-mine-levels.md#board-motion-check)) over eight hinted moves on the
  two new shapes, 549 (Arrowhead, 442 frames) and 555 (Twin windows, 612 frames), and on the
  new geometries of 552 (two lens rows beside portal sidings, 483), 579 (side chambers
  around a void-roofed fossil, 680), 603 (two shafts and a dial, 629) and 606 (578): no
  overlapping frames and no stutters.
- Phone-size screenshots (375 × 740) of one board per chapter, at the start and after four
  hinted moves, were checked by eye. None of these boards has been played on a phone yet.
