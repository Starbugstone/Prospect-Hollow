#!/usr/bin/env bash
set -euo pipefail
umask 027
root=${1:?Usage: bash install.sh /home/USER/apps/launchpad}
[[ "$root" =~ ^/home/[a-zA-Z0-9_/-]+$ && "$root" != *..* && "$root" != */ ]]
source_dir=$(cd "$(dirname "$0")" && pwd)
# Apache must traverse newly created parents such as ~/apps. Do not grant
# directory listing or alter permissions on ancestors that already exist.
(
  umask 066
  mkdir -p "$root"
)
[[ "$(realpath "$root")" == "$root" ]]
for directory in control shared state logs builds releases; do
  [[ ! -L "$root/$directory" ]]
  mkdir -p "$root/$directory"
done
chmod 755 "$root" "$root/releases"
chmod 700 "$root/control" "$root/shared" "$root/state" "$root/logs" "$root/builds"
for script in deploy.php run.sh configure.php; do
  install -m 700 "$source_dir/$script" "$root/control/$script.next"
  mv "$root/control/$script.next" "$root/control/$script"
done
install -m 600 "$source_dir/app.env.example" "$root/control/app.env.example"
if [[ ! -e "$root/control/config.json" ]]; then
  install -m 600 "$source_dir/config.example.json" "$root/control/config.json"
fi
if [[ ! -e "$root/shared/.env.local" ]]; then
  install -m 600 "$source_dir/app.env.example" "$root/shared/.env.local"
fi
if [[ ! -e "$root/current" && ! -L "$root/current" ]]; then
  bootstrap=0000000000000000000000000000000000000000-00000000000000-00000000
  mkdir -p "$root/releases/$bootstrap/public"
  printf '<!doctype html><title>Awaiting deployment</title><h1>Awaiting first deployment</h1>\n' > "$root/releases/$bootstrap/public/index.html"
  chmod 755 "$root/releases/$bootstrap" "$root/releases/$bootstrap/public"
  chmod 644 "$root/releases/$bootstrap/public/index.html"
  ln -s "$root/releases/$bootstrap" "$root/current"
fi
printf 'Installed in %s/control. Configure config.json, shared/.env.local and shared/github-token next.\n' "$root"
printf 'Fresh installations have automatic deployment disabled. Reinstallation preserves configuration and state.\n'
