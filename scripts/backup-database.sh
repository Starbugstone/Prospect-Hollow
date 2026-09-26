#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_dir="${BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"
backup_temp=$(mktemp "$backup_dir/.village-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
trap 'rm -f "$backup_temp"' EXIT
docker compose exec -T db pg_dump -U cascade -d cascade -Fc > "$backup_temp"
backup_file="$backup_dir/$(basename "$backup_temp" | cut -c2-).dump"
mv "$backup_temp" "$backup_file"
printf 'Backup written: %s\n' "$backup_file"
