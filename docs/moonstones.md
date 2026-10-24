# Moonstones: saved resource and integration contract

Moonstones are an optional town resource, separate from the `moonstone` puzzle
gem. They never gate the campaign, era completion, normal puzzle rewards or
continued play. There are no move or time limits. The resource can be sold or used for two optional monuments.

## Save and migration

Profile schema **4** writes these fields to `town`:

- `moonstoneVersion: 2`: deterministic migration marker.
- `moonstones`: spendable nonnegative safe integer balance.
- `moonstonesEarned`: lifetime nonnegative safe integer, unchanged by spending.
- `moonstoneProduction: { progress, stored }`: partial puzzle progress and uncollected stock.
- `lastCollections.moonstoneWorkshop`: the existing 30-second collection cooldown.

Schema 3 / Moonstone version 1 used `{ progress, charge }`. Migration replaces
`charge` with `stored` exactly once, preserving progress, spendable balance,
lifetime earnings and collection time. It never adds the batch to the balance:
only collection does that. Saves older than Moonstones still derive their initial
balance and lifetime credit from completed `MOON_LOTS` building levels, exactly
the former `moonstoneKeepsakes(town)` count, with empty production.

`normalizeMoonstones(saved, normalizedTown)` derives a replacement checkpoint,
never an additive migration event. Reloads, imports and two devices independently
upgrading the same save therefore cannot add credit twice. Sync retains its
whole-profile conflict/recovery policy; it never sums balances or stock.

`continuousRecords[levelId].moonstoneGems` stores accepted workshop gems for that
level, including its partial credit, from 0 through 900. Missing means zero;
loading bounds it like the continuous coin allowance. It survives visits,
reloads, imports and cloud sync. `continuousRun.moonstoneJewels` is a transient
high-water mark for the active run's total jewels; the server retains its matching
mark in the journal context across sync acknowledgements and enrollment.

Local storage, cloud profiles and exports already serialize the entire town and
continuous records. Transfers and the backend accept schemas **2, 3 and 4**; the
client writes schema 4. A schema-2/3 client cannot upload over schema 4. Old clients
already treat schema >3 as read-only, preventing their old normalization from
resetting version-2 currency. **Deploy the updated backend and catalogs before
the client.** Old servers reject schema 4; the local outbox remains recoverable.
The storage key and transport envelope version do not change.

Normal victories, continuous settlements and collections now carry
`moonstoneVersion: 2`. Server replay retains version-1 single-batch behavior for
old victories and collections (an absent collection version means 1), including
a smaller ready batch preserved across an upgrade. Legacy continuous receipts
advance coins only; old victories without a Moonstone version do not produce
stones. Replay migrates at the first version-2 production/collection receipt, or
after all legacy receipts when comparing a migrated upload. Signed recovery
checkpoints follow the same path. The client preserves queued legacy receipts
unchanged through load/import and sync; it does not re-execute their rewards.

Tracked updates replay building rewards, production, collect-all, sales and
spending exactly. Forged stock, above-capacity stock, refreshed continuous
allowances, extra collection amounts and overspending fail validation. Enrollment
remains an unverified historical baseline, as for coins, additionally bounded by
claimed normal-puzzle history, accepted continuous gem history and building
levels. Sale income enters `MoneyBudget` at its unmultiplied coin value under its
existing observe/hold policy. Honours remain separate.

## Earning and sale terms

`MOONSTONE_ECONOMY` in `src/data/moonstones.js` is the authoritative exportable
contract. Each completed Moon building level grants **1** moonstone once, including
hammer completion. Modernization of a valley building grants none. The workshop
prepares **its level (1 / 2 / 3)** moonstones per **3 completed normal puzzles**.
Elapsed real time does not advance it. Completed batches accumulate up to **10
batches**: 10 / 20 / 30 stones at levels 1 / 2 / 3. Full storage pauses production
and preserves partial progress. Collection takes **all** stock in one atomic
transaction and preserves progress. Upgrading preserves both stock and progress,
with a larger capacity. If a preserved stock is not divisible by the new batch
size, the last batch fills only the remaining space. The upgrade preview shows both stones per batch and storage capacity before its
secondary visitor benefit. The forge keeps its original single-ready-batch behavior; the workshop uses `advanceStoredPuzzleProduction`,
which shares the batch step with `advancePuzzleProduction`.

