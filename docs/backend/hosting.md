# Account saves: local testing and hosting

The frontend runs all gameplay locally. Signed-out play makes no API calls and has one device town. Signing in enables up to three account towns, revision-based backup, history and opt-in sharing. There is no server puzzle engine, action ledger, guest account or competitive campaign leaderboard.

## Local installation

```sh
cp .env.example .env
# Set independent random APP_SECRET and DB_PASSWORD values.
docker compose up -d --build
docker compose exec app php bin/migrate.php
```

Open http://localhost:8094; development email arrives at http://localhost:8095. Choose **Protect my progress**, request a link, then explicitly confirm it. Links expire after 15 minutes. Add the device town to an available account slot or open an existing town. A full account leaves the device town playable and exportable.

This replacement starts at schema version **10** on a fresh database; `backend/bin/migrate.php` applies each later version in order, and `/api/health` reports ready only once the latest one is in place. Earlier backend versions were undeployed prototypes. The migration deliberately refuses to overwrite their tables. Point this version at a new database/Compose volume; remove an old development database only if you intend to discard it. Existing browser saves and JSON backups remain supported.

`npm run dev` always runs the local-first game. For account features, route `/api/v1` to PHP or use the packaged Compose application. The former `VITE_CLOUD` flag and demo query mode are gone.

## FTP release

Run `./scripts/build-release.sh` on a machine with Docker. It creates `release/app` with the frontend, PHP application, dependencies and the generated public appearance allowlist. It refuses to overwrite an existing bundle.

The host needs PHP 8.3+, PDO with `pdo_mysql` or `pdo_pgsql`, **intl**, ctype, iconv and the extensions required by Composer; MySQL 8+/InnoDB or PostgreSQL; HTTPS; SMTP; Apache rewrite and headers modules. Only `app/public` may be web-accessible. Put code, credentials and `var` outside the web root. Give PHP write access to `var` only.

Import `backend/schema.sql` (MySQL) or `backend/schema-postgresql.sql` into a **new** database, or run `php bin/migrate.php`. Configure `app/.env.local` using `backend/.env.example`: exact HTTPS `APP_ORIGIN`, random `APP_SECRET`, database connection, encrypted SMTP and verified sender. Require SMTP TLS and retain certificate verification. Configure PHP `post_max_size=16M`, `upload_max_filesize=2M` and the web-server request limit **9 MiB**. The API limits town uploads to **8 MiB plus 64 KiB** for the request wrapper, while other requests retain the **1,100,000-byte** limit. The gameplay snapshot excluding queued integrity actions, and the stored snapshot after acknowledgment, remain limited to **1 MiB**. Keep error display disabled.

`APP_ORIGIN` checks scheme, host and port. Configure `TRUSTED_PROXIES` only for known proxies when TLS terminates upstream. Do not weaken the origin check. Verify `/api/v1/health`, email sign-in, attachment, offline play/reconnect and account recovery on the host before release. No deployment has been performed by this change.

The server-time money estimate defaults to `SAVE_MONEY_GUARD_MODE=observe`: unusually large batches are marked for review without stopping cloud saves. The server-only `hold` mode refuses batches above the carried allowance while preserving local progress and the last cloud save. This is a generous heuristic, not proof of cheating; see [save integrity](save-integrity.md#server-time-money-estimate) before enabling enforcement. Budget checks use server milliseconds and run only during existing synchronization.

## Capacitor

Capacitor continues to package `dist`; it does not load a hosted game page. Build with `VITE_API_BASE=https://your-host/api/v1` and `VITE_PUBLIC_ORIGIN=https://your-host`, then run `npm run cap:sync` on a machine with the desired native platform installed. Configure the API's `NATIVE_ORIGINS` with only the exact app origins required by those builds (`capacitor://localhost` on iOS, typically `https://localhost` on Android). Keep production API transport HTTPS.

The account screen accepts a pasted email link so native login does not depend on a web cookie or an unconfigured deep link. An allowed native origin receives a revocable bearer session plus CSRF token; the bearer is held in memory, never localStorage or an exported save. After a process restart, the player signs in again to resume sync; device progress remains playable. Persistent native sign-in would require a separately integrated Keychain/Keystore adapter. The API transport is tested; this repository has no checked-in iOS/Android platform project and native device packaging has not been validated.

## Recovery and operations

Normal saves are atomic local snapshots. Uploads carry a durable upload ID and base revision. A lost response retries the same snapshot. Divergence stops sync for that town and asks the player to compare device/cloud copies; there is no automatic field merge. The five previous cloud revisions remain recoverable. Choosing the cloud version also retains the losing device copy for download. Export/import works signed in or signed out; backups include the town UUID and no credentials.

Run `php bin/cleanup.php` daily to remove expired sessions (player and admin), links, rate buckets, active-day marks older than 90 days and town deletion tombstones older than 30 days. Town deletion immediately frees the account slot and removes its listing. Account deletion cascades through live account data. Provider backups expire according to the operator's policy.

Use `./scripts/backup-database.sh` for local PostgreSQL dumps. Protect backups as account data; restore into a separate database and verify account recovery and revisions before switching traffic. Hosting backup schedules, SMTP delivery and disaster recovery remain operator responsibilities. The previous benchmark measured the removed authoritative prototype and is historical evidence only.

Quality CI tests both databases, the packaged application and the hosting hooks. Independent o2switch pollers deploy the exact `preprod` commit to preprod and the exact `main` commit to production, each only after successful push CI for its configured branch. GitHub uploads no deployment artifact. This branch removes the Azure workflow and disables Vercel Git deployments; these files must reach `main` as part of the production migration.

## Admin panel

Schema version 13 adds the admin and player-activity tables; `php bin/migrate.php` (run by the release preparation) installs them. Create the first admin on each environment with `php bin/admin.php create USERNAME` from its `current` release, then finish at `https://HOST/admin`. See the [admin guide](admin.md) for recovery commands and what is recorded.

## Hosted environments

Follow the [preprod setup guide](preprod.md) for `preprod` at `https://preprod.prospecthollow.starbugstone.com` and the [production setup guide](production.md) for `main` at `https://prospecthollow.starbugstone.com`. Both use the same o2switch account with separate installations, Git checkouts, databases, secrets and cron entries. Repository setup alone does not activate production or migrate its domain from Vercel.
