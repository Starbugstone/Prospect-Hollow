# Mine expansion plan: levels 403–546

The working checklist for the next 24 mine chapters. Tick each box as soon as it
is done (and its Docker checks pass), so another session can resume after a crash.
Agreed with the user on 2026-10-07; the decisions below are theirs.

Branch `feature/mine-expansion`, worktree `/home/stone/work/mine-expansion`,
based on `preprod`.

## How to resume

1. `git -C /home/stone/work/mine-expansion status` and read the first unticked box.
2. Each chapter lives in `src/data/hollowMineLevels.js` (append-only). A chapter
   is only added to the campaign once its six levels pass `npm run test:levels`.
3. Run checks in Docker from the worktree (see `AGENTS.md`).

## Agreed rules

- **Unlimited moves, no timers.** Gravity flips, portals, lenses and phase seals
  only rearrange the board; none can fail or block completion. Every level is
  completed in regression coverage after more than 100 moves.
- **Completed obstacles leave no icon.** One-shot switches, starglass and phase seals
  leave the board when completed. The moon dial, portals and lenses are fixtures;
  the dial and exits leave together once the last cargo is delivered.
- **Boards stay nearly full.** Voids only where they have a job (portal channel,
  hourglass waist, lens cells). Taller boards (7 × 10, 7 × 11) come before wider
  ones; 8 × 10 finales only after a mobile tap-size check at 390 × 844.
- **No ice on extraction levels.** A level whose goal is lighting lanterns or
  getting items out (pearls, floatstones, moon gems, relics, survey trails) has no
  ice. All other levels keep ice as usual.
- **Loose era theme.** The mine is not gated by the town era. Chapters follow the
  era a typical player would be in at that level, but the text never assumes a town
  building exists. Low gravity comes from the floating crystal deep in the mine,
  so it makes sense in every era. The Willowkin appear in the story.
- **Familiar first.** Each act alternates new mechanics with remix chapters that
  pair familiar mechanics in new ways. New gems appear in remix chapters.
- Shipped levels 1–402 stay byte-for-byte unchanged (hashes, stars, chests).

## New elements

### Floatstones

Exotic glass relics that rise. Clear the gems directly above a floatstone and it
floats up into the gap; gems sink past it. A floatstone reaching a sky hatch on the
top row is collected. A board bonus may swap with it and fire, if the floatstone
can still reach a hatch. Under inverted gravity floatstones sink.

### Low gravity

- **Inverted board:** everything falls up; refill enters from the bottom.
- **Split board:** the top half falls up and the bottom half falls down; refill
  enters at the middle seam. Pearls collect on the bottom row, floatstones on top.

### Gravity switches

Floor markers on a side or corner cell; gems pass freely. Only a bonus blast that
covers the cell triggers one; ordinary matches never do. At most one flip per move.

- **Moon lock (one-shot):** flips gravity once and leaves the board. The level
  starts with gravity the wrong way for the goal.
- **Moon dial (multi):** flips gravity on every triggering move. Its arrow always
  shows the current direction. Later levels may place it nearer the crafting area.
- Every cargo item must be able to reach an exit in some gravity state (tested).

### Portals

A gem leaving the bottom of portal A appears in portal B. Moon gems (relic cargo,
art distinct from the moonstone gem) fall down a walled side channel, take the
portal and reappear in the middle above the exit. Ordinary gems and refills use the
portal too. Portal routes may not loop (validated at authoring).

### Lens mirrors

Fixed mirrors on edge cells (void cells with a mirror). A row or column beam (cross
bonus, spore burst) reaching a lens turns:

- **90° lens:** a round silver mirror drawn at its real angle; the beam continues
  along the perpendicular line.
- **45° lens:** a triangular gold prism drawn at its real angle; the beam travels
  diagonally and hits every cell on that diagonal.
  Both show an outgoing arrow (shape, angle and arrow, for colour-blind players and
  high contrast). Each lens turns a given beam once (technical loop guard).
  **Starglass** shards only break when hit by a beam bent by a lens; they leave the
  board when broken.

### Breakthrough caverns

A taller board (7 × 10 or 7 × 11) starts as an upper chamber. A cracked waist wall
(blast gates) separates a sealed lower chamber. Breaking the waist opens the lower
chamber, which fills from above (hourglass).

### Phase seals

After each player move settles, the gem on a phase seal changes to the colour shown
by the seal's next-gem icon (shape and colour), then a new next gem is drawn from
the level's colours (never the current colour). A change that forms a line matches
as a normal cascade, including bonuses. A match on the seal breaks it; later seals
take two. Ships only if playtests feel fun.

### Two new gems

Swap into five-colour sets; boards never get more colours.

- **Peridot** (lime, hue ≈ 90, leaf/teardrop cut): debuts in chapter 1, rotates in
  for topaz or emerald.
- **Starmetal** (brushed silver, rough six-sided nugget): debuts in chapter 7,
  rotates in for sapphire or amethyst.
  Each gets an honours family (bronze, silver, gold goals calibrated with the
  simulator), `since` = raised `HONOURS_VERSION`, shipped-ranks fixture entries,
  server counters and regenerated catalogs. A level with coloured seals keeps that
  colour in its set.

