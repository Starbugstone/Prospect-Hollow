# Browser town saving and synchronization

A signed-out browser has one device-local town and makes no background API requests. A signed-in account has up to three cloud towns. Different towns can be played in separate tabs. Opening the same town twice shows a notice and account town picker in the second tab; it does not mount another game or renderer.

## Town identity and ownership

Each tab keeps its selection in `sessionStorage`, and account town URLs include `?play=<town UUID>`. Every private town request includes that UUID in `/api/v1/towns/<UUID>` (with `/settings`, `/history` or `/resolve` where appropriate). Creation includes `townId` in the payload. There is no account-wide selected-town variable on the server and no persistent network connection or gameplay command stream.

The backend derives the user ID from its authenticated session. All private routes look up `towns` with both `id = UUID` and `player_id = authenticated user`, excluding deleted towns. Mutations retain both fields in the SQL update predicate. A UUID, tab selection, public link or client-supplied user ID grants no permission. Another account gets HTTP 404 without a private snapshot, including for conflict resolution and history. Requests without a session get HTTP 401. Client transport also rejects a response carrying a different town UUID.

## Local writes and tab lifetime

Each account town has its own `prospect-town-v2:<owner>:<UUID>` localStorage record containing the profile, revision, local sequence, dirty flag and pending upload together. `crystal-cascade-profile-v3` contains the single guest town. Account/session metadata is separate. Selecting or saving one town never rewrites another town's profile.

A browser Web Lock owns each town while its game is mounted. The guest slot has its own lock. Browser-managed locks release when a tab closes or crashes, without heartbeat timers or leases that can expire while a suspended tab still owns stale game state. A tab must close before another tab can claim its town; there is no forced takeover. Switching towns disposes the old renderer with saves suspended, drains in-flight operations, releases the old lock and loads the new town under its own lock. Account management may download an unopened town under a short lock without mounting its game.

Web Locks require a supporting browser and a secure context (HTTPS, or localhost for development). An unsupported browser displays an explanation instead of writing without coordination. Browser-owned storage remains subject to quota, eviction and user deletion; it is not an access-control boundary against someone controlling that browser. Save failures remain visible and leave the last valid record intact. Cloud copies, five previous server revisions and downloadable backups provide additional recovery paths.

The previous combined record migrates before game startup under a shared migration lock. Cached towns and their pending upload IDs are copied first; the original combined record is replaced last. If any write fails, the original remains readable and the migration can be retried without overwriting already migrated towns. For the first deployment of this format, close every tab running an older game version before reopening the site. Do not clear site data. Downgrading to the combined-record client is unsupported; keep the per-town records and roll forward if a release needs repair.

## Upload coordination and conflicts

Autosave, manual synchronization, explicit conflict resolution, history restoration and settings/deletion operations use the same queue for that town. Different town queues are independent. A pending upload stores its UUID, exact snapshot, base revision and local sequence before HTTP starts. A lost acknowledgment or a closed tab retries that same upload. A receipt clears only the pending upload it matches, and newer local progress remains dirty. History restoration also persists a retry and keeps a recovery copy of the previous local save.

Account/session generations invalidate late responses, including another tab signing into the same account again. Signed-out tabs stop background synchronization. Server revision checks remain the final guard between devices: simultaneous changes to the same town produce an explicit comparison, never a blind overwrite. A remote snapshot is not applied during an active mine, including when the mine starts while a download is waiting.

Automatic synchronization handles the active town only. Dirty saves are debounced by two seconds, with a ten-second maximum wait during continuous play. Failed attempts back off from five seconds to five minutes with jitter. Visibility and connectivity events do not bypass a pending backoff. Clean saves and timestamp-only income checkpoints do not generate periodic cloud requests. Startup, explicit synchronization and returning to a clean town check for remote changes; return checks are limited to once per minute.

Dirty towns in closed tabs remain durable locally; their next owner resumes synchronization when they are opened. There is no background service worker uploading closed towns. The account screen shows cloud timestamps separately from each town's current local save status.

## Regression coverage

- `testing/town-tabs.test.js`: separate town records and tab selection, interrupted migration, ownership and orderly release.
- `testing/cloud-profile.test.js`: shared upload serialization, lost acknowledgments, newer gameplay, conflicts, mine protection and history restoration retries.
- `testing/cloud-transport.test.js`: signed-out isolation, session invalidation and mismatched response UUIDs.
- `testing/sync-scheduler.test.js`: idle request bounds, continuous-play debounce and retry backoff.
- `backend/tests/saves.php`: every private route rejects another account and anonymous requests without modifying the owner's town.
- `backend/tests/concurrency.php`: same-town revision conflict, three-slot capacity races, and successful concurrent saves to different UUIDs.

Real-browser checks additionally cover two active account towns, UUID-scoped requests, duplicate-tab notices without a canvas, reopening after the owner closes, reload persistence, login from an email tab, and local-only behavior.
