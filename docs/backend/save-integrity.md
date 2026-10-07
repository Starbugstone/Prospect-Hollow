# Save integrity

The game records resource-changing actions locally and sends them with the existing
background save upload. The backend recalculates those actions from the accepted
cloud checkpoint and compares the resulting money, inventory and progression with
the submitted snapshot. Editing a tracked snapshot's balance, items or building
levels without corresponding valid actions cannot replace the cloud save.

This protects accounting, not proof of human play. Puzzle scores, collected gems,
completion assertions, chest rolls and simulated VIP visits originate in the
client. An attacker who fabricates valid-looking gameplay actions can still claim
rewards. Proving puzzle completion would require deterministic engine replay,
which this release does not add. Guest play is entirely local and remains editable
by anyone controlling that device.

## Compatibility and player recovery

An older cloud save or first attached local town establishes a migration baseline.
Historical earnings cannot be proven and are not retrospectively removed. Once a
town has a tracked checkpoint, an ordinary save cannot erase its journal or reset
its epoch to establish another baseline.

Validation failure preserves the device copy and the last accepted cloud save.
The existing save status explains the synchronization problem. A rejected immutable
upload is released, while the current profile and queued actions remain intact;
the unchanged rejected snapshot is not repeatedly sent. There are no bans, save
wipes, automatic deductions, move budgets or puzzle time limits. Optional score
and speed rewards retain their existing rules, and a player
can keep matching after the speed target and beyond 100 moves.

Transient failures retain the exact upload, including its timestamp and action IDs,
for retry. An acknowledgment removes only the uploaded prefix of the journal.
Actions earned while the upload was in flight remain queued, and their resources
stay in the local game. Receipt acknowledgment alone does not make a town dirty or
start another upload. Unsupported journal or content definitions are preserved
instead of silently being converted into a fresh trusted save.

The first synchronized checkpoint anchors the device clock to the server clock,
so a device clock that runs ahead does not prevent normal play. The upload is
stamped when it is queued, so a delayed first delivery reads like a slow clock;
the stored offset is therefore never negative and server time is always allowed.
A corrected clock or another device keeps syncing, and this grants no time beyond
the server's own. Later timestamps cannot expand that trusted envelope by changing
the device clock. Cloud collection
checks preserve genuine offline elapsed time and the existing reserve capacity.
Clock discrepancies are recoverable save problems, never evidence for banning a
player, and never stop an active puzzle.

## Server-time money estimate

Tracked towns also carry a server-owned allowance for new money. The server
captures real Unix milliseconds inside the save transaction. The estimate uses
the elapsed server time since its last accepted budget checkpoint, independently
of client timestamps, puzzle elapsed time or the device clock offset.

The initial allowance is **10,000 base coins**, issued once. Each real server
second adds **1,000 base coins**, and unused allowance carries across saves without
a short storage cap. New earnings are converted to base coins using their
authoritative mining depth multiplier. For example, before any allowance has
been used, a town with 60 seconds since its last checkpoint has 70,000 base coins
available. At depth multiplier 67 that is at most 4,690,000 new coins from that
depth. These deliberately generous figures are a plausibility estimate, not a
mathematical proof of possible play.

The check counts gross new earnings before spending: mining rewards, chest money,
chapter gifts, continuous credits, simulated VIP spending and newly earned
bounties. It reserves the maximum permitted cash value when a new selectable
chest is issued, so delaying the claim cannot avoid the check. Previously accepted
chests, stored saloon income and exact refunds are existing entitlements; collecting
them does not spend a second earning allowance. Their own accounting rules still
apply.

A long puzzle keeps its accumulated allowance through intermediate syncs. Offline
time replenishes the allowance in full. Successful upload retries do not charge
again. Signed recovery and authorized admin history restores keep the latest
town's server budget. Signed recovery compares its
cumulative source accounting with the accepted high-water mark, rather than
renewing credit from an old checkpoint. Older checkpoints without a budget use
the last trusted database save time when available; first enrollment remains an
unverified historical baseline.

`SAVE_MONEY_GUARD_MODE=observe` is the default. A batch above the estimate is marked
for review in owner-only integrity metadata and still synchronizes; its debt
carries forward instead of disappearing on the next upload. The latest town
ledger retains `lastReview` and `reviewCount` even after enough time has elapsed
to cover the debt; harmless syncs and backup restores cannot erase that evidence.
These fields are available in the owner/admin save data and are not published in
the shared town appearance. Set the server-only
mode to `hold` to refuse an excessive batch with `save_money_review`. That refusal
preserves the device copy and the last accepted cloud save and does not interrupt
play, clip earnings or ban anyone. Hold mode can delay legitimate cloud saving:
unlimited moves and client-generated reward measurements have no proven finite
earnings-per-second ceiling. Only deterministic gameplay verification could prove
that a claimed reward was earned.

## Frontend mutation checks

