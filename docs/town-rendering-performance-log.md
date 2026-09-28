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

## On-device checks for preprod

1. Orbit and zoom the town, then run `await prospectDebug.townFrameStats(5)` while dragging. Compare
   `phases.render`, `phases.foreground` and `frames.p95` with a run on the previous build if needed.
2. Complete an ordinary upgrade and one that unlocks plots (for example Home level 2), then read
   `prospectDebug.townTimings()`. Look at `activate`, `settle-*` and `longTasks`.
3. Visual checks: buildings, roads, power wires and service drops sit in the right places; tapping a
   building still selects it; labels and action icons follow the camera and appear or hide correctly;
   villagers walk around newly built buildings.

## Proposed next steps (not implemented)

- **B1 (rest).** Stop the ground casting shadows. Kept for now because the mine hillside inside the
  shadow camera can shade the mine works.
- **B2.** Render event and VIP insets offscreen at about 20–30 Hz instead of re-rendering the whole
  town every frame.
- **B3.** Put the 28–54 per-building sign textures in one atlas.
- **C1.** An incremental path for layout-changing completions (multi-plot swap plus scenery refresh);
  keep the full rebuild for era changes only.
- **C2.** An interaction quality mode (lower pixel ratio and cache MSAA during drags and reveals).
- **C3.** Cheaper character instancing updates (per-root visibility instead of per-mesh ancestor
  walks).