Once the workshop is built, **300 gems in continuous mode count as one puzzle of
workshop progress**. Each level can supply **3 puzzle credits / 900 gems over the
lifetime of the town**, independently of its 25-coin allowance. Eligible partial
credits persist between visits. The counter measures accepted gems, so partial
credit is preserved without granting a whole puzzle early. Repeated or lower
total-jewel settlements cannot credit twice.

Gems collected while the workshop is unbuilt or full are discarded and do not
consume the remaining allowance. When a settlement fills the workshop, only the
gems needed to reach full stock count; the rest are discarded. For example, with
one puzzle needed to fill storage, a 750-gem settlement uses 300 and discards 450.
After collection, new gems can use the remaining 600-gem allowance. Full-workshop
observations are journaled so even a collection during the same active run cannot
retroactively recover discarded gems. This uses only the continuous receipt's
total `jewels`, with stock, allowance, coins and receipt persisted atomically.
Continuous play still grants no stars, chests, hammers, construction steps, normal
victories or era progress. There are no move or time limits.

The Moon workshop label changes to “Collect N moonstones”. Tapping it uses the
same store transaction and `TownResourceCollection` presentation as valley
resources. Opening the details panel does not collect. That panel also provides
an explicit “Collect N moonstones” action, “Stored N / capacity”, production/full
status, and sells 1, 10, or all stones, with confirmation
for all. A stale all-quantity must be reviewed again.

One moonstone sells for **250 coins**. Sales are exact atomic transactions:
insufficient balances, unsafe integers, overflow or persistence failure leave
both currencies and the journal unchanged. The Homecoming hall celebrates
lifetime earnings, even after stones have been sold or spent.

## Historical phase-1 calibration (2026-10-23)

This predates the integrated monuments and stored workshop. Current prices and
pacing appear in the sections below; these original measurements are retained
as history. Measured in the required Node 24 Docker image:

```sh
node scripts/measure-campaign.mjs . 1 > /output/ph-moonstone-campaign.json
node scripts/measure-moonstones.mjs /output/ph-moonstone-campaign.json
```

The first command actually plays all **546 levels**, seed 1, with the existing
hint-led simulator. The second consumes those measured payouts, simulates the
shared construction and production rules, then repeats the measured last-chapter
median payout (**75,621 coins**) for the post-campaign village. It buys suggested
projects concurrently, collects every ready batch and assumes no chests, hammers,
passive income, sales or raid losses. This is one deterministic economy trajectory,
not a multi-seed estimate of player behavior.

Twin Hollows opens at completed puzzle **646**. Workshop levels finish at **650,
655 and 660**. With one-off building rewards and collected production together:

| Optional total price | First affordable | Puzzles since Twin Hollows opened |
| -------------------- | ---------------- | --------------------------------- |
| 30 moonstones        | 660              | 14                                |
| 60 moonstones        | 686              | 40                                |
| 90 moonstones        | 716              | 70                                |

The then-proposed middle monument price of **60 moonstones** was reachable in
about 40 normal puzzles after entering Twin Hollows, or 26 after this trajectory's
level-3 workshop completes. An already migrated town with 30 building keepsakes
needed **30 more puzzles** at level 3 to reach 60 under those assumptions. The
current integrated monument schedule is **20 / 30 / 40 / 50 / 60** per level,
documented below. This historical projection used the old single-batch workshop.
The stored model keeps the same production rate and avoids lost production while stock has room;
existing balance, stock and partial progress never expire.

The sale rate is intentionally modest: a full level-3 batch sells for **750
coins**, about **1%** of that measured late-game puzzle payout, and 60 stones sell
for **15,000 coins**, below Twin Hollows' 21,000-coin first new-building price.
Selling provides a useful choice without replacing normal mining income.

## Stored-workshop balance comparison (2026-10-24)

Reused the same **546 actually played seed-1 levels** from
`/tmp/ph-msprice-campaign.json`. In Node 24 Docker, ran:

```sh
node scripts/measure-moonstones.mjs /output/ph-msprice-campaign.json
```

