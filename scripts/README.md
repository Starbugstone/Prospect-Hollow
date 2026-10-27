# Scripts

Developer tools. None of them are imported by the game. Run Node tools in Docker
as described in [AGENTS.md](../AGENTS.md#local-checks-run-in-docker); Blender
scripts run with `blender --background --python <script>`.

## Build and checks (run by npm scripts)

| Script                                                   | Purpose                                                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `split-mesh-catalogs.mjs`                                | Splits the Blender mesh exports into bounded lazy chunks before dev/test/build.                           |
| `generate-footprints.mjs`, `footprint-generator.js`      | Builds building footprints; `--check` fails on drift (`npm run check:footprints`).                        |
| `check-bundle-budget.mjs`                                | Fails the build when a JavaScript chunk exceeds its budget.                                               |
| `create-era-demo.mjs`                                    | Writes disposable demo saves for each era (`npm run demo:eras`).                                          |
| `export-public-content.mjs`                              | Writes the public-town allowlist and the honours and distinctions catalog the server verifies.            |
| `export-honour-levels.mjs`                               | Writes the mine elements each level uses for the museum's honour icons; `--check` detects drift.          |
| `export-save-rules.mjs`, `save-rules.js`                 | Exports shared accounting rules for cloud save integrity; `--check` detects stale definitions.            |
| `create-integrity-fixtures.mjs`, `integrity-fixtures.js` | Generates actual frontend action snapshots for PHP accounting regression checks; `--check` detects drift. |

## Game art and audio

| Script                                                                                                            | Purpose                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate-gems.mjs`, `generate-bonus-art.mjs`                                                                     | Regenerate the SVG gems, bonus atlas, powers and ice (`npm run assets`).                                                                                  |
| `generate-board-atlas.mjs`                                                                                        | Rasterizes the board art into PNG atlases (`npm run assets:board`).                                                                                       |
| `generate-mining-music.mjs`                                                                                       | Renders the original “Lanterns Below” mine loop; needs `FFMPEG`.                                                                                          |
| `generate-era-audio.mjs`                                                                                          | Synthesizes the river, train and steamboat loops in `public/sound/village`.                                                                               |
| `prepare-village-audio.mjs`, `prepare-raid-audio.mjs`, `prepare-incident-audio.mjs`, `prepare-monument-music.mjs` | Rebuild the licensed village, raid and incident recordings and the monument unveiling music listed in `public/sound/village/credits.html`; need `FFMPEG`. |
| `blender_assets.py`, `city_primitives.py`, `city_identity.py`                                                     | Shared Blender helpers for the asset packs below.                                                                                                         |
| `create-city-assets.py`, `create-future-assets.py`, `create-leisure-assets.py`                                    | Author and export the city, aviation-to-connected and leisure meshes.                                                                                     |
| `create-monument-assets.py`                                                                                       | Author Monument Square's five sculptures, mechanism pivots, runtime meshes and matching card portraits.                                                   |

## Balance measurements

| Script                         | Purpose                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `measure-campaign.mjs`         | Deterministic hint-led playthroughs, optionally against another checkout.                                                                        |
| `measure-town-progression.mjs` | Replays those measurements through construction, rewards and chest strategies.                                                                   |
| `compare-town-economy.mjs`     | Replays the same mining payouts against two content revisions.                                                                                   |
| `calibrate-star-targets.mjs`   | Proposes star score targets from measured scores; never overwrites them.                                                                         |
| `measure-economy-balance.mjs`  | Plays the measured payouts through the whole economy: production, prices, honours and VIP hours ([economy balance](../docs/economy-balance.md)). |
| `measure-honours.mjs`          | Reports the fixed honour ranks' pacing from normal and continuous measurements ([honours](../docs/honours.md)).                                  |
| `measure-moonstones.mjs`       | Compares moonstone workshop production and prices from the measured payouts ([moonstones](../docs/moonstones.md)).                               |
| `measure-vip-income.mjs`       | VIP arrivals, admissions and purchases per active hour in the valley and on the Moon ([VIP economy](../docs/vip-economy.md)).                    |
| `vip-tour-harness.mjs`         | The valley VIP tour harness shared by the economy and VIP measurements.                                                                          |

## Browser reviews (Playwright callbacks)

Start Vite, open a disposable browser session, then run a callback with
`playwright-cli run-code "$(cat scripts/<file>)"`. The media-tooling skill sets
up Playwright on WSL.

| Script                                           | Purpose                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `capture-completion-fireworks.js`                | Captures the three-star celebration frames from an era-demo save.    |
| `capture-vip-review.js`, `package-vip-review.py` | Captures the VIP visitor review from era-demo saves and packages it. |

## Review pages (served by Vite)

Open `/scripts/<page>.html` on the dev server. They draw production models and never
touch a save.

| Script                                                                                         | Purpose                                                                                                 |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `town-actor-review.html`, `town-actor-review.js`                                               | Villager outfit and construction review page.                                                           |
| `cozy-building-review.html`, `cozy-building-review.js`                                         | The six cozy-era landmarks with their geometry budgets.                                                 |
| `cozy-character-review.html`, `cozy-character-review.js`                                       | Canopy and Riverlight villagers and animals.                                                            |
| `era-art-review.html`, `era-art-review.js`, `era-art-fixtures.js`, `package-era-art-review.py` | Era review galleries built from review towns (`era-art-fixtures.js`), archived under ignored `output/`. |

Pass/fail browser checks, such as the board motion and mine feedback checks, live in
`testing/browser/` and share `testing/browser/helpers.cjs`.

`bash scripts/verify-gameplay.sh all` starts an isolated Docker stack, checks backend
readiness, runs the four [gameplay verification journeys](../.agents/skills/verify-prospect-hollow/feature-map.md),
then cleans up its containers and volumes. Logs and screenshots remain under
`output/verification/run-*`. Run `bash scripts/verify-gameplay.sh --help` for individual
journeys, the doctor and cleanup's dry run.

## Hosting

| Script                                   | Purpose                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `build-release.sh`, `backup-database.sh` | Manual release build and database backup; see [hosting](../docs/backend/hosting.md). |
| `o2switch/`                              | The verified o2switch deployment controller; see its [README](o2switch/README.md).   |
