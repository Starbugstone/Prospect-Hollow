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
- three commissions and 60 new boards are live, each with its letters, art and French text;
- commissions have an honours family, and the economy evidence has been rerun;
- both commissions and the new boards have been played on a real phone;
- New Hollow Rising, the sixteenth era, is playable to its end on the Moon (see its section below);
- The Quiet Signal, the seventeenth era (the black monolith), is playable to its end as well.

## Where things stand

On `preprod` after `e8d7191f`; nothing below has reached `main`.

| Piece                                                            | State                                    |
| ---------------------------------------------------------------- | ---------------------------------------- |
| Commission contract, `src/data/commissions.js`                   | Done                                     |
| Earthlight Conservatory (Moon), opens at Greenhouse level 3      | Done                                     |
| Homecoming Commons (valley), opens at Homecoming Hall level 3    | Done                                     |
| Signal: map pill, Build sheet pill, letter over the site         | Done                                     |
| Real-game signal check, `testing/browser/town-commission-signal` | Done                                     |
| Real phone test                                                  | Not yet                                  |
| Residents visibly using each outcome                             | Prototype on `preprod`                   |
| Route-choice board prototype (chapter 94)                        | Prototype on `preprod`, debug tools only |
| Pairing prototypes (chapters 92 and 93)                          | Prototype on `preprod`, debug tools only |
| New boards                                                       | Not yet                                  |
| Third commission                                                 | Not yet                                  |
| Honours family, economy rerun, release notes                     | Not yet                                  |
| New Hollow Rising: Moon lot table, roads as data, wider crater   | Done on `preprod`                        |
| New Hollow Rising: the era, its buildings and expeditions        | Not yet                                  |

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

At the optional speed target, 18 late boards last about 40 minutes, so 60 last about two hours. Real play is slower, but boards
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
New Hollow Rising runs beside them and joins this release (owner, 10 November 2026). It needs the
boards: it adds about 1.5M coins of required town, so typical players run out of mine sooner.

## Step 1: close the gaps

**Size: small. Needs you for the phone test.**

Phone test on `preprod`, using a town in Twin Hollows:

- [ ] The pill reads clearly and doesn't crowd the other map controls. On a phone it covered the
      Moon's "New Hollow" header; it now sits below it, and the browser check fails if it overlaps
      the header or the wallet
- [ ] The letter over each site is easy to spot and tap, on both maps
- [ ] All six outcomes look right at each stage
- [ ] Settlers reach the Moon door and come out carrying the outcome's item; valley villagers enter the
      Story Hall, gather at the Bandstand or roam the Wild Meadow (children)
- [ ] The frame rate holds on the Moon with a commission standing

Things the checks have not covered:

- [x] Play a real puzzle and watch the pill advance. The browser check now wins a real level with
      the hint and expects the pill to move from 0 to 1
- [x] Find out why setting `campaign.town` from the browser check did not advance the work. Real
      wins advance both commissions, so it was how the check wrote to the store
- [x] Add the `funding` state to `testing/browser/town-commission-signal.cjs`: it unveils both
      commissions and expects "1/5"
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

The owner has set the board count at 60 (see Decisions). The income figures still decide prices,
and whether a second pack should follow in the next release:

| Median multiple | What it means with 60 boards and both eras                   |
| --------------- | ------------------------------------------------------------ |
| 1.33× or above  | Typical players finish without replays                       |
| Below 1.33×     | They replay; size the next release's pack from the shortfall |

| What the towns show                        | Change to prices                                       |
| ------------------------------------------ | ------------------------------------------------------ |
| Finishers already hold several million     | Raise the stage price before release                   |
| Most monuments are still unbought          | Keep 400k, since those monuments compete for the coins |
| Median town is far below the typical range | Lower the stage price                                  |

Prices only change before release: once shipped, receipts and server replay depend on them.

**Done when** the stage price and the income figures are written in Decisions below, with the sample size.

## Step 3: new boards

**Size: large. This is the main remaining work.**

