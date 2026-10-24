# VIP purchase economy

New VIP purchases pay `VIP_SPEND_BASE (5) + miningDepthBonus(5, deepestCompletedLevel)`.
This is exactly five times the existing mining chapter multiplier. Normal campaign
records determine the deepest completed level, regardless of replay order or town era.
No completed records means chapter one. Unsupported catalog IDs are ignored; if none
remain, chapter one is the fallback. Adding campaign chapters automatically extends
VIP rewards through the shared mining helper and exported level multipliers.

`src/data/vipVisits.js` owns the frontend amount. `campaignStore` atomically saves the
wallet credit, deduplication key and versioned integrity action, then returns the
credited amount to `TownView` for its coin popup. A failed save returns zero and restores
all three. Guests, live players, eligible buildings, visit counts and the 64-receipt
history retain their existing behavior. `economyVersion: 1` selects depth scaling;
previously queued actions without a version keep exactly five coins, even at chapter 91.
Historical receipt keys remain unchanged. The server derives the amount from its
validated records at the action's position in the journal and its own exported catalog;
client-supplied amounts cannot increase it. Unknown versions are rejected. MoneyBudget
counts the entire VIP credit as new money, without mining's multiplier normalization.

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
0.55 units/second. It preserves the shared one-active-arriving-VIP rule and indoor pauses.
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

| Completed chapter | Coins/purchase | Previous VIP coins/hour | Scaled VIP coins/hour | Share of full-town saloon/hour |
| ----------------- | -------------: | ----------------------: | --------------------: | -----------------------------: |
| 1                 |              5 |                   12.55 |                 12.55 |                          0.10% |
| 30                |            150 |                   12.55 |                376.56 |                          2.86% |
| 60                |            300 |                   12.55 |                753.12 |                          5.72% |
| 91                |            455 |                   12.55 |              1,142.24 |                          8.68% |

The same full town earns **13,157 saloon coins/hour**, calculated by the production
`floor(2.25 × service level × population × (1 + 1.25 × happiness / 100))` formula.
At chapter 91, one VIP purchase is **0.60%** of the recorded **75,621-coin** late-game
normal-puzzle median ([moonstone calibration](moonstones.md)); one active hour of VIP
income is **1.51% of that puzzle**, or about **66.2 active town hours per puzzle's coins**.
VIPs therefore remain a conservative supplemental reward. The agreed base five is
implemented. If the intent later becomes a stronger passive income stream, base ten
would give about **2,284/hour**, **17.36% of saloon income**, and **3.02% of that puzzle
per hour**; that would require a new receipt version and a separate balance decision.
No payout, visit or progression rule creates a move cap or puzzle timer.
