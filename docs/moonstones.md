# Moonstones: saved resource and integration contract

Moonstones are an optional town resource, separate from the `moonstone` puzzle
gem. They never gate the campaign, era completion, normal puzzle rewards or
continued play. There are no move or time limits. This change introduces the
resource and selling; it introduces no monuments.

## Save and migration

Profile schema **3** adds these fields to `town`:

- `moonstoneVersion: 1`: deterministic migration marker.
- `moonstones`: spendable nonnegative safe integer balance.
- `moonstonesEarned`: lifetime nonnegative safe integer, unchanged by spending.
- `moonstoneProduction: { progress, charge }`: workshop batch, saved like the forge.
- `lastCollections.moonstoneWorkshop`: the usual collection cooldown checkpoint.

`normalizeMoonstones(saved, normalizedTown)` upgrades old saves once to the sum
of the completed levels in `MOON_LOTS`, exactly the former
`moonstoneKeepsakes(town)` count. The new balance and lifetime counter both start
at that count; production starts empty. It derives a checkpoint, rather than
adding an event to a merged balance. Loading again, importing, or migrating two
devices therefore cannot add a second credit. Sync retains its existing whole
profile conflict and recovery policy; it does not sum currency balances.

Local town storage, cloud upload/download, account/device exports and transfer
files already serialize the whole town. No new top-level transport whitelist or
worker message shape is needed; `syncService.js`, `cloudProfile.js`,
`saveIntegrity.js` and `playerData.js` intentionally retain their shared generic
transport. Save-transfer validation accepts schemas 2 and 3; the store always
writes schema 3. Old saves without Moon buildings receive zero.

The backend accepts schemas 2 and 3, normalizes legacy checkpoints with the same
credit, and protects all four fields in both replay comparisons and signed
recovery checkpoints. A schema-2 client cannot upload over a schema-3 town.
Existing old clients already treat schema >2 as read-only. An old server rejects
schema 3 through the existing unsupported-format response; the local outbox and
progress remain recoverable. Deploy the new backend before the new client.

Normal victories carry `moonstoneVersion: 1`; old pending victory receipts do not
retroactively advance production that the old client never ran. Old pending
building completion receipts still reproduce the migrated keepsake total.

Tracked server updates replay the actual building, victory, collection, sale and
spend commands: changing either counter, inventing a ready batch, changing the
exchange rate, collecting twice or overspending fails reconciliation. Enrollment
is an unverified historical baseline, as for coins, additionally bounded by the
claimed completed normal puzzle history and building levels. Sale income also
enters the existing `MoneyBudget` accounting at its unmultiplied coin value.
That money estimate retains the server's existing observe/hold policy.

## Earning and sale terms

`MOONSTONE_ECONOMY` in `src/data/moonstones.js` is the authoritative exportable
contract. Each completed Moon building level grants **1** moonstone once, including
hammer completion. Modernization of a valley building grants none. The workshop
prepares **its level (1 / 2 / 3)** moonstones per **3 completed normal puzzles**.
Continuous play and elapsed real time do not advance it. A single ready batch
waits until collected; upgrading preserves progress and the already prepared
batch. The forge and workshop use the shared `advancePuzzleProduction` helper.

The Moon workshop label changes to “Collect N moonstones”. Tapping it uses the
same store transaction and `TownResourceCollection` presentation as valley
resources. Opening the details panel does not collect. That panel also provides
an explicit collection action and sells 1, 10, or all stones, with confirmation
for all. A stale all-quantity must be reviewed again.

One moonstone sells for **250 coins**. Sales are exact atomic transactions:
insufficient balances, unsafe integers, overflow or persistence failure leave
both currencies and the journal unchanged. The Homecoming hall celebrates
lifetime earnings, even after stones have been sold or spent.

## Calibration evidence

Measured on 2026-10-23 in the required Node 24 Docker image:

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

A proposed middle monument price of **60 moonstones** is therefore reachable in
about 40 normal puzzles after entering Twin Hollows, or 26 after this trajectory's
level-3 workshop completes. An already migrated town with 30 building keepsakes
needs **30 more puzzles** at level 3 to reach 60. Exact monument prices belong to
phase 2. Players who leave batches uncollected earn more slowly; existing balance
and production never expire.

The sale rate is intentionally modest: a full level-3 batch sells for **750
coins**, about **1%** of that measured late-game puzzle payout, and 60 stones sell
for **15,000 coins**, below Twin Hollows' 21,000-coin first new-building price.
Selling provides a useful choice without replacing normal mining income.

## API for phase 2 monuments

- `campaign.collectMoonstones(now?) -> amount` collects a prepared batch and
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

For a future monument purchase, apply `payPrice` inside the **same** existing
personalisation transaction that creates the paid site. Extend its server
`landmark-buy` replay to consume the site's exported currency and price in that
same command. Do not make two separately persisted calls (spend, then create
site): a failed second save could leave a paid but absent monument. The standalone
spend action is not a shortcut around server validation of a monument purchase.
Keep currency in the shared site/offer contract and export its terms in save rules.

## Honours decision and regression coverage

No new mastery family is added: this is an economy currency, not a new gem, mine
element, era or fusion. The shipped `moonstone` honour continues to count puzzle
gems only; earning resource moonstones never increments it. Existing ranks,
requirements and the shipped fixture remain unchanged. The public content and
save-rule catalogs are regenerated.

`testing/moonstones.test.js` covers migration, reload/import, fallback, building
rewards, batch caps, normal versus continuous production, sales, invalid amounts,
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