Output: `/tmp/ph-wstore-balance.json`. The script simulates both the shipped
one-batch helper and the new stored helper against identical construction and
measured coin inputs. Twin Hollows opens at puzzle 646; workshop levels complete
at 650 / 655 / 660. It visits construction every puzzle and collects workshop
stock promptly or every 10 / 30 puzzles measured from Twin Hollows opening.
No sales, continuous play, chests, hammers or passive income enter these normal-play
trajectories. Monument thresholds are cumulative spending capacity; cosmetic
construction remains additional (3 puzzles for a foundation, then 1 per upgrade).

First 100 normal puzzles after Twin Hollows, including one-off Moon building
rewards. “Stored” is available to collect but has not entered the balance yet:

| Collection frequency | Before: collected + stored | After: collected + stored | Before → after sale value of all produced stones | Share of 100 late-game puzzle payouts, before → after |
| -------------------- | -------------------------- | ------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| Prompt               | 125 + 0                    | 125 + 0                   | 31,250 → 31,250 coins                            | 0.413% → 0.413%                                       |
| Every 10 puzzles     | 60 + 0                     | 125 + 0                   | 15,000 → 31,250 coins                            | 0.198% → 0.413%                                       |
| Every 30 puzzles     | 40 + 3                     | 113 + 9                   | 10,750 → 30,500 coins                            | 0.142% → 0.403%                                       |

The 30-puzzle collector has 122 total produced stones versus 125 for prompt
collection: the initial upgrade/progress alignment reaches the cap before a visit.
Storage protects delayed collection until full; it does not accrue beyond the cap.
Sale comparisons assume collecting the remaining stock at the measurement boundary.
The 31,250-coin prompt total equals 0.413 of one late-game puzzle payout, or
0.413% of 100 such payouts.

Normal puzzles since Twin Hollows to afford each successive monument level,
allowing for all earlier levels' spending. Entries are **before → after**:

| Level price         | Cumulative price | Prompt collector | Every 10 puzzles | Every 30 puzzles |
| ------------------- | ---------------- | ---------------- | ---------------- | ---------------- |
| Foundation: 20      | 20               | 10 → 10          | 11 → 10          | 11 → 11          |
| Grand court: 30     | 50               | 25 → 25          | 70 → 30          | 210 → 30         |
| Living landmark: 40 | 90               | 67 → 67          | 200 → 70         | 600 → 90         |
| Great monument: 50  | 140              | 115 → 115        | 370 → 120        | 1,110 → 120      |
| Town wonder: 60     | 200              | 175 → 175        | 570 → 180        | 1,710 → 180      |
| Both full monuments | 400              | 376 → 376        | 1,240 → 380      | 3,690 → 390      |

The JSON also reports each standalone 20 / 30 / 40 / 50 / 60-stone threshold.
For prompt collection they remain 10 / 14 / 19 / 25 / 37 puzzles respectively;
these standalone costs do not include earlier monument payments.

The maximum lifetime continuous contribution is **3 puzzle credits × number of
unlocked levels**, provided every allowance is unused and storage is collected.
At workshop level 3 this equals that many stones. All 546 current levels provide
**1,638 credits / 1,638 stones for 491,400 accepted gems**, compared with zero
before this change. At workshop level 1 the same allowances yield 546 stones,
so using them earlier spends the same lifetime allowance at a lower yield.
Starting from zero balance at workshop level 3:

| Cumulative monument spending | Continuous levels at 900 gems each | Accepted gems | Stones produced |
| ---------------------------- | ---------------------------------- | ------------- | --------------- |
| 20                           | 7                                  | 6,300         | 21              |
| 50                           | 17                                 | 15,300        | 51              |
| 90                           | 30                                 | 27,000        | 90              |
| 140                          | 47                                 | 42,300        | 141             |
| 200                          | 67                                 | 60,300        | 201             |
| Both monuments: 400          | 134                                | 120,600       | 402             |

One measured late-game normal puzzle pays **75,621 coins**. Selling all 1,638
continuous stones yields **409,500 coins**, or **5.42** such payouts. Selling
400 stones yields 100,000 coins, or 1.32 payouts. A full level-3 workshop sells
for 7,500 coins, 9.92% of one payout. The sale rate remains 250 coins per stone.

