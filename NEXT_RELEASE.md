# Next release: Beyond New Hollow

The working plan for the next release. Keep it current while the work is under way: tick steps,
record decisions and correct anything that turns out wrong. **Delete this file in the change that
merges the release into `main`.** Lasting facts belong in `docs/`.

## Goal

Give players a reason to keep going after the current content, without another full town rebuild.
A settlement asks for something, the player chooses what it becomes, and its residents use the
result. The loop that carried 15 eras stays: a completed puzzle visibly changes a place the player
cares about.

The release is finished when:

- a player at either ending has something new to do: new boards if the mine ran out first, new
  places to build if the town did;
- three commissions and at least 18 new boards are live, each with its letters, art and French text;
- commissions have an honours family, and the economy evidence has been rerun;
- both commissions and the new boards have been played on a real phone.

## Where things stand

On `preprod` at `7de2b6af`; nothing below has reached `main`.

| Piece                                                            | State   |
| ---------------------------------------------------------------- | ------- |
| Commission contract, `src/data/commissions.js`                   | Done    |
| Earthlight Conservatory (Moon), opens at Greenhouse level 3      | Done    |
| Homecoming Commons (valley), opens at Homecoming Hall level 3    | Done    |
| Signal: map pill, Build sheet pill, letter over the site         | Done    |
| Real-game signal check, `testing/browser/town-commission-signal` | Done    |
| Real phone test                                                  | Not yet |
| New boards                                                       | Not yet |
| Third commission                                                 | Not yet |
| Honours family, economy rerun, release notes                     | Not yet |

## What the numbers say

Figures come from three bot seeds over all 546 levels, using current prices. They exclude chests,
hammers, the saloon and visitors.

The required town costs about **25.0M** coins and the 546 levels pay about **16.3M** in mine coins.
What decides a player's first ending is how far their total income exceeds mine coins. **Below
about 1.53×, the mine runs out first.**

| Income vs mine coins | First ending | Detail                      | Who                  |
| -------------------- | ------------ | --------------------------- | -------------------- |
| 1.0×                 | Mine         | Town needs 117 more replays | Mine coins only      |
| 1.2×                 | Mine         | Town needs 61 more replays  | Assumed typical      |
| 1.4×                 | Mine         | Town needs 20 more replays  | Assumed typical      |
| 1.53×                | Both         | Level 546                   | Crossover            |
| 1.75×                | Town         | Level 517, 29 boards left   | Committed player     |
| 1.92×                | Town         | Level 501, 45 boards left   | Today's power player |

Only the 1.92× row rests on something we know: power players, who ground and min-maxed, finish the
town around level 500. That makes level 500 the upper bound, not the norm. The typical range is an
assumption until step 2 replaces it.

- **Typical players need new boards first**, because they run out of mine with the town unfinished.
- **Power players need places to build first**, because they run out of town with boards left.
- **Prices are set for the typical player.** A power player being faster is fine.

### How many boards

New boards pay more each chapter, so each pack covers players with a lower income. Anyone at or
above the multiple shown no longer replays before the town finishes.

| New boards | Chapters | Mine coins by the end | Covers players at or above |
| ---------- | -------- | --------------------- | -------------------------- |
| 18         | 92–94    | about 17.7M           | 1.41×                      |
| 36         | 92–97    | about 19.1M           | 1.31×                      |
| 60         | 92–101   | about 21.0M           | 1.19×                      |

At the optional speed target, 18 late boards last about 40 minutes. Real play is slower, but boards
are consumed quickly, so a pack alone cannot carry the release.

### What commissions cost

Each costs 2M coins, in five even stages of 400k. Building takes the shared 7 completed puzzles, so
coins set the pace, at about the rate of Twin Hollows' last stretch.

| Income | Boards per stage | One commission | Three commissions |
| ------ | ---------------- | -------------- | ----------------- |
| 1.0×   | 5.4              | 27             | 81                |
| 1.3×   | 4.2              | 21             | 62                |
| 1.5×   | 3.6              | 18             | 54                |
| 1.92×  | 2.8              | 14             | 42                |

Other optional spending competes with this: coin monuments cost about 9.1M at their cheapest full
builds, and both stone monuments need 400 moonstones.

## Order of work

1. Close the gaps in what has shipped to `preprod`.
2. Replace the assumed income range with real numbers. This sets the board count.
3. New boards.
4. Third commission.
5. Honours family.
6. Economy rerun and documentation.
7. Release.

Steps 3 and 4 do not depend on each other. Boards come first because they serve the larger group.

## Step 1: close the gaps

**Size: small. Needs you for the phone test.**

Phone test on `preprod`, using a town in Twin Hollows:

