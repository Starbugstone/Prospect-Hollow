# Source map and verification

Paths below are relative to the repository root. Run commands there, not from
this reference's directory. Consult the source if names or supported content
change; do not treat the current site list as final.

## Owners

| Concern                                                    | Authoritative files                                                                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Shared capture, approach, camera correction, draw, cleanup | `src/game/town/TownPresentation.js`                                                                                                |
| Camera floor and scripted line of sight                    | `src/game/town/TownLandscape.js`                                                                                                   |
| Incident main/inset framing and shared return              | `src/game/town/TownEventCamera.js`, `src/game/town/TownInset.js`                                                                   |
| VIP inset, including Moon subclass                         | `src/game/town/TownVipArrivals.js`, `src/game/town/moon/MoonVips.js`                                                               |
| Map camera ownership and scene routing                     | `src/components/town/TownScene.vue`, `src/game/town/TownDiorama.js`, `src/game/town/moon/MoonScene.js`                             |
| Monument poses and temporary staging                       | `src/game/town/TownMonumentUnveiling.js`, `src/game/town/TownMonumentWorks.js`                                                     |
| Site positions, facing, designs, levels                    | `src/data/townLandmarks.js`; `monumentModel()` measures the real design                                                            |
| Moon surface and crater parameters                         | `moonHeight()` in `src/game/town/moon/MoonScene.js`, `src/data/moonSettlement.js`                                                  |
| Era cinematic camera path                                  | `src/game/town/TownEraShots.js`, checked by `testing/era-cinematic-shots.test.js`                                                  |
| Railway, mine era, campaign finale effects                 | `src/game/town/TownRailwayOpening.js`, `src/game/town/TownMineEraConstruction.js`, `src/game/town/TownCompletionFireworks.js`      |
| Scene definitions, captions, pending/seen receipts         | `src/data/townPresentations.js` and `src/stores/campaignStore.js`                                                                  |
| Clock, modal, reduced motion, pause, completion            | `src/composables/useCinematic.js`, `src/components/town/TownPresentationCinematic.vue`, `src/components/town/TownEraCinematic.vue` |
| Architecture and permanent gameplay/map rules              | `docs/era-architecture.md`, `AGENTS.md`                                                                                            |

## Fast regression checks

```bash
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:24-bookworm-slim npx vitest run testing/cinematic-terrain.test.js testing/town-camera.test.js testing/incident-cameras.test.js testing/monument-construction.test.js testing/moonstone-monuments.test.js testing/mine-era-construction.test.js testing/completion-fireworks.test.js testing/vip-arrivals.test.js testing/moon-vips.test.js
```

`cinematic-terrain.test.js` measures real monument models, exercises authored
shots through the shared presentation frame, and checks a denser line of sight
to the court against both maps' heightfields. It enumerates current sites and
their choices at representative grand/intermediate/wonder levels, portrait and
landscape aspects, and overview/low camera starts. It also checks correction
stability and return-flight floor/exact camera restoration. The original failure
included valley hillside obstructions during the approach and low final shots,
and lunar rim obstruction from a low starting camera outside the crater.

The sweep samples at 0.25 seconds. It does not prove every starting pose, every
frame, every aspect ratio, a full-width silhouette, or non-terrain occlusion.
Add the actual failing pose/time/design when another case is found. Use a finer
time sweep around short-lived faults; retain the permanent manual-orbit tests.

## Real renderer and terrain mesh

For the isolated stack with checkout/mount checks and a backend doctor, use
`bash scripts/verify-gameplay.sh start`, then
`bash scripts/verify-gameplay.sh run "$RUN" cinematics` and the run-owned cleanup.
The journey and evidence paths are documented in
`.agents/skills/verify-prospect-hollow/journeys/cinematics.md`.
Its terrain ray audit includes the valley's hidden source-mesh batching layer,
the exposed mine face and connected shoulder. A downward self-check must hit
the ground. `PH_CINEMATIC_INJECT_OCCLUSION=1` deliberately makes the first shot
look through the ground; the journey must fail and rerun doctor afterward.