## Chapters

Act I · The floating seam (≈ Skysail)

| #   | Levels  | Chapter            | Content                                                   |
| --- | ------- | ------------------ | --------------------------------------------------------- |
| 1   | 403–408 | Riverglass seams   | Remix: lanterns (no ice), chains and ice; peridot debuts  |
| 2   | 409–414 | Floatstone shafts  | **New:** floatstones on normal boards                     |
| 3   | 415–420 | Glowing fossils    | Remix: spores firing into fossil casings and blast gates  |
| 4   | 421–426 | Rising and falling | Pearls down to the basket, floatstones up to the hatch    |
| 5   | 427–432 | Rigging vault      | Remix: root knots holding floatstones; chains             |
| 6   | 433–438 | Brazier chimney    | Remix: braziers whose bombs open ceilings for floatstones |

Act II · Star chambers (≈ Stargazer)

| #   | Levels  | Chapter           | Content                                                |
| --- | ------- | ----------------- | ------------------------------------------------------ |
| 7   | 439–444 | Starlit survey    | Remix: survey trail and lanterns; starmetal debuts     |
| 8   | 445–450 | Lens gallery      | **New:** 90° lenses, line bonuses, starglass           |
| 9   | 451–456 | Spore observatory | Spores bouncing off lenses; 45° lenses                 |
| 10  | 457–462 | Phase vault       | **New:** phase seals (remix chapter if playtests fail) |
| 11  | 463–468 | Comet frost       | Remix: frozen gems, double ice, a few phase seals      |
| 12  | 469–474 | Lens vault        | Finale: lenses, fossils, ore orders; 7 × 10 trial      |

Act III · Ribbon works (≈ Moonward)

| #   | Levels  | Chapter              | Content                                                 |
| --- | ------- | -------------------- | ------------------------------------------------------- |
| 13  | 475–480 | Portal sidings       | **New:** side channel to a middle exit with moon gems   |
| 14  | 481–486 | Moon-gem freight     | Portals, ore orders, chained cargo                      |
| 15  | 487–492 | Breakthrough         | **New:** hourglass, cracked waist, lower chamber        |
| 16  | 493–498 | Elevator foundations | Breakthrough with braziers and root knots               |
| 17  | 499–504 | Portal pearls        | Portals feeding pearl funnels; gate on the portal mouth |
| 18  | 505–510 | Ribbon foundry       | Finale: best-of remix; 8 × 10 or 7 × 11 trial           |

Act IV · The hollow below (≈ Twin Hollows)

| #   | Levels  | Chapter               | Content                                                 |
| --- | ------- | --------------------- | ------------------------------------------------------- |
| 19  | 511–516 | Upside hollow         | **New:** inverted gravity; floatstones sink             |
| 20  | 517–522 | Twin gravity          | **New:** split board, refill from the seam              |
| 21  | 523–528 | Moondust beds         | Remix: dust fossils in low gravity                      |
| 22  | 529–534 | The moon lock         | **New:** one-shot switch with pearls or floatstones     |
| 23  | 535–540 | Willowkin float grove | Locks, root knots, lanterns; the Willowkin plant a tree |
| 24  | 541–546 | Starfall cavern       | Finale: moon dial, pearls and floatstones together      |

## Checklist

### Foundations

- [x] Level module `src/data/hollowMineLevels.js` with its own parser (shares the
      deep-mine symbols), appended after `DEEP_MINE_*` in campaign, expansion and
      level names
- [x] `ice: 0` works end to end for extraction-only levels (generator, objective,
      summary, completion)
- [x] Reward targets (chest, speed) and star targets for new levels from measurement
- [x] French names and tips for every new chapter and level
- [x] Shipped-level hash tests still pass (levels 1–402 unchanged)

### Engine

- [x] Floatstones: rise into cleared gaps, pinned while gems sink past, sky-hatch
      collection, bonus swap, hints, recovery, renderer and measurement support
- [x] Gravity frames: inverted and split gravity (refill edge per region), with
      relic, floatstone and exit rules following the frame
- [x] Gravity switches: moon lock and moon dial, one flip per move
- [x] Portals: non-adjacent gravity routes, loop validation, teleport animation
- [x] Lenses: 90° and 45° beam turns, starglass, distinct art
- [x] Breakthrough: sealed chambers that open, taller boards, outline redraw
- [x] Phase seals: seeded next gem, transform cascade, next-gem icon
- [x] Each new obstacle: `obstacles.js` entry, guide text (EN/FR), completed-board
      marker sample, honours decision (family or `NON_MASTERY_ELEMENTS`)
- [x] Board motion check (`testing/browser/board-motion.cjs`) passes on new gravity

### Gems

- [x] Peridot: art, texture, high contrast, bonus overlays, honours family
- [x] Starmetal: art, texture, high contrast, bonus overlays, honours family
- [x] Honours: version raise, shipped-ranks fixture, server `Honours.php`, catalogs
- [x] Mobile readability check of the new gems beside the existing six

