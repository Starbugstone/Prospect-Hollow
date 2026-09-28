#!/usr/bin/env bash
# Install reviewed control code. Never enables polling or deploys an application.
set -euo pipefail
source_dir=$(cd "$(dirname "$0")" && pwd)
exec bash "$source_dir/install-prospect.sh" preprod "$@"
