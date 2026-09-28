# Verified o2switch controller

The following files are copied unchanged from [Starbugstone/test-auto-deploy](https://github.com/Starbugstone/test-auto-deploy/tree/a5270a76b4acfdf5c89f5c63321468f8bec5229d), commit `a5270a76b4acfdf5c89f5c63321468f8bec5229d`:

- `deploy.php`, `run.sh`, `install.sh`, `configure.php`
- `config.example.json`, `app.env.example`
- `../../tests/o2switch/deploy-test.php`, `../../tests/o2switch/health-test.php`

Prospect Hollow uses the template's supported `custom` profile because its frontend is at repository root and its migrations use `backend/bin/migrate.php`, rather than Doctrine Migrations commands. The application readiness endpoint follows the template's `symfony` health protocol.

Project-specific files are the shared `install-prospect.sh`, the `install-preprod.sh` and `install-production.sh` entry points, their target configuration/environment examples, and `build-prospect.sh`/`prepare-prospect.sh`. Use the [preprod setup guide](../../docs/backend/preprod.md) and [production setup guide](../../docs/backend/production.md). Both targets reuse the same controller and application hooks, with independent roots, checkouts and cron jobs. The installer rejects a mismatched existing target before replacing controls. The upstream generic interactive helper supports only its built-in profiles; it is retained unchanged, but is not the setup entry point for this project's custom hooks.

Controller and hook updates must be reviewed and installed explicitly into the private control directory. Normal application deployment does not replace them. No SSH workflow, GitHub upload or additional runner is used. `report_github` stays false: the upstream optional reporter labels deployments as production, so both targets leave it disabled and use local status/logs for deployment verification.