- [ ] The pill reads clearly and doesn't crowd the other map controls
- [ ] The letter over each site is easy to spot and tap, on both maps
- [ ] All six outcomes look right at each stage
- [ ] Settlers reach the Moon door; visitors circle the valley site
- [ ] The frame rate holds on the Moon with a commission standing

Things the checks have not covered:

- [ ] Play a real puzzle and watch the pill advance. The browser check loads a save to reach `ready`
      rather than playing one. Unit tests cover the advance itself
- [ ] Find out why setting `campaign.town` from the browser check did not advance the work. It may
      only be how the test wrote to the store, but a real puzzle in the step above settles it
- [ ] Add the `funding` state ("2/5") to `testing/browser/town-commission-signal.cjs`
- [ ] Re-capture Wild Meadow at stage 5, since its sign moved after the last capture
- [ ] Watch the valley visitors moving. The Bandstand and Story Hall bring Willowkin residents, the
      only resident visitors a valley site has, rather than ordinary villagers
- [ ] Read the French aloud. "Commande" is my choice for "commission" and needs your approval

**Done when** every box is ticked or moved to a later step with a reason.

## Step 2: replace assumptions with real numbers

**Size: small. Needs you, because the admin panel is yours to sign in to.**

Note counts only: no emails or names need to leave the panel.

1. Open the admin overview and read towns by era and campaign progress.
2. For a sample of active towns, note the era, highest level, coin balance and which monuments they own.
3. Estimate each town's income multiple: the cost of the eras it has finished, divided by the mine
   coins at its highest level. No lifetime coin counter is saved, so this is the best available
   measure. Any town works, not only finishers, which gives far more than a handful of power players.

| Era finished | Total cost so far | Level where mine coins alone pay for it |
| ------------ | ----------------- | --------------------------------------- |
| Frontier     | 0.02M             | 26                                      |
| River & Rail | 0.12M             | 55                                      |
| Industrial   | 0.32M             | 85                                      |
| Post-war     | 0.70M             | 125                                     |
| Motor Age    | 1.35M             | 170                                     |
| Aviation     | 2.19M             | 217                                     |
| Broadcast    | 3.31M             | 267                                     |
| Contemporary | 4.88M             | 328                                     |
| Tomorrow     | 6.80M             | 387                                     |
| Canopy       | 9.11M             | 436                                     |
| Riverlight   | 11.89M            | 482                                     |
| Skysail      | 15.17M            | 531                                     |
| Stargazer    | 18.98M            | After level 546                         |
| Moonward     | 23.37M            | After level 546                         |
| Twin Hollows | 24.95M            | After level 546                         |

A town that finished an era well before the level shown is out-earning the mine. Regenerate the exact
per-level coins with `node scripts/measure-campaign.mjs . 3 546` in Docker, because the earlier samples
were lost when `/tmp` was cleared. Keep them under `output/next-release/`.

**Decisions this sets**

| Median multiple | Board count                                                   |
| --------------- | ------------------------------------------------------------- |
| 1.41× or above  | 18 boards                                                     |
| 1.31–1.41×      | 36 boards                                                     |
| Below 1.31×     | 36 boards now, and consider a second pack in the next release |

| What the towns show                        | Change to prices                                       |
| ------------------------------------------ | ------------------------------------------------------ |
| Finishers already hold several million     | Raise the stage price before release                   |
| Most monuments are still unbought          | Keep 400k, since those monuments compete for the coins |
| Median town is far below the typical range | Lower the stage price                                  |

Prices only change before release: once shipped, receipts and server replay depend on them.

**Done when** the board count and price are written in Decisions below, with the sample size.

## Step 3: new boards

**Size: large. This is the main remaining work.**

Default until step 2 says otherwise: **18 boards, chapters 92–94, levels 547–564**, paying the 92×–94×
depth multipliers.

### Content rules

- **No new mechanics in this pack.** Fresh combinations of existing ones avoid a new obstacle guide,
  honours family and engine work, and make this the cheapest way to add discovery.
- **Append only.** Levels 1–546 keep their hashes, targets and rewards.
- **The text never assumes a town building exists**, because the mine isn't gated by the town era.
  Chapters can't mention New Hollow or a commission. Explain caverns through the crystal.
- **Keep the chapter rhythm:** introduce, practice, deliver, stretch, rest, finale.
- **Unlimited moves.** No move caps or hard timers, and boards must remain recoverable.
- **No ice on extraction levels,** and completed obstacles leave no icon.
- **About 25–30% of levels may be hard three-star challenges.** Only clear outliers get fixed.

### Proposed chapters

Provisional: each pairing has to prove fun and solvable on the board first.

| Chapter | Name             | Mechanics                                    | Idea                                       |
| ------- | ---------------- | -------------------------------------------- | ------------------------------------------ |
| 92      | Echo gallery     | Lens mirrors, starglass, portals             | Beams and gems take different routes       |
| 93      | Turning orchard  | Moon dials, floatstones, root knots          | Free a root, then turn gravity to carry it |
| 94      | The deep lantern | Breakthrough chambers, phase seals, lanterns | Break in, then light what was sealed away  |

