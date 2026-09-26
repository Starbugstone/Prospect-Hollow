# Replacement backend validation

The September 2026 replacement removes the PHP gameplay engine and tests the account-save contract directly. Historical review screenshots and benchmarks describe the retired prototype.

- `npm run verify`: formatting, frontend regression suite (including unlimited puzzle moves) and production build.
- `node scripts/export-public-content.mjs`: generates only the era/building appearance allowlist from the shared frontend definitions.
- `TEST_DATABASE_URL=... php backend/tests/saves.php`: account authentication, ownership, three slots, per-account names, snapshot validation, revisions, conflicts, idempotent retries, five-save history, moderation, safe public projection, deletion, native transport and revocation.
- `TEST_DATABASE_URL=... php backend/tests/concurrency.php`: real concurrent connections race for the final account slot and for the same town revision. Both PostgreSQL and MySQL are required.
- `TEST_HTTP_ORIGIN=http://localhost:8094 php backend/tests/api-http.php`: real packaged HTTP routing, authentication and body limits.
- `testing/cloud-profile.test.js`: local persistence and the revision/dirty matrix, interrupted uploads, conflict resolution, account changes, live-game replacement guards, independent town revisions, deletion, local-only slots and storage failures.
- Desync recovery regressions cover automatic server preference with a complete local recovery copy, local continuation from the current server revision, full village/bonus/balance replacement, renewed confirmation after a concurrent server change, deferred application during a mine, offline reconnect, lost overwrite acknowledgments, storage failures and recovery after reload.

CI runs the frontend, both database variants independently, dependency audit, Docker build and packaged HTTP checks. Obsolete engine-parity jobs have been removed with the engine they tested.

Browser verification uses the isolated local packaged application and local Mailpit; no production account or database is involved. Native protocol tests do not substitute for an iOS/Android device run.

## Local verification, 26 September 2026

Both PostgreSQL 17 and MySQL 8.4 passed the save API assertions and concurrent slot/revision tests. The packaged Apache/PHP HTTP checks passed. The full frontend run passed 1,821 of 1,822 tests; its sole failure was the unchanged 3D plot geometry test exceeding its 5-second timeout under concurrent workstation load. All 21 geometry tests passed when rerun with a 15-second timeout. Subsequent focused regression runs cover the additional synchronization and transport fixes.

Chromium verification at `http://localhost:8194` used desktop 1440×1000 and mobile 390×844 viewports. Email sign-in, attaching a device town, creating/switching three account towns, public sharing and read-only visits passed. Building the free well while offline saved immediately and synchronized on reconnect. A simulated second-device revision produced a comparison; choosing cloud restored its progress and retained the losing local branch for download. Normal account and sharing flows had no console errors; the offline exercise produced expected failed network requests. Chromium reported autoplay and software WebGL performance warnings.

A fresh browser also recovered an existing town after email sign-in. With all three account slots occupied, its separate device town remained intact and the attach action was disabled. An untouched browser fetched a newer cloud revision on reload, and signing out followed by reloading made zero API requests.

## Browser sync audit, 26 September 2026

The per-town tab implementation is described in [browser saving](browser-saving.md). Local validation passed 1,841 tests across 96 frontend files; subsequent focused checks also cover the final reattachment and replaced-upload guards. Formatting and the production build passed. PostgreSQL 17 and MySQL 8.4 each passed 97 save API assertions plus the concurrent capacity, same-town revision and different-town save checks, using isolated temporary databases.

Real Chromium checks against the local production build at `http://127.0.0.1:8187` used mocked account HTTP responses and real browser storage/Web Locks. Two account towns retained distinct progress and UUID-scoped requests in separate tabs. A duplicate town tab mounted no canvas; closing its owner and reopening recovered the saved town. Idle tabs made no additional requests during the observation window. Account selection survived reload. A separate flow checked guest play without API traffic, email-link confirmation in a second tab, local attachment, account town creation, and sign-out stopping background requests. The mine rendered at 390×844 and retained the same canvas through explicit synchronization. Desktop 3D rendering was checked at 1440×1000; the mobile mine used the Canvas fallback. Both flows reported no page errors. These checks do not replace the final smoke test on o2switch after deployment.

## Account/local-copy startup regression, 26 September 2026

The deployed account-town tab and a bare-homepage tab could display different saves with the same UUID: the homepage opened the retained guest copy. The picker also compared UUID alone, incorrectly calling that guest copy the current account town. Identity checks now include the owner, new tabs prefer a cached account town, and local play has a distinct label without a Sync button.

Real Chromium at `http://127.0.0.1:8188`, in French at 1440×1000 and 390×844, reproduced the retained guest/account UUID pair. With account HTTP deliberately delayed, the first town remained playable and the second tab showed its duplicate notice in 346 ms. Refreshing the duplicate preserved the notice, with no canvas or town-renderer downloads. Closing the owner then opening the town in the waiting tab recovered its updated balance. Opening the account copy from a pinned guest tab restored account progress and preserved the guest record; an explicit account URL also overrode that guest selection. The picker no longer marked the guest copy as the current account town, and it had no Sync action. These normal flows produced no page errors. Delaying and then failing the village JavaScript chunk produced visible loading and reload states, with the expected failed network request.

## Explicit tab/window transfer

Chromium at `http://127.0.0.1:8189` exercised real Web Locks, BroadcastChannel and browser storage with mocked HTTP. The French UI was checked at 1440×1000 and 390×844. Clicking **Open my town here** while the original window remained open moved an active puzzle with an identical board, tile damage, score, run ID and 105 moves. The recipient made another match and transferred back with 106 moves; no run was restarted. The old window mounted no canvas and rejected a direct save attempt. A separate town retained its independent balance throughout.

A held upload response kept the recipient from taking ownership or sending town requests until the original queue drained. Simulated storage quota failure produced a visible refusal, leaving the original puzzle active; retrying after restoring storage transferred it successfully. A signed-out local-town transfer preserved its balance and made zero API calls. Normal flows reported no page errors. This run used the game's Canvas/SVG fallback to keep the multi-window checks independent of GPU availability. Unit tests separately cover expired/cancelled transfers, nonresponsive owners, competing requesters, owner/UUID isolation, continuous-mode credits and reward deduplication.

## Server-default desync recovery, 27 September 2026

At `http://127.0.0.1:8190`, two independent Chromium storage contexts represented a computer (1440×1000) and phone (390×844), in French, with mocked account HTTP and the Canvas/SVG fallback. Offline progress uploaded automatically when its base revision still matched. After both devices progressed independently, the phone loaded the server village and preserved its complete local version through reload. A server update while the confirmation was open refused the stale overwrite and required a fresh review; a subsequent explicit overwrite replaced the whole village, without combining buildings or balances. The computer then adopted that new revision. A desync during an active mine kept its board and run intact and applied the latest cloud village only after returning; the recovery copy included the intervening local progress. The normal/recovery flows had no page errors; the offline exercise intentionally aborted network requests.
