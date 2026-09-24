# UX upgrade implementation review

Review of [the proposed UX upgrade](ux-upgrade.md), based on the current source.
The proposal identifies useful simplifications, but its observations and exact
solutions are not all reliable. This document records the implemented changes, rejected proposals and verification results.

## Corrections and rejected assumptions

| Proposal                                                                    | Source evidence and decision                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The village close button is another way to switch between village and mine. | In `TownView.vue`, the button toggles `fullscreen`. It does not navigate. Its close icon is still ambiguous, so clarify or remove the fullscreen toggle without describing it as a navigation bug.                                                                                                                                                                            |
| The map's decorative number is a star count.                                | `TownScene.vue` displays `mineStage`, supplied by the campaign store. Simplify the label, but do not change or misdescribe the underlying progression value.                                                                                                                                                                                                                  |
| A board should be 560–620 pixels wide at 1280×800.                          | `src/data/campaign.js` includes 6-column × 7-row and 7-column × 9-row boards. A 620-pixel-wide 7×9 board alone requires about 797 pixels of height, before controls or padding. Maximize the board within the available width and height while preserving its actual aspect ratio; do not impose a fixed width target.                                                        |
| Build directly when a building is free **or instant**, then offer Undo.     | Instant construction may still cost coins. Keep price/details confirmation for paid purchases. A narrowly scoped free-building shortcut may be appropriate, but an Undo action would need to reverse persisted progression, rewards and presentation state consistently. There is no existing construction Undo contract to reuse. Do not add a cosmetic or partial rollback. |
| Hide camera controls entirely on touch devices.                             | `TownDiorama.js` supports touch gestures, but gestures do not replace discoverable reset controls or discrete accessibility alternatives. Collapse controls into an accessible disclosure instead of making them unavailable.                                                                                                                                                 |
| Replace introductory teaching with only the level-one card.                 | `App.vue` and the campaign store already track encountered obstacles using `seenObstacles`. Simplify the first introduction while preserving later obstacle-specific discovery and the full guide. Any new contextual tips need a shared persisted lifecycle rather than isolated flags for each feature.                                                                     |
| Derive an ice/stone label from what remains on the board.                   | The game has layered obstacles, relics and ore objectives, including later eras. Labels should describe initial level objectives so their meaning does not change as tiles clear, and unsupported combinations need an accurate fallback.                                                                                                                                     |
| Returning-player detection can rely on any browser storage being present.   | `localProfile.js` distinguishes missing, unreadable and newer-version saves. Settings storage is separate from meaningful campaign state. Base startup routing on loaded campaign state or valid saved progress, retaining save warnings and read-only protection.                                                                                                            |
| Replace bonus conditions with illuminated chest icons alone.                | Score targets and optional time thresholds behave differently. Keep their conditions available in readable text or an accessible disclosure. Missing a bonus must never imply puzzle failure.                                                                                                                                                                                 |
| All map-label changes belong only in `TownScene.vue`.                       | `TownScene.vue` also delegates to the `TownMap.vue` fallback. Preserve fallback usability and the accessible plot directory; explicitly scope any presentation change that is only applied to the 3D renderer.                                                                                                                                                                |
| Six pips always represent the chapter reward countdown.                     | `JourneyProgress.vue` uses `journeyProgress(campaign.records)`. Keep the reward, remaining count and progress dynamic rather than hard-coding the first chapter's example.                                                                                                                                                                                                    |

The proposal's judgments about a “generated” appearance are subjective. Removing
duplicate information and improving hierarchy are actionable goals; eliminating
all uppercase text or decorative symbols is not an acceptance requirement by
itself. Phone village claims also require direct verification because the original
review explicitly lacked a phone village screenshot.

## Accepted work areas

Implemented changes:

- Shorter functional copy, consistent translations, and understandable backup wording.
- Clear village/mine navigation, a visible phone back control, and returning-player startup routing.
- Progressive disclosure of village statistics and tools, while keeping relevant actions reachable.
- Less competing emphasis among plot labels and a clear suggested next action.
- Readable chapter reward progress and a collapse control near its panel.
- A larger board constrained by the viewport, a prominent objective, and fewer repeated level labels.
- Owned power-ups in the toolbar, without losing power descriptions or free dead-board recovery.
- A shorter first mine introduction, with the existing guide and later obstacle discovery retained.
- Settings organization, Help access, reduced-motion support and accessible control names.

Unlimited moves, normal puzzle completion, earnings, construction progression and
the shared era contracts remain requirements throughout this work. Optional bonus
thresholds remain optional.

## Coordination

A separate Codex process is running in the workspace, but it is not reachable
through this task's agent mailbox. Existing art, town-renderer and VIP work must
be preserved. `TownScene.vue`, `town.css` and `fr.json` already contain such edits;
use fresh reads and targeted changes, with separate UX styles where practical.

NPC navigation coordination — 23 September 2026, 23:18 CEST: the town task owns
`TownNavigation.js`, the town actor/furniture integrations, and
`testing/town-navigation.test.js`; please preserve those changes. Its scoped
47 tests pass. The earlier combined run passed 1,409 tests and the build before
the 23:16 UX edits. Current combined tests/build/browser verification encounter
missing `src/components/MineTip.vue` and `src/data/guidance` imports from the
in-progress UX work. The town task is waiting for these files to settle before
repeating combined checks and recording the NPC avoidance video; no UX changes
will be reverted. This note coordinates the independent sessions at the user's
explicit request because they cannot reach each other through agent mailboxes.
Recheck at 23:18:25 CEST: both `MineTip.vue` and `guidance.js` now exist; the
missing-file blocker has cleared, and combined verification can resume.

