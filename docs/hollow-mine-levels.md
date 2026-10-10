# The floating seam: levels 403–546

Twenty-four chapters below the reservoir, grouped in four acts by depth. The plan,
decisions and checklist live in [the expansion plan](mine-expansion-plan.md); this
guide describes what shipped. Moves stay unlimited, there is no puzzle timer, and a
board with no legal match still reshuffles for free.

| Act                   | Levels  | Chapters                                                                                                                       | New element                                     |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| I · The floating seam | 403–438 | Riverglass seams, Floatstone shafts, Glowing fossils, Rising and falling, Rigging vault, Brazier chimney                       | Floatstones, peridot                            |
| II · Star chambers    | 439–474 | Starlit survey, Lens gallery, Spore observatory, Phase vault, Comet frost, Lens vault (7 × 10)                                 | Lens mirrors, starglass, phase seals, starmetal |
| III · Ribbon works    | 475–510 | Portal sidings, Moon-gem freight, Breakthrough (7 × 10), Elevator foundations (7 × 10), Portal pearls, Ribbon foundry (7 × 11) | Portals, breakthrough chambers                  |
| IV · The hollow below | 511–546 | Upside hollow, Twin gravity, Moondust beds, The moon lock, Willowkin float grove, Starfall cavern                              | Low gravity, moon locks, moon dials             |

The text never assumes a town building exists: the mine is not gated by the town era,
so the floating, moon-like caverns are explained by the exotic crystal itself. The
Willowkin plant the first tree of the floating island in chapter 23.

## Rules the player can see

- **Floatstones** are relics that rise. Clearing the gems directly above one lets it
  float up into the gap while other gems sink past it. They are collected by sky
  hatches on the top row. Under inverted gravity they sink instead.
- **Low gravity.** An inverted cavern falls up and refills from the floor. A twin-gravity
  cavern falls up above its seam and down below it, refilling from the seam.
- **Moon locks and dials** are floor markers on side or corner cells. Only a bonus blast
  that covers one turns gravity over, at most once per move. A lock works once and
  leaves the board; a dial stays (with an arrow showing the direction) until the last
  cargo is delivered. Pearls follow gravity, floatstones go against it.
- **Lens mirrors** sit on edge voids. A row or column beam (cross, spore burst, the
  clear-row power) that reaches a lens at the end of its line turns: silver mirrors turn
  it square, gold prisms send it diagonally. Each lens turns a beam once.
  **Starglass** only breaks under a lens-turned beam.
- **Phase seals** change their gem after every move to the color shown in the corner.
  A change that lines up a match clears as a normal cascade, bonuses included. A match
  on the seal wears it down.
- **Portals** hand a gem falling out of the entrance to the paired exit. Moon gems are
  relics that ride them from the side sidings into the middle of the board.
- **Breakthrough chambers** are sealed rows behind a cracked wall that only bonus blasts
  break. When the whole wall is down, the chamber opens and fills from above.
- **No ice on extraction levels.** A level whose goal is lighting lanterns or delivering
  cargo carries no ice.

Completed obstacles leave no icon. Lenses, portals and moon dials are fixtures the
player uses rather than completes; `testing/completed-board-markers.test.js` lists them.

## Gems

Peridot (lime, teardrop) and starmetal (steel blue, nugget with a gold star) join the
gem list. Boards still hold five colors: each act rotates its own color sets, keeping
ruby, sapphire and emerald for seals and orders (`COLOR_SETS` in
`src/data/hollowMineLevels.js`). Levels 1–402 keep their original color sets, and a
level without a set still refills from the original six (`BASE_GEM_TYPES`).

## Shared implementation

`src/data/hollowMineLevels.js` owns the layouts, names, tips, color sets and reward
targets. It extends the deep-mine board grammar (`parseMineBoard`) with pieces lifted
out before parsing (floatstones, chained relics, lenses, portals) and new cell symbols
documented at the top of the file. The engine additions are small modules shared by the
game, hints and the simulator:

