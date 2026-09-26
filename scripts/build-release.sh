#!/usr/bin/env bash
set -euo pipefail
# Build on your workstation; the FTP host only needs PHP and the database.
if [[ -e release/app ]]; then
  printf '%s\n' 'release/app already exists. Move the previous bundle aside before building a fresh release.' >&2
  exit 1
fi
image_name="prospect-hollow:ftp"
docker build -t "$image_name" .
container_id=$(docker create "$image_name")
trap 'docker rm "$container_id" >/dev/null' EXIT
mkdir -p release/app
docker cp "$container_id:/var/www/app/." release/app/
# Never ship a local configuration or a compiled container with workstation paths.
rm -rf release/app/var/cache release/app/var/log
mkdir -p release/app/var/cache release/app/var/log
cp backend/.env.example release/app/.env.example
printf '%s\n' 'FTP bundle: release/app. Configure document root as app/public; keep all other folders private.'