Check the Echo gallery pairing first. Lenses and portals have never shared a level, so beams and
portal cells may not interact as a player expects. If so, swap in spores and lenses.

### Tasks

- [ ] Prototype one board per chapter and play them before authoring the rest
- [ ] Add the chapters to `PLANS` in `src/data/hollowMineLevels.js`, with names, stops and tips.
      Consider a new file if this one, already 1,720 lines, gets harder to read
- [ ] Add French names, stops and tips to `src/i18n/fr.json`
- [ ] Measure with 30 seeds: `node scripts/measure-campaign.mjs . 30`, then
      `node scripts/calibrate-star-targets.mjs <file> 547 564`
- [ ] Set chest targets at 80% of the median score and add the star targets
- [ ] Hold out seeds 101–120 and lower any star target leaving under a third of runs with three stars
- [ ] Extend `testing/hollow-mine-levels.test.js`: the append, names, reachable cargo, reachable
      starglass, completion on held-out seeds and completion beyond 100 moves
- [ ] Regenerate in Docker: `node scripts/export-honour-levels.mjs`, `npm run export:save-rules`,
      `node scripts/export-public-content.mjs`
- [ ] Update hardcoded counts: `scripts/measure-economy-balance.mjs` (546), `docs/README.md`,
      `docs/town-demo.md`, `docs/settlement-eras.md`
- [ ] Add a guide section for levels 547–564, in `docs/hollow-mine-levels.md` or its own page

### What to check beyond the boards

- [ ] A player who already finished level 546: the mine must offer 547 rather than the museum
- [ ] `campaignCompletion` counts more levels, so a "perfect" campaign is no longer complete. Check
      that nothing earned or displayed goes backwards
- [ ] Seam Explorer lists levels 1–546 by name. Leave it: shipped ranks don't change, and new levels
      earn it nothing
- [ ] Chest coins and VIP spending at chapters 92–94 still pass the server's checks
- [ ] Each new level adds three workshop credits, so moonstone supply rises slightly

### Checks

`npm run verify`, `npm run test:levels`, `testing/chapter-progression.test.js`, and the board motion
check if any board uses a new shape.

**Done when** all 18 boards complete on held-out seeds, the targets are calibrated and a player on the
old last level can carry on.

## Step 4: third commission

**Size: medium. Recommended in the valley, using shared contracts.**

The Moon's flat ground is used up inside radius 41. Making room would change existing terrain or move
rover traffic, so leave the Moon at one commission for now.

### Proposal

Provisional, for you to change:

**The Willowkin Commons.** The Willowkin neighbours write, since they've been part of every chapter
since Canopy and have never yet asked for anything.

| Outcome         | What it is                                  | Who visits            |
| --------------- | ------------------------------------------- | --------------------- |
| Seedling Grove  | A nursery for trees bound for the Moon      | Willowkin             |
| Lantern Orchard | Fruit trees hung with lanterns              | Willowkin and animals |
| Story Tree      | One great old tree the valley gathers under | Animals               |

### Tasks

- [ ] Choose a site. `[14, -102]` and `[-4, -102]` look clear on distance alone. The layout, fog and
      road tests have the final say, as they caught the first valley position
- [ ] Add an `opens` kind that waits for another commission, such as `{ site, level: 1 }`, on client
      and server (`areaUnlocked`, `TownPersonalisation::purchase`). It must never close once open, so
      read the bought level, which only rises
- [ ] Open the third commission after either of the first two stands, so a Moon-first and a
      valley-first player both reach it
- [ ] Add the site, designs, art and fallback previews, on the same 2M schedule
- [ ] Add the letters and French text
- [ ] Add the honours decision, regenerate the catalogs and extend `testing/commissions.test.js`
- [ ] Run `testing/browser/town-commission-signal.cjs` with three commissions open

### Later, if the phone test asks for it

Valley visitors circle the site, while Moon residents walk to a door. If that feels thin, the next step
is real villagers using a door along the public paths. It's a larger change, so judge it from the phone
test rather than building it in advance.

**Done when** the third commission opens in order on both client and server, and no combination of
opening order blocks it.

## Step 5: honours family

**Size: small.**

- [ ] Add one family, working name **Commissioner**, using the existing `landmarks` measure over a
      fixed list of the three sites, which the server already supports
- [ ] Ranks: bronze 1, silver 2, gold 3 commissions sponsored
- [ ] Raise `HONOURS_VERSION` to 6 and set `since: 6`
- [ ] Remove the sites from `NON_MONUMENT_HONOURS`, since the test requires one or the other
- [ ] Add the ranks to `testing/fixtures/shipped-honour-ranks.json`
- [ ] Calibrate with `scripts/measure-honours.mjs` and record the evidence in `docs/honours.md`
- [ ] Regenerate catalogs and keep `testing/honours.test.js` and `backend/tests/honours.php` green