**Parity rationale:** the same seed-1 campaign's `results[].jewels` has a median
of **284.5 (about 285) gems per normal puzzle in levels 403–546**, versus **215
across all 546 levels**, with **10.21 gems per move** overall. The initial unshipped 100-gem credit
would have advanced workshop production about three times faster per move than
late-game normal play. **300 gems per credit** brings the effort close to the
late-game normal-puzzle median while retaining three lifetime credits per level.
Both monuments now require 134 fully used continuous levels / **120,600 gems**
at workshop level 3 (about 12,000 moves at that measured gem yield), instead of
40,200 gems. Construction still requires normal completions. This is an effort
comparison, not a measured continuous-session duration. The lifetime maximum
still grows with unlocked levels, but consumes 900 accepted gems per level.
This rate is revised before shipping, so Moonstone version 2 and profile schema 4
remain unchanged; the regenerated server catalog supplies the same rate to replay.
Normal production, prompt-collector milestones, prices and the sale rate are
unchanged; delayed collectors retain production until storage fills.

## Resource and monument API

- `campaign.collectMoonstones(now?) -> amount` collects the entire stored stock and
  persists it before returning its positive amount; zero means nothing changed.
- `campaign.spendMoonstones(amount, reason) -> boolean` deducts a positive safe
  integer only when affordable and durably saved. `reason` is a nonblank string
  of at most 120 characters. It writes a `moonstone-spend` receipt and never
  changes lifetime earnings. Use this for a standalone resource expenditure.
- `campaign.sellMoonstones(amount) -> boolean` atomically exchanges the stated
  quantity at the shared fixed rate, recording `moonstone-sell`.
- `src/data/townCurrency.js` exposes `priceCurrency(price)`,
  `currencyBalance(town, currency)`, `canAffordPrice(town, price)` and
  `payPrice(town, price)`. Price objects use `{ price: 60, currency: 'moonstones' }`;
  omitted currency means coins. `payPrice` is pure and returns a replacement town
  or `null`. Unsupported currencies fail closed. Zero-price offers are allowed.

Monument purchases apply `payPrice` inside the **same** existing
personalisation transaction that creates the paid site. Server `landmark-buy`
replay consumes the site's exported currency and price in that same command. Do not make two separately persisted calls (spend, then create
site): a failed second save could leave a paid but absent monument. The standalone
spend action is not a shortcut around server validation of a monument purchase.
Keep currency in the shared site/offer contract and export its terms in save rules.

## Honours decision and regression coverage

The economy resource is separate from the `moonstone` puzzle gem. Moonstone
Laureate counts puzzle gems in normal and continuous play; earning resource
moonstones never increments it. The separate Lunar Keepsake Collector family
(`moonstone-reserve`) counts lifetime resource earnings, including stones later
spent or sold. These ranks were added in honours version 5 after the original
resource implementation. See [Town Honours](honours.md) for fixed requirements,
calibration and the corresponding shipped fixture and server catalog.

`testing/moonstones.test.js` covers migration, reload/import, fallback, building
rewards, stock caps, normal and bounded continuous production, sales, invalid amounts,
rollback and the currency hook. `testing/integrity-sync.test.js` covers independent
device migration and whole-profile sync. Frontend-generated backend fixtures and
`backend/tests/save-integrity.php` cover exact replay, legacy migration, stale
clients, forged minting, sale accounting, payouts and overspending. The database
save and concurrency suites exercise the same server acceptance pipeline.

The focused browser check can be run against the assigned Docker Vite server with
`PH_TEST_ORIGIN=http://127.0.0.1:5196 node testing/browser/moonstone-resource.cjs`
after sourcing the repository media-tooling environment (the shared brief permits
host Playwright for screenshots). It exercises confirmation/cancel, 10/all sales,
lifetime preservation and a real Moon workshop tap using the shared store actions.

## Phase 2: optional moonstone monuments

Moonstone Garden in the valley and Moonrock Court on the Moon both open in
**Twin Hollows**. An era unlock uses the existing site contract and gives players
an early view of what they can save for, including after selling their last stone.
No additional balance-dependent unlock flag is saved. Earthrise Plaza remains
coin-paid. All three choices at each new site cost **20 moonstones** for the
foundation. Choosing a design is aesthetic; no design offers an economic or
progression advantage.

