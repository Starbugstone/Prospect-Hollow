# Crystal seams: mechanics on trial for 1.3.0

These are proposals written before implementation, on branch
`t3/invent-new-mine-mechanics` from `7f29c0a9`. Any approved trials will occupy debug-only slots;
levels 1–546, their rewards and the campaign count stay fixed. No proposal
uses a move budget or a hard timer. Free reshuffling remains available.

The owner approved Trace twins, Crossgrain crystal and Chord crystal after review
(10 November 2026). Trace twins copy only a player's direct swap matches; copied
cells are discrete blast cells, never beams, so lenses do not turn the copy.
Crossgrain blasts split one remaining side. Chord counts only matches on its own
cell; a blast fills one empty socket with white light, at most once per move.
Repeating a remembered colour adds nothing; a new colour fills another socket.
White light is a wildcard, not a gem colour. All three disappear when complete.

Echo twins was considered and not built: colour memory at two distant ends adds
more tracking and is less immediately readable than the owner's Chord crystal.
Colour kiln was considered and not built: it overlaps colour memory and cores.
Counterweight seam was considered and not built: its bespoke falls carry too much
cargo/motion risk. Crystal shutters was considered and not built: it largely
repeats breakthrough routes. Keyhole is not a separate new shape; its neck may
teach Crossgrain. The approved shapes are Arrowhead (renamed Crystal stair,
clearing only) and Twin windows with two-row windows and useful crafting space.

The candidate paragraphs below preserve the initial proposals for the review
record. The implementation rules above supersede their original blast rules and
presentation sketches.

## Existing engine and design space

The current mine already offers fixed directional spore bursts, numbered survey
trails, charge-to-bonus cores, colour seals, colour-changing phase seals, linked
roots, multi-piece fossils, ore orders and the ice/chain/frozen-gem layers. Cargo
includes pearls, moon gems and floatstones; lenses redirect beams, portals route
gems, chambers open routes, and moon switches change gravity. A new proposal
should therefore add a choice beyond another hit counter or a differently drawn
lantern.

`parseMineBoard` in `src/data/deepMineLevels.js` provides shared grammar and
footprint validation; `hollowLevelSpec` in `src/data/hollowMineLevels.js` extends
it. `LevelGenerator` builds tile state. `MatchEngine` already supplies match
colour, footprint and horizontal/vertical orientation. `TileManager` resolves
floor markers, bonus chains and chamber openings before gravity. `BoardTopology`
and `GravityFrames` own voids, routes, portals, inverted cargo and refill;
`HintEngine`, recovery and the renderer share those contracts. Store resolution
works on a tile copy, and run fingerprints include tiles, so primitive marker
state can remain deterministic without separate saved progression.

Existing silhouettes include split wells, funnels, ribbons, pockets, arches,
steps and taller 7 × 10/11 caverns. The shape sketches below propose specific
void arrangements for comparison against the authored maps before approval;
a silhouette name alone does not establish novelty.

## Candidates

**Crossgrain crystal (recommended).** A floor crystal splits when matched through
horizontally and vertically, in either order. Its remaining bar shows the axis
still needed; a direct bonus blast splits both. The decision is to preserve a
useful alignment instead of repeatedly matching the easiest direction. Chains,
ice and phase seals complicate which axis can be prepared first. Cost: one
small tile state and a deterministic match-orientation check, no gravity change.
Hints must value a missing axis rather than repeated hits; simulation must count
only actual splits. Bonuses provide a way out even in a thin passage. A T or L match can split both axes in one step. Both bars
and the floor icon disappear on completion.

**Echo twins (recommended).** Two floor crystals share a letter. Matching on one
records that match's colour, shown as a small gem beside the letter. Match the
same colour on its twin to release both. Either end can be retuned freely;
a direct bonus hit releases the pair immediately. The player chooses which
colour to prepare at two distant places instead of clearing whichever match is
nearest. Portals and phase seals make that preparation interesting. Cost: paired
floor state, validation of exactly two ends, colour-aware hints and deterministic
simultaneous-hit rules (apply all tunes before comparing the pair). Gravity is unchanged; reshuffles retain tuning and bonuses
avoid a colour dead end. Simulation records successful pairings. Completion
removes both letters, gems and icons, including the remote end.

