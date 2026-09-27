#!/usr/bin/env bash
set -euo pipefail
test_root=$(mktemp -d "$HOME/prospect-target-install-XXXXXX")
trap 'rm -rf -- "$test_root"' EXIT
php_bin=$(command -v php)
for target in preprod production; do
  project_root="$test_root/$target"
  bash "scripts/o2switch/install-$target.sh" "$project_root" "$php_bin" >/dev/null
  # shellcheck disable=SC2016 # The quoted program is PHP, not shell.
  php -r '
    require "scripts/o2switch/deploy.php";
    $root=$argv[1];
    $expected=HostingDeployer::readJson("scripts/o2switch/".$argv[2].".config.example.json");
    $config=HostingDeployer::readJson("$root/control/config.json");
    foreach (["branch", "url", "workflow", "github_repository", "profile", "health_mode"] as $key) {
      if ($config[$key] !== $expected[$key]) throw new RuntimeException("Wrong target: $key");
    }
    foreach (["root"=>$root,"token_file"=>"$root/shared/github-token","custom_build_script"=>"$root/control/build-prospect.sh","custom_prepare_script"=>"$root/control/prepare-prospect.sh"] as $key=>$value) {
      if ($config[$key] !== $value) throw new RuntimeException("Path escapes target: $key");
    }
    if (!str_contains(file_get_contents("$root/shared/.env.local"), "APP_ORIGIN=".$config["url"]."\n")) throw new RuntimeException("Wrong application origin");
    if (is_file("$root/state/enabled")) throw new RuntimeException("Installer enabled polling");
    foreach (["control/config.json", "shared/.env.local"] as $path) {
      if ((fileperms("$root/$path") & 0077) !== 0) throw new RuntimeException("Configuration permissions");
    }
  ' "$project_root" "$target"
  printf 'private-test-configuration\n' > "$project_root/shared/.env.local"
  touch "$project_root/state/enabled"
  cp "$project_root/control/config.json" "$test_root/config.before"
  bash "scripts/o2switch/install-$target.sh" "$project_root" "$php_bin" >/dev/null
  cmp "$test_root/config.before" "$project_root/control/config.json"
  [[ $(cat "$project_root/shared/.env.local") == private-test-configuration ]]
  [[ -f "$project_root/state/enabled" ]]
  # A wrong-target installer must reject the root before replacing any controls.
  printf 'control-code-must-be-preserved\n' > "$project_root/control/build-prospect.sh"
  other=production
  [[ "$target" != production ]] || other=preprod
  if bash "scripts/o2switch/install-$other.sh" "$project_root" "$php_bin" >"$test_root/rejection.log" 2>&1; then
    printf 'Wrong-target installer unexpectedly succeeded\n' >&2
    exit 1
  fi
  rg -q 'does not match this target' "$test_root/rejection.log"
  cmp "$test_root/config.before" "$project_root/control/config.json"
  [[ $(cat "$project_root/control/build-prospect.sh") == control-code-must-be-preserved ]]
  [[ $(cat "$project_root/shared/.env.local") == private-test-configuration ]]
  [[ -f "$project_root/state/enabled" ]]
done
# shellcheck disable=SC2016 # The quoted program is PHP, not shell.
php -r '
$a=json_decode(file_get_contents($argv[1]."/preprod/control/config.json"),true,32,JSON_THROW_ON_ERROR);
$b=json_decode(file_get_contents($argv[1]."/production/control/config.json"),true,32,JSON_THROW_ON_ERROR);
if ($a["repository_path"] === $b["repository_path"]) throw new RuntimeException("Targets must use separate Git checkouts to isolate FETCH_HEAD");
' "$test_root"
printf 'Target installers: isolation, private permissions, disabled polling, preservation and wrong-target rejection passed.\n'
