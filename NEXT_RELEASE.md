# Next release: Beyond New Hollow

Working plan for the next release. Keep it current while the work is under way: tick
steps, record decisions and correct anything that turns out wrong. **Delete this file in
the change that merges the release into `main`.** Lasting facts belong in `docs/`.

## Goal

Give players a reason to keep going after the current content without another full town
rebuild. New Hollow asks for something, the player chooses what it becomes, and the
settlers use the result. The loop that has carried 15 eras stays the same: a completed
puzzle visibly changes a place the player cares about.

A **commission** is a Moon monument site with an opening condition, three permanent
outcomes, a letter and a change in who visits. Adding one takes its site, designs, art and
an entry in `src/data/moonCommissions.js`.

## Who this is for

Players at level 500 with a finished town are power players who ground and min-maxed, so
level 500 is the upper bound, not the norm.

The required town costs about 25.0M coins and the 546 levels pay about 16.3M in simulated
mine coins. What sets the order of a player's two endings is how far their total income
exceeds mine coins: **below about 1.53×, the mine runs out first.**

| Income vs mine coins | Where the town finishes      | Who                  |
| -------------------- | ---------------------------- | -------------------- |
| 1.0×                 | after 117 replays            | mine coins only      |
| 1.2×                 | after 61 replays             | assumed typical      |
| 1.4×                 | after 20 replays             | assumed typical      |
| 1.53×                | level 546, both end together | crossover            |
| 1.75×                | level 517, 29 boards left    | committed player     |
| 1.92×                | level 501, 45 boards left    | today's power player |

Only the 1.92× row is anchored to something we know. The typical range is an assumption
until step 4 replaces it. Figures come from three bot seeds over all 546 levels, using
current prices, and exclude chests, hammers, the saloon and visitors.

What this means:

- **Typical players need new boards first.** They reach level 546 with the town unfinished
  and replay old boards. 18 new boards remove replays entirely for anyone at 1.41× or above.
- **Power players need something to build first.** They finish the town with boards left.
- **Both have to ship.** Neither is optional, and neither blocks the other.
- **Price for the typical player.** A power player being fast is fine.

## Prices

Each commission costs 2M coins over five even stages of 400k. Construction takes the shared 7
completed puzzles, so coins set the pace, at about the rate of Twin Hollows' final stretch.

| Income | Boards per stage | One commission | Three commissions |
| ------ | ---------------- | -------------- | ----------------- |
| 1.0×   | 5.4              | 27             | 81                |
| 1.3×   | 4.2              | 21             | 62                |
| 1.5×   | 3.6              | 18             | 54                |
| 1.92×  | 2.8              | 14             | 42                |

Competing optional spending: coin monuments cost about 9.1M at their cheapest full builds,
and both stone monuments need 400 moonstones. Check balances in step 4 before changing these.

## Steps

### 1. First commission, no new boards (in progress)

- [x] Commission contract: `moonCommissions.js`, a site `opens` condition on client and server
- [x] Earthlight Conservatory at `[0, 33]`, opening at Earthlight Greenhouse level 3
- [x] Three outcomes with 3D and fallback art: Orchard, Crystal Nursery, Bakehouse
- [x] Residents walk a public path to its door; the outcome sets who goes and how often
- [x] Request and thank-you letters, English and French
- [x] Catalogs regenerated; regression tests in `testing/moon-commissions.test.js`
- [x] Honours decision recorded in `NON_MONUMENT_HONOURS`; family added in step 5
- [x] Desktop browser capture of every outcome (`testing/browser/moon-commission.cjs`)
- [x] Moon label check passes at 1440×900, 900×360 and 375×740
- [x] Committed and pushed to `preprod`

### 1b. Valley commission and a clear signal

- [x] Rename the contract to `src/data/commissions.js`, shared by every settlement
- [x] Homecoming Commons at `[66, -102]`, opening at Homecoming Hall level 3
- [x] Three outcomes with 3D and fallback art: Story Hall, Bandstand, Wild Meadow
- [x] The outcome sets the visitors around the valley site
- [x] `commissionStatus()`, one source for every signal
- [x] Light pill on the map and in the Build sheet, letter action icon over the site
- [x] Real-game check of every signal state on desktop and phone, English and French
      (`testing/browser/town-commission-signal.cjs`)
- [ ] Try both commissions on a real phone: art, pill, walkers, frame rate

### 2. New boards

- [ ] Add 18 boards as chapters 92–94, using fresh combinations of existing mechanics
- [ ] Regenerate the honours level index and server catalogs
- [ ] Run `npm run test:levels` and star target calibration
- [ ] Update the level counts in `docs/README.md` and `docs/town-demo.md`

### 3. A third commission

- [ ] Choose its site (see Open questions)
- [ ] Decide whether each waits for the last one, using a new `opens` kind, so letters
      arrive one at a time. Building levels alone would let all three build together
- [ ] Write letters, outcomes and art for each

### 4. Replace assumptions with real numbers

- [ ] Admin overview: towns by era and campaign progress
- [ ] Sample finished towns: coin balance and which monuments they own
- [ ] Revisit the 400k stage price and the typical range above

### 5. Honours and release

- [ ] Add a commissions honour family with fixed goals, raised `HONOURS_VERSION`, shipped
      rank fixtures and calibration evidence in `docs/honours.md`
- [ ] Player-facing entry in `src/data/updates.js` with French text
- [ ] Add commissions to `docs/future-eras.md` and `docs/era-architecture.md`
- [ ] Full Docker checks, level simulations and the Moon browser checks
- [ ] Delete this file in the merge to `main`

## Decisions

- **One signal, from one status.** `commissionStatus()` reports `request`, `work`, `ready` or
  `funding`, most pressing first. The pill reuses the town project pill's look, so it stays
  light, and shows only while a commission is open. It has no dismiss button and saves
  nothing new.
- **No toast or modal.** A gold ring on the pill pulses three times for `request` and `ready`,
  and stops under reduced motion. Screen readers get the arrival through the live region.

- **Not a sixteenth era yet.** A full era re-arts the whole town and repeats the most
  repetitive part of the loop. It can become the finale if commissions land.
- **Any completed puzzle builds a commission**, as monuments already do. Tying builds to
  new chapters would lock out power players still short of level 547.
- **Opens at Earthlight Greenhouse level 3, not at town completion.** Building levels only
  ever rise, so an opened site can never close again, and the server needs one comparison.
  It stays optional, like Earthrise Plaza, and never gates an era.
- **Exclusive outcomes, shared boards.** The choice is permanent; no board is ever locked out.
- **Landmark Patron stays as shipped.** Its measure is fixed, so commissions get a new family.

## Branch

Work is on `preprod`, which holds everything on `main` plus this release. PR #87 merged first,
so nothing here has reached `main`.

## Open questions

- Where does the next Moon commission stand? The flat ground ends at radius 41 and the front of
  the crater is taken. Options are a smaller site radius, moving rover traffic or widening the
  flat floor, which changes existing terrain. The valley still has room.

## Rules that still apply

Unlimited moves and no puzzle timers. Completed obstacles leave no icon. Every Moon parcel
uses the shared pad, tap gesture, camera and build flow. Shipped honours never change.
Commissions never gate an era, a puzzle or a reward. All checks run in Docker.
