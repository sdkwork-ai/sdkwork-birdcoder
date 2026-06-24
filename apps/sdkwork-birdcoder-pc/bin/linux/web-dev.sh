#!/usr/bin/env bash
set -euo pipefail
app_root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$app_root"
exec node ../../../scripts/run-birdcoder-web-command.mjs dev --iam-mode server-private "$@"
