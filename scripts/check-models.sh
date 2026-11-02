#!/usr/bin/env bash
# Model-checks docs/models with TLC in Docker. Every pass-* config must hold. Every mut-* config breaks
# one guarantee on purpose and must be caught, and every reach-* config claims something never happens
# that must happen: a model that can't fail, or never reaches the case, proves nothing.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=v1.7.4
SHA256=936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88
JAR=.cache/tla2tools-$VERSION.jar
mkdir -p .cache
if [ ! -f "$JAR" ]; then
  curl -fsSL -o "$JAR.tmp" "https://github.com/tlaplus/tlaplus/releases/download/$VERSION/tla2tools.jar"
  echo "$SHA256  $JAR.tmp" | sha256sum -c - >/dev/null
  mv "$JAR.tmp" "$JAR"
fi
tlc() { # directory config module
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/work -w "/work/$1" eclipse-temurin:21-jre \
    java -XX:+UseParallelGC -cp "/work/$JAR" tlc2.TLC -workers auto -metadir /tmp/states -config "$2.cfg" "$3" 2>&1
}
failed=0
for directory in docs/models/*/; do
  directory=${directory%/}
  module=$(basename "$(ls "$directory"/MC*.tla)" .tla)
  for config in "$directory"/*.cfg; do
    name=$(basename "$config" .cfg)
    output=$(tlc "$directory" "$name" "$module") && status=0 || status=$?
    states=$(grep -oE '[0-9,]+ distinct states found' <<<"$output" | tail -1 || true)
    case "$name" in
      mut-*|reach-*)
        if [ "$status" -ne 0 ] && grep -qE 'Invariant .* is violated|Temporal properties were violated' <<<"$output"; then
          echo "failed as it must  $name: $(grep -oE 'Invariant [A-Za-z]+ is violated' <<<"$output" | head -1)"
        else echo "MISSED  $name"; grep -vE '^(/\\|  |      )' <<<"$output" | head -30; failed=1; fi ;;
      *)
        if [ "$status" -eq 0 ] && grep -q 'Model checking completed. No error has been found' <<<"$output"; then
          echo "holds  $name: $states"
        else echo "FAILED  $name"; grep -vE '^(/\\|  |      )' <<<"$output" | head -40; failed=1; fi ;;
    esac
  done
done
exit "$failed"
