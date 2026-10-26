# VIP purchase economy

New VIP purchases use `economyVersion: 2` and pay
`VIP_SPEND_BASES[2] (10) + miningDepthBonus(10, deepestCompletedLevel)`.
This is exactly ten times the existing mining chapter multiplier. Normal campaign
records determine the deepest completed level, regardless of replay order or town era.
No completed records means chapter one. Unsupported catalog IDs are ignored; if none
remain, chapter one is the fallback. Adding campaign chapters automatically extends
VIP rewards through the shared mining helper and exported level multipliers.

`src/data/vipVisits.js` owns the frontend amount. `campaignStore` atomically saves the
wallet credit, deduplication key and versioned integrity action, then returns the
credited amount to `TownView` for its coin popup. A failed save returns zero and restores
all three. Guests, live players, eligible buildings, visit counts and the 64-receipt
history retain their existing behavior. The shared, catalog-exported `VIP_SPEND_BASES`
table fixes each receipt's base: unversioned (version 0) pays exactly **5** without
depth scaling; version 1 keeps **5 × depth**; version 2 pays **10 × depth**. Version 1
was already used by preprod testers, so queued v1 actions must still pay 455 at
chapter 91, while new v2 actions pay 910. Loading a journal never upgrades its terms.
Historical receipt keys remain unchanged. The server derives the amount from its
validated records at the action's position in the journal and its own exported catalog;
client-supplied amounts cannot increase it. Unknown versions are rejected. MoneyBudget
counts the entire VIP credit as new money, without mining's multiplier normalization.

## Settlements

VIPs visit New Hollow on the Moon under the same rules and code as the valley. Moon
transports are registered in the shared `VISITOR_ARRIVAL_SITES` with
`settlement: 'moon'`: a climber docking at the Ribbon landing and the visiting saucer at
rest on the Saucer Pad. `MoonVipArrivals` extends `TownVipArrivals`, so each arrival
draws once (`vipVisitor`, 25%), only one arriving VIP tours at a time and a Moon view
opened mid-dwell never replays that arrival. Tours use the shared itinerary
(`visitOrder`, `tourPairs`, `vipVisitCount`, `updateItinerary`) along the Moon's public
paths, hatch to hatch; purchases emit the same receipt, through `TownView` and
`campaignStore.collectVipSpending`, as a `vip-spend` action the server checks against
`economy.vipBuildings`. The Moon shops are `newHollowCommons` (the settlement hall, as
the valley's city hall), `moonstoneWorkshop` (a keepsake shop) and `earthriseLookout`
(a paid view, as the museum). Homes, utilities, the greenhouse farm, the garden dome,
the rover barn and the transport pads are not shops. The valley rests while the Moon
map is open, so the two never earn at once.

## Active-town balance evidence (2026-10-24)

Reproduce from the repository root, after installing dependencies in Docker:

```sh
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/app -w /app \
  node:24-bookworm-slim node scripts/measure-vip-income.mjs
```

The probe builds a full Twin Hollows town with 13 eligible finished shopping buildings
and all four visitor sources. It samples **16 seeds × six hours = 96 active town hours**.
It calls the production transport schedules, `vipVisitor`, `TownVipArrivals`, itinerary
preparation/selection and purchase lifecycle, walking the authored routes at the game's
0.55 units/second (`VILLAGER_WALK_SPEED`). It preserves the shared one-active-arriving-VIP rule and indoor pauses.
It excludes building collision geometry, crowd delays, modals, cinematics, mine visits,
loading midway through arrivals and time away. This is an uninterrupted active-town
estimate, not a measured idle/offline income promise. VIPs earn nothing offline.
The chapter comparisons hold the same late-game town/cadence fixed to isolate payout
scaling; an actual chapter-one town lacks these four transport sources.

- Arrivals/hour: rail **17.83**, boat **38**, aircraft **15**, elevator **78.33**.
  Each arrival independently has a 25% VIP draw, about **37.70 draws/hour** here.
- Long tours and the one-active-visitor rule reduce admission to **5.61 VIPs/hour**.
- A 100,000-seed `vipVisitCount` sample gives **50.038% zero**, **47.872% one**,
  **2.090% two** purchases (the designed distribution is 50% / 48% / 2%).
- The prepared full-town routes consist of **64 sightseeing plans with zero eligible
  stops** and **256 plans with two stops**; visit count clips the selected plan.
- The combined simulation produces **2.5104 purchases/hour**. Thirteen eligible shops
  do not multiply each VIP's allowance: a tour still has at most two purchases.

| Completed chapter | v2 coins/purchase | Historical v1 coins/hour | New v2 coins/hour | Share of full-town saloon/hour |
| ----------------- | ----------------: | -----------------------: | ----------------: | -----------------------------: |
| 1                 |                10 |                    12.55 |             25.10 |                          0.19% |
| 30                |               300 |                   376.56 |            753.13 |                          5.72% |
| 60                |               600 |                   753.13 |          1,506.25 |                         11.45% |
| 91                |               910 |                 1,142.24 |          2,284.48 |                         17.36% |

The unversioned flat-five economy yields **12.55 coins/hour** at every depth in this
same model. The v1 column preserves the earlier five-times-depth measurements as
history; the v2 column is the rerun after the approved doubling. Both use the
same unchanged purchase cadence. The probe calls `vipSpend` for each version,
so its hourly totals follow the runtime definition rather than a separate formula.

The same full town earns **13,157 saloon coins/hour**, calculated by the production
`floor(2.25 × service level × population × (1 + 1.25 × happiness / 100))` formula.
At chapter 91, one VIP purchase is **1.20%** of the recorded **75,621-coin** late-game
normal-puzzle median ([moonstone calibration](moonstones.md)); one active hour of VIP
income is **3.02% of that puzzle**, or about **33.1 active town hours per puzzle's coins**.
The approved base ten is implemented for new v2 receipts. VIPs remain supplemental
to mining and below the full-town saloon's hourly income. The integrated rerun in
[the economy balance check](economy-balance.md) measures the effect on town progression.
No payout, visit or progression rule creates a move cap or puzzle timer.

### New Hollow on the Moon

The same probe plays a full Twin Hollows Moon (3 eligible shops, both transports) for
**64 seeds × six hours = 384 active hours** through the real `MoonScene` transports,
`MoonVipArrivals` and Moon tours at the settlers' walking pace. Moon walks are short,
so with the valley elevator's 46-second climber cadence a first run earned about
**2.8 purchases/hour, 112%** of the valley. The Moon side was tuned instead of the shipped
valley terms: a climber reaches the Moon on every third valley trip
(`MOON_CLIMBER_CYCLE`, 138 seconds); the saucer keeps its 150-second cycle.

- Arrivals/hour: climber **26.17**, saucer **24**; **12.47 VIP draws/hour**.
- The one-active rule admits **8.06 VIPs/hour**; each tour plan set is a sightseeing
  lap, two two-shop plans, one one-shop plan and one sightseeing pair.
- **2.0156 purchases/hour**, **80.3%** of the valley's 2.5104: **20.16** coins/hour at
  chapter 1 and **1,834.22** at chapter 91 (valley 25.10 and 2,284.48).
