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
- **Moon locks and dials** fill their own side or corner cell. No gem enters or rests
  there: its column treats it as a wall and refills the cell beyond it. Only a bonus
  blast that covers one turns gravity over, at most once per move. A lock works once
  and opens into an ordinary cell; a dial stays for the whole level, with an arrow
  showing the current direction. Pearls follow gravity, floatstones go against it.
- **Lens mirrors** sit on edge voids. A row or column beam (cross, spore burst, the
  clear-row power) that reaches a lens at the end of its line turns: silver mirrors turn
  it square, gold prisms send it diagonally. Each lens turns a beam once.
  **Starglass** only breaks under a lens-turned beam.
- **Phase seals** change their gem after every move to the color shown in the corner.
  A change that lines up a match clears as a normal cascade, bonuses included. A match
  on the seal wears it down.
- **Portals** are pairs of identical pads that fill their own cells. A gem that falls
  on to the entrance pad at the foot of a siding shimmers out, shimmers back in on the
  exit pad on the top row and drops out of it. The column below an exit pad fills only
  through its portal. Moon gems are relics that ride portals from the sidings towards
  their baskets. Portals have `revision: 2` in `src/data/obstacles.js`, so players who
  met the earlier portal see its "New in this mine" guide again, marked Updated.
- **Breakthrough chambers** are sealed rows behind a cracked wall that only bonus blasts
  break. When the whole wall is down, the chamber opens and fills from above.
- **No ice on extraction levels.** A level whose goal is lighting lanterns or delivering
  cargo carries no ice.

Completed obstacles leave no icon. Lenses, portals and moon dials are fixtures the
player uses rather than completes; `testing/completed-board-markers.test.js` lists them.

## Mechanic videos at 30 fps

- [Moon dial: changing the drop direction](images/hollow-mines/moon-dial-30fps.mp4).
  Level 542 shows a bonus blast turning gravity upward, a floatstone sinking under
  inverted gravity, and a later blast turning gravity downward again. The dial's
  arrow follows the current direction. Unlike the single-use moon lock, the dial
  remains available and can flip again on a later move, at most once per move.
- [Floatstones: rising and collection](images/hollow-mines/floatstones-30fps.mp4).
  Level 409 shows a floatstone rising three cells after a legal match, then reaching
  its sky hatch after another match. Gems sink past the floatstone; the collected
  floatstone and completed hatch leave no marker.
- [Portals: beaming and delivery](images/hollow-mines/portals-30fps.mp4).
  Level 475 shows a moon gem falling on to the gold pad at the foot of the side track,
  shimmering out and dropping from the matching pad at the top of the board, with
  ordinary gems on the same route. The move is then replayed 4× slower, and the next
  move delivers the moon gem to its basket. Level 476 shows two pad pairs, gold and
  blue, each sending gems to its own exit.

Floatstones travel **against** gravity: clear directly above them under normal
gravity, or below them when gravity points up. They cannot be matched or destroyed.
Chains and root vines must be released before a held floatstone can move, and stone
or gates in its path must be opened. Swapping an earned bonus gem with a floatstone
fires the bonus in the floatstone's former cell, provided the floatstone can still
reach an exit from its new cell. None of this limits puzzle moves or play time.

These silent H.264 clips show the actual 1280 × 800 game renderer, sampled on an
exact 30 fps animation clock and played at normal speed unless a caption says
otherwise. Captions mark legal-play checkpoints where setup moves were omitted. All
demonstrated actions use the normal game store, with earned board bonuses and no
inventory powers. Their resulting gem types and tiles were checked against the legal
simulation checkpoints. The portal clip was recorded after the portal pads change of
2026-10-19, which moved the exit pads to the top row (see the targets note below).

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

The portal pads change (2026-10-19) moved every exit pad to the top row, so the 19 portal
levels (475–486, 499–504 and 506) were measured again. Their chest targets were reset to
80% of the new 30-seed median, which moved them by up to a fifth either way (level 500
went from 39,000 to 31,000, level 486 from 50,500 to 60,000). Star targets kept their
values, except level 504 (Pearl junction): its gates sit above the entrance pads and hold
back the exit columns, and three stars fell to 3 of 20 held-out runs, so its target went
from 79,200 to 71,000 (7 of 20). The other portal levels earn three stars in 5–16 of 20
held-out runs (7–15 before the change). Hint-led completion takes longer on some of them:
the median grew from 32 to 54 moves on level 486 and from 55 to 68 on level 480. Moves
stay unlimited.

The board motion check (`testing/browser/board-motion.cjs`, see the
[deep mine guide](deep-mine-levels.md#board-motion-check)) was run on levels 409, 423,
476, 487, 500, 507, 511, 517, 522, 529 and 541. Floatstones are drawn in front of the
gems sinking past them, and that crossing is exempt; refills entering at a twin-gravity
seam stay hidden until they reach their own half. Floatstone, low-gravity,
breakthrough, lock and dial levels report no overlaps or stutters.

After the portal pads change (2026-10-19), a gem beamed through a portal lands on the
entrance pad and starts a new fall out of the exit pad, and a landing bounce that falls
between two frames counts as the landing. Portal levels 475, 476, 500 and 506 report no
overlaps or stutters. Levels 480, 486 and 504 reported 14–38 frames of gems falling past
the chained moon gems and pearls on their sidings; the same build without the change
reported 15–36 frames there, so this is how chained cargo already looked. Levels 13,
373, 376, 385, 397, 409, 423, 487, 507 and 541 report nothing on either build.

Gravity keeps a chained gem in its cell and lets the gems above fall past it
(`applyColumnGravity` and `applyShapedGravity` in `TileManager.js`), so each gem that
refills the cells below crosses the chained gem's sprite for one or two frames at
60 fps. That crossing shows the rule, so the check now exempts a moving gem passing a
gem held on a chained cell; 480, 486 and 504 then report no overlaps or stutters. These
videos, recorded before the exemption, replay hint-led moves from checkpoints, first at normal speed and
then 8× slower (4× for the long cascade). They ring both gems whenever they are drawn
less than 0.6 cells apart (amber for the chained gem, red for the falling one), pause
half a second at each new overlap and name the gems and the gap:

- [Level 480](images/hollow-mines/chained-overlaps-480-30fps.mp4): gems and a free moon
  gem falling past the chained moon gems on row 3, then an emerald falling past a
  chained emerald into a basket (40 s).
- [Level 486](images/hollow-mines/chained-overlaps-486-30fps.mp4): free moon gems
  falling through the chained moon gems on row 2, then a long cascade (41 s).
- [Level 504](images/hollow-mines/chained-overlaps-504-30fps.mp4): refills falling past
  the chained pearls on row 2, one drawn almost exactly over its pearl (35 s).

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
