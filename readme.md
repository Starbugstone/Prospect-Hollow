# Prospect Hollow

Prospect Hollow is a frontier town-building puzzle game built with Vue, Pinia, Phaser and Three.js. Match jewels through 324 levels across fifty-four chapters, earn resources, build a small 3D Old West settlement, and carry the town into new eras.

> [!IMPORTANT]
> **Source available — not open source.** Current development is licensed under the [Prospect Hollow Source Available License 1.0](LICENSE). You may inspect, clone, build, run, and modify it privately for evaluation and contribution, but you may not redistribute it, publish derivative builds, release it through an app store, or use it commercially without written permission. Third-party dependencies and credited assets retain their own licenses.
>
> Historical repository content through commit `c773a0c5be6c5dea41b9c8b99e31ef5017304fca` keeps any permissive rights already granted, and Starbugstone additionally licenses the copyright it owns in that historical snapshot under MIT. See [historical licensing](LICENSE-HISTORY.md).

## Run locally

Requires Node.js 20.19+ (or 22.12+).

```sh
npm ci
npm run dev
```

Open http://localhost:5173 for the introduction, then enter Prospect Hollow. Tap a plot to open its building sheet; the first materials are free. The plots have open yards and narrow dirt tracks between them, with prairie around the village. Drag to rotate and scroll or pinch to zoom. Click the mine or the Mine tab to play the next unfinished puzzle. Village, Mine, and the completed Museum are available from the village header. The mine has a visible Back to village control on desktop and phones; returning saves open directly in the village. Basic wells, farms, and homes open immediately. Each normal completion advances every active construction project. Frontier work takes one completion; the bridge, station and modernizations take two. Tap the scaffolded building in the village to finish it and activate its benefits. The visual action panel highlights ready buildings and the next useful upgrade, with food, water and defense indicators inside the full-screen village. Fund multiple projects when you have the coins.

Build the museum to replay completed levels or enter continuous play on any unlocked level. Continuous play keeps going beyond the objectives, saves its own scores, and grants no chests or construction progress; its coin allowance is capped at 25 per level across all visits. Choose **Exit mine** beside the saved-coin total when finished to return to the village with your earnings. The button becomes available once any active cascade finishes. Build and upgrade the armory to raise each puzzle bonus limit from 3 to 5, 8, then 20. Chests can also contain coins or a builder hammer; use one hammer instead of coins to build or improve an unlocked building instantly for free. Hammers cannot be spent on work already in progress. Starting or finishing a building plays a one-second assembly animation with recorded hammer taps; sound volume and reduced-motion settings are respected.

A completed mine pays **1 coin per collected gem + 10 coins per bonus gem left on the board**. The recap celebrates the saved total with a coin burst and count-up, keeps the detailed breakdown in a disclosure, and offers matching Continue mining (pickaxe) and Back to village (house) buttons. Reduced motion displays the total immediately.

Build the shop to buy one random puzzle power after each completed normal mine run. Each shop level adds one choice, up to all five puzzle powers. Tap an item to purchase one; sold-out stock, insufficient funds, and full storage disable purchases. Clear Row and Shuffle cost 60 coins; other puzzle powers cost 90. All building and upgrade coin prices are 50% higher than the original catalog; free first materials remain free. Builder hammers are rare rewards available only in mine bonus chests. Reloading or abandoning a run does not refresh stock. Continuous play does not refresh it.

Short contextual tips explain the first building and mine. Open the illustrated village tour on demand from the village’s (i) icon. The village opens full screen, with a coin counter and a book button for the story popup. The parcels list puts construction ready to finish first, followed by affordable coin purchases and then hammer-only work. Tap a ready entry to finish construction directly from the list. Light-blue labels mark available purchases, and light-green labels mark buildings ready to finish. Small golden sparkles mark available work even with building labels hidden. Drag to rotate the village camera, Shift-drag or middle-drag to pan, and scroll to zoom. On touch screens, use two fingers to pan and pinch to zoom. The expand icon fills a mobile viewport with the village; close it or press Escape to return. Every completed six-level chapter adds free visual improvements to the mine, through all fifty-four chapters.