The browser installs a campaign-store guard before creating its stores. Protected
money, inventory and progression fields accept changes only inside the normal
game actions. Direct assignments, nested edits, deletions and `$patch` attempts
cannot grant coins or completion records. Generic `commit`, transaction and
receipt helpers cannot open that permission scope themselves. Normal actions
still calculate rewards, purchases and unlocks with their existing rules.

The guard checks mutations at action boundaries; it adds no animation-frame
checks, puzzle limits, requests or persisted-save hashing. Reloading, importing a
valid backup and receiving cloud updates use the existing recovery paths. Local
save formats and historical migration remain compatible.

Registered `prospectDebug` commands retain their explicit local exception in
development, preprod and builds with `VITE_DEBUG_TOOLS=true`. Enabling those tools
does not exempt arbitrary direct mutations. Each command also records a `testing`
receipt. A server whose `APP_ORIGIN` host starts with `preprod.`, or which sets
`SAVE_TESTING_TOOLS=true`, accepts an upload carrying that receipt as a new
unverified baseline, like enrollment: it keeps the latest clock offset, run in
progress, Town Honours counters and money budget, and later uploads are replayed
normally again. Any other server rejects the receipt as a mismatch, so production
tracked saves still require valid resource accounting.

These JavaScript checks deter straightforward console changes, not a player who
modifies browser code. Local-only saves and first-enrollment history remain
editable, and calling normal reward actions with invented gameplay measurements
is still a claim rather than proof of play. The server remains authoritative for
tracked cloud snapshots and the time-based money review.

## Journal contract

`profile.integrity` contains `version: 1`, a UUID `epoch`, `baseSequence`, an optional
upload `clientAt`, and `actions`. Each action has a unique UUID `id`, a contiguous
`sequence`, a `kind` and semantic `data`. Client-provided prices or arbitrary
balance deltas are not authoritative. The existing upload ID and revision check
still serialize whole snapshots and make acknowledgment-loss retries idempotent.

A guest town has no server to acknowledge its receipts, and enrolment accepts its
history as an unverified baseline that reads only the receipts of a run in progress.
Once a guest journal holds more than 200 receipts, it keeps just that run's
receipts and advances `baseSequence` past the rest, so the local save stays
bounded. A guest journal the server has sealed, such as the copy kept after
attaching a town, and a guest town being attached keep every receipt.

The server response includes `integrity` with `version`, `epoch`, `ackSequence` and
`status`. The stored profile keeps an empty action list at that acknowledged
sequence, plus server-owned context needed for an active run and clock accounting.
Client-supplied context cannot override it.

Tracked checkpoints also carry an opaque server signature over their economic
state, sequence, run context and town identity. A backup can therefore prove its
original checkpoint after it has fallen out of the five-snapshot cloud history.
Explicit recovery replays its offline action suffix from that checkpoint and
replaces the branch under the normal revision lock; it never merges balances.
Invented checkpoints, changed signatures and checkpoints from another town cannot
establish a new baseline. Signing and verification run during cloud sync, not on
individual moves or local saves.

Confirming a backup-file import into an account town marks its next immutable
upload as explicit recovery. The signed checkpoint and offline suffix use the
same recovery route as cloud history. Retry preserves that intent and exact
upload; acknowledgment clears it while keeping any later local progress.

The journal covers run start, normal completion, continuous-play earnings, chest
claims, item consumption, shop purchases, building purchase/completion, builder
hammers, forge production, saloon collections, visitor collections, VIP receipts,
space-helmet finds, raid outcomes and era advancement. A `helmet-find` pays the town's
hourly saloon rate once per completed puzzle (`completedRuns` above `helmetRun`) from
Tomorrow City on. A `helmet-visitor` pays half that rate (`spaceHelmetRewardHours` in the save rules) for a find
made while visiting another town, only with the server's receipt for this town and a find time
after `helmetVisitAt`.
Both count as new earnings in the money estimate. Continuous play records economic changes only;
after the existing lifetime coin reward is exhausted, further matches remain
playable without adding a journal entry for every score update. Statistics do not
become completion gates.

Long offline sessions can upload up to 8 MiB of profile data, including queued
actions. The gameplay snapshot excluding those actions and the sealed cloud
snapshot retain the existing 1 MiB bound. Successful synchronization prunes the
acknowledged journal. These are storage and request safeguards, not puzzle or
action allowances; a failed upload preserves the local game.

## Town Honours

`profile.honours` ([Town Honours](../honours.md)) is the owner's presentation and
history, not money. It stays outside the replayed fields, so an honours-only change
replays nothing and never causes a mismatch. Honours never block syncing.

### Server counters in the replay

The lifetime counters that count-based ranks measure are kept by the server in the
integrity context as `context.honours` = `{gems: {}, mine: {}, fusions: {}, forge,
guardian}`. They travel with every checkpoint, including the signed one, so signed
recovery replays from the counters of its own checkpoint. The replay credits them from
the journal, so offline play is credited when its queued actions sync:

- `victory` credits the level's authored mine elements from `save-rules.json`
  (`levels[id].honourElements`, generated by the same `levelElements()` as the game),
  plus the receipt's `honours` claim `{gems: {type: n}, fusions: {key: n}}` when it is
  plausible: only keys listed in `save-rules.json` `honours.gems` / `honours.fusions`,
  safe non-negative integers, and each map totalling at most the receipt's `jewels`.
  An implausible or missing claim credits nothing from that claim and never rejects the
  save.
- `forge-collect` adds one to `forge`.
- `raid-seen` adds one to `guardian` when the incident being seen was protected with
  no loss (any incident kind).

A town tracked before honours existed has no counters in its checkpoint context. The
replay then starts from what that checkpoint's town proves, the client's `seedCounts()`
rule: a saved blacksmith collection time is at least one forge collection, and a seen,
fully protected incident at least one. First enrollment (the baseline branch) starts
the counters from the client's own sanitized `honours.counts`, raised to those seeds,
under the same unverified historical baseline policy as money above. Signed recovery,
history candidates, exact-snapshot epoch rotation and admin restores never leave a
counter below the latest cloud save's: the branch's counters are maxed with the latest
context, so actions replayed again are never counted twice and nothing is lost.
Acknowledged actions are never replayed again, so retries cannot double-count.

What this proves is accounting, not play. Mine elements and the forge and guardian
counts follow validated journal actions. Gem and fusion counts remain client claims
bounded by the receipt's jewels, exactly like the score, jewels and chests of the same
receipt.

### Stored block and verification

Every accepted upload (attach, save, signed recovery and history restore) and every
admin history restore stores a merged honours block. Earned entries are unioned with
the earliest known date and either copy's seen and announced flags; the incoming copy
chooses the showcase; `backfilled` and `seenGeneration` take the larger value. For a
tracked town `counts` are the server counters, and the social counts (`visitors`,
`travels`) the largest of the stored, incoming and server counts, so other devices
pulling the cloud copy get the true counts. An untracked town keeps the sanitized
max-merge of both copies; counts are never summed.

`verified` is server-owned: the previous stored list plus every catalog rank the
accepted save proves now (see [visitors](visitors.md#town-honours)). It never comes
from an upload, and no ID is ever removed. An upload without an honours block, from an
older client, keeps the cloud honours. The merge is idempotent; upload IDs, exact-retry
responses, revisions and the integrity seal are unchanged. A restored older snapshot
therefore returns to the device with the honours earned and verified since.

The block is sanitized like the client's `normalizeHonours`, never rejected: malformed
values are dropped, unknown future honour IDs are kept in storage (up to 32 beyond the
catalog) without being displayed, and evidence and count keys are capped. A malformed
block never prevents saving. `backend/src/Honours.php` implements the merge, bounds and
verification from the catalog that `scripts/export-public-content.mjs` exports to
`backend/content/public-schema.json`; the export fails when a rank uses a measure kind
the server cannot evaluate.

## Shared definitions and release checks

`scripts/export-save-rules.mjs` generates `backend/content/save-rules.json` from the
same era, building, chapter, level, price and reward definitions used by the game.
Its digest is deterministic. New eras, plots and mine chapters are exported
automatically, including legacy migration ranges and existing fallback targets.
The exporter runs in Docker and in the frontend stage and hosting release build.
`--check` detects a stale committed catalog; no catalog generation or hashing runs
on a move or rendering frame.

Chest coins are versioned. Under version 3, the current one, `levels[id].chestCoins[3]`
is the level's chapter value and `eras[id].chestCoinCap` caps it for the town era the
chest was issued in. A pending chest stores its `economyVersion` and, from version 3,
its `era`; a claim always resolves from those saved terms, so advancing the town
before opening a chest changes nothing. A victory receipt names its version. A queued
receipt without one comes from a client older than version 3 and replays under
version 2, so offline rewards survive the update. Unknown versions and eras are
refused.

The exporter also maintains `backend/content/save-rule-history.json`, retaining
known score, chest and speed thresholds when content changes. An offline victory
can use an older threshold tuple only when all three recorded values match a
known version of that level. Client-invented or mixed thresholds cannot authorize
extra rewards. Publish content changes together with the regenerated history,
catalog and frontend accounting fixtures so queued rewards survive updates.

Frontend tests cover receipt persistence, acknowledgment races, retries, interrupted
chest recovery, continuous-play journal growth and unlimited moves. Backend tests
cover accounting, tampered snapshots, malformed nested values and migration
compatibility. Money-budget tests cover exact boundaries, debt, server clock
changes, long active/offline play, gross earnings hidden by spending, pending
rewards, recovery and persistent review evidence. Real API transaction tests on
both databases also cover observe/hold behavior, untouched cloud state on refusal,
exact retry responses and old-checkpoint timestamp migration. Real frontend
snapshots provide cross-language accounting fixtures
so rule changes cannot silently reject normal rewards. Run all local checks in the
Docker images documented in `AGENTS.md`.
