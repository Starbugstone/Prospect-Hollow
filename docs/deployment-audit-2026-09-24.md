# Deployment review and change intentions — 24 September 2026

## Comparison boundary

Reviewed `develop` at `e314ca3` against fetched `origin/main` at `bbb2e34`.
There are eight development commits beyond the common base. Main's two
additional commits are merges; its file content matches that base, so this
comparison represents the actual changes relative to deployed-source main.
The audit also includes the compact mine-layout corrections described below.

[GitHub comparison](https://github.com/Starbugstone/Prospect-Hollow/compare/main...develop)

The eight eras, 324 levels, 54 chapters, construction economy and continuous
mode already exist on main. This change set repairs and presents them; it does
not introduce that entire campaign anew. Of the original 1,475 changed paths,
1,314 are images, chiefly the regenerated building review galleries. There are
101 changed source files and 33 changed test files.

**Requirement provenance:** animal behavior, collision avoidance, animal visual
corrections, grain consumption/expiry and prioritizing the later-level board
are explicit requests in this conversation. Unlimited moves and shared era
contracts are explicit contributor rules. Other intentions below come from
the committed implementation reviews, source changes and commit descriptions;
they are provided for comparison with the user's original requirements, not
represented as independently confirmed copies of those requirements.

## Intentions compared with main

| Change                           | Intended behavior / correction                                                                                                                                                                              | Verification                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Direct blast damage              | A special damages stone only inside its actual blast; ordinary matches may still damage adjacent stone. Overlapping hits do not multiply accidentally.                                                      | Blocker, bonus and mine-rule regressions.                                                                            |
| Chained/frozen bonuses           | A hit that merely releases an anchored bonus must not also trigger it. Fusion double damage follows the actual remaining protection.                                                                        | Anchored-bonus and fusion regressions.                                                                               |
| Inventory powers                 | Reserve the in-flight item, reject stale/empty-stock commands, spend once, and cancel cleanly when leaving. Toolbar powers trigger the same legitimate bonus chains as board powers.                        | Inventory, queue, cancellation, preview and chain-reaction tests.                                                    |
| Rainbow and fusion rewards       | Rainbow swaps select the other jewel's color; in-place activation selects the most common color deterministically. Fusion-cleared jewels count exactly once toward income and ore orders.                   | Rainbow, fusion and reward-ledger tests.                                                                             |
| Dead-board recovery              | Keep unfinished puzzles recoverable without paid inventory, extra moves or forced restarts, including sparse and fully anchored layouts. Cancel recovery from abandoned sessions.                           | Constructive shuffle, rescue cross/sweep and session-cancellation tests.                                             |
| Puzzle pacing                    | Move ice away from problematic bottom-edge cells on levels 33 and 52 without reducing objective totals or changing chest/speed rewards.                                                                     | Layout digest, unchanged pacing guards, full campaign simulations.                                                   |
| Star ratings                     | Separate authored per-level star targets from chest targets. Award one star for completion, another for the base score, and another for a ×4 cascade or 150% score. Preserve previous best stars.           | Exact threshold, persistence, reward independence and 20 held-out simulations per level.                             |
| Star explanations                | Show the same numeric requirements in pause details and results, in English and French. Time and move count never determine stars.                                                                          | Shared component/rules tests; actual first victory and translated browser checks.                                    |
| Museum filter                    | Show completed levels below three stars, distinguish unplayed levels, and keep continuous mode independent of the filter.                                                                                   | Completion regressions and browser filter/replay checks.                                                             |
| Completion celebration           | Queue one shared presentation when every authored normal level has three stars; persist it, resume safely, and never replay it after acknowledgement. Restore camera, light and resources.                  | Receipt, old-save and presentation-lifecycle tests; browser celebration flow.                                        |
| Village/mine UX                  | Return saved players to their village; keep phone navigation visible, a direct free first build, paid details, optional tour, contextual guidance and accessible camera controls.                           | UX/save regressions; fresh build, mine input, reload and responsive browser flows.                                   |
| Stable mine feedback             | Hints, celebrations and targeting prompts stay outside the board and never change its geometry or page scroll while appearing/disappearing.                                                                 | Expanded 120-scenario production-browser geometry regression.                                                        |
| Later-level layout (audit fix)   | After the first two chapters, compact the header and routine feedback to give the board priority. Keep objective counts, pause controls, accessible labels and the full guide.                              | Long titles and up to eight objectives, every owned power, EN/FR, five sizes, normal/continuous.                     |
| Era building identity            | Give building kinds distinct shells, silhouette-changing upgrades and appropriate details. Keep the business tower unique; Motor Age retains the newer Post-war base.                                       | City/heritage mesh and stage regressions; all eight production town views.                                           |
| Geometry and scenery corrections | Correct borrowed signs/props, sign backs, bridge supports, square furnishings, duplicate tanks and station details. Replace later overhead wiring with underground distribution.                            | Building, bridge, scenery, era and navigation regressions.                                                           |
| Mine/era construction            | Evolve surface equipment across eras, reveal only changed building parts, retain old services during work and keep new plots out of the transition until revealed.                                          | Construction, mine-evolution, shadow/reveal and era-transition tests.                                                |
| Villagers and traffic            | Use shared cached routes around poles/furniture, separate pedestrians and traffic, match gait to movement, fade at entrances and use period wardrobes/idle poses.                                           | All-era navigation, crowd, manual actor and visual-audit tests.                                                      |
| VIP visitors                     | Occasional named visits from one uniformly sampled name pool, with associated gender, special outfits and names. Synchronize transport arrivals and passive insets without taking over the main camera.     | Visitor selection, wardrobe, route and independent-inset lifecycle tests. The Evi image commit is evidence only.     |
| Incidents, vehicles and aircraft | Show dedicated responders/fire, bounded approach speeds, useful framing, rotating wheels, curved bus turns, correct paddle location and era-appropriate fading aircraft.                                    | Incident camera/speed, vehicle, aircraft and presentation regressions.                                               |
| Roaming animals                  | Dogs/cat use streets, hens forage farther, pigeons fly between completed open habitats and real perches, and occasional foxes/raccoons stay on the outskirts. React to people/traffic and era capabilities. | Shared behavior tests, future/unknown era fallbacks and all-era production scenery clearance.                        |
| Animal appearance                | A recognizable compact cat with pointed ears/curved tail; short rigid pigeon beaks, deliberate pecks and flat wing markings rather than raised dots.                                                        | Revised production captures plus bounded articulated-model tests.                                                    |
| Feeding and grain                | Grain lands on the actual floor, disappears when the beak reaches it or after 2.4 seconds, and reuses fourteen particles. No grain accumulation or per-frame floor raycasting.                              | Physical beak-contact, expiry, instance-count and repeated-cycle regressions; recorded feeding clip.                 |
| Console testing tools            | Prepare a completed era, jump to a chapter, grant test resources or preview completion. Validate arguments and roll back failed saves; skipped stages grant no gameplay rewards.                            | Testing-tool regressions and production-browser fixtures. These tools are intentionally available in built previews. |

Detailed intent sources: [mine corrections](mine-audit-2026-09-23.md),
[town audit and implemented response](town-visual-audit-2026-09-23.md#review-response--implemented-changes),
[accepted UX work and rejected proposals](ux-upgrade-review.md),
[star rating rules](star-ratings.md), and [era architecture](era-architecture.md).
The rejected UX proposals are not acceptance requirements: no new undo system,
fixed-width board, arbitrary control-count ceiling or blanket removal of
accessible camera controls was introduced.

## Specific product choices to compare with the original requirements

- Main used chest score targets and a 135% score alternative for the last star.
  Develop uses separate per-level star targets and a 150% alternative, retaining
  the ×4 cascade route. Chest thresholds, normal completion and old best stars
  remain independent of this rebalance.
- The audit's compact header starts at **level 13**, after the two introductory
  chapters. That threshold is an implementation choice for the request to give
  later boards priority. On narrow phones, the header shows the level number and
  remaining objective counts (a check mark when cleared); pause details and
  accessible labels retain full progress. New-mechanic teaching and the guide remain.
- Street furniture changes with the era, while building modernization still
  requires its normal paid upgrades. Aviation and Broadcast now use underground
  wiring, so birds no longer get nonexistent overhead-pole perches there.
- The animals are ambient village life, without a pet inventory, saved animal
  needs or rewards. The implemented food interaction is a neighbor feeding
  pigeons; other species roam, rest or forage through their own routines.

## Issues found and corrected during this audit

1. **Late puzzle controls below the viewport.** At level 289, 1440×900, the old
   header wrapped to 116 pixels and the power bar ended at y=935.4. Later headers
   now use a compact grid with icon/count objectives and a 44-pixel feedback
   strip. The actual header height is measured for remaining viewport space;
   header wrapping is not paid for with an unnecessary reduction of the board.
   Finale levels with seven or eight objectives also wrapped to 100 pixels on
   320-pixel phones. Compact remaining counts and a short level label keep those
   objectives visible in two rows at 52 pixels, giving the board 48 pixels more
   height in that case. The header tooltip retains the full level
   title; pause details retain full objective progress and the guide explains mechanics.
2. **French phone toolbar overflow.** All five owned powers in continuous mode
   at 320×568 exceeded the viewport by about 1.3 pixels because translated labels
   needed more room than the reserved toolbar height. The reservation now covers
   those labels, and the regression includes all owned powers.
3. **Cramped phone pause details.** An older two-column HUD rule squeezed
   reward explanations into narrow columns in the current pause drawer. The
   drawer now uses full-width paragraphs and includes full objective labels and
   completed/total counts.
4. **Outdated release guide.** The README still described 144 levels, four eras,
   unavailable Post-war/Contemporary, old menu names and obsolete progression
   values. It now describes the existing 324-level/eight-era game and current
   controls. This is a documentation correction, not a new economy change.

## Verification evidence

- Complete `npm run verify` after the initial compact-header correction:
  **1,799 tests in 91 files**, formatting and production build passed. This
  includes all 324 levels completing with legal moves and no inventory
  requirement, plus **6,480 held-out star-rating runs**.
- A full-suite repeat during software-rendered browser checks passed 1,798 tests
  and exceeded the five-second timeout in one scenery-cache test. With the
  browser closed, the entire 21-test scenery-cache file passed using its
  unchanged timeout. The final production build also passed. No test assertion
  failed; the timing difference is consistent with workload contention.
- Unlimited-move regression passed, including play beyond 100 moves after the
  optional speed threshold. Shared era extension/fallback tests passed.
- Animal clearance checks build real scenery at initial/final tiers in all eight
  eras, test planned segments and sample 90 seconds of movement per scene.
  Feeding checks cover consumption, 2.4-second expiry and bounded instances.
- Production Chromium at `http://127.0.0.1:4173`: all eight eras at 1440×900 and
  390×844; no horizontal overflow, lost contexts or failed asset requests.
- All **54 chapter openings** rendered and accepted a real mouse move, alternating
  desktop, portrait and landscape sizes. A full first puzzle was played through
  chests/results, and its rewards/progress survived reload.
- After the layout correction: **120 feedback scenarios** across levels 1, 289,
  294, 312, 319 and 324; EN/FR; normal/continuous; 1440×900, 1280×800, 390×844, 320×568 and 844×390.
  Board/tools/scroll stayed stable through tips, all banner kinds, targeting and
  cancellation; all owned powers stayed in view and every later header measured
  52 pixels. Another 12 EN/FR phone/desktop cases checked full objective details,
  pause/resume and unchanged board geometry. Related 32 unit tests also passed independently.
- With WebGL deliberately unavailable, the interactive SVG village rendered all
  eight eras (22 through 54 plots) and opened building details. Expected renderer
  creation errors triggered the fallback; there were no uncaught page errors.
- All **seven era transitions** passed through Next era / Explore with reduced
  motion, retaining the existing well service and saved puzzle record.
- Museum showed **318 played / 317 imperfect** normal levels for the seeded
  profile and **319 continuous choices**. Pause froze the active clock. A real
  continuous run cleared its objectives on move 4 and accepted move 5, earning
  12 coins without changing normal records, construction or chest receipts.
- Paid construction spent exactly **225 coins**, retained the existing house
  level while a real replay advanced the project, and required the final village
  tap. The next upgrade spent one builder hammer and zero coins, finishing
  immediately without an extra project.
- The animated three-star celebration reached Continue; all 324 normal levels
  were excluded by the perfect-collection filter and all 324 remained available
  in continuous mode. Reload did not replay the acknowledged celebration.
- A downloaded backup restored records, building levels, wallet and inventory;
  an invalid JSON file was rejected without replacing progress. Settings,
  reduced motion and high contrast remained usable.

The production browser uses installed Chromium via Playwright CLI because the
MCP browser's configured Chrome executable is unavailable. No product workaround
was needed. Test fixtures use a disposable browser profile, never a real player's
save. Scripts, screenshots and machine-readable results are in
`output/playwright/deployment-audit/` (ignored generated artifacts).

## Deployment limits

Passing checks show no reproduced blocker in the tested configurations; they
cannot prove that no bug exists. WebGL was exercised with software rendering,
not real phone GPUs. Safari/WebKit, native Capacitor builds and the deployed
Azure environment were not exercised in this local review.

The build retains the large-chunk warning. The town renderer bundle is about
18.8 MB minified / 2.19 MB gzip; mobile download, parse time and hardware frame
rate remain release-performance considerations. The software renderer needed
longer than the initial 45-second browser wait to finish the animated celebration;
it did reach Continue normally. This is not hardware timing certification. The tested grain pool cannot
grow, but that is not a claim that every phone sustains a particular frame rate.

The existing Azure workflow deploys pushes to `main`. This audit does not merge
or deploy the branch. Main's existing eight-era/324-level scope and the documented
intent above should be compared with the original product requirements before
that release action.
