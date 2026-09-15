# Develop review — 14 September 2026

Reviewed the application, town rendering, mining engine and renderer lifecycle, tests, and Blender authoring scripts from `4a860a7`. Changes focus on measured per-frame costs, obsolete code paths, and coverage missing the newer eras.

## Rendering and animation

- Event cameras now finish their approach exactly and retain the scenery cache while holding still. Moving responders, changed targets, portrait framing, and the return to the player's camera still invalidate the view. Terrain clearance is recalculated when the destination changes. Reduced-motion restoration also invalidates the cache.
- The offscreen framebuffer is validated when allocated or resized. Camera movement no longer forces a synchronous GPU framebuffer-status query on every frame.
- Adaptive resolution now responds to sustained 200–999 ms frames. It still ignores long suspension gaps and isolated stalls, and never raises a low-density device above its maximum ratio while trying to reduce load.
- Bus, incident, and mounted-raid paths compile their lengths and headings when created. Raid approach speeds and escape/escort routes no longer allocate arrays and recalculate distances every animation tick.
- Instanced actor colors use numeric storage instead of creating RGB strings every frame. Hiding and restoring actors, changing shared materials, and articulated transforms retain regression coverage. Aircraft propeller joints are resolved once; invisible aircraft skip transform updates.

In local Chromium, a stationary incident shot invalidated the scenery cache on **240/240** sampled frames between simulation seconds 12 and 16 before the change, and **0/240** afterward. The completed Connected City fixture submits **192 draw calls / 389,628 triangles** on a scenery refresh versus **77 calls / 45,430 triangles** on a cached frame. Holding the shot therefore avoids about **88% of submitted triangles** in that scenario. This is a rendering-work reduction, not an 88% frame-rate claim.

A CPU-only sample of 160 updates in that fixture measured actor instancing at approximately **0.2 → 0.1 ms median**, and all actor/motion work at approximately **0.2 ms median** in both runs. These small timings are quantized and should be treated as indicative. The larger bottleneck was unnecessary scenery rendering. The browser uses software WebGL; physical mobile GPU performance still needs device measurement.

## Cleanup and test maintenance

The three Blender packs now share `scripts/blender_assets.py` for primitives, materials, joints, indexing, and mesh export. Their independent palettes remain explicit. `--meshes-only` supports isolated export checks without rewriting the artist's `.blend`, interchange files, or review images. Exported positions, materials, joints, model IDs, and triangle counts were compared with the committed packs. City and future geometry match; leisure has only a maximum 0.00001 normal-rounding difference. The committed runtime art is unchanged.

Removed the obsolete raid-specific overview-framing branch, the duplicated path-length routine, unused imports, and unused public exports of internal helpers/constants. Repository links now point to Prospect Hollow. CLI authoring/measurement tools, the Phaser test shim, and Capacitor's native runtime were explicitly retained after reviewing static-analysis reports.

City presentation checks now use the shared era definition, including Aviation and Broadcast. Plot-cache lifecycle tests cover all eight eras, modernization service-preservation tests cover all four city eras, and raid timeline tests use the speed constant. New regression checks cover stationary cameras, framebuffer allocation, very slow frames, low pixel ratios, route boundaries, and packed instance colors.

The clone scan (`jscpd`, minimum 10 lines / 80 tokens) reduced five Python findings covering 310 reported duplicated lines to two shared import/CLI-header findings. No JavaScript or Vue clones were reported at that threshold. Knip reports no unused files, dependencies, or exports with the documented CLI/test entry points and Capacitor runtime accounted for; ESLint's unused-variable scan reports no unused JavaScript declarations. These static scans do not prove the absence of semantic duplication or every possible dead branch.

## Verification

- `npm run verify`: formatting, **1,102 tests in 61 files**, and production build pass.
- `node scripts/measure-campaign.mjs . 5`: **1,200 successful completions** across all 240 levels and five seeds; maximum 78 moves, no reshuffles. This is a deterministic hint-driven engine simulation.
- `git diff --check`: passes.

Browser verification used local Chromium at `http://127.0.0.1:5174` with **1440 × 900** and **390 × 844** viewports. Completed Aviation, Broadcast, and Connected City scenes rendered without overflow or lost contexts. Desktop and mobile screenshots were inspected. Three mine/village round trips each resolved a legal move after closing the tutorial through the UI, and returned to one canvas. After visiting the three eras, town resource counts stayed at **210 geometries / 58 textures** across all three returns. The live workshop-fire event completed and restored camera controls; **62 of 65** sampled held-shot frames reused cached scenery. No application errors, failed requests, or HTTP errors were recorded in these final checks. Earlier harness attempts were corrected to exit fullscreen before using header navigation and dismiss the mine guide before moving.

A separate local Node sample generated all 240 levels in approximately **162 ms**, with hint searches at **0.71 ms median / 1.21 ms p95**. Generation is guarded to run once per store. No engine-loop rewrite was warranted by that sample; the full campaign simulation and live move checks cover mining behavior. Detailed scripts, measurements, exports, and screenshots remain in the ignored `output/review/` directory.

The production build still warns about large main, Phaser, and diorama chunks. This review does not claim to eliminate download/parse costs or guarantee 60 FPS on every device.
