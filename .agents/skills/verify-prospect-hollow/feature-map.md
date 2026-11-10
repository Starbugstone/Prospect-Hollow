# Gameplay and settlement verification map

Start and run everything: `bash scripts/verify-gameplay.sh all`.
Doctor: `bash scripts/verify-gameplay.sh doctor "$RUN"`.
Cleanup: `bash scripts/verify-gameplay.sh cleanup "$RUN"` (preview with `--dry-run`).
Evidence: the printed `output/verification/run-*` directory, outside Docker volumes.

| Feature                                                     | Journey                              | Entry point                                   | Source anchors                                                                                                 | Last verified      |
| ----------------------------------------------------------- | ------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------ |
| Free valley construction and device persistence             | [Valley](journeys/valley.md)         | `/play` → Build                               | `src/components/town/TownNextStep.vue`, `src/stores/campaignStore.js`, `src/services/townStorage.js`           | 2026-11-10: passed |
| Mine tips, celebrations, power targeting                    | [Mine](journeys/mine.md)             | `/` → prepared mine level                     | `src/App.vue`, `src/components/ArcadeBanner.vue`, `testing/browser/mine-feedback.cjs`                          | 2026-11-10: passed |
| Moon parcel taps, Enter/Escape and drag orbit               | [Moon input](journeys/moon-input.md) | `/moon-input-test` (fixture)                  | `src/components/town/TownMoonView.vue`, `src/game/town/TownTapGesture.js`, `src/game/town/TownControls.js`     | 2026-11-10: passed |
| Moonstone sale, cancellation, collection and saved counters | [Moonstones](journeys/moonstones.md) | `/moonstone-resource-test` (fixture)          | `src/components/town/TownMoonstoneWorkshop.vue`, `src/stores/campaignStore.js`, `src/data/moonstones.js`       | 2026-11-10: passed |
| Cinematic terrain clearance and reduced-motion camera hold  | [Cinematics](journeys/cinematics.md) | `/cinematic-terrain-{valley,moon}` (fixtures) | `src/game/town/TownPresentation.js`, `src/game/town/TownLandscape.js`, `testing/browser/cinematic-terrain.cjs` | 2026-11-10: passed |

The user chose gameplay and settlements. Each journey uses a fresh browser context;
the Moon fixtures construct a Twin Hollows town directly, without playing the
campaign to unlock it. Mine stimuli are injected into the live game stores. These
are controlled interaction checks, not evidence that a player completed those levels.

Other source-backed coverage remains outside this five-journey map:

- Account and recovery: `testing/browser/connection-screens.cjs`,
  `session-expiry.cjs`, `save-durability.cjs` (mocked network), backend tests and
  [hosting instructions](../../../docs/backend/hosting.md).
- Board motion: `testing/browser/board-motion.cjs`; mandatory when gravity,
  board animation or board shapes change, as described in `AGENTS.md`.
