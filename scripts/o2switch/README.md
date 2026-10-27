# Verified o2switch controller

The following files are imported from [Starbugstone/test-auto-deploy](https://github.com/Starbugstone/test-auto-deploy/tree/9e94f204b7fcaa68313c09590bd01f1dac22b74c), commit `9e94f204b7fcaa68313c09590bd01f1dac22b74c`. PHP files use this project's Prettier formatting; the controller behavior and tests match the template:

- `deploy.php`, `run.sh`, `install.sh`, `configure.php`
- `config.example.json`, `app.env.example`
- `../../tests/o2switch/deploy-test.php`, `../../tests/o2switch/health-test.php`

This version waits for cached responses from the exact previous release even when
they return HTTP 503 after migrations. The configured grace remains bounded;
activation still requires the expected release ID and a successful health response.
Unhealthy new releases and unidentified or unrelated releases keep the short
failure window. The regression tests cover recovery after 125 simulated seconds,
timeout, first deployment, disabled and custom grace, and rollback source identity.

Prospect Hollow uses the template's supported `custom` profile because its frontend is at repository root and its migrations use `backend/bin/migrate.php`, rather than Doctrine Migrations commands. The application readiness endpoint follows the template's `symfony` health protocol.

Project-specific files are the shared `install-prospect.sh`, the `install-preprod.sh` and `install-production.sh` entry points, their target configuration/environment examples, and `build-prospect.sh`/`prepare-prospect.sh`. Use the [preprod setup guide](../../docs/backend/preprod.md) and [production setup guide](../../docs/backend/production.md). Both targets reuse the same controller and application hooks, with independent roots, checkouts and cron jobs. The installer rejects a mismatched existing target before replacing controls. The upstream generic interactive helper supports only its built-in profiles; it is retained unchanged, but is not the setup entry point for this project's custom hooks.

Controller and hook updates must be reviewed and installed explicitly into the private control directory. Normal application deployment does not replace them. No SSH workflow, GitHub upload or additional runner is used. `report_github` stays false: the upstream optional reporter labels deployments as production, so both targets leave it disabled and use local status/logs for deployment verification.
