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
wipes, automatic deductions, earning-rate thresholds, move budgets or puzzle time
limits. Optional score and speed rewards retain their existing rules, and a player
can keep matching after the speed target and beyond 100 moves.

Transient failures retain the exact upload, including its timestamp and action IDs,
for retry. An acknowledgment removes only the uploaded prefix of the journal.
Actions earned while the upload was in flight remain queued, and their resources
stay in the local game. Receipt acknowledgment alone does not make a town dirty or
start another upload. Unsupported journal or content definitions are preserved
instead of silently being converted into a fresh trusted save.

The first synchronized checkpoint anchors the device clock to the server clock,
so a stable clock offset does not prevent normal play. Later timestamps cannot
expand that trusted envelope by changing the device clock. Cloud collection
checks preserve genuine offline elapsed time and the existing reserve capacity.
Clock discrepancies are recoverable save problems, never evidence for banning a
player, and never stop an active puzzle.

## Journal contract

`profile.integrity` contains `version: 1`, a UUID `epoch`, `baseSequence`, an optional
upload `clientAt`, and `actions`. Each action has a unique UUID `id`, a contiguous
`sequence`, a `kind` and semantic `data`. Client-provided prices or arbitrary
balance deltas are not authoritative. The existing upload ID and revision check
still serialize whole snapshots and make acknowledgment-loss retries idempotent.

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
raid outcomes and era advancement. Continuous play records economic changes only;
after the existing lifetime coin reward is exhausted, further matches remain
playable without adding a journal entry for every score update. Statistics do not
become completion gates.

Long offline sessions can upload up to 8 MiB of profile data, including queued
actions. The gameplay snapshot excluding those actions and the sealed cloud
snapshot retain the existing 1 MiB bound. Successful synchronization prunes the
acknowledged journal. These are storage and request safeguards, not puzzle or
action allowances; a failed upload preserves the local game.

## Shared definitions and release checks

`scripts/export-save-rules.mjs` generates `backend/content/save-rules.json` from the
same era, building, chapter, level, price and reward definitions used by the game.
Its digest is deterministic. New eras, plots and mine chapters are exported
automatically, including legacy migration ranges and existing fallback targets.
The exporter runs in Docker and in the frontend stage and hosting release build.
`--check` detects a stale committed catalog; no catalog generation or hashing runs
on a move or rendering frame.

The exporter also maintains `backend/content/save-rule-history.json`, retaining
known score, chest and speed thresholds when content changes. An offline victory
can use an older threshold tuple only when all three recorded values match a
known version of that level. Client-invented or mixed thresholds cannot authorize
extra rewards. Publish content changes together with the regenerated history,
catalog and frontend accounting fixtures so queued rewards survive updates.

Frontend tests cover receipt persistence, acknowledgment races, retries, interrupted
chest recovery, continuous-play journal growth and unlimited moves. Backend tests
cover accounting, tampered snapshots, malformed nested values and migration
compatibility. Real frontend snapshots provide cross-language accounting fixtures
so rule changes cannot silently reject normal rewards. Run all local checks in the
Docker images documented in `AGENTS.md`.
