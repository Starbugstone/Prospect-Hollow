# Five deeper mine groups

Groups 63–67 append thirty puzzles, levels 373–402, to the existing campaign.
They use the familiar 7 × 9 board and five gem colors. Players still swap gems,
make matches and use earned bonuses; no extra tool or interaction mode is needed.
Moves remain unlimited, dead boards recover for free, and the optional speed
target never interrupts play or prevents completion.

| Group | Levels  | Theme and instinctive action                                                                                        |
| ----- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| 63    | 373–378 | **Fossil beds:** match over sediment to expose four fossil pieces; the completed fossil collects itself.            |
| 64    | 379–384 | **Glowshroom grotto:** match on or beside mushrooms to light them permanently, using the established lantern rules. |
| 65    | 385–390 | **Root-bound vault:** match beside a visible knot to cut it and release its connected vines.                        |
| 66    | 391–396 | **Underground reservoir:** clear below pearls to drop them into glowing baskets, using relic delivery.              |
| 67    | 397–402 | **Geothermal forge:** fill four or five brazier pips with nearby matches to receive free bombs, using charge cores. |

The two new rules begin on open, modest boards. A fossil consists of a visible
2 × 2 footprint with one or two sediment layers per piece. Matching or a bonus
clears those layers using the normal floor rules. Exposed pieces stay exposed;
revealing the fourth piece collects the group automatically. No tapping or
separate collection action is required.

A root knot is a stone-like target surrounded by short, visible cardinal vines.
Match beside the knot, or hit it directly with a bonus. The first knot takes one
hit; later thick knots take two. Cutting a knot releases every remaining vine
linked to it at once. Matching a bound gem still breaks its individual vine, so
the player can make progress from either approach. Knots and their vines never
cross or require following a hidden route.

Each chapter follows introduction, practice, exploration, stretch, rest and
finale. The fifth puzzle offers an open breather; the sixth combines the theme
with one familiar mechanic. Later boards use staggered or reinforced shelves,
multiple discoveries and deliberate bonus placement to increase difficulty.
They never mix more than two featured mechanics. Side columns stay free of
solid targets, the bottom two rows stay clear of obstacle layers, and ordinary
floor layers never exceed two.

## Shared implementation

`src/data/deepMineLevels.js` owns the five chapter definitions, thirty layouts,
names and tips. Its parser translates fossil and root symbols into the shared
expansion spec. Fossils must form four-piece squares; every root binding must
touch its knot directly. Malformed footprints fail during authoring rather
than becoming confusing player objectives.

`DeepMineMechanics.js` uses the existing tile health, blockers and chains.
The generator reserves knot cells before building the board and keeps random
ice off fossil sediment. Fossil collection and group root releases run in the
shared resolution lifecycle, including normal matches, cascades and powers.
The original clear-layers objective remains the completion gate; display
counters derive from those layers and add no separately saved state.

The town's canopy and riverlight eras use independent building-completion
gates. Puzzle themes do not modify town mine surface profiles, create a saved
resource, or change the reward contract. The campaign content remains exactly
five groups, 373–402, regardless of the town's current era.

## Verification and calibration

`testing/deep-mine-levels.test.js` preserves the first 372 generated configs,
names, chapters and star targets through a captured hash. It checks all thirty
authored layouts, visible links, mechanic combinations, chapter pacing and
normal completions on held-out refill seeds. Store-level playthroughs complete
the new mechanics after more than 100 recorded moves and after the optional
speed target has elapsed.

All local checks run in Docker as required by `AGENTS.md`. The existing
`scripts/measure-campaign.mjs` measures normal, hint-led play without inventory
powers or score farming. Star calibration uses thirty refill seeds, the shared
scoring rules and the existing 55th-percentile algorithm. The calibration
script accepts an optional inclusive level range so the thirty new targets can
be appended while preserving all 372 previous targets:

Thirty measured refill seeds per new puzzle produced 900 complete runs with
no inventory powers and no required reshuffles. The median was 22 matches and
the 90th percentile was 36, compared with 21 and 35 for the preceding twelve
levels measured on the same thirty seeds. Excluding the two new-rule tutorials
and chapter breathers, the new puzzles had a median of 24 matches. The longest
sampled run took 71 matches; players remain free to take as many as they need.