### Chapters (tick when the six levels pass `npm run test:levels`)

- [x] 1 Riverglass seams
- [x] 2 Floatstone shafts
- [x] 3 Glowing fossils
- [x] 4 Rising and falling
- [x] 5 Rigging vault
- [x] 6 Brazier chimney
- [x] 7 Starlit survey
- [x] 8 Lens gallery
- [x] 9 Spore observatory
- [x] 10 Phase vault
- [x] 11 Comet frost
- [x] 12 Lens vault
- [x] 13 Portal sidings
- [x] 14 Moon-gem freight
- [x] 15 Breakthrough
- [x] 16 Elevator foundations
- [x] 17 Portal pearls
- [x] 18 Ribbon foundry
- [x] 19 Upside hollow
- [x] 20 Twin gravity
- [x] 21 Moondust beds
- [x] 22 The moon lock
- [x] 23 Willowkin float grove
- [x] 24 Starfall cavern

### Release

- [x] Honours level index (`node scripts/export-honour-levels.mjs`) and server
      catalogs (`npm run export:save-rules`, `node scripts/export-public-content.mjs`)
- [x] Updates entry announcing the new levels
- [x] `npm run verify`, `npm run test:levels`, board motion check, PHP checks
- [x] Docs: implemented-chapter guide with measurements (like `deep-mine-levels.md`)

## Notes for later steps

- Server catalogs (`npm run export:save-rules`, `node scripts/export-public-content.mjs`)
  are regenerated once at release, from a clean `backend/content`, so the save-rule
  history records only the final targets of each new level.
- Honours: extra lanterns push the shipped Lamplighter gold (125) below 1.3 campaigns.
  At release, add diamond ranks where a family's top rank falls below ~1.3 campaigns,
  with a raised `HONOURS_VERSION`, and make the calibration test check each family's
  top rank. Measure once all chapters are in.

## Log

- 2026-10-07: plan agreed; worktree created.
- Floatstones and gravity frames (`GravityFrames.js`) in; chapters 1–6 (levels 403–438)
  authored, calibrated (30 seeds), translated and passing `npm run test:levels`. Peridot is
  still to come for chapter 1's palette.
- Lenses (`LensBeams.js`), phase seals (`PhaseSeals.js`), portals (`BoardTopology.js`) and
  breakthrough chambers (`Breakthroughs.js`) in, each with engine tests. Act II (levels
  439–474) passes `npm run test:levels`; level 449's star target was lowered to 20,000 after
  a held-out check. Act III (475–510) authored, calibrated and translated; its level
  simulations are running. Chapter 12 uses 7 × 10 boards, chapter 18 uses 7 × 11.
- Act III (475–510) and Act IV (511–546) authored, calibrated (30 seeds, then a held-out
  check on seeds 101–120 that lowered a few star targets), translated, and passing the
  hollow-level tests. Gravity switches (moon lock, moon dial) in `GravityFrames.js` with
  hint support (`flipGain`). New levels share the 373+ endgame pacing allowance in
  `testing/levels/campaign-playthrough.test.js`. Levels 1–402 still hash identically.
  Remaining: full `npm run test:levels` pass, visual browser check of every new mechanic,
  board motion check, the two gems, honours, updates entry, docs, catalogs.
- Gems in: peridot and starmetal (`scripts/generate-gems.mjs`, classic cut only), with
  act color sets in `hollowMineLevels.js`; the colors only rename seeded gems, so the
  simulated games and targets did not change. Starmetal got a gold star mark after a
  phone screenshot showed it reading like grey stone. Honours version 4: two new gem
  families and diamond ranks where the larger campaign passed gold (docs/honours.md).
  Portal levels needed a gravity-order fix (portals can hand gems upward); a chain-reaction
  regression caught it. Visual checks: headless 390 × 844 screenshots of one level per
  mechanic, no page errors.
- Board sizes: chapter 12 and the Act III breakthrough chapters use 7 × 10, chapter 18
  uses 7 × 11. 8 × 10 was not needed; taller boards keep tap size on phones.
- Lesson: lens puzzles need dependable beam sources (mushrooms, charge-core crosses,
  floor-corner lenses that settled bonuses reach), and blockers high on a column starve
  everything below them, so ceilings stay low and narrow.
- 2026-10-08: final checks green: `npm run verify` (one town test timed out under load and
  passes alone), `npm run test:levels` (1,094 tests), PHP checks and PHPStan, board motion
  check. Nothing is committed yet; the branch waits for the user's go-ahead.
- 2026-10-08: the user asked for a high-average difficulty measured by the hint player. The
  levels were tuned to a median of 28 moves (deep mine 27): ice where allowed, ore orders on
  lantern and cargo levels. Completion verified with 100 hint-led seeds per level, a random
  player and the real game store; targets, honours (ore orders 227 per campaign; every gem now
  has a diamond) and catalogs were recalibrated.
- 2026-10-08: levels 411 and 429 became six-color boards (amethyst added) in place of their
  ore orders, after an experiment showed six colors roughly double a board's effort.
