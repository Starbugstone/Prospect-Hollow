# Browser town saving and synchronization

A signed-out browser has one device-local town and makes no background API requests. A signed-in account has up to three cloud towns. Different towns can be played in separate tabs. Opening the same town twice shows a notice and account town picker in the second tab; it does not mount another game or renderer.

## Town identity and ownership

Each tab keeps its selection in `sessionStorage`, and account town URLs include `?play=<town UUID>`. Every private town request includes that UUID in `/api/v1/towns/<UUID>` (with `/settings`, `/history` or `/resolve` where appropriate). Creation includes `townId` in the payload. There is no account-wide selected-town variable on the server and no persistent network connection or gameplay command stream.

A new signed-in tab without a URL or existing selection opens the last selected cached account town (or the first available cached town). Existing tab selections stay independent. A local town is pinned before sign-in so authenticating cannot silently replace unregistered progress. The retained local copy and the account town can share a UUID; identity checks must compare both owner and UUID. An explicit account URL always selects the account record. The town picker must never label its retained guest copy as the current account town.

The save bar and browser title identify the selected town. The bar distinguishes account towns from device-only play, and Sync is offered only for an account town. The account panel offers an explicit way to open the account version of a retained local copy, preserving both records.

The backend derives the user ID from its authenticated session. All private routes look up `towns` with both `id = UUID` and `player_id = authenticated user`, excluding deleted towns. Mutations retain both fields in the SQL update predicate. A UUID, tab selection, public link or client-supplied user ID grants no permission. Another account gets HTTP 404 without a private snapshot, including for conflict resolution and history. Requests without a session get HTTP 401. Client transport also rejects a response carrying a different town UUID.

## Local writes and tab lifetime

Each account town has its own `prospect-town-v2:<owner>:<UUID>` localStorage record containing the profile, revision, local sequence, dirty flag and pending upload together. `crystal-cascade-profile-v3` contains the single guest town. Account/session metadata is separate. Selecting or saving one town never rewrites another town's profile.

A browser Web Lock owns each town while its game is mounted. The guest slot has its own lock. Browser-managed locks release when a tab closes or crashes, without heartbeat timers or leases that can expire while a suspended tab still owns stale game state. Switching towns disposes the old renderer with saves suspended, drains in-flight operations, awaits the browser's actual lock-release promise and loads the new town under its own lock. Account management may download an unopened town under a short lock without mounting its game.

**Open my town here** explicitly transfers play without requiring the other window to close. A BroadcastChannel message names the owner/UUID storage key and a unique request. A separate per-town Web Lock serializes competing transfers. The requester queues an abortable writer-lock request before notifying the owner. The owner pauses input, lets its accepted move finish, drains in-flight saves, stores the current puzzle alongside the local profile, and disposes its renderer with saves suspended before releasing ownership. The recipient restores the profile and puzzle under that same writer lock. The former owner shows a moved-game notice and cannot save or sync; it only returns through another explicit transfer or a fresh page load that successfully acquires ownership. Messages for other towns have no effect.

The puzzle handoff keeps its board, tile damage, objectives, score, unlimited move count, elapsed active-play time, run identity and continuous-mode credits. It does not start a new run or award the same progress again. Renderer objects, input queues and timers are recreated in the receiving window. The temporary puzzle snapshot remains in the atomic town record if the requester closes before opening it; it is removed only after restoration. It is not part of the cloud profile, and does not add general cross-device or reload persistence for unfinished puzzles.