Frontier has 22 plots, including a town square with a central fountain between the well and mine. Supporting buildings finish at level 3; the town square, sheriff, bank, saloon and blacksmith finish at level 5. Purchases have no mine-level or completed-puzzle lock. Upgrades add visible improvements and wooden scaffolding during work. Upgrading the original home, well, and farm unlocks six extra plots. Roads, saloon visitors, and mounted travelers make the village busier. Stables and museum galleries attract visitors, using spare food and water after residents are housed. Residents and visitors both spend at the saloon. The happiness gauge below the village combines basic needs, the square, museum, saloon, and school; each happiness point increases saloon income by 1.25%, with up to eight hours stored in the saloon. Its base income is 2.25 coins per customer per saloon level per hour; tap the saloon to collect with a brief coin burst rising from the building. Larger villages attract larger mounted bandit gangs. The bank and sheriff each cover up to half the coins at risk; upgrade both for full protection. The village mixes a soft acoustic soundtrack with recorded birds and distant outdoor conversations. Recorded construction, mining, horses and raid cues follow village activity. Zooming in makes the ambience clearer and louder while music stays steady. Village effects are mixed 10% quieter than before. [Audio credits](public/sound/village/credits.html) are also available from Settings.

The full site follows the browser's English or French language preference. Settings includes a confirmed **Start a new village** action to restart the town, campaign, and power inventory on this device.

Complete all Frontier buildings to advance to **1884 · River & Rail Boom**. Modernize familiar landmarks while preserving their services, build a wharf and railway station, and open four east-bank plots by finishing the bridge. The station’s first construction includes its connecting railroad. The blacksmith makes one TNT after 6 completed normal puzzles at level 1, improving to 5, 4, 3 and 2 puzzles at levels 2–5. It stores only one; tap to collect it into your armory and start the next cycle. Mine earnings scale from 1× in chapter 1 to 54× in chapter 54. Coin chests pay 500 coins per chapter for the first three chapters, then add 250 per chapter up to a 4,000-coin cap; older pending receipts keep their saved reward rules. Building upgrades have no completed-puzzle locks, and the level-4 town square gains a bell that halves remaining raid losses once per raid. Complete all three River & Rail levels on every plot to enter **1908 · Industrial / Electric Town**. Build a power house, fire station, row houses and mill, and give every existing landmark three substantial Industrial upgrades. Electricity lights the village; cargo theft and workshop fires give the later eras their own village encounters. Complete each era’s building upgrades to continue through **1920 · Post-war Rebuilding**, **1932 · Motor Age**, **1958 · Aviation & Radio**, **1986 · Music & Television**, and **2005 · Connected City**. All eight eras are playable. Motor Age adds a garage, bus station, garden court and diner; later eras introduce the airport, broadcasting and city landmarks. The final era has 54 plots. Existing v3 progress is preserved. See [settlement eras and quick testing](docs/settlement-eras.md), including disposable demo saves generated with `npm run demo:eras`.

See the [town demo guide](docs/town-demo.md) for the story, the one-time release reset, mounted bandit raids, stored saloon income, and implementation details.

```sh
npm test              # Game logic and input regression tests
npm run build         # Production output in dist/
npm run preview       # Serve the production build
npm run format:check  # Check source formatting
npm run assets        # Regenerate gem, bonus, power and ice artwork
```

## Testing resources from the console

Open the running game's browser developer console and run:

```js
prospectDebug.grant({ coins: 100000, hammers: 5 });
```

This adds 100,000 coins, tops up builder hammers to their normal cap of 5, saves immediately, and returns the new balances. Run it again whenever you need more resources. Change `coins` or `hammers` to choose the amounts; `prospectDebug.grant()` uses the same defaults. The command is available in development and built previews.

Two more console cheats save immediately:

```js
prospectDebug.prepareEra(); // Fully upgrade the current era; wait for your transition click.
prospectDebug.prepareEra('industrial'); // Prepare the end of a chosen era.
prospectDebug.mineStage(12); // Unlock and open chapter 12 (starting at level 67).
```

Run `prepareEra` after exiting the mine. It returns to the village with every building available in that era fully built and upgraded, construction completed, and old incidents and presentations dismissed. Click the town square's era-change action when ready; the cheat does not start the next era or its cinematic. Era IDs, in order: `frontier`, `river-rail`, `industrial`, `post-war`, `motor-age`, `aviation`, `broadcast`, `contemporary`. The final era has no next-era button. Choosing an earlier era removes later-era buildings from this test town. Puzzle records and inventory are preserved.

`mineStage` accepts a **chapter number from 1–54**, not a level number. It opens that chapter's first puzzle immediately, ending any current run. Missing earlier levels are marked completed with zero score and one star to unlock the chapter; existing scores are preserved. Skipped levels grant no coins, chests, chapter gifts or construction progress. You can also revisit earlier chapters without building the museum. Unlocks persist across reloads; re-run the command to revisit a chosen chapter. Both cheats save immediately; export your save in Settings first if you want to keep an untouched copy. Invalid values are rejected and failed saves restore the previous state.

To preview the **three-star completion celebration**, enter the mine and run:

