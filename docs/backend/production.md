# Production automatic deployment

Production uses `https://prospecthollow.starbugstone.com` on the same o2switch account as preprod. It has its own deployment root, Git checkout, database, secrets and cron entry. The shared controller fetches only the configured branch and requires successful **push** CI for that branch's current exact commit:

| Target     | Branch    | Domain                                    | Deployment root                                     |
| ---------- | --------- | ----------------------------------------- | --------------------------------------------------- |
| Preprod    | `preprod` | `preprod.prospecthollow.starbugstone.com` | `/home/CPANEL_USER/apps/prospect-hollow-preprod`    |
| Production | `main`    | `prospecthollow.starbugstone.com`         | `/home/CPANEL_USER/apps/prospect-hollow-production` |

Both use `.github/workflows/quality.yml`. A successful `main` run cannot authorize preprod, and a successful `preprod` run cannot authorize production, even if both branches point to the same SHA. `develop`, pull-request runs, failed/in-progress runs and stale commits cannot authorize either target. GitHub runs validation; independent host cron jobs poll for eligible commits. There is no GitHub job that uploads or deploys to both sites.

## Install the production target

These changes prepare the repository only. They do not configure the host, enable polling, change DNS or disconnect existing hosting integrations.

1. Merge the reviewed deployment setup and application changes into `main` and wait for its full `quality.yml` **push** run to pass. The production installer must be available in that checkout. Merely pushing to `main` before host setup does not create a production deployment.
2. Follow the PHP, database, SMTP and HTTPS requirements in [hosting](hosting.md). Create a separate production database/user, independent `APP_SECRET` and production application credentials. Do not point production at the preprod database. For private Git access, use a read-only deploy key with GitHub's host fingerprint verified; the API token needs repository Actions read access.
3. Clone/connect a **separate** repository checkout at `/home/CPANEL_USER/repositories/prospect-hollow-production` and check out `main`. Do not share preprod's checkout: Git fetch updates `FETCH_HEAD`, and the two cron jobs have independent locks.
4. Install the reviewed controller and hooks, replacing the account and PHP paths:

   ```bash
   production_checkout=/home/CPANEL_USER/repositories/prospect-hollow-production
   production_root=/home/CPANEL_USER/apps/prospect-hollow-production
   project_php=/ABSOLUTE/PATH/TO/php
   bash "$production_checkout/scripts/o2switch/install-production.sh" "$production_root" "$project_php"
   ```

   A fresh installation has polling disabled. Reinstallation preserves configuration, secrets and enable state; pause polling before updating installed controls. The installer refuses an existing configuration with a different root, repository, branch, workflow or URL, including a preprod installation.

5. Complete `control/config.json`: verify the separate `repository_path`, PHP/Composer/Node paths and optional SSH key. Keep `branch=main`, `workflow=quality.yml`, `url=https://prospecthollow.starbugstone.com`, `profile=custom`, `health_mode=symfony`, the installed hook paths and `report_github=false`. Privately edit `shared/.env.local` with production credentials and `APP_ORIGIN=https://prospecthollow.starbugstone.com`; place the API token in `shared/github-token`. Keep secrets mode `600`.
6. Configure the production domain's document root as **`/home/CPANEL_USER/apps/prospect-hollow-production/current/public`**, with HTTPS and the server settings from the hosting guide. Preprod keeps its own `current/public`. Arrange the domain's move from Vercel to o2switch. The controller verifies the release through the configured public HTTPS URL, so activation requires that URL to reach this installation; while it still reaches Vercel, readiness cannot verify the new release. Plan this cutover and keep the previous hosting available until the new site is verified.
7. Run one verified manual deployment after `main` push CI succeeds:

   ```bash
   "$project_php" "$production_root/control/deploy.php" "$production_root/control/config.json" check
   bash "$production_root/control/run.sh" "$project_php" deploy
   "$project_php" "$production_root/control/deploy.php" "$production_root/control/config.json" status
   ```

   Check the homepage, email sign-in, account saves and recovery. `/api/health?check=...` must return `{"status":"ok"}` and an `X-Release-Id` matching the production `current` release. Inspect `logs/cron.log` if activation fails.

8. Enable polling and print the production cron command:

   ```bash
   "$project_php" "$production_root/control/deploy.php" "$production_root/control/config.json" enable
   printf '/bin/bash %s/control/run.sh %s poll\n' "$production_root" "$project_php"
   ```

   Add the printed expanded absolute command to cPanel **every minute**, alongside the separate preprod cron entry. Future pushes to `main` become eligible for production only after successful CI. Pushes to `preprod` continue to update preprod only. Verify the first automatic update through production status, its private log and its release header.

## Retire previous integrations

`vercel.json` on the preprod branch disables Vercel Git deployments. The inspected `main` commit `7080ac7` did not yet contain that file; merging this setup into `main` is necessary for it to apply there too. Repository configuration does not disconnect the Vercel project or change DNS. At cutover, verify/disconnect the old project's Git integration and move the domain in the hosting dashboards.

Cloudflare deployment is also being retired. GitHub reported a successful **Cloudflare Pages** check for that `main` commit, linked to the [`crystal-cascade` Pages project](https://dash.cloudflare.com/a8bb586d4fefc149479de44f9a0bf1c4/pages/view/crystal-cascade/settings). There is no Cloudflare workflow/configuration in this branch to remove. In [GitHub installed applications](https://github.com/settings/installations), configure **Cloudflare Workers and Pages** and remove `Starbugstone/Prospect-Hollow` from its repository access. Keep access to unrelated repositories unchanged. Per the [Cloudflare removal guide](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/), this stops new builds while existing deployments remain hosted. This external disconnection is still pending: no Cloudflare credentials or authenticated browser session were available during repository preparation.

The old Azure workflow was disabled in GitHub when inspected; this branch removes its workflow file. Verify the final integrations after merging, since external settings are not controlled by the o2switch installer.

## Maintenance and regression checks

Use the shared controller's `disable`, `status`, `retry` and `rollback RELEASE_ID` commands with the **production** config path. Rollback disables polling for that target. Its releases, locks, state and logs are independent of preprod. Database migrations are not reversed by code rollback; maintain independent database backups.

CI runs the existing controller/readiness tests, both target installers and `tests/o2switch/branch-routing-test.php`. The routing test checks both directions with identical SHAs, rejects unrelated branches and invalid CI, and verifies successful activation stays inside the selected target's releases. Installer tests cover isolated paths/checkouts, disabled initial polling, secret/configuration preservation and rejection before any control replacement when an installer is pointed at the other target.