**Trace twins (recommended).** Match through either of two linked crystal stamps.
The crystal copies that match's footprint to the other stamp, preserving each
cell's offset, then both stamps disappear. Copied cells receive a bonus blast,
so a long row can reach a gate while a column can reach a different passage.
The decision is which shape to prepare before spending this one-shot tool.
It combines with blast gates, chains and spore relays. Cost: a clipped translated
footprint and the existing pre-gravity bonus-chain queue; hints preview the
remote footprint. No gem is teleported and voids are never filled. Copied coordinates clip at board edges and voids, never wrap rows. Multiple
matches use a snapshot; if both ends match together, copy both footprints but
consume the pair once. Stamps fire once,
including when a bonus hits them (that sends only the centre cell). Simulator
receipts count remote hits; recovery preserves unspent stamps, and direct bonus
hits make even a narrow or awkward stamp reachable. Both completed stamps leave ordinary cells.

**Colour kiln (deferred).** Matching through the kiln stores a colour; a later
match of that colour anywhere vents a small cross around it and consumes it.
Choose a colour that can be made again, and delay the vent until nearby bonuses
are positioned. It pairs with gates and fossils. Cost: colour memory and a
pre-gravity wave, with snapshot rules and hints for both stages. Gravity stays
unchanged; direct bonus hits vent immediately and recovery retains the stored
colour. Simulation records one vent per kiln; the priming match cannot also
vent it, and all ordering uses the existing seeded resolution. Its icon and colour chip vanish after venting. Deferred because its
colour memory overlaps echo twins and its reward overlaps charge cores.

**Counterweight seam (deferred).** Two floor plates mark columns of a crystal balance: a match
through one plate loads it, and a later match through the other releases both.
That removes the lowest unanchored ordinary gem in each marked column, using
the usual clear ledger and gravity; relics and bonuses are never removed. Choosing the second side controls
when the two small falls happen; cargo and ice can exploit the opening. Cost:
paired state, deterministic simultaneous loads and protected relic handling;
hints and simulation must value the lift. Free reshuffles and bonus release
ensure recovery. Both weights disappear. Deferred because bespoke falls and
cargo interactions raise motion and replay risk for a first introduction.

**Crystal shutters (deferred).** A floor shutter admits a horizontal match;
that opens its linked vertical shutter, and the player may choose either of two
such routes into a goal. Bonus hits open a shutter directly. The decision is
which orientation to prepare and which route to open first. It combines with
chambers and lanterns. Cost: more chamber-state validation and hint lookahead;
refill must never enter the closed route. The simulator must conserve sealed
objectives, recovery must still offer a bonus while either route is closed, and
simultaneous openings must be idempotent for replay. Completed shutters disappear into
ordinary cells. Deferred because existing breakthrough routes already cover
much of its decision, and sealed-state recovery costs more than floor markers.

## Recommended three, pending review

Crossgrain asks **which direction**; echo twins ask **which colour at two places**;
trace twins ask **which footprint to send elsewhere**. They add separate spatial
decisions without introducing a new input gesture, inventory requirement or
falling-gem rule. They are crystal behaviours of the deep caverns and assume no
town building exists. They use familiar matching as a language, rather than
borrowing a named character or signature piece from another game.

## Shape candidates

- **Keyhole:** broad crafting head, three-cell neck, broad foot. The neck changes
  which match orientations are practical. Every vertical segment refills from
  its own top; no hidden sockets or disconnected objectives.
- **Twin windows:** a full-width rim with two interior void windows and a central
  spine. Routes wind around visible absences; horizontal and vertical matches
  reach different parts. Every playable region retains at least a three-cell
  crafting area, and gravity uses the existing topology contract.
- **Crystal stair:** alternating three-/five-/seven-cell shelves stepping across
  the cavern. The outline creates changing match lengths without one-cell goal
  traps; each shelf can refill and every goal has bonus access.

Proposed 7 × 9 masks (`.` playable, `_` permanent void), with each line a row:

```text
Keyhole    Twin windows   Crystal stair
.......    .......        ...____
.......    .......        .....__
.......    .._._..        .......
__...__    .._._..        __.....
__...__    .._._..        ____...
_....._    .._._..        __.....
.......    .......        .......
.......    .......        .....__
.......    .......        ...____
```