A later commission can't join a shipped list. It gets new ranks at the end or a new family.

No rank is needed for the boards, because they add no gem, element, era or fusion.

**Done when** existing saves catch up once and see the new ranks as new, and the server verifies them.

## Step 6: economy rerun and documentation

**Size: small to medium.**

- [ ] Rerun `scripts/measure-economy-balance.mjs` with the new levels and optional sites. Its pattern
      buys optional foundations, so two or three new 400k foundations will shift its dates slightly
- [ ] Record the result in `docs/economy-balance.md`, including whether the crossover has moved
- [ ] Add commissions to `docs/future-eras.md` and `docs/era-architecture.md`, including how to add one
- [ ] Add a commissions rule to `AGENTS.md`: the shared contract, the need for an honours decision and
      that they never gate anything. Ask first, since it's a lasting rule

**Done when** no document still describes 546 levels as the end, or commissions as Moon-only.

## Step 7: release

- [ ] Add a player-facing entry to `src/data/updates.js`, with French text
- [ ] Bump the version to 1.3.0 in `package.json`
- [ ] Full Docker checks: `npm run verify`, level simulations, all backend suites and PHPStan
- [ ] Browser checks: Moon input, Moon labels, phone layout and the commission signal
- [ ] Final phone pass on `preprod`
- [ ] Confirm `main` is an ancestor of `preprod`
- [ ] Open the PR from `preprod` to `main`. **Delete this file in that PR**
- [ ] Deploy the backend and catalogs before the client, because old servers reject unknown content
- [ ] Confirm the release header on production

### What to watch afterwards

Use the admin overview, about two weeks after release:

| Question                           | Where to look            | What it decides                          |
| ---------------------------------- | ------------------------ | ---------------------------------------- |
| Do players choose a commission?    | Sampled towns            | Whether commissions are worth continuing |
| Do they finish it?                 | Stage reached            | Whether 400k is right                    |
| Do players return after level 564? | Active towns by progress | How large the next pack should be        |
| Which outcomes get chosen?         | Sampled towns            | Which kinds of place to write next       |

If commissions land, the next decision is a sixteenth era as the finale or issue #42's town stories.
If they don't, the next release should lean on boards and new mechanics.

## Decisions

- **Not a sixteenth era yet.** A full era re-arts the whole town and repeats the most repetitive part of
  the loop.
- **Any completed puzzle builds a commission**, as monuments already do. Tying builds to new chapters
  would lock out power players still short of level 547.
- **Commissions open at a finished building level, not at town completion.** Building levels only rise,
  so an open site can't close, and the server needs one comparison. They stay optional and never gate an
  era.
- **Permanent outcomes, shared boards.** The choice is permanent, and no board is ever locked out.
- **One signal, from one status.** `commissionStatus()` reports `request`, `work`, `ready` or `funding`,
  most pressing first. The pill reuses the project pill's look and shows only while a commission is open.
- **No toast, modal or dismiss button.** A gold ring pulses three times for `request` and `ready`, and
  stops under reduced motion. It saves nothing new. Revisit dismissing if players find it naggy.
- **Landmark Patron stays as shipped.** Its measure is fixed, so commissions get their own family.
- **This file is the one plan.** Everything from the earlier plan lives here, so nothing can drift.

## Risks

| Risk                                                   | What limits it                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| The income range is a guess                            | Step 2 comes before the boards are sized                       |
| Boards are consumed far faster than they are made      | Commissions extend play, and step 7's data sizes the next pack |
| Prices are hard to change after release                | Checked against real balances in step 2                        |
| The pill feels naggy to a player who ignores it        | Phone test, with a dismiss option if needed                    |
| A new `opens` kind drifts between client and server    | Both are tested from the same exported catalog                 |
| Parallel work on `preprod` joins an unfinished release | Hold back the release PR until step 7                          |
| Valley visitors feel thin next to the Moon's           | Phone test, with real villagers as a follow-up                 |

## Branch and delivery

Work goes on `preprod`, which holds everything on `main` plus this release. Commit and push each
finished, verified step. If something must reach `main` first, branch the hotfix from `main`, then merge
`main` back into `preprod` in the same task. An open PR from `preprod` to `main` would pull in this
unfinished release, so open it only at step 7.

## Rules that still apply

Unlimited moves and no puzzle timers. Completed obstacles leave no icon. Every map keeps the shared pad,
tap gesture, camera and build flow, and overlays hold only labels, action buttons and the header. Shipped
honours never change. Commissions never gate an era, a puzzle or a reward. All checks run in Docker.
