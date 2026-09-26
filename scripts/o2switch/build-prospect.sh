#!/usr/bin/env bash
# Installed private hook for the verified HostingDeployer custom profile.
set +x
set -euo pipefail
umask 027
source_checkout=${1:?Source checkout required}
release_dir=${2:?New release directory required}
php_bin=${3:?PHP binary required}
composer_bin=${4:?Composer executable required}
[[ -d "$source_checkout/backend" && ! -e "$release_dir" ]]
cd "$source_checkout"
"$php_bin" "$composer_bin" install --working-dir=backend --no-dev --prefer-dist --no-interaction --no-scripts --optimize-autoloader
npm ci --include=dev --cache "$source_checkout/npm-cache"
node scripts/export-public-content.mjs
npm run build
cp -R dist/. backend/public/
# Source archives contain no production configuration. Secrets are linked in prepare.
rm -rf backend/var/cache backend/var/log
mkdir -p backend/var/cache backend/var/log
mv backend "$release_dir"