```js
prospectDebug.completeMine(); // Unlock every mine level, give each 3 stars, and queue the celebration.
```

Then use **Back to village**. The celebration starts on returning to the village, after any pending raid or era transition. The command leaves the current puzzle running and saves all 324 levels as completed with three stars. Existing scores and best times are preserved; previously unplayed levels get a zero score. It grants no coins, chests, chapter gifts, inventory or construction progress. Run it again inside the mine to re-arm the celebration even if you already watched it. The command requires an active mine session; if needed, `prospectDebug.mineStage(1)` opens one, including on an already completed save without a museum. Export your save in Settings first if you want to preserve your real progress. Failed saves restore both records and the celebration receipt.

## Playing

Swipe a gem, or tap two neighboring gems. Match at least three to break the ice underneath them. Fresh ice has frosted edges; damaged ice cracks, then shatters to reveal a dark cleared tile. Four in a line creates a sparking bomb; five creates a rotating rainbow orb; a T or L match creates a pulsing cross launcher. Swipe a bonus to activate it, or double-tap/double-click it to activate in place. Complete every displayed objective to finish, including ice, stone, ore orders and the later signal and relic tasks; the score target and best cascade determine extra stars.

- **Clear Row:** clears a random row.
- **TNT:** a red dynamite bundle that blasts a 3 × 3 area around the selected gem. Existing saved mine hammers migrate to TNT; builder hammers keep their separate artwork and inventory.
- **Color Wand:** clears gems of the selected color.
- **Shuffle:** mixes the board.
- **Tile Breaker:** clears the selected row and column.

Power-ups start empty, with room for three of each before building the armory. Completed levels, best scores, stars, inventory and town progress save together in local storage (`crystal-cascade-profile-v3`). This legacy storage key is deliberately retained across the Prospect Hollow rebrand so existing progress survives. New progress persists normally; keep this save key unchanged in future releases. Saves stay on this device; clearing browser storage can erase them. In the village, open the cog settings and use **Save a backup file** to download a JSON backup. Use **Load a backup file**, choose that file, and confirm **Replace and continue** to restore it on this or another device. Import replaces the current village, completed levels, scores and inventory; export first to keep a copy. Unfinished mine boards are not included. No-move boards reshuffle automatically without a score penalty.

The normal-run coin recap includes every cascade bonus: ×2 adds 5 coins, ×3 adds 10, ×4 adds 15, and each higher tier adds another 5. These stack within and across moves, so a cascade reaching ×4 earns 30 extra coins. Clearing two lines in the same step also earns 10 extra coins, three earns 20, and each additional simultaneous line adds 10. T/L shapes count as two lines; bonus blast footprints and relic pickups do not. Simultaneous matches get a special banner, and the recap groups both bonus types by tier and occurrence count. Coins are saved once on level completion; abandoning a run discards its bonuses. Continuous mode keeps its existing gem-based payout and cap.

Stone starts at level 7. Match directly beside a block, or hit it with a bonus, to deal one damage per cascade step. Diagonal matches do not count. Blocks occupy cells and divide the falling column: gems below them can fall, but no new gems enter that section until the stone breaks. Gold-banded stone, introduced at level 19, needs two hits. Double ice starts at level 13. The first two chapters use four jewel types on a 6 × 7 board; chapters 3–6 use five on 7 × 8, and chapters 7–12 keep five on 7 × 9. Dimensions and active jewel count stay fixed within a chapter. Jewel identities rotate in two-level seams, including refills. Each chapter introduces a gentler opening, a lighter fifth puzzle, and a finale. Frozen gems enter at level 31, chains at 43, seals at 49, and relic delivery at 55. Twelve distinct mine chambers frame the board. See [campaign pacing and mechanic ideas](docs/campaign-progression.md) for the design, research and measured playthroughs.

Every completed normal puzzle earns **at least one chest**, even with a low score and a relaxed pace. Qualifying score and speed chests retain their existing rules, up to two openings; a completion chest fills in when neither target is reached. Each chest contains one reward. When everything fits in storage, automatic prizes remain 70% puzzle powers, 20% coins and 10% builder hammers, with a hammer guaranteed within ten automatic rolls while hammer storage has room. Within powers, the weights are Clear Row 30%, TNT 25%, Color Wand 20%, Shuffle 10% and Tile Breaker 15%. Automatic rolls skip full items and reserve room for unopened prizes. A manual roulette stop still selects the displayed item; ordinary overflow converts to coins. Chest tiers retain identical reward counts. Tap a chest to open, stop the reel or let it finish, and tap the prize to continue. Skipping or reloading settles the saved automatic prizes exactly once.

