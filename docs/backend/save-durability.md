# Save durability and recovery

Gameplay stays local. Guests use one local town and make no account API requests.
Account towns keep independent UUIDs, local records and browser writer locks.
Server access always checks the authenticated owner; a UUID is never authorization.

## Revisions and retries

Only a gameplay snapshot upload increments the town revision. Names and public
visibility do not modify that revision, create gameplay history, or invalidate
an upload receipt. Clients still refresh metadata when the gameplay revision is
unchanged. Explicit replacement uses the same compare-and-set revision check as
normal saving: another server update requires a new review and confirmation.

Transient upload failures keep an immutable request for an exact retry. A
conclusive 413/422 response clears that rejected request, keeps current progress,
and shows a persistent notice. The unchanged rejected snapshot is not polled.
Newer progress can be uploaded; an unsupported save format waits for an explicit
retry after a compatible deployment. Supporting a new format requires an explicit
client/server compatibility change; never silently accept unknown structures.

Creation and attachment retain their UUID and exact request while the outcome is
unknown. A corrected name is accepted after a conclusive validation rejection.
Changing the typed name during an uncertain creation retries the original town;
the accepted town can then be renamed in its settings without using another slot.

## Preserved copies

Before replacing dirty local progress, synchronization commits an immutable copy
to the browser's IndexedDB recovery archive. Town records contain only the latest
copy's descriptor. Consecutive conflicts and history restores create separate
copies, never overwrite earlier ones, and do not combine money or bonuses.

The recovery dialog lists archived copies and allows review, download, explicit
server replacement, and confirmed removal. Dismiss only hides the notice. Old
inline recovery copies are archived before their pointer can be replaced. Archive
failure prevents replacement of current local progress. A concurrent local save
while an archive transaction commits also prevents replacing that newer progress.

The active town and puzzle handoff remain in localStorage for the existing
synchronous gameplay save contract. Pending uploads are committed to IndexedDB
before writing their retry pointer into the town record. Retries read that same
immutable snapshot, even after reload or further offline progress. Completed or
conclusively rejected uploads release their snapshot; legacy inline requests
still retry unchanged. Deferred conflicts retain a small
revision marker; their full cloud profile is fetched again before application.
Removing the archive payload from each checkpoint and avoiding a redundant copy
of parsed metadata reduces synchronous storage work. Checkpoints parse the town
once and reuse its canonical comparison key only when the exact stored record
is unchanged; writes by another tab invalidate that cache. Browser storage is still
finite: quota failures preserve the previous durable record, and the game warns
that current progress is not saving. Export valuable progress before clearing
site data. Account deletion explicitly clears its cached towns and archive on
that device; ordinary logout and session expiry do not delete progress.

## Expired sessions and deleted towns

A 401 expires cloud credentials without clearing the cached account identity,
changing town selection, releasing its writer lock, or closing a puzzle. Other
tabs observe the expired state and stop cloud requests. Offline play remains
available; signing into the same account resumes synchronization under the usual
revision checks. Explicit logout still switches to the guest town.

A missing cloud town remains playable from its cached copy. The town panel can
create a new account town from that progress with a fresh UUID, subject to normal
slot limits and authenticated ownership checks. Deleted UUIDs remain tombstoned.
The device-copy list also works while the session is expired. It allows opening
cached towns offline and explicitly removing unused local copies and their
archives, without deleting the cloud town. Removal requires confirmation and
the town's writer lock; a town currently open in another tab cannot be removed.

## Database installation

Initial table creation is idempotent and existing indexes are detected before
creation. An interrupted MySQL install can therefore resume without deleting its
previously created tables or rows. PostgreSQL keeps its transactional migration.
The API regression suite tests interruptions both partway through DDL and before
the final migration version marker, using isolated temporary table names.

## Browser regression checks

The standalone scripts in `testing/browser` use Playwright against the Vite dev
server. They mock account API responses and use disposable browser profiles;
they do not access player accounts. Install Playwright separately or point
`PLAYWRIGHT_MODULE` at an existing installation, start Vite on port 8192, then run:

```sh
node testing/browser/session-expiry.cjs
node testing/browser/save-durability.cjs
```

`PH_TEST_ORIGIN` overrides the dev-server origin. The checks cover live puzzles
across expiry/reconnection, independent device stores, successive archived
conflicts, reload, download, explicit overwrite, history restore, permanent
upload rejection, and failed archive writes. The village uses the lightweight
fallback renderer in these save tests; they do not benchmark WebGL rendering.
