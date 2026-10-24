# Prospect Hollow

Prospect Hollow is a town-building puzzle game built with Vue, Pinia, Phaser and Three.js. Match jewels through **546 puzzles in 91 chapters**, earn resources and grow a frontier settlement through **15 eras**, from the Old West to Twin Hollows on the Moon.

> [!IMPORTANT]
> **Source available — not open source.** Current development is licensed under the [Prospect Hollow Source Available License 1.0](LICENSE). You may inspect, clone, build, run, and modify it privately for evaluation and contribution, but you may not redistribute it, publish derivative builds, release it through an app store, or use it commercially without written permission. Third-party dependencies and credited assets retain their own licenses.
>
> Historical repository content through commit `c773a0c5be6c5dea41b9c8b99e31ef5017304fca` keeps any permissive rights already granted, and Starbugstone additionally licenses the copyright it owns in that historical snapshot under MIT. See [historical licensing](LICENSE-HISTORY.md).

## Run locally

Use Docker with Node 24, matching the frontend build image. From the repository root:

```sh
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:24-bookworm-slim npm ci
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -p 5173:5173 -v "$PWD":/app -w /app node:24-bookworm-slim npm run dev -- --host 0.0.0.0
```

Open http://localhost:5173. Signed-out play works locally and offline. For account saves, use the [Docker Compose setup](docs/backend/hosting.md#local-installation).

## Playing

Swipe two neighboring gems, or tap them in turn, to match three. Four in a line creates a bomb, five creates a rainbow orb, and a T or L creates a cross launcher. Swipe a bonus or double-tap it to activate. Complete the displayed objectives to finish the puzzle.

**Moves are unlimited.** Missing an optional speed or score target never ends play or blocks completion. A board without a legal match reshuffles for free. Completed obstacles leave ordinary cells. Stars depend on score and cascades, as explained in [star ratings](docs/star-ratings.md).

Normal puzzle completions pay coins, award chests and advance active construction projects. Tap a ready building to finish it and activate its benefits. A builder hammer can fund and finish an eligible new project instantly. Every Frontier building has three stages; later eras modernize existing buildings and add new plots. Era advancement depends on town construction rather than mine progress. In Twin Hollows, the last era, the town also builds New Hollow on the Moon, which plays like the valley: tap a parcel in 3D to open it, build from the same Build tab with the same construction animations (no cinematic for ordinary buildings), and read New Hollow's letters in the Story tab.

The village's bottom tabs open Village, Build, Mine, Personalise, Story and More; a new town's guided first buildings use a shorter bar. More holds town projects, the museum, Town Honours, supplies, shared towns, help and settings. Build the museum to replay completed puzzles or enter continuous play. Continuous play has no objective finish and awards no chests, stars or construction progress; its coin allowance is 25 per level across all visits, while play can continue after that allowance is used.

English and French, keyboard board controls, high contrast, audio settings and reduced motion are supported. Local progress retains the legacy `crystal-cascade-profile-v3` storage key. Settings can export and import JSON backups; accounts can back up three independent towns with conflict recovery. See [browser saving](docs/backend/browser-saving.md) before changing save behavior.

The current campaign extends through Tomorrow City (325–372), the [five deeper mine groups](docs/deep-mine-levels.md) (373–402) and [the floating seam](docs/hollow-mine-levels.md) (403–546). The latter introduces floatstones, lenses, phase seals, portal pads and gravity switches. Its guide includes the latest portal, chained-cargo and floatstone recordings.

Use the [documentation index](docs/README.md) for current gameplay, architecture, art and backend guides. [Historical reports](docs/history/README.md) retain earlier designs and measurements.

## Test saves and diagnostics

The game has no console cheats: nothing typed in the browser console adds coins, unlocks levels or finishes an era. To try a later era, a finished town or a saved encounter, generate the disposable era saves in Docker:

```sh
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:24-bookworm-slim npm run demo:eras
```

This writes a `.json` save and a `.console.js` snippet for each state to the ignored `output/era-demo/`. Use a disposable browser profile: running a `.console.js` snippet in the game's console replaces that origin's progress with the fixture and reloads. [Settlement eras](docs/settlement-eras.md#try-an-era-immediately) lists every fixture. Export your save in Settings first if you want to keep it.

Development (`npm run dev`), the preprod site and builds made with `VITE_DEBUG_TOOLS=true` also expose read-only diagnostics as `prospectDebug`; production builds leave them out. They never change the save:

```js
prospectDebug.townTimings(); // Town construction and rebuild phase timings, plus long tasks.
await prospectDebug.townFrameStats(5); // Per-frame render costs over five seconds.
prospectDebug.showNavigation(true); // Draw villager navigation footprints and routes.
```

The [rendering performance log](docs/town-rendering-performance-log.md#on-device-checks-for-preprod) explains how to read them.

## Development and checks

All local checks run in Docker. Use this prefix for `npm run verify`, individual tests, formatting or asset generators:

```sh
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app node:24-bookworm-slim npm run verify
```

`verify` runs formatting, ESLint and knip, generated-footprint checks, regression tests and a production build with chunk budgets. Level simulations are separate: run `npm run test:levels` with the same Docker prefix after changing levels, star targets, scoring or bonuses. Board animation, gravity and shape changes also require the [board motion check](docs/deep-mine-levels.md#board-motion-check). See [contributor rules](AGENTS.md) for backend checks, permanent gameplay contracts and the settlement map rules every map shares.

The [scripts index](scripts/README.md) describes asset generation, balance measurement, browser reviews and hosting tools. Reproducible screenshots, review exports and local demo saves belong in ignored `output/`; see [workspace maintenance](docs/workspace-maintenance.md).

## Project structure

- `src/game/engine/`: level generation, matches, bonuses, gravity and deterministic hints.
- `src/game/phaser/`: board rendering, animation and input.
- `src/game/town/`: Three.js town layout, buildings, actors, incidents and cinematics.
- `src/data/`: shared campaign, era, building, reward, event and honours definitions.
- `src/stores/`, `src/services/`: game state, persistence, cloud sync and read-only developer diagnostics.
- `src/components/`: town, mine, account and share-link interfaces.
- `src/assets/`, `public/art/`: authored meshes and runtime artwork; preserve authoring sources.
- `backend/`: PHP/Symfony account-save API.
- `testing/`: game regression tests, level simulations and browser checks.

See [era architecture](docs/era-architecture.md) for shared loading, presentation and navigation contracts. Capacitor configuration is retained; native platforms need their usual setup before using the `cap:*` commands. Music and recorded effects are credited in [audio credits](public/sound/village/credits.html).

## Account backend and deployment

Accounts provide opt-in backups, revisions and shared town visits while gameplay remains local. See [hosting](docs/backend/hosting.md), [security](docs/backend/security.md), [privacy](docs/backend/privacy.md), [save integrity](docs/backend/save-integrity.md) and the [API contract](docs/backend/openapi.yaml).

The `preprod` branch deploys to o2switch after its exact commit passes Quality checks. The private hosting controller and cron job must be enabled on the host; see [preproduction setup](docs/backend/preprod.md) and [production deployment](docs/backend/production.md).
