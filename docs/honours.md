# Town Honours

Town Honours ([issue #60](https://github.com/Starbugstone/Prospect-Hollow/issues/60)) are a
permanent, town-specific collection: achievements, mine mastery badges and quiet era defence
medals, with a three-slot showcase visible to visitors. The badge and its presentation are the
reward. Honours never change coins, chests, construction, progression or puzzle rules, and they
never add move limits, timers or progression gates.

`src/data/honours.js` is the single registry. `testing/honours.test.js` covers it, including the
coverage checks that keep it in step with the content (see [Extending content](#extending-content)).

## Catalogue

### Achievements

| Difficulty         | Honour                                 | Requirement                                                                          |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------ |
| Easy               | First Perfect                          | Three stars on any normal puzzle                                                     |
| Easy               | First Fusion                           | Any bonus fusion in a completed puzzle                                               |
| Easy               | The Forge Delivers                     | First TNT collected from the forge                                                   |
| Medium → Very hard | Score Ace → Score Legend (one card)    | A completed puzzle from level 37 with 2× / 3× its star score target                  |
| Medium             | Fusion Master                          | All six bonus fusions                                                                |
| Medium             | Forge Veteran                          | 50 TNT collected from the forge                                                      |
| Medium             | Ruby, Sapphire and Emerald Laureate    | 12,000 of that gem                                                                   |
| Medium             | Topaz, Amethyst and Moonstone Laureate | 8,000 of that gem                                                                    |
| Very hard          | Master Quartermaster                   | Armory and garage at maximum, all five powers full at the same time (26 each today)  |
| Very hard          | Perfect Prospector                     | Three stars on every published normal puzzle (402 today)                             |
| Very hard          | Prospect Hollow Complete               | Every required building and modernization through the final enabled era (Riverlight) |

### Mine mastery

Each goal is about 1.5× what one campaign contains, so finishing it means replaying some of
those levels in the museum.

| Honour         | Element                 | In one campaign | Goal | Where                      |
| -------------- | ----------------------- | --------------- | ---- | -------------------------- |
| Relic Keeper   | relics delivered        | 242             | 360  | 128 levels, chapters 10–67 |
| Lamplighter    | lanterns lit            | 84              | 125  | 38 levels, chapters 42–62  |
| Trail Surveyor | survey trails completed | 39              | 60   | 39 levels, chapters 44–59  |
| Ore Merchant   | ore orders filled       | 73              | 110  | 52 levels, chapters 41–62  |
| Core Engineer  | charge cores released   | 85              | 125  | 55 levels, chapters 55–64  |
| Gate Breaker   | blast gates broken      | 89              | 130  | 29 levels, chapters 63–67  |

Common obstacles (ice, stone, chains, seals) and elements on only six levels (encased fossils,
spores, root knots) are deliberately not mastery goals (`NON_MASTERY_ELEMENTS`).

### Era defence medals

One quiet medal per enabled era (Frontier Guardian … Lantern Guardian, `MEDAL_NAMES`), named
for the era's incident from its era contract. Medals never produce popups or sounds.

## Counting rules

- **Run-based counts are credited only when a normal puzzle is completed**, including museum
  replays: gems, fusions and mine elements. Leaving a puzzle unfinished credits nothing and
  continuous play does not count. The per-run tally travels with the town handoff.
- The game store's `honourTally` is filled by `commitResolution`, which runs only after a move
  finished animating, in normal play only. It is reset with the run presentation (start and
  exit) and credited once by `recordVictory`, after its settled-run checks. A duplicate, stale
  or continuous victory credits nothing.
- Gems come from committed resolution steps (`step.collectedJewels`, each removed gem once).
  Refills, previews, bonuses, relics and the free recovery sweep never count. Swaps, powers and
  matches after a shuffle (including the seeded repair) count normally; the sweep's resolution
  is flagged `recovery`.
- Fusions come from `step.bonusFusion.key` on committed steps. Either swap order is the same key.
  The recovery sweep's technical fusion has no key and never counts.
- Mine elements are credited from the completed level's authored configuration
  (`levelElements`). Completion consumes all of them: lanterns, survey markers and cores are
  signal layers, gates are health layers, and relics and ore orders are explicit objectives.
- The forge counts only successful `collectForgeTNT` commits, never TNT from chests, the shop,
  gifts or rewards.
- Score ranks use the best single completed normal puzzle from level 37 (`records`), against
  the authored star target. Continuous records and levels without a usable target never count.
  Changing these thresholds never changes stars or chests.
- Master Quartermaster needs maximum storage (derived from the armory and garage definitions)
  and all five powers full at the same moment. Spending later never revokes it.
- A defence medal is awarded when an incident is marked seen with outcome `protected` and zero
  loss. The era gate keeps an unseen incident from crossing an era change, so the current era
  at that moment is the originating era. A harmless zero-loss raid (a poor town) never counts.
- State-derived honours are evaluated at one point, `campaignStore.save()`, so every action is
  covered without per-action code. New honours are written with that save and appear only once
  it succeeded: a failed or read-only save earns nothing until a later save stores it. Forge
  counts and medals join their action's own commit, so a failed save rolls them back.
- Older saves are backfilled on load, once per honours version: the honours their state already
  proves, plus the one attributable defence medal, with `at: null` and `backfilled: true`. Load
  never writes; the next save stores the result, so repeated loads give the same honours.
  Counts start at zero and are never inferred.

## Balancing evidence

Measured on 2026-10-03 with `scripts/measure-campaign.mjs` (hint-led, 30 seeds × 402 levels =
12,060 completed runs, no inventory powers, no stalling) and the level definitions. The script
now reports `jewels` and a per-type `gems` tally for every run. A bot that finishes each puzzle
as soon as it can is likely a lower bound for a human, who can use powers and play on.

Score multiple (score ÷ star target) by level band; the ≥ columns are shares of runs.

| Levels  | Median | p90  | Max  | ≥ 1.5× | ≥ 2×  | ≥ 3×  | ≥ 4×  |
| ------- | ------ | ---- | ---- | ------ | ----- | ----- | ----- |
| 1–12    | 2.66   | 4.25 | 7.89 | 92.8%  | 76.1% | 37.5% | 13.1% |
| 13–36   | 1.52   | 2.58 | 4.94 | 52.4%  | 25.6% | 5.8%  | 0.7%  |
| 37–120  | 1.10   | 1.68 | 4.76 | 17.6%  | 3.4%  | 0.3%  | 0.0%  |
| 121–240 | 1.01   | 1.58 | 4.17 | 13.0%  | 2.7%  | 0.2%  | 0.0%  |
| 241–324 | 1.00   | 1.49 | 3.33 | 9.6%   | 1.6%  | 0.0%  | 0.0%  |
| 325–402 | 1.04   | 1.72 | 5.75 | 17.2%  | 5.4%  | 0.6%  | 0.0%  |
| 37–402  | 1.03   | 1.62 | 5.75 | 14.2%  | 3.2%  | 0.3%  | 0.0%  |

Opening star targets are deliberately low, hence the level-37 floor. Of the 366 levels from 37,
200 have at least one run at 2× and 24 at 3×.

- **Score Ace (2×)**: one qualifying puzzle per 31 played (the score route to three stars, 1.5×,
  is one per 7). A single pass over levels 37–402 yields 11.7 on average (7–20 per seed). The first
  one arrives at a median of level 62 (40–195), and about 75% of players would have one by level
  75 and 99% by 200. It follows three-star play without being routine.
- **Score Legend (3×)**: one per 366 puzzles. A pass yields 1.0 on average, and 19 of 30 seeds
  (64%) had at least one, at a median of level 164 for those that did. The 24 levels that can
  reach it are scattered, and the best (387, 390, 400) give 7–17% per attempt, so it is rare
  but a player who aims for it can attain it. Stalling for patience, which the bot never does,
  only raises this.
- Raising Ace to 2.5× would give 3.1 per pass (first at about level 107) and Legend at 4× is
  essentially unreachable (0.1 per pass, 3 of 30 seeds), so neither is recommended.

Gems per campaign pass (all 402 levels, completed puzzles), and where the goal is reached in a
straight campaign (mean level across seeds):

| Gem       | Mean per pass | Min–max       | Goal   | Goal ÷ pass | Goal reached at level |
| --------- | ------------- | ------------- | ------ | ----------- | --------------------- |
| Ruby      | 17,901        | 17,414–18,479 | 12,000 | 67.0%       | 278 (270–290)         |
| Sapphire  | 17,769        | 17,242–18,310 | 12,000 | 67.5%       | 281 (273–290)         |
| Emerald   | 17,836        | 17,283–18,593 | 12,000 | 67.3%       | 280 (270–290)         |
| Topaz     | 11,860        | 11,319–12,463 | 8,000  | 67.5%       | 280 (266–290)         |
| Amethyst  | 11,827        | 11,410–12,250 | 8,000  | 67.6%       | 283 (271–296)         |
| Moonstone | 11,684        | 11,320–12,263 | 8,000  | 68.5%       | 286 (274–297)         |

Later levels yield more gems (65% of a pass by level 268), so the goals land about 70% of the
way through the campaign by level number and two-thirds of it by gems. Mine goals are 1.46–1.54×
one campaign from the level definitions (table above), so they need no measurement.

- Conclusion: the approved thresholds hold; no change is recommended. Re-measure after any change
  to scoring, levels or gem palettes.
- Score Legend partly rewards patience: with unlimited moves a player can stall before the final
  objective. That is accepted and never limited by moves or time.
- The forge makes one TNT per 6 → 2 completed puzzles by blacksmith level, pauses while a TNT
  waits and refuses collection when TNT storage is full, so 50 collections is mid-to-late play.

## Data contract

### Saved state: `profile.honours`

```js
{
  version: 1,
  earned: { [id]: { at: ms | null, version, evidence?, seen, announced, backfilled? } },
  counts: { gems: { [gem]: n }, forge: n, mine: { [element]: n } },
  fusions: ['bomb+cross', ...],
  showcase: [familyId, ...], // at most 3, earned families only
  backfilled: 0 | version,   // legacy backfill already run
}
```

It is presentation and history, not money: integrity replay ignores it, and it is never part
of a journal action or receipt. `normalizeHonours` bounds every value and preserves unknown
future honour IDs without displaying them. `mergeHonours(first, second)` unions earned entries
(earliest date wins, `seen` and `announced` kept) and takes the larger of each count, never the
sum, so retries, two tabs, restores and cloud pulls cannot double-count. The first copy's
showcase wins when it has one.

`honours` is a protected campaign field (`src/services/localIntegrity.js`): console edits are
ignored, and it changes only through loading, `save()`, `recordVictory`, `collectForgeTNT`,
`markRaidSeen` and the presentation actions below. `updateEarnedHonours` is internal and accepts
only the `seen` and `announced` flags.

### Run tally: `game.honourTally`

```js
{ gems: { [gem]: n }, fusions: ['bomb+cross', ...], mine: {} }
```

`completeLevel` passes `recordVictory({ ..., tally })` with `mine` replaced by
`levelElements(store.currentLevel.config)`. The tally is a handoff field; a snapshot without it
restores an empty tally (`normalizeRunTally`).

### Town copies

The same town replacing its live copy keeps the live honours (`keepHonours(incoming, live)`,
the incoming showcase first):

- A backup import keeps them when `townStorage.keepsIdentity(backup.town)`: the backup carries
  the selected town's ID or no ID (older backups are restored into the selected town). Another
  town's backup gives the local slot that town's identity and its own honours.
- Cloud sync keeps them when a newer cloud copy is downloaded and when the server copy wins a
  conflict (the local copy is also preserved for recovery). A history restore or recovery
  overwrite uploads the restored copy with the kept honours. When the live copy added
  anything, the town is marked unsynced so the kept honours upload.
- A town handoff needs no merge: the sending window saves first and the receiving window loads
  that save; the run tally travels in the puzzle snapshot.
- `resetProgress` and new account towns start with fresh honours. Copying a missing account
  town into a new slot copies its whole profile, honours included, as it continues that
  town's progress.

### Registry API (`src/data/honours.js`)

- `HONOURS` / `createHonourCatalog(content)`: `definitions`, `byId`, `families`, `familyById`.
  A definition has `id, family, rank, category, difficulty, name, requirement, popup, params(),
progress(state), qualifies(state), art, link?, quiet?`. Display strings are English keys for
  `t()`, with `params()` placeholders.
- `evaluateHonours(state, { at, backfill })` → `{ honours, added }` for every non-quiet honour.
  `state` is `{ records, town, powers, honours }`, for example the campaign store.
- `createRunTally()`, `normalizeRunTally(saved)`, `tallySteps(tally, steps, { recovery })`,
  `levelElements(config)`, `creditRun(honours, tally)`, `creditForge(honours)`,
  `defenceMedal(event, era)`, `backfillDefenceMedal(event)`, `backfillHonours(state)`,
  `awardHonour(honours, id, { at, evidence, backfilled })`, `keepHonours(profile, live)`.
- `pendingAnnouncements(honours)`: one entry per family (highest new rank), quiet honours
  excluded.
- `honourCollection(state)`: the three tabs with family views (`earned`, `next.progress`,
  `status` of `earned | progress | current | none | future`, `fresh`, `showcased`), earned
  families first.
- `validShowcase(ids, honours)`, `publicHonours(honours)`.
- `src/data/honourLevels.js`: `levelHonourElements(levelId)` and `elementLevels(element)` from
  `src/data/honourLevels.json`. Regenerate it with
  `node scripts/export-honour-levels.mjs` (in Docker) after changing levels; the test fails when
  it is stale.

### Campaign store

`campaign.honours` holds the normalized state and is saved with the profile. It is replaced
(never mutated in place) whenever honours change, so watching it sees every new honour.
`setHonourShowcase(familyIds)`, `markHonoursSeen(ids?)` and `markHonoursAnnounced(ids)` change
presentation only. A defence medal's `evidence` is `{ eventId }`; backfilled entries have
`at: null` and `backfilled: true`.

### Shared presentation contracts

- `useHonourNavigation()` (`src/composables/useHonourNavigation.js`): `requests.collection`
  (`{ familyId }` or `null`) and `requests.museum` (`{ familyId }` or `null`), with
  `openCollection`, `closeCollection`, `openMuseumFor` and `clearMuseumRequest`. The popup and
  honour details use it to open the collection or a pre-filtered museum.
- `useSettingsStore().honourNotices`: `'full' | 'quiet' | 'off'`, set with
  `setHonourNotices(mode)`. It is a device preference, kept apart from the synced save.

### Public projection

The shared town appearance carries only `appearance.honours = publicHonours(...)`: earned IDs
and dates, the score evidence (level, score, target) and the showcase order. A missing field
means "unknown" (older owner or server), not an empty or revoked collection.

## Presentation

- A bottom-right popup (Steam-like layout in the Prospect Hollow palette) for first unlocks and
  new score ranks only, after results, celebrations and the committed action. Several honours
  from one action become one "N achievements earned" summary. Medals are quiet.
- A device preference: Full (popup and sound, subject to volume and mute), Quiet (no popup or
  sound, New indicator kept) and Off (no unsolicited popup, sound or New indicator).
- The collection is available from town management and the More menu, without signing in.
  Visitors see the showcase and an earned-only gallery beside the guestbook.
- The museum shows element icons per level, a "For an honour" filter and tags naming the honour
  a level advances.

Mockups: [popups](images/honours/mockup-popups.png),
[collection](images/honours/mockup-collection-achievements.png),
[mine mastery](images/honours/mockup-collection-mine-mastery.png),
[era defence](images/honours/mockup-collection-era-defence.png),
[locked detail](images/honours/mockup-detail-locked.png),
[museum](images/honours/mockup-museum-filter.png).

## Extending content

`testing/honours.test.js` fails when the content changes without an honours decision:

- A new gem type needs a `GEM_GOALS` entry and laureate names.
- A new enabled era needs a `MEDAL_NAMES` entry and an `INCIDENT_NAMES` entry for its incident.
- A new mine element (obstacle) must join `MINE_ELEMENTS` or `NON_MASTERY_ELEMENTS`.
- Changed levels need `node scripts/export-honour-levels.mjs`; recalibrate affected goals.

Changing a goal bumps its requirement version. Earned honours stay earned under the version they
were earned with. Never reuse or rename an honour ID.
