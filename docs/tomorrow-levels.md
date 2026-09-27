# Tomorrow City mine chapters (levels 325–372)

The Tomorrow City era (c. 2065) needs more puzzles so players can earn its
building coins. This pass appends eight six-level chapters after the 54
existing chapters. It is append-only: level IDs 1–324, their seeds, layouts,
rewards, names, chapters and star targets are unchanged. A regression test
hashes all of them. Moves stay unlimited, and a board with no legal match
still reshuffles for free.

| Chapter | Levels  | Name                | Theme                                    | Familiar mechanics mixed with charge cores         |
| ------- | ------- | ------------------- | ---------------------------------------- | -------------------------------------------------- |
| 55      | 325–330 | Dome gardens        | Glass domes, solar gardens and seed pods | Introduction, then stone, reinforced stone, relics |
| 56      | 331–336 | Maglev loops        | Silent maglev loops and express pods     | Chains, relics                                     |
| 57      | 337–342 | Solar terraces      | Stepped solar terraces                   | Ore orders, staggered shelves, relics              |
| 58      | 343–348 | Hover lanes         | Hover lanes with cargo pods and docks    | Relic delivery (one to three pods), chains         |
| 59      | 349–354 | Orbital observatory | Orbital ring and observatory             | Numbered survey trail                              |
| 60      | 355–360 | Capsule commons     | Shared capsule commons                   | Colored seals, ore orders                          |
| 61      | 361–366 | Fusion sphere       | Fusion sphere inside a stone ring        | Reinforced rings, ore orders, relics               |
| 62      | 367–372 | Skyline of tomorrow | The finished skyline                     | Lanterns, seals, chains, orders and relics         |

Every chapter follows the established rhythm: introduction, practice,
delivery or exploration, stretch, a lighter fifth puzzle, then a finale. The
data lives in `src/data/tomorrowLevels.js`. Boards are authored as readable
7 × 9 grids and turned into the same expansion specs used by earlier chapters.
Two ice motifs, `dome` and `orbit`, are added for these chapters in
`earlyLevels.js`. The existing motifs are unchanged.

## New mechanic: charge cores

Inspiration:

- [Royal Match's light bulb](https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/378-light-bulb/)
  reacts to nearby matches.
- [Gardenscapes' fireflies](https://playrix.helpshift.com/hc/en/5-gardenscapes/faq/964-fireflies/)
  show staged progress before they release help.
- Candy Crush and Toon Blast turn pieces into boosters in place.
- Bejeweled's special gems reward a good match with a stronger piece.

Rules:

- A charge core is a floor marker, like a lantern. It never anchors a gem or
  blocks gravity. Gems can be swapped on it and fall through it, so it cannot
  create an unfillable cell.
- A match on the core or next to it (not diagonally) adds one charge. A bonus
  or power blast that reaches it also adds one charge.
- A core gains **at most one charge per move**, however long the cascade. Each
  full charge counts toward the level's "Tiles and charge cores" objective.
  Each core needs three charges.
- At full charge, the gem on the core becomes a free bonus. The bonus alternates
  by core: cross fire, then bomb. The gem is not cleared or collected. It uses
  the normal "bonus ready" reveal. If a relic, an anchored tile or another bonus
  occupies the core, the release moves to the first ordinary neighbor. If no
  neighbor can hold it, the charge still counts and completion is unaffected.
- A full core stays on the board, dimmed, with three gold pips. It does nothing
  else.
- It never spreads, counts down, harms the board or fails a puzzle.

Guardrails (checked by `testing/tomorrow-levels.test.js`):

- Level 325 introduces the core by itself: one core, ice and no other obstacle
  type, with the smallest workload in the chapter. The shared obstacle guide
  introduces "Charge core" the first time. That introduction pauses the clock,
  like other new obstacles. Later levels combine cores with one or two familiar
  mechanics.
- Cores are never placed on stone, chains, relics or exits.
- Corners stay clear, side columns stay free of stone, and the two bottom rows
  have no ice. Ice has at most two layers. Every relic has an exit in its own
  column. Ore orders and seals use colors from the level's palette.
- No level defines `maxMoves`, `moveLimit` or a time limit. Speed targets use
  the existing late-campaign formula: 75 s + 1 s per layer + 20 s per relic.
  They are optional chest thresholds.
- Other regression tests cover:
  - completing levels 325, 348 and 372 through the real store beyond 100 moves,
    after the speed target has elapsed
  - reshuffling a dead board that contains a core without moving or spending it
  - one charge per move during cascades
  - all bonus and power routes
  - relic-occupied releases and releases with no usable target
  - gravity through cores

Rendering reuses the `board-core` atlas with a new `tile-core` frame. The core
art is `public/art/obstacles/core.svg`, and the SVG fallback covers failed
atlases. The overlay is one image and three static circles. It is cached by
charge and rebuilt only when the charge changes. There are no tweens or
particles, and no work happens on each frame. The goal bar shows "Core
charges". The obstacle guide and all new text have French translations.

## Chapter scenery

The eight chambers use cool glass, solar gold and lilac palettes in
`src/styles/mine.css`. `MineBackdrop.vue` adds one static vector layer for all
Tomorrow themes: rounded domes with panel ribs, a dashed hover lane and a small
orbit ring. It uses the existing SVG, decoration ignores pointer events and
assistive technology, and high-contrast mode dims it like the other scenery.

## Measurements

These are simulations, not human completion rates:
`node scripts/measure-campaign.mjs . 30` ran hint-led legal swaps, used earned
board bonuses and free dead-board shuffles, used no inventory powers, and ran
30 refill seeds per level. All 1,440 new runs finished.

| Chapter                        | Median moves | 90th percentile | Longest sample | Shuffles |
| ------------------------------ | -----------: | --------------: | -------------: | -------: |
| 49–54 (levels 289–324)         |        19–23 |           30–39 |          47–84 |        1 |
| 55 Dome gardens                |           14 |              21 |             42 |        0 |
| 56 Maglev loops                |           16 |              27 |             55 |        0 |
| 57 Solar terraces              |           16 |              31 |             45 |        0 |
| 58 Hover lanes                 |           17 |              30 |             69 |        0 |
| 59 Orbital observatory         |           16 |              25 |             62 |        0 |
| 60 Capsule commons             |           17 |              27 |             58 |        0 |
| 61 Fusion sphere               |           16 |              24 |             60 |        4 |
| 62 Skyline of tomorrow         |           16 |              28 |             61 |        0 |
| All of 325–372                 |           16 |              27 |             69 |        4 |
| All of 241–324, for comparison |           21 |              34 |             84 |        — |

A new era starts with an easier introduction, then settles into a steady band.
Cores are a helpful mechanic, so these chapters average about five fewer moves
than the preceding late chapters. Several tuning passes checked extra ice,
stone and ore. They moved medians only slightly, because each core supplies a
free bonus. Limiting charging to one per move keeps that help readable and
stops long cascades from filling a core instantly.

Star targets for levels 325–372 use the existing calibration: the effective
score's 55th percentile, rounded down to 200 points. Re-running it reproduced
all 324 existing targets exactly. On the calibration seeds, 52% of the new runs
earn three stars. The held-out test keeps the 241–372 band within 30–65%.

Mining payouts scale with chapter depth, so earnings stay comparable to the
previous 48 levels even though the puzzles are shorter. Across the 48 new
levels, the median simulated mining payout is **1.29 million coins** (range
1.14–1.41 million over 30 seeds; about 27,000 per level). Levels 277–324 pay a
median of 1.27 million. This figure excludes these extra sources:

- chest coins: each chest pays 4,000 at this depth, and each puzzle earns one
  or two chests
- chapter gifts: 5,500–6,200 coins when the gift bag is full
- hammers
- passive income

Reproduce with:

```sh
node scripts/measure-campaign.mjs . 30 372 $(seq -s, 325 372) > /tmp/tomorrow.json
npx vitest run testing/tomorrow-levels.test.js testing/chapter-progression.test.js
```
