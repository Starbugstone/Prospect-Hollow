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
- Gems come from committed resolution steps (`step.collectedJewels`, each removed gem once).
  Refills, previews, bonuses, relics and the free recovery sweep never count. Matches after a
  shuffle count normally.
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

## Balancing evidence

Measured on 2026-10-03 with `scripts/measure-campaign.mjs` (hint-led, 3 seeds × 402 levels, no
inventory powers) and the level definitions; to be re-checked with 30 seeds before release.

| Levels | Runs reaching 2× star target | Runs reaching 4× | Best run |
| ------ | ---------------------------- | ---------------- | -------- |
| 1–12   | 81%                          | 19%              | 7.4×     |
| 13–36  | 21%                          | 0%               | 3.8×     |
| 37–402 | 1–6%                         | 0%               | 2.3–3.2× |

- Opening star targets are deliberately low, hence the level-37 floor and 2× / 3× ranks. With
  unlimited moves a player can stall before the final objective, so Score Legend partly rewards
  patience; that is accepted and never limited by moves or time.
- One campaign pass collects about 17.8k each of ruby, sapphire and emerald and 11.8k each of
  topaz, amethyst and moonstone. The goals are about two-thirds of a pass.
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

It is presentation and history, not money: integrity replay ignores it. `normalizeHonours`
bounds every value and preserves unknown future honour IDs without displaying them.
`mergeHonours` unions earned entries (earliest date wins) and takes the larger of each count,
never the sum, so retries, two tabs, restores and cloud pulls cannot double-count.

### Registry API (`src/data/honours.js`)

- `HONOURS` / `createHonourCatalog(content)`: `definitions`, `byId`, `families`, `familyById`.
  A definition has `id, family, rank, category, difficulty, name, requirement, popup, params(),
progress(state), qualifies(state), art, link?, quiet?`. Display strings are English keys for
  `t()`, with `params()` placeholders.
- `evaluateHonours(state, { at, backfill })` → `{ honours, added }` for every non-quiet honour.
  `state` is `{ records, town, powers, honours }`, for example the campaign store.
- `createRunTally()`, `tallySteps(tally, steps, { recovery })`, `levelElements(config)`,
  `creditRun(honours, tally)`, `creditForge(honours)`, `defenceMedal(event, era)`,
  `backfillDefenceMedal(event)`, `awardHonour(honours, id, { at, evidence, backfilled })`.
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

`campaign.honours` holds the normalized state and is saved with the profile.
`setHonourShowcase(familyIds)`, `markHonoursSeen(ids?)` and `markHonoursAnnounced(ids)` change
presentation only.

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