Keyhole reserves its neck for vertical planning and its head/foot for crafting.
Twin windows keeps a central vertical spine between two holes: trace twins
could carry a footprint across a hole while gems still refill by their normal
routes. The stair shifts the crafting shelf twice, instead of tapering into a
single basket. These are clearing-board proposals first; do not add cargo until
`cargoPath` proves every authored cargo position can reach an exit. In particular,
columns broken by a void refill as separate segments; the drawings imply no
hidden flow or diagonal bridge. Goals placed on narrow stretches must remain
reachable by bonuses, even where one match orientation is impossible.

If approved, each gets a separate debug-only trial board, 60 hint-led seeds, store completion
after 100 moves and the optional speed target, and the browser motion check.
Human phone play remains a separate release decision.

## Acceptance and implementation contract

The authoritative state is the tile array, resolved by `TileManager`. New floor
markers contribute through `signalHealth` to the existing objective. Tests must
reject repeated-axis progress, mismatched echo colours, invalid pairs, copied
hits across a row boundary, duplicate firing and any completed marker residue.
Resolve simultaneous pairs from a snapshot; never roll random values in hints.
All random refill remains on `gameRandom`. Preserve run-log replay and the
shipped-level hash. Each mechanic has its own guide art and French translation,
and is deliberately non-mastery while it exists only on trial boards.

## Proposed trials and evidence

Reserve 548 for crossgrain, 554 for echo twins and 560 for trace twins, with
549/555/561 for the three separate shape trials. These avoid the existing
547/553/559 trials and the other agent’s 565/571/577/583/589/595/601 slots.
No slot is authored by this proposal.

For each approved trial, report all 60 finishes, moves at the 10th/median/90th/max,
median score and reshuffles; set the chest at 80% of median score. Also report
how often crossgrain needed its second axis, how many echo pairs finished by
colour rather than blast, and how many gate layers trace footprints actually
removed. Those figures distinguish use of the new rule from winning by ordinary
bonus blasting. A high bypass rate is grounds to redesign the teaching board.

Capture the start, a prepared intermediate position and the activation at both
375 × 740 and 1440 × 900. Inspect the remaining-axis bar, paired-end labels,
remembered colour and copied blast footprint at phone size. Run the motion check
for each trial key, store completion after move 100 and after the optional speed
target, replay tests and the first-546-level hash. Record verdicts as machine
solvability/readability evidence; fun and actual phone feel still need a person.

## Measurements and visual review

Not run: implementation is awaiting review. The diagnostic simulator budget is not a gameplay cap.

## Proposal validation

Docker `npm run verify` passed on the proposal worktree: formatting, ESLint/Knip,
footprint generation checks, 259 test files / 4,912 tests, production build and
bundle budgets. The gzipped first download measured 458,391 / 480,000 bytes.
Output: `output/new-mechanics/proposal-verify.log` (local, ignored).
This validates the unchanged baseline, not the unimplemented proposals.

## Trace twins implementation

`t` and `j` each author exactly two stamps with diamond and hexagon facets.
Only ordinary matches containing a stamp on the first resolution step of a real
swap fire it; cascades, phase shifts, reshuffles and direct blasts do not. Every
line through it contributes, including both lines of a T/L. Both ends matching
simultaneously copy from one snapshot, then consume the pair once. Off-board and
void destinations are clipped by coordinates. Trace receipts use the relay's
pre-gravity blast queue and trigger ordinary bonus chains, but have their own
moving facet and per-cell flashes. The teaching board contains no lenses.

| Trial                          | Slot | Moves p10 / median / p90 / max | Median score | Chest (80%) | Reshuffles | Rule mattered                                    |
| ------------------------------ | ---: | ------------------------------ | -----------: | ----------: | ---------: | ------------------------------------------------ |
| `trace-twins-first-impression` |  548 | 3 / 6 / 16 / 44                |        9,700 |       7,760 |          0 | 60/60 copies damaged a gate; median 1 gate layer |

