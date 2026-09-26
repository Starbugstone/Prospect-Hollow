#!/usr/bin/env bash
# Build a disposable source copy and prepare it against an isolated test database.
set +x
set -euo pipefail
: "${TEST_DATABASE_URL:?An isolated test database is required}"
test_root=$(mktemp -d)
trap 'rm -rf -- "$test_root"' EXIT
mkdir "$test_root/source" "$test_root/shared"
tar --exclude=.git --exclude=node_modules --exclude=dist --exclude=output --exclude=.playwright-cli --exclude=backend/vendor --exclude=backend/var --exclude=release --exclude=backups --exclude='.env*' -cf - . | tar -xf - -C "$test_root/source"
php_bin=$(command -v php)
composer_bin=$(command -v composer)
bash scripts/o2switch/build-prospect.sh "$test_root/source" "$test_root/release" "$php_bin" "$composer_bin"
# Disposable test credentials only; never source a real application's .env file.
printf 'APP_SECRET=hosting-test-only-not-production-secret-12345\nAPP_ORIGIN=http://localhost:8094\nDATABASE_URL="%s"\nMAILER_DSN=null://null\nMAIL_FROM=test@example.test\n' "$TEST_DATABASE_URL" > "$test_root/shared/.env.local"
chmod 600 "$test_root/shared/.env.local"
bash scripts/o2switch/prepare-prospect.sh "$test_root/release" "$test_root/shared" "$php_bin"
[[ -f "$test_root/release/public/index.html" && -f "$test_root/release/public/index.php" && -f "$test_root/release/public/.htaccess" && -f "$test_root/release/content/public-schema.json" && -L "$test_root/release/.env.local" ]]
[[ ! -e "$test_root/release/public/.env.local" && ! -e "$test_root/release/public/vendor" ]]
printf 'Prospect hosting hooks: locked build, public output, private configuration, migrations and cache warmup passed.\n'
