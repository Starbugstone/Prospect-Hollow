# Preprod automatic deployment

A successful **push** run of `.github/workflows/quality.yml` for the current `preprod` SHA makes that exact commit eligible for the o2switch poller. Pull-request runs, `main` runs, failed runs and stale commits cannot authorize deployment.

| Target     | URL                                               | Deployment configuration                                                     |
| ---------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| Preprod    | `https://preprod.prospecthollow.starbugstone.com` | `preprod` → successful `quality.yml` push run → preprod host poller          |
| Production | `https://prospecthollow.starbugstone.com`         | `main` → successful `quality.yml` push run → separate production host poller |

The [production setup guide](production.md) configures the second target. Each site requires its own installation and cron entry; merging this code alone does not activate production.

This uses the [verified test-auto-deploy template](https://github.com/Starbugstone/test-auto-deploy/tree/a5270a76b4acfdf5c89f5c63321468f8bec5229d). Its controller is copied unchanged, with application-specific build/preparation hooks. The host fetches/builds the exact checked commit, verifies PHP/database readiness and its release identity, activates it through `current`, and retains three successful versions. Failed readiness restores the previous code; database migrations are not reversed by code rollback.

## One-time hosting setup

These repository instructions do not verify or change the installed host configuration. Use a **separate** preprod database, domain and deployment root. The example checkout is `/home/CPANEL_USER/repositories/prospect-hollow`; the deployment root is `/home/CPANEL_USER/apps/prospect-hollow-preprod`. Replace the account and tool paths below with the actual hosting values.

1. Connect/clone this GitHub repository on hosting and check out `preprod`. For private Git access, install a dedicated read-only deploy key and verify GitHub's host fingerprint. The hosting API token needs Actions read access to this repository, even for a public checkout. Do not copy the template demo's credentials or deployment directory.
2. Select PHP 8.3+ with PDO/MySQL or PostgreSQL, intl and the locked Composer requirements; a Composer PHP executable/PHAR; and Node/npm 24. Node is used for builds only. Create the preprod database/user, SMTP account and domain. The new schema must not be imported over the old prototype database.
3. Install the reviewed control code:

   ```bash
   project_checkout=/home/CPANEL_USER/repositories/prospect-hollow
   project_root=/home/CPANEL_USER/apps/prospect-hollow-preprod
   project_php=/ABSOLUTE/PATH/TO/php
   bash "$project_checkout/scripts/o2switch/install-preprod.sh" "$project_root" "$project_php"
   ```

   The installer creates the private controller, custom hooks, preprod configuration and application environment example. Polling starts disabled. Reinstallation preserves existing configuration, secrets and enable state; pause polling before installing later controller updates. It refuses an existing configuration for another target before replacing control code.

4. Complete `control/config.json`: verify `repository_path`, the Composer PHP executable, Node binary directory and optional SSH key path. Repository, branch, workflow and URL are already set to this project, `preprod`, `quality.yml` and the preprod domain. Keep `profile=custom`, `health_mode=symfony`, the two installed hook paths and `report_github=false`.
5. Privately edit `shared/.env.local`: generate `APP_SECRET`, enter the preprod database connection and encrypted SMTP credentials, and verify `MAIL_FROM`. `APP_ORIGIN` is already the preprod HTTPS URL. Put the API token into `shared/github-token`. Keep these files mode `600`; never put secrets into GitHub workflow arguments or frontend `VITE_*` settings. This project's custom profile uses the provided environment example and private editing, not the upstream generic setup wizard.
6. Set the preprod domain's document root to **`PROJECT_ROOT/current/public`**, issue its TLS certificate and enable HTTPS. Keep all other deployment directories outside the public root. Apply the PHP/body/proxy settings in [hosting](hosting.md).
7. Wait for `preprod` push CI to succeed, then verify one release:

   ```bash
   "$project_php" "$project_root/control/deploy.php" "$project_root/control/config.json" check
   bash "$project_root/control/run.sh" "$project_php" deploy
   "$project_php" "$project_root/control/deploy.php" "$project_root/control/config.json" status
   ```

   Verify the website and email/account/save flow. `GET /api/health?check=...` must return `{"status":"ok"}` with `X-Release-Id` matching `current`. It checks schema/database readiness; database failures return a generic 503. The existing `/api/v1/health` remains available. Signed-out game clients call neither endpoint automatically.

8. Enable normal automatic deployment once the first release is verified:

   ```bash
   "$project_php" "$project_root/control/deploy.php" "$project_root/control/config.json" enable
   printf '/bin/bash %s/control/run.sh %s poll\n' "$project_root" "$project_php"
   ```

   Add the printed **expanded absolute command** as one cPanel cron entry, every minute. Future merges into `preprod` then deploy after their push CI succeeds. Verify the first automatic update through `status`, the private cron log and the live release header.

## Build and verification

`build-prospect.sh` installs locked PHP/npm dependencies, exports only the public appearance allowlist, builds Vite and assembles the PHP/public release. `prepare-prospect.sh` verifies private environment permissions, links configuration, runs the schema migration, checks database connectivity and warms the production cache. They never switch `current`; the verified controller owns activation, locks, retries and retention.

CI tests controller rollback/retention/CI eligibility, readiness identity and outage behavior, installer preservation, plus a real build/preparation of these hooks against PostgreSQL. Both database jobs check the release-health protocol. The packaged application check verifies actual `/api/health` routing.

For maintenance, disable polling, wait for running work, back up the database and follow the [template maintenance guide](https://github.com/Starbugstone/test-auto-deploy/blob/a5270a76b4acfdf5c89f5c63321468f8bec5229d/docs/o2switch-setup.md#8-maintenance-retry-and-rollback). Retained code releases do not replace database backups. Production uses the [separate main-branch installation](production.md), including a separate Git checkout so concurrent fetches cannot share `FETCH_HEAD`.

## Placeholder shared towns in the preprod database

The preprod database intentionally keeps ten placeholder shared towns from Town Honours testing
(issue #60): accounts with the `fixtures.prospect-hollow.invalid` e-mail domain, and visit rows
whose IDs start with `fx`, some of them on real towns. They exist only in the preprod database;
the seeding code was removed so it can never ship to production. To delete them, restore the
seeder from commit `a481343` on a temporary preprod branch
(`git checkout a481343 -- backend/bin/preprod-fixtures.php backend/src/PreprodFixtures.php backend/content/preprod-fixtures.json`),
deploy it, run `php bin/preprod-fixtures.php remove` from the preprod release, then remove those
files again before anything reaches `main`.
