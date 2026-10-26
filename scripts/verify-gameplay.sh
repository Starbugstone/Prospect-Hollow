#!/usr/bin/env bash
# Isolated Docker lifecycle for .agents/skills/verify-prospect-hollow.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
COMPOSE="$ROOT/testing/verification/compose.yaml"
usage() {
  cat <<'USAGE'
Usage: bash scripts/verify-gameplay.sh all
       bash scripts/verify-gameplay.sh start
       bash scripts/verify-gameplay.sh doctor RUN_DIRECTORY
       bash scripts/verify-gameplay.sh run RUN_DIRECTORY [valley|mine|moon-input|moonstones|all]
       bash scripts/verify-gameplay.sh cleanup RUN_DIRECTORY [--dry-run]

all creates a fresh isolated stack, runs doctor and every journey, and cleans up.
start prints its run directory; use it for later commands. Evidence stays there.
Docker/Compose and network access for image/package downloads are prerequisites.
No host Node or PHP is used. Shared build-image caches are retained.
USAGE
}
die() { echo "ERROR: $*" >&2; exit 2; }
dc() { docker compose --env-file "$PH_RUN/compose.env" -p "$PROJECT" -f "$COMPOSE" "$@"; }
load_run() {
  [[ -n "${1:-}" && -d "$1" ]] || die 'Supply the run directory printed by start.'
  PH_RUN=$(cd "$1" && pwd -P)
  [[ "$PH_RUN" == "$ROOT/output/verification/"run-* ]] || die 'Run must belong to this checkout under output/verification/run-*.'
  [[ -f "$PH_RUN/owner" && "$(cat "$PH_RUN/owner")" == "$ROOT" ]] || die 'Run ownership marker does not match this checkout.'
  PROJECT=$(basename "$PH_RUN")
  PROJECT=${PROJECT,,}
  [[ "$PROJECT" =~ ^run-[0-9]{8}-[0-9]{6}-[a-zA-Z0-9]{6}$ ]] || die 'Invalid run identifier.'
  export PH_RUN
}
cleanup() {
  if [[ "${1:-}" == --dry-run ]]; then
    echo "Would remove only Compose project $PROJECT (containers, network, database and dependency volumes)."
    dc ps -a || return 1
    echo "Evidence retained: $PH_RUN"
    return
  fi
  [[ -z "${1:-}" ]] || die 'cleanup accepts only --dry-run.'
  if ! dc down --volumes --remove-orphans >"$PH_RUN/cleanup.log" 2>&1; then
    cat "$PH_RUN/cleanup.log" >&2
    return 1
  fi
  echo "Cleaned $PROJECT; evidence retained: $PH_RUN"
}
doctor() {
  echo "Checkout: $ROOT"
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
  echo "Started from: $(cat "$PH_RUN/commit")"
  local service container port destination expected mounted
  for service in web app; do
    container=$(dc ps -q "$service")
    [[ -n "$container" ]] || { echo "FAIL: $service is not running; start a fresh stack."; return 1; }
    docker inspect --format '{{range .Mounts}}Mount: {{.Source}} -> {{.Destination}}{{println}}{{end}}' "$container"
    destination=/app
    expected="$ROOT"
    if [[ "$service" == app ]]; then destination=/var/www/app/src; expected="$ROOT/backend/src"; fi
    mounted=$(docker inspect --format "{{range .Mounts}}{{if eq .Destination \"$destination\"}}{{.Source}}{{end}}{{end}}" "$container")
    [[ "$mounted" == "$expected" ]] || { echo "FAIL: $service serves $mounted, expected $expected."; return 1; }
    port=$(dc port "$service" "$([[ "$service" == web ]] && echo 5173 || echo 80)")
    echo "$service: http://$port"
  done
  dc run --rm --no-deps browser node testing/verification/doctor.cjs
}
start() {
  command -v docker >/dev/null || die 'Install Docker with Compose first.'
  docker info >/dev/null 2>&1 || die 'Start Docker before running verification.'
  mkdir -p "$ROOT/output/verification"
  PH_RUN=$(mktemp -d "$ROOT/output/verification/run-$(date -u +%Y%m%d-%H%M%S)-XXXXXX")
  export PH_RUN
  PROJECT=$(basename "$PH_RUN")
  PROJECT=${PROJECT,,}
  mkdir "$PH_RUN/artifacts"
  printf '%s\n' "$ROOT" >"$PH_RUN/owner"
  git -C "$ROOT" rev-parse HEAD >"$PH_RUN/commit"
  git -C "$ROOT" diff --binary HEAD >"$PH_RUN/working-tree.patch"
  while IFS= read -r -d '' file; do
    git -C "$ROOT" diff --no-index --binary -- /dev/null "$file" >>"$PH_RUN/working-tree.patch" || [[ $? == 1 ]]
  done < <(git -C "$ROOT" ls-files --others --exclude-standard -z)
  git -C "$ROOT" status --short >"$PH_RUN/status.txt"
  printf 'APP_ORIGIN=http://localhost\n' >"$PH_RUN/app.env"
  # Quote paths for Compose's dotenv parser; reject ambiguous values rather than
  # sourcing a generated shell file or silently pointing at a different checkout.
  [[ "$ROOT" != *"'"* && "$ROOT" != *$'\n'* ]] || die 'Checkout path cannot contain a single quote or newline.'
  printf "PH_CHECKOUT='%s'\nPH_RUN='%s'\nPH_UID=%s\nPH_GID=%s\n" "$ROOT" "$PH_RUN" "$(id -u)" "$(id -g)" >"$PH_RUN/compose.env"
  echo "Run directory: $PH_RUN"
  dc build app browser >"$PH_RUN/build.log" 2>&1
  dc run --rm --no-deps --user 0 web chown "$UID:$(id -g)" /app/node_modules >"$PH_RUN/dependencies.log" 2>&1
  dc run --rm --no-deps web npm ci >>"$PH_RUN/dependencies.log" 2>&1
  dc up -d --wait --wait-timeout 180 db app web >"$PH_RUN/start.log" 2>&1
  local backend
  backend="http://$(dc port app 80)"
  printf 'APP_ORIGIN=%s\n' "$backend" >"$PH_RUN/app.env"
  printf 'PH_BACKEND_ORIGIN=%s\n' "$backend" >>"$PH_RUN/compose.env"
  dc exec -T --user "$(id -u):$(id -g)" app php bin/migrate.php >"$PH_RUN/migrate.log" 2>&1
  doctor | tee "$PH_RUN/doctor.log"
}
run_journeys() {
  local requested="${1:-all}" failed=0 name script status
  case "$requested" in valley|mine|moon-input|moonstones|all) ;; *) die "Unknown journey: $requested" ;; esac
  doctor >"$PH_RUN/doctor.log" 2>&1 || { cat "$PH_RUN/doctor.log"; return 1; }
  printf 'journey\tstatus\n' >"$PH_RUN/results.tsv"
  for name in valley mine moon-input moonstones; do
    [[ "$requested" == all || "$requested" == "$name" ]] || continue
    case "$name" in
      valley) script=valley-persistence.cjs ;;
      mine) script=mine-feedback.cjs ;;
      moon-input) script=moon-input.cjs ;;
      moonstones) script=moonstone-resource.cjs ;;
    esac
    echo "Running $name (log: $PH_RUN/$name.log)"
    if dc run --rm --no-deps browser timeout 20m node "testing/browser/$script" >"$PH_RUN/$name.log" 2>&1; then
      status=passed
    else
      status=failed
      failed=1
      tail -20 "$PH_RUN/$name.log"
    fi
    printf '%s\t%s\n' "$name" "$status" | tee -a "$PH_RUN/results.tsv"
  done
  return "$failed"
}
case "${1:---help}" in
  -h|--help|help) usage ;;
  all)
    # Preserve the original failure, including interrupted setup, while removing
    # only this run's resources. A failed cleanup must not look like success.
    trap 'result=$?; trap - EXIT; if [[ -n "${PH_RUN:-}" && -f "$PH_RUN/compose.env" ]]; then cleanup || result=1; fi; exit "$result"' EXIT
    start
    run_journeys all
    ;;
  start) start ;;
  doctor) load_run "${2:-}"; doctor ;;
  run) load_run "${2:-}"; run_journeys "${3:-all}" ;;
  cleanup) load_run "${2:-}"; cleanup "${3:-}" ;;
  *) usage >&2; die "Unknown command: $1" ;;
esac
