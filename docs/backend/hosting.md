# Account backend: local testing and FTP hosting

The backend is synchronized with `main` at `bbb2e34` (PR #45). The shared catalog now contains eight eras, 54 buildings and 324 levels. Docker exports the current browser rules into the server catalog at build time; PHP parity tests cover the same content.

## Run locally

Requirements: Docker Engine/Desktop with Compose. No host PHP or database installation is needed.

```sh
cp .env.example .env
# Replace APP_SECRET and DB_PASSWORD with different values from: openssl rand -hex 32
# The local APP_ORIGIN must exactly match the URL you open.
docker compose up -d --build
docker compose exec app php bin/migrate.php
```

Open **http://localhost:8094**. Local email appears at **http://localhost:8095**. Use the email link in the same browser to link a guest village. To recover it in a second browser, request a new link using “Sign in to an existing village”. Email links require explicit confirmation and expire after 15 minutes.

The database has a persistent named volume and no published port. `docker compose down` preserves it. Do not use `down -v` unless you intend to erase local test data. Containers are local development tools; the FTP host does not run them.

`GET /api/v1/health` checks database connectivity. `docker compose exec app php bin/health.php` checks it inside the container without relying on proxy headers. The app requires the schema migration before it can create accounts.

For frontend work, `VITE_CLOUD=true npm run dev` requires `/api` to be routed to the PHP application. The packaged Compose app is the supported end-to-end local environment. `npm run dev` without this flag runs the existing standalone demo. In a packaged build, `?mode=demo` explicitly opens that separate local mode.

## Build the FTP bundle

```sh
./scripts/build-release.sh
```

This creates `release/app/` containing the compiled frontend, Symfony application, locked Composer dependencies and generated game content. Move any previous `release/app` aside first; the script refuses to overlay an existing bundle. No Node, Composer, shell access or Docker is required on the hosting account to serve it.

The host needs **PHP 8.3 or newer**, `pdo_mysql` (or `pdo_pgsql` for PostgreSQL), PDO, XML, ctype, iconv, OpenSSL and the extensions required by the locked Composer dependencies, **MySQL 8 / MariaDB with InnoDB** or PostgreSQL, HTTPS, an SMTP account, and Apache `mod_rewrite` and `mod_headers`. The bundle checks PHP and declared extension requirements on startup; `/api/v1/health` additionally verifies the configured PDO driver and database connection. The local image uses PHP 8.4 and PostgreSQL 17. Prefer a maintained PHP patch version available in the hosting panel.

1. Create a dedicated database and database user in the hosting panel. Use only that database's privileges. Import **backend/schema.sql** through phpMyAdmin for a new MySQL/MariaDB database. For PostgreSQL use `backend/schema-postgresql.sql`. These initial schemas include version 3; do not replay them on existing data. Use the upgrade instructions below for existing databases.
2. Upload `release/app/` outside the public web directory. Set the site's document root to **app/public** through the hosting panel. Only that directory may be served. Do not upload the whole backend into `public_html` and hope dotfiles stay hidden.
3. Copy `.env.example` to **app/.env.local**, outside `public/`. Set a new random `APP_SECRET`, the exact HTTPS `APP_ORIGIN` (no trailing slash), the database URL, authenticated SMTP DSN, and verified `MAIL_FROM`. Require transport encryption: use `smtp://USER:PASSWORD@smtp.example.com:587?require_tls=true` for mandatory STARTTLS, or `smtps://USER:PASSWORD@smtp.example.com:465` for implicit TLS. Keep certificate verification enabled. The local Mailpit service is only for development. Percent-encode reserved characters in URL credentials. Keep this file out of Git and restrict file permissions.
4. Give PHP write access only to `app/var/`. Application code and `vendor/` should not be writable by web requests. Ensure `public/.htaccess` was uploaded; FTP clients often hide dotfiles. Use SFTP or FTPS if the provider offers it.
5. Configure HTTPS and the correct PHP version. In the hosting panel set `display_errors=Off`, `log_errors=On`, `post_max_size=64K`, and `upload_max_filesize=64K`; restrict access to PHP error logs. Configure the web server or provider edge to reject API request bodies over **65,536 bytes**. Docker’s `deploy/php.ini` and Apache virtual-host settings are not automatically applied by an FTP upload. Verify the hosted HTML/API responses include their configured security headers (`Content-Security-Policy`, `X-Content-Type-Options`, and `Referrer-Policy`); `index.html` must have `Cache-Control: no-store`. Test `/api/v1/health`, create a test guest, link email, make a village action, and recover the same village in a second browser before changing any production domain.
6. Keep the previous release and a database backup for rollback. Upload new versioned release directories and switch the document root after checking them, instead of partially overwriting live code during a request.

If the hosting account cannot set a document root or keep PHP code/secrets outside it, this bundle is not ready for that account until its directory layout is configured safely. FTP alone does not establish whether PHP, database, SMTP and HTTPS are available; these hosting capabilities have not been verified here.

`APP_ORIGIN` is a strict host/scheme/port allowlist. Do not weaken it to fix a proxy mismatch. Optional `TRUSTED_PROXIES` accepts only known proxy IPs/CIDRs and only forwarding of scheme/port. Ask the host for its exact proxy setup if PHP does not see HTTPS. Forwarded client IP/Host headers are not trusted. Enable edge request/body/rate limits through the provider; application limits are not DDoS protection.

## Upgrading an existing database

Schema version 3 updates stored public leaderboard ranks for the inserted Aviation and Broadcast eras, preserving existing Contemporary villages. It changes no private saves or visibility settings. Schema version 2 adds the opt-in leaderboard without rewriting private saves or publishing existing villages. Back up the database, then run `php bin/migrate.php` from the application directory before enabling the new application version. The CLI skips installed versions and can be run again safely.

For hosting with SQL import only, check `SELECT version FROM schema_versions ORDER BY version`. If version 1 exists and version 2 is absent, import **backend/migrations/002-community.sql** for MySQL/MariaDB or **backend/migrations/002-community-postgresql.sql** for PostgreSQL exactly once. Then, if version 3 is absent, import **backend/migrations/003-era-ranks.sql** or **backend/migrations/003-era-ranks-postgresql.sql** for the selected database. Verify versions 2 and 3 exist afterward. Do not import the initial schema over an existing database. New accounts and upgraded accounts remain private until their owners opt in.

Both supported databases use an indexed public ranking projection. The [local API benchmark](database-benchmark.md) found higher MySQL throughput in most read and town-action tests, but much lower PostgreSQL database memory use and steadier mining results at low and high concurrency. Keep PostgreSQL as the current default pending a representative benchmark on the intended hosting tier; this shared-host test does not establish a universal performance winner.

## Backups and recovery

For local PostgreSQL: `./scripts/backup-database.sh` writes a private custom-format dump to `backups/`. Put scheduled backups outside the webroot, encrypt off-host copies, and restrict access: they contain email addresses and village progress. On FTP hosting use the provider's database backup/scheduler, not a publicly callable backup PHP endpoint.

Proposed production policy: hourly database backups retained for 48 hours, daily backups for 30 days, monthly backups for 6 months; target at most one hour of lost confirmed progress and recovery within four hours. These are proposed operational targets, not an implemented host schedule or guarantee. Confirm provider support and storage before release.

Restore into a **different database** first. For local PostgreSQL:

```sh
docker compose exec db createdb -U cascade cascade_restore
cat backups/village-TIMESTAMP-SUFFIX.dump | docker compose exec -T db pg_restore -U cascade -d cascade_restore --no-owner
# Verify schema_versions, account counts, revisions, ledger totals, and known test villages.
```

Run a separate application instance pointed at the restored database and repeat linked-account recovery and village actions. Never test a restore over the live database. MySQL restoration uses the hosting panel's SQL import into another database. Provider-level backup scheduling and an actual hosted restore remain release tasks.

Run `php bin/cleanup.php` daily from the hosting scheduler to remove expired login intents, sessions and rate-limit buckets. Do not prune durable action receipts while an old request could still be retried. Accounts can be deleted from the authenticated account panel; live linked records cascade-delete. Backup copies expire under the retention policy.

## Deployment automation

The Azure Static Web Apps workflow is removed. `vercel.json` disables Vercel Git deployments, including previews. Quality CI builds/tests only; there is no deployment job and no hosting credentials are required in GitHub. Check PR statuses after pushing to verify no external deployment integration has a separate trigger. See [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration).