Both moonstone sites share an explicit five-level price schedule. Coin sites,
including Earthrise Plaza, retain the shared fixed monument multipliers. Prices
are amounts spent on that level, with the cumulative column including previous
levels:

| Level           | Price in moonstones | Cumulative | Normal puzzles after Twin Hollows opens |
| --------------- | ------------------- | ---------- | --------------------------------------- |
| Foundation      | 20                  | 20         | 10                                      |
| Grand court     | 30                  | 50         | 25                                      |
| Living landmark | 40                  | 90         | 67                                      |
| Great monument  | 50                  | 140        | 115                                     |
| Town wonder     | 60                  | 200        | 175                                     |

These are optional projects priced for the rarer resource currency. Buying both
foundations costs **40 stones**, reachable after **19 puzzles** in this trajectory;
completing both wonders costs **400 stones**, after **376 puzzles**. Spending
on one site or selling delays the other. Work duration stays three completed
puzzles for a foundation and one for each later level, followed by unveiling.
There is no expiry, move limit, puzzle timer, era gate or reward change.

Evidence: reran `scripts/measure-campaign.mjs . 1` and
`scripts/measure-moonstones.mjs` on **2026-10-24** in Node 24 Docker, writing
`/tmp/ph-msprice-campaign.json` (546 actually played seed-1 levels) and
`/tmp/ph-msprice-calibration.json`. The script reads the actual moonstone sites
and shared `landmarkPrice` contract and measures their cumulative prices and the total for both sites. Twin Hollows still opens at 646;
the workshop still completes at 650 / 655 / 660. The 60-stone threshold now falls
at completed puzzle 683 (37 since opening), with 90 at 713. This replaces the
phase-1 projection of 686 / 40 for current integrated content. The measured
last-chapter payout remains 75,621 coins; sale rate remains 250. The 20-stone
foundation is first affordable at puzzle 656, one wonder at 821, and both wonders
at 1,022. Batches are collected immediately; no
sales, chest rewards, hammers or passive income are assumed. The estimator tracks
cumulative spending capacity without actually buying monuments, whose cosmetic
construction does not affect earnings or era completion.

Payment is applied through `landmarkPayment` / `payPrice` inside `personalise`'s
existing atomic commit. The `landmark-buy` receipt records currency, canonical
price and monument version. PHP verifies any supplied terms against its exported
catalog and returns the ownership and resource debit in one replay command.
Current receipts use monument version **3** and the sites’ `levelPrices` schedule
(20 / 30 / 40 / 50 / 60). An absent schedule retains the coin multiplier curve;
an incomplete, invalid or unsupported explicit schedule fails closed. Version-2
receipts and pending outbox entries retain the original base-price multiplier
terms (60 / 240 / 600 / 1,200 / 2,100 for moonstone sites), on both client and
server. Existing ownership and balances are preserved without refunds. Resource
sites still reject version 1, the legacy coin-only pricing version. Missing funds
or failed local persistence leave ownership, construction, coins, moonstones,
lifetime earnings and journal unchanged. Lifetime earnings also survive upgrades.

Honours decision: these are optional decorative sites, with no new puzzle gem,
mine element, era or fusion. A Lasting Legacy still names Monument Square
(`monument`); neither new site earns or alters it. The later Landmark Patron
family (`landmark-patron`, honours version 5) counts paid foundations at its
fixed named sites, including Earthrise Plaza, Moonstone Garden and Moonrock Court.
Client `isEraComplete` and server `eraComplete` use required building definitions, never the monument catalog; empty and unfinished
sites do not affect completion.

`testing/moonstone-monuments.test.js` covers atomic purchase/upgrade rollback,
resource receipts, currency display, complete-era independence, settlement and
route clearances, geometry budgets and screen-space label layout. The shared
personalisation and construction suites cover every catalog site. Backend
personalisation checks reject false price/currency/version terms and resource
underpayment. Frontend-generated integrity fixtures replay all five levels of
both sites, including a pending version-2 foundation followed by current-price
upgrades. Backend integrity checks reject a retained moonstone, forged receipt
terms or old prices under a new version. SVG previews use six separate silhouettes, and Moon fallback labels
share the same screen-space layout as the 3D Moon. Lunar labels reserve separation
for all lots, Earthrise Plaza and Moonrock Court at desktop and phone sizes.
