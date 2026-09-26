# A gentler descent into the mine

For the current four-era, 144-level campaign, see the [Motor Age progression review](motor-age-progression.md). The measurements below document the earlier 60-level tuning pass.

The campaign keeps all 60 level IDs and existing saves. The opening board still measures 6 × 7, but now uses four jewel types. Its 32 single-layer ice targets are tuned for a complete introductory puzzle: the easiest levels should typically take 8–10 moves, then grow gradually. Players have no move limit; score and active time award optional chests. New obstacle introductions pause the clock.

Each six-level chapter owns its dimensions and active jewel count. The count increases to five only when the board grows at level 13. It stays at five when the board grows again at 37: the extra room supports learning chains, seals and relic delivery. Jewel identities rotate every two levels, using different subsets of the existing six silhouettes. Opening boards, ordinary cascades, power refills and shuffle cascades all use the same explicit palette. Ruby, sapphire and emerald remain available wherever their seals appear.

| Levels | Chamber               | Board | Jewel types | Focus                                                |
| ------ | --------------------- | ----- | ----------- | ---------------------------------------------------- |
| 1–6    | Lantern-lit entrance  | 6 × 7 | 4           | Single-layer ice seams; 8–10 typical moves           |
| 7–12   | Mossy stone gardens   | 6 × 7 | 4           | One stone first, then small shelves and arches       |
| 13–18  | Blue frost gallery    | 7 × 8 | 5           | Larger board with small patches of double ice        |
| 19–24  | Amber vault           | 7 × 8 | 5           | A few reinforced stones; open side approaches        |
| 25–30  | Violet crystal seams  | 7 × 8 | 5           | Twin pockets, ribbons and winding passages           |
| 31–36  | Moonlit cavern        | 7 × 8 | 5           | Previously unused frozen gems: thaw from beside them |
| 37–42  | Teal depths           | 7 × 9 | 5           | Staggered shelves and connected stone chambers       |
| 43–48  | Copper chain forge    | 7 × 9 | 5           | Chains, then light combinations with stone           |
| 49–54  | Opal lock chamber     | 7 × 9 | 5           | One seal color first, then combinations              |
| 55–60  | Ancient relic chamber | 7 × 9 | 5           | Delivery routes with clear bottom exits              |

## Pacing and layout changes

The six-puzzle rhythm is introduction, practice, exploration, stretch, rest, finale. Every fifth puzzle has fewer layers and a lower score target than the fourth; every chapter starts with fewer layers than the previous finale. These are workload targets, not a promise that every random run takes more or fewer moves than its neighbor.

Ice and stone follow pockets, ribbons, twins, steps, pools and arches. Early boards have enough single-layer ice to last through several matches and bonuses. The first twelve levels avoid double layers and start with at least six legal moves. Authored opening seeds are checked against 30 different refill sequences, avoiding openings that routinely clear most targets in one bonus chain. Later boards start with at least three. Side columns stay free of stone. Ice never exceeds two layers. Later boards keep the four corners clear and build some depth along central seams; delivery boards also leave exits and initial relic positions free of ice. The final relic route places treasures together with open approaches, removing a long-tail outlier found in simulation.

Score targets follow workload rather than increasing for every level. The first level's target is 7,500 points. Levels 1–36 use 90 seconds plus two seconds per layer for speed rewards, beginning at 2:34. Later puzzles allow 75 seconds plus one second per layer and 20 seconds per relic. Neither score nor time is required for completion.

The ten backgrounds use lightweight vector scenery: rock faces, timber supports, lanterns, mineral clusters and rails. Chapter-specific vines, frost, veins, chains and carvings distinguish the chambers. Decorative art ignores pointer events and assistive technology. A dark center preserves board and text contrast; high-contrast mode dims the scenery further. The existing announcement space now previews the current jewel set without reducing board space.

## Inspiration and next mechanics to prototype

The following official sources informed the mechanic ideas, accessed 6 September 2026. Their mechanics are references; the pacing values above are design choices for Crystal Cascade, measured against its own engine.

