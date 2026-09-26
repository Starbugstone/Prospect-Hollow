#!/usr/bin/env bash
# Install reviewed control code. Never enables polling or deploys an application.
set +x
set -euo pipefail
umask 027
project_root=${1:?Usage: install-preprod.sh /home/USER/apps/prospect-hollow-preprod /absolute/php}
php_bin=${2:?Absolute hosting PHP binary required}
[[ "$php_bin" == /* && -x "$php_bin" ]]
source_dir=$(cd "$(dirname "$0")" && pwd)
fresh_config=false
fresh_env=false
[[ -e "$project_root/control/config.json" ]] || fresh_config=true
[[ -e "$project_root/shared/.env.local" ]] || fresh_env=true
bash "$source_dir/install.sh" "$project_root"
for hook in build-prospect.sh prepare-prospect.sh; do
  install -m 700 "$source_dir/$hook" "$project_root/control/$hook.next"
  mv "$project_root/control/$hook.next" "$project_root/control/$hook"
done
if "$fresh_config"; then
  # shellcheck disable=SC2016 # The quoted program is PHP, not shell.
  "$php_bin" -r '
    $config = json_decode(file_get_contents($argv[1]), true, 32, JSON_THROW_ON_ERROR);
    $root = $argv[2];
    $config["root"] = $root;
    $config["repository_path"] = "/home/".explode("/", $root)[2]."/repositories/prospect-hollow";
    $config["php_bin"] = $argv[3];
    $config["token_file"] = "$root/shared/github-token";
    $config["custom_build_script"] = "$root/control/build-prospect.sh";
    $config["custom_prepare_script"] = "$root/control/prepare-prospect.sh";
    file_put_contents("$root/control/config.json", json_encode($config, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)."\n");
  ' "$source_dir/preprod.config.example.json" "$project_root" "$php_bin"
  chmod 600 "$project_root/control/config.json"
fi
if "$fresh_env"; then
  install -m 600 "$source_dir/preprod.env.example" "$project_root/shared/.env.local"
fi
printf 'Preprod control code installed. Finish private config, database, SMTP and GitHub token setup before check/deploy/enable.\n'