Every first completion of a six-level chapter also upgrades the mine appearance and directly awards a chapter gift: TNT, Color Wand, Clear Row and Tile Breaker rotate across the fifty-four chapters. Full gift storage becomes 100 coins per chapter. Replays do not repeat chapter gifts. A six-stamp trail previews the next gift in the village and results, while coins, supplies and useful building actions lead the win screen. Score, stars, moves and time remain available under **Puzzle highlights**. The village gains roaming dogs, a cat, farmyard hens and pigeons, occasional foxes and raccoons on the outskirts, animal feeding, a neighbor fetching water, chats at the square and chimney smoke as buildings open. Animals avoid indexed scenery and use completed outdoor habitats and actual power-pole perches. Pigeons eat the thrown grain after it lands; uneaten grain expires after 2.4 seconds in a fixed pool of fourteen particles. These routines share the existing pause, visibility and reduced-motion lifecycle. See [casual progression and village life](docs/casual-progression.md).

Speed targets follow each puzzle’s obstacle workload: levels 1–36 allow 90 seconds plus two seconds per layer; later levels allow 75 seconds plus one second per layer and 20 seconds per relic. The first level allows 154 seconds. The clock counts only when the board is ready for input, excluding intros, cascades, the expanded mobile controls, settings and background tabs. Missing the speed target never ends the run. The fastest time is saved alongside progress. Reduced motion reveals the bonus immediately, and the normal animation can be skipped.

The board’s lightbulb shows a move immediately; automatic hints still appear after waiting. The (i) guide explains the level’s obstacles, with a paused introduction the first time each appears. Seals carry distinct shapes and R/S/E marks; chains, exits and remaining hits have clearer overlays.

The mine header shows the level and remaining objectives. Open Level status and controls for full objective progress, score, active time, star requirements, audio, settings and the play guide; opening these controls pauses play and the optional speed clock. The arcade banner stays above the board, which uses the available screen space. Owned power-ups show their icons, quantities and short labels, beneath the board in portrait and beside it in landscape. After the opening two chapters, a compact objective header and a smaller feedback strip give the taller boards more room. Narrow phones show remaining counts and a check mark for cleared goals; pause details retain completed/total progress. The board supports touch swipes and tapping two neighbors.

Keyboard controls: focus the board with Tab, use arrows to move, Enter or Space to select, and Shift + arrow to swap. Escape cancels a selection or closes settings. Settings include music, sound effects, reduced motion and high contrast. The board uses the available viewport space on desktop and phones.

Mining is accompanied by **“Lanterns Below”**, an original two-minute, 64 BPM instrumental with warm plucked strings, low sustained tones and distant crystal echoes. Its seamless loop and soft entrance sit beneath the gem effects, at the same restrained music level as the village. The score uses no external samples; regenerate its OGG and MP3 assets with `FFMPEG=/path/to/ffmpeg node scripts/generate-mining-music.mjs`.

## Project structure

- `src/game/engine/`: level generation, matches, bonuses, gravity and deterministic hints.
- `src/game/phaser/`: rendering, animation, gesture input and pooled particles.
- `src/stores/`: game sessions, saved campaign progress, inventory and preferences.
- `src/components/`: menus, board host, HUD and dialogs.
- `public/art/`: generated SVG gems, animated bonus atlas, illustrated powers and ice. The generators live in `scripts/`; Phaser rasterizes the art once when loading.
- `testing/`: Vitest regression tests running in Node, without a browser or canvas mock.

Phaser loads when a chapter opens. Vue never wraps the renderer's internal object graph in reactive proxies. Bonuses use an eight-frame animation atlas and a 230 ms activation wind-up and 160 ms impact beat. Shockwaves, directional blasts, rainbow lightning and ice shards run alongside the clear and fall phases. Bonus and combo banners occupy a fixed strip above the board. Screen-edge glows, expanding firebursts, cross beams and lightning accompany activated bonuses. Cosmetic effects may continue after the board becomes playable; every board animation is cancellable on a level change.

See [the era architecture guide](docs/era-architecture.md) for loading, presentation and navigation contracts. Capacitor configuration and the existing Azure deployment workflow are retained; native platforms need their usual platform setup before using the `cap:*` commands.

Run `npm run verify` for formatting, generated-footprint drift, the complete regression suite, and production chunk budgets. GitHub Quality checks runs the same command for pull requests and pushes to main and develop; verify it and the Vercel preview before merging a release.

Mine teardown explicitly releases its WebGL context. If the village loses its graphics context, it rebuilds the 3D scene on a fresh canvas while preserving the camera. Repeated recovery failures use the playable SVG town. Interrupted frame-cache renders restore renderer state before another draw.