- [Candy Crush's game modes](https://candycrush.zendesk.com/hc/en-us/articles/360000754897-Which-game-modes-will-I-find) alternate clearing, collection, delivery and route goals. This supports giving chapters a different task, while retaining familiar matching controls.
- [Royal Match's light bulb](https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/378-light-bulb/) responds to adjacent colored matches. It suggests mine fixtures with a clear, local interaction.
- [Gardenscapes' fireflies](https://playrix.helpshift.com/hc/en/5-gardenscapes/faq/964-fireflies/) emerge from containers one at a time through nearby matches or power-ups. It suggests visible staged progress without covering the entire board in ice.

The frozen-gem introduction and revised layouts are implemented in this PR. These additional mechanics are proposals for a later pass:

| Proposed mine mechanic | Interaction                                                        | First layout                                         | Pacing guardrail                                              |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------- |
| Lantern trail          | Adjacent matches light fixed lantern tiles; each stays lit         | Three lamps along a central trail                    | One-hit lamps, no spreading darkness or timer                 |
| Geode cache            | Two adjacent matches crack a geode and reveal a board bonus        | One geode between two open ice pockets               | Visible cracks; teach it without chains or seals              |
| Ore orders             | Collect a small count of a pictured jewel from the current palette | An open chamber with one requested jewel             | Never request an absent color; introduce one order at a time  |
| Mine-cart delivery     | Existing relic-style gravity brings ore to a marked cart exit      | Two open vertical shafts joined by a wide middle row | No sideways-only or sealed exits; two carts before three      |
| Survey trail           | Clear frost along a marked winding seam to uncover a map           | A short central zigzag, then twin branches           | Fixed board dimensions; no isolated corners or moving targets |

Prioritize lanterns and geodes for visual feedback, then ore orders for a distinct goal. Moving carts/conveyors, spreading hazards, timed bombs and multi-stage gates should wait until the relaxed campaign has been tested with new players. Introduce one new rule at a time with a small objective and an open board.

## Comparison with Candy Crush and similar games

| Reference                                                                                                             | Documented design                                                                                          | Application here                                                                                    |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [Candy Crush Saga](https://candycrush.zendesk.com/hc/en-us/articles/360000754897-Which-game-modes-will-I-find)        | Clearing jelly, collecting orders, delivering dragons, opening routes and mixed goals                      | Alternate clear, thaw, unlock and delivery tasks; add ore orders or lantern trails in a future pass |
| [Royal Match](https://dreamgames.helpshift.com/hc/en/3-royal-match/faq/4-how-can-i-play-the-levels/)                  | Explicit targets, a limited move allowance, and power-up combinations; running out of moves causes failure | Keep visible targets and useful combinations; measure how many moves completion actually takes      |
| [Gardenscapes](https://playrix.helpshift.com/hc/en/5-gardenscapes/faq/15571-about-the-game-how-to-play-gardenscapes/) | Match-3 goals award progress toward a persistent garden; coins support boosters and extra moves            | Make a mining puzzle feel like a satisfying step toward the village, with clear completion feedback |

King designer Jeremy Kang's [2017 conference presentation](https://speakerdeck.com/wnconf/jeremy-kang-king) discusses 3–5-minute game rounds, clear goals and low cognitive load. That is historical design context, not a measurement of today's tutorial levels or a recommendation to force a fixed duration. [King also documents past move-count revisions](https://community.king.com/en/candy-crush-saga/discussion/comment/274782), so old walkthroughs are not a reliable current numerical baseline.

An allowed move count is not the number of moves used to win. These sources do not establish a universal 8–10-move completion standard. That range is the requested target for Crystal Cascade's easiest puzzles. This campaign retains unlimited moves and optional score/time chests; it adopts the goal variety and readable progression of its peers. A lucky cascade can finish early—there is no artificial minimum-turn gate.

## Measured playthroughs

`node scripts/measure-campaign.mjs [checkout-path] [seed-count] [level-count] [comma-separated-level-ids]` follows the existing hint engine, using earned board bonuses and free dead-board shuffles, with no inventory powers. With no seed count, it uses the established seeds 1, 19 and 73. Run `node scripts/measure-campaign.mjs . 30` for the broader 1,800-game sample below (30 refill seeds per level).

| Chapter | Median moves | 90th percentile | Longest sampled run |
| ------- | -----------: | --------------: | ------------------: |
| 1       |            9 |              13 |                  20 |
| 2       |           10 |              14 |                  29 |
| 3       |           13 |              23 |                  43 |
| 4       |           13 |              26 |                  49 |
| 5       |           16 |              26 |                  51 |
| 6       |           16 |              29 |                  76 |
| 7       |           18 |              28 |                  99 |
| 8       |           20 |              32 |                  57 |
| 9       |           21 |              36 |                  62 |
| 10      |           21 |              36 |                  75 |

The first six individual level medians are **8, 10, 8, 9, 10 and 9.5 moves**. Chapter 2's individual medians range from 9 to 11.5; the final six are 18, 18, 20.5, 24, 22.5 and 28. Every level's median is at least eight. Rest puzzles lower obstacle workload, although cascades mean their move counts can overlap their neighbors.

All 1,800 runs finish. The first twelve levels require no dead-board shuffles in this sample. The like-for-like three-seed comparison with main commit `0624ee1` reduces chapter 1 from a 21-move median to 10 while removing its previous 90-move outlier. The larger sample is used to check that the introductory puzzles are neither instant clears nor long grinds.

Regression tests use 30 seeds for each of the first twelve levels, checking both a lower and upper median bound (8–10 for chapter 1; 9–13 for chapter 2). The remaining levels retain the three established seeds with a 60-move upper bound. Tests also cover palette preservation, staged obstacles, legal openings, translations and save compatibility.

These are hint-led simulations, not human completion rates or universal upper bounds. Some later runs still take substantially longer than the median, including a 99-move outlier. The game remains completable without a move limit. New-player testing should measure time to first match, hint use, retries, optional chest attainment and chapter transitions before further difficulty changes.

## Browser verification

Verified at `http://127.0.0.1:5174` in Chromium: all ten chapter themes, a full level using real pointer swipes, the paused obstacle introduction, chapter changes, and the selected jewel previews. Desktop checks used 1440 × 900; phone checks used 390 × 844, 320 × 568 and 844 × 390. The board and power controls fit in the viewport, with no horizontal overflow. Focus mode, French text, the French obstacle guide, reduced motion and high-contrast mode were exercised. No application exceptions, failed requests or HTTP error responses were recorded during the main browser run.

![Frost gallery on desktop](images/mine-frost-desktop.jpg)

![Four-color opening on mobile](images/mine-first-light-mobile.png)
