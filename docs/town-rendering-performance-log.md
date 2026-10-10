# Town rendering performance log

Record of the mobile town rendering work started from
[issue #54](https://github.com/Starbugstone/Prospect-Hollow/issues/54) (September 2026). Each entry
lists what changed, where, and how to revert it. None of these changes affect gameplay, rewards or
the unlimited-moves rule; they only change how the 3D town prepares and draws the same scene.

## Reverting

Each batch is one commit on `preprod`. To undo a whole batch:

```sh
git revert <commit>
```

Revert newer batches first if both need to go, because Batch A builds on the profiler added in
commit `3605833`. The per-change notes below name the functions involved, for undoing one change by
hand while keeping the rest.

## Commit `3605833`: construction stutter (issue #54)

| Change                                     | Where                                                                                                                  | Effect / revert note                                                                                                                                                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build a layout-changing reveal once        | `TownDiorama.changeTown()`, `update(…, prepared)`, `discardPendingUpdate()`                                            | The site-check building (`prepared`) uses catalog footprints (`plotFootprints()`) and is adopted by the full rebuild instead of being built twice. Revert: call `geometryFootprints(probe)`, `clearGroup(probe)` and drop `prepared`. |
| Interruptible completion settlement        | `TownDiorama.batchWork()`, `finishConstruction()` `settle()`                                                           | Batching yields per mesh/material; statics, animals and actors run in separate scheduler slices.                                                                                                                                      |
| Incremental static batching                | `TownStatics.syncWork()`, `prepare()`, `commit()`, `place()`                                                           | Batch preparation is read-only and yields per mesh; the scene changes only at commit.                                                                                                                                                 |
| No duplicate completion render during drag | `finishConstruction()`                                                                                                 | Skips the immediate `render()` when a camera frame is already pending.                                                                                                                                                                |
| Cache MSAA follows the render tier         | `TownRenderQuality.cacheSamples` (getter), `TownFrameCache.setSamples()`, `tick()`                                     | A tier demotion also lowers the offscreen sample count.                                                                                                                                                                               |
| Part keys serialized once                  | `constructionParts(group, keys)`, `TownConstruction(…, keys)`                                                          | Optional `keys` map; omitting it restores the old double serialization.                                                                                                                                                               |
| Narrower scenery invalidation              | `TownScenery.update()`                                                                                                 | Roads follow built plots only at road level 2+; power follows them only with overhead wires. `update()` now returns the rebuilt entry ids.                                                                                            |
| Fresh scenery on the incremental path      | `TownDiorama.refreshScenery()`, `tryActivatePlot()`; `sceneryObstacles()` and `navigationOwner` in `TownNavigation.js` | A first opening refreshes changed roads/power, their navigation obstacles (owner `scenery:<id>`) and service drops immediately. Previously they stayed stale until a later full rebuild.                                              |
| Construction timings                       | `src/game/town/TownProfiler.js`, `prospectDebug.townTimings()`                                                         | Bounded, production-safe phase timings and browser long tasks.                                                                                                                                                                        |

Tests: `testing/town-construction-stutter.test.js`.

## Batch A commit `190bb66`: steady-frame and swap hotspots

Found with a headless-Chromium profile of a fully upgraded industrial town (phone viewport, 4× CPU
slowdown). See "Measurements" below.

| Change                                 | Where                                                                                                                                                                                      | Effect / revert note                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1. Freeze static matrices             | `freezeStatic()` in `TownStatics.js`, called from `TownStatics.place()`                                                                                                                    | Batched static roots (plots, scenery, landscape, service drops) stop recomposing matrices on every render. Animated subtrees are skipped and keep updating. Anything that later moves a batched static root must re-enable `matrixAutoUpdate`/`matrixWorldAutoUpdate` (nothing does today). Revert: remove the `roots.forEach(freezeStatic)` line. |
| A2. Incremental navigation index       | `TownNavigation.replaceOwner()`, `index()`, `unindex()`, `forgetDetours()`, `detour()` `remember()`                                                                                        | Only the changed owner's cells are re-indexed (numeric cell keys). Cached detours are dropped only if their search area overlaps a changed footprint. Re-registering identical footprints (a reveal completing) updates labels in place without a revision change. `reindex()` still does a full rebuild.                                          |
| A3a. Cached service-drop preparation   | `TownStatics.pieces`, `prepare()`, `prunePieces()`; `userData.staticContainer` in `addServiceDrops()`                                                                                      | The drop container keeps one batch, but each drop's prepared geometry is cached, so a swap only prepares the changed drop before merging. Revert: remove `staticContainer` from `addServiceDrops()`.                                                                                                                                               |
| A3b. Bounded wire probing              | `withSurfaces()`, `surface()` in `TownEvolution.js`                                                                                                                                        | Double-sided materials are set once per building, and wire sections outside the building's bounds skip ray casts. Results are identical.                                                                                                                                                                                                           |
| A4. Labels move without Vue re-renders | `src/game/town/TownLabels.js`; `TownScene.vue` (`anchors` is a `shallowRef`, `labelElements`, `actionElements`)                                                                            | Camera frames write `left`/`top` directly. Vue re-renders only when a label's or action icon's visibility changes. Revert: make `anchors` a `ref` and assign `anchors.value = positions` in the label callback.                                                                                                                                    |
| A4b. VIP name-tag updates              | `drawCameraInset()` in `TownInset.js`                                                                                                                                                      | The inset overlay is re-emitted only when the name tag moves by at least 0.5%.                                                                                                                                                                                                                                                                     |
| A5. Phone-readable frame statistics    | `townFrameStats()` and frame hooks in `TownProfiler.js`; hooks in `TownDiorama.tick()`/`render()`/`projectLabels()`, `TownFrameCache.render()`, `TownActors.update()`, `drawCameraInset()` | `await prospectDebug.townFrameStats(5)` reports per-phase milliseconds, draw calls, triangles, frame intervals, long tasks and render settings. Hooks cost one check when not collecting.                                                                                                                                                          |

Tests: `testing/town-render-hotspots.test.js`.

## Measurements

Headless Chromium draws WebGL on the CPU (SwiftShader) and the profile used a 4× CPU slowdown on a
dev build, so frame rate and GPU cost are not representative. Treat the milliseconds as relative.
Consecutive runs varied by roughly 10–20%.

| Scenario (industrial town, 4× slowdown) | Before  | After   |
| --------------------------------------- | ------- | ------- |
| Foreground render, camera drag (mean)   | 7.0 ms  | 5.8 ms  |
| Static cache render, camera drag (mean) | 7.7 ms  | 6.5 ms  |
| Camera frame `render()` (mean)          | 18.4 ms | 16.4 ms |
| Vue runtime share of a camera drag      | 2.4%    | 1.1%    |
| Construction activation (`activate`)    | 149 ms  | 84 ms   |
| `navigation.replaceOwner` at activation | 42.7 ms | 9.9 ms  |
| `navigation.replaceOwner` at completion | 41.3 ms | 1.7 ms  |
| Static batching at activation           | 28.9 ms | 10.4 ms |

About 1,330 of the town's 2,724 scene objects are now frozen. The rest are characters, animals and
vehicles, which must update every frame, so A1 gained less than the measured upper bound of skipping
all matrix work. `refreshServiceDrops` stayed at about 20 ms in this scenario: its remaining cost is
ray casting against the rebuilt building itself.

## Batch B: matrices, terrain and actor buffers

| Change                                        | Where                                                                                                                                    | Effect / revert note                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. One matrix update per drawn frame          | `TownDiorama` constructor (`scene.matrixWorldAutoUpdate = false`), `drawFrame()`; `TownActors.update(scene)`; `TownPresentation.frame()` | `drawFrame()` updates world matrices once, then the static cache, foreground and inset renders reuse them. Character instancing skips its own per-root update for roots in the scene. Anything that renders `d.scene` must go through `drawFrame()`. Revert: remove the constructor line and the two `drawFrame()` lines, and restore `actorRenderer.update()` before `drawFrame()` in `tick()`/`render()` and in `TownPresentation.frame()`. |
| 2. Graded terrain with a local millrace patch | `landscapeGeometry()` in `TownMillrace.js`                                                                                               | 1.25-unit cells inside ±62.5, 2.5 to ±95 and 5 to ±130. The 0.2-unit millrace lines form a local patch whose border vertices are shared with fan-triangulated neighbors (crack-free), instead of full-map strips. The ground mesh drops from 116k to 43k triangles; the shaft opening, the channel and all walkable areas keep the same detail. Revert: restore the previous `landscapeGeometry()` (tensor `PlaneGeometry`).                  |
| 4. Incremental actor instancing               | `TownActors.rebuild()`, `bucket()`                                                                                                       | Buckets keep their `InstancedMesh` (and GPU buffers) while their parts fit, with 25% headroom; only overflowing or removed buckets are recreated. Revert: call `this.clear()` at the start of `rebuild()`.                                                                                                                                                                                                                                    |

Tried and dropped: an exact triangle grid for service-drop wire probing. Building the grid cost more
than the few rays it saved (6.7–9.1 ms against 3.7–4.1 ms per drop), so wire probing keeps three's
ray casting with the Batch A bounds check.

Tests: `testing/town-render-hotspots.test.js` (actor buffers, one matrix update per frame, terrain
seams and coverage).

Interleaved A/B in one page (industrial town, no CPU slowdown, loaded machine):

| Measurement                          | Before     | After      |
| ------------------------------------ | ---------- | ---------- |
| Camera-frame `render()` (mean)       | 7.0 ms     | 5.1 ms     |
| `rebuildActors()` (mean, 30 buckets) | 4.6 ms     | 2.8 ms     |
| Render right after an actor rebuild  | 7.4 ms     | 6.9 ms     |
| Static triangles per full render     | 415,758    | 340,394    |
| Landscape batch triangles            | about 208k | about 135k |

Before/after screenshots of the overview, far horizon, low horizon, millrace and mine views showed
the same terrain; pixel differences came from villagers, water animation and a VIP arrival.

## Batch C: returning from the mine

Leaving the mine advances every construction project at once, so several plots change their
scaffolding together. `changeTown()` only swapped a single changed plot incrementally; two or more
fell back to the full `update()`, which rebuilt every plot and service drop synchronously inside the
tap and then re-planned every villager and animal route for several seconds.

| Change                                       | Where                                                                                                                                   | Effect / revert note                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C0. Multi-plot swaps, one per frame          | `TownDiorama.changeTown()` (`plotQueue`), `tryActivatePlot()`, `plotsPending()`; `setMotion()` and `tick()`                             | Same-layout changes to several non-mine plots are queued and swapped by `tick()` one per frame, after the current town is back on screen. Only villagers whose routes cross a changed plot are re-planned. A building the player finishes goes last so no later swap cuts its reveal short. A newer town change or a full `update()` clears the queue. Revert: restore the `changed.length === 1` condition and remove `plotQueue`. |
| C0b. Purchases once per town, not per second | `buildingIndicators(…, purchases)` in `TownRules.js`; `townPurchases` in `TownScene.vue` (the SVG `TownMap.vue` has since been removed) | The one-second collection clock only re-checks collection cooldowns; the upgrade offers for every building are computed when the town changes. Revert: drop the `purchases` argument at both call sites.                                                                                                                                                                                                                            |
| C4. Resumable dog and cat street routes      | `streetRoute()` in `TownAnimals.js`; `planSteps()`, `routeSteps()` in `animalNavigation()` (`TownAnimalSpace.js`)                       | The town-wide dog and cat loop was one uninterruptible plan when animals re-settled after a swap. It now yields after each navigation and animal detour step; `plan()`/`route()` run the same steps to completion. Revert: make `streetRoute()` a plain function calling `nav.route()`/`nav.plan()`.                                                                                                                                |
| C5. Animal routes kept across swaps          | `keptRoute()` and `d.animalRoutes` in `TownAnimals.js`; `routeClearSteps()` in `animalNavigation()`                                     | Each ground animal route (dog, cat, hens, fox, raccoon) is cached under what it connects. When animals re-settle after a swap, a cached route is reused if every point is still clear and every leg still open in the rebuilt animal space; only blocked routes are planned again. The cache resets with the era. Revert: call the planners directly instead of `route(key, …)` in `populateAnimals()`.                             |

Tests: `testing/town-construction-stutter.test.js` (several advancing projects, a finished building
among them, a superseded queue, purchases passed once); `testing/town-animals.test.js` and
`testing/town-animal-clearance.test.js` cover the animal routes, including kept and re-planned
routes after a change.

Headless Chromium, phone viewport, 4× CPU slowdown, motor-age town with three projects advancing
after a mine run; main-thread tasks from the tap onward:

| Measurement                       | Before                        | After                              |
| --------------------------------- | ----------------------------- | ---------------------------------- |
| Tap back to the village           | 1,326 ms (full rebuild)       | 217 ms                             |
| Plot changes                      | inside the tap                | 3 frames of about 200–250 ms       |
| Villager and animal re-planning   | seven tasks of 100–350 ms     | route repair tasks under 160 ms    |
| Longest task after the tap        | 1,326 ms                      | about 230 ms (one plot swap frame) |
| Dog/cat street route              | one 432 ms task (after C0)    | steps of at most 104 ms (C4)       |
| Animal route planning after swaps | every ground route re-planned | none when no route is blocked (C5) |

## Tomorrow City (PR #56) against these changes

The rounded era uses the same pipeline, so every change above applies without era-specific code:
rounded buildings are static plot batches (frozen by A1, one matrix update per frame from B1),
Tomorrow plots use the generated footprint catalog (the swap paths never fall back to provisional
geometry), and the new people/animal parts reuse existing geometries so B4 instancing keeps them
in the existing buckets. Only the space dog's transparent helmet adds one instanced bucket.

Headless Chromium, phone viewport, complete towns, camera orbiting, 25 s warm-up, three
interleaved runs each (loaded machine; compare ranges, not single values):

| Measurement                  | Connected City | Tomorrow City   |
| ---------------------------- | -------------- | --------------- |
| Plots                        | 55             | 58              |
| Static triangles             | 307k–312k      | 295k–297k       |
| Static draw calls            | 89–94          | 96–99           |
| Foreground draw calls (mean) | 116–124        | 103–107         |
| Camera-frame `render()` mean | 6.0–11.1 ms    | 6.5–9.0 ms      |
| Provisional plot footprints  | 0              | 0               |
| Frozen static meshes         | all            | all (583 / 583) |
| Long tasks while orbiting    | 0–2            | 0               |

The extra static draw calls come from the three new Tomorrow plots; per plot, rounded buildings use
no more materials than the Blender shells (`testing/tomorrow-era.test.js`).

## On-device checks for preprod

1. Orbit and zoom the town, then run `await prospectDebug.townFrameStats(5)` while dragging. Compare
   `phases.render`, `phases.foreground` and `frames.p95` with a run on the previous build if needed.
2. Complete an ordinary upgrade and one that unlocks plots (for example Home level 2), then read
   `prospectDebug.townTimings()`. Look at `activate`, `settle-*` and `longTasks`.
3. With two or more buildings under construction, finish a mine level and return. `town-change`
   should show `path: "swap"` with every advanced plot, followed by one `activate` per plot.
4. Visual checks: buildings, roads, power wires and service drops sit in the right places; tapping a
   building still selects it; labels and action icons follow the camera and appear or hide correctly;
   villagers walk around newly built buildings.

## October 2026 review: puzzle, village UI and asset pipeline

None of these change gameplay, rewards or the unlimited-moves rule.

| Change                                   | Where                                                                             | Effect                                                                                                                                                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Levels generated on demand               | `levelConfig(id)` in `LevelGenerator.js`; `currentLevel` getter in `gameStore.js` | Startup no longer builds all 402 levels (measured about 250 ms on a desktop CPU and 2.7 MB of reactive state). Each level is seeded on its own, so `testing/level-config.test.js` checks every id against the full list.                               |
| Plain puzzle data                        | `src/stores/game/boardData.js`; engine calls in `moveResolution.js`               | The board and tiles are plain arrays replaced on commit. The hint search measured about 20× faster than through Vue proxies (2 ms vs 40 ms average over all levels).                                                                                   |
| One move lifecycle                       | `runMove()` / `showResolution()` in `moveResolution.js`                           | Swaps, powers and shuffles share input locking, animation and settling; every move commits its resolved tiles after its animation.                                                                                                                     |
| Whole-second run clock                   | `syncRunClock()` in `gameStore.js`                                                | The HUD re-renders once per second instead of ten times; rewards still read the exact clock.                                                                                                                                                           |
| Badge glyph cache                        | `TextGlyphs.js`, `drawTileOverlay()`                                              | Layer counts, ❄, arrows and ✓ reuse one small texture per label instead of a Phaser `Text` (own canvas and upload) per tile change.                                                                                                                    |
| Gem sprite pool                          | `createGem()` / `releaseGem()` in `BoardAnimator.js`                              | Cleared gems are hidden and reused by refills instead of being destroyed and recreated.                                                                                                                                                                |
| Incremental board redraw                 | `drawCells(indices)`, `updateTiles()`                                             | A cascade step redraws only the cells it changed; the board outline is redrawn only when the shape changes.                                                                                                                                            |
| Still-board sleep                        | `BoardLoop.js`, `isAnimating()`                                                   | With no tweens, particles, sprite animations, shakes or held pointer, the Phaser loop sleeps; input or any redraw wakes it. Moves still render at full refresh rate.                                                                                   |
| One-second clock out of the village view | `provide('townClock')` in `TownView.vue`; `indicators` in `TownScene.vue`         | TownView no longer re-renders every second, and the scene's labels re-render only when an action appears or disappears.                                                                                                                                |
| Composited labels                        | `labelBox()` / `placeLabels()` in `TownLabels.js`                                 | Labels and action icons move with the `translate` property in pixels, so camera frames no longer lay out the page; a moving VIP name tag no longer re-renders the scene.                                                                               |
| Shared purchase offers                   | `openOffers()` in `TownRules.js`                                                  | The free-first-project check runs once per town instead of once per building, and both purchase lists share one pass.                                                                                                                                  |
| Inset at 30 Hz below the high tier       | `drawCameraInset()` in `TownInset.js`                                             | On medium/low tiers the incident or VIP inset redraws the town into a small offscreen image at 30 Hz and shows it every frame; the high tier keeps drawing it every frame.                                                                             |
| Per-root actor visibility                | `shownRoots()` in `TownActors.js`                                                 | Visibility is checked once per villager instead of walking every part's ancestors, only used instances are uploaded, and roots outside the given cameras' views can be skipped.                                                                        |
| Packed binary meshes                     | `scripts/split-mesh-catalogs.mjs`, `assets/meshChunks.js`                         | Mesh chunks are Float32/Uint16 binary (identical GPU data), gzip-packed at build time (2.1 MB for every family) and inflated with `DecompressionStream`, instead of JSON text decoded into JS arrays (about 110 ms on a desktop CPU for every family). |
| Save metadata cache                      | `activeMeta()` in `townStorage.js`                                                | Status displays read metadata parsed once per stored save instead of re-parsing the whole save after every change; a save skips its second full read of storage.                                                                                       |

## October 2026 review: the 3D town (TownDiorama split)

| Change                     | Where                                                                                                                                        | Effect                                                                                                                                                                                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 60 fps on any display      | `TownFramePacer.js`, `tick()`                                                                                                                | Frames are due on a fixed 60 Hz grid instead of "15.7 ms after the last frame", which held 75/90/144 Hz screens at 37/45/48 fps. The quality sampler reads a four-frame average, so those screens can recover a lowered tier.                                      |
| Sign atlas                 | `TownSignAtlas.js`, `TownPrimitives.sign()`, `TownStatics.composeSigns()`                                                                    | Every visible sign on an atlas page draws as one mesh instead of one draw call and one 512×128 texture per sign.                                                                                                                                                   |
| No second plot batch       | `TownStatics.place()` / `hideSources()`                                                                                                      | Plots are no longer merged per material before static batching. Batched source meshes move into one hidden group per root: the renderer skips them with one check, while picking, bounds, wire probing and the animal planner still use the real meshes.           |
| Villager culling           | `TownActors.shownRoots()`, `drawFrame()`                                                                                                     | Villagers outside the camera's view are left out of the instances (all are kept while the event inset shows another part of the town).                                                                                                                             |
| Allocation-free crowd grid | `LocomotionGrid` in `TownLocomotion.js`                                                                                                      | Numeric cell keys, one agent rebuild per frame, and in-place candidate checks replace per-agent strings, generators, Sets and spread arrays.                                                                                                                       |
| Label projection           | `TownLabelProjection.js`                                                                                                                     | Scratch vectors instead of clones, label ranks computed once per frame, the villager tag checks its parent instead of scanning the world, and mouse hover is evaluated once per frame.                                                                             |
| Diorama split              | `TownPrimitives`, `TownPeople`, `buildings/frontierParts`, `TownPlots`, `TownCamera`, `TownLabelProjection`, `TownPopulation`, `TownWalkers` | TownDiorama went from about 2,600 to about 700 lines; it keeps thin delegating methods. The full rebuild and the in-place swap share one rotor attachment (the swap had skipped the rotor's animal bounds), and waiting plot changes live in one `plotWork` queue. |

## Round, distant horizon (October 2026)

The fog is measured by horizontal distance from the town center (`TownAtmosphere.js`), so the
horizon is round instead of square. It starts at 170 units, leaving open prairie beyond the
farthest monument site (about 121), and reaches full fog at 320. The terrain, river and railway run
to `TOWN_EDGE` (±330 instead of ±130), and the main camera's far plane is 700 so the widest orbit
still reaches full fog.

| Change           | Where                                      | Cost                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Far terrain ring | `landscapeGeometry()` in `TownMillrace.js` | The core lattice stops at ±130. Beyond it a separate 20-unit lattice stays fine only across the river valley, the trail, the flight corridor and the railway cutting, and fans around the core's border vertices like the millrace patch. The ground mesh is 47,968 triangles (42,990 at ±130); running the core's rows and columns out to ±330 would cost about 55k. |
| Welded railway   | `addRailroad()` in `TownEraActivity.js`    | One-unit rails and ballast only within `RAIL_JOINTED` (±60: the bridge grade and the opening's build wave); one welded length per side beyond it, with a sleeper per unit throughout. The railway is 22,428 triangles (34,932 at ±140, 80,748 if jointed out to ±330).                                                                                                |
| River fog        | `buildRiver()` in `TownRiver.js`           | The live river blends its fog in linear light before tone mapping, like the cached prairie, so its far end fades into the same horizon color instead of showing a pale tip.                                                                                                                                                                                           |

Tests: `testing/town-render-hotspots.test.js` (terrain and railway triangle budgets, crack-free
terrain), `testing/town-camera.test.js` (round fog, clearance, open river and cutting on the far
terrain) and `testing/river-transport.test.js` (welded lengths only on level line).

## Proposed next steps (not implemented)

- **B1 (rest).** Stop the ground casting shadows. Kept for now because the mine hillside inside the
  shadow camera can shade the mine works.
- **B2.** Render event and VIP insets offscreen at about 20–30 Hz instead of re-rendering the whole
  town every frame.
- **B3.** Put the 28–54 per-building sign textures in one atlas.
- **C1.** An incremental path for layout-changing completions (scenery refresh with new plots);
  keep the full rebuild for era changes only. Same-layout multi-plot changes are covered by C0.
- **C2.** An interaction quality mode (lower pixel ratio and cache MSAA during drags and reveals).
- **C3.** Cheaper character instancing updates (per-root visibility instead of per-mesh ancestor
  walks).
