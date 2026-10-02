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
| `export-public-content.mjs`                              | Writes the building, era and level ids the backend's public-town projection accepts.                      |
| `export-save-rules.mjs`, `save-rules.js`                 | Exports shared accounting rules for cloud save integrity; `--check` detects stale definitions.            |
| `create-integrity-fixtures.mjs`, `integrity-fixtures.js` | Generates actual frontend action snapshots for PHP accounting regression checks; `--check` detects drift. |

## Game art and audio

| Script                                                                              | Purpose                                                                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `generate-gems.mjs`, `generate-bonus-art.mjs`                                       | Regenerate the SVG gems, bonus atlas, powers and ice (`npm run assets`).                                                 |
| `generate-board-atlas.mjs`                                                          | Rasterizes the board art into PNG atlases (`npm run assets:board`).                                                      |
| `generate-mining-music.mjs`                                                         | Renders the original “Lanterns Below” mine loop; needs `FFMPEG`.                                                         |
| `generate-era-audio.mjs`                                                            | Synthesizes the river, train and steamboat loops in `public/sound/village`.                                              |
| `prepare-village-audio.mjs`, `prepare-raid-audio.mjs`, `prepare-incident-audio.mjs` | Rebuild the licensed village, raid and incident recordings listed in `public/sound/village/credits.html`; need `FFMPEG`. |
| `blender_assets.py`, `city_primitives.py`, `city_identity.py`                       | Shared Blender helpers for the asset packs below.                                                                        |
| `create-city-assets.py`, `create-future-assets.py`, `create-leisure-assets.py`      | Author and export the city, aviation-to-connected and leisure meshes.                                                    |

## Balance measurements

| Script                         | Purpose                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `measure-campaign.mjs`         | Deterministic hint-led playthroughs, optionally against another checkout.      |
| `measure-town-progression.mjs` | Replays those measurements through construction, rewards and chest strategies. |
| `compare-town-economy.mjs`     | Replays the same mining payouts against two content revisions.                 |
| `calibrate-star-targets.mjs`   | Proposes star score targets from measured scores; never overwrites them.       |

## Browser reviews (Playwright callbacks)

Start Vite, open a disposable browser session, then run a callback with
`playwright-cli run-code "$(cat scripts/<file>)"`. The media-tooling skill sets
up Playwright on WSL.

| Script                                                                  | Purpose                                                                     |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `verify-mine-feedback.js`                                               | Checks that tips, celebrations and targeting never move or cover the board. |
| `capture-completion-fireworks.js`                                       | Captures the three-star celebration frames from an era-demo save.           |
| `capture-vip-review.js`, `package-vip-review.py`                        | Captures and packages the VIP visitor review.                               |
| `town-actor-review.html`, `town-actor-review.js`                        | Villager outfit and construction review page served by Vite.                |
| `era-art-review.html`, `era-art-review.js`, `package-era-art-review.py` | Era building gallery and the wiki's packaged images.                        |

## Hosting

| Script                                   | Purpose                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `build-release.sh`, `backup-database.sh` | Manual release build and database backup; see [hosting](../docs/backend/hosting.md). |
| `o2switch/`                              | The verified o2switch deployment controller; see its [README](o2switch/README.md).   |
