# Crystal seams: mechanics on trial for 1.3.0

The proposal was committed before implementation on branch
`t3/invent-new-mine-mechanics` from `7f29c0a9`. The five approved trials occupy debug-only slots;
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

## Candidates and review decision

**Trace twins — built.** A player's own swap matching on either faceted stamp
copies every ordinary matching line through it onto its twin as a blast, then
both stamps vanish. Choose a row, column or T/L footprint to reach different
remote gates. It combines with gates, chains and spore relays. Engine cost is
moderate: validated pairs, coordinate clipping and the existing pre-gravity blast
queue, with a separate facet animation. Hints preview the same footprint;
simulator receipts count its useful gate hits. Cascades, phase shifts, shuffles
and direct blasts never spend it. Copies are not beams and lenses do not turn
them, though a bonus caught by the copy can fire normally. Gravity is unchanged;
free recovery keeps stamps intact. Snapshot processing prevents duplicate firing
and preserves replay. Both endpoint icons disappear. This was both reviewers'
strongest choice: the prepared shape changes what the tool does.

**Crossgrain crystal — built with the review's changes.** A crystal has two
branching cracks. A horizontal match on it seals one, a vertical match seals the
other; either order works and repeats do nothing. A direct blast seals only one
remaining crack per move, so a missing direction in a narrow neck creates a
match-and-bonus decision. It combines with chains, ice and phase seals. Engine
cost is low: a two-bit mask and shared direction-aware rules for hints and
resolution. Simulation distinguishes directional and blast progress. Gravity is
unchanged, repeated bonuses remain a free recovery route, and primitive state
replays exactly. Healed cracks disappear; after both, no crystal icon remains.
This replaces the initial bar/arrow drawing and blast-clears-both proposal.

**Chord crystal — built, replacing Echo twins by the owner's choice.** Three
empty sockets fill with different colours matched on the crystal; repeats and
neighbouring matches do nothing. A direct blast fills one empty socket with
white wildcard light, at most once per move. Prepare new colours instead of
repeating the easy match; a neighbouring phase seal makes its next colour worth
watching. Engine cost is low: a primitive colour list and wildcard count, with
the core's static pip drawing on a distinct three-pronged crystal. Hints reward
new colours, and simulation counts colour versus wildcard fills. No random choice
selects a wildcard colour; gravity, free recovery and seeded replay stay shared.
The third filled socket removes the entire crystal and socket strip. This keeps
the colour-variety decision readable in one place at phone size.

**Echo twins — considered, not built.** Matching on one distant endpoint would
remember a colour, and the same colour at its twin would release both. Either end
could be retuned; the original proposal let a direct blast release the pair.
The decision was preparing a colour in two places, potentially with portals or
phase seals. Engine cost would be moderate: pair validation, remembered colours,
simultaneous tuning rules, colour-aware hints and pairing receipts for the
simulator. Gravity would stay unchanged, recovery would retain tuning, and
completion would erase both letters and colour chips. The owner chose Chord
instead: it expresses colour variety locally, without distant memory tracking.

**Colour kiln — considered, not built.** Matching on a kiln would store a colour;
a later match of that colour elsewhere would vent a small cross and consume it.
Choosing when to vent could position bonuses near gates or fossils. Engine cost
would be moderate: remembered colour, later-step activation, snapshot rules and
hint/simulator support for both stages. The priming match could not vent it too;
direct blasts would vent immediately, gravity would stay unchanged and recovery
would preserve its colour. Its icon would disappear after venting. It was set
aside because it overlaps colour memory and charge-core rewards.

**Counterweight seam — considered, not built.** A match through one plate would
load it; a later match through its twin would remove the lowest unanchored
ordinary gem in each marked column. Choose when the two falls help cargo or ice;
relics and bonuses would be protected. Engine cost would be high: paired state,
simultaneous loads, clear receipts and motion/replay verification for the two
falls. Hints and the simulator would need to value that positioning; bonuses and
free reshuffles would retain recovery, and both weight icons would disappear.
It was set aside because bespoke falls introduce more cargo and motion risk
than the floor-marker choices.

**Crystal shutters — considered, not built.** Directional matches would open
one of two routes into a goal, with direct bonus hits as another way in. Choose
an accessible orientation and route before reaching lanterns in a chamber.
Engine cost would be high: chamber validation, hint lookahead, idempotent
simultaneous openings and simulator checks that sealed objectives remain
conserved. Refill could never enter a closed route; free recovery would still
offer a bonus. Open shutters would disappear into ordinary cells. It was set
aside because breakthrough routes already provide much of that decision.

## Why the approved three

Trace twins asks **which footprint to send elsewhere**; Crossgrain asks **which
direction to prepare or replace with a bonus**; Chord asks **which new colour to
bring onto this cell**. They add separate decisions through familiar matching,
without a new input gesture, inventory requirement or falling-gem rule. Their
fiction comes from the exotic crystal under Prospect Hollow, independent of
any town building. The proposal commit preserves the initial six candidates;
the owner approved these three after review on 10 November 2026.

## Initial shape candidates

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

The final trials use 548 for Trace twins, 554 for Crossgrain, 560 for Chord,
549 for Arrowhead and 555 for Twin windows. They avoid the existing 547/553/559
trials and the other agent's 565/571/577/583/589/595/601 slots. Each retains the
level number it would occupy in the new pack, without entering the campaign.

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

Measurements and captures are recorded per trial below. The diagnostic simulator budget is not a gameplay cap.

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

## Approved shape trials