- Unlimited moves and late completion: `testing/chapter-progression.test.js`.
- Museum continuous replay navigation and live reward counters:
  [the continuous journey](journeys/mine.md#continuous-replay-navigation),
  `testing/browser/continuous-navigation.cjs` (10 November 2026: passed).
- Every obstacle's completed rendering: `testing/completed-board-markers.test.js`.
- Parcel geometry, map cameras, shared build flow and settlers: the regression
  files named in `AGENTS.md`. The Moon input fixture covers one parcel label,
  not every parcel state or hidden-label 3D hit target.
- Whole-campaign completion and stars: `npm run test:levels` in Docker.

The runner's 20-minute per-check timeout detects stuck automation. It does not
change gameplay, puzzle moves, optional speed bonuses, or progression.

## Audited run: 10 November 2026

Outcome: **changed**. A read-only source wave covered every journey; one
coordinator ran the real browser journeys serially on the isolated stack.
The source audit corrected mine UI anchors, narrowed Moon input coverage claims
and documented the Moonstone fixture's fixed cooldown prop. Cinematics now have
their own recipe and runner entry, linked to the shared cinematic skill.

`start`, its doctor and `run all` passed on base commit
`cc2c5a21a609b40767722148a77ddedf617f7ed8` with the pending changes recorded in
`output/verification/run-20261110-190930-j7GBht/verified-working-tree.patch`.
The original camera fix preceded this upkeep pass; its product changes are
separate from the skill and harness corrections. Repository rules require direct
`preprod` commits and push, so this pass uses those instead of an audit PR.

- Valley: **clean**, free construction, immediate menu access and reload.
- Mine: **changed**, corrected source anchors; all 120 feedback configurations
  passed. The additional continuous-navigation journey passed its EN/FR layouts,
  animation guard and saved counters too.
- Moon input: **changed**, accurate coverage wording; all six configurations passed.
- Moonstones: **changed**, documented cooldown coverage limit; saved counters passed.
- Cinematics: **changed**, new journey; 48 rendered keyframes and sampled terrain
  rays passed across both maps, two viewports and two camera starts. A silent
  lunar clip and frame timing/pose metadata were captured.

The cinematic harness first exposed a false-positive risk from the valley's
batched mesh layer and child order. The corrected audit discovers source terrain,
includes the separate mine shoulder, enables its layer, and requires a downward
ground self-check. An injected obstructed view failed for the expected terrain
intersection; the runner then successfully reran doctor. Failure evidence stays
in `cinematics-injected.log`, `mutation-runner.log` and
`doctor-after-cinematics.log`.

Evidence is under `output/verification/run-20261110-190930-j7GBht/`, including
`results.tsv`, per-journey logs, `audit-notes.md`, `artifacts/` and the camera
recording. The camera sweep and full application suite passed 260 files / 4,927
tests. Production build and bundle budgets passed. Browser fixtures and software
WebGL do not establish physical-phone performance, caption/audio correctness or
every possible camera pose.

The puzzle frame budgets passed, but the town gate failed at 42.9 ms of script
per frame against 35 ms. A separate five-sample alternating comparison also
failed on the unchanged baseline: median 41.6 ms (39.4–60.7), versus 42.9 ms
(42.0–62.7) for the camera candidate. The spread exceeds the difference, so the
regression comparison is **inconclusive**; this is not a passed frame gate or a
performance improvement. Raw reports, failed assertions and a separate CPU
profile remain under `frame-comparison/`. No budget was raised and no unrelated
renderer optimization was included.

Cleanup's dry run and real teardown succeeded; screenshots, JSON reports and
the recording survived. Helper checks rejected invalid commands, unknown
journeys and foreign cleanup paths. Both skill validators and local link checks
passed in Docker. The shared cinematic skill resolves to one repository copy
from both machine-wide agent discovery directories.

Rerun all five mapped journeys with `bash scripts/verify-gameplay.sh all`.
The continuous-navigation recipe remains an additional standalone journey.

## Verified run: 26 October 2026

`bash scripts/verify-gameplay.sh all` exited 0 on base commit
`e9a373a43f4d9e6d6b9a732b4c11fd491a456108` with the verification changes recorded in
`output/verification/run-20261026-134332-AdsP2w/working-tree.patch`.
The runtime scripts and settlement sources stayed unchanged during the run
(`tested-files.sha256` and `source-check.log`). Documentation results and Knip's
standalone-doctor entry were finalized separately.

All four journeys are **changed and passed**:

- Valley: new construction/reload journey, including the visible tutorial message.
- Mine: repaired fixture drift. Inventory now comes from a prepared save import;
  the production integrity guard correctly ignores direct inventory edits.
  All 120 level/language/mode/viewport configurations passed.
- Moon input: added camera stability assertions and six mouse/touch screenshots.
- Moonstones: added assertions against the serialized save and saved evidence.

No product code changed in this verification work. The separately committed Moon
Willowkin implementation is present in the tested base. Its dedicated visual check,
`testing/browser/moon-willowkin.cjs`, remains outside these four journey recipes.

Local evidence is under `output/verification/run-20261026-134332-AdsP2w/`:
`results.tsv`, `doctor.log`, the four journey logs, `artifacts/`, `build.log`,
`knip-rerun.log`, `source-check.log` and `cleanup.log`. Teardown removed the run's
containers, network and volumes; evidence survived.

Supporting checks under `output/verification/run-20261026-131549-bj5szo/` include
91 passing regressions (unlimited moves, build list, Moon parcels, valley tap camera,
Moonstones and tap gestures), formatting, shell syntax, and map links. Helper checks
confirmed a database outage returns a failing doctor, an unavailable Docker daemon
blocks startup, unknown journeys fail, foreign cleanup paths are refused, and
cleanup's dry run leaves the stack running. Skill validation and ESLint passed;
Knip passed after registering the standalone doctor as an entry point.
