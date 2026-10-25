# Town Honours

Town Honours ([issue #60](https://github.com/Starbugstone/Prospect-Hollow/issues/60)) are a
permanent, town-specific collection of **families**, each a ladder of metal **ranks**: bronze is
earned by just playing, silver needs some steering and gold needs active pursuit. Later content
adds diamond and further metals at the end of a ladder. A three-slot showcase is visible to
visitors. The badge and its presentation are the reward: honours never change coins, chests,
construction, progression or puzzle rules, and never add move limits, timers or progression
gates.

`src/data/honours.js` is the single registry. `testing/honours.test.js` and
`testing/honours-tracking.test.js` cover it, including the coverage checks that keep it in step
with the content (see [Extending content](#extending-content)).

## Principles

- **Fixed goals.** A shipped rank's goal, measure and metal never change. Goals are fixed numbers
  or named milestones, never "all levels" or "the final era", so a content update cannot move a
  goal under a player. `testing/fixtures/shipped-honour-ranks.json` records every shipped rank;
  the registry test fails if one changes.
- **Growth appends.** New content adds ranks at the end of a family (diamond, then later metals)
  or new families. Rank IDs are `<family>-<metal>`, so they are predictable and never reused.
- **Permanent.** Earned honours are never revoked, reset or re-evaluated away; they keep the
  requirement version they were earned under.
- **Reachable.** No honour can be missed for good: every family can still progress through
  museum replays, the forge, incidents or visits, whatever era the town is in.

## Catalogue

| Tab     | Family                                    | Bronze                  | Silver                      | Gold                          |
| ------- | ----------------------------------------- | ----------------------- | --------------------------- | ----------------------------- |
| Mine    | Stars (three-star puzzles)                | 25 · Rising Star        | 150 · Star Collector        | 300 · Perfect Prospector      |
| Mine    | Score (best ÷ star target, from lvl 37)   | 1.5× · Score Hunter     | 2.5× · Score Ace            | 3× · Score Legend             |
| Mine    | Fusion                                    | 1 fusion · First Fusion | 6 different · Fusion Master | 300 fusions · Fusion Virtuoso |
| Mine    | Ruby, Sapphire, Emerald Laureate          | 500                     | 10,000                      | 25,000                        |
| Mine    | Topaz, Amethyst, Moonstone Laureate       | 500                     | 6,000                       | 16,000                        |
| Mine    | Relic Keeper (relics delivered)           | 10                      | 125                         | 360                           |
| Mine    | Lamplighter (lanterns lit)                | 10                      | 50                          | 125                           |
| Mine    | Trail Surveyor (survey trails)            | 5                       | 20                          | 60                            |
| Mine    | Ore Merchant (ore orders)                 | 10                      | 40                          | 110                           |
| Mine    | Core Engineer (charge cores)              | 10                      | 50                          | 125                           |
| Mine    | Gate Breaker (blast gates)                | 10                      | 50                          | 130                           |
| Town    | Through the Ages                          | Reach River & Rail      | Reach Music & Television    | Complete the Riverlight Age   |
| Town    | Town Guardian (incidents fully protected) | 5 · Watchful Town       | 25                          | 60 · Hollow Sentinel          |
| Town    | Forge Veteran (TNT from the forge)        | 5 · The Forge Delivers  | 100                         | 250 · Forge Master            |
| Town    | Master Quartermaster                      | —                       | —                           | 5 powers held at 26 at once   |
| Town    | A Lasting Legacy                          | —                       | —                           | Build your first monument     |
| Friends | Visitors (different signed-in players)    | 1 · First Guest         | 5 · Welcoming Host          | 15 · Celebrated Town          |
| Friends | Village Explorer (villages visited)       | 5 · Curious Neighbour   | 15 · Seasoned Traveller     | 30 · Village Explorer         |

A rank without its own name uses the family name; the metal is always shown beside it.

**Floating seam additions (honours version 4).** Levels 403–546 added two gems and outgrew
several shipped gold goals, so these ranks were appended (shipped goals are unchanged):

| Family                   | Bronze | Silver | Gold   | Diamond (new) |
| ------------------------ | ------ | ------ | ------ | ------------- |
| Ruby, Sapphire, Emerald  | 500    | 10,000 | 25,000 | 40,000        |
| Topaz Laureate           | 500    | 6,000  | 16,000 | 22,000        |
| Amethyst Laureate        | 500    | 6,000  | 16,000 | 20,000        |
| Moonstone Laureate       | 500    | 6,000  | 16,000 | 21,000        |
| Peridot Laureate (new)   | 500    | 4,500  | 9,000  | —             |
| Starmetal Laureate (new) | 500    | 4,000  | 7,800  | —             |
| Relic Keeper             | 10     | 125    | 360    | 650           |
| Lamplighter              | 10     | 50     | 125    | 275           |
| Ore Merchant             | 10     | 40     | 110    | 340           |
| Core Engineer            | 10     | 50     | 125    | 190           |
| Gate Breaker             | 10     | 50     | 130    | 300           |

Floatstones count as relics; starglass, lenses, phase seals, portals, cracked walls and the
moon lock and dial are `NON_MASTERY_ELEMENTS`.

- Fusion Master lists its six fusions (`FUSION_MASTER_KEYS`); a later fusion joins a new rank or
  `LATER_FUSIONS`, never that list.
- Town Guardian counts any incident kind in any era: a bandit raid, cargo theft, workshop fire or
  river storm the town came through protected with nothing lost. A harmless raid on an empty purse
  is not protection. It replaces the per-era defence medals, which depended on a random incident
  arriving at the right moment and could be missed for good.
- Through the Ages names eras. Every other enabled era is listed in `NON_MILESTONE_ERAS`, so a new
  era is a deliberate decision (a diamond rank or that list). Its diamond rank, **Two Towns, One
  Sky** (since honours version 3), asks to complete Twin Hollows in the valley and on the Moon
  (goal 29: two era steps per era, plus one for completing it). Like gold, it is a milestone at the
  end of the content, not a counted grind.
- Village Explorer counts different players' villages visited **from this town** while signed in
  (the town chosen as the visiting town). Visiting your own other towns never counts.

The monument family has exactly one rank, `monument-gold`: **A Lasting Legacy**.
Any of the five Monument Square choices earns it on the first successful purchase.
Monuments cannot be replaced; older saves that replaced one keep their original award.
Older saves with a monument catch up in honours generation 2. The badge can be showcased
and displayed on buildings like other Town Honours; it grants no coins or progression.

## Counting rules

- **Collection counts include normal and continuous play (requirement version 2).** Normal
  puzzles and museum replays credit their tally only at completion. Continuous visits credit
  committed collections immediately, including partial mine consumption; they never count as
  completed puzzles. Leaving an unfinished normal puzzle still credits nothing. The tally and
  cumulative continuous claim travel with the town handoff.
- The game store's `honourTally` (`{ gems, fusions }`) is filled by `commitResolution`, which runs
  only after a move finished animating, in either play mode. It is reset with the run presentation and
  credited once by `recordVictory`, after its settled-run checks.
- Gems come from committed steps (`step.collectedJewels`, each removed gem once). Refills,
  previews, bonuses, relics and the free recovery sweep never count. Fusions count every real
  swap fusion by key (`step.bonusFusion.key`); the sweep's technical fusion has no key.
- Normal mine elements come from the completed level’s authored configuration (`levelElements`).
  Continuous mine elements count consumed pieces only: delivered relics, fully lit lanterns,
  completed survey trails, filled orders, spent cores and broken gates, at most the authored
  count once per visit. Free recovery sweeps are excluded.
- The forge counts successful `collectForgeTNT` commits only, never TNT from chests, the shop or
  gifts. Storage tops out at 26, so higher ranks mean spending TNT along the way.
- Town Guardian counts `markRaidSeen` of a protected, zero-loss incident.
- Social counts come from the server through the owner's guestbook (`uniqueVisitors`,
  `townsVisited`); the game keeps the highest of each (`recordTownSocial`). Only the server's
  counts prove them, so the owner and visitors always see the same social ranks.
- Score ranks use the best single completed normal puzzle from level 37 against its star
  target. Changing these thresholds never changes stars or chests.
- State-derived honours are evaluated at one point, `campaignStore.save()`, so every action is
  covered without per-action code, and appear only once that save succeeded. Forge and incident
  counts join their action's own commit, so a failed save rolls them back.

## Trust and offline play

Honours are earned and shown on the device immediately, online or offline; the local save keeps
them. What other players see is decided by the server, which keeps its own copy of the counters
and publishes only honours it can prove.

- **Server counters.** Normal victory receipts carry the run's claim
  (`honours: { gems, fusions }`, `runClaim`). While replaying the integrity journal the server
  adds mine elements from the level definition (`honourElements` in `save-rules.json`, generated
  from `levelElements`), the claimed gems and fusions when the claim is plausible (known keys,
  totals within the receipt's `jewels`), each `forge-collect` and each `raid-seen` of a
  protected, zero-loss incident. The counters live in the integrity context, so they are covered
  by the signed checkpoint and survive recovery. An implausible claim is ignored, never a reason
  to reject the save.
- **Offline play.** Offline puzzles, forge collections and incidents queue in the journal like
  every other action. When the device reconnects, the next sync replays them and the server
  credits its counters, so everything earned offline is verified and published then.
- **Verified honours.** On every accepted save the server records which ranks its counters, the
  validated records, town and powers, and its visit counts prove (`verified`). That list only
  grows: a later content change, a raised star target, an admin restore of an older snapshot or
  a deleted visitor town never hides an honour once verified. Visitors receive earned honours
  that are verified or proven at that moment. A claim the server cannot prove stays in the
  owner's own save but is not published.
- **Limits.** Gem and fusion counts are client measurements bounded by the journal, like the
  other puzzle measurements (see [save integrity](backend/save-integrity.md)). A town's first
  cloud enrollment is an unverified baseline for its counters, as it is for money. Guest-only
  play stays on the device and is never published. Console edits of the honours block are
  blocked by the local mutation guard.

## What existing saves receive

Saves from before honours (including every save from the `main` branch) are backfilled on load,
once per catch-up generation (`HONOURS_VERSION`): they earn what their state proves, with
`at: null` and `backfilled: true`, announced as one "N honours recorded" card. Counters a save
proves without its history are seeded (`seedCounts`): a saved forge collection time is one
collection and a seen, fully protected incident is one incident. Other counts start at zero when
honours arrive. The server seeds its counters with the same rule.

| Family                      | From a `main` save                                                  |
| --------------------------- | ------------------------------------------------------------------- |
| Stars, Score                | Yes, from the saved records (levels 1–372 keep their star targets)  |
| Through the Ages            | Bronze and silver from the current era; gold needs the new eras     |
| Master Quartermaster        | If the save holds five powers at 26 at load                         |
| Visitors, Village Explorer  | From the server's visit history, at the owner's next guestbook poll |
| Forge, Town Guardian        | Seeded with at most one each; ranks need new play                   |
| Fusion, gems, mine elements | Start at zero                                                       |

`testing/honours-tracking.test.js` loads the exported `main` beta saves in `testing/fixtures`:
the Connected City save receives Stars bronze to gold and Through the Ages bronze and silver.

## Balancing evidence

Measured on 2026-10-05 with `scripts/measure-campaign.mjs` (hint-led bot, 30 seeds × 402 levels
= 12,060 completed runs, no inventory powers, no stalling), which now also reports fusions per
run, mine elements, incidents and forge collections per simulated village. The bot is a lower
bound for a human for stars, score and fusions; the village economy (mining payouts only) is a
late bound for eras. "Level N" means N completed puzzles in a straight pass.

| Family           | Bronze reached             | Silver reached                   | One pass gives / gold effort                    |
| ---------------- | -------------------------- | -------------------------------- | ----------------------------------------------- |
| Stars            | 25 at L28 (25–32)          | 150 at L239 (219–282)            | 236 (224–260); 300 ≈ 100 targeted replays       |
| Score            | 1.5× at L40 median (37–55) | 2.5× at L107 median, 29/30 seeds | 3× in 19/30 passes; deliberate play             |
| Fusion           | 1 at L3                    | 6 kinds in 18/30 passes, L222    | 198 (168–229); 300 ≈ 1.5 campaigns              |
| Common gems      | 500 at L18–20              | 10,000 at L232–235               | ~17,800; 25,000 ≈ 1.4 campaigns                 |
| Rare gems        | 500 at L28–33              | 6,000 at L214–219                | ~11,800; 16,000 ≈ 1.35 campaigns                |
| Mine elements    | shortly after they appear  | about half a pass of the element | gold ≈ 1.5× the element's levels (7–62 replays) |
| Through the Ages | River & Rail at run 35     | Music & Television at run 218    | Riverlight complete ≈ run 712 (conservative)    |
| Town Guardian    | 5 at L28 (19–69)           | 25 at L224 (186–280)             | 42.5 (37–48); 60 ≈ 1.4 campaigns                |
| Forge            | 5 at L30                   | 100 at L221                      | 190; 250 ≈ 1.3 campaigns (spending TNT)         |

Through the Ages diamond (Two Towns, One Sky), measured on 2026-10-07: one seed of the full
402-level campaign (`node scripts/measure-campaign.mjs . 1 402`), then
`node scripts/measure-town-progression.mjs <measurements> ordinary 1 5000`, which replays level 402 at
its observed payout once the campaign ends. Riverlight was complete at run 438, Skysail at 483,
Stargazer at 534, Moonward at 591 and Twin Hollows at run 612: the campaign plus 210 replays. Its
light homecoming (a few landmarks plus New Hollow) costs about 1.36 million coins against 3.8
million for Moonward.

Mine elements per campaign: relics 242 (from chapter 10), lanterns 84 (chapter 42), survey trails
39 (chapter 44), ore orders 73 (chapter 41), charge cores 85 (chapter 55), blast gates 89
(chapter 63). Their silver goals fall shortly after the element's content, gold at about 1.5×.

Re-measured on 2026-10-08 for the 546-level campaign, after the new levels were tuned to the
deep-mine effort (`src/data/honourLevels.json`): relics 430, lanterns 183, survey trails 44,
ore orders 227, charge cores 125, blast gates 202. Gold fell below 1.3 campaigns for all but
survey trails, so each of those families gained a diamond rank at about 1.5 campaigns (table
above); `testing/honours.test.js` now checks a family's top rank. A 30-seed pass over levels
403–546 (`node scripts/measure-campaign.mjs . 30 546 403,…,546`) collected per pass (median per
level, summed): ruby 9,212, sapphire 9,196, emerald 9,154, topaz 3,212, amethyst 1,421,
moonstone 2,200, peridot 5,922 and starmetal 5,199. Added to the 402-level figures above, the
common gems reach about 27,000 per campaign, topaz 15,000, amethyst 13,200 and moonstone
14,000, so every gem gained a diamond at about 1.5 campaigns. Peridot appears from level 403
and starmetal from 439; their silver sits inside one pass of those levels and gold at about
1.5 passes.
Visitor and explorer goals are social choices (1/5/15 and 5/15/30), not simulated.

Monument milestone checked on 2026-10-06 with
`node scripts/measure-campaign.mjs . 1 90` in the Node 24 Docker image: seed 1 completed
90 puzzles, reached Industrial after run 59, and reached Post-war after run 89 with
2,589 coins remaining under the normal progression-first spending policy. This proves
the optional monument unlock is reachable without requiring a purchase. Its fixed goal
is exactly one monument, irrespective of price (6,000–15,000 coins); the player chooses
when to save for it. Purchase/replacement fixtures and honour tests cover all five
choices, exact debits, one award, persistence and server verification. The simulator
does not buy optional monuments or predict when players will choose to buy one.

Score Legend partly rewards patience: with unlimited moves a player can stall before the final
objective. That is accepted and never limited by moves or time. Re-measure after any change to
scoring, levels, gem palettes or the town economy before adding ranks.

## Data contract

### Registry (`src/data/honours.js`)

- `honourFamilies(content)` lists every family from the content: `{ id, tab, name, measure,
requirement, popup, progress?, params?, art, link?, ranks: [{ metal, goal, name?, measure?,
requirement?, popup?, since?, version? }] }`.
- `buildHonourCatalog(families, content)` validates the ladders (metal order, known measure and
  tab, finite goals) and returns `definitions` (one per rank), `byId`, `families` and
  `familyById`. `HONOURS` is the current catalog.
- A rank definition has `id, family, tab, rank, metal, difficulty, version, since, name,
requirement, popup, progressText, goal, measure, art, link, params(), progress(state),
qualifies(state)`. Display strings are English keys for `t()`.
- **Measures** (`MEASURES`, mirrored in `backend/src/Honours.php`): `landmark` (a known option built in a named optional parcel), `stars` (three-star records),
  `score` (`fromLevel`; best ratio, evidence `{ levelId, score, target }`), `era` (`era`,
  `complete`; two steps per era), `count` (`counter`, optional `key`; a map without a key sums),
  `distinct` (`counter`, `keys`), `powers` (`quantity`) and `social` (`counter`: `visitors` or
  `travels`), `buildingLevels` (a fixed building list), `resource` (a named lifetime earned
  field), and `landmarks` (a fixed list of paid monument sites). A rank qualifies when the
  value reaches its goal. Public descriptors export the requirement `version` too.
- `evaluateHonours(state, { at, backfill, catalog })`, `backfillHonours(state)`,
  `seedCounts(honours, town)`, `createRunTally()`, `normalizeRunTally(saved)`,
  `tallySteps(tally, steps, { recovery })`, `runClaim(tally)`, `levelElements(config)`,
  `creditRun(honours, tally)`, `creditCounter(honours, counter)`, `recordSocial(honours, counts)`,
  `protectedIncident(event)`, `mergeHonours`, `keepHonours`, `pendingAnnouncements`,
  `honourCollection`, `validShowcase`, `publicHonours`.
- `src/data/honourLevels.js` gives `levelHonourElements(levelId)` and `elementLevels(element)` from
  the generated `src/data/honourLevels.json`.

### Saved state: `profile.honours`

```js
{
  version: 1,
  earned: { [id]: { at: ms | null, version, evidence?, seen, announced, backfilled? } },
  counts: {
    gems: { [gem]: n }, mine: { [element]: n }, fusions: { [key]: n },
    forge: n, guardian: n, visitors: n, travels: n,
  },
  showcase: [familyId, ...], // at most 3, earned families only
  backfilled: generation,    // last catch-up generation run on this save
  seenGeneration: generation, // last generation whose new ranks the player has looked at
}
```

It is presentation and history, not money. `normalizeHonours` bounds every value and preserves
unknown future honour IDs without displaying them. `mergeHonours` unions earned entries (earliest
date wins, `seen` and `announced` kept) and takes the larger of each count, never the sum, so
retries, two tabs, restores and cloud pulls cannot double-count. The server adds a server-owned
`verified` list to its stored copy and, for tracked towns, stores its own counters.

`honours` is a protected campaign field (`src/services/localIntegrity.js`): console edits are
ignored, and it changes only through loading, `save()`, `recordVictory`, `collectForgeTNT`,
`markRaidSeen`, `recordTownSocial` and the presentation actions (`setHonourShowcase`,
`markHonoursSeen`, which also records `seenGeneration`, and `markHonoursAnnounced`).

### Town copies

The same town replacing its live copy keeps the live honours (`keepHonours(incoming, live)`): a
backup import of the same town, a newer cloud copy, a server copy winning a conflict, and history
restores. `resetProgress` and new account towns start with fresh honours. A town handoff needs no
merge: the run tally travels in the puzzle snapshot.

## Presentation

- **Collection** (`HonourCollection.vue` and its parts): Mine, Town and Friends tabs, earned
  families first. Every card shows its family's rank track with the metal names and a
  "Silver · 2 of 3" label, the frame of the highest earned metal (grey while locked), progress to
  the next rank and a "New rank" marker when an update added a rank the player has not looked at.
  The detail is a ladder of every rank with its requirement, earned date and evidence, plus links
  to the museum, supplies, blacksmith, sharing or town directory.
- **Popup** (`HonourToast.vue`, `useHonourAnnouncements.js`): "{name} · {metal}" with the metal
  frame and a promotion line when a family moves up; one card per family per batch, backfilled
  honours grouped into one "N honours recorded" card, shown only at a safe point in the player's
  own village. The device preference `honourNotices` is Full, Quiet or Off; honours unlock in
  every mode.
- **Showcase and visitors**: three ordered slots of family IDs, so a later rank upgrades the slot;
  visitors see each family's best published rank with its metal.
- **Museum**: the Replay mode's "For an honour" filter offers the next rank of each level-linked
  family (stars, score, mine elements), with tags such as "◆ Lamplighter · 2 lanterns".

Screenshots (a seeded mid-campaign town in the dev build, 2026-10-05):

- [Mine tab](images/honours/collection-mine.png), [Town tab](images/honours/collection-town.png)
  and [Friends tab](images/honours/collection-friends.png) of the collection
- [Rank ladder in an honour's detail](images/honours/detail-ladder.png)
- [Promotion popup](images/honours/popup-promotion.png) (bronze → silver)
- [Museum filtered for the next Relic Keeper rank](images/honours/museum-honour-filter.png)
- [French collection on a phone](images/honours/mobile-fr-collection.png)

## Extending content

`testing/honours.test.js` fails when the content changes without an honours decision:

- A new gem type needs `GEM_GOALS` (bronze, silver, gold) and laureate names.
- A new mine element (obstacle) joins `MINE_ELEMENTS` or `NON_MASTERY_ELEMENTS`.
- A new enabled era joins a Through the Ages rank or `NON_MILESTONE_ERAS`.
- A new bonus fusion joins a rank or `LATER_FUSIONS`.
- A new settlement or Moon building needs a settlement/building measure, or an explicit
  `NON_SETTLEMENT_HONOURS` decision. The valley is covered by Through the Ages.
- A new town currency in the authoritative `TOWN_CURRENCIES` registry, or a new town
  lifetime `*Earned` resource field, needs a lifetime resource
  measure or `NON_RESOURCE_HONOURS` decision. Coins are deliberately excluded: no lifetime
  earned-coin field exists. Inventory powers remain covered by Master Quartermaster.
- Every monument site needs a named landmark measure, a fixed-list landmarks measure or
  `NON_MONUMENT_HONOURS` decision (currently empty).
- Every rank must match `testing/fixtures/shipped-honour-ranks.json`.

To add a rank: append it to its family with the next metal, set `since` to a raised
`HONOURS_VERSION` (existing saves then catch up once and show it as a new rank), add it to the
shipped-ranks record, calibrate it with the simulator and record the evidence here. Then
regenerate `node scripts/export-honour-levels.mjs` (after level changes), `npm run
export:save-rules` and `node scripts/export-public-content.mjs`, all in Docker. Never edit,
remove or reorder a shipped rank; changing one needs a raised requirement version and the
user's approval, and earned honours keep the version they were earned under.

## Player distinctions

Player distinctions are limited badges that belong to a player's account, not to a town. They
mark being there at key moments of the game and the time since the first sign-in. Players only
ever see the distinctions they received: the collection's **Player** tab lists them, with no
locked goals. Like honours, they never change coins, chests, construction, progression or puzzle
rules.

| ID             | Name             | Kind   | Who holds it                                                     |
| -------------- | ---------------- | ------ | ---------------------------------------------------------------- |
| `player-alpha` | Alpha Player     | event  | Every account that exists when the version 16 migration runs     |
| `player-time`  | Loyal Prospector | tenure | Every account at least one week after its first sign-in, growing |

### The server decides

`backend/src/PlayerDistinctions.php` alone decides who holds which distinction. The game never
grants one or computes a time step: it shows what `GET /account` returns
(`account.distinctions`, kept with the account record for offline play) and what a shared town
publishes. A guest without an account has none.

- **Event** distinctions are rows of `player_distinctions` (player, ID, grant time). The
  version 16 migration grants Alpha Player to every account present when that release is
  deployed, on each environment. Later events (Beta Player, special events) are granted to
  everyone with `php bin/admin.php award-distinction ID`, or to one player from the admin
  player page ([admin guide](backend/admin.md)); a repeated grant keeps the first date.
- **Removal** (a cheater): from the admin player page, an admin removes any distinction, the
  time distinction included. A row in `player_distinction_revocations` (version 17) hides it
  from the account, every showcase and the directory at once, and grants to everyone skip
  that player. **Give back** restores it (the time distinction at its current step). Every
  grant and removal is in the admin audit log.
- **Time** (`player-time`) is computed on the server clock from `players.created_at`, the first
  sign-in, by the `STEPS` ladder: whole weeks until the first month, then whole calendar months
  (UTC; a missing day is the month's last) until the first year, then whole years, with no end.
  A later step takes over at its first unit, so it reads 1, 2, 3, 4 weeks, 1 to 11 months, then
  1, 2, 3… years. Nothing is stored, so it climbs on its own. The owner's game also receives
  the next step and its date. `backend/tests/fixtures/tenure-steps.json` pins the ladder, month ends
  and leap days included.
- A future dated event (for example "signed in on Christmas Day") would be another event kind
  that the server grants when it sees that activity; the game would still only display it.

### Fresh without a new session

The owner's game receives `distinctions` with `GET /account`, every town load and save
(`GET`/`PUT /towns/{id}`) and the owner's guestbook poll (`GET /towns/{id}/visitors`, every 20
seconds in the village). Each reply replaces the copy kept with the account record
(`rememberDistinctions` in `src/services/cloudProfile.js`), so a new time step, a grant or a
removal shows within one poll, and the last known distinctions stay available offline.

### One per town

A town's showcase keeps its three slots; at most one of them may hold a player distinction, and
only a town on the player's account can show one. The ID sits in the saved `honours.showcase`
beside family IDs (`player-` is reserved, `buildHonourCatalog` rejects a family using it). Every
showcase change goes through `usePlayerDistinctions().saveShowcase`, which validates with the
player's received distinctions, so editing town honours never drops the one on show. Choosing
another distinction replaces it in the same slot.

Visitors receive it as `honours.distinction` (`{ id, at, tenure? }`, without the next step). The
stored share keeps only the ID: the server checks that the owner holds it and computes the time
step on every visit and directory card (`PlayerDistinctions::attach`), and removes it from the
showcase otherwise. The owner's own town cards use their account's distinctions.

### Presentation

Player distinctions are glowing shields with sparkles on the rim, unlike every town medal
(round, hexagon, rosette, octagon). Each has its own colours (Alpha Player amethyst with α, the
time distinction midnight blue with a small hourglass over a large count and its unit in
capitals: "2 / YEARS"). Drawn small (beside a shared town's name, on town cards) the time badge
also writes its step beside it ("2 years"); elsewhere its name reads "Loyal Prospector · 2
years". The glow holds still with reduced motion.

A new distinction or time step gets its own popup card ("Player distinction · Loyal Prospector
· 2 years · 2 years since your first sign-in", or "You played during the alpha. Thank you!"),
in night violet rather than the town card's green, so a player reward never reads as a town
reward. Player distinctions and town honours never share a card: each kind has its own queue
(`useHonourAnnouncements(active, { kind })`), several of a kind share their card, and when both
are up the player card sits above the town card. Both follow the same safe points and notice
preference. A new distinction also lights the honours marker and a New label in the Player tab
until the tab is opened. Both are
remembered per account on the device (`prospect-distinctions-announced-v1`,
`prospect-distinctions-seen-v1`), so another device announces them once more.

### Adding a distinction

Add an entry to `PLAYER_DISTINCTIONS` in `src/data/playerDistinctions.js` (ID `player-…`, kind,
name, description, art and palette, with French text), record it in
`testing/fixtures/shipped-player-distinctions.json`, then run `node scripts/export-public-content.mjs`
so the server knows it. Grant an event with the admin command. A shipped ID is never reused,
renamed or removed. A new time unit is a server `STEPS` entry plus its labels and accepted unit
in the game (`TENURE_UNITS`, `TENURE_TEXT`).

## Moon and continuous-play audit — honours generation 5 (2026-10-24)

The user explicitly approved **both** continuous-specific honours and continuous collection
contributing to existing mastery on 2026-10-24. This is the approved exception to shipped
measure immutability: every gem, fusion and mine-element rank keeps its ID, metal, order and
goal, but its requirement version rises from **1 to 2** and its descriptor explicitly names
`modes: ['normal', 'continuous']`. The shipped fixture records version 2. An already earned
entry retains its original version/date and is never re-evaluated away. Stars, normal score,
completed levels, chapters, era milestones, construction and normal puzzle earnings are
unaffected. HONOURS_VERSION rises from 4 to 5; every new rank has `since: 5` and requirement
version 1. No move or time limits are introduced.

| Recent content                                                          | Coverage before this change                                                                             | Decision in generation 5                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Twin Hollows, New Hollow and its 11 Moon buildings                      | `ages-diamond`, Two Towns, One Sky, already names Twin Hollows completion in both settlements           | Keep it fixed; add New Hollow Pioneer for 1/15/30 completed Moon building levels                                                                                                                                                                                      |
| Moon construction and builder-hammer parity                             | Completed buildings contribute to the existing era milestone, regardless of payment method              | Pioneer counts completed levels only; unfinished projects and hammer use itself do not award a second count                                                                                                                                                           |
| Optional Saucer Pad and landing loop                                    | No dedicated honour; the pad is optional for era completion                                             | Add Shuttle Host for the first completed pad level. Landings are visual events with no saved lifetime counter, so do not invent a landing count                                                                                                                       |
| Earthrise Plaza, Moonrock Court, Moonstone Garden and earlier era sites | `monument-gold` measures **Monument Square only**, despite its old generic display text                 | Preserve that shipped descriptor and award; add Landmark Patron, fixed membership of 11 sites, any currency/settlement, one count per paid foundation                                                                                                                 |
| Moonstone town currency and workshop                                    | No resource honour. Moonstone Laureate counts puzzle gems only                                          | Add Lunar Keepsake Collector from lifetime `town.moonstonesEarned` (10/60/180). Spending, selling and uncollected workshop stock do not reduce or inflate it                                                                                                          |
| Moon event routing and monument unveilings                              | Town Guardian already counts fully protected incidents in any era; no generic “watch cinematics” family | Routing changes presentation only. Moon buildings finish without an opening scene, like valley buildings; their completed levels count toward Pioneer, and unveils toward Patron. Keep Guardian’s existing incident meaning; do not count viewing scenes as incidents |
| Levels 403–546: peridot, starmetal and increased mine/gem totals        | Generation 4 already added both gem families and appended six gem/five mine diamond ranks               | Keep every goal; registry coverage and generated element-index tests pass. Floatstones count as relics. No new fusion was omitted                                                                                                                                     |
| Continuous play                                                         | No collection credit; only separately saved coins and score statistics                                  | Add three families and version-2 collection measures, with validated cumulative claims and no completion credit                                                                                                                                                       |

The floating-seam opt-outs remain deliberate: starglass/phase seals/cracked walls are sparse
chapter obstacles; lenses/portals are reusable fixtures; the moon lock/dial are gravity tools;
floatstones are relics and already count as such. Common ice/stone/chains/seals and earlier
fossils/spores/roots retain their documented non-mastery decision. `LATER_FUSIONS` is empty;
all six authored fusion keys are explicitly in Fusion Master. Twin Hollows is a named era
milestone, not hidden in `NON_MILESTONE_ERAS`.

### New rank catalogue

All rows below have `since = 5`, requirement `version = 1`. B/S/G mean bronze/silver/gold.
The settlement building and monument site memberships are fixed data in the registry, so
adding content cannot change a shipped measure silently. Later content appends ranks or
families; it must also satisfy the new coverage guards.

| Rank ID                  | Metal  |    Goal | Name                     | Measure                                  |
| ------------------------ | ------ | ------: | ------------------------ | ---------------------------------------- |
| new-hollow-bronze        | Bronze |       1 | New Hollow Pioneer       | buildingLevels: 11 fixed Moon buildings  |
| new-hollow-silver        | Silver |      15 | New Hollow Pioneer       | same                                     |
| new-hollow-gold          | Gold   |      30 | New Hollow Pioneer       | same                                     |
| saucer-welcome-bronze    | Bronze |       1 | Shuttle Host             | buildingLevels: saucerPad                |
| moonstone-reserve-bronze | Bronze |      10 | Lunar Keepsake Collector | resource: moonstones / moonstonesEarned  |
| moonstone-reserve-silver | Silver |      60 | Lunar Keepsake Collector | same                                     |
| moonstone-reserve-gold   | Gold   |     180 | Lunar Keepsake Collector | same                                     |
| landmark-patron-bronze   | Bronze |       1 | Landmark Patron          | landmarks: 11 fixed sites                |
| landmark-patron-silver   | Silver |       5 | Landmark Patron          | same                                     |
| landmark-patron-gold     | Gold   |       9 | Landmark Patron          | same                                     |
| endless-seam-bronze      | Bronze |   2,500 | Endless Seam             | count: continuousGems                    |
| endless-seam-silver      | Silver |  25,000 | Endless Seam             | same                                     |
| endless-seam-gold        | Gold   | 100,000 | Endless Seam             | same                                     |
| seam-explorer-bronze     | Bronze |      12 | Seam Explorer            | distinct: continuousLevels, levels 1–546 |
| seam-explorer-silver     | Silver |      90 | Seam Explorer            | same                                     |
| seam-explorer-gold       | Gold   |     300 | Seam Explorer            | same                                     |
| continuous-score-bronze  | Bronze |  25,000 | Unbroken Brilliance      | count: continuousBest                    |
| continuous-score-silver  | Silver | 100,000 | Unbroken Brilliance      | same                                     |
| continuous-score-gold    | Gold   | 500,000 | Unbroken Brilliance      | same                                     |

Pioneer gold is 30 completed levels: the ten required Moon buildings can earn it without the
optional three-level Saucer Pad. The full Moon catalogue supplies 33 levels. Landmark Patron
goals stop at nine of the eleven named sites; no rank asks for “all” present or future sites.
Paid foundations count immediately, matching the existing monument contract, while cosmetic
construction/scaffolding and later upgrades do not add more sites. Keepsake gold exceeds the
33 building gifts and therefore encourages repeat workshop collection. It never reads the
spendable balance or changes workshop production.

### Continuous receipt and verification contract

`continuous` keeps its original `{ runId, levelId, jewels, score, at }` fields and adds optional
`honours: { version: 1, gems, fusions, mine }`, cumulative within that visit. `jewels` keeps its
existing meaning and value for the economy/workshop integration. After each animated move
commits, the client credits only the increase over that run’s previous claim. It saves the
claim, counters, coin change and journal action atomically; a failed save rolls them back.
Retries, score-only updates and handoffs do not recredit collections. Continuous normal-victory
calls are refused, so no collection can take both paths. Honours continue after the existing
continuous **coin** allowance is filled; that allowance never stops play or collection.

The server validates version, known gem/fusion keys, safe integer counts, monotonic claims,
per-map totals bounded by the unchanged `jewels`, and mine-element keys/counts bounded by that
level’s authored pieces. It rejects forged new-format breakdowns. Like existing normal gem
claims and scores, these are bounded client measurements, not a server simulation of every
board move. It keeps the prior claim in the signed run context and credits only deltas to its
own mastery/continuous counters. The best score and distinct continuous levels are derived
from these replayed receipts, never uploaded honour claims. Legacy receipts without a
breakdown keep their previous economic behavior and do not fabricate collection history.
Mid-visit enrollment remembers the current claim without adding an uploaded baseline twice.
Existing legacy awards retain their original requirement version on both client and server.

### Balance calibration (2026-10-24)

Measurements use the actual match/hint/resolution engine, three deterministic seeds (1–3),
all 546 levels, and the shared `consumedElements` helper for partial mine consumption. A
continuous visit is **20 legal moves**, continuing after objectives are cleared; this is a
measurement window, never a gameplay allowance. The two mixed patterns visit the latest
unlocked level once or three times after each normal run, starting when the museum is built.
Repeated visits reuse that seed/level’s measured sample. Thus they are scenarios, not a
forecast of independent player randomness. No rate multiplier or discount is applied to
continuous collection: every collected gem/fusion/element counts once.

The town scenario buys affordable recommended progression first, then one optional foundation
per unlocked site as funds allow, collects ready workshop batches, and uses normal mining
payouts only (no chests, hammers, passive income, incident losses/bounties or purchased supplies).
This is a conservative progression model; it is not a prediction of real towns’ completion
dates. After one campaign, normal replays cycle through the same 546 measured levels. The
four-campaign horizon (2,184 normal runs) is diagnostic only. Continuous visits add their
existing per-level coin allowance once and feed workshop stock through its shared bounded
300-gem production credit. They never advance construction or eras. Collection visits assume
at least 30 seconds apart, satisfying the workshop’s existing collection cooldown.

Reproduce in Node 24 Docker (mount `/tmp` as `/measure` for input/output files):

```sh
node scripts/measure-campaign.mjs . 3 546
CONTINUOUS_VISIT_MOVES=20 node scripts/measure-campaign.mjs . 3 546
node scripts/measure-honours.mjs /measure/ph-honours-campaign.json /measure/ph-honours-continuous.json
CONTINUOUS_VISIT_MOVES=300 node scripts/measure-campaign.mjs . 3 546 1,37,247,439,546
```

The median 20-move visit collected **201 gems** and scored **33,300**; the largest visit score
was **108,600**. The museum opened after normal run 3–4. Entries below are the median normal
run number when each rank is earned (bronze / silver / gold / diamond, in that order).
Numbers above 546 include normal replays. “—” means not reached within 2,184 normal runs in
that scenario, not impossible in gameplay. “Partial” gives reached-seed results when not all
three seeds reach the rank; no success is silently imputed to a missing seed.

| Family            | Goals B / S / G / D            | Normal only           | +1 continuous visit / level | +3 continuous visits / level |
| ----------------- | ------------------------------ | --------------------- | --------------------------- | ---------------------------- |
| fusion            | 1 / 6 / 300                    | 1 / 329 / 586         | 1 / 241 / 315               | 1 / 241 / 137                |
| gem-ruby          | 500 / 10,000 / 25,000 / 40,000 | 19 / 238 / 514 / 844  | 7 / 121 / 288 / 452         | 4 / 59 / 145 / 227           |
| gem-sapphire      | 500 / 10,000 / 25,000 / 40,000 | 21 / 238 / 513 / 844  | 7 / 122 / 292 / 455         | 4 / 63 / 147 / 230           |
| gem-emerald       | 500 / 10,000 / 25,000 / 40,000 | 21 / 232 / 510 / 832  | 9 / 122 / 290 / 453         | 4 / 63 / 148 / 230           |
| gem-topaz         | 500 / 6,000 / 16,000 / 22,000  | 28 / 221 / 592 / 792  | 8 / 113 / 279 / 383         | 6 / 55 / 141 / 193           |
| gem-amethyst      | 500 / 6,000 / 16,000 / 20,000  | 34 / 219 / 665 / 792  | 16 / 115 / 286 / 358        | 5 / 61 / 145 / 180           |
| gem-moonstone     | 500 / 6,000 / 16,000 / 21,000  | 32 / 219 / 635 / 798  | 14 / 116 / 287 / 374        | 10 / 61 / 149 / 188          |
| gem-peridot       | 500 / 4,500 / 9,000            | 410 / 516 / 1021      | 407 / 470 / 538             | 405 / 428 / 478              |
| gem-starmetal     | 500 / 4,000 / 7,800            | 446 / 510 / 1019      | 444 / 474 / 529             | 441 / 458 / 479              |
| mine-relics       | 10 / 125 / 360 / 650           | 59 / 261 / 507 / 939  | 58 / 165 / 366 / 540        | 56 / 108 / 237 / 362         |
| mine-lanterns     | 10 / 50 / 125 / 275            | 251 / 299 / 440 / 949 | 249 / 270 / 311 / 443       | 248 / 252 / 285 / 315        |
| mine-surveys      | 5 / 20 / 60                    | 263 / 302 / 838       | 261 / 280 / 321             | 260 / 263 / 291              |
| mine-ore-orders   | 10 / 40 / 110 / 340            | 254 / 308 / 438 / 990 | 245 / 268 / 342 / 799       | 243 / 254 / 274 / 428        |
| mine-cores        | 10 / 50 / 125 / 190            | 331 / 360 / 516 / 914 | 328 / 341 / 368 / 444       | 326 / 333 / 345 / 358        |
| mine-gates        | 10 / 50 / 130 / 300            | 376 / 388 / 437 / 954 | 375 / 382 / 398 / 504       | 374 / 378 / 386 / 408        |
| new-hollow        | 1 / 15 / 30                    | 939 / 952 / 966       | 938 / 952 / 966             | 938 / 952 / 966              |
| saucer-welcome    | 1                              | 965                   | 965                         | 965                          |
| moonstone-reserve | 10 / 60 / 180                  | 948 / 981 / 1101      | 947 / 979 / 1087            | 946 / 965 / 1011             |
| landmark-patron   | 1 / 5 / 9                      | 26 / 331 / 957        | 25 / 331 / 958              | 25 / 331 / 958               |
| endless-seam      | 2,500 / 25,000 / 100,000       | — / — / —             | 11 / 118 / 474              | 5 / 40 / 154                 |
| seam-explorer     | 12 / 90 / 300                  | — / — / —             | 14 / 92 / 302               | 14 / 92 / 302                |
| continuous-score  | 25,000 / 100,000 / 500,000     | — / — / —             | 3 / partial: 3, 547 / —     | 3 / partial: 3, 547 / —      |

**Assessment.** No mastery gold becomes automatic in the first few chapters under either
mixed pattern: common gem gold moves from run 510–665 to 141–149 with three visits, fusion
gold to 137, and later mechanic gold remains behind its authored introduction. That faster
campaign position represents 60 extra legal moves per level, not free progress. Easy gem
bronze can arrive in chapter 1; that is intentional. Silver and gold still require collection.
All mastery ranks are reached in all three seeds within the diagnostic horizon.

The new Endless Seam gold arrives at run 474 (one visit) or 154 (three); Seam Explorer gold
at run 302 in either pattern because extra visits cannot invent different levels. Neither is
available from normal play alone, by design. No campaign content is locked behind them.

**Score-family flags.** Unbroken Brilliance bronze is deliberately easy and can arrive on the
first continuous visit (normal run 3). Silver is not guaranteed in a short 20-move pattern:
only two seeds reach it (at normal runs 3 and 547); repeating the same seed’s short sample
three times does not change its best score. Gold is not reached in these short visits. A
separate actual-engine sample of 300-move visits to levels 1, 37, 247, 439 and 546 (three seeds
each) reaches all three ranks in all 15 visits: final scores 511,900–957,000. Therefore score
gold is reachable in chapter 1 by intentionally staying for a long visit. This is an explicit
endurance/score goal, not a campaign milestone, and honours never add a move cap to prevent
it. It is not earned by the plausible short-visit pattern. No shipped goal was lowered and
no continuous contribution was discounted. If later telemetry calls for a longer pursuit,
append a diamond rank after further measurement rather than moving these goals.

New Hollow and the Saucer Pad remain late town milestones; their rates barely change with
continuous coins, because continuous play never advances building construction. In this
conservative mining-only town model Twin Hollows begins at runs 936–952 (normal) or 935–952
(mixed). The lifetime-currency ladder remains above the building-only gifts: silver needs
workshop collection and gold requires repeated collection even after spending on monuments.
Patron’s bronze is an optional early foundation and gold remains late (nine different sites,
including access to a Moon site). All new town ranks are reached in every seed/pattern.

Raw calibration JSON is retained for review at `/tmp/ph-honours-campaign.json`,
`/tmp/ph-honours-continuous.json`, `/tmp/ph-honours-balance.json` and
`/tmp/ph-honours-long-visits.json`. These are disposable measurements, not runtime game data.

In those 300-move visits, the median first crossing was 25,000 points at move 15, 100,000 points at move 55, 500,000 points at move 248.

Integrated calibration uses local preprod merge `ab835eff` (including stored workshop stock,
300 gems per production credit, and profile schema 4) plus the guided-project changes. The
same script calls shared `advanceContinuousMoonstones`; it does not reproduce production
rules. The honours claim and workshop feed share unchanged receipt `jewels`, keep separate
cumulative run checkpoints, and commit together. Continuous honours keep counting after
both the per-level workshop credit and coin allowances are exhausted. With the integrated
workshop, currency silver is reached at normal runs 981 / 979 / 965 and gold at
1101 / 1087 / 1011 (normal / one visit / three visits). Goals remain 10 / 60 / 180.