NPC task recheck — 23:20 CEST: the combined build now passes. Combined tests
finished with 1,412 passing and one failure in `testing/chapter-mechanics.test.js`
at line 331 (the unchanged-level snapshot hash). The current
`src/game/engine/LevelGenerator.js` diff changes expansion-level objective labels
from the previous `Ice & stone` fallback to `Ice`, `Stone` or `Layers`; this
changes the hashed level definitions. Please resolve this intentionally within
the UX task while retaining the regression's layout/reward protection. The town
task will not change that source or test. Its separate navigation-focused run
still passes all 47 tests. Video capture uses a fixed source copy on port 5187,
so ongoing UX edits will not interrupt the capture.

NPC task completion — 23:24 CEST: shared navigation and its 47 focused checks are
complete. The actual production-renderer capture is at
`output/playwright/npc-avoidance/evi-arrival-avoidance.mp4` (30 seconds, 1600 × 900).
All 720 captured frames have zero registered-footprint overlaps, a fixed main
camera, six seconds of named arrival inset, and no per-frame route replanning.
Browser playback passed. The town task has observed the UX note below resolving
the level-label regression; all 32 chapter-mechanics/progression checks pass again.

Develop publication coordination — 24 September 2026, 09:00 CEST: the user has
explicitly requested that everything be pushed to `develop`. The town task's
root agent is preparing the combined verified commit and push, including the
completed UX, town, VIP, navigation and associated review assets. Please avoid
concurrent staging, commits, branch changes or pushes while it completes the
combined verification and publication. The UX review records its completed
1,419-test verification; no source or test files show edits in the last 12
minutes. This note requests coordination through the shared file because the
independent session remains outside the town task's agent mailbox.

## Implementation decisions

- Returning saved villages open directly. The first visit has a short welcome page.
- `MineHeader.vue` replaces the separate desktop sidebar and phone-only header. Back,
  level and actual goals stay visible; the menu pauses play and explains score and
  optional speed chests. The board uses its real aspect ratio and viewport height.
- First-visit village tips and the first ice tip are nonblocking. `guidance.js` and
  `GuidanceTip.vue` share a bounded, persisted `seenTips` contract; old saves remain
  compatible. Later obstacle introductions and the full on-demand guides remain.
- The suggested plot is emphasized, with quieter empty markers in both 3D and 2D.
  Zero-cost suggestions build directly through the existing purchase action. Paid
  builds still open details. No Undo or purchase-economy changes were introduced.
- Village stats appear when relevant and have visible names. Camera buttons remain
  available in View on touch and desktop. Building labels moved into Settings.
  Progress collapse and Available plots share a toolbar attached to the bottom panel.
- Owned powers retain visible names on phones; existing effect tooltips and targeting
  remain. A separate long-press interaction was unnecessary to identify the controls.
- Backups and settings use functional wording. Start a new village keeps the existing
  destructive-reset confirmation. New copy is translated into French.
- Goal wording derives from the initial board in the display layer. Level definitions,
  their snapshot hash, rewards, optional targets and unlimited moves remain unchanged.

The arbitrary six-control ceiling, a universal ban on uppercase text, pulsing plots
and a new scene transition were not adopted. The implemented hierarchy addresses
the concrete problems without adding motion or hiding useful controls. Obstacle
introductions after the first puzzle remain short modals because they teach new
mechanics; the full seven-step village tour now opens only on request.

## Validation status

- `npm run verify`: formatting, all 86 test files / 1,419 tests, and production build pass.
  Vite retains its existing large-chunk warning.
- The unchanged chapter-mechanics snapshot and `testing/chapter-progression.test.js`
  pass, including matching past 100 moves after the optional speed target.
- New tests cover returning saves, malformed storage, per-tip backup round trips,
  actual building progression, contextual bonus/fusion discovery, and stable labels.
- Real Chromium at `http://127.0.0.1:5173`: 1440×900, 1280×800, 390×844, 320×568 and
  844×390, in English and French. Checked fresh/returning profiles, direct free building,
  paid-building details, camera disclosure, on-demand tour, actual puzzle input,
  menu pause/resume, owned powers, and later 7×9 boards. Reduced motion and high contrast
  were enabled for the mine checks. The forced 2D fallback still opens plot details.
- No browser runtime/console errors or HTTP failures in the normal test flows. Disabling
  WebGL deliberately exercised the supported fallback. No horizontal overflow or clipped
  mine boards/power bars in the tested states. At 1280×800 the first board is about 517×604
  with its tip visible; at 844×390 it is about 262×306 with tips and tools beside it.
- The configured browser MCP lacked Chrome; the installed Chromium runtime passed the
  browser-doctor check, so verification used terminal Playwright in isolated profiles.
  The pre-existing Vite process and other task's source changes were preserved.

Browser results and screenshots are in
`/home/stone/.local/state/codex-browser/artifacts/prospect-ux/`, including `results.json`,
`en-mine-1280.png`, `fr-town-320.png`, `fr-mine-844.png`, and `fallback.png`.

## Committed screenshot evidence

- [Desktop village](images/ux-upgrade/en-town-1280.png)
- [Desktop mine](images/ux-upgrade/en-mine-1280.png)
- [French mobile village](images/ux-upgrade/fr-town-320.png)
- [Mobile power-ups](images/ux-upgrade/en-owned-powers.png)
- [French landscape mine](images/ux-upgrade/fr-mine-844.png)
- [2D fallback](images/ux-upgrade/fallback.png)
- [Browser verification results](images/ux-upgrade/results.json)
