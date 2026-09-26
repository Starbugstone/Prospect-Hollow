# Replacement backend validation

The September 2026 replacement removes the PHP gameplay engine and tests the account-save contract directly. Historical review screenshots and benchmarks describe the retired prototype.

- `npm run verify`: formatting, frontend regression suite (including unlimited puzzle moves) and production build.
- `node scripts/export-public-content.mjs`: generates only the era/building appearance allowlist from the shared frontend definitions.
- `TEST_DATABASE_URL=... php backend/tests/saves.php`: account authentication, ownership, three slots, per-account names, snapshot validation, revisions, conflicts, idempotent retries, five-save history, moderation, safe public projection, deletion, native transport and revocation.
- `TEST_DATABASE_URL=... php backend/tests/concurrency.php`: real concurrent connections race for the final account slot and for the same town revision. Both PostgreSQL and MySQL are required.
- `TEST_HTTP_ORIGIN=http://localhost:8094 php backend/tests/api-http.php`: real packaged HTTP routing, authentication and body limits.
- `testing/cloud-profile.test.js`: local persistence and the revision/dirty matrix, interrupted uploads, conflict resolution, account changes, live-game replacement guards, independent town revisions, deletion, local-only slots and storage failures.

CI runs the frontend, both database variants independently, dependency audit, Docker build and packaged HTTP checks. Obsolete engine-parity jobs have been removed with the engine they tested.

Browser verification uses the isolated local packaged application and local Mailpit; no production account or database is involved. Native protocol tests do not substitute for an iOS/Android device run.

## Local verification, 26 September 2026

Both PostgreSQL 17 and MySQL 8.4 passed the save API assertions and concurrent slot/revision tests. The packaged Apache/PHP HTTP checks passed. The full frontend run passed 1,821 of 1,822 tests; its sole failure was the unchanged 3D plot geometry test exceeding its 5-second timeout under concurrent workstation load. All 21 geometry tests passed when rerun with a 15-second timeout. Subsequent focused regression runs cover the additional synchronization and transport fixes.

Chromium verification at `http://localhost:8194` used desktop 1440×1000 and mobile 390×844 viewports. Email sign-in, attaching a device town, creating/switching three account towns, public sharing and read-only visits passed. Building the free well while offline saved immediately and synchronized on reconnect. A simulated second-device revision produced a comparison; choosing cloud restored its progress and retained the losing local branch for download. Normal account and sharing flows had no console errors; the offline exercise produced expected failed network requests. Chromium reported autoplay and software WebGL performance warnings.

A fresh browser also recovered an existing town after email sign-in. With all three account slots occupied, its separate device town remained intact and the attach action was disabled. An untouched browser fetched a newer cloud revision on reload, and signing out followed by reloading made zero API requests.
