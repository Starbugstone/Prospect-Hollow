# Gameplay and settlement verification map

Start and run everything: `bash scripts/verify-gameplay.sh all`.
Doctor: `bash scripts/verify-gameplay.sh doctor "$RUN"`.
Cleanup: `bash scripts/verify-gameplay.sh cleanup "$RUN"` (preview with `--dry-run`).
Evidence: the printed `output/verification/run-*` directory, outside Docker volumes.

| Feature                                                     | Journey                              | Entry point                          | Source anchors                                                                                             | Last verified      |
| ----------------------------------------------------------- | ------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------ |
| Free valley construction and device persistence             | [Valley](journeys/valley.md)         | `/play` → Build                      | `src/components/town/TownNextStep.vue`, `src/stores/campaignStore.js`, `src/services/townStorage.js`       | 2026-10-26: passed |
| Mine tips, celebrations, power targeting                    | [Mine](journeys/mine.md)             | `/` → prepared mine level            | `src/components/BoardHost.vue`, `src/stores/gameStore.js`, `testing/browser/mine-feedback.cjs`             | 2026-10-26: passed |
| Moon parcel taps, keyboard and camera gestures              | [Moon input](journeys/moon-input.md) | `/moon-input-test` (fixture)         | `src/components/town/TownMoonView.vue`, `src/game/town/TownTapGesture.js`, `src/game/town/TownControls.js` | 2026-10-26: passed |
| Moonstone sale, cancellation, collection and saved counters | [Moonstones](journeys/moonstones.md) | `/moonstone-resource-test` (fixture) | `src/components/town/TownMoonstoneWorkshop.vue`, `src/stores/campaignStore.js`, `src/data/moonstones.js`   | 2026-10-26: passed |

The user chose gameplay and settlements. Each journey uses a fresh browser context;
the Moon fixtures construct a Twin Hollows town directly, without playing the
campaign to unlock it. Mine stimuli are injected into the live game stores. These
are controlled interaction checks, not evidence that a player completed those levels.

Other source-backed coverage remains outside this four-journey map:

- Account and recovery: `testing/browser/connection-screens.cjs`,
  `session-expiry.cjs`, `save-durability.cjs` (mocked network), backend tests and
  [hosting instructions](../../../docs/backend/hosting.md).
- Board motion: `testing/browser/board-motion.cjs`; mandatory when gravity,
  board animation or board shapes change, as described in `AGENTS.md`.
- Unlimited moves and late completion: `testing/chapter-progression.test.js`.
- Every obstacle's completed rendering: `testing/completed-board-markers.test.js`.
- Parcel geometry, map cameras, shared build flow and settlers: the regression
  files named in `AGENTS.md`. The Moon input fixture covers one parcel label,
  not every parcel state or hidden-label 3D hit target.
- Whole-campaign completion and stars: `npm run test:levels` in Docker.

The runner's 20-minute per-check timeout detects stuck automation. It does not
change gameplay, puzzle moves, optional speed bonuses, or progression.

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