| Group                 | Median matches | 90th percentile | Rest median | Finale median |
| --------------------- | -------------: | --------------: | ----------: | ------------: |
| Fossil beds           |             20 |              30 |          17 |            22 |
| Glowshroom grotto     |             21 |              34 |          17 |            23 |
| Root-bound vault      |             21 |              34 |          16 |            28 |
| Underground reservoir |             26 |              41 |          18 |            27 |
| Geothermal forge      |             21 |              31 |          14 |            27 |

The first fossil puzzle took a median of 12 matches; the first root puzzle took 10. These lighter lessons account for part of the chapter medians, while the
reservoir's multi-lane delivery provides the largest sustained difficulty step.
The independent regression samples ten held-out refill seeds (101–110) per
new puzzle and requires every sampled puzzle to finish. Chapter rests must
remain lighter than their finales, and ordinary new puzzles must have a higher
median than the preceding twelve levels on those same held-out seeds.

Reproduce the calibration with:

```sh
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/app -w /app node:24-bookworm-slim \
  node scripts/measure-campaign.mjs . 30 402 \
  373,374,375,376,377,378,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,396,397,398,399,400,401,402 \
  > /tmp/deep-mine-scores.json

docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/app -v /tmp/deep-mine-scores.json:/tmp/scores.json:ro \
  -w /app node:24-bookworm-slim \
  node scripts/calibrate-star-targets.mjs /tmp/scores.json 373 402
```

These repeatable simulations provide balancing evidence, not a prediction of
human completion times. Their finite diagnostic budgets never become gameplay
move or time limits.

## In-game visuals and browser checks

![All five implemented groups](images/deep-mines/final-overview.png)

[Open the review gallery](images/deep-mines/gallery.html) or
[watch the recorded gameplay tour](images/deep-mines/deep-mine-tour.mp4).
The MP4 shows all five chapters in the running game, including fossil
uncovering, a mushroom lighting, the root knot releasing its four vines,
a pearl falling toward its basket and braziers gaining charge. It ends with
the mobile board. Chapter labels are recording captions; chapter selection
uses the existing local debug fixture. The game and its matching animations
are the implemented result.

These screenshots show the implemented game, including the existing gem art,
new obstacle sprites and chapter scenery. Each link opens the full image.

| Theme                 | Actual game view                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fossil beds           | [Desktop](images/deep-mines/fossil-desktop.png), [three pieces uncovered by one swap](images/deep-mines/fossil-uncover-desktop.png), [mobile](images/deep-mines/fossil-mobile.png) |
| Glowshroom grotto     | [Desktop](images/deep-mines/grotto-desktop.png), [mobile](images/deep-mines/grotto-mobile.png)                                                                                     |
| Root-bound vault      | [Visible knot and vines](images/deep-mines/roots-mobile.png), [all vines released after one adjacent match](images/deep-mines/roots-cut-mobile.png)                                |
| Underground reservoir | [Pearl and basket on mobile](images/deep-mines/reservoir-mobile.png)                                                                                                               |
| Geothermal forge      | [French, high-contrast mobile board](images/deep-mines/forge-fr-mobile.png), [French illustrated guide](images/deep-mines/forge-guide-fr-mobile.png)                               |

The T3 collaborative browser checked the game at 1280 × 800 and 390 × 844.
All five chapter boards fit the mobile viewport with no horizontal overflow.
The 7 × 9 mobile board has approximately 51-pixel cells. New-rule introductions
describe the same matching controls as the rest of the campaign; the reusable
guide scrolls within the phone viewport, including the longer French text.
High contrast and reduced motion remain compatible with the new sprites.

Actual keyboard input on level 373 uncovered three fossil pieces in one swap;
the pieces stayed exposed after refill. On level 385, an adjacent match cut
the knot, released all four bindings and removed the visible root links after
the resolution finished. The inspected game views produced no console errors
or failed asset requests. Debug chapter selection seeded a local test town;
it did not change an existing player profile or cloud save.
