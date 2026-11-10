# The floating seam: levels 403–546

Twenty-four chapters below the reservoir, grouped in four acts by depth. The plan,
decisions and checklist live in [the expansion plan](history/mine-expansion-plan.md); this
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
  hatches on the top row. Under inverted gravity they sink instead. So that a moving
  floatstone stands out from the falling gems, its route lights up with arrows as the
  match clears, and it lifts off with a ring and a puff of sparks from its base. It
  glides instead of bouncing, drifting a little past its cell and bobbing back.
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
- **Route chambers** (`route: true` in a level's `chambers`) are ways into the same place,
  of which the player needs only one. Their cracked walls count toward no goal, are left
  out of the goal counters, and may stay standing when the level ends. A route chamber
  may hold nothing the goal counts; the generator rejects one that does. Once one route is
  open, the hint stops aiming at the other walls.
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
  its sky hatch after another match, each move replayed 4× slower. Its lit route,
  lift-off ring and buoyant glide set it apart from the gems sinking past it; the
  collected floatstone and completed hatch leave no marker.
- [Floatstones: sinking under upturned gravity](images/hollow-mines/floatstone-sinking-30fps.mp4).
  Level 542, after the moon dial has turned gravity upward: the floatstone's route
  lights up downwards and it lifts off towards the bottom row, the sparks blowing up
  behind it, then sinks eight cells into the basket.
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

After the floatstone effect (2026-10-20: a lit route, a lift-off ring and a buoyant
glide), levels 13, 373, 376, 385, 397, 409, 423, 541 and 542 report no overlaps or
stutters over five hinted moves. 423, 541 and 542 also report none over 25, and so does
409 over the 16 moves it takes to deliver its floatstone and clear the level.

After the portal pads change (2026-10-19), a gem beamed through a portal lands on the
entrance pad and starts a new fall out of the exit pad, and a landing bounce that falls
between two frames counts as the landing. Portal levels 475, 476, 500 and 506 report no
overlaps or stutters. Levels 480, 486 and 504 reported 14–38 frames of gems falling past
the chained moon gems and pearls on their sidings; the same build without the change
reported 15–36 frames there, so this is how chained cargo already looked. Levels 13,
373, 376, 385, 397, 409, 423, 487, 507 and 541 report nothing on either build.

Gravity keeps a chained gem in its cell and lets the gems above fall past it
(`applyColumnGravity` and `applyShapedGravity` in `TileManager.js`), so each gem that
refills the cells below crosses the chained gem's sprite for one or two frames at 60
fps. That crossing shows the rule, so the check now exempts a moving gem passing a gem
held on a chained cell; 480, 486 and 504 then report no overlaps or stutters. These
videos, recorded before the exemption, replay hint-led moves from checkpoints, first at
normal speed and then 8× slower (4× for the long cascade). They ring both gems whenever
they are drawn less than 0.6 cells apart (amber for the chained gem, red for the falling
one), pause half a second at each new overlap and name the gems and the gap:

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

## Boards on trial

A new board can be played before it joins the campaign. `src/data/prototypeBoards.js` lists
them in the level grammar of this file. They sit outside `LEVEL_COUNT` and the save. Only
the debug tools (development, preprod and `VITE_DEBUG_TOOLS=true` builds) open one: tap it
under **Boards on trial** in Settings (More options) from the village, which works on a
phone, or call `prospectDebug.playPrototype('<key>')` in the console. The public game has
neither. A banner marks the run, powers are
hidden, and finishing records nothing: no reward, record, honour or obstacle seen. A board
keeps the level number it would take (its id also seeds its layout), so appending it there
gives the same board.

The first is chapter 94's route-choice board, `deep-lantern-routes` ("The deep lantern:
Two ways down", level 559's slot). Two lanterns and two phase seals sit in a 2 × 2 well
that no swap can reach. A thick cracked block above it opens a drop shaft, where the
well lights through vertical matches. A thin wall to its right opens a side chamber,
where it lights through horizontal matches. `testing/route-chambers.test.js` covers the
rules and the store, and `testing/levels/prototype-routes.test.js` measures 60 hint-led
seeds per variant (`npm run test:levels`).

| 60 seeds (hint-led)              | Median moves | Max | Well cells lit by                     |
| -------------------------------- | -----------: | --: | ------------------------------------- |
| Both routes                      |           23 |  61 | 52 horizontal, 35 vertical, 212 blast |
| Drop shaft only                  |           24 |  69 | 66 vertical, 230 blast                |
| Side chamber only                |           25 | 111 | 96 horizontal, 199 blast              |
| Neither route (bonuses only)     |           32 | 148 | 291 blast                             |
| Drop shaft open from the start   |           10 |  29 | 218 vertical, 81 blast                |
| Side chamber open from the start |           12 |  70 | 62 horizontal, 178 blast              |

With both routes available, the shaft opened first in 33 runs and the side chamber in 23
(median move 20 and 12), and every run finished. The "lit by" columns count each hit
that lit a lantern or wore down a seal in the well.

### Pairing prototypes: chapters 92 and 93

Two more boards try the mechanic pairings proposed for the next chapters. Both use only
shipped mechanics and art, and borrow a shipped chapter's backdrop and cargo until theirs
exist.

**`echo-gallery-crossing`** ("Echo gallery: Crossed paths", level 547's slot) pairs lens
mirrors and starglass with portals, which had never shared a board. Two moon gems ride the
siding through the portal and drop down the middle column, where two panes of starglass
stand between the exit pad and the basket. The beams come from the other side: the column
relay on the right wall bursts on to both corner mirrors, and each diagonal crosses a pane.
The thick pane needs a second turned beam, and a floor core gives crosses in line with the
lower mirror.

How beams and portals meet was the open question for this pairing. A portal pad fills its
cell like a void, so a beam passes over a pad and does not come out of its pair. A player
could reasonably expect either, so this board keeps every beam's path clear of both pads
and the question never arises. `testing/prototype-boards.test.js` holds it to that. A
later board that wants a beam to cross a pad needs that rule decided, shown and explained
first.

**`turning-orchard-both-ways`** ("Turning orchard: Up and down", level 553's slot) pairs
the moon dial with floatstones held by root knots. Each floatstone has one way out, and
they are opposite: a sky hatch above the left one and a basket below the right one. A
floatstone moves against gravity, so one leaves as the cavern stands and the other only
after a bonus blast turns the dial. The knots sit beside the floatstones, clear of both
ways out.

`testing/prototype-boards.test.js` runs the shipped layout rules on every board on trial
(no ice on extraction boards, a route for all cargo, reachable starglass), checks that
each one finishes in the game store beyond 100 moves after its speed target and saves
nothing, and that the renderer draws it with its own chapter's art. A board on trial is
numbered past the campaign, so the renderer takes the theme from the level itself.
`testing/levels/prototype-pairings.test.js` measures 60 hint-led seeds
(`npm run test:levels`):

| 60 seeds (hint-led)          | Moves: 10th / median / 90th / max | Median score | What happened first                                                 |
| ---------------------------- | --------------------------------- | -----------: | ------------------------------------------------------------------- |
| Echo gallery: Crossed paths  | 9 / 16 / 25 / 56                  |       31,100 | Both panes gone by move 4, moon gems home by moves 8 and 10         |
| Turning orchard: Up and down | 10 / 21 / 37 / 81                 |       37,200 | Knots cut by move 4, first home at 6, dial turned at 12, done at 21 |

Every run finished without a reshuffle. No moon gem was delivered while a pane stood, and
every orchard run turned the dial at least once. Chest targets are 80% of the median
score (25,000 and 30,000). The hint-led player always takes the hint, so these counts
show that the pairings are solvable and roughly how long they run. Whether they are fun
is for a person to judge on a phone. The board motion check reports no overlaps or
stutters on all three boards over eight hinted moves.

### Pairing prototypes: chapters 95–101

One board on trial for each remaining chapter of the release 1.3.0 plan, in each chapter's
first level slot (565, 571, 577, 583, 589, 595 and 601). Chapters 98–101 open act VI, so
those boards use its first color set (plan 30 onwards in `chapterPalettes`). Each borrows a
shipped chapter's backdrop and cargo art.

**`shifting-survey-stars`** ("Shifting survey: Shifting stars") pairs survey markers with
phase seals. Eight markers make a trail from the bottom left corner, up the left side,
across the top and down the right, and a double phase seal sits beside each marker. A
marker lights from a match on or beside it, so most matches that light one run through its
seal, whose gem changes color after every move. A change that lines up a match beside the
next marker lights it; beside a later marker it lights nothing yet. A sapphire order of 40
fills as the trail is lit.

**`ember-sidings-gates`** ("Ember sidings: Banked fires") pairs charge cores with portals
and moon gems. Two moon gems ride the siding through the portal and drop down the middle
column, where two thick gates stand between the exit pad and the basket. A brazier sits
either side of that column between the gates. Its bomb lands on its own cell, and the blast
reaches both gates and no portal pad. A sapphire order of 40 sets the pace.

**`buried-routes-bed`** ("Buried routes: Shaft or gallery") pairs dust fossils with route
chambers. Two fossils lie either side of a sealed one-cell shaft and under a sealed
gallery, where no swap reaches them. The shaft opens behind one thick block, and matches
across its foot brush both fossils from the side. The gallery opens behind four thin walls,
and matches there brush them from above. Unlike the chapter 94 well, each route reaches
both fossils, so the choice is between a narrow way in that costs two hits and a wide one
that costs four.

**`frost-relays-chain`** ("Frost relays: Relay chain") pairs frozen gems with spore relays.
Four bands of frozen gems alternate with free rows. The column relay in the middle bursts
down its column through both row relays, which burst along the free rows, and every cell a
burst clears thaws the frozen gems beside it. A burst never breaks the ice under a frozen
gem, since a frozen cell is never part of the clear: once thawed, that ice still takes a
match, as on every frozen gem.

The plan paired these with lanterns, but a frozen gem sits on ice (it is an ice layer in
`testing/helpers/boardRules.js`) and a lantern board carries no ice. Lanterns and frozen
gems cannot share a board under the content rules, so this board leaves the lanterns out
and keeps ordinary ice.

**`tidal-pearls-pairs`** ("Tidal pearls: Ebb and flow") pairs twin gravity with pearls and
one ore order. Two pairs of pearls meet at the seam, back to back. The upper pearl of each
pair rises to a hatch and the lower one sinks to a basket, while refills pour out of the
seam between them. An emerald order of 40 fills meanwhile.

**`rooted-vault-knots`** ("Rooted vault: Bound shut") pairs root knots with a breakthrough
chamber and chains. Three knots and their vines fill the row above the chamber's cracked
wall, so no gem there can be swapped until a knot is cut. Each knot is cut by a match
beside it, and a vine also breaks on its own when matched. Behind the wall, the chamber
holds three chained gems.

**`far-seam-either-way`** ("The far seam: Either way out") pairs lenses with a moon dial
and route chambers. A floatstone waits between two sealed one-cell shafts: a thick wall
above leads to the hatch, a thin wall below to the basket. A floatstone moves against
gravity, so the way up works as the cavern stands. The way down works only once a bonus
blast turns the dial in the bottom-left corner. Gold prisms in the four corners turn row
beams diagonally on to the walls: the top pair on to the thick one, the bottom pair on to
the thin one. A floor brazier gives crosses along the bottom pair's row.

A player could not predict two interactions here, so no beam on this board meets either.
A turned beam hits only playable cells (`bentBeams` in `engine/LensBeams.js`), so one
passing over the dial would not turn it, though a straight sweep does. A beam also passes
over a sealed shaft without touching it. `testing/prototype-boards.test.js` holds every
turned beam clear of the dial and of both shafts, and holds each wall on two prisms' lines.

The same test file checks each board's own rules: a seal beside every marker and a trail
that starts in the corner, both gates inside each brazier's bomb, a fossil bed out of
every swap's reach that both routes open on to, a relay chain that thaws every frozen gem,
pearl pairs that part across the seam, roots over the whole row above the wall, and a
floatstone with one way out in each gravity. `testing/levels/prototype-pairings-95-101.test.js`
measures 60 hint-led seeds per board, plus variants that take the pairing apart:

| 60 seeds (hint-led)             | Moves: 10th / median / 90th / max | Median score | Reshuffles | Bonuses made | What the pairing did                                                                    |
| ------------------------------- | --------------------------------- | -----------: | ---------: | -----------: | --------------------------------------------------------------------------------------- |
| Shifting survey: Shifting stars | 11 / 15 / 20 / 27                 |       35,800 |          0 |            7 | Of 480 markers lit, 295 by a match through their seal, 46 by a phase shift (in 30 runs) |
| Ember sidings: Banked fires     | 12 / 19 / 30 / 62                 |       32,700 |          0 |            9 | 2 brazier bombs a run; gates gone by move 6, moon gems home by moves 10 and 12          |
| … without braziers              | 14 / 23 / 37 / 77                 |       31,500 |          2 |            8 | Gates gone by move 13, moon gems home by moves 16 and 17                                |
| Buried routes: Shaft or gallery | 12 / 22 / 37 / 66                 |       37,500 |          0 |           11 | Shaft opened first in 43 runs (move 12), gallery in 17 (move 14); both in 51            |
| … shaft only                    | 15 / 36 / 80 / 116                |       41,800 |          2 |           13 |                                                                                         |
| … gallery only                  | 17 / 31 / 58 / 102                |       47,300 |          1 |           14 |                                                                                         |
| … neither route (bonuses only)  | 22 / 48 / 112 / 153               |       54,500 |          3 |           17 |                                                                                         |
| Frost relays: Relay chain       | 10 / 14 / 23 / 38                 |       29,500 |          0 |            6 | Of 1,200 frozen gems, 900 thawed by a burst and 300 by a match                          |
| … without relays                | 11 / 17 / 25 / 44                 |       29,600 |          0 |            8 | 404 thawed by a bonus and 796 by a match                                                |
| Tidal pearls: Ebb and flow      | 16 / 21 / 34 / 44                 |       30,200 |          0 |            8 | First pearl home by move 2, last by 19; order filled at 19, last in 29 runs             |
| Rooted vault: Bound shut        | 13 / 25 / 42 / 61                 |       43,400 |          0 |           14 | Knots cut by move 9, chamber open at 12 (after the last knot in 34 runs)                |
| … without roots                 | 6 / 19 / 55 / 86                  |       38,400 |          0 |           11 | Chamber open at move 6                                                                  |
| The far seam: Either way out    | 7 / 14 / 28 / 48                  |       13,900 |          2 |            3 | Out through the top in 25 runs, through the floor in 35; 24 of 145 wall hits by a prism |

Moves and the move numbers in the last column are medians unless marked. Every run
finished, and reshuffles are the free ones of a board with no match. Chest targets are 80%
of the median score, rounded to 500: 28,500, 26,000, 30,000, 23,500, 24,000, 34,500 and
11,000.

What the numbers say about each pairing, before anyone plays them on a phone:

- **Survey markers and phase seals** work together: three in five markers light through
  their seal, and half the runs see a shift light one. Keep.
- **Braziers, portals and moon gems** work: the bombs halve the time the gates stand, and
  the 90th percentile drops from 37 to 30 moves. Keep.
- **Fossils and route chambers** is the strongest pairing. Either route alone takes a
  median of 31–36 moves, both together 22, and players take both. Keep.
- **Frozen gems and spore relays** work, three thaws in four come from bursts, but one
  match beside the middle mushroom thaws the whole board. Later boards should hide relays
  inside the bands. Lanterns cannot join them (see above). Phase seals or chains could be
  the third mechanic: Comet frost already pairs frozen gems with phase seals.
- **Twin gravity, pearls and one order** plays well but adds little: Twin gravity's
  Twin pearls and Gated rims already pair the three, and only the single order is new.
  Either keep it as a quiet remix chapter or swap the order for a mechanic twin gravity
  has not met, such as chained pearls.
- **Root knots, a breakthrough chamber and chains** work: the roots hold the chamber
  shut for twice as long (move 12 against 6) and, by keeping play above the wall, shorten
  the slow tail (90th percentile 42 against 55). Keep.
- **Lenses, a moon dial and route chambers**: the dial and the routes work, with both
  ways out taken. The prisms are the weak part: only one wall hit in six comes through
  one, because ordinary bonuses beside the walls do the job. Starglass beside the
  floatstone made the prisms necessary, but in a 20-seed trial it took a median of 57
  moves (90th percentile 143), too long for a first level. Later boards can put the walls
  out of reach of nearby bonuses. This board is also the shortest of the seven.

The board motion check reports no overlaps or stutters on all seven boards over eight
hinted moves. On its seed, `rooted-vault-knots` cleared in seven, so the check reported
"only 7 hinted moves" for it. Screenshots at 375 × 740 (start and after six hinted
moves) were taken for each board; none has been played on a phone yet.

## Crystal seam mechanics and shape trials

The owner approved three original crystal behaviours for the 1.3.0 trials
(10 November 2026); [the proposal and measurements](new-mechanics.md) record the
review decisions. They remain outside the campaign until human phone play.

- **Trace twins** (`t`, or `j` for a second facet pair) link two matching facets.
  A player's swap matching on a stamp copies every matching line through it to
  its twin, preserving offsets, then consumes both. T/L matches copy both lines.
  Neighbouring matches, cascades, phase shifts and direct blasts do not fire it.
  Copies clip at edges and voids; they are discrete blast cells, so lenses never
  turn them. The trial has no lenses, and its matching facets and aligned gates
  show where the horizontal copy will land before the swap. A moving facet and
  individual cell flashes distinguish it from a spore beam.
- **Crossgrain crystal** (`i`) has a horizontal and a vertical crack. Matching on
  the crystal in each direction seals that crack; repeats do nothing. A blast
  seals only one remaining crack per move, horizontal first if both remain.
  The neck trial deliberately removes horizontal match space at two crystals,
  requiring matches plus aimed bonuses. Healed cracks close; after both, the
  entire icon disappears.
- **Chord crystal** (`s`) has three sockets, filled by different match colours on
  its own cell. Repeats and neighbouring matches do nothing. A blast adds one
  white wildcard socket per move; a new colour may fill any remaining socket.
  Cascades count as ordinary matches. The full crystal and all sockets disappear.
  Its trial places a phase seal between the two chords for colour preparation.

Every new marker uses the existing floor objective, hints, replay and free
recovery. None limits moves or time. The guide has original SVG art and French
instructions; the trial-only elements are deliberately non-mastery. Every
completed marker is checked against the appearance of a plain cell.

The clearing-only **Arrowhead** outline (formerly Crystal stair) has an interior
spring on its lower-left wing. **Twin windows** has two-row holes and a
three-cell-wide central crafting area. Every playable cell on both belongs to a
possible three-cell match line. All five boards finish on 60 hint-led seeds,
with chest targets at exactly 80% of median score. Their keys are
`trace-twins-first-impression` (548), `crossgrain-narrow-neck` (554),
`chord-changing-colours` (560), `arrowhead-inner-spring` (549) and
`twin-windows-crafting-spine` (555). See `testing/levels/new-crystal-trials.test.js`.
The shared prototype store test includes them automatically and finishes each
beyond 100 moves after the optional speed target. Motion checks report no
stutters or overlaps on all five. Screenshots are local to
`output/new-mechanics/`, generated by `testing/browser/new-crystal-trials.cjs`.
