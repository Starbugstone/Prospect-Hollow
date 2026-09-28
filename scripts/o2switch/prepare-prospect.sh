#!/usr/bin/env bash
# Runs after the controller rechecks the exact branch SHA and successful push CI.
set +x
set -euo pipefail
umask 027
release_dir=${1:?Release directory required}
shared_dir=${2:?Shared directory required}
php_bin=${3:?PHP binary required}
[[ -d "$release_dir" && -f "$shared_dir/.env.local" && ! -L "$shared_dir/.env.local" ]]
# Do not source secrets in a shell or print their contents.
# shellcheck disable=SC2016 # The quoted program is PHP, not shell.
"$php_bin" -r 'if ((fileperms($argv[1]) & 0077) !== 0) { fwrite(STDERR, "Application configuration must have mode 600.\n"); exit(1); }' "$shared_dir/.env.local"
ln -s "$shared_dir/.env.local" "$release_dir/.env.local"
cd "$release_dir"
"$php_bin" bin/migrate.php
"$php_bin" bin/health.php
"$php_bin" bin/warm-cache.php