**Arrowhead**, renamed from Crystal stair, keeps the original sideways,
top-to-bottom-symmetric outline. It is a clearing board: columns 4–6 end above
the bottom and would strand cargo. The lower-left wing has an interior refill
source. **Twin windows** now has holes only on rows 3–4 and keeps three central
columns (`._..._.`) playable, so both windows are short and the spine can craft
horizontal matches. A behavioural geometry test checks every playable cell
belongs to at least one contiguous three-cell horizontal or vertical line.

```text
Arrowhead  Twin windows
...____    .......
.....__    .......
.......    .......
__.....    ._..._.
____...    ._..._.
__.....    .......
.......    .......
.....__    .......
...____    .......
```

| Trial                         | Slot | Moves p10 / median / p90 / max | Median score | Chest (80%) | Total reshuffles | Geometry mattered                                                |
| ----------------------------- | ---: | ------------------------------ | -----------: | ----------: | ---------------: | ---------------------------------------------------------------- |
| `arrowhead-inner-spring`      |  549 | 8 / 15 / 45 / 97               |       13,100 |      10,480 |                6 | Median 80 interior refills, including 1 at the lower-left spring |
| `twin-windows-crafting-spine` |  555 | 8 / 12 / 22 / 44               |       17,800 |      14,240 |                0 | Median 8 interior refills below the windows                      |

Each finished all 60 seeds. Arrowhead's longer tail and six free reshuffles are
acceptable for a shape trial, but should receive human play feedback before
filling a chapter. Twin windows is the gentler crafting lesson. Neither authors
cargo. Both finish in the store beyond 100 moves after the optional speed target
and leave the save untouched. Five-move motion scenarios sampled 320 / 250 frames
respectively, with zero overlaps and zero stutters, including the interior entries.

The approved trials remain outside the campaign. No move allowance, hard timer,
forced restart or paid recovery has been introduced. The first 546 configurations
retain their hash. Every random refill remains on `gameRandom`.

Final visual review covered all five contact sheets (start, mid-play and
activation/refill at both requested sizes), plus all three French phone guides.
All ten browser runs completed without page errors, and all six English/French
guide captures fit without horizontal overflow. A separate full Arrowhead
motion replay (seed 871) tracked five gems from its lower-left spring through
20 moves / 1,061 frames, with no overlaps or stutters. This supplements the
standard five-move shape scenarios. Captures, their event receipts and local
check logs live in `output/new-mechanics/`; actual phone feel remains unverified.

## Verification record and limits

All local checks ran in Docker (Node 24; Playwright 1.55 for browser checks).

- Proposal baseline: `npm run verify`, 259 files / 4,912 tests, passed.
- Trace verification: 260 files / 4,924 tests, passed.
- Crossgrain verification: 260 files / 4,930 tests, passed.
- Chord verification: 261 files / 4,939 tests, passed.
- Final `npm run verify`: 262 files / 4,950 tests, passed, including format,
  ESLint/Knip, footprint checks, production build and bundle budgets. First
  download: 461,692 / 480,000 bytes gzipped.
- `npm run test:levels`: all 6 files / 1,251 tests passed, including the full
  campaign playthrough, three-star attainment, late-store journeys, existing
  prototypes and all 300 new trial runs. The trial test also enforces each
  chest target's exact 80% calibration.
- Focused engine, store, replay, completed-marker, sprite, honours, translation,
  goal-panel, shape and chapter-progression regressions passed. First-546 config
  hashes remain unchanged. Trace's initial two behavioural tests failed before
  implementation and passed afterwards.
- Board atlas generation and honour-level/save-rule/public-content exports
  passed; shipped content catalogs remained unchanged. Era demo fixtures built.
- All five standard motion scenarios, the full Arrowhead spring replay, ten
  browser completion journeys and six English/French guide captures passed.
  All start/mid/activation contact sheets and French guides were viewed.
- Documentation formatting and local-link checks passed.

An initial verification run overlapped edits and heavy shared-machine load:
there were timeouts and inconsistent module snapshots, plus a missing French
chapter-name translation. The translation was added; fresh source snapshots and
one-/two-worker verification runs passed. Five previously failing suites also
passed separately (170 tests). No gameplay timeout or move restriction was added.

The standard development-server frame run did **not** pass: level 13 measured
15.6 ms/script frame and the next scene timed out waiting for the app store.
A production-build mine-only run then used the same three workloads, 15-second
windows, 4× CPU slowdown and 12 ms/frame ceiling, omitting only the optional
debug-tools run-log export. Levels 13 / 376 / 397 passed at 8.3 / 10.4 / 8.6 ms
per script frame, with 7 / 10 / 8 real moves. Town was excluded from that scoped
run; no town code changed.

A separate production level-13 comparison alternated five samples per side after
warm-up (baseline `7f29c0a9`, same seed, browser and flags). Baseline median was
8.44 ms/frame, range 5.82–9.25; candidate median 7.97, range 7.48–10.21. Every
sample completed 4–5 moves with no page errors. Verdict: **inconclusive**, because
the ranges overlap and their spread exceeds the median difference. A separate
candidate profile was dominated by native/program and idle time, with Phaser
the largest named JavaScript contributor; the limiting resource remains unknown.
The first three-second warm-up was rejected because it completed no moves.
Raw samples, profile, load record and benchmark contract are in
`output/new-mechanics/frame-ab-*` and `frame-candidate-profile.json`.

These are desktop software-renderer observations, not phone measurements.
Actual phone play, accessibility feedback on the small sockets/cracks and the
owner's judgement of fun remain unverified. The boards stay on trial and the
release plan keeps that human phone decision open.
