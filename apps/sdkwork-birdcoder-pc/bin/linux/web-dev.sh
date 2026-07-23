#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../../../.." && pwd)"
exec pnpm --dir "$repo_root" exec sdkwork-app dev --runtime-target browser --client-architecture pc-web --deployment-profile standalone "$@"