There is **no tab heartbeat or periodic tab polling**. One transfer creates a message exchange and a bounded wait (20 seconds); an active move may settle for up to five seconds without changing its gameplay rules. A save failure, cancelled request, expired message or unresponsive/frozen/older client never causes lock stealing. The original window stays authoritative and the requester gets a recovery message. For a fully frozen window, bring it forward or close it and retry. This restriction prevents the concurrent writers explicitly warned about by the [Web Locks specification's `steal` option](https://www.w3.org/TR/web-locks/#dom-lockoptions-steal).

Cached startup and the duplicate-tab notice do not wait for account HTTP. Concurrent startup and synchronization share the same account refresh promise within a session. A blocked tab downloads no game renderer and offers the town picker or an explicit transfer. Lazy game views show loading feedback and an actionable reload button if their JavaScript chunk fails; the 3D view also shows feedback while its graphics load.

Web Locks require a supporting browser and a secure context (HTTPS, or localhost for development). An unsupported browser displays an explanation instead of writing without coordination. Browser-owned storage remains subject to quota, eviction and user deletion; it is not an access-control boundary against someone controlling that browser. Save failures remain visible and leave the last valid record intact. Cloud copies, five previous server revisions and downloadable backups provide additional recovery paths.

The previous combined record migrates before game startup under a shared migration lock. Cached towns and their pending upload IDs are copied first; the original combined record is replaced last. If any write fails, the original remains readable and the migration can be retried without overwriting already migrated towns. For the first deployment of this format, close every tab running an older game version before reopening the site. Do not clear site data. Downgrading to the combined-record client is unsupported; keep the per-town records and roll forward if a release needs repair.

## Upload coordination and conflicts

Autosave, manual synchronization, explicit conflict resolution, history restoration and settings/deletion operations use the same queue for that town. Different town queues are independent. A pending upload stores its UUID, exact snapshot, base revision and local sequence before HTTP starts. A lost acknowledgment or a closed tab retries that same upload. A receipt clears only the pending upload it matches, and newer local progress remains dirty. History restoration also persists a retry and keeps a recovery copy of the previous local save.

Account/session generations invalidate late responses, including another tab signing into the same account again. Signed-out tabs stop background synchronization. Server revision checks remain the final guard between devices. If the local base revision still matches the server, newer local progress uploads automatically. An unchanged device downloads a newer server revision. Device timestamps never choose the winner.

When both copies changed, the latest server revision is the default. The client atomically preserves its complete local village as a recovery copy before loading the server version. An on-screen notice explains the replacement and offers a review of the preserved local save; the account panel also retains access after dismissal. Money, buildings and bonuses are replaced together, never merged. A remote snapshot is not applied during an active mine: synchronization for that town waits, local play continues, and the final local village state is preserved when the player returns. The client fetches the latest server revision again at that point.

Replacing the server with a preserved local save requires a fresh review and an explicit confirmation. The durable upload contains the exact preserved profile, its upload ID and the reviewed server revision. New local changes invalidate the review; a server revision conflict loads the newer server copy and requires a new confirmation rather than retrying against an unseen revision. A lost response retries the already-confirmed upload unchanged. The previous server copy remains in the five-revision history, and the replaced device version remains downloadable. If persisting the recovery record fails, the original local save remains intact and no renderer reload occurs. Offline progress never requires a server play lease or permission to continue.

Automatic synchronization handles the active town only. Dirty saves are debounced by two seconds, with a ten-second maximum wait during continuous play. Failed attempts back off from five seconds to five minutes with jitter. Visibility and connectivity events do not bypass a pending backoff. Clean saves and timestamp-only income checkpoints do not generate periodic cloud requests. Startup, explicit synchronization and returning to a clean town check for remote changes; return checks are limited to once per minute.

Dirty towns in closed tabs remain durable locally; their next owner resumes synchronization when they are opened. There is no background service worker uploading closed towns. The account screen shows cloud timestamps separately from each town's current local save status.

## Regression coverage

- `testing/town-tabs.test.js`: separate town records and tab selection, interrupted migration, ownership and orderly release.
- `testing/town-handoff.test.js`: event-driven transfer, different-town isolation, competing requests, pending uploads, cancellation, failed saves, expired messages and unresponsive owners.
- `testing/game-handoff.test.js`: exact puzzle continuation beyond 100 moves and the speed target, stable snapshots, run identity, continuous credits and duplicate-reward prevention.
- `testing/cloud-profile.test.js`: shared upload serialization, lost acknowledgments, newer gameplay, conflicts, mine protection and history restoration retries.
- `testing/cloud-transport.test.js`: signed-out isolation, session invalidation and mismatched response UUIDs.
- `testing/sync-scheduler.test.js`: idle request bounds, continuous-play debounce and retry backoff.
- `backend/tests/saves.php`: every private route rejects another account and anonymous requests without modifying the owner's town.
- `backend/tests/concurrency.php`: same-town revision conflict, three-slot capacity races, and successful concurrent saves to different UUIDs.

Real-browser checks additionally cover two active account towns, UUID-scoped requests, duplicate-tab notices without a canvas, reopening after the owner closes, reload persistence, login from an email tab, and local-only behavior.
