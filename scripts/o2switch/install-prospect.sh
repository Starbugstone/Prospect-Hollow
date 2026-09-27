#!/usr/bin/env bash
# Install reviewed control code. Never enables polling or deploys an application.
set +x
set -euo pipefail
umask 027
target=${1:?Usage: install-prospect.sh preprod|production /home/USER/apps/SITE /absolute/php}
case "$target" in
  preprod|production) ;;
  *) printf 'Unknown deployment target: %s\n' "$target" >&2; exit 1 ;;
esac
project_root=${2:?Absolute deployment root required}
php_bin=${3:?Absolute hosting PHP binary required}
[[ "$php_bin" == /* && -x "$php_bin" ]]
source_dir=$(cd "$(dirname "$0")" && pwd)
# Validate before replacing control code; a reinstall must never repurpose a site.
# shellcheck disable=SC2016 # The quoted program is PHP, not shell.
"$php_bin" -r '
  $expected = json_decode(file_get_contents($argv[1]), true, 32, JSON_THROW_ON_ERROR);
  $root = $argv[2];
  $path = "$root/control/config.json";
  if (is_link($path)) throw new RuntimeException("Refusing symlinked deployment configuration.");
  if (!file_exists($path)) exit(0);
  $actual = json_decode(file_get_contents($path), true, 32, JSON_THROW_ON_ERROR);
  foreach (["root" => $root, "github_repository" => $expected["github_repository"], "branch" => $expected["branch"], "workflow" => $expected["workflow"], "url" => $expected["url"]] as $key => $value) {
    if (($actual[$key] ?? null) !== $value) throw new RuntimeException("Existing $key does not match this target; use a separate deployment root.");
  }
' "$source_dir/$target.config.example.json" "$project_root"
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
    $config["repository_path"] = str_replace("/home/CPANEL_USER/", "/home/".explode("/", $root)[2]."/", $config["repository_path"]);
    $config["php_bin"] = $argv[3];
    $config["token_file"] = "$root/shared/github-token";
    $config["custom_build_script"] = "$root/control/build-prospect.sh";
    $config["custom_prepare_script"] = "$root/control/prepare-prospect.sh";
    file_put_contents("$root/control/config.json", json_encode($config, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)."\n");
  ' "$source_dir/$target.config.example.json" "$project_root" "$php_bin"
  chmod 600 "$project_root/control/config.json"
fi
if "$fresh_env"; then
  install -m 600 "$source_dir/$target.env.example" "$project_root/shared/.env.local"
fi
printf '%s control code installed. Finish private config, database, SMTP and GitHub token setup before check/deploy/enable.\n' "$target"