All 60 hint-led seeds finished. Verdict: a short introduction that rewards a
horizontal footprint; the hint previews remote cells instead of spending the
stamp on an unhelpful column. These are simulator results, not human fun ratings.
The first two behavioural tests failed on the old engine (remote gate remained;
a neighbouring match wrongly consumed the marker) and pass with the new rules.

Trace browser evidence: viewed start, mid-play and activation captures at
375 × 740 and 1440 × 900 under `output/new-mechanics/`. Both seeded browser
journeys finished without page errors. The two-move 60 fps motion scenario
sampled 176 frames, with zero overlaps and zero stutters. Trial run-log replay
passed, as did the completed-marker renderer regression. Honour/save/public
catalog exports were rerun and left the shipped catalogs unchanged.

## Crossgrain implementation

`i` marks a Crossgrain crystal. A two-bit remaining-crack mask belongs to its
floor tile; both resolver and hints read match objects with their directions.
Horizontal and vertical matches seal their corresponding crack, in either order.
A T/L can seal both; repeated directions do nothing. A blast seals just one
remaining crack (horizontal first when both remain), at most once per move.
Repeated bonuses can therefore rescue even a crystal in a narrow passage.
The picture is a faceted crystal with two dark branching cracks: each healed
crack disappears, and the entire picture leaves after both are healed.

The trial's one-cell neck deliberately prevents horizontal matches at two of
its three crystals. Decide whether to match vertically first and aim a bonus
later, or blast the horizontal crack first and prepare a vertical alignment.
The broad head and foot provide crafting space. This replaces the first,
too-easy three-cell-neck draft (median three moves).

| Trial                    | Slot | Moves p10 / median / p90 / max | Median score | Chest (80%) | Reshuffles | Rule mattered                                  |
| ------------------------ | ---: | ------------------------------ | -----------: | ----------: | ---------: | ---------------------------------------------- |
| `crossgrain-narrow-neck` |  554 | 5 / 14 / 39 / 64               |       13,400 |      10,720 |          0 | Median 3 directional splits and 3 blast splits |

All 60 seeds finished. Verdict: the missing horizontal space forces the crystal's
mixed match-and-bonus rule; it cannot be solved by repeating vertical matches.

Crossgrain browser evidence: viewed the phone start and healed-crack state;
start, mid-play and activation captures exist at both required sizes. Both
seeded journeys finished with no page errors. The three-move 60 fps motion
scenario sampled 179 frames: zero overlaps, zero stutters. The shared prototype
store test completes beyond 100 moves after its optional speed target, without
saving or giving rewards; its seeded run replays exactly.

## Chord implementation

`s` authors a Chord crystal with three sockets. Only an ordinary match on its
own cell fills a coloured socket, including a cascade match. A colour already
remembered there does nothing. Each direct blast fills one empty socket with
white light, at most once per move; white is a wildcard and does not reserve a
colour. Any as-yet-unrecorded colour can fill another empty socket. The third
socket completes the crystal and removes its entire icon and socket strip.

The tile stores a primitive colour list and white-light count, so move copies
and replay fingerprints own all state. The three-pronged crystal and socket
strip distinguish it from a brazier/core; the shared static pip drawing handles
filled colours and empty sockets. Hints score a genuinely new colour, not a
repeated hit; no random roll chooses a wildcard's colour.

| Trial                    | Slot | Moves p10 / median / p90 / max | Median score | Chest (80%) | Reshuffles | Rule mattered                                         |
| ------------------------ | ---: | ------------------------------ | -----------: | ----------: | ---------: | ----------------------------------------------------- |
| `chord-changing-colours` |  560 | 4 / 6 / 9 / 19                 |       10,000 |       8,000 |          0 | Median 5 colour fills / 1 white fill across 6 sockets |

All 60 seeds finished. Verdict: the changing gem between two chords helps prepare
a different colour, while the results show colour changes doing most of the work.

Chord browser evidence: viewed both phone socket states and the desktop mid-play
state. The three-pronged icon reads separately from the core; coloured sockets
and white wildcard sockets use the shared pip renderer. Both browser journeys
finished without page errors. Its three-move motion scenario sampled 196 frames,
with zero overlaps and zero stutters. The goal panel now counts each new crystal's
remaining stamps, cracks or sockets, with an SSR regression for all three.
