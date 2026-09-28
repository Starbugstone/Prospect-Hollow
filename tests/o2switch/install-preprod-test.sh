#!/usr/bin/env bash
set -euo pipefail
test_root=$(mktemp -d "$HOME/prospect-preprod-install-XXXXXX")
trap 'rm -rf -- "$test_root"' EXIT
project_root="$test_root/site"
php_bin=$(command -v php)
bash scripts/o2switch/install-preprod.sh "$project_root" "$php_bin" >/dev/null
php -r '
$c=json_decode(file_get_contents($argv[1]."/control/config.json"),true,32,JSON_THROW_ON_ERROR);
if($c["branch"]!=="preprod"||$c["workflow"]!=="quality.yml"||$c["profile"]!=="custom"||$c["health_mode"]!=="symfony"||$c["url"]!=="https://preprod.prospecthollow.starbugstone.com")throw new RuntimeException("Wrong deployment target");
if(!str_contains(file_get_contents($argv[1]."/shared/.env.local"), "APP_ORIGIN=https://preprod.prospecthollow.starbugstone.com"))throw new RuntimeException("Wrong application origin");
if(is_file($argv[1]."/state/enabled"))throw new RuntimeException("Installer enabled polling");
foreach(["control/config.json","shared/.env.local"] as $f)if((fileperms($argv[1]."/".$f)&0077)!==0)throw new RuntimeException("Configuration permissions");
' "$project_root"
printf 'private-test-configuration\n' > "$project_root/shared/.env.local"
cp "$project_root/control/config.json" "$test_root/config.before"
bash scripts/o2switch/install-preprod.sh "$project_root" "$php_bin" >/dev/null
cmp "$test_root/config.before" "$project_root/control/config.json"
[[ $(cat "$project_root/shared/.env.local") == private-test-configuration ]]
printf 'Preprod installer: target, private permissions, disabled polling and preserved configuration passed.\n'