Use an unused container name and port when the documented ones are occupied.
If changing the port, set `PH_TEST_ORIGIN` for the browser container too.

```bash
docker run -d --rm --name hollow-cinematic-web --user "$(id -u):$(id -g)" -e HOME=/tmp -p 127.0.0.1:8192:8192 -v "$PWD":/app -w /app node:24-bookworm-slim npm run dev -- --host 0.0.0.0 --port 8192 --strictPort
docker run --rm --network host --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app mcr.microsoft.com/playwright:v1.55.0-noble sh -c 'npm i --no-save --silent --prefix /tmp/cinematic-pw playwright@1.55.0 && PLAYWRIGHT_MODULE=/tmp/cinematic-pw/node_modules/playwright node testing/browser/cinematic-terrain.cjs'
docker stop hollow-cinematic-web
```

The browser fixture uses disposable in-memory Twin Hollows towns, actual valley
and Moon scenes, imported models and software WebGL. It checks rendered terrain
mesh rays every 0.25 seconds at four representative sites with two starting poses
and two viewports, captures approach/middle/final frames, and checks that reduced
motion leaves the camera still. Output defaults to `output/cinematic-terrain/`;
override with `PH_CINEMATIC_OUTPUT`. Review its PNGs and `report.json`.

These are scene fixtures, not proof of opening the cinematic through the normal
UI, receipt persistence, caption layout, audio, input/focus, return animation
composition or physical-phone motion. Exercise those separately for changes
that affect them. Existing settlement journeys are documented in
`.agents/skills/verify-prospect-hollow/feature-map.md`.

To record a normal-speed, silent 16-second canvas clip, set
`-e PH_CINEMATIC_CAPTURE_SITE=earthlight-conservatory` on the browser container
in the command above, before its image name. Supported capture sites are
`meadow`, `monument`, `earthrise-plaza` and `earthlight-conservatory`. The capture
uses the 390 × 844 viewport and the low starting pose. It writes `<site>.webm`
and `<site>-video.json`, including actual frame intervals, under the output
directory. MediaRecorder runs inside Chromium; no host Node or video encoder
is required. A software-rendered recording can stutter even when camera poses
are continuous: distinguish render cadence from path discontinuities using the
intervals and poses. The capture has no caption overlay or audio and cannot
verify either.

The isolated runner also accepts capture directly:
`PH_CINEMATIC_CAPTURE_SITE=earthlight-conservatory bash scripts/verify-gameplay.sh run "$RUN" cinematics`.
Its recording stays under the run's `artifacts/cinematics/` directory.

For a new shot/effect, extend the fixture to capture it. When changing camera
motion, retain a dense frame sequence or record real-time playback rather than
calling three stills a video review. Annotate accelerated or sampled captures;
do not infer real-time smoothness from them. Keep exported video and screenshots
under `output/`, with commit, dirty patch, viewport, renderer, fixture and times.

## Required checks for delivery

Run `npm run verify` using the Node 24 Docker prefix from `AGENTS.md`. It includes
formatting, lint, contracts, application tests, build and bundle budgets. Avoid
running expensive browser measurements concurrently with it.

For frame-code changes, generate the era fixtures with `npm run demo:eras` in
Docker, then run `testing/browser/frame-budget.cjs` with the documented Docker
commands in `docs/development-workflow.md`. Keep its JSON/log output with the
camera evidence. Its workload guards the existing mine/town frame budgets; it
does not profile a new cinematic's clearance cost or measure a physical phone.
If it fails, retain the failure and compare the unchanged baseline with matching
settings before changing unrelated renderer code. Report unresolved gate failures;
do not retry until a lucky pass or treat overlapping timings as an improvement.

When playback state/persistence changes, add the relevant journey and invariant
check. Run `scripts/check-models.sh` for models whose transitions changed, within
the repository's Docker tooling. Camera geometry alone does not require changing
reward or progression models. Do not run slow level simulations for a camera-only
change; do run them if scoring, bonuses, stars or levels also change.