| Module                    | Responsibility                                                  |
| ------------------------- | --------------------------------------------------------------- |
| `engine/GravityFrames.js` | Gravity frames, floatstones, cargo routes, switches, `flipGain` |
| `engine/LensBeams.js`     | Lens turns, starglass ledger (`blastLog`), lens geometry        |
| `engine/PhaseSeals.js`    | Phase shifts after a move settles                               |
| `engine/Breakthroughs.js` | Opening sealed chambers                                         |
| `engine/BoardTopology.js` | Portal routes, loop-safe gravity paths                          |

Framed gravity runs the existing column and shaped routines on a mirrored view of each
frame, so every piece still gets one movement receipt with its route. Boards without
these features keep the original gravity code; levels 1–402 hash identically
(`testing/hollow-mine-levels.test.js`).

## Verification

`testing/hollow-mine-levels.test.js` checks the append, names, star targets, no ice on
extraction levels, that every cargo piece can reach an exit (after chambers open, and
in the right gravity for switch levels), that every starglass is reachable through the
lenses, completion of every level on three held-out seeds, and store-level completion
beyond 100 moves after the speed target. Engine tests:
`gravity-frames`, `lens-beams`, `phase-seals` and `portals-breakthrough`.

Targets come from 30 hint-led seeds per level: chest targets at 80% of the median score
and star targets from `scripts/calibrate-star-targets.mjs`. Star targets that left fewer
than about a third of held-out runs (seeds 101–120) with three stars were lowered.

The board motion check (`testing/browser/board-motion.cjs`, see the
[deep mine guide](deep-mine-levels.md#board-motion-check)) was run on levels 409, 423,
476, 487, 500, 507, 511, 517, 522, 529 and 541. Floatstones are drawn in front of the
gems sinking past them, and that crossing is exempt; refills entering at a twin-gravity
seam stay hidden until they reach their own half; a portal jump is hidden inside one
continuous fall. Floatstone, low-gravity, breakthrough, lock and dial levels report no
overlaps or stutters. Portal merges (476, 500) report three to four frames of near
contact (0.18–0.28 cells) and at most one stutter, the same size as the unchanged level
373 on `preprod`.

## Effort and completion (2026-10-08)

The new levels were tuned to sit level with the deep mine or a little above, measured with
the hint-led player (an average player who always takes the hint). Per-slot targets were 20,
27, 30, 37, 18 and 50 moves (opening, practice, explore, stretch, rest, finale). A tuning
pass added ice to levels where ice is allowed and ore orders (ruby, sapphire or emerald, which
every color set holds) to lantern and cargo levels, which stay ice-free; boards that could
hold no more ice got orders on top. Levels 450 and 452 also gained a gentler starglass mix and
a floor charge core, so a missing diagonal beam no longer drags a run out.

| Levels (100 hint-led seeds each, 201–300) | Median moves | 90th percentile |
| ----------------------------------------- | -----------: | --------------: |
| 241–324 (late campaign, 20 seeds)         |           21 |              33 |
| 373–402 (deep mine, 20 seeds)             |           27 |              58 |
| 403–546                                   |           28 |              54 |

All 14,400 runs finished. Slot medians were 18.5, 27, 29, 36, 18 and 51. A careless player
that picks a random legal move without hints (10 seeds per level) also finished every level,
so no layout can be soft-locked. `testing/levels/hollow-store-completion.test.js` plays every
new level through the real game store beyond 100 moves and after the speed target. Chest and
star targets were recalibrated after tuning.

## Six-color boards

Two ice-free levels use six colors instead of large ore orders: 411 (Floatstone shafts:
Stone ceiling) and 429 (Rigging vault: Behind the rigging, now with banded stone). A level's
`extraColor` adds one gem to its seam's set (amethyst here, since starmetal only appears
from 439). With 100 hint-led seeds, 411 takes a median of 29 moves (it was 31 with orders)
and 429 a median of 25 (29.5); both finished every run. Six colors roughly double the effort
of a board, so they suit only levels that would otherwise need heavy collection goals.
