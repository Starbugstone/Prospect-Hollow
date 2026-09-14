# Develop performance and stability review — 13 September 2026

`git pull --ff-only origin Develop` confirmed that the checkout was already current at `57a6d38`. The working tree already contained a plot cache in `TownDiorama`, incremental static batches in `TownStatics`, and their regression tests. Those changes were preserved and reviewed alongside the recent Motor Age, progression, mobile presentation and save-transfer implementations.

## Changes reviewed and made

The existing plot cache retains unchanged building geometry, sign textures and articulated windmills. Construction completion adds only the completed plot to the static batch. Its tests now use the actual town geometry factory instead of substituting a box for every shape. Additional cases cover all four eras, unchanged model identity, replacement with a fresh town, finite render buffers and disposal. Existing cases cover interrupted construction, label changes, chapter art, modernization and windmill ownership.

The completed implementation also retains roads, the mine forecourt, lamps, the power grid and railroad. `TownScenery` invalidates them from their actual dependencies: route access, built parcels, road tier, paving and electricity. Railroad scenery is built separately from animated trains. `TownStatics.sync` retains one GPU batch per immutable static root, replacing only changed or removed roots. Tests cover infrastructure unlocks, construction cycles in every era, buffer identity, bounded batch counts and disposal.

Shared primitive geometry is now indexed once before buildings copy it. Previously, static batching repeatedly welded large transformed geometry buffers. The power grid also builds its route graph once and uses the shared `routeOnGraph` resolver for its connections. The existing `routeBetween` API delegates to that resolver.

Targeted and one-time powers now share their resolution, scoring, animation and cleanup implementation. Starting and leaving a mine share run-presentation cleanup. Direct one-time power activation now respects the input-pause guard; regression tests cover that guard and cancellation across a session change.

## Automated verification

- `npm run verify`: formatting, **901 tests in 53 files**, and production build pass.
- `node scripts/measure-campaign.mjs . 30`: **4,320 successful completions**, covering 30 seeds for each of 144 levels. Maximum: 70 moves and one automatic reshuffle. This is a deterministic hint-driven engine simulation, not a manual playthrough of every level.
- `npx jscpd src --min-lines 10 --min-tokens 80`: the initial scan found two duplicated blocks (34 lines) in `gameStore.js`; the final scan found **zero**. This threshold-based check does not prove the absence of shorter or semantic duplication.
- `git diff --check`: passes.

## Performance samples

The actual construction state transitions were measured in local Chromium with five cycles per era: purchase an upgrade, settle its reveal, advance its construction to ready, finish the building, and settle the final reveal. Drawing was suppressed to isolate CPU scene-update work. The baseline included the supplied uncommitted plot cache and the first review's indexed primitives and route-graph optimization; the final measurement adds retained infrastructure and GPU batches.

| Completed era | Start upgrade, before → after | Finish building, before → after |
| ------------- | ----------------------------: | ------------------------------: |
| Frontier      |                 42.9 → 9.5 ms |                  41.6 → 11.2 ms |
| River & Rail  |               133.0 → 17.5 ms |                 126.6 → 18.5 ms |
| Industrial    |               140.0 → 12.1 ms |                 134.1 → 13.4 ms |
| Motor Age     |               163.9 → 16.2 ms |                 160.2 → 15.3 ms |

These are medians of small local samples, with approximately 73–91% less CPU scene-update time. The separate end-of-animation settle operation remains: final medians ranged from 6.2 to 22.3 ms across the scenarios. It did not improve consistently in every era; the large improvement is in building updates that previously rebuilt all shared scenery.

A real Motor Age button-driven construction flow, including rendering and reactive application state, measured approximately 40 ms for the start update and 35 ms for the completion update. Its end-of-animation settle calls took approximately 24 and 51 ms. The house reached level 3, its coin purchase was deducted once, and all unrelated scenery buffers retained their identities. The ready receipt was advanced by the browser fixture rather than playing two puzzles in this particular check.

The intentional one-second assembly animation is preserved. Initial scene creation and genuinely new infrastructure still require model preparation. Retaining per-root batches trades more static draw calls on camera/cache refresh for much less work on building changes; the Motor Age fixture has 43 static batches, bounded by its 38 visible plots including the mine and five infrastructure groups. Moving actors continue to use the existing instanced renderer and cached scenery frame. These measurements are not device-independent frame-rate guarantees.

The production build retains warnings for the main bundle and the lazy-loaded Phaser bundle exceeding 500 kB; changing warning thresholds would not reduce their cost.

## Browser verification

The app was served at `http://127.0.0.1:5173`. The configured MCP Chrome executable was unavailable; the installed Chromium runtime was used through Playwright CLI in a disposable browser session.

All four completed-era fixtures rendered at **1440 × 900**, **390 × 844**, and **320 × 568**, without horizontal document overflow, lost graphics contexts, application errors or failed HTTP responses. Screenshots were inspected for desktop and mobile presentation. Save export downloaded valid JSON, malformed import showed an error, and confirmed import restored the exported progress. The passive-income clock timestamp was excluded from the round-trip comparison because the running town advances it normally.

Six mine/village round trips retained the same town canvas, released every departed mine WebGL context, and returned to one canvas each time. Town renderer resource counts stayed at 90 geometries and 38 textures throughout; no application errors or failed HTTP responses were recorded. A deliberately lost town WebGL context recovered on a fresh canvas with the camera pose, era and wallet preserved.

Detailed command output, generated fixtures, browser scripts and screenshots are kept in the ignored `output/` directory. Native Capacitor platforms, Safari, Firefox and physical low-end devices were not exercised in this workspace.