**60 boards, chapters 92–101, levels 547–606** (owner, 10 November 2026), paying the 92×–101× depth
multipliers. Two eras of new town in this release raise the required town to about 28M coins; with 60
boards a player needs about 1.33× the mine's coins for town and mine to run out together, instead of
about 1.58× with 18. Step 2 no longer sets the count, only the prices.

Ten chapters fill act V (chapters 92–97, levels 547–582) and start act VI (chapters 98–101, levels
583–606), so the act colour sets rotate at chapter 98 as they do every six chapters.

### Content rules

- **New mechanics and board shapes join the pack** (owner, 10 November 2026), alongside fresh
  pairings of existing ones. Each new mechanic must be original (not another game's signature piece),
  readable from its first board, and come with everything a mechanic needs: an entry in the obstacle
  guide (`src/data/obstacles.js`, art, French), a completed-board-marker sample (completed obstacles
  leave no icon), an honours decision (a mine element family or `NON_MASTERY_ELEMENTS`), engine tests,
  hint support so the hint-led player can finish it, and the board motion check. New shapes get the
  motion check too.
- **Append only.** Levels 1–546 keep their hashes, targets and rewards.
- **The text never assumes a town building exists**, because the mine isn't gated by the town era.
  Chapters can't mention New Hollow or a commission. Explain caverns through the crystal.
- **Keep the chapter rhythm:** introduce, practice, deliver, stretch, rest, finale.
- **Unlimited moves.** No move caps or hard timers, and boards must remain recoverable.
- **No ice on extraction levels,** and completed obstacles leave no icon.
- **About 25–30% of levels may be hard three-star challenges.** Only clear outliers get fixed.

### Proposed chapters

Provisional: each pairing has to prove fun and solvable on the board first.

| Chapter | Levels  | Name             | Mechanics                                    | Idea                                             |
| ------- | ------- | ---------------- | -------------------------------------------- | ------------------------------------------------ |
| 92      | 547–552 | Echo gallery     | Lens mirrors, starglass, portals             | Beams and gems take different routes             |
| 93      | 553–558 | Turning orchard  | Moon dials, floatstones, root knots          | Free a root, then turn gravity to carry it       |
| 94      | 559–564 | The deep lantern | Breakthrough chambers, phase seals, lanterns | Break in, then light what was sealed away        |
| 95      | 565–570 | Shifting survey  | Survey markers, phase seals                  | Follow a numbered trail while the colours shift  |
| 96      | 571–576 | Ember sidings    | Charge cores, portals, moon gems             | Cores' bombs open the gates on a portal siding   |
| 97      | 577–582 | Buried routes    | Fossils, route chambers                      | Two ways into a fossil bed; act V finale         |
| 98      | 583–588 | Frost relays     | Frozen gems, spore relays, lanterns          | Bursts thaw a path to the lanterns               |
| 99      | 589–594 | Tidal pearls     | Twin gravity, pearls, ore orders             | Pearls above and below a seam, one order to fill |
| 100     | 595–600 | Rooted vault     | Root knots, breakthrough chambers, chains    | Cut the roots that hold a sealed chamber shut    |
| 101     | 601–606 | The far seam     | Lenses, moon dials, route chambers           | The pack's finale: every way in, every way round |

Chapters 95–101 are proposals: each needs a board on trial, played on a phone, before its chapter is
authored, as 92–94 have. Chapters that introduce a new mechanic or shape replace some of these
pairings once their trial boards are in; the new mechanics are on trial first, as below. None of these pairings has shared a board yet, and a pairing that doesn't play
well is swapped for another existing one rather than forced.

The Echo gallery pairing has been checked on its prototype. A beam passes over a portal pad as it
does over a void, and does not come out of the pad's pair. A player could expect either, so the
prototype keeps every beam clear of the pads, and a test holds it to that. Lenses and portals can
stay together under that rule. A board where a beam must cross a pad needs the rule decided and
explained first.

### Tasks

- [ ] Prototype one board per chapter and play them before authoring the rest
  - [x] Chapter 94: `deep-lantern-routes`, a route-choice board, on trial behind the debug
        tools (`prospectDebug.playPrototype()`, see
        [boards on trial](docs/hollow-mine-levels.md#boards-on-trial)). Not yet played on a phone
  - [x] Chapter 92: `echo-gallery-crossing`, lenses and starglass across a portal route. All
        60 hint-led seeds finish (median 16 moves). Not yet played on a phone
  - [x] Chapter 93: `turning-orchard-both-ways`, two moored floatstones with opposite ways
        out and one moon dial. All 60 seeds finish (median 21 moves). Not yet played on a phone
  - [ ] Play all three on a phone and decide which pairings go ahead. On `preprod` they are
        listed under Boards on trial in Settings (More options), from the village
  - [ ] Chapters 95–101: one board on trial each, measured on 60 hint-led seeds like the first three,
        then played on a phone
  - [x] New mechanics and board shapes: candidates proposed; Trace twins, Crossgrain crystal and
        Chord crystal built with a board on trial each; Arrowhead and fixed Twin windows tried
  - [ ] Play the five new mechanic/shape trials on a real phone and confirm the teaching boards
- [ ] Add the chapters to `PLANS` in `src/data/hollowMineLevels.js`, with names, stops and tips.
      Consider a new file if this one, already 1,720 lines, gets harder to read
- [ ] Add French names, stops and tips to `src/i18n/fr.json`
- [ ] Measure with 30 seeds: `node scripts/measure-campaign.mjs . 30`, then
      `node scripts/calibrate-star-targets.mjs <file> 547 606`
- [ ] Set chest targets at 80% of the median score and add the star targets
- [ ] Hold out seeds 101–120 and lower any star target leaving under a third of runs with three stars
- [ ] Extend `testing/hollow-mine-levels.test.js`: the append, names, reachable cargo, reachable
      starglass, completion on held-out seeds and completion beyond 100 moves
- [ ] Regenerate in Docker: `node scripts/export-honour-levels.mjs`, `npm run export:save-rules`,
      `node scripts/export-public-content.mjs`
- [ ] Update hardcoded counts: `scripts/measure-economy-balance.mjs` (546), `docs/README.md`,
      `docs/town-demo.md`, `docs/settlement-eras.md`
- [ ] Add a guide for levels 547–606, its own page beside `docs/hollow-mine-levels.md`

### Approved new mechanics and shapes

Owner, 10 November 2026: **Trace twins, Crossgrain crystal, Chord crystal**;
**Crystal stair renamed Arrowhead**, clearing only, and **Twin windows fixed**
(two-row windows, three-wide spine). Echo twins and the other proposals are not
being built. [Rules, tradeoffs and measurements](docs/new-mechanics.md) keep the
review record.

Five debug-only trials use slots 548, 554, 560, 549 and 555. All 300 hint-led
runs (60 per board) finish; medians are 6 / 14 / 6 / 15 / 12 moves respectively.
Chest targets are exactly 80% of median score. Trace copies damage a gate in
60/60 runs, Crossgrain needs both direction and blast progress in its narrow
neck, and Chord fills a median five of six sockets by changing colours. The
shapes retain a possible three-cell match line at every playable cell. All five
motion scenarios pass; physical phone play remains unchecked above.

Trace copies only the player's swap matches on the stamp, including every line
of a T/L. Cascades and blasts do not spend it. Copies are discrete cells, not
beams: **lenses do not turn them**. Its trial contains no lenses. Crossgrain
blasts seal only one crack per move. Chord counts only matches on its own cell;
a blast fills one white wildcard socket per move. Each completed marker leaves
an ordinary cell. The three trial-only elements are deliberately non-mastery.

### What to check beyond the boards

- [ ] A player who already finished level 546: the mine must offer 547 rather than the museum
- [ ] `campaignCompletion` counts more levels, so a "perfect" campaign is no longer complete. Check
      that nothing earned or displayed goes backwards
- [ ] Seam Explorer lists levels 1–546 by name. Leave it: shipped ranks don't change, and new levels
      earn it nothing
- [ ] Chest coins and VIP spending at chapters 92–101 still pass the server's checks
- [ ] Each new level adds three workshop credits, so moonstone supply rises slightly

### Checks

`npm run verify`, `npm run test:levels`, `testing/chapter-progression.test.js`, and the board motion
check if any board uses a new shape.

**Done when** all 60 boards complete on held-out seeds, the targets are calibrated and a player on the
old last level can carry on.

## Step 4: third commission

**Size: medium. Recommended in the valley, using shared contracts.**

The Moon's crater is now wider (see New Hollow Rising), but its outer ring belongs to the new era's
buildings and their two proposed commissions. Keep this third commission in the valley.

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

### Residents using the result

Brought into this release (owner, 6 November 2026). Each outcome's `use` in `src/data/commissions.js`
says what residents do there, read through `commissionUse` on both maps (`TownCommissionUse.js`,
`TownCommissionResidents.js`, `MoonSettlers.js`). A third commission adds its own `use`, or its visitors
gather at the front.

- [ ] Valley streets end about 40 units short of the Commons, so villagers cross the open field for the
      last stretch. `AGENTS.md` asks for public paths: a footpath to the site is the proposed fix
- [ ] Decide the Bandstand audience size (capped at 4, `MAX_COMMISSION_VILLAGERS`), the children's
      0.68 scale and whether Moon outcomes differ beyond what settlers carry

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

## New Hollow Rising (the sixteenth era)

**Size: large. Joins this release (owner, 10 November 2026).** Era id `hollow-rising`, 2335. New
Hollow stops living off the ribbon and becomes a town of its own: its own water and orchards, a
school for the first Moon-born children and a tram on a second ring road. The valley keeps its Twin
Hollows look. The full design, with file references, is `output/next-era/moon-expansion-design.md`
(git-ignored; its decisions are copied here).

Story: "New Hollow has outgrown its first ring. The crater floor is cleared to the rim, a little tram
circles the new streets, and the first children born under Earthlight are walking to school."

### Where it grows: done

The level floor reaches radius 63, the rim crest 75. An outer ring road at 45 and six spokes (0°,
45°, 135°, 180°, 225° and 315°, as `Math.atan2(z, x)`) are drawn and walkable. Lots live in one table
in `src/data/moonSettlement.js`, roads in `MOON_ROADS`, and a lot names the ring its path joins.
Every existing lot, path and settler route is unchanged.

The outer lots go on a circle of radius 55, one every 22.5° from 11.25°, so none sits on a spoke.
They join the lot table with their buildings: the tests require the lots to match the Moon buildings.

| Slot | Angle  | Position        | Use                             |
| ---- | ------ | --------------- | ------------------------------- |
| 0    | 11.25  | `[53.9, 10.7]`  | Ring Market                     |
| 1    | 33.75  | `[45.7, 30.6]`  | Crater Inn                      |
| 2    | 56.25  | `[30.6, 45.7]`  | Dewfall Cistern                 |
| 3    | 78.75  | `[10.7, 53.9]`  | Commission site A               |
| 4    | 101.25 | `[-10.7, 53.9]` | Moonstone monument site         |
| 5    | 123.75 | `[-30.6, 45.7]` | Orchard Vaults                  |
| 6    | 146.25 | `[-45.7, 30.6]` | Moonball Field (optional)       |
| 7    | 168.75 | `[-53.9, 10.7]` | Crater School                   |
| 8    | 191.25 | `[-53.9,-10.7]` | Lantern Row                     |
| 9    | 213.75 | `[-45.7,-30.6]` | Earthview Terraces              |
| 10   | 236.25 | `[-30.6,-45.7]` | Commission site B               |
| 11   | 258.75 | `[-10.7,-53.9]` | Starwatch Dish                  |
| 12   | 281.25 | `[10.7, -53.9]` | Crater Pond Garden (low)        |
| 13   | 303.75 | `[30.6, -45.7]` | Empty: the saucer's flight line |
| 14   | 326.25 | `[45.7, -30.6]` | Expedition Garage               |
| 15   | 348.75 | `[53.9, -10.7]` | Ring Tram stop                  |

### Buildings (proposal)

Ten required and two optional Moon buildings, `settlement: 'moon'`, three levels each:

| Building           | Effects per level     | Unlocks after            |
| ------------------ | --------------------- | ------------------------ |
| Ring Tram stop     | 4 visitors, 1 comfort | Era start                |
| Dewfall Cistern    | 12 water, 1 comfort   | Era start                |
| Orchard Vaults     | 12 food, 1 comfort    | Era start                |
| Lantern Row        | 6 homes, 1 comfort    | Tram 1                   |
| Ring Market        | 4 visitors, 2 comfort | Tram 1, Vaults 1         |
| Crater School      | 2 visitors, 3 comfort | Lantern Row 1            |
| Earthview Terraces | 6 homes, 1 comfort    | Lantern Row 2, Cistern 1 |
| Expedition Garage  | 2 comfort             | Tram 2                   |
| Crater Inn         | 4 visitors, 2 comfort | Market 1                 |
| Starwatch Dish     | 2 visitors, 3 comfort | School 1, Garage 1       |
| Moonball Field     | 3 comfort, optional   | School 1, Market 1       |
| Crater Pond Garden | 3 comfort, optional   | Cistern 2, Vaults 2      |

At level 3 they add 84 demand, 84 water, 84 food and 51 comfort, as Twin Hollows did. Five existing
Moon buildings modernize: the Ribbon Landing (a terminal), the Crater Ice Well and the Earthlight
Greenhouse (each +16 water or food per level), the Commons (a town hall) and the Rover Barn (rovers on
the outer ring). Moon art draws by building level only today, so Moon modernization needs a finish
parameter and its own offer text.

### Things to do (proposal)

- **Rover expeditions:** choose a destination at the Expedition Garage, wait four completed puzzles,
  tap the returned rover to unload coins, moonstones or a postcard. No clock, never fails.
- Two Moon commissions on the outer ring (the teachers, the rover crews) and a third moonstone
  monument.
- Four Moon projects that each pay a builder hammer, two more VIP spending places, letters home.

### Cost (guess until measured)

Prices on the ladder: 20,000 / 22,600 / 25,200 to modernize, 33,750 / 37,500 / 41,250 to build. The
required part costs about 1.48M coins, about 20 completed puzzles of late mining; Twin Hollows took 23.
The required town rises to about 26.5M, which moves the crossover from 1.53× to about 1.62× (1.50×
with the 18 new boards).

### Tasks

- [x] One table for the Moon lots, with every pose, path and letter unchanged
- [x] Roads as data: rings, spokes, lots naming their ring, settlers walking between rings
- [x] The wider crater: floor to 63, rim to 75, outer ring and spokes, craters kept off the roads
- [ ] Phone check of the wider crater (below)
- [ ] The era and its ten required buildings: definition, lots, art (3D and SVG), letters, projects,
      French text, a needs test that the finished era houses everyone, an era demo fixture, exports,
      and an era transition that opens the Moon. Keep the era `enabled: false` until the next task
- [x] Moon modernization: art finishes, offer text, the two supply tiers, rovers on the outer ring
- [x] The town square modernizes in this era, so its ring-roads fountain shows (owner, 10 November)
- [x] The era cinematic hands over to the Moon map, since every new building stands there
- [x] The wandering pair: a raccoon on its hind legs and a Willowkin, found in the valley or on the
      Moon with the astronaut's rewards, through one shared hidden-find contract (owner, 10 November)
- [x] Enable the era on `preprod` (owner, 10 November 2026). Commissions never gate it: a test
      moves a finished Twin Hollows town on with a commission chosen and part paid for
- [ ] Phone pass of the era: the wider crater, the outer ring, the modernized buildings, the
      wandering pair
- [ ] Before release: decide whether a save in the new era needs save schema 5, so an older
      cached client treats it as read-only instead of normalizing the unknown era away
- [ ] The optional buildings, the tram and child settlers
- [ ] The moonstone monument site, then the two commissions
- [ ] Rover expeditions: client, server replay, presentation and an economy rerun
- [ ] Honours (below), French text, docs (`docs/future-eras.md`, `docs/era-architecture.md`)

### Phone check of the wider crater

- [ ] The rim and the wider plain look right, and the empty outer ring reads as room to grow
- [ ] The overview still frames New Hollow as before
- [ ] On a phone the commission pill now covers part of Earth: it moved below the Moon header in the
      first gap-closing pass. Earth stays tappable around it, and "Back to the valley" is unchanged.
      Decide whether the pill or the camera should move

### Decisions still open

These wait until the era's content is built:

1. Five modernized Moon buildings, two adding supply, or modernization for looks only (the cistern
   and vaults then carry all the new supply).
2. Era size: 10 required and 2 optional buildings, about 1.48M coins, or larger.
3. Prices on the ladder above.
4. Expeditions as the era's own loop, and their rewards.
5. The two Moon commissions: their price (2M as now, or less) and how they fit the Commissioner
   family. Its site list is fixed once it ships, so decide before this release.
6. Through the Ages stops at diamond (the era goes in `NON_MILESTONE_ERAS`) or gains a fifth metal.
   Proposed new families: Outer Ring Builder (1, 15, 30 of 36 building levels) and Rim Surveyor
   (expeditions), with `HONOURS_VERSION` 7.
7. Late projects that pay a builder hammer.

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

If commissions land, the next decision is issue #42's town stories or more on the Moon. If they don't,
the next release should lean on boards and new mechanics.

## Decisions

- **A sixteenth era after all, on the Moon only** (owner, 10 November 2026). Playing the endgame, the
  owner found too little to do or build, especially on the Moon. New Hollow Rising joins this release.
  It replaces the earlier "not a sixteenth era yet": it does not re-art the valley.
- **New mechanics and board shapes in the pack** (owner, 10 November 2026), not only pairings of
  existing mechanics.
- **60 new boards** (owner, 10 November 2026): chapters 92–101, levels 547–606, sized for two new eras
  of town rather than waiting for step 2's income figures.
- **The Quiet Signal joins this release too** (owner, 10 November 2026): the era after New Hollow
  Rising, built around a black monolith on the Moon, planned in the owner's "Plan the Moon's Monolith
  Era" thread. It adds required town on top of New Hollow Rising, so the board pack and the economy
  rerun matter even more.
- **New Hollow grows by widening its crater** (owner, 10 November 2026), not by a second Moon map or
  a second crater. One map keeps every map contract in one place. The rim and the small craters move
  for every player, Twin Hollows towns included; the owner accepted this.
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
- **Route walls count toward no goal.** Every wall on a level would otherwise be required, so
  a route-choice board would need both routes. A chamber marked `route: true` keeps its wall
  out of the goal and may hold nothing the goal counts. No new obstacle or art.
- **Boards on trial stay out of the campaign.** Chapters are six levels each, so one board
  can't be appended alone. Prototypes play through the debug tools and save nothing.
- **This file is the one plan.** Everything from the earlier plan lives here, so nothing can drift.
- **The game aims to be very long** (6 November 2026, owner): many hours of play, so new content and
  mechanics keep coming after this release.
- **Who replays.** A player who min-maxes should finish everything without replaying a level. Lower
  earners are pointed to replays once no new level is left: the next step offers "Replay levels"
  rather than the last level's number.
- **Owning, choosing and watching are all rewarding**, and events are welcome. Optional event
  countdowns stay as `AGENTS.md` allows them, built only when an event design needs one.
- **Route-choice boards join step 3.** Chapter 94 gets one prototype first: either route opens the
  goal, neither is required, and each order must play differently.
- **Residents using commissions joins this release** instead of waiting for the phone test.
- **Labels name the building that stands.** Once a design is chosen, every label shows it rather than
  the site's name. Map labels and tabs are checked at phone sizes first.

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
