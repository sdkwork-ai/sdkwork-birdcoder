#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../../../.." && pwd)"
exec pnpm --dir "$repo_root" exec sdkwork-app dev --runtime-target desktop --deployment-profile standalone "$@"
