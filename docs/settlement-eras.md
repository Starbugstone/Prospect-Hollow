# Settlement eras

Eight eras are playable: Frontier → River & Rail → Electric → Post-war Rebuilding → Motor Age → Aviation & Radio (1958) → Music & Television (1986) → Connected City (2005). The village has 53 plots and the campaign has 240 puzzles. See [issue #41 fixes and browser verification](issue41-era-visuals.md) for current behavior. The historical reports below describe earlier milestones.

## Try the eras immediately

Run `npm run dev` and `npm run demo:eras`. The latter creates local fixtures for all eight eras under the ignored `output/era-demo/` directory:

| Fixture                                                      | Starting point                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| `frontier-ready`                                             | All Frontier buildings completed; advance with the town compass      |
| `river-rail`                                                 | Pending second-era transition                                        |
| `river-rail-complete`                                        | All 29 plots at River & Rail level three; Industrial available       |
| `industrial`                                                 | Pending Industrial transition, completed older architecture retained |
| `industrial-lights`                                          | Power house finished; First Lights story pending                     |
| `industrial-complete`                                        | All 34 plots at Industrial level three; Rebuilding available         |
| `motor-age`                                                  | Pending Motor Age transition; levels 1–120 completed                 |
| `motor-age-open`                                             | Motor Age ready for its first new project                            |
| `motor-age-complete`                                         | All 43 plots at Motor Age level three                                |
| `post-war`, `post-war-open`, `post-war-complete`             | Rebuilding transition, ready to build, or all 38 plots completed     |
| `contemporary`, `contemporary-open`, `contemporary-complete` | Crystal City transition, ready to build, or all 48 plots completed   |
| `storm-cleanup`                                              | Saved Contemporary cleanup encounter                                 |
| `cargo-theft`                                                | Saved River & Rail freight-yard encounter                            |
| `workshop-fire`                                              | Saved Industrial fire with an unprotected workshop                   |

Use a **disposable browser profile**: fixtures replace that origin's progress. Execute the matching `.console.js` file from the browser console, then enter the village. Fixtures are developer files, not bundled game content.

Check a transition across reload, dismiss its story, buy a project, complete the required normal puzzles and finish construction. Inspect all three modernization levels, preserved services, the First Lights acknowledgement, and event skip/replay/settlement. Museum replay also advances work; continuous play does not advance construction or Forge Charge.

## Earlier four-era completion, construction and rewards

Era advancement requires every available building at its functional cap and, after Frontier, all three current-era levels. It has no mine-progress gate. Pending construction or an unresolved encounter blocks advancement. River & Rail levels cost 800, 1,200 and 1,400 coins; Industrial levels cost 1,400, 1,850 and 2,300 coins. Motor Age modernization costs 3,500, 4,400 and 5,300 coins; its five new buildings cost 6,480, 9,000 and 11,880 coins per stage. The first Steam modernization takes two normal puzzles; its second and third stages take one each. Electric and Motor Age modernization takes two puzzles and retains existing services. The new buildings take one, two and two completions. Hammers keep their existing instant-build behavior.

The 144-level campaign has twenty-four chapters. Industrial adds 48 levels and Motor Age adds a further 24, with familiar puzzle rules and new mine backdrops. Mine earnings and coin chests retain the chapter-based economy. The power house unlocks electric modernization; row houses add up to sixteen resident places, and the main well's completed Industrial modernization adds twenty water places.

The blacksmith's bounded Forge service, saloon income, inventory and existing town progress remain intact. Frontier bandits evolve into cargo theft in River & Rail, then workshop fires in Industrial. Saved old raids keep their original behavior. Later events occur after 6–14 normal completions, with no offline accrual. Fires never destroy buildings, cap losses at 30 coins, protect the last 50 coins and become fully protected at fire station level three.

## Current implementation checks

`npm run verify` checks formatting, unit/integration tests, deterministic campaign playthroughs and production compilation. Industrial regression tests cover every plot's three tiers, era gates, modernization services, v3 persistence, failed-save rollback, event refunds and settlement, render geometry and bridge-crossing actors. `npm run demo:eras` supplies reproducible browser states.

The earlier Industrial verification passed all 686 tests and the production build. Disposable Chromium checks at `http://127.0.0.1:5173/` covered 1440×900 and 390×844 views, the saved Industrial transition across reload, power-house purchase and completion, the persisted First Lights acknowledgement, completed-town architecture, event skipping, the fire bell's 30-to-15-coin reduction, and cargo bounty persistence. Construction completions were supplied through the store for this UI check; deterministic tests cover puzzle playthroughs.

Forced WebGL unavailability successfully used the SVG village with French text, high contrast and reduced motion. Normal rendering produced no application errors; forced fallback emitted its expected WebGL creation diagnostic. Screenshots and browser logs are in ignored `output/playwright/`. Physical-device performance and a human playthrough of all 48 new levels remain unverified. The build retains the existing large Phaser chunk warning.

The historical browser report below describes the earlier River & Rail release.

## Earlier River & Rail implementation notes

## Persistence and rendering

The existing `crystal-cascade-profile-v3` key is unchanged. Missing era fields default to Frontier while preserving building levels, projects, coins, inventory, records, stock, income and raid receipts. Functional levels and `buildingEras` are separate. Era advancement saves its receipt before showing the date card and rolls back if saving fails. Forge collection saves the spent charge and inventory TNT together, rolling both back if saving fails.

`eras.js`, `frontier.js`, `riverRail.js` and `buildingProgression.js` define eras, buildings and caps. `TownEras` handles eligibility, modernization and normalization; the renderer modules under `game/town/buildings/` handle visual families. Existing plot positions remain stable. Shared layout metadata controls visible plots, SVG projection and permitted transport edges. The bridge exposes the east-bank route graph; the station track crosses the river on its own railway bridge.

The river is carved into the existing deterministic landscape with a gradual valley and wet-bank vegetation exclusions. One lightweight water mesh animates separately from cached terrain. The fisherman, one steamboat and one train use the existing actor/motion lifecycle. Audio adds a quiet river loop and occasional procedural boat/train effects; sources are documented in the audio credits. New construction, modernization and transport details also appear in the SVG fallback. Reduced motion freezes ambient movement, and hidden/paused village state suspends town animation and audio.

Motor Age adds up to six slots per bonus (garage), six visitors (bus station), eighteen residents (garden court), and a 15% saloon income increase (diner). The Steam well adds twenty water at stages two and three; Electric and Motor Age each add twenty more at the final stage. Previous supply carries forward. The main farm adds twenty food at its final Motor Age stage. Electricity and the fire brigade remain active. See [current progression and validation](motor-age-progression.md).

## Verification

Regression coverage includes v3 migration, duplicate/stale completion receipts, bounded Forge storage and collection, consuming collected TNT on a winning move, failed-save rollback, active-run transition blocking, modernization service preservation, joint station/rail completion, east-bank route permissions, bridge-deck movement, campaign playthroughs and audio lifecycle.

Real Chromium verification uses disposable saves to reach late-game states. Purchases, era advancement, the date card, construction finish and modernization are exercised through the UI; some completed-run receipts are supplied through the store to advance multi-puzzle construction without manually replaying an entire campaign. This checks the flow, while automated deterministic playthroughs cover all authored puzzles. It is not a manual balance playthrough of all 144 levels.

Browser checks ran at `http://127.0.0.1:5174/` in Chromium at 1440×900, 390×844, 320×568 and 844×390. They covered the saved transition across reload, station/rail completion, bridge and wharf, modernization, an actual Forge TNT board click, French/high contrast/reduced motion, all 29 SVG plot controls and keyboard station selection. Instrumentation confirmed the same Three.js scene and town soundscape survive mine visits, with audio/motion stopped while hidden. The fallback checks found no uncaught application errors or failed HTTP responses. Forced WebGL loss/restoration rendered successfully; subsequent development hot-reload teardown emitted WebGL resource deletion warnings.

![River and rail expansion in the 3D village](images/river-rail-desktop.png)

![The same river, station and bridge in the accessible fallback](images/river-rail-svg.png)

Era advancement requires only completed town buildings, with no mine-progress gate. The town-center compass and its building card start a 14-second cinematic with a camera sweep, dawn reveal, date and music cues. Skip and reduced-motion paths retain the same saved transition; a reload resumes the pending presentation. The cinematic hides normal town controls and keeps keyboard focus inside its dialog.

A fully defended raid pays 10 coins per captured bandit when dismissed, once per saved raid. The sheriff card and defense receipt explain the bounty. Empty-wallet and partial-defense outcomes pay nothing; defenses completed during the raid can qualify it. Save failures roll back payment and leave the receipt unclaimed.
