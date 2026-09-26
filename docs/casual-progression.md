# Casual progression and village life — 8 September 2026

> Historical review of the earlier 72-level checkout. The merged Electric era and fourth-era extension are covered in the [current Motor Age progression review](motor-age-progression.md). Measurements below describe that earlier build.

The intended loop is a relaxed puzzle, a visible reward, and a useful next step in the village. Players should feel successful when they take their time or ignore score targets; the shared implementation contracts are documented in [the era architecture guide](era-architecture.md).

## Reward cadence

| Moment                                                      | What the player receives or sees                                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Every completed normal puzzle                               | At least one chest, plus the existing mining coins and construction progress. A slow, low-score finish gets a completion chest.                 |
| A qualifying score or time                                  | The existing score/speed chest replaces the completion fallback. Both qualifications still give two openings; the guarantee never adds a third. |
| Every six new levels                                        | A direct chapter gift beside the mine's visual upgrade. TNT, Color Wand, Clear Row and Tile Breaker rotate across twelve chapters.              |
| Between chapter gifts                                       | Six visible stamps and a picture of the next bonus in the village and results.                                                                  |
| Enough coins, an available hammer, or finished construction | The results screen highlights returning to build or finish buildings.                                                                           |
| Blacksmith production                                       | One stored TNT after 6 normal puzzles at level 1, improving to 5, 4, 3 and 2 at levels 2–5. Collecting it starts the next cycle.                |

Automatic chest awards skip items that cannot fit, including space already reserved for unopened prizes. Among power drops, the distribution is now Clear Row 30%, TNT 25%, Color Wand 20%, Shuffle 10%, Tile Breaker 15%. When every item fits, the overall distribution remains 70% powers, 20% coins and 10% builder hammers. The existing ten-roll hammer guarantee remains while hammer storage has room.

Manual reel stops still award the displayed item, with ordinary overflow converted to coins. A full chapter-gift slot instead gives 100 coins per chapter. Chapter gifts are awarded once, saved with campaign progress, and do not repeat on replay. Reloading settles unopened automatic prizes exactly once. Existing blacksmith progress from the longer production cycle becomes a ready TNT when sufficient; it is not discarded.

## Visible success and gentle challenge

Coins, earned supplies and a completion seal lead the results. Detailed coin calculations, stars, score, time and moves are available in disclosures. Failed score/speed targets and empty stars no longer lead the finish screen. The phone header previews a chest reward; time remains available in expanded details and in continuous mode.

The mine layouts, unlimited moves, free dead-board shuffles, obstacle illustrations, chapter gem finishes and tuned difficulty curve from the earlier review remain. That review measured 2,160 complete engine runs across all 72 levels: an opening median of 9 moves and later chapter medians of 17–22 moves, with easier breaks between harder layouts. This pass changes rewards and presentation rather than adding more obstacles.

Bandits keep their visual arrival warning, sheriff/bank coverage, and small bounded consequences. They cannot damage buildings, raid offline, take the last 50 coins, or take more than 30 coins or 10% of savings. Protection remains a useful village upgrade without threatening a player's earned progress.

## Life follows development

The farm gains three hens that wander and peck. A home brings a dog that walks, rests and wags its tail. A neighbor carries a bucket between the home and well. Once the square has at least six residents, two neighbors chat there. Chimney smoke rises from the home, saloon and blacksmith.

These routines use the existing diorama clock and shared geometry. Actor counts are bounded and animation does not create objects each frame or change saved town state. Paused, hidden and reduced-motion views stop the same clock. Reduced motion starts from a valid static pose. The SVG fallback also gains hens and a dog, with its animations paused by the existing controls.

## Verification and evidence

`npm run verify` passes: formatting, **534 tests in 44 files**, and the production build. Vite retains its existing large Phaser chunk warning.

- Automated coverage includes a slow low-score win, one/two-chest limits, reload recovery, all 72 completions and twelve one-time chapter gifts, full inventory and pending reservations, shorter forge cycles and legacy progress, and bounded village actors.
- Real Chromium checks at `http://127.0.0.1:5173` covered 1440 × 900, 390 × 844 and 320 × 568, in English and French.
- A real pointer-swipe playthrough finished level 6 in nine moves, opened its two earned chests, and stored its chapter TNT. Synthetic slow-finish states separately verified the single completion chest and affordable-building action; those fixtures are not human difficulty measurements.
- French reward and village panels fit at 320 pixels without horizontal overflow. Reward details start collapsed; primary actions remain visible.
- Live actor positions changed across animation frames. Reduced motion stopped the diorama clock. A forced SVG fallback rendered three hens and one dog, with CSS animation switching from running to paused.
- The normal browser flows finished with zero unhandled page errors and zero failed HTTP responses. The deliberate WebGL-disabled fallback was checked separately.

![French results with an earned bonus and village action](images/casual-results-french-small.png)

![French village guidance and chapter stamps on a small phone](images/casual-village-french-small.png)

![Inhabited village with daily routines](images/casual-village-life.png)

## Remaining content limit

The two available village eras are finite and can finish before level 72, especially with chest coins and hammers. Chapter gifts continue through the final mine chapter; the museum, shop, saloon and forge remain usable. Extending meaningful construction for longer-term returning players still requires additional village content. The earlier economy measurements deliberately excluded chest rewards and are not a forecast of the faster reward-rich path.

This review verifies mechanics, layouts and reward delivery. Whether the cadence feels satisfying to the intended casual audience, and whether people return, still needs observation with those players.
